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

建议使用独立的临时浏览器 Profile，避免污染已有 UniDock 数据。

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

修改前端资源后重新构建并刷新页面，确认：

- 新 Service Worker 被发现。
- 页面出现“发现新版本，刷新页面后生效”提示。
- 新 Service Worker 接管后页面刷新。
- IndexedDB 中已有内容和阅读状态不丢失。

人工检查结果应单独记录为 PASS 或 FAIL；自动命令通过不能替代上述冷启动验证。
