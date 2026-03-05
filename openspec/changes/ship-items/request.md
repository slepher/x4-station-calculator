# Request: 飞船物品配装选择

## 槽位顺序

E → R → S → W → T → C → U

- E: 引擎 (Engine)
- R: 推进器 (Thruster)
- S: 护盾 (Shield)
- W: 武器 (Weapon)
- T: 炮塔 (Turret)
- C: 可部署 + 诱导弹 (Consumables)
- U: 无人机 + 导弹 (Units)

## 概述

为飞船存储管理 UI 增加两个配装槽位（C 槽和 U 槽）：
1. **C 槽**: 可部署 + 诱导弹
2. **U 槽**: 无人机 + 导弹

## 需求详情

### C 槽（可部署 + 诱导弹）

| 类型 | 数据源 | 候选数量 | 存储上限 |
|------|--------|----------|----------|
| 可部署 | consumables.json (deployable=true) | 无限制 | ship.storage.deployable |
| 诱导弹 | consumables.json (class="countermeasure") | 无限制 | ship.storage.countermeasure |

- 可部署各物品数量总和 ≤ deployable 上限
- 诱导弹数量 ≤ countermeasure 上限

### U 槽（无人机 + 导弹）

| 类型 | 数据源 | 候选数量 | 存储上限 |
|------|--------|----------|----------|
| 无人机 | drones.json | 前3个 | ship.storage.unit |
| 导弹 | missiles.json | 前3个 | 固定20（临时） |

- 无人机各物品数量总和 ≤ unit 上限
- 导弹数量 ≤ 20

## ShipBlueprint 扩展

```typescript
interface ShipBlueprintStorageItem {
  id: string
  name: string
  count: number
}

interface ShipBlueprintStorage {
  // C 槽
  deployables: ShipBlueprintStorageItem[]
  countermeasure: ShipBlueprintStorageItem | null
  // U 槽
  drones: ShipBlueprintStorageItem[]
  missiles: ShipBlueprintStorageItem[]
}
```

## UI 实现方式

### 组件选择

使用 `X4DualPhaseRangeSlider` 组件，支持双阶段填充：
- 绿色填充：0 到当前值（已使用）
- 蓝色填充：当前值到 dragMax（可用范围）

### dragMax 实现

使用 CSS 宽度截断方法：
- 输入框包装器宽度 = `(dragMax / max) * 100%`
- 这样滑块可以到达 100% 视觉位置，但实际拖动范围被限制在 dragMax

### 样式规范

- storage-section：只保留 `rounded-lg`，取消 border/padding/bg
- 物品名称：翻译后显示，翻译失败显示 `!! {id} !!`

### C/U 槽与其他槽的隔离

- C/U 槽使用独立的 `ShipStoragePanel` 组件渲染
- 不显示普通槽的 group-tabs、compatibility-box、slot-wall

## Bug 修复

### C/U 槽显示"无可用装备"

**问题**: 选择 C 槽或 U 槽时，ShipStoragePanel 正确显示，但下方显示"无可用装备"

**原因**: group-tabs 和 slot-wall 没有加 v-if 条件

**修复**: 添加条件 `v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'"`

## 优先级

高 - 核心功能实现
