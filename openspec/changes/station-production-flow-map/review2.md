# Review2

## Status

[transit-hub-refactor.md](/home/slepher/project/x4-station-calculator/worktrees/station-binding/openspec/changes/station-production-flow-map/transit-hub-refactor.md) 的前置重构已基本落地。

当前代码已经具备：

- 双 `FlowMap`
- 双 `sourceView`
- 双 facade
- `ProductionPanelSource`
- `TransitPresenterContract`
- transit 三个 presenter
- `FlowMap` 的 sector aggregation cache
- station/transit 基本 presenter 化

因此本文件不再负责“前置重构设计”。  
本文件只负责**重构后的剩余收尾与纠偏**。

---

## Purpose

目标：

- 补齐前置重构后仍未收拢的旧路径
- 修正 station/live/transit 在 presenter/source 上的残余偏差
- 完成 live flow / transit hub 的最终行为闭环

本文件是施工说明。  
不要再回退到重构前路线。

---

## Final Goal

完成后，系统必须满足：

### Station 页

- `planning`
  - `ModulePlanner` 显示 binding/planned modules
  - `StationWareFlowsDashboard` 显示 planning flow
  - `StationDashboard` 显示 planning analysis

- `live`
  - `ModulePlanner` 显示 `archiveStation.modules`
  - `StationWareFlowsDashboard` 显示 live flow
  - `StationDashboard` 显示 live analysis
  - 不显示 auto modules
  - 不允许 live 侧写回

### Transit hub 页

- `planning`
  - center dashboard 使用 planning/live presenter 选出来的 planning source
  - build panel 显示 sector 级 `autoInfrastructureModules`
  - materials panel 分析 sector 级 `autoInfrastructureModules`

- `live` 且 `hasArchiveTradeStation = true`
  - center dashboard 使用 live source
  - build panel 切为 `ArchiveModuleList`
  - 显示 `archiveModules + buildingModules`
  - materials panel 分析 `archiveModules + buildingModules`

- `live` 且 `hasArchiveTradeStation = false`
  - center dashboard 切到 live
  - build panel 保持 planning
  - materials panel 保持 planning
  - toggle 仍可点
  - toggle 颜色保持 planning

---

## What Is Already Done

以下内容视为已完成，不再重复设计：

1. `FlowMap` 已支持 sector aggregation cache
2. `computeInfrastructureModulesFromFlows(...)` 已抽出
3. `getSectorFinalProductionFlows(...)` 已存在
4. `syncPlanningSectorAggregations()` / `syncLiveSectorAggregations()` 已接入初始化和 station/sector 更新链
5. `planningSourceView` / `liveSourceView` 已分离
6. `TransitPresenterContract` 已建立
7. `useTransitPlanningPresenter` / `useTransitWareflowPresenter` / `useTransitDashboardPresenter` 已建立
8. `LiveProductionWorkbenchView.vue` 已切到 presenter 驱动
9. `TransitHubBuildPanel` 已改为 `SavedModule[]` 主输入
10. `npm run build` 当前可通过

---

## Current Incomplete Items

当前剩余问题只包括以下几项：

1. `visualMode` 仍在 3 个 transit presenter 中重复本地推导，尚未统一回 source
2. `getLiveSectorInternalData()` 等旧 getter 仍残留在 store 中，存在未来误用风险
3. transit 材料区虽然已接 presenter，但仍直接借用 station dashboard emits
4. `empireFlowFacade.getTransitPanelSource()` 里仍有重复的 sector 展示派生逻辑，可继续收口
5. e2e 仍未覆盖完整的 transit live/planning 切换矩阵

---

## Hard Decisions

以下路线继续有效：

### D1. 不回退到 facade 内直接计算 `autoInfrastructureModules`

`autoInfrastructureModules` 继续由 `FlowMap` 的 sector aggregation 产出。  
facade 只读。

### D2. presenter 继续是唯一 UI 对接层

不要让 view 再次直接读取：

- facade
- `getSectorInternalData`
- `getLiveSectorInternalData`
- `get...PanelSource`

### D3. `visualMode` 的唯一来源必须是 `ProductionPanelSource.liveVisualState`

presenter 不得再本地重算：

- `if (!hasArchiveTradeStation) return 'planning'`
- `mode === 'live' ? 'live' : 'planning'`

这条逻辑必须只保留在 source。

### D4. `TransitHubBuildPanel` 继续只服务 planning

- planning / live without archive -> `TransitHubBuildPanel`
- live with archive -> `ArchiveModuleList`

不改回双语义组件。

### D5. 旧 live sector getter 只允许删除，不允许继续扩展

这些旧口：

- `getLiveSectorInternalData`
- `getLiveSectorLinkCalc`（如果存在）

现在只可能做两件事：

- 删除
- 或标注 deprecated 后等待删除

不允许继续基于这些旧口新增调用方。

---

## Required Code Changes

## 1. 统一 `visualMode`

涉及文件：

