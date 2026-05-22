# building-material-progress 实施任务

## Task 1: StationDashboard 新增 buildingScopeModules prop 与进度条计算

- [x] 在 `StationDashboard.vue` props 中新增 `buildingScopeModules?: SavedModule[]`
- [x] 新增 `BuildingProgressItem` 接口类型
- [x] 新增 `buildingProgressItems` computed：基于 `buildingScopeModules` 调用 `analyzeStation()`
- [x] 合并 `buildingCargo` / `buildingReservation` 数据
- [x] 过滤条件：`required > 0 || cargo > 0 || reservation > 0`
- [x] 新增 `cargoPercent` / `transitPercent` 计算函数（`buildingCargoPercent` / `buildingTransitPercent`）
- [x] scale 逻辑：`required > 0 ? required : (cargo + reservation)`
- [x] 确保存量段 + 在途段不超出 scale

## Task 2: StationDashboard 新增进度条面板模板与样式

- [x] 在 `stats-bar` 之后、`dashboard-content` 之前插入 `<div class="building-progress-panel">`
- [x] 渲染条件：`buildingProgressItems.length > 0`，不受 `viewMode` 限制
- [x] 每行模板：ware 名称 + 一个 bar-shell（含两段 fill + bar-text）
- [x] 数字显示逻辑：有在途时 `cargo+reservation / required`，无在途时 `cargo`
- [x] CSS 样式：面板容器（参考 stats-bar），进度行 flex 布局，ware 名称固定宽度，bar-shell flex-1
- [x] 颜色：存量段 `bg-emerald-500/70`，在途段 `bg-amber-500/60`，bar-text 居中

## Task 3: LiveProductionWorkbenchView 连线

- [x] station 模式下透传 `:building-scope-modules="dashboardPresenter.props.buildingScopeModules.value"`
- [x] transit 模式不传该 prop（保持默认 undefined）
- [x] overview 模式不传该 prop

## Task 4: 构建验证

- [x] 实现完成后执行 `npm run build`
- [x] 改动文件无编译错误（StationDashboard.vue, LiveProductionWorkbenchView.vue 均通过类型检查）
