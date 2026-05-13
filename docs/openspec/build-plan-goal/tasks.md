# build-plan-goal 任务

## Phase 1: 类型与版本常量

- [x] T1: 在 `src/types/build-plan.ts` 中定义 BuildGoal 类型体系（production-rate / build-module / fleet）
- [x] T2: 替换旧 fleet BuildGoal 为新结构，新增 FleetEntry 接口
- [x] T3: fleet BuildGoal 新增 shipyardLCount / shipyardXLCount / wharfCount 字段（默认 1）
- [x] T4: 新增 FleetShipyardGroup / FleetGoalView / FleetEntryView / FleetMergedRate 接口
- [x] T5: 新增 SavedBuildPlanGoalsState / BuildPlanGoalSnapshot 类型
- [x] T6: 新增 LogicFlowPlanSnapshot / ResolvedBuildPlanLogicFlowState 类型
- [x] T7: 新增 ProductionLineAllocation 接口
- [x] T8: 在 `src/store/logic/storageVersions.ts` 中新增 CURRENT_BUILD_PLAN_GOALS_VERSION = 1

## Phase 2: 方案持久化 Store

- [x] T9: 在 `useBuildPlanStore` 中新增 savedPlans ref
- [x] T10: 实现 loadPlansFromStorage() / savePlansToStorage()
- [x] T11: 实现 ensureActivePlan() / createNewPlan() / switchPlan() / deletePlan()
- [x] T12: 实现 updateLogicFlowPlanId() / activePlanName getter/setter
- [x] T13: 实现 syncGoalsToActivePlan()
- [x] T14: 修改 setBuildGoal() / removeBuildGoal() 调用 ensureActivePlan + syncGoalsToActivePlan
- [x] T15: 新增 watch logicFlowStore.savedPlans.activeId 调用 updateLogicFlowPlanId
- [x] T16: getStorageKey 新增 'build_plan_goals' 支持

## Phase 3: Logic-Flow Snapshot 解析

- [x] T17: 新增 `src/store/logic/buildPlanLogicFlowSource.ts`，提供 snapshot 解析入口
- [x] T18: 在 useBuildPlanStore 新增 resolvedLogicFlowState
- [x] T19: 实现同 active 复用 / 非 active 重建 / 无可用 plan 三条路径
- [x] T20: switchPlan 不再触发 logicFlowStore.loadPlan(...)
- [x] T21: 调整 watcher 联动规则，区分同 active 与非 active

## Phase 4: Fleet Goal

- [x] T22: 新增 `src/store/logic/resolveBlueprintMaterialCost.ts`，返回 { materials, buildTime }
- [x] T23: 实现 addFleetEntry / removeFleetEntry / updateFleetBuildTime / updateFleetEntryQuantity
- [x] T24: 实现 updateFleetShipyardCount
- [x] T25: Fleet 派生 rate 进入 createBuildFlowPlanPreview() 入口
- [x] T26: resolveFleetMergedRates 使用 effectiveBuildTime

## Phase 5: Fleet Presenter & UI

- [x] T27: useBuildPlanPresenter 新增 fleetGoalView computed
- [x] T28: fleetGoalView 分组、建造时间、effectiveBuildTime 计算
- [x] T29: 新增 FleetGoalCard.vue（标题栏 + 船厂分组 + 条目 + rate 汇总）
- [x] T30: 新增 FleetGoalSearchBox.vue
- [x] T31: BuildGoalSearchBox 类别新增 fleet 选项
- [x] T32: 蓝图缺失 warning 标记

## Phase 6: 产线自动分配

- [x] T33: 新增 `src/store/logic/computeProductionLineAllocation.ts`
- [x] T34: 实现三级匹配算法 + 派生 goal 生成
- [x] T35: useBuildPlanPresenter 新增 allocations computed
- [x] T36: 新增 ProductionLineAllocationSection.vue

## Phase 7: 约束面板 UI

- [x] T37: Panel-header 标题改为 useTitleEditor 可编辑 + 方案菜单
- [x] T38: Panel-content logic-flow 菜单 + 建材产线 checkbox 移到计算按钮上方
- [x] T39: FleetGoalCard 在 Goals 区顶部渲染

## Phase 8: i18n & 构建

- [x] T40: 新增 build_plan.fleet_* / build_plan.new_plan / build_plan.no_plan 等 i18n key
- [x] T41: npm run build 通过

## Phase 9: Fleet buildTimeMode

- [ ] T42: FleetGoal type 新增 `buildTimeMode: 'actual' | 'planned'` 字段，默认 `'actual'`
- [ ] T43: FleetGoalView 新增 `buildTimeMode` 字段
- [ ] T44: useBuildPlanStore 新增 `updateFleetBuildTimeMode(mode)` 方法
- [ ] T45: effectiveBuildTime 计算逻辑改为：actual → actualTotalBuildTime；planned → buildTime
- [ ] T46: FleetGoalCard 标题栏改为原生 `<select>` 下拉菜单，选项显示"实际 (Xh)"和"规划 (Yh)"
- [ ] T47: 选中 `actual` 时隐藏 buildTime 输入框；选中 `planned` 时显示
- [ ] T48: i18n 更新 `fleet_effective_time` → `fleet_planned_time`，新增 `fleet_actual_time` 和 `fleet_planned_time` key
- [ ] T49: buildTimeMode 持久化到方案
