# BUG-001

状态：Verified。

M10.1 34 passed / 1 failed，复现、原期望、actual filter-chip-idle 和 trace 见 docs/plan/unified-test-repair/direct-migration/results/M10.1.md。依据 archived 2026-03-09-ship-build-panel-ship/request.md 最终决策 1、2。不能把当前 v-if 重置行为视为已接受替代。

恢复条件：真实同船级取消保留筛选，跨级取消/确认/载入对照保持；build 后 M10.1 原失败及完整35通过。

2026-09-07 apply：实际 mounted View/Selector 的 focused Unit RED 1 failed / 3 passed，GREEN 4 passed。日志 `/tmp/x4-migration-FIX-M10.1/unit-red.log`、`unit-green.log`。已完成实现，等待协调 build 与独立 E2E；BUG 状态保留 Confirmed。

追加同船蓝图加载生命周期修正：补测 RED 1 failed / 4 passed，最终 GREEN 5 passed（覆盖同份重载、无效加载、普通装备编辑、unmount 订阅清理），日志见 unit-same-ship-red.log 与最终 unit-green.log。状态仍 Confirmed，待 build/E2E。

后续独立验证完成：统一 build exit0，`/tmp/x4-migration-FIX-M16.2-CALC/build.log`。原同级失败精确1/1；初次full34/35仅旧DOMcount0失败，经主agent授权迁移toBeHidden且保留全部业务oracle，该项精确1/1，最终完整35/35、0 skipped、exit0（45.0s）。日志 `/tmp/x4-migration-M10.1/post-fix/{precise,full,consumer-precise,final}.log`，旧red全部保留。BUG-001 Verified。
