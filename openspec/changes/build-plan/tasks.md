# build-plan 任务（修订版）

## 任务列表

### T1: 更新类型定义 [x]

- 修改 `src/types/build-plan.ts`
- 新增 `BuildSchemeStep` 接口
- 新增 `BuildScheme` 接口（label、description、purposeModules、steps、totalDuration、totalCredits、stepsCount、isFeasible）
- 更新 `BuildPlan`：移除 `constraints`（预算约束），新增 `schemes: BuildScheme[]`
- 更新 `CalculateBuildPlanInput`：移除 `timeBudget`/`creditBudget`，新增 `currentNetProduction`

### T2: 重写算法 calculateBuildPlan [x]

- 文件: `src/store/logic/calculateBuildPlan.ts`
- 引入 `calculateAutoFillModules` 调用
- 实现目标类型分支：
  - 自举 → 仅方案1（贪婪算法）
  - 产量/建筑 → 方案3→2→1 递进
- 方案3：目标模块 + autoFill → 识别建材模块（产出在 R3 中的模块）→ 剔除 → 方案3'
- 方案2：按 R3' 的 whichWares + R3 的 targetRates 规划产线 → autoFill
- 方案1：greedyFill(R2 + R3_remaining) → autoFill
- 产能需求计算：总需求量 / 总建造时间
- 输出 `BuildScheme[]`

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

### T10: selfSufficient 分离 + 类型更新 [x]

- 修改 `src/types/build-plan.ts`：
  - `BuildGoal` 移除 `{ type: 'self-sufficient' }` 变体
  - `CalculateBuildPlanInput` 新增 `selfSufficient: boolean`
  - `BuildPlan` 新增 `selfSufficient: boolean`
- 修改 `src/types/x4.ts`：
  - 新增 `LocalizedX4Ware`（含 `localeName`）
  - 新增 `WareGroupResult`（含 `group` + `displayLabel` + `wares`）
  - 新增 `GroupedWareItem`（含 `displayLabel` + `moduleGroup`）

### T11: 算法适配 selfSufficient 参数 [x]

- 文件: `src/store/logic/calculateBuildPlan.ts`
- `selfSufficient` 从 goals 数组改为 `input.selfSufficient` 参数读取
- 目标合并规则更新（见 design.md §10）

### T12: Store 新增 selfSufficient [x]

- `src/store/useBlueprintProductionStore.ts`
- 新增 `selfSufficient: Ref<boolean>` + `setSelfSufficient(val: boolean)` action
- 持久化到 localStorage
- `computePlan()` 传入 `selfSufficient` 到算法

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
  4. self-sufficient checkbox + 方案计数 + warnings
- 移除原有的：类型 select、ware/module 手写下拉、添加按钮、rate/count 输入
- 默认添加数量：
  - production-rate：`findModuleForWare(wareId, racePreference).outputs[wareId]` 取整
  - build-module：1

### T18: Presenter 适配 [x]

- `src/components/empire/presenters/useBuildPlanPresenter.ts`
- 新增 `selfSufficient` / `setSelfSufficient` 透传
- 新增 `updateGoal(index: number, value: number)` emit（目标数量修改）

### T19: i18n 更新 [x]

- `src/locales/en.json` / `zh-CN.json`
- 新增 self-sufficient checkbox key
- 新增 BuildGoalSearchBox category label key
- 新增 WarePlanningItem 相关 key

### T20: 构建验证 [x]

- `npm run build` 通过
- 无 TypeScript 编译错误

## 依赖顺序

```
T1-T9（已完成）
T10 → T11 → T12
T10 → T13 → T14
T10 + T13 → T15
T13 + T14 → T16
T15 + T16 → T17
T12 → T18
T17 + T18 → T19 → T20
```

T10/T13 可并行。
T11/T12 依赖 T10，可在 T13 并行期间串行执行。
T15/T16 可并行（T15 依赖 T10+T13，T16 依赖 T13+T14）。
