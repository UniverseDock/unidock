# Terminology

## 1. 内容和阅读模型

| 术语 | 定义 | 当前状态 |
| --- | --- | --- |
| Content | 来源无关的内容元数据和身份 | 已实现 |
| Document | 某个 Content 的可阅读结构化正文快照 | 已实现 |
| Block | Document 内的语义内容单元，如 paragraph、heading、image | 已实现 |
| Layout | 将 Block 转换为尺寸、分页或阅读布局的结果 | 未来规划 |
| Page | Layout 产生的可导航页面/视口单元 | 未来规划 |
| Renderer | 将 Document 或 Layout 展示到具体平台的实现 | Web DOM 部分实现 |
| Resource | 内容引用的逻辑资源，如图片、附件、字体 | 设计中 |
| Asset | Resource 的本地或远端可获取表示 | 设计中 |
| Blob | 浏览器二进制存储对象；不是业务内容模型 | 当前未单独建模 |

`Content` 不应逐渐变成“所有内容的容器”。正文属于 `Document`，本地文件或图片二进制属于未来的 Resource/Asset 层。

## 2. 状态模型

| 术语 | 定义 | 归属 |
| --- | --- | --- |
| UserState | 用户跨设备希望保留的状态，如已读、收藏、标注 | Reader / User State |
| DeviceState | 仅属于某个设备的偏好或缓存状态 | App / Device Store |
| SessionState | 当前页面或当前打开任务的临时状态 | UI / Session |
| Annotation | 用户对内容的高亮、批注、标签或引用 | 未来 UserState |

当前 `ReadingState` 同时承担已读、收藏和阅读位置，适合 MVP；未来同步前应区分用户状态、设备位置和会话状态。

## 3. 插件和扩展

| 术语 | 定义 |
| --- | --- |
| Plugin | 由宿主管理生命周期的扩展单元 |
| Provider | 为某个稳定领域接口提供实现的模块 |
| Capability | 宿主明确授予插件的一组最小操作能力 |
| Permission | 用户/宿主对 Capability 或资源范围的授权决定 |
| Adapter | 将一个具体实现转换成稳定契约的技术边界 |

Provider 不等于 Plugin。一个内建 Provider 可以不经过 Plugin Runtime；一个 Plugin 可以提供多个 Provider。

## 4. 操作和编排

- **Command**：用户或系统请求执行一个明确、可验证的领域操作。
- **Event**：已经发生的事实通知；当前 EventBus 只保证进程内最佳努力通知。
- **Job**：可排队、重试、取消并可观察的长任务。
- **Pipeline**：多个步骤之间有明确输入输出和依赖关系的编排。
- **Agent**：通过受限 Tool/Command 操作领域能力的上层自动化主体。

不要把 Command、Event、Job、Pipeline 和 Agent 混成一个通用“自动化引擎”。

