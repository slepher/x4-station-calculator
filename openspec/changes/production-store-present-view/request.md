# Production Store Presenter View 重构需求

## 目标

本次变更必须将 production 主链收敛为稳定的 `store -> presenter -> view` 三层结构。

系统必须以“减少抽象层次”为第一原则完成重构。store 必须只导出领域对象与业务动作；presenter 必须成为唯一 UI 组装层；view 必须只负责创建 presenter、切换组件与展示。

## 已确认方案（审核重点）

### 1. 本次变更必须减少抽象层次

本次变更不得新增页面级 facade、workbench presenter、view model、adapter、compat layer 或其他等价中间层。

系统必须直接使用：

1. `store`
2. `presenter`
3. `view`

除这三层外，不得再新增承接页面状态组装职责的抽象。

### 2. `archiveStation` 必须保留在 store

`archiveStation` 是 live production 的领域模型，不是 presenter 组装结果。

`archiveStation` 必须继续由 `useLiveProductionStore` 持有并扩展，且后续新增的 live 专属字段必须优先进入 `archiveStation` 或与之同级的 store 领域对象。

presenter 只能读取 `archiveStation` 并映射 UI，不得反向定义或持有 archive 领域事实。

### 3. store 主对象必须继续收敛，但不得错误压平 live 领域模型

production store 必须对外收敛为稳定的主状态对象与动作接口。

正式主状态读取入口固定为：

1. `session`
2. `context`
3. `stationState`

但该收敛不得以牺牲 live 领域模型为代价。`archiveStation`、`bindingStation`、`planningStationDraft` 这类领域对象必须保留在 store 内部与 store 正式接口中作为真实计算来源，不得为了“看起来统一”而强制下沉到 presenter。

### 3.1. `activeStationState` 是 plan | live 双态切换的唯一收敛点

`activeStationState` 负责依据 `mode.value` 选择正确的 `StationDerivedMap`（planningDerivedMap / liveFlowMap），并为 `stationState` 产出统一形状的输出。一切需要随 plan/live 切换而呈现不同来源的**共用显示字段**，必须在此处完成归一化，presenter 和 Vue 只消费 `stationState` 的统一结构，不再自己判断模式去选数据源。

plan ✓: 重算型 DerivedMap，产出含 auto-fill 的生产流、模块、优先级等
live ✓: 实算型 DerivedMap，产出基于存档模块 + 真实 workforce 的生产流、模块等

`stationState` 中本次必须补齐的字段：

- `modules: SavedModule[]` — plan 时等于 `resolvedModules`（planned + auto）；live 时等于 `archiveStation.modules`（站点现有模块）
- `buildingModules: SavedModule[]` — plan 时为 `[]`（无 build storage 概念）；live 时等于 `archiveStation.building.modules`（build storage 待建模块）

这两个字段补齐后，DashboardPresenter 和所有 Dashboard 相关组件通过 `stationState.modules` / `stationState.buildingModules` 取得统一数据，不再分别从 `stationState` 和 `context` 两个来源拼接。

### 4. `context` 不得继续承担 archive 领域扩展

`context` 只允许表达当前实体的附加上下文，不允许继续演化为 archive 站点的替代模型。

当前 `context` 中存在的 `archiveModules` / `buildingModules` 字段必须移出 `context`。这些是 archive 领域事实，必须留在 `archiveStation` 中，并由 presenter 从 `archiveStation` 或 `stationState` 读取。

后续新增的下列内容必须进入 `archiveStation` 或其他 store 领域对象，不得新增到 `context`：

- archive 站点结构信息
- build storage 明细
- cargo / reservation / workforce 等 live 数据
- profile / tag / factoryGroup 等存档侧领域语义
- 其他会明显区别于 blueprint 的 live 专属事实

### 5. presenter 必须成为唯一 UI 组装层

`useProductionTabbarPresenter`
`useProductionToolbarPresenter`
`useProductionPlanningPresenter`
`useProductionWareflowPresenter`
`useProductionDashboardPresenter`

这五个 presenter 必须承担全部 UI 数据组装职责。

presenter 必须：

- 从 store 领域对象读取数据
- 组装子组件 props
- 绑定 UI emits 到 store actions
- 处理 station / transit / overview / planning / live 的显示分支

presenter 不得：

- 重新计算业务算法结果
- 定义新的领域模型
- 继续依赖按面板命名的 store getter 主路径

### 6. view 必须只保留展示职责

