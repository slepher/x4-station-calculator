# Design: 飞船物品配装选择

## 架构概述

### 组件结构

```
ShipBuildPanelFit (配装面板)
└── ShipStoragePanel (C/U 槽存储面板)
    ├── storage-section (可部署)
    │   └── X4DualPhaseRangeSlider[] (每个物品项)
    ├── storage-section (诱导弹)
    │   └── X4DualPhaseRangeSlider
    ├── storage-section (无人机)
    │   └── X4DualPhaseRangeSlider[] (前3个)
    └── storage-section (导弹)
        └── X4DualPhaseRangeSlider[] (前3个)
```

### 数据流

1. **加载阶段**: 从游戏数据文件加载候选物品
2. **初始化阶段**: 从 ShipBlueprint.storage 恢复已保存的数量
3. **交互阶段**: 用户拖动滑块 → 更新本地状态 → 验证约束 → 自动保存到 blueprint
4. **持久化阶段**: blueprint 数据序列化为 JSON 保存到 localStorage

## 关键技术决策

### 1. 拖动条组件

复用 `X4DualPhaseRangeSlider.vue`，支持双阶段填充：
- **绿色填充**：0 到当前值，表示已使用
- **蓝色填充**：当前值到 dragMax，表示可用范围
- **灰色背景**：dragMax 到 max，表示不可用范围

### 2. dragMax 实现（最终方案）

采用**全宽输入框 + 值限制**方法：
- 输入框 `max` 属性设为 `max`（完整轨道范围）
- `toNumber()` 函数中将值限制在 `effectiveMax`（dragMax）范围内
- 优点：整个轨道都可拖动，不会出现禁用图标

备选方案（已废弃）：
- CSS 宽度截断：输入框包装器宽度 = `(dragMax / max) * 100%`
- 问题：拖动到截断位置后继续拖动会显示禁用图标

Props 控制：
- `min`: 0
- `max`: 该物品类型的上限
- `dragMax`: 可用上限（总量限制 - 其他物品已用），可选
- `step`: 1

### 3. 约束检查时机

- **实时检查**: 拖动时显示当前总量
- **拖动限制**: toNumber 中限制值不超过 effectiveMax
- **点击处理**: 点击 dragMax 到 max 区域时，设置为 dragMax

### 4. 物品显示

- 使用游戏数据的 `nameId` 字段配合 `translate()` 函数显示本地化名称
- 如果翻译不存在，显示 `!! {id} !!` 格式

### 5. C/U 槽与普通槽的差异

- 普通槽（E/R/S/W/T）：使用 `slotTargets` 渲染装备选择列表
- C/U 槽：使用 `ShipStoragePanel` 组件单独渲染存储配置
- 在 `ShipBuildPanelFit.vue` 中排除 C/U 槽的 `group-tabs`、`compatibility-box`、`slot-wall` 渲染

### 6. 样式优化

- 移除 CSS transition，避免蓝色填充延迟
- storage-section 只保留 `rounded-lg`，无 border/padding/bg

## 存储上限映射

| 类型 | 上限来源 |
|------|----------|
| 可部署 | ship.storage.deployable |
| 诱导弹 | ship.storage.countermeasure |
| 无人机 | ship.storage.unit |
| 导弹 | ship.storage.missile |

## 候选物品过滤规则

### 可部署 (consumables.json)
```typescript
items.filter(item => item.deployable === true)
```

### 诱导弹 (consumables.json)
```typescript
items.filter(item => item.class === 'countermeasure')
```

### 无人机 (drones.json) - 匹配规则

```typescript
// 1. 过滤 noplayerblueprint=false
// 2. 排除 deployable=true
// 3. 匹配逻辑
const shipDroneTags = selectedShip.droneTags || []
const matched = drones.filter(drone => {
  if (drone.noplayerblueprint === true) return false
  if (drone.deployable === true) return false

  const droneTags = drone.droneTags || []

  if (shipDroneTags.length === 0) {
    // 飞船 droneTags 为空，匹配 droneTags 为空的无人机
    return droneTags.length === 0
  } else {
    // 飞船 droneTags 非空，匹配包含所有 tags 或 tags 为空的无人机
    const hasAllTags = shipDroneTags.every(tag => droneTags.includes(tag))
    return hasAllTags || droneTags.length === 0
  }
}).slice(0, 10)
```

### 导弹 (missiles.json) - 匹配规则

```typescript
// 1. 从 blueprint 的 weapon/turret 槽位获取所有 ammunitionTags
const ammoTags = new Set<string>()
blueprint.connections.forEach(conn => {
  if (conn.slot_type === 'weapon' || conn.slot_type === 'turret') {
    conn.group.forEach(g => {
      const equipment = equipments.find(e => e.id === g.equipment_id)
      if (equipment?.ammunitionTags) {
        equipment.ammunitionTags.forEach(tag => ammoTags.add(tag))
      }
    })
  }
})

// 2. 匹配逻辑
if (ammoTags.size === 0) {
  return [] // 不显示导弹
}

const matched = missiles.filter(missile => {
  const missileTags = missile.missileTags || []
  // 匹配任一 tag
  return ammoTags.some(tag => missileTags.includes(tag))
})
```

## 持久化格式

```typescript
interface ShipBlueprintStorage {
  // C 槽
  deployables: Array<{ id: string; name: string; count: number }>
  countermeasure: { id: string; name: string; count: number } | null
  // U 槽
  drones: Array<{ id: string; name: string; count: number }>
  missiles: Array<{ id: string; name: string; count: number }>
}
```

## Bug 修复记录

### 1. C/U 槽显示"无可用装备"

**问题**: 选择 C 槽或 U 槽时，ShipStoragePanel 正确显示，但下方显示"无可用装备"

**原因**: `ShipBuildPanelFit.vue` 中 `group-tabs` 和 `slot-wall` 部分没有加 v-if 条件控制

**修复**: 为这些部分添加 `v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'"` 条件

### 2. 另存为清空存储数据

**问题**: 点击"另存为"后，可部署和导弹数量被清空

**原因**: `saveAsBlueprint` 函数只复制了 `connections`，没有复制 `storage`

**修复**: 添加 `storage: blueprint.value?.storage ? JSON.parse(JSON.stringify(blueprint.value.storage)) : undefined`

### 3. 拖动条出现禁用图标

**问题**: 拖动到 dragMax 位置后继续向右拖动时，显示禁用光标

**原因**: 输入框范围是 0 到 effectiveMax，超出范围浏览器显示禁用光标

**修复**: 输入框 max 改为 max（完整范围），toNumber 中限制值

### 4. 蓝色填充延迟

**问题**: 全绿时向左拖动，蓝色伸长有延迟

**原因**: CSS `transition-all duration-200` 导致

**修复**: 移除 transition
