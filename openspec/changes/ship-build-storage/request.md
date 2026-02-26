# 需求说明：飞船建造持久化

## 目标
为飞船建造模块增加持久化功能，支持保存、另存为、载入、删除飞船配装方案（Blueprint），并实现 Blueprint 源数据 + computed View 的数据分层架构。

## 已确认方案（审核重点）

### 1. 数据结构设计
- **Blueprint 格式**（Store 层持久化）：
  ```typescript
  type ShipBlueprintGroup = {
    group: string              // ship slot 的 group 名称
    equipment_id: string      // 装备ID
    count: number             // 实际搭载数量
    shield?: {
      equipment_id: string    // shield 装备ID
      count: number           // shield 搭载数量
    }
  }

  type ShipBlueprintConnection = {
    slot_type: string         // 如 "engine"
    group: ShipBlueprintGroup[]
  }

  type ShipBlueprint = {
    id: string
    name: string
    shipId: string
    connections: ShipBlueprintConnection[]
    lastUpdated: number
  }
  ```

- **View 格式**（computed，从 blueprint 计算）：
  ```typescript
  type ConnectionValue = {
    equipmentId: string | null
    count: number
  }
  selectedByConnection: Record<string, ConnectionValue>
  // Key 格式: "shipId::slotType::slotIndex::groupIndex"
  ```

### 2. equipmentId = null 语义
- `equipmentId` 有值：设置/更新该槽位的装备
- `equipmentId = null`：**取消装备**，从 blueprint 中**删除该条记录**（不是保留设为 null）

### 3. 数据分层架构
- Store 层以 `blueprint` 为唯一数据源
- `selectedByConnection` 改为 computed，从 blueprint 计算出 View 需要的格式
- 提供修改接口自动同步到 blueprint

### 4. Store 接口方法
- `setEquipment(slotType, group, equipmentId, count)` - 单个槽位修改
- `setGroupEquipment(slotType, group, equipmentId, count)` - 批量修改（简略模式）
- `setShield(slotType, group, equipmentId, count)` - 修改盾位
- `setGroupShield(slotType, group, equipmentId, count)` - 批量修改盾位

### 5. 持久化 CRUD 操作
- `saveBlueprint()` - 保存到当前 blueprint
- `saveAsBlueprint(name)` - 另存为新 blueprint
- `loadBlueprint(id)` - 载入 blueprint，自动设置筛选条件和恢复配装
- `deleteBlueprint(id)` - 删除 blueprint

### 6. 载入自动设置逻辑
- 根据 blueprint.shipId 获取飞船信息
- 自动设置 `selectedClass`（飞船大小）
- 自动设置 `selectedRaces`（飞船种族）
- 自动设置 `selectedTypes`（飞船类型）
- 自动设置 `selectedShipId`
- 从 blueprint 恢复 `selectedByConnection`

### 7. UI 组件
- 复用 `ShipBuildView.vue` 中现有的前四个按钮（New/Save/Save As/Load）
- 复用 `SmartSaveDialog.vue` 用于 Save As 对话框
- 新建 `LoadShipBlueprintModal.vue` 展示已保存的 blueprint 列表

### 8. Dirty Check
- 使用 JSON 序列化 blueprint 进行快照对比
- `isDirty` computed 属性导出供 UI 使用

## 边界

### In Scope
- ShipBlueprint 数据结构设计与持久化
- Store 层 blueprint 源数据 + selectedByConnection computed 分层
- CRUD 持久化操作（保存/另存为/载入/删除）
- 载入时自动设置筛选条件
- Dirty state 检测
- UI 组件集成

### Out of Scope
- 飞船配装的导入/导出功能（仅 localStorage）
- View 层修改 count 功能（数据结构预留，后续实现）
- 版本迁移（首次实现，无历史数据）

## 验收标准（DoD）
1. 持久化 key 为 `x4_ship_blueprints`，格式符合 ShipBlueprint 定义。
2. equipmentId = null 时，该 group 条目从 blueprint 中删除，不保留 null 值。
3. selectedByConnection 为 computed，从 blueprint 计算得出。
4. 提供 setEquipment / setGroupEquipment / setShield / setGroupShield 方法，修改后自动同步到 blueprint。
5. saveBlueprint() 更新当前 active blueprint。
6. saveAsBlueprint(name) 创建新 blueprint 并设为 active。
7. loadBlueprint(id) 自动设置 selectedClass/selectedRaces/selectedTypes/selectedShipId 并恢复配装。
8. deleteBlueprint(id) 从 localStorage 删除 blueprint。
9. Dirty state 正确检测未保存修改。
10. New 按钮在有未保存修改时提示确认。
11. LoadShipBlueprintModal 展示 blueprint 列表，支持选择和删除。
12. 复用现有 SmartSaveDialog 处理 Save As 对话框。
13. npm run build 无编译错误。

## 未决项
无。
