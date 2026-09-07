# BUG-001

状态：Confirmed。

M3.1当前15项14pass/1fail；非玩家大交易所I创建hub但selectedTradeStation undefined，virtual UI未选中；未修改生产计划/archive对照通过。trace和调用链见direct-migration/results/M3.1.md。当前core spec387–391明确默认virtual，无替代规范。

恢复条件：Unit红绿、build，原失败以及当前15项复验；M3.1其余补充合同仍待执行，不因这项修复就标整个core完成。

本轮apply：实际presenter入口Unit RED2failed/1passed，GREEN3passed；有限消费者2files/3passed。日志 `/tmp/x4-migration-FIX-M3.1/`。仅known-empty分支修复，build/E2E尚未执行，BUG保持Confirmed。

后续独立canonical Unit168files/950tests全部通过；协调独占build exit0（Vite8.82s），日志combined-unit-final.log与build.log。构建窗口已释放，E2E由主agent派发，BUG仍Confirmed。

后续独立E2E复验：fresh dist 下，冻结原 M3.1 非玩家 hub 单项 1/1 pass（exit0，5.7s），当前完整15项 15/15 pass（exit0，1.4m）。日志 `/tmp/x4-migration-M3.1/post-fix-single.log`、`post-fix-full.log`，trace 各自同名目录。测试未修改，默认virtual UI/selectedTradeStation及生产draft/archive隔离同时通过。BUG保留待主agent/用户确认；不关闭尚待执行的GRAPH/DRAFT等扩展验收。
