# Save Binding Specification

## Purpose
定义独立 save binding 数据层，使 binding 以 `gameGuid` 为唯一身份保存星区划分、覆盖范围、按需规划模块和 station plans，并与 empire 持久化解耦。

## ADDED Requirements

### Requirement: Standalone Binding Storage

系统 MUST 将 save binding 保存在独立 storage 中，而不是写入 empire 数据。

#### Scenario: 保存 binding
- **前提** 用户已创建或编辑某个 `gameGuid` 的 binding
- **当** 用户点击 `保存绑定`
- **那么** 系统 SHALL 将 binding 写入独立 `x4_save_bindings` storage
- **并且** 系统 SHALL NOT 将 binding 数据写入 `x4_empire_data`

#### Scenario: 同一 gameGuid 打开 binding
- **前提** `x4_save_bindings` 中已存在某个 `gameGuid` 的 binding
- **当** 用户从存档首页再次点击该 `gameGuid` 的 binding 入口
- **那么** 系统 SHALL 打开已有 binding
- **并且** 系统 SHALL NOT 创建第二份相同 `gameGuid` 的 binding

### Requirement: Binding View Archive Time

系统 MUST 将 `selectedArchiveTime` 作为 binding 视角，而不是 binding 身份。

#### Scenario: 切换 binding archive time
- **前提** 用户已打开某个 `gameGuid` 的 binding
- **当** 用户从存档首页选择另一个 time 进入 binding
- **那么** 系统 SHALL 更新该 binding 的 `selectedArchiveTime`
- **并且** 系统 SHALL 保持该 `gameGuid` 的 group 与 station plan 不变

### Requirement: Binding Groups

系统 MUST 在 binding 内保存星区划分和覆盖范围。

#### Scenario: 编辑 binding group
- **前提** 用户位于 binding Step 2
- **当** 用户创建或编辑 binding group
- **那么** 系统 SHALL 保存 group 名称、顺序、定位星区、jump range、coverage sectors
- **并且** 系统 SHALL 支持 connected groups
- **并且** 系统 SHALL 标记 binding dirty

### Requirement: Derived Save Station Views

系统 MUST 从当前 archive 与 binding group coverage 派生 save station views。

#### Scenario: 覆盖范围内存在 save station
- **前提** 某个 binding group 已设置 coverage
- **并且** 当前 archive 的 coverage 范围内存在 player save station
- **当** 用户进入该 group 的 station 视图
- **那么** 系统 SHALL 自动显示这些 save stations
- **并且** 系统 SHALL NOT 因显示这些 save stations 而自动创建 `BindingStationPlan`

#### Scenario: save station 没有规划 plan
- **前提** 某个 covered save station 没有对应 `BindingStationPlan`
- **当** 系统生成 station view
- **那么** 该 station view 的 planned modules SHALL 为空列表

### Requirement: Binding Station Plans

系统 MUST 使用统一的 `BindingStationPlan` 类型保存 station 规划，通过 `saveStationCode` 派生类型。

#### Scenario: save-station plan
- **前提** 用户为某个 covered save station 创建规划
- **当** 系统保存 `BindingStationPlan`
- **那么** 系统 SHALL 写入 `saveStationCode`
- **并且** 系统 SHALL 保存 modules、settings、name
- **并且** 该 plan SHALL 参与量化生产计算

#### Scenario: virtual-station plan
- **前提** 用户创建未来占位站
- **当** 系统保存 `BindingStationPlan`
- **那么** 系统 SHALL NOT 写入 `saveStationCode`
- **并且** 系统 SHALL 保存 name、type、modules、settings
- **并且** 该 plan SHALL 参与量化生产计算

#### Scenario: 用户导入规划模块到 save station
- **前提** 某个 covered save station 没有 `BindingStationPlan`
- **当** 用户从 source empire station 导入规划模块
- **那么** 系统 SHALL 创建包含 `saveStationCode` 的 station plan
- **并且** SHALL 写入复制得到的 planned modules 与 settings
- **并且** SHALL 标记 binding dirty

#### Scenario: 用户清空 station 规划
- **前提** 某个 station 已存在 `BindingStationPlan`
- **当** 用户清空该 station 的规划 modules
- **那么** 系统 SHALL 删除该 plan
- **并且** SHALL NOT 创建 trade station
- **并且** 该 save station SHALL 继续作为 archive 派生 view 存在

