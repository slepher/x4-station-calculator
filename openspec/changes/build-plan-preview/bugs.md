# Bugs

## Bug: unmatched production goal ignores race preference

- **ID**: BUG-001
- **Description**: build-plan preview 将未匹配到 logic-flow 产线的 derived production goal 放入 synthetic unmatched 分组后，模块选择错误地使用默认 lineage，忽略 `settings.racePreference`。
- **Steps to Reproduce**:
  1. 调用 `createBuildFlowPlanPreview()`。
  2. 传入 `production-rate` goal：`wareId=energycells`。
  3. 传入无关 logic-flow group，使目标进入 unmatched line。
  4. 设置 `settings.racePreference='terran'`。
  5. 查看 unmatched derived item 的 `moduleId`。
- **Expected Behavior**: unmatched derived item 应按 `settings.racePreference` 选择 `module_ter_prod_energycells_01`。
- **Actual Behavior**: 当前返回 `module_gen_prod_energycells_01`。
- **Status**: Fixed
- **Related Verification**: `tests/unit/current/build-flow-plan/buildPlanProductionLine.spec.ts`（task-coding-4 / task-test-3；focused regression、完整 Unit 与 build 均通过）
