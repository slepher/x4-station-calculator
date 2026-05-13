# Production Workbench Refactory 需求

## 目标

本次变更必须完成 production workbench 的架构清理，收敛为稳定的 `store -> presenter -> view` 三层结构，并固定实体职责边界。

本次变更合并了以下 4 个来源 change 的剩余工作：

| 来源 Change | 状态 | 在本 change 中的角色 |
|---|---|---|
| `remove-blueprint-production-sector` | **已完成** | 前置：从 BlueprintProduction 剥离星区功能 |
| `remove-workbench` | **已完成** | 前置：移除旧 workbench / panel getter 兼容层 |
| `production-store-present-view` | **未实现** | 核心：store→presenter→view 三层架构、presenter 作为唯一 UI 组装层 |
| `active-station-refactory` | **部分实现** | 核心：实体来源 `bindingStation / archiveStation` 收口、`editableStationPlan` 独立 |

### 1. 已完成的前置条件

以下工作已在之前的 change 中完成，本 change 视为已达成的前提：

**1.1 BlueprintProduction 星区已剥离（remove-blueprint-production-sector）**

- BlueprintProductionStore 已移除 `sectors`、`sectorLinks`、`sectorInternalDataMap`、`sectorLinkCalcMap`、`activeTransitSectorId`、`empireGroupedFlows` 等星区属性
- BlueprintProductionStore 已移除 `selectTransitSector`、`selectOverview`、`getLinkedSectors`、`getSupplyPlanningInput`、`getSectorInternalData`、`getSectorLinkCalc`、`getTransitHubViewModel` 等星区方法
- BlueprintProductionWorkbenchView 已移除 Transit Hub 视图和 Overview 视图
- `StationTabBar.vue` 已重命名为 `SectorStationTabBar.vue`（带星区版），新建简化版 `StationTabBar.vue`（无星区版）
- LiveProductionWorkbenchView 保留完整星区功能（使用 SectorStationTabBar）

**1.2 旧 workbench 兼容层已移除（remove-workbench）**

- 两个 production store 已移除旧 panel getter 导出：`getTabs`、`getActiveTabId`、`getExpandedSectorId`、`getTitleModel`、`getToolbarStation`、`getToolbarRaces`、`getToolbarStationTypes`、`getAvailableMinerals`、`getSingleBerthThroughput`、`getEnforceDlcActivation`、`getWareflowViewMode`、`getEmpireGaps`、`getCurrentEfficiency`、`getActualWorkforce`、`getBuildPriceMultiplier`、`selectOverview`、`selectTransit`、`expandSector`、`openImport`
- 五个 presenter 已改为从正式领域对象读取数据，不再依赖旧 getter
- 两个 workbench view 已收缩，不再手工组装 panel 主数据
- `ProductionStationState` 已补全 `stationType`、`count`、`minerals`、`enforceDlcActivation`、`empireGaps`、`currentEfficiency`、`actualWorkforce`、`buildPriceMultiplier` 等字段
- `ProductionSessionState` 已补全 `wareflowViewMode` 字段
- 旧 getter 静态门禁已建立

### 2. 本次必须完成的架构要求

**2.1 store → presenter → view 三层结构**

系统必须以"减少抽象层次"为第一原则完成重构。store 必须只导出领域对象与业务动作；presenter 必须成为唯一 UI 组装层；view 必须只负责创建 presenter、切换组件与展示。

```
store → presenter → view
```

不得新增页面级 facade、workbench presenter、view model、adapter、compat layer 或其他等价中间层。

**2.2 `archiveStation` 必须保留在 store 作为领域模型**

`archiveStation` 是 live production 的领域模型，不是 presenter 组装结果。它必须继续由 `useLiveProductionStore` 持有并扩展。presenter 只能读取 `archiveStation` 并映射 UI，不得反向定义或持有 archive 领域事实。

**2.3 store 主对象收敛为 session / context / stationState**

production store 对外必须收敛为稳定的主状态对象与动作接口。三个正式入口：
1. `session`
2. `context`
3. `stationState`

但该收敛不得以牺牲 live 领域模型为代价。`archiveStation`、`bindingStation`、`planningStationDraft` 这类领域对象必须保留在 store 内部与 store 正式接口中。

**2.4 `activeStation` 固定为 `bindingStation | archiveStation`**

`activeStation` 表示当前页面正在查看的实体，不再额外承担"可编辑 plan"语义。
- 优先使用 `bindingStation`
- `bindingStation` 不存在时 fallback 到 `archiveStation`
- `station` 与 `transit` 模式下都必须成立；`overview` 下为 `null`

**2.5 `editableStationPlan` 独立为可编辑实体**

新增 `editableStationPlan`，专门表示当前页面可编辑的 planning 实体：
- `station` 模式下指向普通站点的 binding plan
- `transit` 模式下为 `null`
- station plan 的模块、锁定、优先级、settings 编辑入口只依赖 `editableStationPlan`

blueprint store 与 live store 的 station 编辑主路径必须保持一致。

**2.6 `context` 不得继续承担 archive 领域扩展**

