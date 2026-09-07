# FIX-M16.2-CALC

状态：待派发；Astra medium；主 agent 派发、不再委派。Resolved change: fix-blueprint-dlc-calculation。

独占写入：src/store/useBlueprintProductionStore.ts；tests/unit/production/blueprint-dlc-calculation.spec.ts；该 change 的 tasks.md/bugs.md；../results/FIX-M16.2-CALC.md。通用Map/shared、Live、全部E2E/helper/fixture只读。不是唯一编辑人，不撤回别人修改，不删debug、不提交。

读 change 与诊断，按 x4-bug-fix/apply 分阶段。实现已交回主agent认可的最小 Blueprint 统一 modulesMap+计算输入方案，原plannedModules保持；覆盖四个写入口、二次分析、resolved成本/工人/仓储、自动候选、activeDlcs/enforce watcher和多站聚合。不增加额外架构层/fallback链。必须实际追踪所有caller再改，不只掩盖UI产量。

Unit需独立常量expected：0及恢复、原计划未变、真实watcher触发、多站聚合、自动生产者/居住/仓储/码头候选不含禁用项、真实分析器的成本/工人/体积。有限消费者可运行现有phase-boundary、station-derived-map-autofill-dedup、production-dashboard-presenter；不做无依据全Unit扩大。

Unit就绪后交主agent协调build窗口；不擅自browser/build。若一store方案无法闭环，先报告精确新文件/原因，不自动扩成Live/reference重构。恢复条件与未满足验收写报告，原M16.2保持未完成直到实际复验。
