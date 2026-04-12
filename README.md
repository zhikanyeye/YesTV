# YesTV

![YesTV](public/icon.png)

> 一个基于 Next.js 16 构建的现代化视频聚合播放平台。采用独特的 "Liquid Glass" 设计语言，提供流畅的视觉体验和强大的视频搜索功能。

仓库地址：<https://github.com/zhikanyeye/YesTV>

## 🚀 部署指南

### 环境变量配置

在部署之前，你需要在你的托管平台（如 Vercel）上配置以下环境变量。这是让应用能够连接到数据库和认证服务的关键。

| 变量名 | 说明 |
| :--- | :--- |
| `GITHUB_CLIENT_ID` | 你的 GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | 你的 GitHub OAuth App 的 Client Secret |
| `QQ_APP_ID` | 你在 QQ 互联上申请的 App ID |
| `QQ_APP_KEY` | 你在 QQ 互联上申请的 App Key |
| `AUTH_SECRET` | 用于 NextAuth 加密会话的密钥，可以通过 `openssl rand -hex 32` 生成 |
| `UPSTASH_REDIS_REST_URL` | 你在 Upstash 上创建的 Redis 数据库的 URL |
| `UPSTASH_REDIS_REST_TOKEN` | 你在 Upstash 上创建的 Redis 数据库的 Token |

### Vercel 一键部署

确保你已经 Fork 了本仓库，并且在 Vercel 上配置了上述所有环境变量后，点击下方按钮即可一键部署：

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Deploy with Vercel" /></a>
</p>

## ✨ 核心功能

- **双认证登录系统**: 支持 **GitHub** 和 **QQ** 两种主流登录方式，由 `next-auth` 提供安全的会话管理。
- **混合数据存储**: 
  - **登录用户**: 收藏夹和播放历史会自动同步到 Upstash 云端数据库，实现跨设备无缝漫游。
  - **游客用户**: 数据会优雅地回退到使用浏览器 `localStorage` 进行本地存储，不产生任何干扰。
- **HLS 流媒体支持**：原生支持 HLS (.m3u8) 格式，提供流畅的视频播放体验。
- **多源并行搜索**：同时在多个视频源中并行搜索，大幅提升搜索速度。
- **响应式设计**：完美支持桌面、平板和移动设备。
- **主题系统**：支持系统级深色/浅色模式切换。

## 🔐 隐私保护

本应用注重用户隐私：

- **游客模式**: 对于未登录的用户，所有数据（如播放历史、收藏夹）都只存储在用户本地的浏览器中，我们不收集或上传任何信息。
- **登录模式**: 对于选择登录的用户，我们会通过 `next-auth` 获取一个与您的 GitHub/QQ 账户关联的、匿名的唯一ID。您的收藏夹和播放历史将被安全地存储在与此ID关联的云端数据库中，以便在您的不同设备间同步。我们绝不会获取您的任何个人敏感信息。
- **开源透明**: 本项目完全开源，您可以随时审查代码以确认我们的隐私承诺。

## 🔒 密码访问控制

本项目支持两种密码保护方式：

### 方式一：本地保存密码

在设置页面中启用密码访问，并添加密码：

- **设备独立**：仅在当前浏览器/设备有效
- **可管理**：可随时添加或删除
- **多密码支持**：可设置多个有效密码

### 方式二：环境变量密码（推荐用于部署）

通过 `ACCESS_PASSWORD` 环境变量设置全局密码：

**Docker 部署：**

```bash
docker run -d -p 3000:3000 -e ACCESS_PASSWORD=your_premium_password --name yestv yestv
```

**Vercel 部署：**

在 Vercel 项目设置中添加环境变量：

- 变量名：`ACCESS_PASSWORD`
- 变量值：你的密码

**特点：**

- **全局生效**：所有用户都需要此密码才能访问
- **无法在界面删除**：只能通过修改环境变量更改
- **与本地密码兼容**：两种密码都可以解锁应用

## 🔐 高级视频源解锁

应用包含 **9 个默认视频源** 和 **16 个高级视频源**（需要解锁），共计 **25 个视频源**。

### 什么是高级视频源？

高级视频源是额外的 16 个视频 API 资源，默认隐藏，需要通过解锁秘钥才能启用。解锁后，你可以访问更多的视频内容和资源。

