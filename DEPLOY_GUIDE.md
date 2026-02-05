# LUCID Journal 部署指南

本文档将指导您（零基础）完成 LUCID Journal 的本地测试及部署到生产环境（Railway + Vercel）。

---

## 第一部分：本地测试 (Local Testing)

在部署之前，我们先确保邮件发送功能在本地是正常的。

### 1. 准备工作
您已经填写了 `.env.example`，我已帮您将其复制为 `.env`。这是本地运行所需的配置文件。

### 2. 启动服务
请确保您打开了两个终端窗口（或在 VS Code 的终端标签页中切换）：

**终端 1 (后端):**
```bash
cd server
npm install
npm run dev
```
*如果看到 `Server running on port 3002` 和 `⏰ Scheduler service started...`，说明后端启动成功。*

**终端 2 (前端):**
```bash
npm install
npm run dev
```
*打开浏览器访问显示的 Local 地址 (通常是 http://localhost:5173)*

### 3. 测试发送信件
1. 在浏览器中打开应用，点击“时空” (Archive) 标签。
2. 点击“写给未来的自己”。
3. 在“送达时间”下拉菜单中，选择 **“10秒后 (测试)”**。
4. 随便写点内容，点击“封存信件”。
5. **观察后端终端 (终端 1)**：
   - 您应该会看到类似 `Found 1 due letters to send.` 的日志。
   - 紧接着是 `Message sent: ...` 和 `Letter ... sent to ...`。
6. **检查您的邮箱**：
   - 去您注册账号时填写的邮箱（或者是您在 `.env` 里配置的邮箱，取决于您是用什么账号登录的 LUCID）。
   - **注意**：如果是第一次发信，邮件可能会进入**垃圾箱**，请务必检查。

---

## 第二部分：部署到生产环境 (Production)

我们将后端部署到 **Railway**，前端部署到 **Vercel**。

### 步骤 A: 准备 GitHub 仓库
1. 确保您的代码已经提交并推送到 GitHub。
   - 如果您还没有 GitHub 仓库，请去 github.com 新建一个，然后按页面提示把本地代码推上去。

### 步骤 B: 部署后端 (Railway)

**Railway** 是一个非常适合部署 Node.js 后端的平台。

1. **注册/登录 Railway**: 访问 [railway.app](https://railway.app/)，使用 GitHub 账号登录。
2. **新建项目**: 点击 "New Project" -> "Deploy from GitHub repo" -> 选择您的 `lucid-journal` 仓库。
3. **添加数据库 (PostgreSQL)**:
   - 在项目视图中，点击右键或 "Add Service" -> "Database" -> "PostgreSQL"。
   - 等待数据库创建完成。
4. **配置后端服务**:
   - 点击刚才从 GitHub 导入的那个服务（通常叫 `lucid-journal`）。
   - 进入 **Settings** -> **Root Directory**，将其修改为 `/server` (因为我们的后端代码在 server 目录下)。
   - 进入 **Variables** (环境变量) 选项卡。
   - 点击 "Raw Editor" (或者批量添加)，把您本地 `server/.env` 文件里的内容全部复制进去。
   - **重要修改**:
     - 在 Railway 提供的变量里，找到 `DATABASE_URL` (这是 PostgreSQL 的地址)。
     - 确保您刚才粘贴进去的变量里，**不要**覆盖这个 `DATABASE_URL`，或者手动将其修改为 Railway 提供的 PostgreSQL 连接地址 (在 PostgreSQL 服务的 Connect 选项卡里可以找到)。
     - *提示：Railway 会自动注入 `DATABASE_URL` 和 `PORT`，您主要需要填 SMTP 相关的配置和 `JWT_SECRET`。*
5. **生成域名**:
   - 在 Settings -> Networking -> Generate Domain。
   - 记下这个域名，比如 `https://lucid-server-production.up.railway.app`。这是您的**后端 API 地址**。

### 步骤 C: 部署前端 (Vercel)

**Vercel** 是部署前端的最佳选择。

1. **注册/登录 Vercel**: 访问 [vercel.com](https://vercel.com/)，使用 GitHub 账号登录。
2. **新建项目**: 点击 "Add New..." -> "Project" -> Import 您的 `lucid-journal` 仓库。
3. **配置项目**:
   - **Framework Preset**: 选择 `Vite`。
   - **Root Directory**: 保持默认 `./` (或者如果不生效，检查是否需要选根目录，通常默认即可)。
   - **Environment Variables**:
     - 添加一个变量名为 `VITE_API_URL`。
     - 值填写您在 Railway 生成的后端地址 (例如 `https://lucid-server-production.up.railway.app`)。**注意不要带末尾的斜杠**。
4. **点击 Deploy**。

### 步骤 D: 验证
1. 打开 Vercel 生成的前端域名。
2. 尝试注册/登录。
3. 写一封测试信件，看看是否能正常工作。

---

## 常见问题 (FAQ)

**Q: Railway 部署失败，提示数据库连接错误？**
A: 确保您在 Railway 上添加了 PostgreSQL 服务，并且后端服务拥有 `DATABASE_URL` 环境变量。我们的代码里有一个智能脚本 (`scripts/check-provider.js`)，它检测到是在生产环境（Railway）运行时，会自动把数据库模式从 SQLite 切换到 PostgreSQL，所以您不需要手动改代码。

**Q: 邮件发不出去？**
A: 
1. 检查 Railway 的日志 (Logs 选项卡)，看看报错信息。
2. 确认 QQ 邮箱的授权码是否过期。
3. 确认 `SMTP_HOST` 和 `SMTP_PORT` 是否匹配。

祝您部署顺利！如果有报错，请把报错信息发给我。
