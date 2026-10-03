# Storage 查询边界验证

从仓库根目录执行：

```sh
corepack pnpm typecheck
corepack pnpm build
python3 -m http.server 4176 --bind 127.0.0.1 --directory packages/storage
```

用 Chromium 打开：

http://127.0.0.1:4176/test/storage-query-boundary-browser.html

页面最终显示 `result: PASS` 才算通过。验证内容包括空 ID、Unicode ID、包含 U+FFFF 的 ID、同前缀集合、数组字段匹配、按 ID 升序的分页顺序、零/负边界和 clear 集合隔离。

Storage 当前契约规定 `list()` 在过滤后按记录 `id` 升序返回；这只是稳定的默认顺序，不代表产品时间线或相关性排序。产品需要其他排序时，应在 Storage/Repository 契约中单独增加排序字段和语义。

页面不会自动删除随机数据库，失败时可用浏览器开发者工具检查，测试库名称以 `unidock-storage-query-` 开头。
