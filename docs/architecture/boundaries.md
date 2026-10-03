# Module Boundaries

## 1. 依赖方向

允许的方向：

```text
Storage contracts
  ← Content repositories
  ← Reader repositories
  ← RSS services
  ← Web App composition
```

禁止的方向：

- Storage 依赖 Content、Reader、RSS 或 UI。
- Content 依赖 DOM、IndexedDB、React 或具体来源。
- Reader Core 依赖 DOM、Web API 或 RSS。
- RSS 直接访问 IndexedDB；必须通过 Repository 或明确的宿主接口。
- Plugin 直接导入另一个 Plugin 的实现。
- Web Renderer 反向进入 Reader Core。

## 2. 包职责

### `packages/kernel`

- **状态：设计中 / 部分实现**
- 负责未来的 Plugin 生命周期、Capability、Permission、Event 和 Context。
- 当前不能作为安全边界；现有 Context Factory 会把宿主 API 原样交给插件。
- 当前 Web App 不应为了形式统一而强行接入 Kernel。

### `packages/sdk`

- **状态：部分实现**
- 负责面向插件作者的稳定类型出口。
- 当前主要是类型重导出，尚未形成可运行的插件开发和版本兼容协议。

### `packages/storage`

- **状态：已实现基础能力，部分实现演进能力**
- 负责平台无关 Storage 契约和 IndexedDB Adapter。
- 不负责业务事务编排、Content 校验或 UI 错误展示。
- 需要后续明确查询排序、事务、迁移和连接生命周期语义。

### `packages/content`

- **状态：已实现**
- 负责跨来源共享的内容元数据和 Content Repository。
- 不负责正文、阅读状态、原始 Feed XML 或远程资源。

### `packages/reader`

- **状态：已实现基础 Reader Core，部分实现长期模型**
- 负责 Document、Block、ReadingState 和对应 Repository。
- 不负责 DOM、布局计算、页面分页或浏览器滚动事件。

### `plugins/rss`

- **状态：已实现可信内建模块**
- 负责 Feed 解析、抓取、去重和 Content/Document 导入。
- 当前不是安全隔离的第三方 Plugin。

### `apps/web`

- **状态：已实现 MVP，但编排职责偏重**
- 负责浏览器启动、依赖装配、DOM Renderer、PWA、备份 UI 和用户交互。
- 后续应逐步把跨集合业务操作从 `main.ts` 提取到应用服务，但不应为此提前建立通用 CQRS 或工作流框架。

## 3. Reader-Web

当前没有独立的 `reader-web` 包，DOM 渲染位于 `apps/web`。这是当前阶段合理的简化：

- 只有一个 Web Renderer 时，不需要额外 Adapter。
- 只有当第二个 Web App、桌面渲染器或测试复用出现时，才考虑抽出独立 Renderer 包。

## 4. 循环依赖

当前未发现包级循环依赖。未来新增依赖时必须保持 DAG；如果两个领域需要互相引用，应提取最小稳定契约，而不是互相导入实现。

