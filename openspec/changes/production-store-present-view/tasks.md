# Production Store Presenter View - 实现任务

## Tasks

- [ ] Task 1: 定义 `session/context/stationState/actions` 类型边界
- [ ] Task 2: 在 `useBlueprintProductionStore` 中导出三类主对象与动作
- [ ] Task 3: 在 `useLiveProductionStore` 中导出三类主对象与动作
- [ ] Task 4: 删除旧 `workbench` / panel getter 主路径
- [ ] Task 5: 改造 `useProductionTabbarPresenter`
- [ ] Task 6: 改造 `useProductionToolbarPresenter`
- [ ] Task 7: 改造 `useProductionPlanningPresenter`
- [ ] Task 8: 改造 `useProductionWareflowPresenter`
- [ ] Task 9: 改造 `useProductionDashboardPresenter`
- [ ] Task 10: 收缩 `BlueprintProductionWorkbenchView.vue`
- [ ] Task 11: 收缩 `LiveProductionWorkbenchView.vue`
- [ ] Task 12: 清理 `transitState` 设计残留与无效类型
- [ ] Task 13: 为残留旧入口建立静态告警门禁
- [ ] Task 14: 构建验证

## Phase 1: 类型与契约收口

### Task 1: 定义 `session/context/stationState/actions` 类型边界

- [ ] 更新相关类型定义
- [ ] 定义 `ProductionSessionState`
- [ ] 定义 `ProductionContextState`
- [ ] 定义 `ProductionStationState`
- [ ] 定义统一 `actions` 边界
- [ ] 移除兼容适配层作为正式设计目标

## Phase 2: Store 主状态对象落地

### Task 2: 在 `useBlueprintProductionStore` 中导出三类主对象与动作

- [ ] 新增 `session` computed
- [ ] 新增 `context` computed
- [ ] 新增 `stationState` computed
- [ ] 导出统一 `actions`
- [ ] 保证 blueprint 下对象 shape 与 live 对齐

### Task 3: 在 `useLiveProductionStore` 中导出三类主对象与动作

- [ ] 新增 `session` computed
- [ ] 新增 `context` computed
- [ ] 新增 `stationState` computed
- [ ] 导出统一 `actions`
- [ ] transit 通过 `stationState` 表达，不再输出独立 `transitState`

### Task 4: 删除旧 `workbench` / panel getter 主路径

- [ ] 删除 `workbench` 兼容适配层主路径
- [ ] 删除或停止导出旧的 panel-specific getter
- [ ] 不再新增新的 panel-specific getter
- [ ] 调整调用点直连主对象与 actions

## Phase 3: Presenter 改读领域对象

### Task 5: 改造 `useProductionTabbarPresenter`

- [ ] tabbar 所需状态从主对象读取
- [ ] 保持 actions 只调用行为接口

### Task 6: 改造 `useProductionToolbarPresenter`

- [ ] toolbar props 统一从 `session/context/stationState` 映射
- [ ] 清掉对零散 `getToolbarXxx` 的主路径依赖

### Task 7: 改造 `useProductionPlanningPresenter`

- [ ] planning props 统一从 `stationState` 与 `context` 映射
- [ ] transit/station 差异只在 presenter 内做展示分支

### Task 8: 改造 `useProductionWareflowPresenter`

- [ ] wareflow props 统一从 `stationState` 映射
- [ ] 交互行为统一绑定到 actions

### Task 9: 改造 `useProductionDashboardPresenter`

- [ ] dashboard props 统一从 `stationState` 与 `context` 映射
- [ ] live archive/building 展示分支保留在 presenter

## Phase 4: View 收缩

### Task 10: 收缩 `BlueprintProductionWorkbenchView.vue`

- [ ] 删除 view 中多余的碎状态 computed
- [ ] 只保留 store 选择、presenter 创建、组件渲染

### Task 11: 收缩 `LiveProductionWorkbenchView.vue`

- [ ] 删除 view 中多余的碎状态 computed
- [ ] 只保留 store 选择、presenter 创建、模式区块切换与组件渲染

## Phase 5: 残留清理

### Task 12: 清理 `transitState` 设计残留与无效类型

- [ ] 清理 `production-context.ts` 中不再成立的 transit 主对象类型残留
- [ ] 清理与 `transitState` 独立主对象假设绑定的注释/命名
- [ ] 确认 presenter/view 主路径不再依赖 transit 独立状态对象

## Phase 6: 静态告警门禁

### Task 13: 为残留旧入口建立静态告警门禁

- [ ] 对旧 getter / 旧 contract / 旧兼容入口添加 `@deprecated`
- [ ] 配置静态检查，让调用点出现告警或失败
- [ ] 将该静态检查纳入门禁
- [ ] 验证任意新增旧入口调用会被工具指出

## Phase 7: 构建验证

### Task 14: 构建验证

- [ ] 运行 `npm run build`
- [ ] 修复本次重构引入的编译错误，直到构建通过或出现明确阻塞
