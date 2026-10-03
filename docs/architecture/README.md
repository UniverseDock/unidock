# UniDock Architecture

本文档目录是 UniDock 的架构审计与长期边界基线。

## 当前架构结论

UniDock 当前是一个**单用户、单浏览器、可信内建模块范围内的 Local First 阅读型 PWA**：

```text
Web App
  → Content / Reader Repository
  → Storage
  → IndexedDB

Service Worker
  → App Shell / 静态资源缓存
```

当前主链路已经可运行；Kernel、SDK、Plugin Runtime、Permission 和 Capability 仍属于未接入产品主链路的架构原型。它们不能被描述为当前已经具备的第三方插件安全平台。

## 文档状态标记

- **已实现**：当前代码和测试中可以确认存在。
- **部分实现**：代码存在，但边界、验证或完整语义尚未闭合。
- **设计中**：已有方向或原型，但不应当被业务依赖。
- **未来规划**：只有在明确需求出现后才进入设计和实现。
- **暂缓**：当前阶段明确不做。
- **存在问题**：会影响正确性、安全性、演进或维护，需要记录和排序。

## 文档索引

- [overview.md](./overview.md)：当前系统全貌和架构原则
- [boundaries.md](./boundaries.md)：包、模块和依赖边界
- [terminology.md](./terminology.md)：核心术语和统一命名
- [data-model.md](./data-model.md)：Content、Document、State、Resource 和 ID/时间模型
- [reader-architecture.md](./reader-architecture.md)：Reader Core、Block 和 Web Renderer
- [storage-and-sync.md](./storage-and-sync.md)：Local First、存储、备份、迁移和同步边界
- [plugin-system.md](./plugin-system.md)：Plugin、Capability、Permission 和安全准入
- [command-event.md](./command-event.md)：Command、Event、Job、Pipeline 和 Agent 的边界
- [iptv-architecture.md](./iptv-architecture.md)：IPTV、Channel 和 Player Capability 的准入边界
- [evolution.md](./evolution.md)：当前问题、下一阶段和长期演进门槛

工程约束见 [`../engineering/`](../engineering/)，决策规则见 [`../agent/decision-framework.md`](../agent/decision-framework.md)。
