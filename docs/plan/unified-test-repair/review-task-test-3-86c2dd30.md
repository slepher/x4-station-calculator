# Review: task-test-3 checkpoint `86c2dd30`

Status: changes_required

- 完整 `npm run test:unit`：163 files / 927 tests passed。
- checkpoint 只修改 `tests/unit/**`，未修改产品源码、配置或 workflow。
- 但 `tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts:212` 的 Terran unmatched-module 断言必须保持 `module_ter_prod_energycells_01`。
- 该回归测试由 `0420c25c` 引入，提交说明明确为修复 unmatched derived goal 的 `racePreference` fallback。
- 当前实现返回 `module_gen_prod_energycells_01`，原因是 synthetic unmatched `groupId` 使 `goalToPreviewItem()` 优先使用 allocation lineage，绕过 `settings.racePreference`。
- 已在 correction `e710011f` 恢复原断言；focused test 现明确失败（expected Terran, received generic）。

结论：Unit 迁移的其余改动可接受；该源码回归需转交 product-code owner。task-test-3 不应通过修改测试预期来接受，task-test-4 暂停直到回归修复并复验。
