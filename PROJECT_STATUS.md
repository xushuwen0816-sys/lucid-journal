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

## 💻 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: React 19, TypeScript, Vite
- **UI/样式**: Tailwind CSS (CDN Config), Lucide React (Icons), Framer Motion (Animations)
- **数据展示**: Recharts (图表)
- **AI 集成**: Google GenAI SDK (`@google/genai`)

### 后端 (Backend)
- **运行时**: Node.js v22+, Express
- **数据库 ORM**: Prisma (PostgreSQL)
- **身份验证**: JWT, bcryptjs
- **任务调度**: node-cron (定时任务)
- **邮件服务**: Resend, Nodemailer

## 🗄️ 数据架构 (Data Architecture)

### 核心模型 (Prisma Models)
- **User**: 用户身份核心，包含 API Key 和 Proxy 配置。
- **JournalEntry**: 日记记录，包含 AI 分析字段。
- **Wish**: 愿望/意图，包含标签、信念和 AI 生成的肯定语。
- **RitualArchiveEntry**: 仪式记录，存储塔罗/神谕卡读取和每日练习 (JSON 格式存储)。
- **FutureLetter**: 给未来的信，支持 AI 回复和锁定机制。

### 数据同步 (Sync Strategy)
- **策略**: 登录时从后端全量拉取，本地操作实时同步至后端。
- **离线支持**: 使用 LocalStorage 作为本地缓存 (`lucid_wishes`, `lucid_all_journals` 等)。

## 🎨 布局与设计规范 (Layout & Design)

### 页面结构 (Page Structure)
- **单页应用 (SPA)**: 基于状态 (`currentView`) 切换视图，非路由跳转。
- **主要视图**:
  - **Energy**: 能量检查
  - **Intent**: 意图设定
  - **Journal**: 日记书写
  - **Archive**: 档案回顾 (里程碑、信件、愿望、藏书阁)

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
