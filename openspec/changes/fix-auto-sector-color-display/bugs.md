# BUG-001

状态：Confirmed。M3.2颜色两个失败：透明后draft/saved/reload均#00000000、边框solid；coverage fill/sector宽度比1。当前color/spec与one-map/tasks:53没有替代条款，期望undefined和2/3。

证据：direct-migration/results/M3.2.md的full trace；非透明独立保存case已通过。恢复需要Unit/build、两项严格E2E和当前13完整事务，不能改期望迎合实现。

T1独立实施与Unit证据：真实SketchPicker透明click无data-color、model输出#00000000；局部presenter复用vue-color.tinycolor清空alpha0、保留非零alpha、拒绝非法值，移除第二事件入口；coverage fill使用同心sector半径2/3，零坐标不fallback，无色不画。修复前focused 6fail/3pass exit1，后同focused9pass exit0；最终卡片/list/layer有限消费者4files/17pass exit0。日志/tmp/x4-migration-FIX-M3.2/{red,green,consumers}.log。状态仍Confirmed，build与严格E2E未执行，不能标Verified或关闭M3.2-UI。
