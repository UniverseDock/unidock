# UniDock 项目上下文与 Agent 执行提示词

> 用途：将本文作为 UniDock 项目的长期上下文提示词。新 Agent 开始任务时先读本文，再检查仓库现状；本文是项目方向和约束的整理，不代表文中规划的目录或功能已经全部实现。
>
> 项目：UniDock（UniverseDock）  
> Slogan：**Your Dock to the Universe.**  
> GitHub Organization：`UniverseDock`  
> GitHub Repository：`UniverseDock/unidock`  
> 本地仓库路径因开发环境而异，不要假定固定绝对路径。

---

## 1. 给 Agent 的首要指令

你正在协助开发 UniDock。目标是把项目从基础设施和架构原型，逐步推进到一个 **可用、Local First、PWA 优先的个人内容阅读产品**。

每次开始工作时：

1. 先检查仓库实际文件、`git status`、package scripts 和现有实现。
2. 将“设计目标”“已实现功能”“本次未提交改动”分开判断。不要把本文的目标目录当成仓库现状。
3. 保留用户已有的未提交改动；不要覆盖或清理不属于本次任务的工作。
4. 一次只推进一个可以完成、验证和说明清楚的阶段。
5. 尽量复用现有的 Kernel、Content、Storage、SDK 和 Reader 能力；不要无理由重写架构。
6. 优先把工作做到可运行和可验证，再扩展设计。
7. 不要因为本文件包含路线图，就擅自同时实现多个未来阶段。

本文记录了 2026-10-01 时讨论形成的产品方向和当时检查到的仓库状态。开始后续任务时仍应重新核验实际状态。

---

## 2. 产品定位

UniDock 是：

> **PWA 优先、插件化、Local First 的个人内容与信息工作台。**

核心理念：

> **Connected to the world through a dock.**

UniDock 不只是 RSS 阅读器、IPTV 播放器或书籍阅读器。它的长期方向是把不同来源、不同类型的信息能力汇聚到统一 Dock。

### 第一阶段重点

- Reader：统一阅读体验。
- RSS：第一批内容来源。
- IPTV：RSS/Reader 基础稳定后再进入。

### 远期扩展方向

小说、漫画、视频、音频、PDF、网页收藏、GitHub、YouTube、Bilibili、AI、Automation、Sync 和更多第三方内容源。

这些是产品愿景，不是当前承诺的实现范围。MVP 之前不要为它们提前建立大量空壳或复杂基础设施。

---

## 3. 产品原则与架构边界

### 3.1 Local First

默认数据路径：

```text
Browser → IndexedDB → Storage → Repository → Product features
```

服务器将来主要承担账号、同步、代理、爬取、AI 等可选远端能力。不要让 MVP 的基本阅读流程依赖 API 或云端数据库。

### 3.2 Core 与业务插件解耦

Core 提供通用机制：

- Plugin Runtime 和 Lifecycle
- Capability Registry
- Permission Registry / Enforcement
- EventBus
- Plugin Context
- Storage、Content 等抽象
- UI 扩展能力

Core 不应该直接依赖 RSS、IPTV、Book、Comic、YouTube 或 Bilibili 等具体业务。

推荐交互：

```text
Plugin → PluginContext → Capability / Event → Core 或其他 Plugin
```

插件间通过 Capability、Event、Context 协作，不直接导入彼此的实现。

### 3.3 平台无关

Kernel、Content、Storage 抽象、Reader Core 和 SDK 尽量避免依赖 `window`、`document`、`localStorage`、`indexedDB`、React 或 DOM。

浏览器实现放在具体的 Web App、Web Renderer 或 Storage Adapter 中。IndexedDB Adapter 属于平台适配层，业务代码通过 Storage / Repository 访问数据。

### 3.4 Content 是通用元数据模型

不同来源的内容尽可能落到共用 Content 模型，不要在每个插件里复制一套通用 Content / Storage / Plugin 类型。

Content 是元数据基础。文章正文、阅读文档、Block、阅读进度、收藏和来源抓取状态应在需要时设计清楚归属，不要未经分析把所有业务状态塞入 Content 元数据。

### 3.5 插件是可组合能力

长期方向不是“每个插件都是一个独立完整应用”，而是：

```text
Source Plugin → Capability / Content → Processor 或 Reader → Renderer / Player
```

例如：

```text
RSS Source → Article Content → Reader
Web Page → Article Extractor Capability → Document → Reader
M3U Source → Channel → Player Capability
```

Pipeline、Recipe 和复杂组合属于远期方向，当前先把基础契约做实。

---

## 4. 技术约束与仓库管理

### 4.1 当前技术基线

- Node.js：`>=22`；已知环境为 Node `22.23.2`。
- pnpm：项目锁定 `pnpm@12.8.1`。
- TypeScript：`5.9.x`，仓库声明 `^5.9.2`。
- 当前基础设施以 TypeScript ESM 和 Project References 为主。

当前机器存在旧版独立 pnpm shim，直接调用 `pnpm` 可能触发错误的包管理器下载流程。此环境验证过：

