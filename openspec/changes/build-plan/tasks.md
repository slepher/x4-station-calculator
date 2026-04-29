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

## 依赖顺序

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

T4/T5 可并行。
T6 内部 BuildPlanPanel + BuildPlanStepsModal 可并行开发。

## 元注释

T1 中 `BuildScheme` 新增类型统一放在 `src/types/build-plan.ts`。
