# build-plan 任务（修订版）

## 任务列表

### T1: 更新类型定义 [x]

- 修改 `src/types/build-plan.ts`
- 新增 `BootstrapMode` 枚举（None / Joint / CoupledIterative / IsolatedSpecialized）
- 新增 `BuildSchemeStep` 接口
- 新增 `BuildScheme` 接口（label、description、purposeModules、steps、totalDuration、totalCredits、stepsCount、isFeasible）
- 更新 `BuildPlan`：移除 `constraints`（预算约束），新增 `schemes: BuildScheme[]`
- 更新 `CalculateBuildPlanInput`：移除 `timeBudget`/`creditBudget`，新增 `currentNetProduction`，新增 `bootstrapMode: BootstrapMode`

### T2a: 重写算法框架 calculateBuildPlan [x]

- 文件: `src/store/logic/calculateBuildPlan.ts`
- 引入 `calculateAutoFillModules` 调用
- 实现 `bootstrapMode` 分支逻辑（见 design.md §2）
- 方案3：目标模块 + autoFill → 识别建材模块 → 剔除 → 方案3'
- 方案2：按 R3' 的 whichWares + R3 的 targetRates 规划产线 → autoFill
- 输出 `BuildScheme[]`

### T2b: 不自举/联合自举 [x]

- 不自举：当前产能足够则只输出方案3（目标产线），不足则输出方案2+3
- 联合自举：greedyFill(C_buildCost) → A+B 联合模块，输出方案1(A+B) + 方案2(C)
- 前置知识：电子黏土+船体部件是大部分建筑模块的材料；A 模块本身用 先进复合材料+等离子导体

### T2c: 耦合迭代自举 [x]

- A↔B 外层循环，所有内部迭代用 greedyFill
- A 的产出（电子黏土+船体部件）需同时满足 (C+B) & A_autoFill 两个 source 的约束
- 每轮：greedyFill → A → autoFill(A) → greedyFill → B → autoFill(B) → 检查两个 source 满足率 ≥ 100%
- 不满足则追加 A → 重新计算 B → 直至收敛

### T2d: 孤立特种自举 [x]

- B→A→C 单向顺序，无循环依赖
- B：greedyFill(A 材料需求中 B 的产出)，外部供应
- A：greedyFill(C + A_autoFill)，自迭代
- 输出方案1(B) + 方案2(A) + 方案3(C)

### T3: 修改 Store [x]

- `src/store/useBlueprintProductionStore.ts`
- 移除 `buildConstraints` 中的预算输入依赖
- 新增 `empireCurrentNetProduction` computed
- `computePlan()` 调用新算法
- 移除 `setTimeBudget`/`setCreditBudget` actions

### T4: 修改 Presenter [x]

