# Evolution and Audit Findings

## 1. 当前是否需要大规模重构

**不需要。**

当前依赖方向和 Local First 主链路适合继续推进 RSS、Storage 和 Reading State。需要的是边界校准和局部增强，而不是推倒重来。

## 2. 当前已完成与仍建议处理

本轮已完成：

- 建立真实 Chromium 验收证据，区分静态检查、Node 测试和浏览器验收。
- 完成用户确认式 Service Worker 更新、跨标签页协调和离线冷启动验收。
- 明确 Storage 查询顺序、关闭语义、错误分类和跨 collection 业务一致性。
- 建立 IndexedDB、Document、Backup 的最小版本边界。
- 统一错误分类，并将 Content 生命周期、Backup 恢复提取为应用服务。

F1 收口后的持续工作：

1. 补充不同浏览器、PWA 安装形态、存储清理和真实配额策略的环境验证。
2. 维护构建期缓存版本和资源清单，降低 Service Worker 发布的手工维护风险。
3. 只有出现真实第二实现、第二消费者或明确失败场景时，再继续拆分应用服务或抽象新边界。

## 3. 建议延期

- Remote Plugin、Marketplace、动态第三方代码。
- 云端同步、账号、多设备冲突解决。
- SQLite/WASM、CRDT、WebGPU。
- 通用 Pipeline、Agent、Automation。
- 独立 `reader-web` 包。
- 大量 Plugin/Provider/Capability 空壳。

## 4. 过度工程化风险

当前最容易过度设计的地方：

- 把 Kernel 原型提前接入唯一 RSS 实现。
- 为单个 Storage 实现创建多层 Adapter/Provider/Capability。
- 为当前同步不存在而设计 CRDT。
- 为简单导入流程建立通用工作流引擎。
- 把 EventBus 扩展成消息队列。
- 为未来多个 Renderer 提前拆包。

判断规则是：先有第二个实现、第二个消费者或明确失败场景，再抽象。

## 5. 后续扩展准入条件

进入同步、远端插件或更重基础设施前，必须满足：

- 不扩大当前可信内建模块边界。
- 不把 Kernel/Permission 描述成安全插件平台。
- 不让 Reader Core 依赖 DOM。
- 不让业务直接依赖 IndexedDB。
- 新增持久化字段带版本和迁移计划。
- 新业务操作记录失败、重试和部分写入语义。
- 真实需求已经出现，而不是仅由规划文档推动。
- 至少存在第二个实现、第二个消费者或可重复的性能/可靠性失败证据。

当前明确暂缓：

- 多设备同步、账号、冲突解决和 CRDT。
- SQLite/WASM、云端数据库和通用 Remote Storage。
- 远程插件、Marketplace 和动态第三方代码。
- 通用 Job、Pipeline、Agent 和 Automation。
