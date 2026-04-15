# Live Station Toolbar Specification

## Purpose

描述 LiveStationToolbar 的界面结构和功能，包括实时/规划模式切换、只读字段展示、以及规划模式下的编辑控件。

## Requirements

### Requirement: 工具栏布局结构 (Toolbar Layout Structure)

LiveStationToolbar SHALL 显示单行紧凑布局，使用垂直分割线分为三组：

- **第一组**: 站点标识（名称、编码、模式切换按钮）
- **第二组**: 环境信息（星区资源、光伏效率、单位吞吐量）
- **第三组**: 规划控件（偏好种族、工人运算、显示缺口）——仅规划模式显示

#### Scenario: 工具栏三组显示

- **前提** 用户查看 LiveStationToolbar
- **当** 工具栏渲染时
- **那么** 工具栏 SHALL 显示名称、编码、模式切换按钮
- **并且** 第二组 SHALL 显示星区资源、光伏效率、单位吞吐量
- **并且** 两组之间 SHALL 有垂直分割线

### Requirement: 站点名称可编辑 (Station Name Editable)

站点名称输入框 SHALL 始终可编辑，无论实时模式还是规划模式。

#### Scenario: 编辑站点名称

- **前提** 用户查看 LiveStationToolbar
- **当** 用户点击站点名称输入框
- **那么** 输入框 SHALL 变为可编辑状态
- **并且** 用户修改名称后自动保存

### Requirement: 站点编码只读 (Station Code Readonly)

站点编码 SHALL 以只读方式展示存档中 station 的 `code` 字段，不可编辑。

#### Scenario: 显示站点编码

- **前提** 存档中存在 station 数据
- **当** 工具栏渲染时
- **那么** 编码字段 SHALL 显示 station.code（如 `FIX-154`）
- **并且** 编码字段 SHALL 使用灰色背景样式表示只读

### Requirement: 模式切换按钮 (Mode Toggle Button)

模式切换按钮 SHALL 支持实时/规划模式切换，并根据数据状态决定初始模式和按钮状态。

#### Scenario: 存在规划和存档数据

- **前提** 存在 bindingStation 且存在 saveStation
- **当** 工具栏初始化时
- **那么** 默认模式 SHALL 为规划模式
- **并且** 切换按钮 SHALL 可点击切换模式

#### Scenario: 仅存在规划数据

- **前提** 存在 bindingStation 且不存在 saveStation
- **当** 工具栏初始化时
- **那么** 默认模式 SHALL 为规划模式
- **并且** 切换按钮 SHALL 禁用（灰色，不可点击）

#### Scenario: 仅存在存档数据

- **前提** 存在 saveStation 且不存在 bindingStation
- **当** 工具栏初始化时
- **那么** 默认模式 SHALL 为实时模式
- **并且** 切换按钮 SHALL 可点击切换为规划模式

#### Scenario: 切换模式

- **前提** 切换按钮可点击
- **当** 用户点击切换按钮
- **那么** 当前模式 SHALL 切换为另一模式
- **并且** 按钮标签 SHALL 更新（实时 → 规划 或 规划 → 实时）

### Requirement: 星区资源只读展示 (Sector Resources Readonly Display)

星区资源 SHALL 以只读 popover 形式展示存档中 station 所在 sector 的 resources 列表，不可编辑。

#### Scenario: 显示星区资源列表

- **前提** 存档中存在 station 的 sectorMacro
- **当** 用户点击星区资源徽章
- **那么** popover SHALL 显示该 sector 的 resources 列表
- **并且** popover 内容 SHALL 为只读文本列表（无 checkbox）

#### Scenario: 无星区资源

- **前提** sector 无 resources 数据
- **当** 工具栏渲染时
- **那么** 星区资源徽章 SHALL 显示"无资源"

### Requirement: 光伏效率只读展示 (Sunlight Efficiency Readonly Display)

光伏效率 SHALL 以只读数值展示存档中 station 所在 sector 的 sunlight 值，不可编辑。

#### Scenario: 显示光伏效率

- **前提** 存档中存在 station 的 sectorMacro
- **当** 工具栏渲染时
- **那么** 光伏效率 SHALL 显示 sector.sunlight 值
- **并且** 显示样式 SHALL 为静态数值 + `%` 单位（无输入控件）

### Requirement: 单位吞吐量只读展示 (Single Berth Throughput Readonly Display)

单位吞吐量 SHALL 以只读数值展示，不可编辑。

#### Scenario: 显示单位吞吐量

- **前提** 工具栏渲染
- **当** 用户查看单位吞吐量字段
- **那么** 字段 SHALL 显示计算后的吞吐量数值
- **并且** 显示样式 SHALL 为静态数值 + `m³/h` 单位

### Requirement: 规划模式专属控件 (Planning Mode Controls)

偏好种族、工人运算、显示缺口 SHALL 仅在规划模式显示，实时模式隐藏。

#### Scenario: 规划模式显示控件

- **前提** 当前模式为规划模式
- **当** 工具栏渲染时
- **那么** 偏好种族、工人运算、显示缺口 SHALL 显示
- **并且** 各控件 SHALL 可正常编辑

#### Scenario: 实时模式隐藏控件

- **前提** 当前模式为实时模式
- **当** 工具栏渲染时
- **那么** 偏好种族、工人运算、显示缺口 SHALL 隐藏

### Requirement: 删除字段 (Removed Fields)

站点类型、站点数量、运输时间 SHALL 从 LiveStationToolbar 中移除。

#### Scenario: 不显示删除字段

- **前提** 工具栏渲染
- **当** 用户查看 LiveStationToolbar
- **那么** 站点类型、站点数量、运输时间 SHALL 不显示

### Requirement: 偏好种族编辑 (Race Preference Editable)

偏好种族下拉菜单 SHALL 仅在规划模式下显示并可编辑。

#### Scenario: 编辑偏好种族

- **前提** 当前模式为规划模式
- **当** 用户选择偏好种族
- **那么** settings.racePreference SHALL 更新
- **并且** 自动模块生成 SHALL 使用新种族偏好

### Requirement: 工人运算开关 (Workforce Calculation Toggle)

工人运算开关 SHALL 仅在规划模式下显示并可切换。

#### Scenario: 切换工人运算

- **前提** 当前模式为规划模式
- **当** 用户点击工人运算开关切换为 ON
- **那么** settings.considerWorkforceForAutoFill SHALL 设为 true
- **并且** 按钮 SHALL 变为绿色

### Requirement: 显示缺口开关 (Show Empire Gaps Toggle)

显示缺口开关 SHALL 仅在规划模式下显示并可切换。

#### Scenario: 切换显示缺口

- **前提** 当前模式为规划模式
- **当** 用户点击显示缺口开关切换为 ON
- **那么** settings.showEmpireGaps SHALL 设为 true
- **并且** 按钮 SHALL 变为绿色
- **并且** 空间站视图 SHALL 显示帝国缺口分组