# PWA Engineering

## 当前实现

- Manifest、图标和 Service Worker 已存在。
- App Shell 预缓存，导航失败回退到 `index.html`。
- 业务数据仍在 IndexedDB。
- 新 Worker 由用户点击“立即更新”后 `skipWaiting`，再受控刷新。

状态：**基础能力已实现；更新发布和真实浏览器验收部分实现。**

## 约束

- 不把 Cache Storage 当作业务数据源。
- 不宣称远端 Feed、图片或任意网络内容可离线。
- Service Worker 更新不能丢失 IndexedDB。
- 资源清单和缓存版本必须由构建流程可验证。
- 更新失败时旧版本仍应可启动。

## 待处理

当前 `CACHE_NAME` 和固定资源路径仍有手工维护风险。后续应在不改变领域层的前提下，引入构建期版本/资源清单生成、主动更新检查和多标签页协调。

