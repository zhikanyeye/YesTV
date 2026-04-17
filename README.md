# YesTV

![YesTV](public/icon.png)

> 一个基于 Next.js 16 构建的现代化视频聚合播放平台。采用独特的 "Liquid Glass" 设计语言，提供流畅的视觉体验和强大的视频搜索功能。

仓库地址：<https://github.com/zhikanyeye/YesTV>

## 🚀 部署指南

想要快速上线？先记住一句话：

> 新手首选 Vercel，追求边缘网络建议 Cloudflare Workers（OpenNext），自托管就用 Docker。

### 🌈 平台选择一览

本项目是完整 Next.js 应用（含 API Routes、NextAuth、Redis 同步），需要支持服务端运行时。

| 平台 | 推荐度 | 适合人群 | 说明 |
| :--- | :--- | :--- | :--- |
| Vercel | ⭐⭐⭐⭐⭐ | 想最快上线 | 官方适配最好，配置最省心 |
| Cloudflare Workers（OpenNext） | ⭐⭐⭐⭐ | 追求全球边缘网络 | 使用 `@opennextjs/cloudflare` 官方适配 |
| Netlify | ⭐⭐⭐ | 已在用 Netlify 的团队 | 已内置 Next.js 插件配置 |
| Railway / Render | ⭐⭐⭐ | 偏后端部署思路 | 按 Node 服务模式运行 |
| Docker / VPS | ⭐⭐⭐⭐ | 要自托管/私有化 | 灵活度最高，可完全掌控 |
| 纯静态托管（GitHub Pages 等） | ❌ | 仅静态站 | 本项目不适用 |

### ⚡ 快速入口

Vercel 一键部署：

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Deploy with Vercel" /></a>
</p>

Cloudflare 补充说明：项目已迁移到 OpenNext 方案，推荐使用 Workers 工作流。

### 🧩 环境变量速查

#### 必填（登录 + 云端同步）

| 变量名 | 说明 |
| :--- | :--- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App 的 Client Secret |
| `QQ_APP_ID` | QQ 互联 App ID |
| `QQ_APP_KEY` | QQ 互联 App Key |
| `AUTH_SECRET` | NextAuth 会话加密密钥，建议用 `openssl rand -hex 32` 生成 |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token |

#### 选填（增强功能）

| 变量名 | 说明 |
| :--- | :--- |
| `ADMIN_USER_IDS` | 管理员用户 ID 列表，多个值使用英文逗号分隔 |
| `ACCESS_PASSWORD` | 全局访问密码 |
| `VIDEO_SOURCE_KEY` | 高级视频源解锁密钥 |
| `NEXT_PUBLIC_SITE_NAME` | 站点名称 |
| `NEXT_PUBLIC_SITE_TITLE` | 浏览器标题 |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述 |
| `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` | 预置订阅源 JSON |

### ✅ 上线前检查清单

1. Fork 或克隆仓库，并确认默认分支。
2. 在目标平台创建项目并连接 Git 仓库。
3. 配置环境变量（优先填写必填项）。
4. 确认 Node.js 版本不低于 20（推荐 22）。
5. 首次部署成功后，用目标管理员账号登录一次并记录用户 ID。
6. 将该用户 ID 写入 `ADMIN_USER_IDS` 后重新部署。

### 🛠 分平台部署步骤

#### 1) Vercel（推荐新手）

1. 使用上方按钮或在 Vercel 控制台导入仓库。
2. 在 Project Settings -> Environment Variables 填写环境变量。
3. Build Command 保持默认：`next build`。
4. 首次部署后登录站点，获取管理员用户 ID。
5. 补充 `ADMIN_USER_IDS` 并执行一次重新部署。

#### 2) Cloudflare Workers（OpenNext，推荐进阶）

1. 首次安装依赖：`npm install`。
2. 本地预览：`npm run cf:preview`。
3. 首次部署：`npm run cf:deploy`。
4. 需要仅上传版本时：`npm run cf:upload`。
5. 可选生成类型：`npm run cf:typegen`。

