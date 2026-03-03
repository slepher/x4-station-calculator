# Design: ShipBuildPanelEquipment

## 概述

本文档描述装备对比面板的设计方案，用于在船只建造视图的配装区显示当前已装备与候选装备的属性对比。

## 架构设计

### 组件结构

```
ShipBuildView
  └── ShipBuildPanelFit (emit: picker-open-change, update:pickerTarget, update:highlightedEquipmentId)
        └── Picker (内部)
  └── Right Column (col-span-9, flex-col)
        ├── ShipBuildPanelEquipment (新组件) ← 上
        ├── ShipBuildPanelStats            ← 下
        └── ShipBuildPanelMaterials (展开后隐藏)
```

### 组件职责

| 组件 | 职责 |
|------|------|
| `ShipBuildPanelEquipment` | 负责显示候选装备的属性对比，Header 显示候选名称，内容区为两列布局 |

### 数据依赖

1. **Picker 状态**：从 `ShipBuildPanelFit` 获取 Picker 展开/收起状态
2. **当前装备**：从 `pickerTarget.connectionKeys` 获取已装备的 `equipment_id`
3. **候选装备**：`highlightedEquipmentId`
4. **装备统计**：使用已有的 `useEquipmentStats` composable

## UI 设计

### 布局

#### 页面级布局
- **展开前**（1:1:1）：Fit | Stats | Materials，三列各占 1/3
- **展开后**（2:1）：
  - Fit 占 2/3（左列）
  - Right 占 1/3（右列），内部为上下布局：
    - 上：ShipBuildPanelEquipment
    - 下：ShipBuildPanelStats
  - Materials 在展开后隐藏

#### 组件级布局（ShipBuildPanelEquipment）

- **Header**：直接显示候选装备名称（无前缀）
- **内容区**：两列布局 (`grid-cols-2`)，风格与 `ShipBuildPanelStats` 一致
- **不显示 Summary 区块**

#### 间距要求
- 展开前后，Stats 和 Picker（左列）间距不额外增加
- 展开前，Stats 和 Materials 间距不额外增加
- 展开后，Equipment/Stats（右边内部）和右边界距不额外增加

### Panel 内容设计

- Header：候选装备名称
- 内容区：两列布局，显示候选装备的 details 信息（完整属性列表）
- 进度条：与 Stats 风格一致

### 候选装备 Summary（Picker 卡片用）

Picker 内每个候选装备卡片显示 summary 信息（2 项关键数据）。

### 候选装备 Details（Panel 对比面板用）

Panel 对比面板显示 details 信息（完整属性列表）。

#### Weapon/Turret Details

| 属性 | 说明 |
|------|------|
| burstDPS | 爆发 DPS |
| sustainedDPS | 持续 DPS |
| range | 射程 |
| singleDamage | 单发伤害 |
| avgShotTime | 平均射击时间 |
| ammo | 弹药量 |
| ammoReload | 弹药装填 |
| chargetime | 充能时间 |
| timeToOverheat | 过热时间 |
| cooldelay | 冷却延迟 |
| coolTime | 冷却时间 |
| cycleTime | 循环时间 |

#### Shield Details

| 属性 | 说明 |
|------|------|
| shieldMax | 护盾最大值 |
| shieldRate | 护盾恢复率 |
| shieldDelay | 充能延迟 |

#### Engine Details

| 属性 | 说明 |
|------|------|
| thrustForward | 前向推力 |
| speed | 巡航速度 |
| acceleration | 加速度 |
| boostMultiplier | 助推乘数 |
| boostSpeed | 助推速度 |
| boostAccel | 助推加速度 |
| travelThrust | 巡航推力 |
| travelSpeed | 跳跃速度 |
| travelCharge | 跳跃充能 |
| travelAcceleration | 跳跃加速度 |

#### Thruster Details

| 属性 | 说明 |
|------|------|
| pitch | 俯仰推力 |
| yaw | 偏航推力 |
| roll | 翻滚推力 |
| strafe | 侧移推力 |
| pitchRate | 俯仰率 |
| yawRate | 偏航率 |
| rollRate | 翻滚率 |
| strafeSpeed | 侧移速度 |
| strafeAcceleration | 侧移加速度 |

## 类型定义

### EngineSummary

```typescript
export interface EngineSummary {
  speed: number
  travel: string // "${travelSpeed}:${travelCharge}"
}
```

### EquipmentSummary

```typescript
export interface EquipmentSummary {
  weapon?: WeaponSummary
  turret?: TurretSummary
  shield?: ShieldSummary
  engine?: EngineSummary
  thruster?: ThrusterSummary
}
```

## 显示/隐藏逻辑

### 显示条件

Picker 展开 AND (当前装备存在 OR 候选装备存在)

### 隐藏条件

- Picker 收起
- 当前装备为空 AND 候选装备为空

## 实现要点

1. **复用现有 composable**：使用 `useEquipmentStats` 获取装备统计数据
2. **两列布局**：使用 `grid grid-cols-2` 实现，与 Stats 风格一致
3. **Header 显示候选名称**：直接使用 `candidateEquipment.name`
4. **样式复用**：复、用 Stats 组件的样式类（`.stats-list-container`, `.stats-column`, `.stats-row`, `.stats-bar` 等）

## 非简化模式 Group 排列优化

### 10.1 概述

当飞船槽位很多时（如驱逐舰、战列舰），所有 group 会挤在一起显示。需要按规则重新分组排列。

### 10.2 触发条件

- **生效模式**：仅标准模式（非简化模式，即 showAllSlots=true）
- **简化模式**：showAllSlots=false 时保持原有紧凑排列
- **数量阈值**：所有 group 位置数量 > 8

### 10.3 排列规则

#### 第一层分组：按 Size 分行

按装备尺寸分为 N 行，优先级顺序：
1. extralarge
2. large
3. medium
4. small

#### 第二层分组：Group 内部分行

在每个 size 行内，如果某个 group 的 count > 8：
- 将其内部数量**平分**为两行显示
- 例如：count=16 → 分成两行，每行 8 个

### 10.4 数据结构

需要新增计算逻辑，将原有的 flat group 列表转换为层级结构：

```typescript
interface SizeGroupRow {
  size: 'extralarge' | 'large' | 'medium' | 'small'
  groups: GroupRow[]
}

interface GroupRow {
  groupKey: string
  count: number
  // 如果 count > 8，平分后的行
  splitRows?: { start: number; end: number }[]
}
```

### 10.5 实现位置

- 组件：`ShipBuildPanelFit.vue`
- 计算属性：`slotTargets` 或新增专门的计算属性
- 渲染逻辑：根据模式（简化/标准）选择不同的渲染方式
