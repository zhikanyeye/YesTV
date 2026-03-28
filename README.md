# YesTV

![YesTV](public/icon.png)

> 一个基于 Next.js 16 构建的现代化视频聚合播放平台。采用独特的 "Liquid Glass" 设计语言，提供流畅的视觉体验和强大的视频搜索功能。

仓库地址：<https://github.com/zhikanyeye/YesTV>

## 🚀 部署指南

本项目支持多种部署方式。你可以根据需要选择“新建独立项目”或“连接现有仓库持续部署”。

### 方法一：连接现有仓库部署（推荐）

这种方式会将你当前的 GitHub 仓库连接到部署平台。**当你推送代码到 GitHub 时，平台会自动触发构建和部署（CI/CD）。** 不会创建新的冗余仓库。

**操作步骤：**
1. 登录目标平台（如 Vercel, Netlify, Render 等）的控制台。
2. 点击 **"Add New"** 或 **"New Project"**。
3. 选择 **"Import an existing repository"**（导入现有仓库）。
4. 在列表中选择你的 `zhikanyeye/YesTV` 仓库。
5. 平台会自动读取仓库内的配置文件（如下表），点击 Deploy 即可。

| 平台 | 自动识别来源 | 说明 |
|------|-------------|------|
| Vercel | `package.json` | 自动识别 Next.js 与 `npm run build` |
| Netlify | `netlify.toml` | 自动使用 `npm run build` 与 Next Runtime |
| Render | `render.yaml` | 自动创建 Web Service 并填充 build/start 命令 |
| Railway | `nixpacks.toml` + `railway.json` | 自动按 Nixpacks 执行 install/build/start |
| Cloudflare Pages | `package.json` | 需在控制台选择框架为 Next.js |

### 方法二：一键模板部署（适合新建独立项目）

点击下方按钮，平台会自动在你的 GitHub 账号下**克隆（Clone）一个全新的 YesTV 仓库**，并进行部署。适合想要分发给其他人一键搭建自己独立站点的场景。

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Deploy with Vercel" /></a>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Deploy with Netlify" /></a>
  <a href="https://render.com/deploy?repo=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Deploy with Render" /></a>
  <br />
  <a href="https://railway.app/new/template?template=https://github.com/zhikanyeye/YesTV"><img src="https://img.shields.io/badge/Deploy-Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Deploy with Railway" /></a>
  <a href="https://dash.cloudflare.com/?to=/:account/pages/new/provider/github"><img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy with Cloudflare Pages" /></a>
</p>

## 📖 项目简介

本项目是一个高性能、现代化的视频聚合与播放应用，专注于提供极致的用户体验和视觉设计。结合 Next.js、React 与 Tailwind CSS，打造了一个既美观又强大的视频浏览平台。

### 核心设计理念：Liquid Glass（液态玻璃）

项目的视觉设计基于 **"Liquid Glass"** 设计系统，这是一套融合了以下特性的现代化 UI 设计语言：

- **玻璃拟态效果**：通过 `backdrop-filter` 实现的磨砂半透明效果，让 UI 元素如同真实的玻璃材质
- **通用柔和度**：统一使用 `rounded-2xl` 和 `rounded-full` 两种圆角半径，创造和谐的视觉体验
- **光影交互**：悬停和聚焦状态下的内发光效果，模拟光线被"捕获"的物理现象
- **流畅动画**：基于物理的 `cubic-bezier` 曲线，实现自然的加速和减速过渡
- **深度层级**：清晰的 z-axis 层次结构，增强空间感和交互反馈

## ✨ 核心功能

### 🎥 智能视频播放

- **HLS 流媒体支持**：原生支持 HLS (.m3u8) 格式，提供流畅的视频播放体验
- **智能缓存机制**：Service Worker 驱动的智能缓存系统，自动预加载和缓存视频片段
- **后台下载**：利用观看历史，在后台自动下载历史视频，确保离线也能观看
- **播放控制**：完整的播放控制功能，包括进度条、音量控制、播放速度调节、全屏模式等
- **移动端优化**：专门为移动设备优化的播放器界面和手势控制

### 🔍 多源并行搜索

- **聚合搜索引擎**：同时在多个视频源中并行搜索，大幅提升搜索速度
- **自定义视频源**：支持添加、编辑和管理自定义视频源
- **智能解析**：统一的解析器系统，自动处理不同源的数据格式
- **搜索历史**：自动保存搜索历史，支持快速重新搜索
- **结果排序**：支持按评分、时间、相关性等多种方式排序搜索结果

### 🎬 豆瓣集成

- **电影 & 电视剧分类**：支持在电影和电视剧之间无缝切换，方便查找不同类型的影视资源
- **详细影视信息**：自动获取豆瓣评分、演员阵容、剧情简介等详细信息
- **推荐系统**：基于豆瓣数据的相关推荐
- **专业评价**：展示豆瓣用户评价和专业影评

### 💾 观看历史管理

- **自动记录**：自动记录观看进度和历史
- **断点续播**：从上次观看位置继续播放
- **历史管理**：支持删除单条历史或清空全部历史
- **隐私保护**：所有数据存储在本地，不上传到服务器

### 📱 响应式设计

- **全端适配**：完美支持桌面、平板和移动设备
- **移动优先**：专门的移动端组件和交互设计
- **触摸优化**：针对触摸屏优化的手势和交互

### 🌙 主题系统

- **深色/浅色模式**：支持系统级主题切换
- **动态主题**：基于 CSS Variables 的动态主题系统
- **无缝过渡**：主题切换时的平滑过渡动画

### ⌨️ 无障碍设计

- **键盘导航**：完整的键盘快捷键支持
- **ARIA 标签**：符合 WCAG 2.2 标准的无障碍实现
- **语义化 HTML**：使用语义化标签提升可访问性
- **高对比度**：确保 4.5:1 的文字对比度

### 💎 高级模式

- **独立入口**：在浏览器地址栏直接输入 `/premium` 即可进入独立的高级视频专区
- **内容隔离**：高级内容与普通内容完全物理隔离，互不干扰
- **专属设置**：拥有独立的内容源管理和功能设置

## 🔐 隐私保护

本应用注重用户隐私：

- **本地存储**：所有数据存储在本地浏览器中
- **无服务器数据**：不收集或上传任何用户数据
- **自定义源**：用户可自行配置视频源

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
