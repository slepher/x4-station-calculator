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

- 状态：`大太刀已选`
  - 进入路径：`class=M` -> `race=terran` -> `type=corvette` -> 点击 `大太刀` (ship_ter_m_corvette_02_a)
  - 可观察结果：`ship-build-panel-stats`、`ship-build-selection` 可见
  - 预设装备：引擎1、推进器1、护盾2、武器4、炮塔2
- 状态：`大阪已选`
  - 进入路径：`class=L` -> `race=terran` -> `type=destroyer` -> 点击 `大阪` (ship_ter_l_destroyer_01_a)
  - 可观察结果：`ship-build-panel-stats`、`ship-build-selection` 可见
  - 预设装备：引擎6、护盾4(专用)+挂载M、武器6、炮塔9
- 切换：`大太刀已选 -> 详细档位`
  - 操作：点击 `ship-build-stats-mode-detail`
  - 可观察结果：详细字段集合可见，且包含真实值与占位值并存
- 切换：`详细档位 -> 简略档位`
  - 操作：点击 `ship-build-stats-mode-summary`
  - 可观察结果：简略字段集合可见（18项）

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
- 进度条比例：断言进度条元素的宽度或计算比例值正确。进度条容器通常有 `data-testid` 属性，格式为 `ship-build-stats-bar-{statKey}`。

**注意**：所有 UI 元素定位符（data-testid）应使用本文件”建议的测试定位”部分定义的属性值，不应直接写在 test_tasks.md 中。

## 进度条 Max 值映射

### 概述
进度条的 max 值来源于 `default_maxes.json`，根据飞船的 class (ship_xl / ship_l / ship_m / ship_s) 选择对应的最大值。

### 数据映射表

| Stat Key | default_maxes 字段 | ship_xl | ship_l | ship_m | ship_s |
|----------|-------------------|---------|--------|--------|--------|
| hull | hull | 1,795,200 | 253,200 | 46,800 | 8,040 |
| shield | shield_value | 1,376,898 | 765,000 | 86,549 | 10,554 |
| shield_recharge_rate | shield_rate | 5,473 | 2,194 | 922 | 1,258 |
| shield_recharge_delay | shield_delay | 0 | 0 | 0.57 | 13.9 |
| shield_group_avg | group_shield_value | 54,734 | 36,489 | 86,549 | 10,554 |
| radar_range | radar_range | 48,000 | 96,000 | 48,000 | 48,000 |
| weapon_burst | weapon_burst | 971,277 | 69,817 | 71,851 | 52,489 |
| weapon_sustained | weapon_sustained | 361,404 | 25,323 | 21,292 | 13,235 |
| turret_avg | turret_burst | 24,729 | 9,260 | 948 | 0 |
| speed | engine_forward | 654 | 720 | 1,959 | 2,145 |
| acceleration | engine_acceleration | 287 | 200 | 435 | 1,557 |
| boost_speed | boost_speed | 3,687 | 5,130 | 14,855 | 18,604 |
| boost_acceleration | boost_acceleration | 731 | 641 | 3,248 | 9,851 |
| boost_duration | boost_duration | 46 | 46 | 31.7 | 26.4 |
| boost_recharge | boost_recharge | 3.3 | 3.3 | 2.0 | 10.0 |
| travel_speed | travel_speed | 29,777 | 30,204 | 24,724 | 41,859 |
| travel_acceleration | travel_acceleration | 424 | 558 | 1,065 | 3,160 |
| travel_charge_time | travel_charge_time | 30 | 20 | 8 | 6 |
| strafe_speed | thruster_horizontal_speed | 57 | 119 | 404 | 421 |
| strafe_acceleration | thruster_horizontal_acceleration | 25 | 43 | 202 | 1,053 |
| yaw | engine_yaw | 0.11 | 0.56 | 2.0 | 4.3 |
| pitch | engine_pitch | 0.11 | 0.56 | 2.5 | 4.3 |
| roll | engine_roll | 0.10 | 0.70 | 3.3 | 5.1 |
| crew | capacity_crew | 406 | 226 | 26 | 8 |
| storage_container | capacity_container | 56,000 | 62,000 | 15,100 | 4,120 |
| storage_solid | capacity_solid | 0 | 57,600 | 12,000 | 5,480 |
| storage_liquid | capacity_liquid | 0 | 54,000 | 12,960 | 510 |
| storage_condensed | capacity_condensate | 0 | 0 | 4,300 | 250 |
| storage_unit | capacity_unit | 247 | 74 | 21 | 4 |
| missile | capacity_missile | 6,144 | 2,684 | 120 | 41 |
| deployable | capacity_deployable | 454 | 254 | 104 | 54 |
| countermeasure | capacity_countermeasure | 44 | 24 | 12 | 8 |
| dock_m_count | dock_ship_m | 4 | 1 | 0 | 0 |
| dock_m_capacity | capacity_ship_m | 8 | 2 | 0 | 0 |
| dock_s_count | dock_ship_s | 21 | 8 | 1 | 0 |
| dock_s_capacity | capacity_ship_s | 100 | 16 | 1 | 0 |

### 进度条比例计算规则

