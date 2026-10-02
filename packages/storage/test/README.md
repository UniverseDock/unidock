# Storage 生命周期和错误路径验证

从仓库根目录执行：

```sh
corepack pnpm typecheck
corepack pnpm build
corepack pnpm --filter @unidock/storage test
python3 -m http.server 4175 --bind 127.0.0.1 --directory packages/storage
```

用 Chromium 打开：

http://127.0.0.1:4175/test/storage-lifecycle-browser.html

页面最终显示 `result: PASS` 才算通过。验证内容包括空 Collection 名称、正常写入、close 幂等、关闭后访问失败、destroy 幂等、关闭重开持久化和 versionchange 自动关闭旧连接。

每次运行使用随机数据库名；验证页不会删除数据库，便于在失败后使用浏览器开发者工具检查。测试数据库名称以 `unidock-storage-lifecycle-` 开头，不要用于应用数据。

本页面是人工 Chromium 验证，不把 headless `--dump-dom` 的进程退出状态当成成功。