### 如何解锁？

1. **进入设置页面**：访问应用的设置页面
2. **找到"解锁高级视频源"模块**
3. **输入解锁秘钥**：输入正确的秘钥并点击"解锁"按钮
4. **查看高级源**：解锁成功后，16 个高级源将自动添加到视频源列表中

### 配置解锁秘钥（可选）

默认解锁秘钥为 `1234`。如果你想自定义秘钥，可以通过环境变量 `VIDEO_SOURCE_KEY` 进行配置。

**Docker 部署示例：**

```bash
docker run -d -p 3000:3000 -e VIDEO_SOURCE_KEY="your_secret_key" --name yestv yestv
```

**Vercel 部署：**

在 Vercel 项目设置中添加环境变量：

- 变量名：`VIDEO_SOURCE_KEY`
- 变量值：`your_secret_key`

**Cloudflare Pages 部署：**

在 Cloudflare Pages 项目设置中添加环境变量：

- 变量名：`VIDEO_SOURCE_KEY`
- 变量值：`your_secret_key`

### 特点

- ✅ **持久化保存**：解锁状态保存在浏览器本地存储中，无需重复解锁
- ✅ **即时生效**：解锁成功后立即显示所有 25 个视频源
- ✅ **可自定义秘钥**：通过环境变量自定义解锁秘钥
- ✅ **安全简单**：适合静态部署场景的前端验证方案

## 🎨 站点名称自定义配置

通过环境变量可以自定义站点名称、标题和描述，无需修改源代码。

### 可用环境变量：

| 变量名                            | 说明       | 默认值                                |
| ------------------------------ | -------- | ---------------------------------- |
| `NEXT_PUBLIC_SITE_TITLE`       | 浏览器标签页标题 | `YesTV - 视频聚合平台`                   |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述     | `专属视频聚合播放平台，具备美观的 Liquid Glass UI` |
| `NEXT_PUBLIC_SITE_NAME`        | 站点头部名称   | `YesTV`                            |

### 配置示例：

**Vercel 部署：**
在 Vercel 项目设置中添加环境变量：

- 变量名：`NEXT_PUBLIC_SITE_NAME`
- 变量值：`我的视频平台`

**Cloudflare Pages 部署：**
在 Cloudflare Pages 项目设置中添加环境变量：

- 变量名：`NEXT_PUBLIC_SITE_NAME`
- 变量值：`我的视频平台`

**Docker 部署：**

```bash
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_NAME="我的视频平台" \
  -e NEXT_PUBLIC_SITE_TITLE="我的视频 - 聚合播放平台" \
  -e NEXT_PUBLIC_SITE_DESCRIPTION="专属视频聚合播放平台" \
  --name yestv yestv
```

**本地开发：**
在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SITE_NAME=我的视频平台
NEXT_PUBLIC_SITE_TITLE=我的视频 - 聚合播放平台
NEXT_PUBLIC_SITE_DESCRIPTION=专属视频聚合播放平台
```

## 📦 自动订阅源配置

可以通过环境变量 `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` 自动配置订阅源，应用启动时会自动加载并设置为自动更新。

**格式：** JSON 数组字符串，包含 `name` 和 `url` 字段。

**示例：**

```bash
NEXT_PUBLIC_SUBSCRIPTION_SOURCES='[{"name":"每日更新源","url":"https://example.com/api.json"},{"name":"备用源","url":"https://backup.com/api.json"}]'
```

**Docker 部署：**

```bash
docker run -d -p 3000:3000 -e NEXT_PUBLIC_SUBSCRIPTION_SOURCES='[{"name":"MySource","url":"..."}]' --name yestv yestv
```

**Vercel 部署：**

在 Vercel 项目设置中添加环境变量：

- 变量名：`NEXT_PUBLIC_SUBSCRIPTION_SOURCES`
- 变量值：`[{"name":"...","url":"..."}]`

**Cloudflare Pages 部署：**

在 Cloudflare Pages 项目设置中添加环境变量：

- 变量名：`NEXT_PUBLIC_SUBSCRIPTION_SOURCES`
- 变量值：`[{"name":"...","url":"..."}]`

## 📝 自定义源 JSON 格式

如果你想创建自己的订阅源或批量导入源，可以使用以下 JSON 格式。

**基本结构：**

可以是单个对象数组，也可以是包含 `sources` 或 `list` 字段的对象。

**源对象字段说明：**

| 字段         | 类型      | 必填 | 说明                                                     |
| ---------- | ------- | -- | ------------------------------------------------------ |
| `id`       | string  | 是  | 唯一标识符，建议使用英文                                           |
| `name`     | string  | 是  | 显示名称                                                   |
| `baseUrl`  | string  | 是  | API 地址 (例如: `https://example.com/api.php/provide/vod`) |
| `group`    | string  | 否  | 分组，可选值: `"normal"` (默认) 或 `"premium"`                  |
| `enabled`  | boolean | 否  | 是否启用，默认为 `true`                                        |
| `priority` | number  | 否  | 优先级，数字越小优先级越高，默认为 1                                    |

