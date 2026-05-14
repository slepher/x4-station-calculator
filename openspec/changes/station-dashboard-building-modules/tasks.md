# Station Dashboard Building Modules - Tasks

## Task 1: Store 新增 moduleScope 状态

- [x] 文件: `src/store/useLiveProductionStore.ts`
- [x] 新增 `moduleScope` ref，默认 `'built'`
- [x] 新增 `cycleModuleScope()` 函数
- [x] 新增 `hasBuildingModules` computed（基于 `archiveStation?.building?.modules`）
- [x] watch `activeStationId` 和 `mode`，reset moduleScope 为 `'built'`
- [x] 暴露到 store return

## Task 2: Toolbar Presenter 透传 moduleScope

- [x] 文件: `src/components/empire/presenters/useProductionToolbarPresenter.ts`
- [x] `ToolbarPresenterStore` 接口新增 `moduleScope?`, `hasBuildingModules?`, `cycleModuleScope?`
- [x] `ToolbarPresenterProps` 接口新增 `moduleScope`, `hasBuildingModules`
- [x] `ToolbarPresenterEmits` 接口新增 `cycleModuleScope`
- [x] props 填充和 emits 填充

## Task 3: Dashboard Presenter 新增 effectiveModules

- [x] 文件: `src/components/empire/presenters/useProductionDashboardPresenter.ts`
- [x] `DashboardPresenterStore` 接口新增 `moduleScope?`
- [x] `DashboardPresenterProps` 接口新增 `effectiveModules`
- [x] computed 填充：根据 moduleScope 计算 effectiveModules

## Task 4: LiveStationToolbar 三态按钮

- [x] 文件: `src/components/empire/context_toolbar/LiveStationToolbar.vue`
- [x] Props 新增 `moduleScope`, `hasBuildingModules`
- [x] Emits 新增 `cycleModuleScope`
- [x] 计算属性 `scopeIcon`, `scopeLabel`, `scopeClass`
- [x] 模板：条件分隔线 + toggle-chip 按钮
- [x] 样式：`.active-amber`, `.active-sky`

## Task 5: LiveProductionWorkbenchView 传递 props

- [x] 文件: `src/components/empire/LiveProductionWorkbenchView.vue`
- [x] LiveStationToolbar 新增 `:module-scope`, `:has-building-modules`, `@cycle-module-scope`
- [x] StationDashboard (station view) 新增 `:effective-modules`

## Task 6: StationDashboard 双分析

- [x] 文件: `src/components/empire/StationDashboard.vue`
- [x] Props 新增 `effectiveModules?`
- [x] `analysis` 拆分为 `costAnalysis` + `workersAnalysis`
- [x] `data` computed 按 viewMode 分流（workers→workersAnalysis，其余→costAnalysis）
- [x] `stats-bar` 按字段分流（cost/volume/time/transport→costAnalysis，workers/efficiency→workersAnalysis）
- [x] 工人相关计算用 `workersAnalysis`

## Task 7: i18n

- [x] 文件: `src/locales/zh-CN.json`, `src/locales/en.json`
- [x] 新增 4 个 key：`toolbar.module_scope`, `toolbar.module_scope_built`, `toolbar.module_scope_building`, `toolbar.module_scope_all`

## Task 8: Build 验证

- [x] 执行 `npm run build`，确认无编译错误
