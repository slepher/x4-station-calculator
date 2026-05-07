# build-plan-storage 任务

## Phase 1: 类型与版本常量

- [x] T1: 在 `src/types/build-plan.ts` 中新增 `SavedBuildPlanGoalsState` 和 `BuildPlanGoalSnapshot` 类型定义
- [x] T2: 在 `src/store/logic/storageVersions.ts` 中新增 `CURRENT_BUILD_PLAN_GOALS_VERSION = 1`

## Phase 2: getStorageKey 扩展

- [x] T3: 在 `useGameDataStore.getStorageKey` 的参数类型中新增 `'build_plan_goals'`，fallback key = `x4_build_plan_goals`
- [x] T4: 更新 `currentVersionConfig` 的 `storage_keys` 类型定义以支持 `build_plan_goals`

## Phase 3: Store 持久化与 CRUD

- [x] T5: 在 `useBuildPlanStore` 中新增 `savedPlans` ref，初始化为空 `SavedBuildPlanGoalsState`
- [x] T6: 实现 `loadPlansFromStorage()` — 读取 localStorage、解析、恢复 `buildGoals`（若 activeId 存在）
- [x] T7: 实现 `savePlansToStorage()` — 写入 localStorage
- [x] T8: 实现 `ensureActivePlan()` — 无 activeId 时自动创建默认方案
- [x] T9: 实现 `createNewPlan()` — 创建空方案并切换
- [x] T10: 实现 `switchPlan(planId)` — 加载 buildGoals + 还原 logicFlowPlanId
- [x] T11: 实现 `deletePlan(planId)` — 删除方案 + 切换逻辑
- [x] T12: 实现 `updateLogicFlowPlanId()` — 切换 logicFlow 时更新当前方案的 logicFlowPlanId
- [x] T13: 实现 `activePlanName` getter/setter — 读写当前方案的 name
- [x] T14: 实现 `syncGoalsToActivePlan()` — 将当前 buildGoals 同步到 activePlan 并保存
- [x] T15: 修改 `setBuildGoal()` — 调用 `ensureActivePlan()` + `syncGoalsToActivePlan()`
- [x] T16: 修改 `removeBuildGoal()` — 调用 `syncGoalsToActivePlan()`
- [x] T17: 新增 watch `logicFlowStore.savedPlans.activeId` — 调用 `updateLogicFlowPlanId()`
- [x] T18: 在 store 初始化逻辑中调用 `loadPlansFromStorage()`
- [x] T19: 更新 store return 导出新增字段和方法

## Phase 4: Presenter 层

- [x] T20: 新增 `PlanItem` 接口，更新 `BuildPlanPresenterProps` — 添加 `planName`、`activePlanId`、`loadablePlanItems`
- [x] T21: 新增 `BuildPlanPresenterEmits` — 添加 `createNewPlan`、`switchPlan`、`deletePlan`、`setPlanName`
- [x] T22: 更新 `BuildPlanPresenterBuildPlanStore` 接口 — 添加新增方法签名
- [x] T23: 实现 props computed — `planName`、`activePlanId`、`loadablePlanItems` 从 store 映射
- [x] T24: 实现 emits — 绑定到 store 方法
- [x] T25: 修改 `updateGoal` emit — 赋值后调用 `syncGoalsToActivePlan()`
- [x] T26: 移除 `flowPlanName`、`activeFlowPlanId`、`loadableFlowPlans` props 和 `loadFlowPlan` emit

## Phase 5: Vue 组件

- [x] T27: `BuildPlanConstraintsPanel` — 新增方案相关 props/emits
- [x] T28: Panel-header — 左侧标题改为 `useTitleEditor` 可编辑，右侧改为方案菜单按钮+浮动下拉
- [x] T29: 方案菜单浮动下拉 — 实现 "新建" 项、方案列表（含 x 删除按钮）、高亮当前项
- [x] T30: Panel-content — 将 logic-flow 菜单和建材产线 checkbox 移到计算按钮上方同一行
- [x] T31: Panel-content — 移除原位置的建材产线 checkbox 行
- [x] T32: `BlueprintProductionWorkbenchView` — 更新 props/emits 绑定
- [x] T33: 移除 Panel-header 中原有的 logic-flow 菜单代码（已移至新位置）

## Phase 6: i18n

- [x] T34: 在 `src/locales/en.json` 和 `src/locales/zh-CN.json` 中添加 `build_plan.new_plan`、`build_plan.no_active_plan`、`build_plan.no_plans`、`build_plan.default_plan_name`

## Phase 7: 构建验证

- [x] T35: `npm run build` 通过
