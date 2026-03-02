# UI Knowledge: ship-build-stat

## 页面入口与区域

- 入口：`船只建造` 视图，需先完成飞船筛选并选中一艘飞船。
- 回归基线样本：Heron Vanguard（`ship_tel_l_trans_container_02_a`）。
- 目标区域：下部三列中的中列 `配装后船体属性`。

## 建议的测试定位

- 中列属性面板：`ship-build-stats-panel`
- 档位切换（简略）：`ship-build-stats-mode-summary`
- 档位切换（详细）：`ship-build-stats-mode-detail`
- 已选详情区：`ship-build-selection`
- 飞船名称项：`ship-build-ship-name`
- 筛选区：`ship-build-filter-class` / `ship-build-filter-race` / `ship-build-filter-type`

## 状态与切换语义

- 状态：`已选 Heron Vanguard`
  - 进入路径：`class=L` -> `race=teladi` -> `type=freighter` -> 点击 `Heron Vanguard`
  - 可观察结果：`ship-build-panel-stats`、`ship-build-selection` 可见
- 切换：`已选 Heron Vanguard -> 详细档位`
  - 操作：点击 `ship-build-stats-mode-detail`
  - 可观察结果：详细字段集合可见，且包含真实值与占位值并存

## 字段对齐矩阵（按截图）

- `简略`（截图 2）字段：
  - 左列：`船体(MJ)`、`护盾(MJ)`、`雷达范围(km)`、`武器爆发输出值(MW)`、`炮塔平均输出值(MW)`、`集装仓储(m3)`、`M级泊位数量`、`M级飞船容量`、`S级泊位数量`、`S级飞船容量`
  - 右列：`速度(m/s)`、`助推器助推速度(m/s)`、`巡航速度(m/s)`、`船员`、`单位`、`导弹`、`可投放设备`、`干扰弹`
- `详细`（截图 1）字段：
  - 在 `简略` 基础上新增：`再充率(MW)`、`再充延迟(秒)`、`编组平均护盾容量(...)`、`武器持续性输出值(...)`、`固体仓储(m3)`、`液体仓储(m3)`、`冷凝态仓储(m3)`、`加速(m/s2)`、`助推加速度(m/s2)`、`助推时长(秒)`、`助推回充率(%/s)`、`巡航加速度(m/s2)`、`巡航加力时间(秒)`、`平移速度(m/s)`、`平移加速度(m/s2)`、`水平转向(°/s)`、`俯仰(°/s)`、`横滚(°/s)`

## 数据来源映射（实现与断言口径）

- `船体/船员/仓储/泊位与容量/基础机动参数`：`ships.json`
- `护盾容量/再充率/再充延迟/速度与助推巡航链路`：`equipments.json` + 已选装备
- `武器爆发输出值/武器持续性输出值/炮塔平均输出值`：通过 `useEquipmentStats` composable 计算

## useEquipmentStats Composable

### 概述
`useEquipmentStats` 位于 `src/composables/useEquipmentStats.ts`，用于计算单个装备的属性数据。

### 函数签名
```typescript
function useEquipmentStats(equipment: X4Equipment, ship: X4Ship): {
  summary: ComputedRef<EquipmentSummary | undefined>
  details: ComputedRef<EquipmentDetail | undefined>
}
```

### 导出类型

| 类型 | 说明 |
|------|------|
| `WeaponSummary` | `{ burstDPS, range }` |
| `TurretSummary` | `{ sustainedDPS, range }` |
| `ShieldSummary` | `{ shieldMax, shieldDelay }` |
| `EngineSummary` | `{ speed, travelSpeed, travelCharge }` |
| `ThrusterSummary` | `{ strafeSpeed, yawRate }` |
| `WeaponDetail` | 包含 burstDPS, sustainedDPS, range, singleDamage, singleShotTime, avgShotTime, ammo, ammoReload, chargetime, timeToOverheat, cooldelay, coolTime, cycleTime |
| `ShieldDetail` | `{ shieldMax, shieldRate, shieldDelay }` |
| `EngineDetail` | 包含 thrustForward, boostMultiplier, boostAcceleration, boostDuration, boostRecharge, travelThrust, travelAttack, travelCharge, travelSpeed, travelAcceleration, speed, acceleration, boostSpeed, boostAccel |
| `ThrusterDetail` | 包含 pitch, yaw, roll, strafe, pitchRate, yawRate, rollRate, strafeSpeed, strafeAcceleration |

### 数据源
- 弹体数据：`bullets.json` (from `bullet_macros.xml`)
- 导弹数据：`missiles.json` (from `missile_macros.xml`)
- 装备数据：`equipments.json` (from `equipment_macros.xml`)

### 计算公式
- **武器 burstDPS**: `(damage * amount / avgShotTime) * count`
- **武器 sustainedDPS**: 考虑过热机制的持续 DPS
- **Beam 武器**: `damage * lifetime` 作为单发伤害
- **引擎速度**: `thrustForward / dragForward`
- **引擎加速度**: `thrustForward / mass`
- **推进器转向率**: `thrust / drag`

## 断言建议

