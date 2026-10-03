# IPTV Architecture

## Status

状态：**设计中，尚未接入产品运行时。**

当前仓库没有 `plugins/iptv`，也没有播放器实现、M3U 解析器或 Player Runtime。本文定义下一阶段的稳定边界，不代表功能已经实现。

## 1. 第一阶段目标

第一阶段只建立可验证的频道目录闭环：

```text
M3U / M3U8 text
  → Playlist Parser
  → Channel[]
  → Channel List
  → Player Capability contract
```

第一阶段不承诺播放成功，不引入账号、EPG、云端同步或远程插件。

## 2. 领域边界

### Channel

Channel 是可被用户发现和选择的频道元数据：

- 稳定的 `id`
- `name`
- 可选 `group`
- `streamUrl`
- 可选 `logo`
- 可选 `language`
- 可选 `country`
- 来源 Playlist ID

Channel 不保存：

- 播放器实例
- 播放器 DOM
- 当前播放进度
- EPG 节目单
- 网络探测结果
- 任意未校验的 HTML 或脚本

### Playlist

Playlist 表示用户导入的一份 M3U 来源及其解析结果元数据：

- 稳定的 Playlist ID
- 来源 URL 或用户导入标识
- 显示名称
- 最近导入时间
- 最近导入错误

第一阶段可以只支持本地文本和允许 CORS 的 URL；不能宣称任意远程 Playlist 都可读取。

### Player Capability

播放器不是 IPTV Parser 的依赖实现，而是宿主提供的能力契约：

```text
play(channel)
stop()
getState()
```

最小能力输入只包含经过校验的 `streamUrl` 和 Channel 元数据。Player Capability 负责：

- 格式支持判断
- 播放、停止和错误反馈
- 播放器生命周期
- 平台差异

IPTV Parser 不负责创建 `<video>`、调用第三方播放器或操作 DOM。

## 3. 推荐模型

初始领域模型可以保持独立于现有 `Content`：

```ts
interface Channel {
  id: string;
  playlistId: string;
  name: string;
  group?: string;
  streamUrl: string;
  logo?: string;
  language?: string;
  country?: string;
}

interface Playlist {
  id: string;
  name: string;
  source?: string;
  updatedAt: number;
}
```

是否把 Channel 映射为 `ContentType = "live"`，要等以下问题明确后再决定：

- Channel 是否需要 ReaderDocument。
- 播放状态是否复用 ReadingState。
- 播放地址是否可变以及是否需要来源版本。
- 同一频道在不同 Playlist 中是否应合并。

在这些问题明确前，不修改现有 `Content` 接口，不把播放器状态塞进 `ReadingState`。

## 4. ID 和 URL 规则

- Playlist ID 必须隔离来源命名空间。
- Channel ID 优先使用 Playlist ID + 稳定频道标识；不能只使用频道名称。
- 缺少稳定频道标识时，可以使用规范化 URL 派生 ID，但必须记录碰撞和变更风险。
- `streamUrl` 只允许 `http:`、`https:`；是否允许 `rtmp:`、`udp:`、`file:` 必须由明确的平台能力决定，不能默认放开。
- logo URL 使用与 Backup/Reader 图片相同的 HTTP(S) 校验规则。

## 5. 第一阶段验收

在实现 `plugins/iptv` 前，至少需要：

1. RSS/Reader 现有自动化基线继续通过。
2. M3U fixture 可以解析为稳定 Channel 列表。
3. 空行、注释、缺少名称、缺少 URL 和重复频道有明确处理。
4. 危险 URL 被拒绝，不进入 Channel。
5. 相同输入重复解析结果稳定。
6. 不同 Playlist 的相同频道不会无意覆盖。
7. 解析器 Node 测试不依赖浏览器或播放器。
8. Web 层只在 Player Capability 存在时展示播放操作。

## 6. 暂不实现

- EPG、节目单和时间轴。
- 播放历史、续播位置和跨设备状态。
- 多播放器自动选择。
- 远程 Playlist 代理。
- 第三方动态插件和 Marketplace。
- WebRTC、WebGPU、转码和媒体服务。
- 将 IPTV 强行接入 Kernel Plugin Runtime。

## 7. 进入实现的条件

只有在产品明确需要 IPTV，且以下条件满足后，才创建 `plugins/iptv`：

- M3U 输入来源和支持格式已确定。
- Channel 与 Content 的关系已确定。
- Player Capability 的宿主边界已确定。
- URL 协议、CORS 和安全策略已确定。
- 至少准备一组本地 fixture 和真实浏览器验收方案。

