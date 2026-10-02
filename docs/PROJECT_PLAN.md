# UniDock 项目总体规划

> 项目：UniDock（UniverseDock）  
> Slogan：**Your Dock to the Universe.**  
> 定位：PWA 优先、插件化、Local First 的个人内容与信息工作台。  
> 文档性质：产品、架构、模块职责和阶段路线规划。  
> 更新时间：2026-10-01

本文用于回答四个问题：

1. UniDock 要解决什么问题。
2. 各个模块负责什么，以及不负责什么。
3. 模块之间通过什么数据和接口协作。
4. 应该按什么顺序交付和验收。

本文描述的是目标架构和实施规划，不代表所有目录、功能和接口已经存在。每次开发前必须以实际文件和 `git status` 为准。

---

## 1. 产品目标

### 1.1 产品定位

UniDock 是一个将不同内容来源接入统一 Dock 的个人内容阅读与信息工作台。

长期方向：

```text
内容来源 → 内容模型 → 处理能力 → Reader / Player → 本地状态
```

第一阶段不追求覆盖所有内容类型，而是先完成一条可靠的本地阅读闭环：

```text
用户添加 RSS
      ↓
抓取并解析 Feed
      ↓
转换为 Article Content
      ↓
保存到 ContentRepository
      ↓
持久化到 IndexedDB
      ↓
在 Reader 中打开和阅读
      ↓
保存已读、收藏和阅读进度
      ↓
刷新、离线或重开后继续阅读
```

### 1.2 核心原则

#### Local First

MVP 的基础阅读流程不依赖远端 API 或云端数据库。

```text
Web App
  ↓
Repository
  ↓
Storage
  ↓
IndexedDB Adapter
  ↓
Browser
```

服务器未来可以承担账号、同步、代理、爬取和 AI 等可选能力，但不能成为本地阅读的必要条件。

#### Core 与业务解耦

Kernel、Storage、Content、Reader Core 和 SDK 提供通用机制与契约，不直接依赖 RSS、IPTV、书籍、漫画或具体第三方平台。

推荐协作方式：

```text
Plugin → PluginContext → Capability / Event → Core 或其他 Plugin
```

插件之间不直接导入彼此的实现。

#### 平台无关

平台无关模块尽量不依赖：

- `window`
- `document`
- `localStorage`
- `indexedDB`
- React
- DOM API

浏览器相关代码放在 Web App、Web Renderer 和 Storage Adapter 中。

#### 数据归属清晰

Content 只承载通用内容元数据。正文文档、阅读 Block、阅读进度、收藏状态和抓取状态应根据职责放在独立模型或集合中。

不要把所有业务状态都塞进 Content。

#### 先建立闭环，再扩展平台

优先顺序是：

```text
可验证的底层契约
  ↓
本地 Content 闭环
  ↓
Reader
  ↓
RSS
  ↓
其他内容源和平台能力
```

在本地阅读 MVP 完成前，不优先建设 Marketplace、复杂权限 UI、云端同步、AI Automation 和大量插件空壳。

---

## 2. 当前仓库事实

以下内容是当前规划文档编写时的仓库事实，不是未来目录承诺。

### 2.1 当前已存在的主要模块

```text
packages/
├── kernel/
├── content/
├── sdk/
└── storage/
```

#### `packages/kernel`

当前已有 Kernel 基础设施，包括：

- Capability
- Permission
- Event
- Lifecycle
- Plugin
- Runtime
- Context
- Container

Kernel 的长期职责是提供插件运行时和通用协作机制，而不是实现 RSS 或 IPTV 业务。

#### `packages/content`

当前已有：

- Content 类型
- Content ID 能力
- ContentRepository 接口
- 基于 Storage 的 `StorageContentRepository`

#### `packages/sdk`

当前已有面向插件或外部模块的类型导出，包括：

- capability
- content
- permission
- plugin
- storage

#### `packages/storage`

当前已有：

- 平台无关的 Storage 接口
- StorageCollection 接口
- Storage 查询、分页和清理接口
- IndexedDB Adapter
- IndexedDB Storage 实现

当前已经通过真实 Chromium 验证：

- 数据库创建
- Collection 写入和读取
- 多 Collection 隔离
- 关闭后重新打开的持久化

### 2.2 当前尚不存在的模块

以下目录目前不能视为已实现：

```text
apps/web
packages/reader
packages/reader-web
plugins/rss
plugins/iptv
services/*
```

当前也尚不存在：

- Web App 启动入口
- PWA App Shell
- Reader UI
- Reader Core
- RSS 抓取和解析
- IPTV 播放器
- 阅读进度业务模型
- 收藏和已读业务模型
- 云端同步

