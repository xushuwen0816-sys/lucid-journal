# Vibe Coding 开发手册：全栈部署与调试篇

本文档记录了在使用 Vibe Coding (AI 辅助编程) 开发 Lucid Journal 并在 Railway + Supabase 架构下部署时遇到的真实问题与解决方案。

## 一、 核心架构选择

*   **前端**: Vite + React + TypeScript
*   **后端**: Node.js + Express
*   **数据库**: PostgreSQL (Supabase)
*   **ORM**: Prisma
*   **部署**: Railway (后端), Vercel/Railway (前端)

---

## 二、 部署避坑指南 (The "Pitfalls")

### 1. 数据库连接：永远的痛
**现象**: 部署后后端不报错，但请求一直 Pending 直到超时 (502/504)。
**原因**:
1.  **IPv6 陷阱**: Supabase 默认提供的直连地址是 IPv6 的，而 Railway 目前只支持 IPv4。
2.  **端口陷阱**: 端口 `6543` (Transaction Mode) 在 Serverless 环境下配合 Prisma 经常导致连接挂起。
**解决方案**:
*   **必须使用 Session Pooler**。
*   **地址格式**: `...pooler.supabase.com:5432...`
*   **如何找到**: 如果 Supabase 界面找不到，直接拼凑：`postgresql://[user]:[pwd]@[region].pooler.supabase.com:5432/postgres`

### 2. 启动超时 (502 Bad Gateway)
**现象**: Railway 部署成功，但访问网页显示 502。
**原因**:
*   我们在 `npm start` 命令里加了 `prisma db push`。
*   Railway 启动容器后，等待应用监听端口。但应用正在忙着同步数据库，没空监听。
*   Railway 等得不耐烦了，判定启动失败，杀掉进程。
**解决方案**:
*   **分离任务**: 把数据库操作放到 **构建阶段 (Build Command)**。
*   **Build Command**: `npm install && npm run build && npx prisma db push --accept-data-loss`
*   **Start Command**: `npm start` (只做一件事：启动 Server)。

### 3. Prisma 迁移冲突 (Error P3019)
**现象**: `The datasource provider postgresql specified in your schema does not match... sqlite`
**原因**: 本地开发用了 SQLite，生成了 SQLite 的迁移文件。部署时换成了 Postgres，Prisma 发现迁移记录对不上。
**解决方案**:
*   **暴力解法 (推荐初级阶段)**: 删除本地 `prisma/migrations` 文件夹。
*   **使用 Push**: 使用 `prisma db push` 代替 `migrate deploy`，它会忽略历史记录，直接把 schema 同步到数据库。

---

## 三、 Vibe Coding 协作技巧

在使用 AI 辅助编程时，为了提高效率，建议遵循以下原则：

1.  **报错信息要完整**:
    *   ❌ "报错了，连不上"
    *   ✅ "前端报错 Failed to fetch (Requesting: https://api.example.com/login)，同时后端 Railway 日志显示 Error: P2021 Table not found。"
    *   *AI 需要知道是哪一端出的问题，以及具体的错误码。*

2.  **区分环境**:
    *   明确告诉 AI 你现在是在 **本地 (Local)** 还是 **生产环境 (Production)**。
    *   这两者的配置（如 `localhost` vs `0.0.0.0`，`.env` vs 平台变量）完全不同。

3.  **验证步骤**:
    *   当 AI 建议修改配置时，不要只改代码。
    *   **检查是否生效**: 比如修改了 `package.json`，要确认 Railway 是否真的拉取了最新的 Commit（看 Commit SHA）。
    *   **强制刷新**: 有时候部署平台有缓存，需要 "Redeploy without cache"。

4.  **调试工具**:
    *   **前端 UI 显示错误**: 不要只在 `console.log` 里打印错误（手机端/无法打开控制台时看不到）。把错误信息（特别是 URL）直接渲染在页面红框里。
    *   **后端 Health Check**: 永远保留一个 `/health` 接口，这是判断 "后端挂了" 还是 "数据库挂了" 的金标准。

---

## 四、 常用命令速查

**Git 强制提交 (触发部署)**:
```bash
git commit --allow-empty -m "chore: trigger deploy"
git push
```

**Prisma 常用**:
```bash
# 本地同步数据库
npx prisma db push

# 生成 Client (每次修改 schema 后必须跑)
npx prisma generate

# 查看数据库状态 (GUI)
npx prisma studio
```