- [src/components/empire/presenters/useTransitPlanningPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitPlanningPresenter.ts)
- [src/components/empire/presenters/useTransitWareflowPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitWareflowPresenter.ts)
- [src/components/empire/presenters/useTransitDashboardPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitDashboardPresenter.ts)
- [src/store/logic/empireFlowFacade.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/empireFlowFacade.ts)

### 必做

1. presenter 删除本地 `visualMode` 推导
2. 改为直接读取 source：
   - planning presenter 读 `active/planning/live` 中约定好的 `liveVisualState`
   - wareflow presenter 同理
   - dashboard presenter 同理
3. `visualMode` 规则只保留在 source 生成处

### 完成标准

- 三个 presenter 不再重复写视觉规则
- `LiveTransitToolbar` 仍只接 presenter props，不受影响

---

## 2. 删除旧 live sector getter 路径

涉及文件：

- [src/store/useLiveProductionStore.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts)

### 必做

删除或清理：

- `getLiveSectorInternalData`
- 任何只为旧 view 层拼装保留的 live sector getter

若短期不能删干净，必须：

- 添加明确注释：`deprecated`
- 并保证没有调用方

### 完成标准

- `rg "getLiveSectorInternalData\\(" src` 无业务调用
- 新逻辑不再依赖旧 getter

---

## 3. 收口 transit 材料区行为

涉及文件：

- [src/components/empire/LiveProductionWorkbenchView.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue)
- [src/components/empire/presenters/useTransitDashboardPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitDashboardPresenter.ts)

### 必做

1. `TransitHubMaterialsPanel` 继续只吃 transit dashboard presenter 的模块输入
2. 检查是否仍有 station dashboard 语义泄漏
3. 若材料区需要自己的 emit contract，新增 transit dashboard emits，不再借 station dashboard emits 名义

### 当前允许的临时状态

如果复用 station dashboard 的两个 emit 不影响语义，可暂保留：

- `update-build-price-multiplier`
- `update-use-hq`

但不得再扩散更多 station dashboard 依赖。

---

## 4. 收口 `empireFlowFacade` 中的 transit 展示派生

涉及文件：

- [src/store/logic/empireFlowFacade.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/empireFlowFacade.ts)
- [src/store/logic/transitHubViewModel.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/transitHubViewModel.ts)

### 必做

1. 保持：
   - `FlowMap` 负责主计算
   - facade 负责装配
2. 检查 `getTransitPanelSource()` 内的：
   - `mergeLinkFlowsIntoGroupedFlows(...)`
   - `buildTransitHubStorageFlows(...)`
   - `buildTransitHubStorageModulePlans(...)`
3. 如有必要，把纯展示派生进一步抽入 transit helper，避免 facade 函数继续膨胀

### 禁止

- 不要把主计算挪回 facade
- 不要重新引入 `computeTransitHubGrouping(...).storageModulePlans` 作为 build 主源

---

## 5. 补 transit e2e

目录：

- `tests/e2e/live-flow-map/`

### 必补

至少补以下 5 条：

1. `station live wareflow`
2. `station live dashboard`
3. `transit with archive`
4. `transit without archive`
5. `transit without archive visual`

### 断言必须覆盖

- transit toggle 恒可见
- live with archive:
  - center 切换
  - build 区切 `ArchiveModuleList`
  - materials 用 `archive + building`
- live without archive:
  - center 切换
  - build 保持 planning
  - materials 保持 planning
  - 颜色保持 planning

---

## Implementation Order

必须按此顺序：

### Step 1

- 删掉 3 个 transit presenter 里的本地 `visualMode` 推导
- 改为直接读 source 的 `liveVisualState`

### Step 2

- 删除或标记 deprecated 的旧 live sector getter
- 确认没有调用方

### Step 3

- 检查 `TransitHubMaterialsPanel` 的 props/emits 是否完全通过 transit dashboard presenter 驱动
- 收掉多余 station dashboard 语义

### Step 4

- 收口 `empireFlowFacade` 中仍显重复的 transit 展示派生

### Step 5

- 补 transit e2e

### Step 6

- `npm run build`

---

## Acceptance Criteria

必须全部满足：

1. `visualMode` 只在 source 中定义一次
2. 三个 transit presenter 不再本地推导 `visualMode`
3. `getLiveSectorInternalData()` 不再被业务代码使用
4. station/transit 均保持 presenter 驱动
5. `autoInfrastructureModules` 继续来源于 `FlowMap`
6. transit planning build = `autoInfrastructureModules`
7. transit live build = `archiveModules + buildingModules`
8. `npm run build` 通过
9. transit e2e 覆盖 live/planning 切换矩阵

---

## Explicitly Forbidden

禁止以下路线：

- 回退到 facade 直接计算 `autoInfrastructureModules`
- 在组件层重新拼 transit source
- 恢复对 `getLiveSectorInternalData()` 的依赖
- 让 `TransitHubBuildPanel` 重新承担 live 语义
- 把 `visualMode` 规则复制到多个 presenter / 组件里
