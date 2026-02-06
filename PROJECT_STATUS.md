# 📊 项目状态档案：Lucid Journal

> **单一真实数据源 (Single Source of Truth)**：记录项目基础设施、配置和当前状态。

## 🏗 基础设施 (Infrastructure)

| 组件 | 服务商 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| **后端** | Railway | 🟢 已部署 | Node.js / Express (Port 5432 Session Pooler) |
| **数据库** | Supabase | 🟢 已连接 | PostgreSQL (IPv4 Compatible) |
项目中有一个专门的脚本 check-provider.js ，在启动或构建时自动检测当前环境：
- 如果在本地，它会自动把 schema.prisma 改为 sqlite 。
- 如果在生产环境，它会自动把配置改回 postgresql 。
| **邮件服务** | Resend | 🟢 已验证 | HTTP API (端口 443) |
| **前端** | Vercel | 🟢 已部署 | React / Vite |
| **AI 服务** | Google Gemini | 🟢 已优化 | Cloudflare Proxy + Retry Logic |

## 🔑 关键配置 (Key Configuration)

### 邮件服务 (Resend)
- **域名**: `email.lucidjournal.space`
- **发件人地址**: `Lucid Postoffice <noreply@email.lucidjournal.space>`
- **API 密钥变量**: `RESEND_API_KEY` (已在 Railway 设置)
- **备用方案**: SMTP (已禁用/被 Railway 封锁)

### AI 服务 (Google Gemini)
- **模型**: `gemini-2.5-flash` (标准化版本)
- **代理**: Cloudflare Worker (解决中国大陆连接问题)
- **SDK**: `@google/genai` (配置了 `httpOptions.baseUrl`)
- **策略**: 自动重试 (Exponential Backoff) 处理 429 错误

### 环境变量 (Railway - Backend)
- `DATABASE_URL`: Supabase Session Pooler 连接字符串 (Port 5432, pooler.supabase.com)
- `DIRECT_URL`: Supabase Direct 连接字符串 (Port 5432, IPv6)
- `RESEND_API_KEY`: 以 `re_` 开头的 API 密钥
- `EMAIL_FROM`: `noreply@email.lucidjournal.space`
- `PORT`: `PORT` (由 Railway 自动分配)

### 环境变量 (Vercel - Frontend)
- `VITE_API_URL`: 后端 API 地址 (e.g., `https://lucid-journal-production.up.railway.app`)
- `VITE_DEFAULT_API_KEY`: Google AI Studio API Key
- `VITE_DEFAULT_PROXY_URL`: Cloudflare Worker 代理地址

### 环境变量 (Expo Client)
- `EXPO_PUBLIC_GEMINI_API_KEY`: Google AI Studio API Key
- `EXPO_PUBLIC_GEMINI_PROXY_URL`: Cloudflare Worker 代理地址
- `EXPO_PUBLIC_GEMINI_MODEL`: `gemini-2.5-flash`

## 📝 最近变更记录 (Recent Changes)

- **2026-02-06 (AI Connectivity)**:
  - 🌐 **代理配置**: 部署 Cloudflare Worker 作为反向代理，解决国内访问 `generativelanguage.googleapis.com` 的问题。
  - 🔧 **SDK 修复**: 修正 `@google/genai` 初始化逻辑，强制使用 `httpOptions.baseUrl` 以支持代理路径。
  - 🔄 **稳定性**: 实施全局重试机制 (Exponential Backoff)，自动处理 API 返回的 `429 Resource Exhausted` 错误。
  - ⚡️ **模型升级**: 全局统一使用 `gemini-2.5-flash` 模型，提升响应质量和稳定性。
  - 📚 **文档**: 创建 `SKILLS.md` (开发者指南) 和更新 `PROXY_GUIDE.md` (用户代理设置指南)。

- **2026-02-06 (Deployment Success)**:
  - 🚀 **后端部署**: 成功部署至 Railway，解决了 502 Bad Gateway 和启动超时问题。
    - **优化**: 将 `prisma db push` 移至 Build Command，避免启动时超时。
    - **Procfile**: 添加 `web: npm start` 明确启动命令。
  - 🔌 **数据库连接**: 解决 Supabase 连接挂起和 IPv6 兼容性问题。
    - **Session Pooler**: 切换至 Port 5432 Session Pooler (`pooler.supabase.com`) 以支持 Railway 的 IPv4 环境。
    - **Prisma**: 修复 `P3019` (Provider Mismatch) 和 `P2021` (Table not found) 错误。
  - 🌐 **前端连接**: 修复 404 和 CORS 问题。
    - **API URL**: 配置 `VITE_API_URL` 环境变量，确保生产环境使用绝对路径。
    - **CORS**: 后端允许 Vercel 域名的跨域请求。

- **2026-02-06 (Email Service)**:
  - 🔄 **迁移**: 从 SMTP (QQ/Gmail) 切换至 **Resend API**，以绕过 Railway 对 465/587 端口的封锁。
  - 🐛 **修复**: 通过使用 HTTP 传输解决了 `ENETUNREACH` 和 `ETIMEDOUT` 错误。
  - 🛠 **工具**: 添加了 `/api/debug/force-send` 和 `/api/debug/connectivity-check` 接口。
  - 🌐 **域名**: 配置了自定义域名 `email.lucidjournal.space`。

- **2026-02-06 (Data Sync)**:
  - ☁️ **云端同步**: 实现了核心数据的全量云端同步，支持多端数据一致性。
    - **每日仪式 (Daily Ritual)**: 存档、读取、删除。
    - **日记 (Journal)**: 创建、读取、更新、删除。
    - **愿望 (Wish)**: 创建、读取、更新、删除。
    - **时间胶囊 (Time Capsule)**: 寄信、读取、删除。
    - **数据导入 (Import)**: 支持导入本地 JSON 备份并自动同步至云端 (Upsert)。
  - 🔒 **数据安全**: 所有 API 请求均经过 JWT 身份验证。

## 🛠 调试工具 (Debugging Tools)

- **强制发送邮件**: `GET /api/debug/force-send?email=your@email.com`
- **检查连通性**: `GET /api/debug/connectivity-check?host=smtp.gmail.com`
- **检查环境变量**: `GET /api/debug/env-check`
- **健康检查**: `GET /health` (返回 200 OK)
