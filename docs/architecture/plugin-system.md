# Plugin System and Security Boundary

## 1. 当前状态

`packages/kernel` 已有 Plugin、Lifecycle、Capability、Permission、Event 和 Context 类型；但 Web App 没有创建 Kernel，RSS 也没有实现 Kernel Plugin。

因此当前准确表述是：

> UniDock 具有插件系统设计原型，但当前产品只运行可信内建模块，不支持不可信或远程插件。

## 2. 当前 Kernel 的限制

现有 `PermissionRegistry` 只是内存授权登记；`PluginContextFactory` 会把 storage、network、content、reader、ui 等依赖原样传给插件。撤销权限不会自动使已发放的引用失效。

所以：

- Permission 当前不能作为安全隔离机制。
- Capability 当前不能作为最小权限执行边界。
- Remote Plugin、Marketplace 和动态下载必须暂缓。

## 3. 进入插件平台前置条件

未来允许用户安装插件前，必须具备：

1. Manifest schema、API version 和权限值校验。
2. 每个 Capability 的最小包装器，而不是传递宿主原始对象。
3. 权限授予、撤销和插件版本绑定的持久化。
4. 插件存储命名空间和资源配额。
5. 网络域名/协议范围限制。
6. 插件生命周期结束时自动回收事件订阅、任务和 UI 注册。
7. Worker、iframe 或其他明确的隔离执行环境。
8. 插件安装来源、完整性和审计记录。

## 4. Trusted Built-in 与 Untrusted Plugin

### Trusted Built-in

- 由应用随版本发布。
- 可以直接依赖领域接口。
- 不需要为了形式统一接入 Kernel。
- 仍必须遵守 Content/Reader/Storage 边界。

### Untrusted Plugin

- 只能通过宿主 RPC/Capability 操作。
- 不能拿到 IndexedDB、Repository、任意 fetch 或 DOM 原始引用。
- 所有输入输出必须 schema 校验。
- 网络、存储、通知、UI 都必须受权限和资源范围约束。

## 5. Capability 的使用门槛

只有当存在多个实现或独立消费者时才引入 Capability。单一内建实现优先使用显式领域接口，避免为每个普通函数创建 Registry。

