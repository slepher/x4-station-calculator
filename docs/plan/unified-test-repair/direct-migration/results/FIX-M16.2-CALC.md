# FIX-M16.2-CALC

Resolved change: fix-blueprint-dlc-calculation。T1/T2 完成，Unit 4/4、消费者9/9、build exit 0、独立 E2E 51/51；BUG-001 Verified（仅 Blueprint 范围）。

源码仅 useBlueprintProductionStore.ts：统一 calculationModulesMap（enforce=false 原库；true 仅激活模块）及按该库筛选的计算模块数组。Map 的 planned setter/updateStationModules/sync snapshot/initialize 四处写入均过滤；shared active state 二次分析同样输入过滤数组和同一库，返回 plannedModules 明确保留原始计划。所有自动生产/居住/仓储/码头候选由同一库限定，resolved 供原成本/工人/体积分析器使用。

activeDlcs 内容和 enforce watcher 调用 initializeAllStationDerived，重建静态依赖、所有站点 cache 和帝国聚合；不回写持久计划。已有 private planned setter 无调用点且未导出，本次机械覆盖其写入口但未为测试暴露新 API；其余公共更新/初始化入口实际 Unit 覆盖。

命令与证据：

- `npm run test:unit -- tests/unit/production/blueprint-dlc-calculation.spec.ts`。
- 首次 exit 1，2 个领域失败及 1 个 harness 错误（使用不存在的 setting action），`unit-red.log`保留。
- 修正为实际 updateSetting 后有效 RED exit 1，3 failed：有效模块未排除、禁用后聚合仍 9000、自动 producer 仍被选中。`unit-red-domain.log`。
- 最终 GREEN exit 0，4 passed，`unit-green.log`。
- `npm run test:unit -- tests/unit/production/phase-boundary.spec.ts tests/unit/production/station-derived-map-autofill-dedup.spec.ts tests/unit/production/production-dashboard-presenter.spec.ts` exit 0，3 files / 9 passed，`consumers.log`。
- owned tracked source `git diff --check` exit 0。无 git 写操作。

日志根 `/tmp/x4-migration-FIX-M16.2-CALC/`。Unit 使用真实 Blueprint/Empire/ActiveView stores、真实 Map/shared/auto/分析器；仅 mock 游戏数据为小型明确库。Independent oracle 包含产量3000→0→3000、工人10→0、双站聚合9000→0→9000，原计划不变，禁用时所有四类 auto 空，base 仍产 hullparts10、耗energy100，实际分析成本20/材料体积4/所需工人20/容量0。activated和enforce各自变化测试通过真实watcher触发，不用测试手动refresh替代；另用手动初始化验证该公共入口。

Live full/archive/reference floor 不变且语义未决；批量数量写入口策略不在此计算合同。BUG-001 保持 Confirmed，须 fresh build 后 M16.2 原失败与完整51验收；不能据此宣称全产品 DLC 政策完成。

后续独占构建窗口：`npm run build` exit 0，Vite 9.86s，统一日志 `/tmp/x4-migration-FIX-M16.2-CALC/build.log`。随后切独立 E2E 阶段，DLC原三项精确复验 3/3 exit 0，`/tmp/x4-migration-M16.2/post-fix/precise.log`；完整51进行中。

最终独立 E2E：完整51/51、0 skipped、exit 0（1.3m），`/tmp/x4-migration-M16.2/post-fix/full.log`；collection51 tests/3 files、exit 0。测试文件未改。原 red 保留；本范围 BUG-001 Verified，Live/archive/scale 限制不变。

另行授权的合并验证阶段：`npm run test:unit` exit1，166files passed/1failed，945tests passed/2failed（947total），14.15s，`combined-unit.log`。唯一失败是 game-version-switch.spec.ts 1.3/1.4 的旧 gameData mock 缺少当前 activeDlcs array，触发 watcher 展开错误；已交回主agent独立消费者更新，未加产品fallback、未改未owned测试。此前本范围focused与E2E结论保留，不声称canonical全绿。

主agent后续明确授权该Unit消费者单字段迁移：mock新增activeDlcs:[]，原断言不变；focused该file exit0，4/4 passed，`game-version-consumer.log`。canonical未立即重复，待FIX-M3.1后独立验证阶段运行。

最终独立合并验证：`npm run test:unit` exit0，168files/950tests passed，15.91s；`/tmp/x4-migration-FIX-M3.1/combined-unit-final.log`。包含新增FIX-M3.1三项Unit及该mock消费者修正，旧combined失败证据保留。
