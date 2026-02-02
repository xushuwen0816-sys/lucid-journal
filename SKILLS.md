# Gemini API Proxy & Integration Skills

本文档汇总了在中国大陆环境下，使用 `@google/genai` SDK 并配合 Cloudflare Workers 实现 Gemini API 稳定访问的完整技术方案。适用于任何需要集成 Google AI 能力的 Web 项目。

## 1. 核心痛点与解决方案

| 问题现象 | 原因分析 | 解决方案 |
| :--- | :--- | :--- |
| **连接超时 (ERR_TIMED_OUT)** | `generativelanguage.googleapis.com` 在国内被阻断。 | 使用 Cloudflare Worker 反向代理。 |
| **Failed to fetch** (即使有代理) | 1. 域名被污染 (workers.dev)。<br>2. 浏览器 CORS 跨域拦截。<br>3. SSL 握手失败。 | 1. **必须绑定自定义域名**。<br>2. Worker 处理 OPTIONS 请求。<br>3. 检查 SSL 设置。 |
| **404 Not Found** (即使网络通) | SDK 自动拼接路径导致 URL 错误 (如 `/v1beta/v1beta/...`)。 | **双重配置 SDK Base URL** (见下文)。 |
| **429 Resource Exhausted** | 免费版 API 频率限制或冷启动并发限制。 | 实现**指数退避重试机制**。 |

---

## 2. Cloudflare Worker 标准代理代码

这是经过验证的、兼容性最好的 Worker 代码。它解决了 CORS、路径透传和端口清理问题。

```javascript
/**
 * Cloudflare Worker for Gemini API Proxy
 * 部署说明：
 * 1. 创建 Worker 并粘贴此代码。
 * 2. 必须在 Settings -> Domains & Routes 中绑定一个自定义域名 (如 api.yourdomain.com)。
 *    不要使用默认的 *.workers.dev，国内无法访问。
 */

export default {
  async fetch(request, env, ctx) {
    // 1. 处理 OPTIONS 预检请求 (解决浏览器跨域卡顿/报错问题)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", // 生产环境建议改为指定域名
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    
    // 2. 将请求转发到 Google Gemini API
    url.hostname = 'generativelanguage.googleapis.com';
    url.protocol = 'https:';
    url.port = ''; // 关键：清空端口，防止将本地开发端口(如3000)带给 Google
    
    // 注意：url.pathname (如 /v1beta/models/...) 会自动保留，无需手动拼接

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    // 3. 发送请求并处理响应
    try {
        const response = await fetch(newRequest);
        const newHeaders = new Headers(response.headers);
        
        // 确保响应头包含 CORS 信息，否则前端 fetch 会报错
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Headers', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
    } catch (err) {
        // 捕获网络层面的错误 (如 DNS 解析失败)
        return new Response(JSON.stringify({ error: `Proxy Error: ${err.message}` }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
  },
};
```

---

## 3. 前端 SDK 适配指南 (`@google/genai`)

Google 新版 SDK 对 `baseUrl` 的处理非常严格。如果配置不当，SDK 会忽略代理设置直接连接 Google，导致超时。

### ✅ 最佳实践：双重配置

```typescript
import { GoogleGenAI } from "@google/genai";

const initGemini = (apiKey: string, proxyUrl?: string) => {
    const clientOptions: any = { apiKey };

    if (proxyUrl) {
        // 1. 清理 URL：移除尾部斜杠，确保格式纯净
        const cleanUrl = proxyUrl.replace(/\/+$/, '');
        
        // 2. 双重配置：同时设置顶层属性和 httpOptions
        // 原因：不同版本的 SDK (或 SDK 内部不同模块) 读取配置的位置可能不同
        
        // Method A: 兼容旧版或部分逻辑
        clientOptions.baseUrl = cleanUrl; 
        
        // Method B: 新版 SDK 标准写法
        clientOptions.httpOptions = {
            baseUrl: cleanUrl,
            apiVersion: 'v1beta' // 显式指定版本，防止 SDK 乱猜
        };
        
        console.log('[Gemini] Initializing with proxy:', cleanUrl);
    }

    return new GoogleGenAI(clientOptions);
};
```

---

## 4. 健壮性设计：自动重试 (Auto-Retry)

针对 `429 Resource Exhausted` 错误，前端必须实现重试机制，否则用户体验会非常差（表现为随机的“断网”或报错）。

```typescript
/**
 * 包装任何 Promise 函数，实现 429 自动重试
 * @param fn 执行 API 调用的函数
 * @param maxRetries 最大重试次数 (默认 3)
 * @param baseDelay 基础等待时间 (ms)
 */
const callWithRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
): Promise<T> => {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;
            if (attempt > maxRetries) throw error;
            
            // 检测是否为 429 错误
            const is429 = error.message && (
                error.message.includes("429") || 
                error.message.includes("Resource exhausted") ||
                error.message.includes("quota")
            );

            if (is429) {
                console.warn(`[Gemini] 429 Error (Attempt ${attempt}/${maxRetries}). Retrying...`);
                // 简单的指数退避
                const delay = baseDelay * Math.pow(1.5, attempt - 1); 
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // 其他错误直接抛出，不重试
            }
        }
    }
};

// 使用示例
await callWithRetry(() => model.generateContent(...));
```

---

## 5. 连通性检测 Checklist

在开发“设置”页面时，使用以下逻辑判断代理是否有效：

1.  **发起一个极简请求**：使用 `ping` 或 `Hello` 作为 Prompt，`maxOutputTokens: 1`。
2.  **捕获特定错误**：
    *   如果收到 `404 Not Found` (且响应体是 Google 的 JSON 格式)：**判定为成功**。说明网络通了，只是路径/模型有问题。
    *   如果收到 `400 Bad Request` (INVALID_ARGUMENT)：**判定为成功**。说明网络通了，只是 Key 有问题。
    *   如果收到 `Failed to fetch`：**判定为失败**。网络确实不通。
3.  **超时控制**：设置 10s 超时，防止 UI 长时间卡死。

```typescript
// 连通性检测伪代码
try {
    await callWithRetry(() => model.generateContent("ping"));
    return { success: true };
} catch (error) {
    if (error.message.includes("404") || error.message.includes("400")) {
        // 网络通了，只是参数问题，也可以算作“代理连通性”通过
        return { success: true, warning: "Connected, but check Key/Model" };
    }
    return { success: false, error: error.message };
}
```
