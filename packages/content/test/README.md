# ContentRepository 真实浏览器集成验证

这是人工浏览器验收，不是自动化测试通过命令。先从仓库根目录运行：

```sh
corepack pnpm typecheck
corepack pnpm build
corepack pnpm --filter @unidock/content test
corepack pnpm --filter @unidock/storage test
python3 -m http.server 4174 --bind 127.0.0.1 --directory packages
```

用 Chromium 打开：

http://127.0.0.1:4174/content/test/content-repository-browser.html

只有最终出现 `result: PASS` 才代表整页验证成功。中间的 PASS 只是部分用例通过；FAIL、超时、空白或停留在 starting 均不能验收。页面使用真实时间，不使用 headless 虚拟时间预算。

每次运行使用独立随机测试数据库，正常结束或执行异常后关闭连接并删除该数据库，不操作应用的 `unidock` 数据库。浏览器崩溃或打开请求永久挂起可能遗留以 `unidock-content-browser-test-` 开头的测试库，可在开发者工具中识别后手工清理。刷新会重新运行全部测试。

验证范围：完整元数据往返、相同 ID 更新不重复、组合筛选、交错数据的非零 offset 分页、零 limit、缺少/空 tags、删除、多集合同 ID 隔离、clear 隔离、同页面关闭连接后重开。

分页目前按 IndexedDB 主键字符串顺序断言，这是对当前实现的回归，不是新增业务排序承诺。本页不验证页面刷新恢复、浏览器重启、离线冷启动或 schema 升级。