```bash
corepack pnpm --version
# 12.8.1
```

因此在该环境优先使用 `corepack pnpm ...`。不要为绕过启动问题而更改仓库的 `packageManager` 版本。

### 4.2 Workspace 范围

当前 `pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "plugins/*"
```

`services/*` 当前不属于 workspace。不要擅自调整此架构。除非实际产品任务要求，否则不要为了目录看起来齐全就加入新的 workspace 范围。

Root scripts：

```json
{
  "build": "pnpm -r --if-present run build",
  "typecheck": "pnpm -r --if-present run typecheck"
}
```

在当前环境按以下方式执行：

```bash
corepack pnpm typecheck
corepack pnpm build
```

TypeScript 保持 strict。不要通过关闭 `strict`、降低 compiler 检查强度或添加无依据的 `any` 来“修过编译”。

### 4.3 文件修改习惯

用户偏好直接修改完整文件，尽量不要要求用户自己定位某行粘贴代码。新增或重写文件时，提供完整且可 review 的内容。改动后保留用户原有修改，不要擅自 reset、clean 或覆盖。

---

## 5. 当前仓库事实快照

以下是 2026-10-01 对当前 checkout 的实际检查结果；任务开始时须重新检查。

### 5.1 已有目录和代码

当前仓库主要有：

```text
packages/
├── kernel/
├── content/
├── sdk/
└── storage/
```

- `packages/kernel` 有 Capability、Permission、Event、Lifecycle、Plugin、Runtime、Context、Container 等代码。
- `packages/content` 有 Content 模型、Content ID、ContentRepository 接口。
- `packages/sdk` 有 capability、content、permission、plugin 和 storage 类型导出。
- `packages/storage` 有 Storage 抽象和 IndexedDB Adapter。

### 5.2 近期本地实现

近期补充了以下 Storage 数据链路：

```text
IndexedDBAdapter → IndexedDBStorage → StorageCollection
                                      ↓
                          StorageContentRepository → Content
```

当前 IndexedDB 实现使用一个 `records` object store，以 `[collection, id]` 作为复合主键，用 collection 索引区分集合。Storage 暴露通用 collection CRUD、list/filter/pagination 和 clear 能力。Content Repository 通过 Storage API 操作 `contents` 集合。

此实现已经通过当时运行的：

```bash
corepack pnpm typecheck
corepack pnpm build
```

Node 运行环境未提供原生 IndexedDB，且当前 checkout 没有 Web App，因此当时没有完成浏览器 IndexedDB 的实际运行验证。后续需要在浏览器环境验证跨连接持久化、集合隔离、查询行为和数据库升级策略。

近期这些 Storage 相关文件曾处于本地未提交状态。任何后续 Agent 都必须先看 `git status`，不要默认它们已提交或擅自清理。

### 5.3 当前缺失的重要功能

在上述实际 checkout 中没有发现：

- `apps/web`
- `packages/reader` 或 `packages/reader-web`
- `plugins/rss`
- `plugins/iptv`
- `services/*`
- 阅读器 UI、PWA App Shell、RSS 抓取或 IPTV 播放实现

早期架构设想或其他环境中的项目说明提到过这些模块，但**当前 checkout 不含这些目录**。不要把文档里描述的功能说成已实现，也不要直接假定可以在现成 Reader 或 Web App 上继续开发。

---

## 6. 核心数据和接口方向

### 6.1 Content

现有 Content 核心字段方向：

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

已有类型包括 `book`、`article`、`rss`、`live`、`video`、`audio`、`comic`、`document`。扩展时先核对实际模型和已有用法。

Content Repository 目标契约：

```ts
interface ContentRepository {
  get(id: string): Promise<Content | undefined>;
  save(content: Content): Promise<void>;
  delete(id: string): Promise<void>;
  list(query?: ContentQuery): Promise<Content[]>;
}
```

### 6.2 Storage

平台无关的 Storage 抽象应承担集合数据访问。业务层不直接调用 IndexedDB。

后续关注：

- 浏览器环境缺少 IndexedDB 时的明确错误行为。
- 数据库 schema 版本升级和连接关闭。
- 列表筛选/分页的准确语义与可扩展性。
- Repository 的数据类型边界和持久化校验。
- 浏览器实际运行验证及持久化重开验证。

不要在 MVP 里先引入复杂事务/迁移框架，除非明确需求要求。

### 6.3 Reader 数据方向（目标，当前未实现）

Reader 目标数据流：

```text
Content → Document → Block[] → Layout → Page[] → Renderer
```

目标 Block 类型包含 paragraph、heading、image、quote、code、video、audio、divider、list 等。Reader Core 不依赖 DOM，Web DOM 逻辑放在 Web Renderer / App 层。

之前设计中曾规划轻量 HTML Parser 和估算型 Layout；如果未来建立 Reader，应把它们视为 MVP 实现，不能称为生产级 Parser 或真实排版。

### 6.4 Plugin、Permission 和 Event

