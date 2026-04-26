# Production Store Presenter View Specification

## Purpose

定义 production workbench 的强制分层边界，使系统必须稳定为 `store -> presenter -> view` 三层结构，并确保 live 侧 `archiveStation` 保持为 store 领域模型而不是 presenter 拼装结果。

## ADDED Requirements

### Requirement: Store SHALL Preserve Live Domain Models

production live store MUST 保留 live 领域模型，不得为了接口表面统一而错误下沉领域对象。

#### Scenario: `archiveStation` 作为 store 领域模型保留

**前提** live production store 提供当前选中存档站点状态  
**当** presenter 或其他业务逻辑读取 archive 站点数据  
**那么** store SHALL 提供 `archiveStation` 作为领域模型  
**并且** `archiveStation` MUST 由 store 负责构建和维护  
**并且** presenter MUST NOT 成为 `archiveStation` 的定义者或持有者

#### Scenario: live 专属字段进入 store 领域模型

**前提** 系统需要新增明显区别于 blueprint 的 live 字段  
**当** 为当前 archive 站点扩展数据结构  
**那么** 新字段 SHALL 进入 `archiveStation` 或同级 store 领域对象  
**并且** 新字段 MUST NOT 作为主归属进入 `context`

### Requirement: Context SHALL Remain Supplemental

`context` MUST 只表达附加上下文，不得继续扩张为 archive 主事实容器。

#### Scenario: `context` 只保留附加上下文

**前提** store 对外导出 `context`  
**当** 代码新增或调整 `context` 字段  
**那么** `context` SHALL 只表达当前实体的附加上下文  
**并且** `context` MUST NOT 成为 archive 站点详情的主模型  
**并且** `context` MUST NOT 承担 build storage、cargo、reservation、workforce 等 live 主事实

#### Scenario: archive 领域扩展不进入扁平 UI 对象

**前提** live 侧存在 `stationContext` 或等价扁平对象  
**当** 系统继续扩展 archive 站点能力  
**那么** 系统 MUST NOT 通过此类扁平 UI 对象承接 archive 领域扩展  
**并且** 此类对象只能作为迁移期残留并最终移除

### Requirement: Presenter SHALL Be The Only UI Assembly Layer

presenter MUST 成为 production workbench 唯一 UI 组装层。

#### Scenario: 现有 presenter 承担全部 UI 组装

**前提** production workbench 需要为子组件生成 props / emits  
**当** 系统进行 UI 组装  
**那么** 系统 SHALL 只使用现有五个 presenter 承担该职责  
**并且** 系统 MUST NOT 新增页面级 facade、workbench presenter、view model、adapter 或其他等价中间层

#### Scenario: presenter 直接从领域对象映射 UI

**前提** presenter 需要生成 toolbar、planning、wareflow、dashboard 的展示数据  
**当** presenter 读取 store 数据  
**那么** presenter SHALL 从 `session/context/stationState` 与 store 领域对象读取  
**并且** presenter SHALL 负责 archive/binding/station/transit 的展示映射  
**并且** presenter MUST NOT 重新计算业务算法结果

### Requirement: Plan/Live Switching SHALL Converge In Store

plan | live 双态切换必须收敛在 store 层的 `activeStationState`，presenter 不得自行判断模式来切换数据源。

#### Scenario: `activeStationState` 作为唯一切换点

**前提** live store 内部有 `planningDerivedMap` 和 `liveFlowMap` 两个计算实例  
**当** presenter 读取当前实体的统一主展示状态  
**那么** `activeStationState` SHALL 根据 `mode.value` 选择正确的 Map  
**并且** `stationState` SHALL 对外呈现统一形状，不要求 presenter 区分底层 Map  
**并且** presenter MUST NOT 自行判断 `visualMode` 来选择不同的数据源

#### Scenario: `stationState.modules` / `stationState.buildingModules` 统一输出

**前提** Dashboard 需要同时展示站点模块和 build storage 待建模块  
**当** presenter 读取这两个字段  
**那么** `stationState.modules` SHALL 在 plan 模式下等于 `resolvedModules`  
**并且** `stationState.modules` SHALL 在 live 模式下等于 `archiveStation.modules`  
**并且** `stationState.buildingModules` SHALL 在 plan 模式下为 `[]`  
**并且** `stationState.buildingModules` SHALL 在 live 模式下等于 `archiveStation.building.modules`  
**并且** presenter MUST NOT 从其他来源拼接这两个字段

