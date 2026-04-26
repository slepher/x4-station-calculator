# Remove Workbench Specification

## Purpose

定义 production workbench 旧兼容接口层的移除标准，固定 store / presenter / view 的长期边界，避免继续以 panel getter 或 workbench wrapper 形式扩张主路径。

## ADDED Requirements

### Requirement: Production Store SHALL Remove Legacy Workbench Exports

production store MUST 移除旧 `workbench` / panel getter 兼容接口出口。

#### Scenario: 旧 getter 不再作为正式主路径

**前提** 外部代码读取 production store  
**当** 访问正式主入口  
**那么** 系统 SHALL 使用 `session`、`context`、`stationState` 与正式动作接口  
**并且** store MUST NOT 继续导出 `getTabs`、`getToolbarXxx`、`getWareflowXxx`、`getDashboardXxx` 一类兼容 getter

#### Scenario: 旧行为包装接口被删除

**前提** 外部代码调用旧行为包装接口  
**当** 本次重构完成  
**那么** store MUST NOT 继续导出 `selectOverview`、`selectTransit`、`expandSector`、`openImport` 这类旧包装入口  
**并且** 行为调用 SHALL 迁移到正式动作接口或正式状态写入口

### Requirement: Presenter SHALL Assemble Tabbar From Domain State

tabbar presenter MUST 自行从正式领域对象组装 tabs，不再依赖 `getTabs`。

#### Scenario: blueprint tabs 由 presenter 组装

**前提** 当前入口为 blueprint production workbench  
**当** presenter 生成 tabbar props  
**那么** presenter SHALL 从 `orderedStations` 与 `session` 读取数据  
**并且** presenter MUST NOT 调用 `getTabs`

#### Scenario: live tabs 由 presenter 组装

**前提** 当前入口为 live production workbench  
**当** presenter 生成 tabbar props  
**那么** presenter SHALL 从 `sectors`、`orderedStationsBySector` 与 `session` 读取数据  
**并且** transit tab 的 id MUST 由 presenter 基于 sector id 生成  
**并且** presenter MUST NOT 调用 `getTabs`

#### Scenario: tab 激活态不再依赖旧 getter

**前提** presenter 需要决定当前 active tab  
**当** 读取当前工作台上下文  
**那么** presenter SHALL 基于 `session.workbenchMode`、`session.activeStationId` 与 `session.activeTransitSectorId` 推导  
**并且** presenter MUST NOT 调用 `getActiveTabId`

### Requirement: Presenter SHALL Replace Legacy Toolbar Getters

toolbar presenter MUST 自行从正式领域对象与固定选项表组装 toolbar props。

#### Scenario: title model 改为 presenter 组装

**前提** presenter 需要提供标题输入模型  
**当** 生成 toolbar props  
**那么** presenter SHALL 基于 `titleValue` 与 `titlePlaceholder` 组装  
**并且** presenter MUST NOT 调用 `getTitleModel`

#### Scenario: station 基本信息改为 presenter 组装

**前提** presenter 需要提供 station 基本信息  
**当** 读取当前实体  
**那么** presenter SHALL 基于 `stationState` 与必要上下文组装  
**并且** presenter MUST NOT 调用 `getToolbarStation`

#### Scenario: toolbar 固定选项不再来自 store getter

**前提** presenter 需要提供 races、stationTypes、minerals 选项  
**当** 生成 toolbar props  
**那么** presenter SHALL 使用 presenter 内固定选项表  
**并且** presenter MUST NOT 调用 `getToolbarRaces`、`getToolbarStationTypes`、`getAvailableMinerals`

#### Scenario: throughput 派生不再来自旧 getter

**前提** presenter 需要提供 berth throughput  
**当** 读取当前 settings  
**那么** presenter SHALL 基于正式 settings 派生  
**并且** presenter MUST NOT 调用 `getSingleBerthThroughput`

### Requirement: Planning And Dashboard Presenter SHALL Replace Remaining Legacy Getters

planning、wareflow、dashboard presenter MUST 完成剩余旧 getter 迁移。

#### Scenario: planning presenter 不再依赖 getEnforceDlcActivation

**前提** planning presenter 需要决定 DLC 激活约束  
**当** 读取 planning 状态  
**那么** presenter SHALL 从 `stationState.enforceDlcActivation` 读取  
**并且** presenter MUST NOT 调用 `getEnforceDlcActivation`

#### Scenario: wareflow presenter 不再依赖旧 getter

**前提** wareflow presenter 需要提供 viewMode 与 gap 结果  
**当** 读取当前实体状态  
**那么** presenter SHALL 从正式 session 或 stationState 字段读取  
**并且** presenter MUST NOT 调用 `getWareflowViewMode` 或 `getEmpireGaps`

#### Scenario: dashboard presenter 不再依赖旧 getter

**前提** dashboard presenter 需要提供效率、人力、建造价格  
**当** 读取 dashboard 状态  
**那么** presenter SHALL 从 `stationState.currentEfficiency`、`stationState.actualWorkforce` 与 `stationState.buildPriceMultiplier` 读取  
**并且** presenter MUST NOT 调用 `getCurrentEfficiency`、`getActualWorkforce`、`getBuildPriceMultiplier`

### Requirement: View SHALL Only Use Formal Entry State

两个 production workbench view MUST 收缩为入口层，不再依赖旧 workbench 兼容接口。

#### Scenario: blueprint view 收缩完成

**前提** 打开 blueprint production workbench  
**当** view 初始化完成  
**那么** view SHALL 只负责加载 empire、创建 presenter、管理 modal 状态并渲染  
**并且** view MUST NOT 手工组装 toolbar / planning / wareflow / dashboard 主数据

#### Scenario: live view 收缩完成

**前提** 打开 live production workbench  
**当** view 在 overview、station、transit 之间切换  
**那么** view SHALL 只基于 `session.workbenchMode` 做区块切换  
**并且** view MUST NOT 直接解释第二套 transit 主状态  
**并且** view MUST NOT 调用旧 `workbench` 兼容接口

### Requirement: Legacy Entrypoints SHALL Trigger Static Guardrails

旧接口在迁移期与迁移后都必须受到静态门禁控制。

#### Scenario: 旧接口定义被标记

**前提** 仓库中短暂残留旧接口定义  
**当** 代码审阅或构建发生  
**那么** 这些接口 MUST 带有 `@deprecated` 标记

#### Scenario: 旧接口调用触发门禁

**前提** 任意代码新增旧接口调用  
**当** 静态检查运行  
**那么** 工具 MUST 报告告警或失败  
**并且** 该门禁 MUST NOT 依赖 reviewer 人工检查

### Requirement: WorkbenchMode SHALL Remain A Valid Domain Field

`session.workbenchMode` MUST 继续保留为正式领域状态字段。

#### Scenario: workbenchMode 不被误删

**前提** 进行 remove-workbench 重构  
**当** 清理旧兼容接口  
**那么** 系统 SHALL 保留 `session.workbenchMode`  
**并且** 它 SHALL 继续表达当前 workbench 所处的 `overview` / `station` / `transit` 上下文  
**并且** 它 MUST NOT 被视为旧兼容层的一部分