1. **计算公式**: `ratio = min(currentValue / maxValue, 1)`
2. **边界情况**:
   - 如果 currentValue = 0 且 maxValue = 0，显示 0%
   - 如果 maxValue = 0 且 currentValue > 0，显示 100%
   - 如果 currentValue >= maxValue，显示 100%（不超出显示）

### 定位符

进度条相关元素定位符：

| 元素 | data-testid 模式 | 说明 |
|------|------------------|------|
| 进度条容器 | `ship-build-stats-bar-{statKey}` | 进度条外层容器 |
| 进度条填充 | `.stats-bar-fill` | 进度条填充元素（通过 class 选择） |
| 进度条数值 | `ship-build-stats-value-{statKey}` | 显示当前值的元素 |

### 测试样本

**大太刀 (Odachi, ship_m)**:
- 船体: 16,100 / 46,800 ≈ 34.4%
- 速度: 464 / 1,959 ≈ 23.7%
- 船员: 4 / 26 ≈ 15.4%

**大阪 (Osaka, ship_l)**:
- 船体: 95,000 / 253,200 ≈ 37.5%
- 速度: 108 / 720 ≈ 15.0%
- 船员: 75 / 226 ≈ 33.2%

## 批量校验口径（3.5 / 3.6）

- 场景 `3.5` 与 `3.6` 使用批量校验，不再在 `test_tasks.md` 逐字段列出 36 条断言。
- 批量校验分两步：
  - 先采集 old/new 两套 36 项详细字段快照并做差异比较；
  - 再将 new 快照与 `tests/fixtures/ship-build-stat-expected.json` 中对应 `detail` 基准做全量比对。
- old/new 差异容差规则：单字段绝对误差不超过 `max(1% * |new|, 1)`；非数值或单位不一致视为差异。
- 断言口径统一为“差异项数量”，`#期望: [0]` 表示无差异项。

## 语言切换

### 概述
应用使用 Cookie (`user_locale`) 存储语言偏好，而非 localStorage。语言切换需要通过 UI 操作触发，不能直接设置 localStorage/Cookie。

### 切换方法
使用页面上的语言选择器 `<select>` 元素：

```typescript
// 通过 UI 选择器切换到中文
const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
await langSelect.selectOption('zh-CN')
```

### 注意事项
- 直接设置 `localStorage.setItem('locale', ...)` 或 Cookie 不会触发翻译更新
- 语言选择器位于 Toolbar 区域
- 切换语言后，应用会动态加载语言包并重新渲染 UI

## 槽位状态检查

### 概述
槽位状态在配装面板的左轨槽位类型切换后显示，每个槽位按钮显示已选装备名称和数量。

### 定位符

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 槽位按钮 | `[data-testid^="slot-"]` | 槽位按钮，key 如 `slot-engine-0` |
| 槽位已选装备名 | `.slot-row-value` | 槽位按钮内的已选装备名称 |
| 槽位数量显示 | `.slot-row-count` | 格式如 `1/1`，表示当前数量/总数 |
| 槽位候选数 | `.slot-row-candidate` | 可用候选装备数量 |

### 检查槽位装备状态

```typescript
// 检查引擎槽位是否装备了指定装备
const slotEngine = page.locator('[data-testid="slot-engine-0"]')
await expect(slotEngine.locator('.slot-row-value')).toContainText('TER M 均衡引擎 Mk1')

// 检查护盾槽位数量
const slotShield = page.locator('[data-testid="slot-shield-0"]')
await expect(slotShield.locator('.slot-row-count')).toContainText('2/2')
```

### 蓝图/飞船信息检查

| 元素 | 选择器 | 说明 |
|------|--------|------|
| 飞船名称 | `[data-testid="ship-build-ship-name"]` | 已选飞船/蓝图名称 |
| 已选详情区 | `[data-testid="ship-build-selection"]` | 包含飞船信息和装备概览 |

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

## 测试运行

### 待测试用例 (进度条 Max 值)

新增进度条最大值相关测试用例：

- [ ] 3.7 Case: M级船最大值映射
- [ ] 3.8 Case: L级船最大值映射
- [ ] 3.9 Case: 进度条比例计算
- [ ] 3.10 Case: 进度条边界-当前值等于max
- [ ] 3.11 Case: 进度条边界-当前值超过max
- [ ] 3.12 Case: S级船最大值映射
- [ ] 3.13 Case: XL级船最大值映射

### 2026-03-03 (第二次运行)

#### 状态测试

- [✓] 2.1 状态: 仅载入大太刀
- [✓] 2.2 状态: 仅载入大阪

#### 场景测试

- [✓] 3.1 Case: 简略字段对齐
- [✓] 3.2 Case: 详细字段对齐
- [✓] 3.3 Case: 详细档位真实值
- [✓] 3.4 Case: 取消固定高度限制
- [✓] 3.5 Case: 大太刀满装备DPS计算
- [✓] 3.6 Case: 大阪满装备DPS计算

### 2026-03-02 (首次运行)

**已解决的问题**（迁移到 2026-03-03）：
- stats panel 渲染问题已解决
- 状态测试 2.1, 2.2 现已通过
- 场景测试 3.1 现已通过

**遗留问题**：
- 3.5, 3.6 的 old/new 统计逻辑切换功能未实现（test_defect）
