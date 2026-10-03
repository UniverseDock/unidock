# Release Environment Checklist

## Purpose

自动化验收负责证明稳定、可重复的代码行为；本清单负责记录不同浏览器、安装形态和真实用户环境中的辅助证据。人工检查不能替代 `corepack pnpm acceptance`。

当前状态：**真实环境检查暂缓，未执行，不阻塞当前 MVP 自动化基线。** 重新启动前应先确认目标浏览器、安装形态和测试数据隔离方案。

真实环境检查重新启用后，每次发布候选版本至少记录：

- 日期和浏览器版本。
- 操作系统和安装形态。
- 检查结果：`PASS`、`FAIL` 或 `BLOCKED`。
- 失败现象、控制台错误和复现步骤。

## Automated baseline

在开始人工检查前运行：

```bash
corepack pnpm acceptance
```

必须确认：

- workspace build 和 typecheck 通过。
- Node 测试全部通过。
- Playwright 场景全部通过。
- 工作区没有意外的构建缓存改动。

## PWA installation and restart

在支持安装的 Chromium 环境中：

1. 通过安全上下文打开应用。
2. 安装为桌面 PWA。
3. 关闭浏览器窗口和独立 PWA 窗口。
4. 重新启动 PWA。
5. 确认本地内容、已读、收藏和阅读位置仍然存在。
6. 发布新 App Shell 后确认页面显示更新提示。
7. 点击“立即更新”，确认当前页面刷新且数据不丢失。
8. 同时打开两个标签页，确认另一个标签页得到刷新提示。

## Cross-browser checks

至少检查当前产品声明支持的浏览器：

- Chromium：安装、更新、离线冷启动。
- Safari：IndexedDB、Service Worker、刷新恢复和基础 Reader。
- Firefox：IndexedDB、Service Worker、刷新恢复和基础 Reader。

如果某浏览器不支持安装或 Service Worker 行为不同，应记录为环境限制，不要把它归为业务数据损坏。

## Storage and recovery

使用独立测试数据验证：

- 浏览器重启后 IndexedDB 数据仍可读取。
- 清除 Cache Storage 后，应用能重新获取 App Shell。
- 清除 IndexedDB 后，页面显示空状态而不是白屏。
- 模拟或接近配额限制时，用户能看到空间不足提示。
- Storage 打开失败时可以点击“重试连接”。
- 导出 JSON 后清理本地数据，再导入可以恢复内容和阅读状态。

不要用真实用户数据做破坏性清理测试。

## Feed and network

使用允许跨域的真实 Feed 或团队测试 Feed：

- 首次导入成功并显示结果统计。
- 重复刷新显示新增、更新和未变化数量。
- 网络失败时订阅保留，显示失败状态并可重试。
- 移除订阅后，已导入文章仍然保留。
- 离线时 Feed 操作被禁用，已保存内容仍可阅读。
- 不把“公共 Feed 可访问”扩展解释为“任意 Feed 地址都可用”。

## Accessibility and responsive review

- 仅使用键盘可以完成搜索、筛选、打开文章、标记状态和返回。
- 焦点不会因为列表刷新而丢失到不可见区域。
- 小屏下内容、Feed 和 Reader 操作不会横向溢出。
- 标题层级、状态提示和错误提示对辅助技术可读。
- 图片存在替代文本，危险 URL 不被直接执行。

## Evidence and follow-up

将失败项记录在发布任务或版本记录中，并区分：

- 代码缺陷：应回到实现和自动化测试。
- 浏览器差异：补兼容性说明或最小适配。
- 外部服务限制：记录 CORS、配额或安装环境限制。

在没有真实需求或失败证据前，不因环境检查结果引入 SQLite/WASM、CRDT、同步协议或远程插件平台。
