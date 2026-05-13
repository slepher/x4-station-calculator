# Material Method Specification

## Purpose

规范船只建造材料方法的选择、持久化和过滤逻辑，确保用户选择的方法能够正确保存并在重新加载时恢复，同时根据飞船本体生产能力正确过滤 xenon 方法。

## MODIFIED Requirements

### Requirement: ShipBlueprint Material Method Field

修改 `ShipBlueprint` 类型定义，新增 `materialMethod` 必填字段用于持久化用户选择的材料方法。

#### Scenario: Blueprint 包含必填 materialMethod 字段

**前提**：
- 存在一个有效的 `ShipBlueprint` 实例

**当**：
- 查看 `ShipBlueprint` 类型定义（`src/types/x4.ts`）

**那么**：
- `ShipBlueprint` 接口包含 `materialMethod: string` 字段（非可选）
- 所有 blueprint 实例 MUST 具有有效的 `materialMethod` 值
- 字段 MAY 的值为 `'default'`、`'xenon'` 或其他有效方法名称

### Requirement: Blueprint Version Migration

升级 blueprint storage version 并添加迁移逻辑，确保旧数据自动设置默认方法。

#### Scenario: 版本升级到 3

**前提**：
- 系统加载 blueprint storage

**当**：
- 查看 `CURRENT_SHIP_BLUEPRINT_VERSION`（`src/store/logic/storageVersions.ts:3`）

**那么**：
- `CURRENT_SHIP_BLUEPRINT_VERSION` MUST 为 `3`

#### Scenario: 迁移旧 blueprint 数据

**前提**：
- localStorage 中存在 version < 3 的 blueprint 数据
- blueprint 没有 `materialMethod` 字段或字段为 undefined

**当**：
- 执行迁移逻辑（`migrateShipBlueprintStateToCurrent`）

**那么**：
- 每个 blueprint MUST 获得默认值 `materialMethod: 'default'`
- 迁移后 `version` MUST 更新为 `3`
- 迁移结果 MUST 保存到 localStorage

#### Scenario: 新 blueprint 默认值

**前提**：
- Store 创建新的 `ShipBlueprint` 实例

**当**：
- 初始化 blueprint 字段

**那么**：
- `materialMethod` MUST 初始化为 `'default'`

### Requirement: Xenon Method Filtering

修改材料方法候选的过滤逻辑，根据飞船本体生产能力决定是否允许 xenon 方法。

#### Scenario: Xenon 飞船允许选择 xenon 方法

**前提**：
- 当前选中的飞船（`selectedShip.value`）的 `production` 数组中存在 `method === 'xenon'` 的条目

**当**：
- 计算 `materialMethodOptions`（`ShipBuildPanelMaterials.vue:88-187`）

**那么**：
- 候选列表 MUST 包含 `'xenon'` 方法（如果装备或存储物品中有 xenon cost）
- xenon 方法 MUST NOT 被过滤掉

#### Scenario: 非 Xenon 飞船过滤 xenon 方法

**前提**：
- 当前选中的飞船的 `production` 数组中没有 `method === 'xenon'` 的条目

**当**：
- 计算 `materialMethodOptions`

**那么**：
- 候选列表 MUST NOT 包含 `'xenon'` 方法
- 所有来源（飞船本体、装备、consumables、drones、missiles）的 xenon 方法 MUST 被过滤掉

#### Scenario: 候选来源完整性

**前提**：
- blueprint 包含装备、consumables、drones、missiles 配置

**当**：
- 计算 `materialMethodOptions`

**那么**：
- 候选 MUST 包含以下来源的所有方法（除 xenon 过滤规则排除）：
  1. `selectedShip.value?.production[].method`
  2. `shipBlueprint.connections[].group` 中主装备和护盾的 `equipment.cost` keys
  3. `shipBlueprint.storage` 中的 deployables、countermeasure、drones、missiles 的 cost methods
- 候选 MUST 使用 Set 去重，保持首次出现顺序
- 候选为空时 MUST 返回 `['default']`

### Requirement: Material Method Persistence

实现材料方法的持久化机制，确保用户选择能够正确保存和恢复。

#### Scenario: 用户切换方法并保存

**前提**：
- 用户在材料方法下拉框中选择新方法（如从 `'default'` 切换到 `'xenon'`）

**当**：
- 用户触发下拉框 change 事件

**那么**：
- 系统 MUST 调用 `store.setMaterialMethod(newMethod)`
- `blueprint.materialMethod` MUST 更新为新值
- 系统 MUST 触发材料重新计算
- 用户执行 `saveBlueprint` 后，新方法 MUST 持久化到 localStorage

#### Scenario: 重新加载恢复方法

**前提**：
- localStorage 中存在 blueprint，其 `materialMethod` 为 `'xenon'`

**当**：
- 用户重新打开应用并加载该 blueprint

**那么**：
- 材料方法下拉框 MUST 显示 `'xenon'` 为选中状态
- 材料计算 MUST 使用 `'xenon'` 方法

#### Scenario: 方法不在候选中自动选择

**前提**：
- blueprint 的 `materialMethod` 为 `'xenon'`
- 用户切换到非 Xenon 飞船，导致 xenon 不在候选中

**当**：
- `materialMethodOptions` 更新

**那么**：
- 系统 MUST 自动选择第一个有效方法（`materialMethodOptions[0]`）
- 如果候选为空，MUST fallback 到 `'default'`
- 自动选择后 MUST 立即持久化

### Requirement: Store Material Method API

在 Store 层提供材料方法管理 API。

#### Scenario: setMaterialMethod 方法

**前提**：
- Store 中存在活动的 blueprint

**当**：
- 调用 `store.setMaterialMethod(method: string)`

**那么**：
- `blueprint.materialMethod` MUST 更新为传入的 `method`
- 系统 MUST 触发材料重新计算
- blueprint MUST 标记为 dirty（需要保存）

#### Scenario: 方法值验证

**前提**：
- 调用 `setMaterialMethod` 时传入无效值（如空字符串或不存在的 method）

**当**：
- 执行方法更新

**那么**：
- 系统 MAY 警告或忽略无效值（具体行为待定）
- 不影响 blueprint 的其他字段

## ADDED Requirements

### Requirement: Component State Binding

组件层改为绑定 blueprint 的 materialMethod，移除内部 ref 状态。

#### Scenario: 移除组件内部 ref

**前提**：
- 查看 `ShipBuildPanelMaterials.vue` 源码

**当**：
- 检查材料方法状态管理

**那么**：
- MUST NOT 存在 `const materialMethod = ref('default')` 类型的局部状态
- MUST 通过 `props.shipBlueprint?.materialMethod` 或 store 访问方法值

#### Scenario: 初始化逻辑

**前提**：
- 加载 blueprint 时 `materialMethodOptions` 已计算完成

**当**：
- 组件初始化材料方法显示

**那么**：
- 如果 `blueprint.materialMethod` 在候选中 → MUST 使用保存值
- 如果不在候选中 → MUST 使用 `materialMethodOptions[0]` 或 `'default'`