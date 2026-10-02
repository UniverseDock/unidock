# Storage 查询边界验证

从仓库根目录执行：

```sh
corepack pnpm typecheck
corepack pnpm build
python3 -m http.server 4176 --bind 127.0.0.1 --directory packages/storage
```

用 Chromium 打开：

http://127.0.0.1:4176/test/storage-query-boundary-browser.html

页面最终显示 `result: PASS` 才算通过。验证内容包括空 ID、Unicode ID、包含 U+FFFF 的 ID、同前缀集合、数组字段匹配、分页顺序、零/负边界和 clear 集合隔离。

当前分页断言记录 IndexedDB 当前主键/index 顺序，不能作为未来产品排序契约。产品需要稳定排序时，应在 Storage/Repository 契约中单独增加排序字段和语义。

页面不会自动删除随机数据库，失败时可用浏览器开发者工具检查，测试库名称以 `unidock-storage-query-` 开头。
