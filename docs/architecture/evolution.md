# Evolution and Audit Findings

## 1. 当前是否需要大规模重构

**不需要。**

当前依赖方向和 Local First 主链路适合继续推进 RSS、Storage 和 Reading State。需要的是边界校准和局部增强，而不是推倒重来。

## 2. 现在建议处理

优先级从高到低：

1. 建立真实浏览器验收证据，区分静态检查、Node 测试和浏览器验收。
2. 修正 PWA 发布版本和 Service Worker 更新的手工依赖。
3. 明确 Storage 查询顺序、关闭语义和跨 collection 业务一致性。
4. 为 IndexedDB、Document、Backup 建立最小版本迁移规则。
5. 统一时间语义、外部 ID 命名空间和错误分类。
6. 将备份导入明确为当前的非原子合并写入，并规划可恢复方案。
7. 控制 `apps/web/main.ts` 的编排增长，按真实重复场景提取应用服务。

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

## 5. 下一阶段准入条件

UniDock 可以继续 RSS / Storage / Reading State 开发，前提是：

- 不扩大当前可信内建模块边界。
- 不把 Kernel/Permission 描述成安全插件平台。
- 不让 Reader Core 依赖 DOM。
- 不让业务直接依赖 IndexedDB。
- 新增持久化字段带版本和迁移计划。
- 新业务操作记录失败、重试和部分写入语义。
