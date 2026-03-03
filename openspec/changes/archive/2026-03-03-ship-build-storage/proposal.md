## Why

飞船建造模块目前仅在内存中保存选中的飞船和装备配装，刷新页面后数据丢失。用户需要能够保存和加载飞船配装方案，实现持久化存储。

## What Changes

1. **新增 ShipBlueprint 数据结构**
   - 定义 `ShipBlueprint` 接口，包含 `id`, `name`, `shipId`, `connections`, `lastUpdated`
   - `connections` 按 `slot_type` 分组，每组包含 `group` 数组
   - `group` 包含 `group` 名称、`equipment_id`、`count`、`shield`（可选）
   - `equipment_id = null` 表示取消装备，**从 blueprint 中删除该条记录**
   - 定义 `SavedShipBlueprintsState` 接口用于 localStorage 存储

2. **重构 useShipBuildStore 数据层**
   - Store 层以 `blueprint` 为唯一数据源
   - `selectedByConnection` 改为 computed，从 blueprint 计算出 View 需要的格式
   - 提供修改接口：`setEquipment()`, `setGroupEquipment()`, `setShield()`, `setGroupShield()`
   - 新增 `savedBlueprints` 和 `activeBlueprintId` 状态
   - 新增持久化方法：`saveBlueprint()`, `saveAsBlueprint()`, `loadBlueprint()`, `deleteBlueprint()`
   - 新增 dirty check 机制

3. **复用 UI 组件**
   - 复用 `ShipBuildView.vue` 中现有的前四个按钮（New/Save/Save As/Load）
   - 复用 `SmartSaveDialog.vue` 用于 Save As 对话框
   - 新建 `LoadShipBlueprintModal.vue` 展示已保存的 blueprint 列表

4. **载入自动设置逻辑**
   - 根据 blueprint.shipId 获取飞船信息
   - 自动设置 `selectedClass`（飞船大小）
   - 自动设置 `selectedRaces`（飞船种族）
   - 自动设置 `selectedTypes`（飞船类型）
   - 自动设置 `selectedShipId`
   - 从 blueprint 恢复 `selectedByConnection`

## Capabilities

### New Capabilities
- `ship-blueprint-storage`: 飞船配装的持久化存储，支持保存、另存为、载入、删除操作

### Modified Capabilities
- 无（现有功能无需求变更）

## Impact

- **新增文件**:
  - `src/components/LoadShipBlueprintModal.vue` - 载入 blueprint 对话框
- **修改文件**:
  - `src/types/x4.ts` - 添加 ShipBlueprint 和 SavedShipBlueprintsState 类型
  - `src/store/useShipBuildStore.ts` - 重构为 blueprint 源数据 + computed view，新增持久化逻辑
  - `src/components/ShipBuildView.vue` - 添加持久化按钮处理逻辑
  - `src/components/ship-build/*.vue` - 更新 selectedByConnection 绑定方式
  - `src/locales/en.json`, `src/locales/zh-CN.json` - 添加 UI 文本
