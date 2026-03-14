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
- **Status**: Verified
- **Related Test**: PENDING (/x4:test-doc)
- **Evidence**:
  - `npm run test:unit -- tests/unit/import-export/import-export-game-version.spec.ts`
  - 新增失败断言后复现，再修复为通过
  - `npm run build` 通过

## Bug: Cross-Version Ship Slot Incompatibility Is Not Sanitized
- **ID**: BUG-002
- **Description**: 从较新版本导出的舰船蓝图，在导入旧版本时，即使某个装备 `equipment_id` 仍然存在，只要它已经不再匹配当前舰船对应槽位的 `slot_type / size / tags`，系统也不会把它识别为失效装备，更不会给出清洗提示。
- **Steps to Reproduce**:
  1. 切换到 `9.0`，进入舰船界面，选择大太刀。
  2. 将炮塔改成 `TER M 介子流炮塔 Mk1` 后保存蓝图。
  3. 导出数据文件。
  4. 切换到 `8.0`，导入该文件。
  5. 观察导入前清洗摘要与导入后的装备结果。
- **Expected Behavior**: 系统应识别该装备在跨版本场景下已经失去原语义，至少提示 1 个舰船装备引用已失效并被清洗。
- **Actual Behavior**: 由于当前仅按 `equipment_id` 是否存在做校验，系统不会识别“装备仍存在但已不兼容当前槽位”的情况，因此不会提示该装备失效。
- **Status**: Confirmed
- **Related Test**: `tests/unit/import-export/import-export-game-version.spec.ts`
- **Evidence**:
  - `npm run test:unit -- tests/unit/import-export/import-export-game-version.spec.ts`
  - 复现结论：Ship import sanitize 仅校验 `equipment_id` 是否存在，未校验其是否仍匹配当前舰船槽位
  - 修复后新增单测覆盖“装备仍存在但已不匹配当前槽位”场景
  - `npm run build` 通过
