# Storage, Local First and Sync

## 1. 当前存储分工

```text
IndexedDB / Storage
  → Content、Document、ReadingState、Feed subscription

Cache Storage / Service Worker
  → App Shell 和同源静态资源

备份 JSON
  → 用户主动导出和恢复
```

Service Worker 不承担业务数据持久化、备份或同步职责。

状态：**IndexedDB 基础能力已实现；配额处理部分实现；应用级补偿恢复已实现；Backup v1 的解码边界和拒绝未知版本已实现；原子跨集合事务及其他数据迁移未完成。**

## 2. Storage Contract

当前 `StorageCollection` 提供 `get/put/delete/list/clear`，适合 MVP，但长期稳定语义仍需明确：

- `list` 当前按过滤后的记录 `id` 升序返回；产品时间线排序需要单独的领域字段和查询语义。
- `offset/limit` 的边界。
- where 数组匹配和缺失字段行为。
- 事务和并发写入语义。
- close/destroy 后调用行为。

当前 IndexedDB 实现会把集合读取到内存后过滤和分页，适合小规模本地数据；数据量增大前应先用 benchmark 证明瓶颈，再决定索引或替换实现。

## 3. 业务一致性

Content、Document、ReadingState 分属多个 collection。每次底层 CRUD 是单个 IndexedDB transaction；应用层已为内容生命周期和备份导入增加补偿式恢复，但这仍不是原子跨 collection transaction。

短期文档语义必须写清：

> 备份导入会先完整校验，并在顺序写入失败时尝试恢复导入前快照；当前不承诺跨 collection 原子性。如果补偿也失败，必须把失败作为数据恢复风险报告。

当前已提供面向业务的 `ContentLifecycle` 和 `BackupRestoreService` 入口，UI 不应继续手工拼装核心生命周期写入。后续如果真实需求要求更强保证，再评估：

1. 同一数据库事务完成核心 collection 写入。
2. 无法跨实现时使用 staging collection + commit marker。
3. 失败后提供一致性检查和可重试恢复。

## 4. Migration

当前只交付 Backup v1 的有限兼容边界，不引入通用迁移平台，也不声称存在 v0/v2 迁移：

```text
raw backup text
  → JSON decode
  → envelope/version dispatch
  → validate Backup v1
  → restore with compensation
```

- 合法的 `format: "unidock-backup", version: 1` 继续按现有完整校验导入。
- 非法封套、缺失或非法 `version`、以及暂不支持的版本使用可识别错误码拒绝，并保留中文用户提示。
- 未知版本在恢复前被拒绝，不写入任何 collection；这不是 v0/v2 的迁移实现。
- IndexedDB physical schema、Document domain version 和 Backup format version 仍然分别管理；本次不升级 DB schema、不迁移 Document。

当前版本基线：

- IndexedDB schema version：`1`，object store 为 `records`，索引为 `by-collection`。
- Reader Document version：`1`，由 `packages/reader` 的 `DOCUMENT_VERSION` 固定。
- Backup format version：`1`，由 Web App 的 Backup v1 解码边界固定。

未知的 Document version 当前会被 Repository 校验拒绝；未知的 IndexedDB schema version
不会由当前 Adapter 主动降级或迁移。任何未来版本升级都必须先增加升级测试和明确的
`old version → current version` 迁移路径，不能只修改常量。

## 5. OPFS、SQLite、WASM

当前不采用以下技术作为预防性架构投资：

- OPFS：只有出现大文件、离线媒体或 Blob 管理需求时评估。
- SQLite/WASM：只有 IndexedDB 查询和事务能力被实际 benchmark 证明不足时评估。
- CRDT：只有出现真实多设备协作/并发编辑需求时评估。

替换存储的前提是保持 Repository 和领域模型稳定，而不是让业务直接依赖数据库 API。

## 6. Sync 边界

当前没有账号、远端 endpoint、outbox、冲突解决或同步协议。同步前必须先决定：

- Content/Document 是来源缓存还是用户拥有的副本。
- ReadingState 是按设备还是跨设备合并。
- 删除是否使用 tombstone。
- 冲突按字段、版本、时间还是用户选择解决。
- 备份、同步和远端代理各自负责什么。

在这些决定前，不新增泛化 `SyncProvider`、Remote Storage 或 CRDT 抽象。
