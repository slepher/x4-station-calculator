## Context
当前 `StationToolbar.vue` 与 `SmartSaveDialog.vue` 都包含模块分支与动作判断，且判断条件互相耦合，导致同名动作在不同模块执行结果不一致。已有问题包括：
- `覆盖并新建` 在特定条件下被空名称拦截。
- `另存为并新建` 在 ship-build 场景未必走 `saveAs`，导致未创建新蓝图。

## Goals
1. 统一动作语义与组合动作流程。
2. 将决策与执行从组件中抽离，减少分支散落。
3. 保持各模块 `NEW` 的领域差异（例如 ship-build 保留当前 ship）。

## Non-Goals
1. 不改变 store 数据模型。
2. 不改导入导出流程。
3. 不改 UI 布局与视觉样式。

## Architecture

### 1) 策略层（Pure Functions）
文件：`src/utils/smartSavePolicy.ts`

职责：
- 输入上下文（intent、storeType、用户选择、是否需要名称、名称值）。
- 输出动作计划（ActionPlan）。
- 返回校验结果（仅对 `SAVE_AS` 做名称校验）。

特性：
- 无副作用。
- 可直接做单元测试，覆盖核心组合动作。

### 2) 执行层（Composable）
文件：`src/composables/useSmartSaveRunner.ts`

职责：
- 接收 ActionPlan。
- 按 `storeType` 将 ActionStep 映射到具体 store 函数。
- 按序执行步骤（例如 `SAVE_AS -> NEW`）。

映射：
- ship-build：`saveBlueprint / saveAsBlueprint / clearLoadoutForCurrentShip`
- logicFlow：`saveCurrentPlan / (activeId=null + saveCurrentPlan) / clearAll`
- empire：`saveEmpire / clone+saveEmpire / resetEmpireWithDefaultName`

### 3) 组件层（UI）
- `SmartSaveDialog.vue`：
  - 只负责收集用户选择（覆盖并新建、另存为并新建、丢弃并新建）与输入名称。
  - 调用 policy 产出计划，再调用 runner 执行。
- `StationToolbar.vue`：
  - 只负责入口与弹窗开关，不再维护复杂动作分支。

## Execution Flow
1. 用户在 toolbar 触发 `NEW/SAVE/SAVE_AS`。
2. 若需弹窗，由 SmartSaveDialog 采集最终动作。
3. policy 生成 ActionPlan。
4. runner 按模块映射执行。
5. UI 关闭弹窗并刷新状态。

## Risks
1. 旧分支残留会导致“双路径并存”，需在重构时移除重复逻辑。
2. logicFlow 的 `SAVE_AS` 依赖 `activeId=null` 语义，需在 runner 中明确封装。
3. empire 的“复制另存为”若继续散落在组件，会破坏统一性，应在 runner 侧集中。

## Validation Plan
1. policy 单测：覆盖 3 个组合动作和名称校验边界。
2. runner 单测：覆盖三模块 ActionStep -> store 函数映射。
3. UI 集成回归：验证 `覆盖并新建` 与 `另存为并新建` 在三模块流程一致。