#### Scenario: archive 独有字段留在领域对象

**前提** archive 存在 live 专属字段（cargo、reservation、tag 等），不与 plan 产生共享显示切换  
**当** presenter 需要这些字段  
**那么** presenter SHALL 直接从 `archiveStation` 读取  
**并且** 这些字段 MUST NOT 被压入 `stationState` 或 `context`

#### Scenario: 不同子组件的二元切换由 presenter 提供选择

**前提** plan 和 live 使用完全不同的子组件（如 `StationPlanningPanel` vs `ArchiveModuleList`），接口和行为不同  
**当** wrapper 需要决定渲染哪个子组件  
**那么** presenter SHALL 提供 `showArchive` 布尔（派生自 `visualMode === 'live'`）  
**并且** presenter SHALL 提供两套数据：plan 侧（`plannedModules` 等）和 live 侧（`liveModules`、`liveBuildingModules`）  
**并且** wrapper 用 `v-if/v-else` 选择子组件，传递对应的 props  
**并且** wrapper MUST NOT 直接访问 store 获取 `mode`、`archiveModules`、`buildingModules`、`hasArchive`  
**并且** presenter 中 `liveModules` / `liveBuildingModules` MUST 从 `archiveStation` 读取，不得从 `context` 读取

### Requirement: View SHALL Only Render Presenter Output

production workbench view MUST 只承担展示职责。

#### Scenario: view 只负责创建 presenter 与切换区域

**前提** 打开 blueprint 或 live production workbench  
**当** view 初始化和渲染  
**那么** view SHALL 只负责选择 store、创建 presenter、传递 presenter 输出、基于 `session.workbenchMode` 切换区域  
**并且** view MUST NOT 手工拼装 toolbar/planning/wareflow/dashboard 主数据

#### Scenario: view 不直接解释 archive 与 binding 组合规则

**前提** live workbench 需要同时处理 archive 与 binding 信息  
**当** view 组装子组件输入  
**那么** view MUST NOT 直接解释 archive/binding 的组合规则  
**并且** 该映射 MUST 由 presenter 完成

### Requirement: Transit SHALL Reuse StationState

transit MUST 继续复用 `stationState`，不得恢复独立主状态对象。

#### Scenario: transit 通过统一主状态模型表达

**前提** 当前 workbench 处于 transit 模式  
**当** presenter 读取当前实体主状态  
**那么** 计算切换 SHALL 位于 `activeTransitState`  
**并且** `stationState` SHALL 只做组装（择取 `activeTransitState` + 拼合元信息和公共字段）  
**并且** `stationState` MUST NOT 内嵌 `mode.value === 'live'` 等切换逻辑  
**并且** `stationState.entityType` SHALL 为 `transit`  
**并且** `plannedModules` SHALL 返回空数组  
**并且** `resolvedModules` SHALL 表达 transit 基础设施结果  
**并且** `productionFlows` SHALL 表达 sector final flows

#### Scenario: transit 不恢复独立主状态对象

**前提** 系统继续扩展 transit 展示  
**当** 新增 transit 相关字段或显示逻辑  
**那么** 系统 MUST NOT 新增 `transitState`、`transitViewModel`、`transitWorkbench` 或其他等价主状态层  
**并且** transit 展示差异 SHALL 由 presenter 组装

## MODIFIED Requirements

### Requirement: Production Workbench Boundary

production workbench 的主边界必须直接暴露“领域对象 + 动作接口”，且必须以减少抽象层次为约束。

#### Scenario: 主边界只保留三层结构

**前提** production workbench 对外暴露正式边界  
**当** 代码读取或扩展主边界  
**那么** 正式架构 SHALL 保持为 `store -> presenter -> view`  
**并且** 系统 MUST NOT 通过新增中间层承接现有混乱

#### Scenario: 旧入口不再作为主路径

**前提** 仓库中仍残留旧 panel-specific getter 或兼容入口  
**当** 代码消费 production 主边界  
**那么** 这些旧入口 MUST NOT 继续作为正式主路径  
**并且** 若同一提交内短暂残留，调用点 MUST 触发静态告警  
**并且** 静态告警 MUST 纳入门禁

#### Scenario: 新字段优先进入正确层级

**前提** 后续功能继续接入 production workbench  
**当** 需要新增读取字段  
**那么** 字段 SHALL 优先进入 store 领域对象或 presenter 映射结果中的正确层级  
**并且** 系统 MUST NOT 继续新增 panel-specific getter 作为主路径
