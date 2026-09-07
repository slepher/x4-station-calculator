# FIX-M3.1

Resolved change: fix-auto-sector-empty-trade-default。T1/T2完成，focused3/3、消费者3/3、canonical950/950、build exit0；BUG-001 Confirmed，待E2E。

唯一源码改动：useAutoSectorGroupPresenter的applyTradeStationDefaultsToResult，已知cands.length===0时写入明确 `{type:'virtual',stationCode:'__virtual__'}` 并提交changed。原selectedTradeStation和retained savedTradeStationCode分支在前保留；undefined分支不动，不改评分函数、持久化或archive。

全部调用链检查：setAutoGroupResult包装入口（初始化runAutoGroup、runCalculationFromEditInput重算）；runResetCalculationFromBinding；handleSelectOption分配切换；handleAddHubDraft手动hub。Map和Live布局共用此presenter。reset交易站原有相同空候选virtual语义。测试直接mount调用真实presenter的handleAddHubDraft，真实trade候选筛选和默认评分，未mock presenter或另造同名算法。

命令：`npm run test:unit -- tests/unit/current/auto-sector-group/autoSectorEmptyTradeDefault.spec.ts`。

- RED exit1，2failed/1passed，unit-red.log：空候选默认undefined；明确/retained选择已正确，新增hub仍缺virtual。
- 首次修复后exit1，1failed/2passed，unit-green.log：行为已修，测试对Pinia包装action调用spy matcher不成立；改为vi.spyOn实际action，未改源码或行为oracle。
- 最终GREEN exit0，3passed，unit-green-final.log：新非玩家hubvirtual、无stationPlans/virtual生产draft/confirm持久化调用，已有和retained玩家选择保留，普通评分玩家选择和reset对照保留。
- `npm run test:unit -- tests/unit/current/auto-sector-group/autoSectorGroupReset.spec.ts tests/unit/current/auto-sector-group/autoSectorGroupDirty.spec.ts` exit0，2files/3passed，consumers.log。
- owned tracked diff check exit0。

日志根 `/tmp/x4-migration-FIX-M3.1/`。有限消费者为已有UI/dirty回归，不冒充实际presenter覆盖；实际行为证据来自新增focused文件。archive未写对照仍由已有M3.1有效E2E证据承担（新Unit无archive）；没有擅自重跑browser/build。

未满足：fresh build、原失败和当前15项E2E；M3.1图/草稿/交易站拖动等补充验收独立保留未完成，不因这次分支修复关闭。

apply结束后的独立合并验证（主agent提前授权）：`npm run test:unit` exit0，168files/950tests全部通过，15.91s；`/tmp/x4-migration-FIX-M3.1/combined-unit-final.log`。含已授权game-version-switch mock契约更新及全部本轮源修复。未启动build/browser。

后续授权独占build：`npm run build` exit0，Vite8.82s，`/tmp/x4-migration-FIX-M3.1/build.log`。立即释放窗口，fresh dist交主agent派Live owner执行原失败与15项；本worker未跑browser，其他补充验收仍不关闭。
