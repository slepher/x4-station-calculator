# BUG-001：站点 DLC 翻译标签与禁用数量输入

状态：Verified。

本轮复现见 docs/plan/unified-test-repair/direct-migration/results/M16.2.md：48 passed / 3 failed，其中两个失败分别为可见 DLC 而非人类的摇篮，inactive 行的 input enabled。现有标签翻译和 inactiveByDlc 上游传值正确，错误位于 Item 消费。UI 对照确认 base 无标签、删除可用。

验收：两项失败复验通过，focused Unit 红绿、build；M16.2 剩余计算失败不能标通过。

2026-09-07 apply：mounted Unit 有效 RED 为 2 failed / 4 passed（标签 DLC、input 未禁用），GREEN 为 6 passed；日志位于 /tmp/x4-migration-FIX-M16.2-UI/unit-red-mounted.log 与 unit-green.log。实现已完成，状态仍为 Confirmed，等待协调构建及独立 E2E，尚不声称验收完成。

2026-09-07 后续验证完成：统一 `npm run build` exit 0，`/tmp/x4-migration-FIX-M16.2-CALC/build.log`；独立 E2E 原三失败精确 3/3，完整51/51、0 skipped、exit 0，日志 `/tmp/x4-migration-M16.2/post-fix/{precise,full}.log`。Unit/build/E2E 满足本 UI 范围，BUG-001 Verified。
