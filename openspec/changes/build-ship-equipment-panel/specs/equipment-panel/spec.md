# Ship Build Equipment Panel Specification

## Purpose

在船只建造视图的配装区，当 Picker 展开并选中装备时，显示装备对比面板（ShipBuildPanelEquipment），展示当前已装备与候选装备的属性对比。

## ADDED Requirements

### Requirement: Equipment Comparison Panel Display

#### Scenario: Panel Shows Above Stats When Picker Is Open
- **前提**：用户在船只建造视图已选择一艘飞船，并打开了某个 slot group 的 Picker。
- **当**：Picker 展开并选中一个候选装备。
- **那么**：系统 SHALL 在 `ShipBuildPanelStats` 上方显示 `ShipBuildPanelEquipment` 对比面板。

#### Scenario: Panel Hides When Picker Closes
- **前提**：`ShipBuildPanelEquipment` 面板正在显示。
- **当**：用户关闭 Picker 或取消选择。
- **那么**：系统 SHALL 隐藏 `ShipBuildPanelEquipment` 面板。

#### Scenario: Panel Hides When Both Current And Candidate Are Empty
- **前提**：Picker 仍然展开。
- **当**：当前装备为空且候选装备为空。
- **那么**：系统 SHALL 隐藏 `ShipBuildPanelEquipment` 面板。

### Requirement: Overlay Display (Method A)

#### Scenario: Progress Bar Shows Candidate Value With Max As Maximum Of All Candidates
- **前提**：候选装备存在且有数值。
- **当**：系统渲染对比面板的进度条。
- **那么**：系统 SHALL 以所有候选装备（未经筛选）中的最大值作为进度条的最大刻度。
- **并且**：进度条 SHALL 显示候选装备的数值。

#### Scenario: Number Format Shows Delta In Parentheses
- **前提**：存在候选装备和当前装备的对比数据。
- **当**：系统渲染数值标签。
- **那么**：系统 SHALL 显示格式为 `候选值(+正数|-负数)`，例如 `100(+20|-10)`。
- **并且**：正差值 SHALL 显示为蓝色（候选 > 当前）。
- **并且**：负差值 SHALL 显示为粉色（候选 < 当前）。

#### Scenario: Handle Empty Current Or Candidate
- **前提**：对比数据中当前装备或候选装备为空。
- **当**：系统渲染对比面板。
- **那么**：
  - 候选为空：仅显示当前装备数值
  - 当前为空：仅显示候选装备数值
  - 两者都空：隐藏面板（见上一条规则）

#### Scenario: Handle Same Equipment As Current And Candidate
- **前提**：候选装备 ID 与当前装备 ID 相同。
- **当**：系统渲染对比面板。
- **那么**：系统 SHALL 仅显示当前装备信息，不显示比较进度条。

### Requirement: Candidate Card Summary Display (Picker)

#### Scenario: Picker Card Shows Summary
- **前提**：Picker 内显示候选装备卡片。
- **当**：系统渲染候选装备卡片信息。
- **那么**：系统 SHALL 显示 `summary` 数据（2 项关键数据）。
- **并且**：原有布局 SHALL 保持稳定，不增加卡片高度。

### Requirement: Panel Shows Details (Comparison Panel)

#### Scenario: Panel Shows Details For Comparison
- **前提**：对比面板（ShipBuildPanelEquipment）正在显示。
- **当**：系统渲染对比面板内容。
- **那么**：系统 SHALL 显示 `details` 数据（完整属性列表）。
- **并且**：用于当前装备与候选装备的详细属性对比。

### Requirement: Equipment Type Specific Details

#### Scenario: Weapon Shows All Detail Fields
- **前提**：候选装备类型为 `weapon`。
- **当**：系统渲染对比面板 details 信息。
- **那么**：系统 SHALL 显示以下字段：`burstDPS`, `sustainedDPS`, `range`, `singleDamage`, `avgShotTime`, `ammo`, `ammoReload`, `chargetime`, `timeToOverheat`, `cooldelay`, `coolTime`, `cycleTime`。