插件生命周期目标：

```text
discovered → downloaded → verified → installed → enabled → activated → running
    → deactivated → disabled → uninstalled
```

当前已有生命周期管理基础，但权限 Enforcement 尚未完整。未来 Sandbox Plugin 必须由 Runtime 真正执行 Permission，而不只是 Manifest 中声明权限。不要现在提前实现完整 Marketplace 或复杂权限 UI。

---

## 7. 建议路线图与阶段验收

阶段顺序围绕“第一个本地可用内容阅读闭环”，而不是一次实现整个平台。

### Phase 1：Storage 和本地 Content（当前阶段）

目标：稳定 `IndexedDB → Storage → ContentRepository → Content`。

待核对/完成事项：

1. 在真实浏览器中验证数据库首次创建、collection CRUD 和多集合隔离。
2. 关闭并重新打开数据库后确认数据仍存在。
3. 检查筛选、分页、空结果和错误路径。
4. 明确数据库初始化/版本升级行为。
5. 若开始服务于 UI，再让 Web App 在启动时初始化 Adapter/Repository；不要将 IndexedDB 逻辑放入 Core 或 Content。

验收条件：浏览器中可以持久化读写 Content，刷新或离线重开后仍可读取；业务层只通过 Repository/Storage 接口访问。

### Phase 2：建立最小 Web App 和 Reader 数据链路（当前 checkout 缺失）

先建立能承载功能的最小应用结构和 Reader 基础，不要假定旧的 `demoDocument` 或 UI 已存在。

需要实现：

- App 启动时注入 IndexedDB Storage 与 ContentRepository。
- 将保存的 Content 转换为 Reader 使用的 Document/Block。
- 打开文章、阅读、持久化阅读进度。
- 逐步加入已读与收藏状态。
- 将 DOM 和 UI 留在 Web 层，Reader Core 保持平台无关。

验收条件：本地 Content 可以在 Reader 打开，阅读状态能够保存并恢复。

### Phase 3：RSS Plugin

建立 `plugins/rss/`，第一版支持 RSS 2.0 和 Atom。建议的最小链路：

```text
Feed URL → Fetcher → Parser → Feed/Article → Content → ContentRepository → Reader
```

至少处理标题、链接、摘要/正文、作者、发布时间、guid、图片和分类，并考虑 CDATA、HTML、相对 URL、重复文章、时间解析和编码。

RSS 摘要并不总是完整正文。未来正文提取应作为独立 `article.extract` Capability，不要把 HTML 清理或正文抽取写死进 RSS Plugin。

验收条件：添加 Feed 后能导入文章，文章可保存、打开和离线阅读。

### Phase 4：IPTV

RSS/Reader 基础稳定后再建立 `plugins/iptv/`：

```text
M3U → Parser → Channel → Channel List → Player Capability
```

先做 M3U 和基本频道列表，再做 EPG、节目单、收藏和历史。播放器应通过 Capability 使用，不让 IPTV 插件绑定具体播放器实现。

### 暂缓事项

在本地阅读 MVP 闭环完成前，不优先做：

- Marketplace / Plugin Store
- 用户体系、社交、推荐算法
- 云端数据库、多设备 Sync
- AI Agent、Automation
- 复杂权限 UI
- 完整 EPG
- 复杂主题和国际化系统
- 大量尚无需求的插件空壳

---

## 8. 每个任务的工作流程

开始前：

```bash
git status --short
rg --files
```

先读取相关 package 的 `package.json`、tsconfig、当前实现和必要文档。不要假设依赖安装状态或源文件已经存在。

实现时：

1. 明确本次目标属于哪一个阶段。
2. 先复用现有契约；确需改变架构时，先说明技术原因和影响。
3. 把平台相关依赖留在适配层。
4. 不关闭 strict，不进行无关重构。
5. 保留用户未提交工作；不要执行会丢失改动的 Git 清理/重置操作。

完成时：

```bash
corepack pnpm typecheck
corepack pnpm build
git diff --check
```

有 Web App 时，按任务需要启动并用 HTTP 请求验证入口、静态资源、manifest 和 service worker。涉及浏览器能力时，优先做真实浏览器检查；不能运行时明确说出限制，不要用“代码看起来没问题”替代验证。

每阶段报告：

- 修改了什么及其目的。
- 实际执行了哪些验证和结果。
- 尚未验证的部分和限制。
- 当前阶段是否完成，以及下一步建议。

不要把未完成的目标描述为已实现。

---

## 9. 产品最终闭环

第一阶段的目标不是实现完整 UniverseDock，而是做到：

```text
用户添加 RSS
      ↓
抓取 Feed 并解析文章
      ↓
文章写入 ContentRepository
      ↓
数据保存到 IndexedDB
      ↓
用户在 Reader 阅读并记录进度/收藏/已读
      ↓
刷新、离线或重开后继续阅读
```

只有这条 Local First 阅读闭环跑通后，再扩展 IPTV、Sync、Marketplace、AI 和其他内容源。