### Requirement: Trade Station

系统 MUST 将星区中转站作为独立类型；它不参与普通 station modules 生产计算，但在 save-binding source 下映射为量化生产中的 transit hub。

#### Scenario: 创建星区中转站
- **前提** 用户位于 binding station 规划上下文
- **当** 用户创建星区中转站
- **那么** 系统 SHALL 在 `BindingSectorGroup.tradeStation` 创建 `TradeStationBinding`
- **并且** SHALL NOT 保存 modules、settings、type 字段
- **并且** SHALL 标记 binding dirty

#### Scenario: 星区中转站映射为 transit hub
- **前提** 某个 group 存在 `tradeStation`
- **当** 量化生产计算 binding source
- **那么** 系统 SHALL 将 `tradeStation` 映射为星区中转站 / transit hub
- **并且** SHALL NOT 将 `tradeStation` 映射为普通 station
- **并且** 普通 station modules 生产计算 SHALL 只使用 covered save station views 的 planned modules 与 virtual station plans

#### Scenario: 绑定 save station 为中转站
- **前提** 某个 save station 尚未绑定
- **当** 用户将其绑定为星区中转站
- **那么** 系统 SHALL 创建包含 `saveStationCode` 的 `TradeStationBinding`
- **并且** 系统 SHALL 确保该 `saveStationCode` 不存在于 `stationPlans`

### Requirement: Source Empire Copy Import

系统 MUST 将 source empire station 作为一次性规划模板。

#### Scenario: 从 source empire 导入
- **前提** 用户选择了 source empire
- **并且** source empire 中存在 station planning
- **当** 用户将该 station 导入到 binding station plan
- **那么** 系统 SHALL 复制当时的 name、type、modules、settings
- **并且** SHALL NOT 在 station plan 中保存持续同步用的 empire station 引用

#### Scenario: 导入后 source empire 改变
- **前提** 某个 binding station plan 已从 source empire station 复制规划数据
- **当** 用户后续修改 source empire station
- **那么** 已复制的 binding station plan SHALL NOT 自动变化

### Requirement: Drag Interaction

系统 MUST 提供一致的拖拽交互体验。

#### Scenario: 从 save panel 拖拽自由空间站
- **前提** 用户在 save panel Step 3
- **当** 用户拖拽自由空间站到地图
- **那么** 系统 SHALL 创建无 `saveStationCode` 的 `BindingStationPlan`
- **并且** 拖拽预览 SHALL 显示正确的图标风格（owner 颜色、虚线外圈）

#### Scenario: 从 save panel 拖拽星区中转站
- **前提** 用户在 save panel Step 3
- **当** 用户拖拽星区中转站到地图
- **那么** 系统 SHALL 创建 `TradeStationBinding`
- **并且** 拖拽预览 SHALL 显示中转站图标风格

#### Scenario: 拖拽已放置的 binding station
- **前提** 地图上已存在放置的 binding station
- **当** 用户拖拽该 station 到新位置
- **那么** 系统 SHALL 调用 `setStationPlanPosition` 移动位置
- **并且** 系统 SHALL NOT 创建新的 station plan

#### Scenario: 拖拽已放置的星区中转站
- **前提** 地图上已存在放置的 trade station
- **当** 用户拖拽该 station 到新位置
- **那么** 系统 SHALL 调用 `setTradeStationPosition` 移动位置
- **并且** 系统 SHALL NOT 创建新的 trade station

### Requirement: Binding Explicit Save

系统 MUST 使用显式 binding 保存流程。

#### Scenario: binding 变更后未保存
- **前提** 用户已修改 binding group、station plan 或 trade station
- **当** 用户尚未点击 `保存绑定`
- **那么** 系统 SHALL 显示 binding dirty 状态
- **并且** SHALL NOT 将改动持久化到 `x4_save_bindings`

#### Scenario: 保存 binding
- **前提** binding 存在 dirty 改动
- **当** 用户点击 `保存绑定`
- **那么** 系统 SHALL 持久化 binding 改动
- **并且** SHALL 清除 binding dirty 状态