后续实现必须先确认目标目录是否真实存在，不得根据规划文档直接假设旧代码已经存在。

### 2.3 Workspace 范围

当前 `pnpm-workspace.yaml` 规划范围为：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "plugins/*"
```

`services/*` 当前不在 workspace 中。除非明确的产品阶段需要，不应仅为了目录完整而擅自加入。

---

## 3. 总体架构

### 3.1 分层结构

```text
┌─────────────────────────────────────────────┐
│ Web App / PWA Shell                          │
│ 页面、路由、DOM、Service Worker、用户交互       │
└───────────────────────┬─────────────────────┘
                        │
┌───────────────────────▼─────────────────────┐
│ Web Renderer / Player                        │
│ Document → DOM、Channel → Media              │
└───────────────────────┬─────────────────────┘
                        │
┌───────────────────────▼─────────────────────┐
│ Product Features                             │
│ Reader、Feed 管理、收藏、已读、阅读进度          │
└───────────────┬─────────────────┬───────────┘
                │                 │
┌───────────────▼────────┐ ┌──────▼────────────┐
│ Reader Core             │ │ Business Plugins  │
│ Document、Block、解析    │ │ RSS、IPTV、未来来源 │
└───────────────┬────────┘ └──────┬────────────┘
                │                 │
                └────────┬────────┘
                         │
┌────────────────────────▼────────────────────┐
│ Content / Repository / Storage                │
│ 通用内容模型、Repository、集合数据访问          │
└────────────────────────┬────────────────────┘
                         │
┌────────────────────────▼────────────────────┐
│ Kernel / SDK                               │
│ Runtime、Plugin、Context、Capability、Event  │
└─────────────────────────────────────────────┘
```

### 3.2 依赖方向

推荐依赖方向：

```text
Web App
  → Product Features
  → Reader / Plugin
  → Content / Repository
  → Storage abstraction
  → Storage adapter
```

Kernel 和 SDK 提供通用契约，业务模块通过契约接入。

不允许的依赖方向：

```text
Kernel → RSS
Kernel → IPTV
Content → React
Reader Core → DOM
RSS Plugin → IndexedDB
IPTV Plugin → 某个具体播放器实现
```

---

## 4. 模块职责

## 4.1 Kernel

### 主要职责

- Plugin Manifest 和插件身份
- Plugin Lifecycle
- Plugin Runtime
- Plugin Context
- Capability Registry
- Permission Registry
- Permission Enforcement
- EventBus
- 通用 Container

### 不负责

- RSS XML 解析
- IPTV M3U 解析
- 文章正文抽取
- Content 业务字段
- Reader 页面布局
- IndexedDB 具体调用

### 目标协作方式

```ts
Plugin
  → PluginContext
  → Capability / Event
  → Kernel 或其他 Plugin
```

### 关键约束

Permission 不能只存在于 Manifest 声明中。未来 Sandbox Plugin 真正运行时，Runtime 必须执行权限检查。

完整 Marketplace、安装包签名和复杂权限管理暂不属于 MVP。

## 4.2 SDK

### 主要职责

SDK 面向插件作者和外部扩展提供稳定、精简的类型和 API：

- Plugin 类型
- Plugin Context 类型
- Capability 类型
- Permission 类型
- Event 类型
- Content 类型
- Storage 类型

### 不负责

- 直接实现业务插件
- 直接绑定浏览器 API
- 暴露内部实现细节
- 替代 Kernel Runtime

### 设计要求

- SDK API 尽量保持稳定
- SDK 不应反向依赖具体插件
- SDK 的类型应与 Kernel、Content、Storage 的公共契约一致

## 4.3 Content

### 主要职责

Content 是跨来源共享的通用内容元数据模型。

当前核心字段方向：

```ts
interface Content {
  id: string;
  type: ContentType;
  title: string;
  subtitle?: string;
  description?: string;
  cover?: string;
  author?: string;
  tags?: string[];
  sourceId?: string;
  createdAt: number;
  updatedAt: number;
}
```

当前类型方向：

```text
book
article
rss
live
video
audio
comic
document
```

### Repository 职责

```ts
interface ContentRepository {
  get(id: string): Promise<Content | undefined>;
  save(content: Content): Promise<void>;
  delete(id: string): Promise<void>;
  list(query?: ContentQuery): Promise<Content[]>;
}
```

Repository 负责：

- Content 的保存和读取
- 基本查询
- 基本分页
- Content 与 Storage 的边界转换

Repository 不负责：

- IndexedDB 事务细节
- RSS XML 解析
- HTML 正文抽取
- 阅读进度
- DOM 渲染

## 4.4 Storage

### 主要职责

Storage 提供平台无关的集合数据访问抽象：

```ts
interface Storage {
  collection<T>(name: string): StorageCollection<T>;
  close(): void;
}
```

```ts
interface StorageCollection<T> {
  get(id: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(query?: StorageQuery): Promise<T[]>;
  clear(): Promise<void>;
}
```

### IndexedDB Adapter 职责

IndexedDB Adapter 是浏览器平台适配层，负责：

- 创建或打开数据库
- 初始化 Object Store
- 处理数据库版本
- 将 IndexedDB 请求转换成 Promise
- 处理数据库连接关闭
- 处理 IndexedDB 不可用错误

业务代码不能直接依赖 IndexedDB Adapter。

### 数据集合建议

第一版可以使用单一 `records` Object Store，通过复合主键隔离集合：

```text
[collectionName, id]
```

逻辑集合包括：

```text
contents
reading-progress
bookmarks
feeds
feed-items
app-settings
```

这些集合应按实际需求逐步引入，不提前建立大量空壳。

## 4.5 Reader Core

Reader Core 当前尚未实现，目标是提供平台无关的阅读数据链路：

```text
Content → Document → Block[] → Layout → Page[] → Renderer
```

### 主要职责

- Content 到 Document 的转换
- Document 和 Block 类型
- 基础文档结构
- 文档解析和规范化
- 阅读位置的抽象
- 可选的布局计算

### 初始 Block

第一版建议支持：

- paragraph
- heading
- image
- quote
- code
- divider
- list

后续再支持：

- video
- audio
- table
- embed
- attachment

### 不负责

- DOM 操作
- CSS
- 浏览器路由
- IndexedDB 访问
- 具体 UI 框架

轻量 HTML Parser 和估算型 Layout 只能作为 MVP 能力，不应描述为生产级排版引擎。

## 4.6 Web App / PWA

`apps/web` 当前尚不存在，未来负责：

- 应用启动
- 依赖注入
- 页面和路由
- DOM 渲染
- 用户交互
- PWA Manifest
- Service Worker
- 离线资源缓存
- Web 平台适配

启动时应完成：

```text
IndexedDBAdapter
  → Storage
  → ContentRepository
  → Product Features
```

Web App 不应把 IndexedDB 逻辑散落到页面组件中。

第一版不需要复杂前端框架。可以先使用简单的 TypeScript + HTML/CSS，待交互复杂度明确后再决定是否引入 UI 框架。

## 4.7 RSS Plugin

`plugins/rss` 当前尚不存在，未来负责：

```text
Feed URL
  → Fetcher
  → RSS / Atom Parser
  → Feed / Article
  → Content
  → ContentRepository
```

### 第一版支持

- RSS 2.0
- Atom
- 标题
- 链接
- 摘要
- 正文片段
- 作者
- 发布时间
- guid
- 图片
- 分类

### 解析时需要考虑

- CDATA
- HTML 内容
- 相对 URL
- 重复文章
- guid 缺失
- 时间格式差异
- 字符编码
- RSS 摘要不等于完整正文

RSS Plugin 不负责完整正文提取。正文提取未来应作为独立能力，例如：

```text
article.extract
```

## 4.8 IPTV Plugin

`plugins/iptv` 当前尚不存在，必须在 Reader/RSS 基础稳定后再开始。

目标链路：

```text
M3U
  → Parser
  → Channel
  → Channel List
  → Player Capability
```

第一版只做：

- M3U 解析
- 频道名称
- 频道分组
- 播放地址
- 基础频道列表

后续再做：

- EPG
- 节目单
- 收藏
- 播放历史
- 多播放器能力

IPTV Plugin 不应绑定某一个播放器实现。

## 4.9 Services

`services/*` 当前不属于 workspace，也不是 MVP 必需模块。

未来可能承载：

- 远端同步
- 账号
- Feed 代理
- 正文抓取
- AI 能力
- 多设备同步

所有 Service 都必须是可选能力。Local First 的本地阅读不能依赖它们。

---

## 5. 数据模型和状态归属

### 5.1 Content 元数据

Content 只保存跨来源通用的内容信息：

```text
id
type
title
subtitle
description
cover
author
tags
sourceId
createdAt
updatedAt
```

### 5.2 阅读文档

Article 的正文不一定直接放进 Content。建议后续根据实际需求拆分：

```text
content
document
document-blocks
```

其中：

- `content`：通用元数据
- `document`：可阅读文档
- `document-blocks`：正文结构

第一版可以暂时将轻量正文放在文档结构中，但需要保持迁移空间。

### 5.3 阅读进度

阅读进度属于 Reader 或 Product Feature：

```ts
interface ReadingProgress {
  contentId: string;
  position: number;
  completed: boolean;
  updatedAt: number;
}
```

不建议把阅读进度直接写入 Content。

### 5.4 收藏和已读

收藏、已读属于用户状态：

```ts
interface ContentState {
  contentId: string;
  starred: boolean;
  read: boolean;
  updatedAt: number;
}
```

未来可以拆成独立集合，也可以在状态模型稳定后合并。

### 5.5 Feed

Feed 不是普通 Article Content 的替代品，建议单独建模：

```ts
interface Feed {
  id: string;
  url: string;
  title?: string;
  siteUrl?: string;
  lastFetchedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

Feed Item 最终可以映射为 Article Content，但需要保留：

- Feed 所有者
- guid
- 原始链接
- 抓取时间
- 原始发布时间

---

## 6. 关键数据流

### 6.1 本地 Content 数据流

```text
Web App
  → ContentRepository.save(content)
  → Storage.collection("contents")
  → IndexedDBAdapter
  → IndexedDB
```

读取方向相反：

```text
IndexedDB
  → Storage
  → ContentRepository
  → Product Feature
  → Web UI
```

### 6.2 Reader 数据流

```text
Content
  → Document Converter
  → Document
  → Block[]
  → Web Renderer
  → DOM
```

### 6.3 RSS 数据流

```text
Feed URL
  → Fetcher
  → RSS/Atom Parser
  → Normalized Feed Item
  → Article Content
  → ContentRepository
  → IndexedDB
  → Reader
```

### 6.4 插件协作数据流

```text
Source Plugin
  → Capability / Content
  → Processor
  → Reader / Player
```

插件不应直接调用另一个插件的内部类或内部存储实现。

---

## 7. 分阶段实施路线

## Phase 1：Storage 和本地 Content

### 目标

完成并稳定：

```text
IndexedDB → Storage → ContentRepository → Content
```

### 当前状态

已经完成：

- Storage 类型抽象
- IndexedDB Adapter
- IndexedDB Storage
- Content Repository Storage 实现
- Node 契约测试
- Chromium 真实 IndexedDB 烟测
- 数据库创建
- CRUD
- 多集合隔离
- 关闭重开后的持久化

### 后续收尾

- 通过浏览器验证 ContentRepository 直接访问 IndexedDB
- 明确数据库升级策略
- 明确关闭后访问的错误行为
- 补充异常和边界测试
- 保持 Storage 和 Content 的类型边界

### 验收标准

- 浏览器可以持久化读写 Content
- 刷新或关闭重开后数据仍存在
- Content 业务代码不直接调用 IndexedDB
- Storage 和 Content 通过 typecheck/build
- Node 测试和 Chromium 测试均通过

## Phase 2：最小 Web App

### 目标

建立真实的 `apps/web`，让本地 Content 可以在浏览器页面中管理。

### 实施步骤

1. 建立最小 Web App 入口。
2. 初始化 IndexedDB Storage 和 ContentRepository。
3. 增加 Content 列表。
4. 增加测试 Content 的创建和删除。
5. 验证刷新后的持久化。
6. 增加基础错误显示和空状态。

### 暂不做

- 完整 Reader
- RSS 订阅
- 复杂路由
- 复杂主题系统
- 账号和同步

### 验收标准

```text
浏览器打开 Web App
  → 创建本地 Content
  → 列表显示
  → 删除
  → 刷新后状态正确
```

## Phase 3：Reader Core

### 目标

建立不依赖 DOM 的 Document/Block 数据链路。

### 实施步骤

1. 建立 `packages/reader`。
2. 定义 Document。
3. 定义基础 Block。
4. 实现 Article Content 到 Document 的转换。
5. 添加 Node 测试。
6. 明确空内容、未知内容和异常内容的处理。

### 验收标准

- Reader Core 可在 Node 环境运行
- Content 可以转换为稳定 Document
- Reader Core 不依赖浏览器 API
- Web App 可以消费 Reader Core 输出

## Phase 4：Web Reader

### 目标

在 Web App 中打开本地文章并记录阅读状态。

### 实施步骤

1. 列表点击打开文章。
2. 渲染标题和基础 Block。
3. 支持返回列表。
4. 保存已读状态。
5. 保存阅读位置。
6. 刷新后恢复阅读状态。
7. 增加收藏状态。

### 验收标准

```text
本地 Content
  → Content 列表
  → 打开文章
  → Reader 渲染
  → 保存阅读进度
  → 刷新后恢复
```

## Phase 5：RSS Plugin

### 目标

完成第一个真实内容来源。

### 实施步骤

1. 建立 `plugins/rss`。
2. 定义 Feed 模型。
3. 实现 RSS 2.0 Parser。
4. 实现 Atom Parser。
5. 统一 Feed Item。
6. 映射为 Article Content。
7. 写入 ContentRepository。
8. 在 Reader 中打开文章。
9. 增加 Feed 刷新和去重。

### 验收标准

```text
添加 Feed URL
  → 抓取
  → 解析 RSS/Atom
  → 保存文章
  → Reader 打开
  → 离线读取
```

## Phase 6：PWA 和离线体验

### 目标

让本地阅读产品具备稳定的 PWA 使用体验。

### 实施步骤

1. 增加 Web App Manifest。
2. 增加 Service Worker。
3. 缓存应用 Shell。
4. 验证离线打开。
5. 验证本地 Content 离线阅读。
6. 处理缓存版本升级。

PWA 资源缓存和业务数据持久化是两件事：

```text
Service Worker → 应用资源
IndexedDB      → 用户内容和状态
```

## Phase 7：IPTV Plugin

只有 RSS 和 Reader 稳定后再进入。

### 实施步骤

1. 建立 M3U Parser。
2. 定义 Channel 模型。
3. 保存频道列表。
4. 展示频道列表。
5. 定义 Player Capability。
6. 接入具体播放器。
7. 后续再增加 EPG、收藏和历史。

---

## 8. 暂缓范围

在本地阅读 MVP 完成前，暂不优先实现：

- Marketplace / Plugin Store
- 用户体系
- 社交和推荐算法
- 云端数据库
- 多设备同步
- AI Agent
- Automation
- 复杂权限 UI
- 完整 EPG
- 大量尚无需求的插件空壳
- 复杂主题系统
- 完整国际化系统
- 生产级 HTML 排版引擎

这些功能不是不做，而是不能抢在本地阅读闭环之前扩张范围。

---

## 9. 工程质量和验收规则

每个阶段都必须满足：

1. 开始前检查实际仓库：
   ```bash
   git status --short
   ```

2. 阅读相关 package 的 `package.json`、tsconfig 和现有实现。

3. 不覆盖用户已有未提交修改。

4. 一次只推进一个阶段。

5. 保持 TypeScript strict。

6. 完成后执行：
   ```bash
   corepack pnpm typecheck
   corepack pnpm build
   git diff --check
   ```

7. 涉及浏览器能力时，使用真实浏览器验证。

8. 不把规划目录描述为已经实现。

9. 阶段报告必须说明：
   - 修改了什么
   - 实际验证了什么
   - 尚未验证什么
   - 当前阶段是否完成
   - 下一阶段建议

### 推荐的测试层次

```text
Node Unit / Contract Tests
  → 平台无关逻辑、模型、Parser、Repository 契约

Browser Smoke Tests
  → IndexedDB、DOM、Service Worker、PWA 行为

Browser Integration Tests
  → Web App、Reader、ContentRepository 端到端流程
```

不要用 Node 测试替代浏览器能力验证，也不要用浏览器烟测替代全部单元测试。

---

## 10. 当前最近一步

当前最适合执行的下一个单独阶段是：

### 浏览器中的 ContentRepository 集成验证

范围严格限定为：

1. 浏览器初始化 `IndexedDBAdapter`。
2. 创建 `StorageContentRepository`。
3. 保存 Article Content。
4. 关闭并重新打开数据库。
5. 通过 Repository 读取 Article。
6. 验证类型、来源、标签和分页查询。
7. 通过 Chromium 页面确认 `PASS`。

完成后再建立 `apps/web`。

不要在这个阶段同时实现：

- Reader
- RSS
- PWA
- IPTV
- 云端服务

---

## 11. 文档维护规则

本文是项目总体规划，不替代 Agent 执行规则。

- `AGENT_PROJECT_PROMPT.md`：开发协作约束、当前仓库事实和 Agent 工作流程。
- `PROJECT_PLAN.md`：产品方向、模块职责、架构边界和阶段路线。

当实际代码与本文规划不一致时：

1. 先相信实际代码和测试结果。
2. 再更新本文的“当前状态”部分。
3. 不为了匹配规划而创建无实际需求的目录。
4. 已完成的规划必须有代码、测试或浏览器验证作为依据。

## 12. 可执行任务清单

本节是前述路线的任务化拆分，不代表授权同时实现所有阶段。每轮只选择一个任务，验收后再推进。下列新文件位置均为建议，实施前核对实际目录；所有任务当前均待实施。

### 12.1 验证证据与状态校正

- 用户已确认 Chromium 页面显示 PASS；该夹具验证的是 Storage 写入、读取、集合隔离及同一页面内关闭连接后重开。
- 这不等于完整 CRUD 验收：浏览器中的更新、删除、clear、list、分页和 Repository 集成尚待补充。
- 尚未验证页面刷新、浏览器重启、离线启动以及数据库升级。
- Node Repository 测试使用内存 fake，不能证明真实 IndexedDB 的查询行为。
- 此前将 headless 超时归因于事务监听时序，证据不足：诊断后来显示超时发生在数据库删除或打开阶段。现有监听改动不能作为“已证实根因修复”记录，需要独立回归检查。
- `--dump-dom` 进程退出成功不能代表测试成功；虚拟时间超时也不能直接证明 IndexedDB 生产代码有缺陷。

因此，前文 Phase 1 的“CRUD 已完成”应理解为实现存在和部分测试通过，而非全部真实浏览器用例已验收。Phase 1 整体仍未结束。

### 12.2 A1：建立可信的浏览器集成验证入口（下一任务）

目标：让浏览器直接运行真实 StorageContentRepository，并得到可追溯结果。

范围：

- 读取 `packages/storage/test/indexeddb-browser.html` 和现有测试脚本，保留用户改动。
- 在测试目录建立同时可访问 Content、Storage 构建产物的 HTTP 入口；只绑定本机回环地址，不依赖 `file://`。
- 构建相关包后加载 Repository，避免浏览器中无法解析的裸模块导入。
- 页面按用例显示名称、通过/失败、错误和阶段；失败/超时后不能被后续异步结果覆盖为 PASS。
- 使用独立测试数据库，关闭所有测试连接后清理；不访问或删除用户数据库。
- 修正 `test:browser`：若自动运行，必须等待真实完成信号并在失败时非零退出；若暂为手动运行，脚本和说明必须明确，不能冒充自动验收。

用例：

1. 保存完整 Article 元数据，再通过 Repository get 逐字段比较。
2. 同 ID 更新，确认没有新增重复条目。
3. 保存其他类型、来源、标签的数据，验证组合筛选。
4. 在不匹配记录之间插入多个匹配记录，以非零 offset 验证“先筛选后分页”；明确排序依据。
5. 验证空结果、limit 为零、缺少 tags、空 tags 查询。
6. 删除已有和不存在的记录，确认其他记录不受影响。
7. 两个集合使用相同 ID，确认读写与清理隔离。
8. 关闭连接、重建 Adapter 和 Repository，再读取剩余数据。

验收：真实 Chromium 中全部用例通过，记录人工确认或自动运行证据；Node 回归及工程检查通过。

不包含：Web App、Reader、RSS、PWA、数据库迁移框架。

### 12.3 A2：Storage 生命周期和错误路径

依赖 A1。范围限定 `packages/storage` 及相关测试。

任务：

- 定义同一 Adapter 重复/并发 create 的语义，避免只保存最后一个连接而泄漏其他连接。
- 明确 close、destroy 的幂等性、关闭后的访问行为、销毁时尚在打开的请求如何处理。
- 检查 blocked 后请求晚到成功时是否遗留连接，以及 versionchange 的关闭行为。
- 验证请求失败、事务 abort、不可克隆数据、无效 key 和同步异常；检查未处理的 Promise rejection。
- 检查当前 get/list 的请求 Promise 与事务 Promise 是否全部被消费，避免一个失败后另一个拒绝无人处理。
- 明确数据库版本 1 的 schema、升级原则和旧连接处理；先写最小升级测试，不建立通用迁移平台。

验收：成功路径与错误路径都能终止，无永久等待和未处理拒绝；连接释放有回归证据。

### 12.4 A3：查询语义与持久化边界

依赖 A1、A2。范围为 Storage/Content 查询和测试。

任务：

- 明确 list 默认顺序，不把测试 fake 的插入顺序当成 IndexedDB 的主键顺序。
- 定义 offset/limit 的负数、小数、NaN、Infinity 行为，并统一 Storage 与 Repository。
- 验证空字符串 ID、Unicode ID 和相同前缀集合；检查当前以 `\\uffff` 为上界是否会遗漏合法 ID。
- 确认 clear 只删除目标集合，where 的数组匹配和 tags 的“全部包含”语义一致。
- 确定读取损坏 Content 时采用拒绝、跳过还是显式错误，不依靠强制类型转换宣称数据有效。
- 增加跨页面刷新恢复测试；浏览器重启持久化单独记录，不用连接重开替代。

验收：查询语义有文档和非平凡用例，边界数据不丢失、不跨集合。

### 12.5 B1：最小 Web App 与本地内容管理

依赖 A1—A3 验收。建议范围 `apps/web`，必要时调整根 scripts/项目引用。

实施前决策：

- 选择支持 TypeScript ESM 的最小开发/构建工具；vanilla UI 是初始建议，不是已锁定架构。
- 确认 workspace 导入、构建输出和本地开发启动方式，不改变 packageManager。

任务：

1. 建立 HTML、TypeScript、样式和 package 配置。
2. 应用启动统一初始化 Adapter/Storage/Repository，失败时显示可重试错误。
3. 展示 Content 列表、空状态、加载状态。
4. 支持新增和删除本地测试内容，输入校验与错误可见。
5. 刷新页面恢复数据，避免热更新或重复初始化遗留连接。

验收：可从明确命令启动，构建产物可通过 HTTP 访问；列表增删和刷新持久化通过浏览器验证。

### 12.6 C1：正文模型与 Reader Core

依赖 B1。建议范围 `packages/reader`，正文持久化归属需先确定。

关键决策：Content 目前只有元数据，不能凭空转换出正文。先定义正文输入，再实现 Document。

任务：

- 定义 Document ID、contentId、正文版本、Block 判别联合类型及稳定 Block ID。
- 第一版支持 heading、paragraph、list、quote、code、image、divider；暂不实现分页引擎。
- 定义正文 Repository/集合归属，区分原始正文、规范化文档、可重新生成数据。
- 先用本地正文 fixture 建立“Content + 正文 → Document”转换，不把 description 当完整正文。
- 定义未知 Block、空正文、损坏文档的处理；用 Node 测试验证平台无关性。
- 明确 Content 删除后正文及状态清理策略；部分写入失败要可重试，避免孤立数据无法管理。

验收：Document 可以独立保存与读取，转换结果稳定，Reader Core 不依赖 DOM。

### 12.7 C2：Web Reader 与阅读状态

依赖 C1。DOM 渲染先留在 Web App；只有复用需求明确时再建 `reader-web`。

任务：

- 实现列表到文章页的导航、返回和直接打开不存在文章的错误态。
- 安全渲染 Block；不直接把远端 HTML 写入 DOM，过滤危险 URL 协议。
- 支持键盘导航、语义化标题、图片替代文本及窄屏阅读。
- 定义阅读进度坐标：建议 Block ID + Block 内偏移，附文档版本；不只存裸像素或含义不明的 number。
- 节流保存进度，验证切换文章及刷新恢复；文档更新时允许回退到合理位置。
- 独立保存已读、收藏状态，避免更新内容元数据覆盖用户状态。

验收：打开本地正文、阅读、标记、刷新恢复形成闭环；边界错误不导致空白页。

### 12.8 D1：RSS/Atom 解析与本地导入

依赖 C2。建议范围 `plugins/rss` 和明确的公共接入契约。

任务：

- 先用本地 fixture 验证 RSS 2.0/Atom，不把网络故障混入 Parser 测试。
- 定义 Feed、规范化 Item、sourceId 与 contentId 映射及版本策略。
- 覆盖 namespace、CDATA、相对链接、缺失 guid、日期异常和编码。
- 区分摘要和完整正文，保留来源链接与原始发布时间。
- 以 Feed ID + guid/规范化链接等稳定策略去重；重复导入不重复创建、不覆盖阅读状态。
- 使用 SDK/Context 的公共能力接入，先核对现有能力是否足够，不假设已存在 Content 写入 Capability。

验收：重复导入 fixture，文章数量稳定，正文可在 Reader 打开，已读/收藏不丢失。

### 12.9 D2：Feed 网络刷新与订阅管理

依赖 D1。

任务：

- 订阅新增、修改、删除、手动刷新及失败重试；明确删除订阅是否保留文章。
- 处理超时、取消、HTTP 错误、非法响应、尺寸限制、部分 Feed 失败。
- 支持条件请求的方案需验证服务端 CORS 是否允许相关请求头。
- 浏览器不能直接读取所有 Feed：优先支持允许 CORS 的来源和文件导入，展示限制。
- 若需要代理，另行确认服务范围、部署及安全规则；不要宣称纯浏览器已支持任意订阅地址。
- 区分网络获取、解析、存储失败，刷新结果给出新增/更新/失败数量。

验收：至少一个允许 CORS 的真实 Feed 成功导入；离线或拒绝跨域时已有本地文章仍可阅读。

### 12.10 E1：PWA 与真正离线验收

依赖稳定的 Web App 和 Reader；可在 RSS 完成前实施基础 Shell 缓存，但整体离线验收在 D2 后执行。

任务：

- Manifest、图标、Service Worker 注册、安装体验与安全上下文检查。
- 缓存构建资源和导航回退，明确更新提示及旧缓存清理策略。
- 不缓存任意远端请求；正文、图片是否离线保存必须明确，图片失败有占位。
- 验证首次在线后离线重新打开应用，而非只在已打开页面断网。
- 处理存储配额不足与浏览器清理；说明 IndexedDB 不等于永久备份。
- 提供最小内容/订阅导出恢复方案或明确数据丢失风险，避免用户误认为跨设备同步已实现。

验收：离线冷启动可打开已保存文章并恢复状态，在线更新后用户数据不丢失。

### 12.11 F1：MVP 收尾与后续扩展门槛

依赖上述阅读闭环完成。

任务：

- 建立可重复运行的验收命令和手动浏览器检查表。
- 检查新增 HTML 内容、URL、插件权限及远端访问的安全边界。
- 覆盖长列表、小屏、键盘操作、异常正文、存储失败等基础体验。
- 更新事实快照与 README，区分已实现、人工验证、未覆盖事项。
- 分组梳理现有未提交改动和生成产物的跟踪策略；只有用户明确要求后才提交代码。

IPTV 是下一轮产品阶段，不是阅读 MVP 的前置任务。进入前需明确频道模型、Player Capability、格式兼容与错误提示；Marketplace、Sync、AI 继续暂缓。

### 12.12 执行与完成定义

依赖顺序：

```text
A1 浏览器集成入口
 → A2 生命周期 → A3 查询/数据边界
 → B1 Web App
 → C1 正文/Reader Core → C2 Web Reader/状态
 → D1 本地 RSS 导入 → D2 网络订阅
 → E1 PWA 离线验收 → F1 MVP 收尾
```

每个任务开始前记录实际改动基线，结束时按顺序执行 typecheck、build，再运行依赖构建产物的测试；避免多个编译进程同时写同一 dist 或 tsbuildinfo。最后执行 git diff --check，并额外检查未跟踪的新文件，因为普通 git diff 不包含它们。

完成报告应包含实际改动范围、验收证据、限制和下一任务。只凭编译成功不能关闭浏览器任务；只凭一个 PASS 不能关闭整个 Phase 1。任务细节随实际发现调整，不以规划替代证据。

## 13. 成熟库优先与自研边界

UniDock 不要求所有基础能力都自行实现。对于已经成熟、维护稳定、许可证适配、平台兼容且能满足需求的现成库，应优先评估并合理复用。

### 13.1 优先复用的基础能力

以下能力原则上优先考虑现成库：

- RSS 2.0、Atom、XML 和 HTML 解析
- URL 解析、日期解析和字符编码处理
- DOM Sanitization
- PWA 构建和 Service Worker 工具链
- 测试运行器、断言库和浏览器自动化
- IndexedDB 兼容层、开发测试适配器
- Markdown、代码高亮和基础文本处理
- 媒体格式解析和播放器基础能力
- 日志、错误上报和开发调试工具

是否采用不能只看“能不能用”，还要检查：

- 维护活跃度和发布质量
- Node、浏览器和 TypeScript ESM 兼容性
- 包体积和运行时开销
- 许可证及分发限制
- 安全历史和供应链风险
- 是否能在 Local First 和离线场景下工作
- 是否会把不必要的平台或框架耦合带入 Core

### 13.2 适合 UniDock 自己定义的部分

以下内容属于产品和应用协议层，不应因为存在类似库就直接交给外部库决定：

- Content、Document、Block 等领域模型
- ContentRepository 和 Storage 的公共契约
- Plugin Context、Capability、Permission 和 Event 协议
- Reader 的内容转换规则和状态归属
- Feed 到 Content 的映射、去重和 ID 策略
- 阅读进度、已读、收藏等用户状态语义
- 插件之间的协作边界
- Local First 的数据生命周期和离线行为
- UniDock 的路由、产品交互和业务验收规则

成熟库可以作为这些协议的实现基础、解析器或适配器，但不能未经分析地替代 UniDock 的领域规则。

### 13.3 采用现成库的决策步骤

当基础功能存在成熟库时，按以下顺序判断：

1. 明确 UniDock 自己需要稳定定义的协议和边界。
2. 搜索并列出满足需求的候选库。
3. 检查维护状态、许可证、安全性、体积和平台兼容性。
4. 用最小 PoC 验证关键输入、输出、错误和离线行为。
5. 通过 Adapter 或 Facade 隔离外部库，避免业务代码到处依赖第三方 API。
6. 记录选择理由、版本和替代方案。
7. 为关键边界补充 UniDock 自己的测试，不把第三方库的测试当作产品验收。

### 13.4 不为复用而复用

以下情况可以保留轻量自研实现：

- 需求很小且实现稳定
- 引入外部库的成本明显高于自研
- 外部库许可证不合适
- 外部库会引入不必要的平台或框架依赖
- 需要的只是 UniDock 内部极小的适配逻辑

但“自研”必须是有意识的工程决策，不能因为没有先搜索成熟方案就默认从零开始。

后续每个涉及基础能力的任务报告中，都应说明：

- 是否检索过成熟库
- 选择复用、适配还是自研
- 选择对包体积、架构边界、维护和测试的影响