#### Scenario: Turret Shows All Detail Fields
- **前提**：候选装备类型为 `turret`。
- **当**：系统渲染对比面板 details 信息。
- **那么**：系统 SHALL 显示以下字段：`burstDPS`, `sustainedDPS`, `range`, `singleDamage`, `avgShotTime`, `ammo`, `ammoReload`, `chargetime`, `timeToOverheat`, `cooldelay`, `coolTime`, `cycleTime`。

#### Scenario: Shield Shows All Detail Fields
- **前提**：候选装备类型为 `shield`。
- **当**：系统渲染对比面板 details 信息。
- **那么**：系统 SHALL 显示以下字段：`shieldMax`, `shieldRate`, `shieldDelay`。

#### Scenario: Engine Shows All Detail Fields
- **前提**：候选装备类型为 `engine`。
- **当**：系统渲染对比面板 details 信息。
- **那么**：系统 SHALL 显示以下字段：`thrustForward`, `speed`, `acceleration`, `boostMultiplier`, `boostSpeed`, `boostAccel`, `travelThrust`, `travelSpeed`, `travelCharge`, `travelAcceleration`。

#### Scenario: Thruster Shows All Detail Fields
- **前提**：候选装备类型为 `thruster`。
- **当**：系统渲染对比面板 details 信息。
- **那么**：系统 SHALL 显示以下字段：`pitch`, `yaw`, `roll`, `strafe`, `pitchRate`, `yawRate`, `rollRate`, `strafeSpeed`, `strafeAcceleration`。

### Requirement: Equipment Type Specific Summary

#### Scenario: Weapon Shows BurstDPS And Range
- **前提**：候选装备类型为 `weapon`。
- **当**：系统渲染 summary 信息。
- **那么**：系统 SHALL 显示 `burstDPS` 和 `range` 两项数据。

#### Scenario: Turret Shows SustainedDPS And Range
- **前提**：候选装备类型为 `turret`。
- **当**：系统渲染 summary 信息。
- **那么**：系统 SHALL 显示 `sustainedDPS` 和 `range` 两项数据。

#### Scenario: Shield Shows ShieldMax And ShieldDelay
- **前提**：候选装备类型为 `shield`。
- **当**：系统渲染 summary 信息。
- **那么**：系统 SHALL 显示 `shieldMax` 和 `shieldDelay` 两项数据。

#### Scenario: Engine Shows Speed And Travel
- **前提**：候选装备类型为 `engine`。
- **当**：系统渲染 summary 信息。
- **那么**：系统 SHALL 显示 `speed` 和 `travel` 两项数据。
- **并且**：`travel` SHALL 格式为 `${travelSpeed}:${travelCharge}`。

#### Scenario: Thruster Shows StrafeSpeed And YawRate
- **前提**：候选装备类型为 `thruster`。
- **当**：系统渲染 summary 信息。
- **那么**：系统 SHALL 显示 `strafeSpeed` 和 `yawRate` 两项数据。

### Requirement: EngineSummary Type Definition

#### Scenario: EngineSummary Uses Updated Type
- **前提**：系统使用 `EngineSummary` 类型。
- **当**：定义或导入 `EngineSummary`。
- **那么**：系统 SHALL 使用以下结构：
  ```typescript
  export interface EngineSummary {
    speed: number
    travel: string // "${travelSpeed}:${travelCharge}"
  }
  ```

### Requirement: Integration With ShipBuildPanelFit

#### Scenario: Receive Picker State From Parent
- **前提**：`ShipBuildPanelFit` 组件渲染 Picker。
- **当**：Picker 展开状态或选中装备发生变化。
- **那么**：系统 SHALL 将状态变化传递给 `ShipBuildPanelEquipment` 组件。

#### Scenario: Get Current Equipment From Connection Keys
- **前提**：需要获取当前已装备的装备。
- **当**：系统获取当前装备数据。
- **那么**：系统 SHALL 从 `pickerTarget.connectionKeys` 获取已装备的 `equipment_id`。
- **并且**：使用 `useEquipmentStats` composable 获取详细数据。

#### Scenario: Get Candidate Equipment From Highlighted Id
- **前提**：需要获取候选装备。
- **当**：系统获取候选装备数据。
- **那么**：系统 SHALL 使用 `highlightedEquipmentId` 获取候选装备信息。
- **并且**：使用 `useEquipmentStats` composable 获取详细数据。
