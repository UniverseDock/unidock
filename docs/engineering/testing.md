# Testing

## 测试层次

```text
Node Unit / Contract
  → 模型、Parser、Repository 契约、备份校验

Real Chromium / Playwright
  → Web App、Reader、RSS、备份恢复的完整流程
```

Node fake 不能证明真实 IndexedDB 行为；静态 PWA 检查不能替代 Service Worker 生命周期验收。

## 必须覆盖的边界

- Storage 查询顺序和分页。
- close、destroy、blocked、versionchange 和错误分类。
- 配额、请求和事务失败。
- Document 版本不兼容。
- 跨 collection 的部分写入。
- 离线冷启动和更新接管。
- 恶意 URL、危险协议和未知 Block。

## 架构测试

当前可先用 package 依赖检查和 TypeScript project references 保持 DAG。只有出现实际循环风险时再引入专门的架构测试工具，不为工具本身增加复杂度。

## 真实 Chromium 验收

`apps/web/test/playwright-acceptance.mjs` 使用 Playwright、独立临时 Profile 和本机 HTTP 服务，覆盖：

- IndexedDB 初始化、Storage 查询边界和生命周期。
- Web App 本地内容写入、Reader 状态保存与刷新恢复。
- RSS 导入、刷新和订阅移除。
- Backup 下载、删除、导入和状态恢复。
- Service Worker 更新、跨标签页协调和离线冷启动。

入口：

```bash
corepack pnpm --filter @unidock/web test:browser
```