- 档位显示：断言中列同时可见”简略/详细”切换按钮。（使用定位符 `ship-build-stats-mode-summary` / `ship-build-stats-mode-detail`）
- 档位切换：点击后断言属性列表内容发生变化（简略清单 vs 详细清单）。
- 字段对齐：按字段矩阵逐项断言标签存在性；并断言详细覆盖简略。
- 真实值字段：断言 `船体/护盾/速度/助推/巡航/船员/仓储` 非 `--`。
- 武器DPS字段：断言 `武器爆发输出值/武器持续性输出值/炮塔平均输出值` 为真实值（非 `--`）。
- 高度策略：断言中列属性区（`ship-build-stats-panel`）与已选详情区（`ship-build-selection`）无固定高度样式（不含 `h-48`、`72px`、`max-h-[300px]` 等）。

**注意**：所有 UI 元素定位符（data-testid）应使用本文件”建议的测试定位”部分定义的属性值，不应直接写在 test_tasks.md 中。

## 装备选择器 (Equipment Picker) UI 模式

### 概述
装备选择器是一个弹窗式界面，用于为飞船槽位选择装备。

### 定位符

| 元素 | data-testid | 说明 |
|------|--------------|------|
| 配装面板 | `ship-build-panel-fit` | 整个配装区域 |
| 左轨槽位类型按钮 | `.left-rail .slot-type-btn` | E(引擎)/S(护盾)/W(武器)/T(炮塔) |
| 槽位按钮 | `slot-{key}` | 具体槽位，如 `slot-engine-0` |
| 装备选择器 | `equipment-picker` | 装备候选列表容器 |
| 装备候选项 | `candidate-{id}` | 单个装备选项，`id` 为装备ID或 `empty` |
| 确认按钮 | `picker-confirm` | 确认选择 |
| 取消按钮 | `picker-cancel` | 取消选择 |

### 选择装备流程

1. 点击左轨槽位类型按钮 (E/S/W/T) 切换到对应槽位类型
2. 点击目标槽位按钮（如 `slot-engine-0`）打开选择器
3. 在装备候选列表中找到目标装备并点击
4. 点击确认按钮完成选择

### 筛选功能

选择器支持以下筛选：

| 筛选类型 | data-testid 模式 | 说明 |
|----------|------------------|------|
| 种族筛选 | `race-{id}` | 按种族筛选，如 `race-terran` |
| MK筛选 | `mk-{id}` | 按MK版本筛选，如 `mk-mk1` |
| 特性标签 | `tag-{id}` | 按特性筛选 |
| 分页 | `page-{n}` | 当装备过多时分页 |

## 测试用例装备配置

### 测试用例1: 大太刀 满装备

**船只信息**：
- ID: `ship_ter_m_corvette_02_a`
- nameId: `{20101,64801}`
- 中文名: 大太刀

**槽位统计**：
- engine: medium×1×1 = 1个挂载点
- thruster: medium×1×1 = 1个
- shield: medium×2×1 = 2个
- weapon: medium×4×1 = 4个 (highpower)
- turret: medium×2×1 = 2个

**满装备配置**：

| 槽位类型 | 装备ID | 中文名 | 数量 |
|---------|--------|--------|------|
| engine | `engine_ter_m_allround_01_mk1` | TER M 均衡引擎 Mk1 | 1 |
| shield | `shield_ter_m_standard_02_mk2` | TER M 护盾发生器 Mk2 | 2 |
| weapon | `weapon_ter_m_beam_01_mk2` | TER M 介子流 Mk2 | 4 |
| turret | `turret_ter_m_beam_01_mk1` | TER M 光束炮塔 Mk1 | 2 |

**精确DPS计算**：
- 武器爆发输出值: 23902.4 MW
- 武器持续性输出值: 2208.8 MW

### 测试用例2: 大阪 满装备

**船只信息**：
- ID: `ship_ter_l_destroyer_01_a`
- nameId: `{20101,60201}`
- 中文名: 大阪

**槽位统计**：
- engine: large×2×2 = 4个（预设6个）
- thruster: large×1×1 = 1个
- shield (专用): large×3×1 = 3个
- weapon: large×2×1 = 2个 (ter_destroyer_01)
- turret: large×3 + medium×10 = 13个

**预设装备配置**（ships.json中已配置）：

| 槽位类型 | 装备ID | 中文名 | 数量 |
|---------|--------|--------|------|
| engine | `engine_ter_l_allround_01_mk1` | TER L 均衡引擎 Mk1 | 6 |
| shield (专用L) | `shield_ter_l_standard_01_mk2` | TER L 护盾发生器 Mk2 | 2 |
| shield (专用L) | `shield_ter_l_standard_01_mk3` | TER L 护盾发生器 Mk3 | 2 |
| shield (挂载M) | `shield_ter_m_standard_02_mk1` | TER M 护盾发生器 Mk1 | 多个 |
| shield (挂载M) | `shield_ter_m_standard_02_mk2` | TER M 护盾发生器 Mk2 | 多个 |
| weapon | `weapon_ter_l_destroyer_01_mk1` | Terran主炮 | 6 |
| turret (large) | `turret_ter_l_beam_01_mk1` | TER L 光束炮塔 Mk1 | 6 |
| turret (large) | `turret_tel_l_plasma_01_mk1` | TEL L 等离子炮塔 Mk1 | 3 |
| turret (medium) | `turret_ter_m_gatling_02_mk1` | TER M 闪电炮塔 Mk1 | 多个 |
| turret (medium) | `turret_ter_m_laser_02_mk1` | TER M 脉冲炮塔 Mk1 | 多个 |