关键文件：

- `wrangler.jsonc`：Worker 入口与资源绑定配置。
- `open-next.config.ts`：OpenNext Cloudflare 适配配置。
- `.dev.vars`：本地开发环境变量。

说明：OpenNext 不建议继续使用 `runtime = "edge"`，项目已统一迁移为 Node.js runtime。

#### 3) Netlify

1. 使用 New site from Git 连接仓库。
2. Build command: `npm run build`。
3. 配置环境变量。
4. 执行首次部署并完成管理员初始化。

#### 4) Railway / Render

1. 连接 GitHub 仓库。
2. Build command: `npm install && npm run build`。
3. Start command: `npm start`。
4. 配置所有环境变量后部署。

#### 5) Docker / 自托管（推荐服务器党）

1. 构建镜像：

  `docker build -t yestv .`

2. 启动容器（示例）：

  `docker run -d --name yestv -p 3000:3000 -e AUTH_SECRET=your_secret -e GITHUB_CLIENT_ID=xxx -e GITHUB_CLIENT_SECRET=xxx -e QQ_APP_ID=xxx -e QQ_APP_KEY=xxx -e UPSTASH_REDIS_REST_URL=xxx -e UPSTASH_REDIS_REST_TOKEN=xxx -e ADMIN_USER_IDS=your_user_id yestv`

3. 访问 `http://localhost:3000`。

### ⚠️ 纯静态托管限制

本项目包含 NextAuth 与多条 API Route（收藏、历史、管理员、代理、搜索流等），因此不是纯静态站点。

- 可运行平台：Vercel、Cloudflare Workers（OpenNext）、Netlify、Railway、Render、Docker。
- 不建议直接部署到纯静态 CDN（如 GitHub Pages 或无函数能力的对象存储站点）。

若必须使用纯静态托管，仅可构建精简版本：移除登录、云同步、管理员功能及全部服务端 API。

## ✨ 核心功能

### 你会喜欢的体验

- 双认证登录：支持 GitHub 与 QQ 登录，基于 `next-auth` 管理会话。
- 多源并行搜索：同一关键词同时查询多个源，结果更快到达。
- HLS 原生播放：直接支持 `.m3u8` 流媒体。
- 混合存储策略：
  - 登录用户：收藏和历史自动同步至 Upstash Redis。
  - 游客用户：数据保存在浏览器本地，不依赖服务端账号。
- 响应式布局：桌面、平板、手机都可用。
- 主题能力：支持浅色/深色模式切换。

## 🔐 隐私与数据说明

我们坚持最小化数据原则：

- 游客模式：数据仅保存在本地浏览器。
- 登录模式：仅使用账号对应的匿名标识符进行数据关联。
- 不采集敏感信息：不会主动收集与播放无关的个人隐私数据。
- 开源可审计：核心逻辑公开，欢迎代码审阅。

## 🔒 访问密码保护

项目支持两种密码策略，可单独使用，也可并行生效。

### 方案 A：本地密码（设备级）

- 仅作用于当前浏览器/设备。
- 可在设置页新增、删除。
- 支持多个有效密码。

### 方案 B：环境变量密码（全局）

通过 `ACCESS_PASSWORD` 配置站点全局访问密码。

Docker 示例：

```bash
docker run -d -p 3000:3000 -e ACCESS_PASSWORD=your_premium_password --name yestv yestv
```

特点：

- 全局生效：所有访问者都需输入密码。
- 不可在前端删除：需在部署平台修改环境变量。
- 与本地密码兼容：任一有效密码均可解锁。

## 🔓 高级视频源解锁

默认包含 9 个基础源，可解锁 16 个高级源，总计 25 个源。

### 快速解锁流程

1. 打开设置页。
2. 找到解锁高级视频源模块。
3. 输入解锁秘钥并提交。
4. 解锁后自动加载高级源。

### 自定义解锁秘钥

默认秘钥：`1234`。