- `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 移除 `setTimeBudget`/`setCreditBudget` emits
- 新增 `schemes` prop
- 调整 `progress`/`warnings` 计算适配新结构

### T5: 修改约束面板 [x]

- `src/components/empire/BuildPlanConstraintsPanel.vue`
- 移除预算输入（时间/金钱输入框 + 标签）
- 保留目标管理（类型选择、ware搜索、模块搜索、添加/删除）
- 保留计算按钮

### T6: 重写方案面板 + 浮动窗口 [x]

- `src/components/empire/BuildPlanPanel.vue` → 重写为方案卡片列表
  - 每张卡片显示 方案名称、主要目的产物列表、预估时间、预估金钱
  - 卡片点击 emit `select-scheme` 事件
- `src/components/empire/BuildPlanStepsModal.vue` → **新增**浮动窗口
  - 深色半透明遮罩
  - 居中窗口显示该方案详细步骤
  - 步骤：合并连续相同模块，显示模块名、材料清单、时间、花费
  - 关闭按钮

### T7: 修改 WorkbenchView [x]

- `src/components/empire/BlueprintProductionWorkbenchView.vue`
- 左面板传入移除预算后的 props
- 中面板集成新 BuildPlanPanel + BuildPlanStepsModal
- 右面板不变

### T8: 构建验证 [x]

- `npm run build` 通过
- 无 TypeScript 编译错误

### T9: 更新 i18n [x]

- `src/locales/en.json` / `zh-CN.json`
- 移除预算相关 key
- 新增方案相关 key（方案名称、目的产物、浮动窗口标题等）

### T10: BootstrapMode 类型更新 [x]

- 修改 `src/types/build-plan.ts`：
  - 新增 `BootstrapMode` 枚举（None / Joint / CoupledIterative / IsolatedSpecialized）
  - `BuildGoal` 移除 `{ type: 'self-sufficient' }` 变体
  - `CalculateBuildPlanInput` 新增 `bootstrapMode: BootstrapMode`
  - `BuildPlan` 新增 `bootstrapMode: BootstrapMode`
- 修改 `src/types/x4.ts`：
  - 新增 `LocalizedX4Ware`（含 `localeName`）
  - 新增 `WareGroupResult`（含 `group` + `displayLabel` + `wares`）
  - 新增 `GroupedWareItem`（含 `displayLabel` + `moduleGroup`）

### T11: 算法适配 bootstrapMode 参数 [x]

- 文件: `src/store/logic/calculateBuildPlan.ts`
- `bootstrapMode` 从参数读取，走对应分支（见 design.md §2）
- `selfSufficient` 相关逻辑全部移除

### T12: Store 新增 bootstrapMode [x]

- `src/store/useBlueprintProductionStore.ts`
- 移除 `selfSufficient: Ref<boolean>` 和 `setSelfSufficient`
- 新增 `bootstrapMode: Ref<BootstrapMode>` + `setBootstrapMode(mode: BootstrapMode)` action
- 持久化到 localStorage
- `computePlan()` 传入 `bootstrapMode` 到算法

### T13: GameData 新增商品本地化 [x]

- `src/store/logic/useGameData.ts`：新增 `buildLocalizedWaresMap()`
- `src/store/useGameDataStore.ts`：新增 `localizedWaresMap` ref + 暴露

### T14: 新增商品分组搜索 [x]

- 新建 `src/store/logic/searchWare.ts`
- 实现 `generateFilteredWaresGrouped(query, currentLocale, localizedWaresMap, localizedModuleGroupsMap, includeWare?)`
- 用 `X4Ware.group` 映射到 `localizedModuleGroupsMap` 做分组 header 和排序
- 对标 `generateFilteredModulesGrouped()` 的搜索/分组/排序逻辑

### T15: 新增 WarePlanningItem 组件 [x]

- 新建 `src/components/empire/WarePlanningItem.vue`
- 对标 `StationPlanningItem` 样式：颜色条（`module_group.color_rgb`）+ 名称 + 数量输入 + × 删除
- Props: `goal: BuildGoal`, 翻译函数返回的 display name
- Emits: `update:value`（数量修改）, `remove`
- 数量输入用 `X4NumberInput`，min=1 step=1 整数
- DLC tag 显示（ware 和 module 均有 dlc_tag）

### T16: 新增 BuildGoalSearchBox 组件 [x]

- 新建 `src/components/empire/BuildGoalSearchBox.vue`
- 样式对标 `MapSavePoiSearchControl.vue`：左侧搜索输入 + 右侧 category dropdown
- Category 选项：product / module
- 切换 category 时清空搜索输入
- Teleport to body 弹层，分组显示搜索结果
- product 模式：调用 `generateFilteredWaresGrouped()`，用 `localizedModuleGroupsMap` 分组
- module 模式：调用 `generateFilteredModulesGrouped()`
- 每个结果项：color-indicator（module_group.color_rgb）+ 翻译名 + DLC tag
- 点击结果直接 emit `add-goal`，不经过中间确认
- Focus/Blur 控制对标 `StationModulePicker`（focusSnapshot 回退、popover mousedown prevent、ESC 关闭）

### T17: 重写 BuildPlanConstraintsPanel [x]

- 重写布局（上→下）：
  1. BuildGoalSearchBox（搜索+类型切换，点击直接添加到列表）
  2. 目标卡片列表（WarePlanningItem，可调数量、可删除）
  3. 计算按钮
  4. **通用自举模式 dropdown**（四个选项）+ 方案计数 + warnings
- 移除原有的：类型 select、ware/module 手写下拉、添加按钮、rate/count 输入
- 移除 self-sufficient checkbox
- 默认添加数量：
  - production-rate：`findModuleForWare(wareId, racePreference).outputs[wareId]` 取整
  - build-module：1

### T18: Presenter 适配 [x]

- `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 移除 `selfSufficient` / `setSelfSufficient` 透传
- 新增 `bootstrapMode` / `setBootstrapMode` 透传
- 新增 `updateGoal(index: number, value: number)` emit（目标数量修改）

