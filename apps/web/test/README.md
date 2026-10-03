# Web App 验收

## 自动检查

在仓库根目录执行：

```bash
corepack pnpm --filter @unidock/web verify
```

该命令会执行：

- Web App TypeScript 构建
- 备份协议测试
- PWA manifest、图标和 Service Worker 缓存清单检查

它不代替真实浏览器验收。

## Chromium 人工验收

先构建所有依赖：

```bash
corepack pnpm build
```

再从仓库根目录启动本机 HTTP 服务：

```bash
python3 -m http.server 4177 --bind 127.0.0.1
```

用 Chromium 打开：

```text
http://127.0.0.1:4177/apps/web/
```

建议使用独立的临时浏览器 Profile，避免污染已有 UniDock 数据。自动 Smoke 不依赖这
个手动服务，而是启动限制静态路径的 Node HTTP 服务，并为 HTTP 和 CDP 分配动态端口。

### 首次在线检查

1. 确认页面显示“在线”和“已连接到本地存储”。
2. 添加一条本地内容，打开 Reader，标记已读和收藏。
3. 刷新页面，确认内容、正文、已读和收藏状态恢复。
4. 导入一个允许 CORS 的 RSS Feed，确认 Feed 列表和文章列表出现。
5. 点击“导出 JSON”，确认下载备份文件。
6. 删除一条本地内容后导入备份，确认内容恢复。
7. 打开 DevTools 的 Application 面板，确认 Manifest 和 Service Worker 已注册。

### 离线冷启动检查

1. 在页面已成功加载后，确认 Service Worker 状态为 activated。
2. 关闭当前页面。
3. 在 DevTools Network 面板启用 Offline。
4. 重新打开 `http://127.0.0.1:4177/apps/web/`。
5. 确认页面可以启动，显示“离线模式”。
6. 确认已保存内容、Reader 正文、已读、收藏和阅读位置仍可恢复。
7. 确认 Feed 输入、导入和刷新按钮处于禁用状态。
8. 恢复网络，确认状态回到“在线”，Feed 操作重新可用。

### 更新检查

修改前端资源、递增 Service Worker 缓存版本后重新构建并打开已有页面，确认：

- 新 Service Worker 被发现。
- 页面出现“发现新版本，点击立即更新”提示。
- 页面重新获得焦点或从后台恢复可见时，会主动检查新版本。
- 新 Service Worker 接管后页面刷新。
- IndexedDB 中已有内容和阅读状态不丢失。

人工检查结果应单独记录为 PASS 或 FAIL；自动命令通过不能替代上述冷启动验证。

## Chromium 自动 Smoke 验收

本仓库提供基于 Playwright 的真实 Chromium acceptance runner，使用独立临时 Profile：

```bash
corepack pnpm --filter @unidock/web test:browser
```

运行前提：

- 本机存在 Chromium，默认路径为 `/opt/homebrew/bin/chromium`，也可以通过 `CHROMIUM_PATH` 指定。
- 根目录已安装 `playwright-core`。

自动用例覆盖：

- Storage 查询边界和生命周期浏览器用例。
- Web App 在线加载、IndexedDB 初始化和本地内容保存。
- Reader 打开、已读和收藏状态保存。
- 页面刷新后内容和阅读状态恢复。
- JSON 备份下载、删除后导入恢复和阅读状态保留。
- 本地 RSS fixture 导入、刷新、订阅移除和已导入文章保留。
- Service Worker 新版本 waiting、用户确认更新、页面刷新和数据保留。
- Playwright `context.setOffline(true)` 下关闭旧页面、创建新页面的离线冷启动、内容恢复和 Feed 操作禁用。

该脚本通过临时静态服务器动态返回新的 Service Worker 缓存版本，不修改仓库中的
`sw.js`。备份文件下载/导入、RSS 真实网络导入和配额异常仍需继续补充；关闭页面后首次
重新打开的冷启动仍建议按人工流程验证。脚本使用独立临时 Profile，不访问已有浏览器
数据，结束后会清理浏览器和临时文件。
