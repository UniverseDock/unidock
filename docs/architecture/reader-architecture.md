# Reader Architecture

## 1. 目标分层

```text
Source / Parser
  → Content
  → Document Builder
  → ReaderDocument / Block
  → Layout (future)
  → Renderer
  → Web DOM / other platform
```

## 2. 当前实现

- `plugins/rss` 将 Feed 内容转换为 Article Content 和 Reader Document。
- `packages/reader` 定义 Document、Block、Document Repository 和 ReadingState。
- `apps/web` 负责 DOM 渲染、滚动位置保存和用户交互。
- 当前 Block 渲染使用安全的 DOM API 和 `textContent`，不直接把远端 HTML 写入 `innerHTML`。

状态：**Reader Core 已实现；Web Renderer 部分实现；Layout/Page 尚未实现。**

## 3. Parser、Builder、Layout、Renderer 的职责

- **Parser**：解析输入格式，不决定用户状态和 UI。
- **Document Builder**：把来源数据映射为 UniDock Document/Block。
- **LayoutEngine**：未来负责尺寸、分页、目录或阅读视图计算；不应修改领域数据。
- **Renderer**：把 Block 或 Layout 输出到具体平台；不得反向写入 Repository。
- **Reader State**：保存用户状态，不和 Document 内容混合。

## 4. Block 约束

Block 必须：

- 有稳定 ID。
- 有可判别的 `type`。
- 具有明确的字段校验。
- 能被未知类型安全跳过或显示占位。
- 不携带任意 HTML/脚本。

当前 `block:1` 这类按位置生成的 ID 对静态 Document 足够，但如果正文会增量更新或同步，必须改为基于语义/来源标识的稳定 Block ID，否则阅读位置可能漂移。

## 5. Reader State

当前位置是 `blockId + offset`，比裸像素更稳定，但恢复时还需要核对 Document version 和 Block 是否仍存在。

短期应保持：

- Document 更新不覆盖 `read` 和 `starred`。
- 找不到旧 Block 时回退到文章开头或最近可用位置。
- 保存位置应节流，并在页面离开时尽力保存。

未来需要同步时，再区分全局 UserState、设备位置和 SessionState。

## 6. 不提前创建 `reader-web`

当前只有一个 Web Renderer，继续放在 `apps/web` 更简单。只有出现第二个消费者或需要独立发布/测试时，才抽出 `packages/reader-web`。