### T19: i18n 更新 [x]

- `src/locales/en.json` / `zh-CN.json`
- 移除 self-sufficient checkbox key
- 新增 bootstrap_mode / bootstrap_none / bootstrap_joint / bootstrap_coupled / bootstrap_isolated key
- 新增各模式方案标签 key
- 新增 BuildGoalSearchBox category label key
- 新增 WarePlanningItem 相关 key

### T20: 构建验证 [x]

- `npm run build` 通过
- 无 TypeScript 编译错误

## Logic-Flow 导入菜单

### T21: Presenter 扩展 [x]

- `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 新增 `FlowPlanItem` 接口（id, name, index）
- `BuildPlanPresenterProps` 新增 `flowPlanName: ComputedRef<string>`、`loadableFlowPlans: ComputedRef<FlowPlanItem[]>`
- `BuildPlanPresenterEmits` 新增 `loadFlowPlan: (planId: string) => void`
- `useBuildPlanPresenter` 内部调用 `useLogicFlowStore()` 获取方案列表
- `flowPlanName` 根据 `savedPlans.activeId` 查找当前方案名称
- `loadableFlowPlans` 映射 `savedPlans.list` 为 `FlowPlanItem[]`
- `loadFlowPlan` 按 `planId` 查找 index 后调用 `logicFlow.loadPlan(index)`

### T22: BuildPlanConstraintsPanel 添加导入菜单 [x]

- `src/components/empire/BuildPlanConstraintsPanel.vue`
- 新增 props: `flowPlanName`, `loadableFlowPlans`
- 新增 emit: `loadFlowPlan`
- `panel-header` 改为 `flex items-center justify-between`，左侧标题，右侧按钮
- 按钮显示当前 flow 方案名（无方案时显示 `build_plan.import_flow_placeholder`）
- 按钮右侧 chevron 箭头图标
- 点击按钮 → `Teleport to body` 弹出浮动菜单
- 菜单定位：Y 轴顶部对齐按钮顶部，X 轴左边缘对齐面板右边缘 + 8px
- 菜单列出 `loadableFlowPlans`，当前激活方案高亮（`flow-plan-menu-item-active`）
- 空列表显示 `build_plan.import_flow_empty`
- 点击方案 → `emit('loadFlowPlan', planId)` → 关闭菜单
- 点击菜单外部 → `mousedown` 监听 → 关闭菜单
- `resize`/`scroll` 时更新菜单位置
- `onUnmounted` 清理事件监听

### T23: i18n 更新 [x]

- `src/locales/zh-CN.json`: `import_flow_placeholder`="无", `import_flow_tooltip`="载入逻辑产线方案", `import_flow_empty`="暂无已保存的逻辑产线方案"
- `src/locales/en.json`: `import_flow_placeholder`="None", `import_flow_tooltip`="Load Logic Flow Plan", `import_flow_empty`="No saved logic flow plans"

### T24: WorkbenchView 集成 [x]

- `src/components/empire/BlueprintProductionWorkbenchView.vue`
- `BuildPlanConstraintsPanel` 传入新 props: `:flowPlanName`, `:loadableFlowPlans`
- 绑定新 emit: `@load-flow-plan`

### T25: 构建验证 [x]

- `npm run build` 通过
- 无 TypeScript 编译错误

## 依赖顺序

```
T1-T9（已完成）
T10 → T11 → T12
T10 → T13 → T14
T2a → T2b → T2c → T2d（按顺序实现 4 种模式，T2b-T2d 可并行）
T10 + T13 → T15
T13 + T14 → T16
T15 + T16 → T17
T10 + T12 → T18
T17 + T18 → T19 → T20
```

T10/T13/T2a 可并行。
T11/T12/T2b→T2d 依赖 T10，可在 T13 并行期间串行执行。
T2b/T2c/T2d 逻辑独立，可并行实现。
T15/T16 可并行（T15 依赖 T10+T13，T16 依赖 T13+T14）。

---

## 产线自动分配

### T26: 类型定义更新 [x]

- 修改 `src/types/build-plan.ts`
- `BuildGoal` 新增 `{ type: 'derived-rate'; wareId: string; ratePerHour: number }` 变体
- 新增 `ProductionLineAllocation` 接口

### T27: 产线分配核心算法 [x]

- 新建 `src/store/logic/computeProductionLineAllocation.ts`
- 实现 `computeProductionLineAllocation(goals, flowPlan, buildFlowView) → ProductionLineAllocation[]`
- 三级匹配：build-flow outputMaterialTag → logic-flow manual/auto node → 未命中
- 派生 goal 生成：walkUpstream 递归检测 isolated 节点
- `buildCoveredSet()` + `findConnection()` 辅助函数
- 派生 goal 的 `covered` 集合检查包含 user goal wares + 所有产线节点 wareIds（排除 isolated）
- **依赖**: build-flow 和 logic-flow 的 store 数据
- **Tests**: `tests/unit/build-plan/computeProductionLineAllocation.spec.ts` (13 tests)

### T28: Store 适配 [x]

- `src/store/useBlueprintProductionStore.ts`
- `computePlan()` 接受可选 `effectiveGoals` 参数，支持传入全量 goals（user + derived）
- `buildGoals` 类型层面已支持 `derived-rate`

### T29: Presenter 扩展 [x]

- `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 引入 `useLogicFlowStore` 获取当前活跃 plan 的 `groups`
- 引入 `useGameDataStore` 获取 `modulesMap`, `modulesByOutputMap`
- 新增 computed `allocations: ComputedRef<ProductionLineAllocation[]>`
- `allocations` 依赖：`goals`、`flowPlan.groups`、`buildFlowView`
- `computePlan` 传入 allocations 中的全量有效 goals
- `updateGoal` 对 `derived-rate` 类型禁止修改（no-op）
- `BuildPlanPresenterStore` 接口更新：`computePlan(effectiveGoals?: BuildGoal[])`

