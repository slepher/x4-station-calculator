# 需求说明：装备对比面板

## 目标
在船只建造视图的配装区，当 Picker 展开并选中新的装备时，显示装备对比面板（ShipBuildPanelEquipment），展示当前已装备与候选装备的属性对比。

## 已确认方案

### 1. 组件结构
- 组件名称：`ShipBuildPanelEquipment`
- 位置：`ShipBuildPanelStats` 上方
- 显示条件：Picker 展开并选中装备时显示
- 隐藏条件：
  - 当前装备和候选装备都为空时隐藏
  - Picker 收起时隐藏

### 2. 数据来源
- 当前装备：从 `pickerTarget.connectionKeys` 获取已装备的 `equipment_id`
- 候选装备：`highlightedEquipmentId`
- 使用 `useEquipmentStats` composable 的 `details` 函数获取详细数据

### 3. 叠加显示（方式A）
- 进度条显示：候选值作为进度条刻度，最大值为所有候选装备（未经筛选）各项数值的最大值
- 数字格式：`候选值(+正数|-负数)`，如 `100(+20|-10)`
- 颜色标识：蓝色表示正差值（候选 > 当前），粉色表示负差值（候选 < 当前）
- 叠加逻辑：
  - 候选装备数值 - 当前装备数值 = 差值
  - 差值为正：进度条向右延伸显示为蓝色
  - 差值为负：进度条向左缩减显示为粉色
- 特殊情况：
  - 候选为空：只显示当前装备
  - 当前为空：只显示候选装备
  - 两者都为空：隐藏面板
  - 候选与当前相同：只显示当前装备信息，不显示比较进度条

### 4. 候选装备卡片显示
- Picker 内每个候选装备卡片：显示 `summary` 函数结果（2 项关键数据）
- 布局：不增加卡片高度，原有布局稳定

### 5. 对比面板显示（Panel）
- Panel 区域：显示 `details` 函数结果（完整属性列表）
- 用于显示候选装备的属性信息
- **UI 布局要求：**
  - Header：直接显示候选装备名称（不带前缀）
  - 内容区：两列布局，风格与 `ShipBuildPanelStats` 一致
  - 不显示 Summary 区块
  - 只显示候选装备数值（暂不显示当前装备对比）
- 各装备类型详情字段：

#### Weapon/Turret Detail 字段
| 字段 | 显示标签 |
|------|----------|
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

#### Shield Detail 字段
| 字段 | 显示标签 |
|------|----------|
| shieldMax | 护盾最大值 |
| shieldRate | 护盾恢复率 |
| shieldDelay | 充能延迟 |

#### Engine Detail 字段
| 字段 | 显示标签 |
|------|----------|
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

#### Thruster Detail 字段
| 字段 | 显示标签 |
|------|----------|
| pitch | 俯仰推力 |
| yaw | 偏航推力 |
| roll | 翻滚推力 |
| strafe | 侧移推力 |
| pitchRate | 俯仰率 |
| yawRate | 偏航率 |
| rollRate | 翻滚率 |
| strafeSpeed | 侧移速度 |
| strafeAcceleration | 侧移加速度 |

### 6. 布局要求
- **展开前**（1:1:1）：Fit | Stats | Materials，三列各占 1/3
- **展开后**（2:1）：Fit 占 2/3，Right 占 1/3
  - Right 内部：Equipment 在上，Stats 在下（上下布局）
  - Materials 在展开后隐藏
- **间距要求：**
  - 展开前后，Stats 和 Picker（左列）间距不额外增加
  - 展开前，Stats 和 Materials 间距不额外增加
  - 展开后，Equipment/Stats（右边内部）和右边界距不额外增加

### 7. 类型变更
- `EngineSummary` 修改为：
  ```typescript
  export interface EngineSummary {
    speed: number
    travel: string // "${travelSpeed}:${travelCharge}"
  }
  ```

### 8. 各装备类型 Summary 显示项（Picker 卡片用）
- Weapon: burstDPS, range (2项)
- Turret: sustainedDPS, range (2项)
- Shield: shieldMax, shieldDelay (2项)
- Engine: speed, travel (2项) - travel 格式为 `${travelSpeed}:${travelCharge}`
- Thruster: strafeSpeed, yawRate (2项)

## 边界
### In Scope
- ShipBuildPanelEquipment 组件开发
- 与 ShipBuildPanelFit 的 Picker 状态联动
- Picker 候选装备卡片 summary 显示（2 项关键数据）
- Panel 对比面板 details 显示（完整属性列表）
- EngineSummary 类型修改

### Out of Scope
- 其他面板的改动
- 现有功能的重构

## 验收标准（DoD）
1. Picker 展开并选中装备时，对比面板在 ShipBuildPanelStats 上方显示
2. Picker 收起时，对比面板隐藏
3. 当前装备和候选装备都为空时，对比面板隐藏
4. Panel Header 直接显示候选装备名称（无前缀）
5. Panel 内容区为两列布局，风格与 ShipBuildPanelStats 一致
6. Panel 不显示 Summary 区块
7. Picker 候选装备卡片显示 summary 信息（2 项关键数据）
8. 布局比例：展开前 1:1:1，展开后 2:1（右边内上下布局）
9. 间距：展开前后 Status 和 Picker 间距不变，展开前 Status 和 Materials 间距不变

## 未决项
无。