两个 workbench view 最终只允许保留：

- 选择 store
- 创建 presenter
- 传递 presenter 输出到子组件
- 基于 `session.workbenchMode` 执行区域切换

view 不得继续：

- 直接拼装 toolbar/planning/dashboard 所需数据
- 直接解释 archive 与 binding 的组合规则
- 直接消费零散 store 字段形成 UI props

### 7. transit 必须继续复用统一主状态模型

transit 不得重新恢复为独立主状态对象。

transit 必须继续映射到 `stationState`：

- `entityType = 'transit'`
- `plannedModules = []`
- `resolvedModules = autoInfrastructureModules`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = sector 聚合后的基础设施结果`
- `productionFlows = sector final flows`
- `warePriorityLevels = {}`

transit 的展示差异必须由 presenter 组装，不得通过新增 `transitViewModel`、`transitWorkbench`、`transitFacade` 等层实现。

### 8. 旧 panel-specific getter 不得继续作为主路径

store 不得继续新增或保留以下类型的主读取路径：

- `getToolbarXxx`
- `getPlanningXxx`
- `getDashboardXxx`
- `getWareflowXxx`
- 其他按面板命名的主 getter

若为同一提交内迁移顺序短暂保留旧入口，必须同时满足：

- 旧入口全部标记 `@deprecated`
- 旧入口调用必须触发静态告警
- 静态告警必须纳入门禁

### 9. 实施顺序必须可执行且不可跳步

本次 change 必须按下列顺序执行：

1. 固定 request / spec / design / tasks 文档边界
2. 固定 `archiveStation` 与其他 live 领域对象的 store 归属
3. 清理 `context` 中错误承载领域事实的字段和职责
4. 改造五个 production presenter，使其只从领域对象与动作读取
5. 收缩两个 workbench view，移除直接 UI 组装逻辑
6. 清理旧 getter 与兼容层残留
7. 运行 `npm run build` 并修复本次改动引入的问题

执行时不得绕过前置步骤直接进入代码改写。

## 边界

### In Scope

- `useBlueprintProductionStore` / `useLiveProductionStore` 分层边界收敛
- `archiveStation` 及其周边 live 领域对象归属澄清与公开导出
- `context` / `stationState` 职责修正，`context` 移出 `archiveModules` / `buildingModules`
- plan | live 双态切换数据流归一化：`activeStationState` 补齐 `modules` / `buildingModules` 统一字段
- `ProductionStationState` 新增 `modules` / `buildingModules` 字段
- `stationContext` 内部中间层消除
- 5 个 production presenter 改为从领域对象组装 UI
- `BlueprintProductionWorkbenchView.vue` / `LiveProductionWorkbenchView.vue` 继续瘦身
- 清理 panel-specific getter 与兼容层残留

### Out of Scope

- 生产流算法重写
- sector 聚合算法重写
- live 数据抽取算法重写
- toolbar / dashboard 视觉改版
- 新增测试代码与测试执行
- 其他非 production workbench 模块重构

## 验收标准（DoD）

1. production workbench 必须稳定为 `store -> presenter -> view` 三层结构。
2. 本次 change 不得新增页面级 facade、workbench presenter、view model 或其他等价中间层。
3. `archiveStation` 必须通过 `useLiveProductionStore` 公开导出，并作为 live 领域模型持续扩展。
4. `context` 不得承载 `archiveModules` / `buildingModules` 等 archive 主事实。
5. `context` 内 `archiveModules` / `buildingModules` 字段已移除，其数据从 `archiveStation` 或 `stationState` 读取。
6. `stationState` 必须包含 `modules` / `buildingModules` 字段，plan/live 切换逻辑在 `activeStationState` 内收敛。
7. `stationContext` 内部中间层已消除。
8. `useProductionDashboardPresenter` 只从 `stationState` 读取 modules/buildingModules，不自行判断 plan/live。
9. presenter 必须成为唯一 UI 组装层。
10. `BlueprintProductionWorkbenchView.vue` 必须只保留 store 选择、presenter 创建与展示逻辑。
11. `LiveProductionWorkbenchView.vue` 必须只保留 store 选择、presenter 创建与展示逻辑。
12. transit 不得恢复为独立主状态对象。
13. store 不得新增新的 panel-specific getter 作为主路径。
14. 若同一提交内短暂残留旧入口，调用点必须出现静态告警。
15. TypeScript 编译必须无错误。
16. `npm run build` 必须成功。

## 未决项

无
