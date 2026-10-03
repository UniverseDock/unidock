# Security

## 当前已做

- Reader DOM 渲染不直接插入远端 HTML。
- 备份导入进行结构、引用、Block 和 HTTP(S) URL 校验。
- Feed 和图片 URL 不接受任意危险协议。
- Service Worker 只缓存同源成功响应。

## 当前边界

浏览器直连 Feed 受 CORS 限制；不能通过 UI 设计绕过浏览器安全策略。远端图片和网络正文不保证离线。

## Plugin 安全

当前 Kernel Permission/Capability 不能作为隔离边界。禁止加载用户下载的远程插件，直到完成隔离执行、权限包装、来源校验、存储命名空间和审计。

## 后续检查

- 新增 HTML 内容必须经过安全转换。
- 外部 URL 只允许明确协议和范围。
- 不把原始 `indexedDB`、`fetch`、DOM 或 Repository 传给不可信代码。
- 备份导入必须先完整解析验证，再写入。