**示例 JSON：**

```json
[
  {
    "id": "my_source_1",
    "name": "我的精选源",
    "baseUrl": "https://api.example.com/vod",
    "group": "normal",
    "priority": 1
  },
  {
    "id": "premium_source_1",
    "name": "特殊资源",
    "baseUrl": "https://api.premium-source.com/vod",
    "group": "premium",
    "enabled": true
  }
]
```

### ⚠️ 重要的区别说明：订阅源 vs 视频源

**这是一个常见的误区，请仔细阅读：**

- **视频源 (Source)**：
  - 指向单个 CMS/App API 接口
  - 例如：`https://api.example.com/vod`
  - 这种链接**不能**直接作为"订阅"添加
  - 只能在"自定义源管理"中作为单个源添加
- **订阅源 (Subscription)**：
  - 指向一个 **JSON 文件**（如上面的示例）的 URL
  - 这个 JSON 文件里包含了一个或多个视频源的列表
  - 例如：`https://mysite.com/yestv-sources.json`
  - 这是一个**配置文件**的链接，不是视频 API 的链接
  - 只有这种返回 JSON 列表的链接才能在"订阅管理"中添加

> **简单来说**：如果你只有一个 m3u8 或 API 接口地址，请去"自定义源"添加。如果你有一个包含多个源的 JSON 文件链接，请去"订阅管理"添加。

## 🛠 技术栈

### 前端核心

| 技术                                                | 版本     | 用途                     |
| ------------------------------------------------- | ------ | ---------------------- |
| **[Next.js](https://nextjs.org/)**                | 16.0.3 | React 框架，使用 App Router |
| **[React](https://react.dev/)**                   | 19.2.0 | UI 组件库                 |
| **[TypeScript](https://www.typescriptlang.org/)** | 5.x    | 类型安全的 JavaScript       |
| **[Tailwind CSS](https://tailwindcss.com/)**      | 4.x    | 实用优先的 CSS 框架           |
| **[Zustand](https://github.com/pmndrs/zustand)**  | 5.0.2  | 轻量级状态管理                |

### 开发工具

- **ESLint 9**：代码质量检查
- **PostCSS 8**：CSS 处理器
- **Vercel Analytics**：性能监控和分析

### 架构特点

- **App Router**：Next.js 13+ 的新路由系统，支持服务端组件和流式渲染
- **API Routes**：内置 API 端点，处理豆瓣数据和视频源代理
- **Service Worker**：离线缓存和智能预加载
- **Server Components**：优化首屏加载性能
- **Client Components**：复杂交互和状态管理

## 🚀 本地运行

```bash
npm install
npm run dev
```

默认访问 `http://localhost:3000`。

## 📦 构建与部署

```bash
npm run build
npm start
```

## 🤝 贡献代码

我们非常欢迎各种形式的贡献！无论是报告 Bug、提出新功能建议、改进文档，还是提交代码，你的每一份贡献都让这个项目变得更好。

**想要参与开发？请查看 [贡献指南](CONTRIBUTING.md) 了解详细的开发规范和流程。**

快速开始：

1. **报告 Bug**：在 Issues 中提交问题
2. **功能建议**：在 Issues 中提出你的想法
3. **代码贡献**：Fork → Branch → PR
4. **文档改进**：直接提交 PR

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 框架
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- [React](https://react.dev/) - UI 库

***

<div align="center">
  如果这个项目对你有帮助，请考虑给一个 ⭐️
</div>