`context` 只允许表达当前实体的附加上下文字段（如 sector、position、hasBinding 判定、hasArchive 判定），不得继续承载 archive 站点详情、build storage、cargo、reservation、workforce 等 live 主事实。这些字段必须由 `archiveStation` 承载。

**2.7 `stationState` 补齐 `modules` / `buildingModules`**

`stationState` 中必须补齐：
- `modules: SavedModule[]` — plan 时等于 `resolvedModules`；live 时等于 `archiveStation.modules`
- `buildingModules: SavedModule[]` — plan 时为 `[]`；live 时等于 `archiveStation.building.modules`

plan/live 切换逻辑在 `activeStationState` 内收敛，presenter 和 Dashboard 相关组件不再自行判断模式切换数据源。

**2.8 `mode === 'transit'` 不得确定实体来源**

`mode === 'transit'` 只用于页面模式和行为分流，不得继续作为当前实体来源的判定主路径。`bindingStation` 与 `archiveStation` 必须同时覆盖 `station` 与 `transit` 两类实体来源，内部不得残留以 `mode` 重新判断当前实体的逻辑。

**2.9 presenter 必须成为唯一 UI 组装层**

五个 production presenter 必须承担全部 UI 组装职责：
- `useProductionTabbarPresenter`
- `useProductionToolbarPresenter`
- `useProductionPlanningPresenter`
- `useProductionWareflowPresenter`
- `useProductionDashboardPresenter`

它们必须从 store 领域对象读取数据，组装子组件 props，绑定 UI emits 到 store actions。不得重新计算业务算法、定义新的领域模型、继续依赖按面板命名的 store getter 主路径。

**2.10 view 必须只保留展示职责**

两个 workbench view 只允许保留：选择 store、创建 presenter、传递 presenter 输出、基于 `session.workbenchMode` 执行区域切换。view 不得直接拼装 panel 数据、直接解释 archive 与 binding 的组合规则。

### 3. 实施顺序

本 change 必须按下列顺序执行：

1. 固定 request / spec / design / tasks 文档边界
2. 固定 `archiveStation` 与其他 live 领域对象的 store 归属，公开导出 `archiveStation`
3. 收窄 `context`，移除 `archiveModules` / `buildingModules`，消除 `stationContext` 中间层
4. `stationState` 补齐 `modules` / `buildingModules` 统一字段，`activeStationState` 内完成 plan/live 切换
5. 清理 `context` 中错误承载领域事实的字段和职责
6. 收敛 `bindingStation` / `archiveStation` 为当前实体来源对象，确保覆盖 station+transit
7. 重构 `activeStation` 为 `bindingStation | archiveStation` 统一抽象
8. 定义并导出 `editableStationPlan`，将 station plan 编辑入口迁移到 `editableStationPlan`
9. 改造五个 production presenter，使其只从领域对象与正式状态读取
10. 收缩两个 workbench view，移除直接 UI 组装逻辑
11. 运行 `npm run build` 并修复问题

## 边界

### In Scope

- `useBlueprintProductionStore` / `useLiveProductionStore` 分层边界收敛
- `archiveStation` 及其周边 live 领域对象归属澄清与公开导出
- `context` / `stationState` 职责修正，`context` 移出 `archiveModules` / `buildingModules`
- plan | live 双态切换数据流归一化
- `bindingStation` / `archiveStation` 覆盖 station+transit 实体来源，移除 mode 实体选源残留
- `activeStation` 收敛为 `bindingStation | archiveStation`
- `editableStationPlan` 独立定义与导出、编辑入口迁移
- blueprint store 与 live store 的 station 编辑主路径对齐
- 5 个 production presenter 改为从领域对象组装 UI
- 两个 workbench view 继续瘦身

### Out of Scope

- 生产流算法重写
- sector 聚合算法重写
- live 数据抽取算法重写
- toolbar / dashboard 视觉改版
- 新增测试代码与测试执行
- 其他非 production workbench 模块重构
- 新增 transit 可编辑能力（不在本次预埋）

## 验收标准（DoD）

1. production workbench 稳定为 `store -> presenter -> view` 三层结构
2. 本次 change 未新增页面级 facade、workbench presenter、view model 或其他等价中间层
3. `archiveStation` 通过 `useLiveProductionStore` 公开导出
4. `context` 不承载 `archiveModules` / `buildingModules` 等 archive 主事实
5. `context` 内 `archiveModules` / `buildingModules` 已移除
6. `stationState` 包含 `modules` / `buildingModules` 字段
7. `activeStation` 固定为 `bindingStation | archiveStation`
8. `bindingStation` / `archiveStation` 覆盖 station 与 transit 且内部无 mode 实体选源分支
9. `editableStationPlan` 已定义并导出，station plan 编辑入口依赖它
10. blueprint store 与 live store 的 station 编辑主路径保持兼容
11. presenter 是唯一 UI 组装层
12. view 只保留 store 选择、presenter 创建与展示逻辑
13. `mode === 'transit'` 不再承担实体选源职责
14. TypeScript 编译无错误
15. `npm run build` 成功
