# Production Store Presenter View Specification

## Purpose

定义 production workbench 的稳定分层边界，使 store、presenter、view 各自只承担单一职责，并让 station 与 transit 共享同一主状态模型。

## ADDED Requirements

### Requirement: Store SHALL Expose Unified Domain Objects

production store MUST 对外提供统一的领域对象，而不是以面板为单位暴露主读取接口。

#### Scenario: 暴露统一主状态对象

**前提** production workbench store 对外提供状态读取能力  
**当** presenter 读取 production 主状态  
**那么** store SHALL 提供 `session`、`context`、`stationState` 三类主对象  
**并且** 这三类对象必须能覆盖 station 与 transit 的主展示状态  
**并且** store MUST NOT 将 `transitState` 作为独立主对象继续导出

#### Scenario: store 直接导出主对象

**前提** 外部代码读取 production 主状态  
**当** 访问 store 正式主入口  
**那么** 正式读取入口 SHALL 是 `store.session`、`store.context`、`store.stationState`  
**并且** 系统 MUST NOT 保留 `workbench` 兼容适配层作为正式迁移方案

#### Scenario: 主对象字段边界固定

**前提** store 定义 production 主对象  
**当** 代码新增或调整字段  
**那么** `session` SHALL 只表达工作上下文  
**并且** `context` SHALL 只表达附加上下文  
**并且** `stationState` SHALL 只表达当前实体主状态  
**并且** 不得把 panel-specific UI props 直接放入这三类主对象

### Requirement: Transit SHALL Use StationState As Primary Model

transit MUST 通过 `stationState` 进入统一主状态框架。

#### Scenario: transit 进入统一主状态模型

**前提** 当前 workbench 处于 transit 模式  
**当** presenter 读取当前实体主状态  
**那么** 读取入口 SHALL 仍为 `stationState`  
**并且** `stationState.entityType` SHALL 为 `transit`  
**并且** `plannedModules` SHALL 返回空数组  
**并且** `resolvedModules` SHALL 表达 transit 当前基础设施结果  
**并且** `productionFlows` SHALL 表达当前 sector 的最终 flows

#### Scenario: transit 空值约定稳定

**前提** 当前 workbench 处于 transit 模式  
**当** presenter 读取 `stationState` 的 station-only 字段  
**那么** `autoIndustryModules` SHALL 返回空数组  
**并且** `autoHabitationModules` SHALL 返回空数组  
**并且** `warePriorityLevels` SHALL 返回空对象  
**并且** `stationAnalysis` SHALL 返回空结构而不是 `null`

### Requirement: Presenter SHALL Be The Only UI Assembly Layer

presenter MUST 成为 production workbench 唯一的 UI 组装层。

#### Scenario: presenter 从领域对象映射 UI

**前提** presenter 需要为子组件生成 props 和 emits  
**当** presenter 读取 store 数据  
**那么** presenter SHALL 从 `session/context/stationState` 与动作接口读取  
**并且** presenter SHALL 负责 station / transit / overview 的展示映射  
**并且** presenter MUST NOT 重新计算 production 算法结果

#### Scenario: presenter 不依赖旧面板 getter 主路径

**前提** presenter 被重构  
**当** presenter 被重构  
**那么** presenter 主路径 SHALL 不再依赖 `getToolbarXxx/getPlanningXxx/getDashboardXxx` 一类 getter  
**并且** 这些旧 getter SHOULD 在同一 change 中被删除
**并且** 若同一提交内短暂残留，调用点 MUST 触发静态告警

### Requirement: View SHALL Only Render Presenter Output

production workbench view MUST 只负责展示和切换，不再承担状态拼装。

#### Scenario: blueprint view 收缩为展示层

**前提** 打开 blueprint production workbench  
**当** view 初始化完成  
**那么** view SHALL 只负责获取 store、创建 presenter、渲染子组件  
**并且** view MUST NOT 手工组装 toolbar/planning/wareflow/dashboard 主数据

#### Scenario: live view 收缩为展示层

**前提** 打开 live production workbench  
**当** view 在 overview、station、transit 之间切换  
**那么** view SHALL 只基于 `session.workbenchMode` 做区域切换  
**并且** 其余展示数据 SHALL 通过 presenter 提供  
**并且** view MUST NOT 直接依赖独立 `transitState` 主对象

## MODIFIED Requirements

### Requirement: Production Workbench Boundary

production workbench 的主边界必须直接暴露“领域对象 + 动作接口”，不得依赖兼容适配层长期存在。

#### Scenario: 主边界直接表达统一领域状态

**前提** production store 对外暴露主边界  
**当** 代码消费该边界  
**那么** 主边界 SHALL 直接表达 `session/context/stationState` 与统一动作接口  
**并且** 不得继续以面板命名组织核心读取 API

#### Scenario: 不保留兼容适配层

**前提** production workbench 完成本次重构  
**当** 代码访问主边界  
**那么** 系统 MUST NOT 依赖 `workbench` 或等价兼容适配层承接旧调用  
**并且** 旧入口如仍存在，只允许用于同一 change 内的短暂迁移

#### Scenario: 旧入口调用触发静态告警

**前提** 仓库中短暂残留旧 getter、旧 contract 或旧兼容入口  
**当** 任意代码继续调用这些旧入口  
**那么** 调用点 MUST 触发静态告警  
**并且** 静态告警 MUST 纳入门禁  
**并且** 该门禁 MUST NOT 依赖 reviewer 人工检查

#### Scenario: contract 不继续扩张旧模式

**前提** 后续功能继续接入 production workbench  
**当** 需要新增读取字段  
**那么** 新字段 SHALL 优先进入领域对象  
**并且** 不得继续新增新的 panel-specific getter 作为主路径
