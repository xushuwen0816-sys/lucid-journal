# 📊 项目状态档案：Lucid Journal

> **单一真实数据源 (Single Source of Truth)**：记录项目基础设施、配置和当前状态。

## 🏗 基础设施 (Infrastructure)

| 组件 | 服务商 | 状态 | 备注 |
| :--- | :--- | :--- | :--- |
| **后端** | Railway | 🟢 已部署 | Node.js / Express (Port 5432 Session Pooler) |
| **数据库** | Supabase | 🟢 已连接 | PostgreSQL (IPv4 Compatible) |
| **邮件服务** | Resend | 🟢 已验证 | HTTP API (端口 443) |
| **前端** | Vercel | 🟢 已部署 | React / Vite |
| **AI 服务** | Google Gemini | 🟢 已优化 | Cloudflare Proxy + Retry Logic |
| **代码仓库** | GitHub | 🟢 已同步 | **主仓库**: [lucid-journal](https://github.com/xushuwen0816-sys/lucid-journal)<br>**备份仓库**: [lucid-journal-backup](https://github.com/xushuwen0816-sys/lucid-journal-backup) |

## 🔑 关键配置 (Key Configuration)

### 环境变量 (Railway - Backend)
- `DATABASE_URL`: Supabase Session Pooler 连接字符串 (Port 5432)
- `RESEND_API_KEY`: 以 `re_` 开头的 API 密钥
- `EMAIL_FROM`: `noreply@email.lucidjournal.space`

### 环境变量 (Frontend - Vercel / Netlify)
- `VITE_API_URL`: 后端 API 地址 (e.g., `https://lucid-journal-production.up.railway.app`)
- `VITE_DEFAULT_API_KEY`: Google AI Studio API Key
- `VITE_DEFAULT_PROXY_URL`: Cloudflare Worker 代理地址

## 📝 最近变更记录 (Recent Changes)

- **2026-02-08 (Deployment & Backup)**:
  - 🔄 **备份仓库**: 创建并同步了 `lucid-journal-backup` 仓库。
  - 🌐 **Netlify 适配**: 添加 `netlify.toml` 配置文件，修复 SPA 路由重定向问题。

- **2026-02-06 (Core Features)**:
  - 🚀 **后端部署**: 成功部署至 Railway，优化数据库连接 (Session Pooler)。
  - 📧 **邮件服务**: 迁移至 Resend API，解决 SMTP 端口封锁问题。
  - 🤖 **AI 服务**: 升级 Gemini SDK，配置 Cloudflare 代理解决连接问题。
  - ☁️ **数据同步**: 实现日记、愿望、时间胶囊的全量云端同步与本地导入。

## 🛠 调试工具 (Debugging Tools)

- **健康检查**: `GET /health` (返回 200 OK)
- **环境检查**: `GET /api/debug/env-check`
