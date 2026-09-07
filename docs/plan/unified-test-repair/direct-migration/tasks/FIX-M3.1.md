# FIX-M3.1

状态：待派发。Astra medium，主agent分配，不再委派。Resolved change: fix-auto-sector-empty-trade-default。

独占写入：src/components/empire/presenters/useAutoSectorGroupPresenter.ts；tests/unit/current/auto-sector-group/autoSectorEmptyTradeDefault.spec.ts；该change的tasks.md/bugs.md；../results/FIX-M3.1.md。其他src、E2E、helper、fixture只读，不撤回他人修改、不删除debug、不提交。

读change和M3.1复现/调用链；按x4-bug-fix/apply分阶段。修applyTradeStationDefaultsToResult已知空候选分支，保留已有/retained选择，追所有caller。不重构评分器，不在Vue新增逻辑、不引入fallback链/适配层。Unit需实际presenter入口与独立expected，不能把整个presenter mock后验证另一个假的同名函数。

Unit红绿就绪交主agent协调build，不自开browser/build。原失败和15项由独立测试阶段复验；graph/draft/trade-drag补充验收不因此关闭。真阻碍需已尝试方案、确定原因、未满足项与恢复条件；不要为一个mock harness无限重复同路径。
