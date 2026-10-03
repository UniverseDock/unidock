# Architecture Overview

## 1. 当前事实

当前仓库已经实现以下阅读闭环：

```text
RSS / 本地内容
  → Content
  → ContentRepository
  → IndexedDB
  → ReaderDocument
  → Web Renderer
  → ReadingState
```

当前真实依赖方向为：

```text
storage
  ↑
content
  ↑
reader
  ↑
rss
  ↑
apps/web
```

`kernel` 和 `sdk` 当前没有接入 Web App 的运行时装配。`plugins/rss` 当前是可信的内建领域模块，而不是由 Kernel 托管的安全第三方插件。

## 2. 稳定原则

### Stable Contract

长期稳定的部分应优先是领域契约，而不是某个浏览器实现：

- `Content`、`ReaderDocument`、`ReaderBlock`、`ReadingState`
- `ContentRepository`、`DocumentRepository`、`ReadingStateRepository`
- `Storage` 的最小读写语义
- 备份格式的版本和验证规则

### Replaceable Implementation

以下实现必须保持可替换：

- IndexedDB Adapter
- Web DOM Renderer
- RSS 网络 Fetcher
- Service Worker 缓存策略
- 未来的远端 Storage 或同步 Adapter

替换实现不得改变领域模型和用户可见语义，除非先修改稳定契约并提供迁移。

### Local First

基础阅读、查看已保存内容和恢复阅读状态不得依赖远端服务。远端能力可以增强抓取、代理、同步或账号，但不能成为本地阅读的必要条件。

### Capability-based Composition

未来插件之间通过宿主授予的 Capability 协作，而不是直接导入彼此实现。该原则当前是设计约束，不表示现有 RSS 已经通过 Kernel 接入。

## 3. 当前不承担的职责

- Service Worker 不保存业务数据，不负责同步和备份。
- Content 不保存正文、阅读状态或网络抓取过程状态。
- Reader Core 不操作 DOM、Window 或浏览器存储。
- Storage 不理解 RSS、文章业务和 UI。
- Kernel 不应直接实现具体内容源。
- Agent、Pipeline 和 Event 不应替代明确的领域服务或事务。

## 4. 架构判断

- **已实现**：Local First 阅读 MVP 的主链路。
- **部分实现**：PWA 更新、跨集合数据一致性、备份恢复原子性、存储查询语义。
- **设计中**：Plugin Runtime、Capability、Permission。
- **未来规划**：Sync、Remote Storage、Job/Pipeline、Agent。
- **暂缓**：Marketplace、远程插件、CRDT、SQLite/WASM、云端数据库。

