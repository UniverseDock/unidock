# Command, Event, Job, Pipeline and Agent

## 1. 当前状态

- Command：未实现。
- 持久化 Job：未实现。
- Pipeline：未实现。
- Agent：未实现。
- EventBus：Kernel 中存在进程内原型，当前产品业务未依赖。

## 2. EventBus 定义

当前 EventBus 是进程内最佳努力通知：

- 无持久化、重放、顺序或幂等保证。
- handler 并发执行。
- handler 失败会使 emit reject。
- 插件停用后的订阅回收尚未由 Runtime 强制保证。

它适合生命周期通知，不适合替代数据库事务、同步队列或可靠任务系统。

## 3. 引入顺序

1. 先用明确领域服务实现 Feed 刷新、内容删除、备份恢复。
2. 出现多个入口复用同一操作时，再定义轻量 Command：稳定 ID、输入校验、结果和错误分类。
3. 出现长耗时、可取消、可重试任务时，再定义 Job。
4. 出现真实依赖图和用户编排需求时，再定义 Pipeline。
5. Agent 只能调用受权限保护、参数有 schema 且可审计的 Command/Tool。

禁止让 Agent 直接拿到 Repository、Storage 或任意网络引用。

## 4. 不做的事情

当前不引入：

- CQRS
- Event Sourcing
- 通用 DAG/Recipe 引擎
- 自动化市场
- Agent 自主任意代码执行

这些设计只有在真实产品场景和验收标准出现后才进入决策。

