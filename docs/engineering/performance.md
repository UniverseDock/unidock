# Performance

## 当前判断

当前数据规模是个人阅读 MVP，小规模 IndexedDB 集合和内存过滤是可接受的。状态：**当前实现合适，尚未需要数据库替换**。

## 关注点

- `Storage.list()` 当前会读取集合后内存过滤和分页。
- Document/Content 列表增长后，RSS 导入和列表渲染可能成为瓶颈。
- Service Worker 运行时缓存可能持续增长，需要明确清理策略。

## 规则

先建立可复现 benchmark，再优化：

- 内容数量和 Document 大小。
- Feed 批量导入耗时。
- 首屏启动和离线启动。
- list 查询延迟和内存峰值。
- 备份导出/导入大小。

没有 benchmark 证据前，不引入 SQLite/WASM 或通用查询层。

