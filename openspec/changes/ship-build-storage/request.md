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

---

## 需求说明：LoadShipBlueprintModal 显示优化

## 目标
在 LoadShipBlueprintModal 界面中，明细1显示飞船名称，明细2显示飞船装备统计。

## 已确认方案（审核重点）

### 1. 显示布局
- 飞船名称和装备统计分两行显示
- 第一行：飞船名称（本地化）
- 第二行：装备统计

### 2. 明细1 - 飞船名称显示
- 通过 `shipId` 在 `ships` 数组中查找对应的 `X4Ship`
- 使用 `translateShip()` 进行本地化，显示飞船本地化名称（如"响尾蛇"）

### 3. 明细2 - 装备统计显示
- 遍历 `blueprint.connections`，按类型和大小分组统计
- 装备类型使用 `translateEquipmentType()` 本地化
- **特殊映射规则**：挂载在其他装备上的护盾（shield），统一显示为"副盾"

### 4. Connections 排序规则
- Store 层 connections 按固定顺序排序：engine → thruster → shield → weapon → turret
- 在 `cleanupEmptyGroups()` 和 `loadBlueprint()` 时排序

### 5. 装备统计排序规则
- 同一类型按大小排序：XL > L > M > S
- 显示格式：`XL引擎x2, L炮塔x1, M炮塔x3, 副盾x1`
- 副盾（off_shield）排最后

### 6. 装备类型映射表
| slot_type | 显示名称 |
|-----------|----------|
| engine    | 引擎     |
| weapon    | 武器     |
| shield    | 护盾     |
| thruster  | 推进器   |
| turret    | 炮塔     |
| off_shield| 副盾    |
| 其他      | 使用 slot_type 原值 |

## 边界

### In Scope
- LoadShipBlueprintModal 界面显示优化
- 飞船名称本地化显示
- 装备统计按类型+大小分组显示
- Connections 排序
- 副盾排最后

### Out of Scope
- 不显示装备具体名称（只显示类型+数量）

## 验收标准（DoD）
1. 飞船名称本地化显示（如"响尾蛇"），与装备统计分两行显示。
2. 装备统计按类型+大小分组显示（XL > L > M > S）。
3. 副盾（挂载在其他装备上的护盾）统一显示为"副盾"，排最后。
4. Connections 在 Store 层按 engine→thruster→shield→weapon→turret 排序。
5. 只显示有装备的类型（数量 > 0）。
6. npm run build 无编译错误。

## 未决项
无。
