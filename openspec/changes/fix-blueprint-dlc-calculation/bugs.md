# BUG-001

状态：Verified。

当前 E2E 实际 domain 和 UI 都为 3000，期望0；关闭政策恢复对照可执行。复现日志与trace见 direct-migration/results/M16.2.md，调用链诊断见 results/FIX-M16.2-diagnosis.md。

恢复条件：统一输入、自动候选、全站聚合和 watcher 的 Unit 红绿，build，M16.2 原生产失败与完整51复验。Live扩展及批量数量操作旁路保持明确未验证边界，不因此声称全产品DLC政策完成。

2026-09-07 apply：有效 RED 3 failed，最终 GREEN 4 passed，有限消费者 3 files / 9 passed；日志 `/tmp/x4-migration-FIX-M16.2-CALC/`。仅 Blueprint store 改动，未改通用Map/shared/Live。T1完成，build/E2E待协调，状态仍 Confirmed。

2026-09-07 后续验证完成：统一 `npm run build` exit 0，`/tmp/x4-migration-FIX-M16.2-CALC/build.log`；独立 E2E 原三失败精确3/3、完整51/51、0 skipped、exit 0，日志 `/tmp/x4-migration-M16.2/post-fix/{precise,full}.log`。本 Blueprint 范围 BUG-001 Verified；Live/archive 和批量数量旁路仍不在此结论内。
