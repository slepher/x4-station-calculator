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

## UI 实现

### 拖动条组件

使用 `X4DualPhaseRangeSlider` 组件，支持双阶段填充：
- **绿色填充**：0 到当前值（已使用）
- **蓝色填充**：当前值到 dragMax（可用范围）
- **灰色背景**：dragMax 到 max（不可用范围）

### dragMax 实现方式

采用全宽输入框 + 值限制方法：
- 输入框范围设为 0 到 max（完整轨道可拖动）
- `toNumber()` 函数中将值限制在 effectiveMax（dragMax）范围内
- 这样整个轨道都可拖动，不会出现禁用图标

### 样式规范

- storage-section：只保留 `rounded-lg`，取消 border/padding/bg
- 物品名称：使用 translate() 函数翻译，翻译失败显示 `!! {id} !!`

### C/U 槽隔离

- C/U 槽使用独立的 `ShipStoragePanel` 组件渲染
- 在 ShipBuildPanelFit.vue 中添加 v-if 条件排除普通槽组件

## Bug 修复记录

### 1. C/U 槽显示"无可用装备"

**问题**: 选择 C 槽或 U 槽时，ShipStoragePanel 正确显示，但下方显示"无可用装备"

**原因**: group-tabs 和 slot-wall 没有加 v-if 条件

**修复**: 添加条件 `v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'"`

### 2. 另存为清空存储数据

**问题**: 点击"另存为"后，可部署和导弹数量被清空

**原因**: saveAsBlueprint 函数只复制了 connections，没有复制 storage

**修复**: 添加 storage 字段复制

### 3. 拖动条出现禁用图标

**问题**: 拖动到 dragMax 位置后继续向右拖动时，显示禁用光标

**原因**: 输入框范围是 0 到 effectiveMax，超出范围浏览器显示禁用光标

**修复**: 输入框范围改为 0 到 max，toNumber 中限制值

### 4. 蓝色填充延迟

**问题**: 全绿时向左拖动，蓝色伸长有延迟

**原因**: CSS transition-all duration-200 导致

**修复**: 移除 transition

## 优先级

高 - 核心功能实现
