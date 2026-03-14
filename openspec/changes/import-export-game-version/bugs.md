# Bugs: import-export-game-version

## Bug: Overwrite Import Does Not Activate Imported Targets
- **ID**: BUG-001
- **Description**: 在覆盖模式导入后，`x4_empire_data`、`x4_logic_flow_plans`、`x4_ship_blueprints` 已写入导入文件中的 `activeId` / `activeStationId` / `activeBlueprintId`，但运行时界面没有同步切到对应的空间站、Logic Flow 方案和舰船蓝图。
- **Steps to Reproduce**:
  1. 准备一个包含 `x4_empire_data.activeId + activeStationId`、`x4_logic_flow_plans.activeId`、`x4_ship_blueprints.activeBlueprintId` 的导入文件。
  2. 在应用中打开导入弹窗，选择覆盖模式，并勾选三个模块。
  3. 执行导入。
  4. 观察当前运行时选中的空间站、Logic Flow 方案、舰船蓝图。
- **Expected Behavior**: 覆盖导入完成后，运行时上下文应切换到导入文件声明的 active 目标。
- **Actual Behavior**: 导入只更新持久化数据，运行时 active 上下文未同步切换。
- **Status**: Confirmed
- **Related Test**: PENDING (/x4:test-doc)
- **Evidence**:
  - `npm run test:unit -- tests/unit/import-export/import-export-game-version.spec.ts`
  - 新增失败断言后复现，再修复为通过
  - `npm run build` 通过
