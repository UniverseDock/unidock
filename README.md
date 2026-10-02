# UniDock

> Your Dock to the Universe.

UniDock 是一个 PWA 优先、插件化、Local First 的个人内容与信息工作台。当前阶段聚焦统一阅读体验与 RSS 内容来源。

## 项目结构

- `packages/kernel`：插件运行时与通用机制契约。
- `packages/sdk`：面向插件作者的稳定类型与 API。
- `packages/storage`：平台无关的集合存储抽象与 IndexedDB Adapter。
- `packages/content`：通用内容元数据模型与 Repository。
- `packages/reader`：Reader Document、Block 模型与阅读状态。
- `plugins/rss`：RSS 2.0 / Atom 解析、Feed 抓取与本地导入。
- `apps/web`：原生 DOM Web App 与 PWA 外壳。

## 环境

- Node.js >= 22
- pnpm 12.8.1（通过 corepack）

## 常用命令

```bash
corepack pnpm install
corepack pnpm build
corepack pnpm typecheck
```

RSS 插件测试：

```bash
corepack pnpm --filter @unidock/rss test
```

Web App 自动验收（构建、备份测试、PWA 资源检查）：

```bash
corepack pnpm --filter @unidock/web verify
```

## 本地运行 Web App

```bash
corepack pnpm build
python3 -m http.server 4177 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:4177/apps/web/`。

## 已实现

- Storage：IndexedDB CRUD、集合隔离、生命周期与查询边界。
- Content：通用元数据模型与 Repository 校验。
- Reader：Document / Block 模型、渲染、已读、收藏、阅读位置恢复。
- RSS：RSS 2.0 / Atom 解析、Feed 抓取、文章正文可选提取、Content/Document 去重。
- Web App：本地内容增删、Feed 导入/刷新/移除、Feed 订阅持久化。
- 备份：本地数据 JSON 导出与导入恢复，含格式、字段、URL、重复 ID 与领域映射校验。
- PWA：Manifest、图标、Service Worker 离线外壳、离线状态提示与缓存版本更新。

## 已通过人工浏览器验证

- Storage / Content / 生命周期 / 查询边界的 Chromium 用例。
- Web App 本地内容增删与刷新恢复。
- RSS 导入与 Reader 阅读。
- JSON 备份导出与导入恢复。
- PWA 离线冷启动与已保存内容恢复。

## 尚未覆盖

- Service Worker 更新接管流程与存储配额异常的实测。
- 任意 Feed 地址：浏览器受 CORS 和站点策略限制，不保证可用。
- 远端图片与 Feed 网络内容的离线访问。
- 跨设备同步、账号与远端代理。
- IPTV、书籍、漫画等后续内容来源。

本文件是当前事实快照，区分已实现、人工验证与未覆盖事项；详细规划见 `docs/PROJECT_PLAN.md`。
