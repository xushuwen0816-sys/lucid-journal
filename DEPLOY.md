# 部署指南 (Supabase + Railway)

## 第一步：配置数据库 (Supabase)

1. **注册/登录**: 访问 [https://supabase.com/](https://supabase.com/)
2. **新建项目 (New Project)**:
   - **Name**: 起个名字，例如 `lucid-journal`
   - **Password**: **【重要】** 务必复制并保存好这个密码，后面马上要用。
   - **Region**: 选择离你近的地区（如 Singapore 新加坡，或者 Tokyo 东京）。
3. **获取连接字符串 (Connection String)**:
   - **找不到 Database 选项？** 
     - 现在的 Supabase 界面改版了，请看页面**顶部**，通常有一个绿色的 **"Connect"** 按钮，点击它！
     - 或者：点击左侧边栏的 **圆柱体图标 (Database)**，进去后找 "Connection info" 或 "Settings"。
   - **复制链接**:
     - 在弹出的窗口里，选择 **"URIs"** 标签页。
     - 确保选择的是 `Transaction` 模式（如果可选）或默认模式。
     - 复制那个长得很像网址的字符串: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`
   - **替换密码**:
     - 把字符串里的 `[YOUR-PASSWORD]` 替换为您在第 2 步设置的密码（去掉方括号）。

## 第二步：后端部署 (Railway)

1. **注册/登录**: 访问 [https://railway.app/](https://railway.app/) (建议用 GitHub 账号直接登录)。
2. **新建项目**:
   - 点击 `New Project` -> `Deploy from GitHub repo`。
   - 选择您的仓库: `lucid-journal`。
   - Railway 会自动识别代码。
3. **设置环境变量 (Variables)**:
   - 点击项目中的 `Variables` 选项卡。
   - 点击 `New Variable` 添加以下变量:
     - `DATABASE_URL`: 粘贴第一步里获取的 Supabase 连接串 (记得替换密码)。
     - `JWT_SECRET`: 随便填一串复杂的乱码 (例如 `my-super-secret-key-123`)。
     - `PORT`: `3000`
4. **生成域名**:
   - 点击 `Settings` -> `Networking`。
   - 点击 `Generate Domain`。您会得到一个类似 `https://lucid-journal-production.up.railway.app` 的网址。

## 第三步：前端更新

1. **修改 API 地址**:
   - 既然我们要在本地运行前端，或者把前端部署到 Vercel，我们需要告诉前端去哪里找后端。
   - 打开本地代码 `components/AuthModal.tsx` 和 `App.tsx`，找到 API 请求的地方。
   - 临时方案：您可以直接把代码里的 `/api` 替换为您在 Railway 生成的完整域名 (例如 `https://lucid-journal-production.up.railway.app/api`)。
   - **或者** (更规范的做法)：
     - 如果您部署前端到 Vercel，在 Vercel 后台设置环境变量 `VITE_API_URL`。

## 第四步：同步数据库结构

Railway 部署成功后，还需要把我们在代码里写的数据库表结构同步到 Supabase。

1. **本地同步 (推荐)**:
   - 在 VS Code 终端里，先备份一下本地的 `.env` 文件。
   - 修改 `.env` 文件，把 `DATABASE_URL` 换成 **Supabase 的连接串**。
   - 运行命令: `cd server && npx prisma migrate deploy`
   - 这会把表结构推送到云端数据库。
   - *完成后，记得把本地 `.env` 改回原来的 SQLite 设置（如果您还想在本地开发的话）。*

## 常见问题

- **500 Error**: 去 Railway 查看 `Deployments` -> `View Logs` 看具体报错。
- **连不上数据库**: 90% 的情况是密码填错了，或者是连接串里的特殊字符没有进行 URL 编码。
