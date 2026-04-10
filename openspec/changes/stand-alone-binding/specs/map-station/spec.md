# Map Station Specification

## Purpose
调整地图 save binding 工作流，使地图面板以独立 binding store 为数据源，并把 Step 2/Step 3 从"逐个绑定 empire station"改为"星区覆盖自动派生 save station + 按需规划模块"。

## MODIFIED Requirements

### Requirement: Binding Entry in Save Homepage

系统 MUST 从存档首页打开或创建独立 save binding。

#### Scenario: 用户点击 guid binding 图标
- **前提** 用户位于存档首页
- **当** 用户点击某个 `gameGuid` 的 binding 图标
- **那么** 系统 SHALL 打开或创建该 `gameGuid` 的唯一 binding
- **并且** SHALL 进入 binding group 编辑视图

#### Scenario: 用户点击 time binding 图标
- **前提** 用户位于存档首页某个 time 条目
- **当** 用户点击该 time 的 binding 图标
- **那么** 系统 SHALL 打开同一 `gameGuid` 的 binding
- **并且** SHALL 将 `selectedArchiveTime` 设置为该 time

### Requirement: Step 2 Binding Group Editing

系统 MUST 在 Step 2 编辑 binding groups，而不是 empire sectors。

#### Scenario: 用户编辑 binding group
- **前提** 用户已进入 Step 2
- **当** 用户创建、重命名、排序或展开某个 group
- **那么** 系统 SHALL 读写独立 binding store 中的 groups
- **并且** SHALL NOT 读写 `activeEmpire.sectors`

### Requirement: Step 3 Derived Station Planning

系统 MUST 在 Step 3 显示 coverage 派生的 save stations 与用户创建的 station plans。

#### Scenario: 用户进入某个 group 的 Step 3
- **前提** group 已设置 coverage
- **当** 用户进入 Step 3
- **那么** 系统 SHALL 按 coverage 自动列出当前 archive 中的 save stations
- **并且** SHALL 显示已有 `BindingStationPlan`（包括 save-station 和 virtual-station）
- **并且** SHALL 显示星区中转站（如有）
- **并且** SHALL NOT 要求用户逐个绑定现有 save station

#### Scenario: 用户导入 empire station 规划
- **前提** 用户在 Step 3 选择了 source empire
- **当** 用户将某个 source empire station 的规划导入到 save station plan
- **那么** 系统 SHALL 在 binding 中创建或更新 planned modules
- **并且** SHALL NOT 修改 source empire station

#### Scenario: 用户创建星区中转站
- **前提** 用户在 Step 3
- **当** 用户创建星区中转站
- **那么** 系统 SHALL 在 `BindingSectorGroup.tradeStation` 创建 `TradeStationBinding`
- **并且** 该 station SHALL NOT 参与量化生产计算

### Requirement: Drag Interaction on Map

系统 MUST 提供一致的拖拽交互。

#### Scenario: 拖拽自由空间站到地图
- **前提** 用户在 Step 3
- **当** 用户拖拽自由空间站到地图覆盖范围内
- **那么** 系统 SHALL 创建无 `saveStationCode` 的 `BindingStationPlan`
- **并且** SHALL 设置 position 和 sectorMacro

#### Scenario: 拖拽星区中转站到地图
- **前提** 用户在 Step 3
- **当** 用户拖拽星区中转站到地图覆盖范围内
- **那么** 系统 SHALL 创建 `TradeStationBinding`
- **并且** SHALL 设置 position 和 sectorMacro

#### Scenario: 拖拽已放置的 station
- **前提** 地图上已存在 binding station 或 trade station
- **当** 用户拖拽该 station 到新位置
- **那么** 系统 SHALL 移动该 station 的位置
- **并且** SHALL NOT 创建新的 station plan

### Requirement: Binding Save Status UI

系统 MUST 在 binding UI 中表达独立保存状态。

#### Scenario: binding 出现未保存改动
- **前提** 用户在地图 binding 面板中修改了 group、station plan 或 trade station
- **当** 改动尚未保存
- **那么** 系统 SHALL 显示 binding dirty 状态
- **并且** SHALL 提供 `保存绑定` 操作

#### Scenario: 用户关闭 dirty binding 面板
- **前提** binding 存在未保存改动
- **当** 用户关闭面板或切换到另一个 binding
- **那么** 系统 SHALL 提供保存、放弃或继续编辑的选择