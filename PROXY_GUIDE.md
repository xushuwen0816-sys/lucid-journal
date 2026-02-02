# LUCID 中国大陆访问加速指南 (Gemini API Proxy Guide)

由于网络环境限制，中国大陆用户直接访问 Google Gemini API (`generativelanguage.googleapis.com`) 通常会遇到连接超时或失败。

**核心解决方案：使用 Cloudflare Workers 搭建自定义域名的 API 代理。**

> ⚠️ **注意**：由于 Cloudflare 的默认域名 `*.workers.dev` 在国内已被阻断，您**必须**拥有一个自己的域名（并接入 Cloudflare）才能实现国内直连。

---

## 第一步：部署 Cloudflare Worker

1.  注册/登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **Create Application** -> **Create Worker**。
3.  命名您的 Worker（例如 `gemini-proxy`），点击 Deploy。
4.  点击 **Edit Code**，**完全覆盖**粘贴以下代码：

```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. 处理 OPTIONS 预检请求 (解决浏览器跨域卡顿问题)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);
    
    // 2. 将请求转发到 Google Gemini API
    url.hostname = 'generativelanguage.googleapis.com';
    url.protocol = 'https:';
    url.port = ''; // 确保端口清空
    
    // 路径 (pathname) 和查询参数 (search) 会自动保留，无需手动拼接

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
        
        // 确保响应头包含 CORS 信息
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Headers', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
  },
};
```

5.  点击右上角 **Deploy** 保存。

---

## 第二步：接入域名 (关键)

如果您的域名还未托管在 Cloudflare，请先接入：

1.  在 Cloudflare 首页点击 **Add a site**。
2.  输入您的域名（如 `example.com`），选择 **Free** 计划。
3.  Cloudflare 会提供两个 **Nameservers**（如 `bob.ns.cloudflare.com`）。
4.  前往您购买域名的服务商（阿里云、腾讯云等），修改 DNS 服务器为 Cloudflare 提供的这两个地址。
5.  等待生效（通常几分钟到一小时）。

---

## 第三步：绑定自定义域名

1.  回到 Cloudflare Dashboard -> **Workers & Pages**。
2.  点击您刚才创建的 Worker -> **Settings** -> **Domains & Routes**。
3.  点击 **Add** -> **Custom Domain**。
4.  输入一个子域名，例如：`api.example.com` (推荐使用子域名，不影响主站)。
5.  点击 **Add Custom Domain**，等待状态变为 **Active**。

> **提示**：如果您的 SSL/TLS 设置不是 Full，建议在域名设置中改为 **Full** 模式以确保最佳兼容性。

---

## 第四步：LUCID 设置

1.  打开 LUCID 应用 -> 设置。
2.  服务商选择 **Google Gemini**。
3.  开启 **"国内访问加速 / 自定义代理"**。
4.  在代理地址栏填入您的完整域名：
    `https://api.example.com`
    *(注意：不要带 /v1beta 或其他后缀)*
5.  点击 **"测试连通性"**，显示绿色成功即可。

---

## 常见问题排查

*   **报错 `Failed to fetch`**:
    *   检查域名是否拼写正确。
    *   检查是否错误填入了 `workers.dev` 域名（国内无法访问）。
    *   检查是否是 HTTPS 证书问题（尝试在浏览器直接访问该地址）。

*   **报错 `404 Not Found`**:
    *   如果是在浏览器直接访问根路径显示 404，是**正常**的（Google 也是这样）。
    *   如果在 App 内报错，请检查 Worker 代码是否是最新的（见第一步）。

*   **报错 `429 Resource exhausted`**:
    *   这是 Google 对免费 API 的频率限制。LUCID 已内置自动重试机制，通常稍等片刻即可自动恢复。
