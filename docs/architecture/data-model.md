# Data Model

## 1. 当前关系

```text
Content
  id
  metadata
  sourceId
      │
      ├── ReaderDocument
      │     id = document:<contentId>
      │     version
      │     blocks
      │
      └── ReadingState
            contentId
            documentId
            documentVersion
            read / starred / position
```

当前实现使用 IndexedDB 的逻辑 collection：

- `contents`
- `reader-documents`
- `reader-state`
- `feed-subscriptions`

## 2. Content 边界

Content 适合保存：

- 内容身份和类型
- 标题、作者、标签、封面引用
- 来源标识
- 创建和更新相关元数据

Content 不应保存：

- 正文 Block
- 已读、收藏、阅读位置
- 原始 RSS XML
- 抓取重试队列
- 二进制 Blob

## 3. ID 规则

当前存在三种 ID 来源：

- 本地创建：`crypto.randomUUID()`
- RSS 导入：由稳定的 Feed item 标识生成
- 派生对象：`document:<contentId>`、`feed:<url>`

这套策略目前可用，但需要明确记录为 contract：

1. 本地生成 ID 必须唯一且不可变。
2. 外部来源 ID 必须经过来源命名空间隔离，不能假设不同来源的 `guid` 全局唯一。
3. 派生 ID 的格式一旦进入备份或同步协议，不得无迁移地修改。
4. ID 不承载显示名称、时间或可变属性。

## 4. 时间规则

当前 `createdAt` 和 `updatedAt` 既表示本地写入时间，也被 RSS 用作来源发布时间，语义存在问题。

后续建议区分：

- `publishedAt`：来源内容发布时间，可未知。
- `createdAt`：本地首次建立记录的时间。
- `updatedAt`：本地记录最后修改时间。
- `fetchedAt`：最近一次从来源获取的时间。

现在不必立即修改所有模型；在进入同步、排序或增量刷新前必须完成语义统一。

## 5. URL、错误和配置

- 外部 URL 必须解析并限制协议；当前备份和图片校验已经限制为 HTTP(S)。
- URL 的规范化策略应在 Feed 边界统一，不应由每个 UI 事件自行处理。
- 当前错误主要是普通 `Error` 和用户可见字符串；进入多模块编排前应增加稳定错误分类，例如 `validation`、`network`、`storage`、`quota`、`conflict`。
- 配置应区分应用配置、设备配置和插件配置，不能把任意对象直接作为全局设置。

## 6. 版本

以下版本都必须独立管理：

- IndexedDB physical schema version
- Domain record schema version
- Reader Document version
- Backup format version
- Plugin API version

版本不兼容时应经过 `decode → migrate → validate`，不能仅依赖强制类型转换或直接拒绝全部旧数据。

