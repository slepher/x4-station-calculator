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

通过 CSS 宽度截断方法实现 dragMax：
- 输入框包装器宽度 = `(dragMax / max) * 100%`
- 这样滑块可以到达 100% 位置，但实际拖动范围被限制

Props 控制：
- `min`: 0
- `max`: 该物品类型的上限
- `dragMax`: 可用上限（总量限制 - 其他物品已用）
- `step`: 1

### 2. 约束检查时机

- **实时检查**: 拖动时显示当前总量
- **拖动限制**: 使用 dragMax 限制单个物品的最大可拖动值
- **提交检查**: 拖动结束后验证

### 3. 物品显示

- 使用游戏数据的 `nameId` 字段配合 `translate()` 函数显示本地化名称
- 如果翻译不存在，显示 `!! {id} !!` 格式

### 4. C/U 槽与普通槽的差异

- 普通槽（E/R/S/W/T）：使用 `slotTargets` 渲染装备选择列表
- C/U 槽：使用 `ShipStoragePanel` 组件单独渲染存储配置
- 需要在 `ShipBuildPanelFit.vue` 中排除 C/U 槽的 `group-tabs` 和 `slot-wall` 渲染

## 存储上限映射

| 类型 | 上限来源 |
|------|----------|
| 可部署 | ship.storage.deployable |
| 诱导弹 | ship.storage.countermeasure |
| 无人机 | ship.storage.unit |
| 导弹 | 固定 20 |

## 候选物品过滤规则

### 可部署 (consumables.json)
```typescript
items.filter(item => item.deployable === true)
```

### 诱导弹 (consumables.json)
```typescript
items.filter(item => item.class === 'countermeasure')
```

### 无人机 (drones.json)
```typescript
items.slice(0, 3)
```

### 导弹 (missiles.json)
```typescript
items.slice(0, 3)
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

**问题**: 选择 C 槽或 U 槽时，ShipStoragePanel 正确显示，但下方仍显示"无可用装备"

**原因**: `ShipBuildPanelFit.vue` 中 `group-tabs` 和 `slot-wall` 部分没有加 v-if 条件控制

**修复**: 为这些部分添加 `v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'"` 条件