### T30: UI 产线分配区域 [x]

- 新建 `src/components/empire/ProductionLineAllocationSection.vue`
- Props: `allocations`, `goals`, `racePreference`
- 渲染：
  - 每条产线一个分组（group header + goal list）
  - user goal: 数量编辑 + 删除按钮
  - derived goal: 锁定图标 + 0/h 显示，不可编辑不可删除
  - "未命中"分组虚线边框，末尾显示
- 无 goal 时 `v-if` 隐藏整个区域
- Emits: `update-goal(index, value)`, `remove-goal(index)`（仅对 user goal）
- 通过 `getStoreIndex(goal)` 映射 UI item 到 store 索引

### T31: BuildPlanConstraintsPanel 布局调整 [x]

- `src/components/empire/BuildPlanConstraintsPanel.vue`
- 移除原有 WarePlanningItem 列表渲染和 `getGoalDisplayInfo`/`visibleGoals`
- 在 `BuildGoalSearchBox` 下方插入 `ProductionLineAllocationSection`
- Props 新增 `allocations: ProductionLineAllocation[]`
- 保留 `schemeCount` computed

### T32: WorkbenchView 集成 [x]

- `src/components/empire/BlueprintProductionWorkbenchView.vue`
- `BuildPlanConstraintsPanel` 传入新 prop: `:allocations`

### T33: i18n 更新 [x]

- `src/locales/en.json` / `zh-CN.json`
- `build_plan.unmatched` = "Unmatched" / "未命中"
- `build_plan.derived_locked` = "Auto-generated; quantity calculated during compute" / "自动生成，数量由计算阶段确定"

### T34: 构建验证 [x]

- `npm run build` 通过
- 无 TypeScript 编译错误
- 新 unit tests: 13/13 通过

### 依赖顺序

```
T26 → T27 → T29
T29 + T27 → T28 (Store 轻量适配)
T29 + T26 → T30
T30 → T31
T31 + T29 → T32
T32 → T33 → T34
```

T26 可与其他任务并行准备，T27/T28/T29 可部分并行（T27 纯算法无 store 依赖，T28/T29 均依赖 T26）。