若需自定义，请设置环境变量 `VIDEO_SOURCE_KEY`。

```bash
docker run -d -p 3000:3000 -e VIDEO_SOURCE_KEY="your_secret_key" --name yestv yestv
```

### 行为特性

- 持久化：解锁状态写入本地存储。
- 即时生效：无需重启应用。
- 可自定义：支持环境变量覆盖默认秘钥。

## 🎨 站点品牌配置

可通过环境变量快速改名，无需改源码。

| 变量名 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_TITLE` | 浏览器标题 | `YesTV - 视频聚合平台` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述 | `专属视频聚合播放平台，具备美观的 Liquid Glass UI` |
| `NEXT_PUBLIC_SITE_NAME` | 导航栏站点名 | `YesTV` |

本地开发示例（`.env.local`）：

```env
NEXT_PUBLIC_SITE_NAME=我的视频平台
NEXT_PUBLIC_SITE_TITLE=我的视频 - 聚合播放平台
NEXT_PUBLIC_SITE_DESCRIPTION=专属视频聚合播放平台
```

## 📦 订阅源自动配置

可使用 `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` 在启动时自动导入订阅源。

格式：JSON 数组字符串，字段包含 `name` 与 `url`。

```bash
NEXT_PUBLIC_SUBSCRIPTION_SOURCES='[{"name":"每日更新源","url":"https://example.com/api.json"},{"name":"备用源","url":"https://backup.com/api.json"}]'
```

## 📝 自定义源 JSON 规范

可用于批量导入或托管订阅文件。

支持结构：

- 直接数组。
- 或对象包裹，字段为 `sources` / `list`。

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | string | 是 | 唯一标识，建议英文 |
| `name` | string | 是 | 源名称 |
| `baseUrl` | string | 是 | API 地址 |
| `group` | string | 否 | `normal` 或 `premium` |
| `enabled` | boolean | 否 | 默认 `true` |
| `priority` | number | 否 | 数值越小优先级越高 |

示例：

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

### 订阅源 vs 视频源（高频误区）

- 视频源：单个 API 地址，只能在自定义源里手动添加。
- 订阅源：返回 JSON 列表的 URL，用于批量导入。

一句话判断：

- 只有一个接口地址 -> 用自定义源。
- 一个返回源列表的 JSON 地址 -> 用订阅源。

## 🛠 技术栈

### 核心依赖

| 技术 | 版本 | 用途 |
| :--- | :--- | :--- |
| **[Next.js](https://nextjs.org/)** | 16.1.2 | React 框架（App Router） |
| **[React](https://react.dev/)** | 19.2.3 | UI 组件体系 |
| **[TypeScript](https://www.typescriptlang.org/)** | 5.x | 类型系统 |
| **[Tailwind CSS](https://tailwindcss.com/)** | 4.x | 样式体系 |
| **[Zustand](https://github.com/pmndrs/zustand)** | 5.0.10 | 状态管理 |
| **[NextAuth.js](https://next-auth.js.org/)** | 4.24.x | 认证与会话 |
| **[@upstash/redis](https://upstash.com/)** | 1.35.x | 云端数据存储 |

### 工程能力

- ESLint 9：代码质量检查
- PostCSS 8：样式处理
- Vercel Analytics：运行数据分析
- Service Worker：缓存与离线体验增强

## 🚀 本地开发

```bash
npm install
npm run dev
```

默认访问：`http://localhost:3000`

## 📦 生产构建

```bash
npm run build
npm start
```

## 🤝 贡献指南

欢迎提交 Issue 与 PR。

参与建议：

1. 先阅读 [贡献指南](CONTRIBUTING.md)。
2. 提交问题前先搜索是否已有相同 Issue。
3. 代码改动建议附带复现步骤与测试说明。
4. 文档优化同样非常欢迎。

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

感谢以下项目提供的优秀基础能力：

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand)

***

<div align="center">
  如果这个项目对你有帮助，欢迎点一个 ⭐️
</div>
