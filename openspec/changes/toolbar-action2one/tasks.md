# Tasks: toolbar-action2one

## 1. 共享策略抽取（utils）
- [x] 1.1 新建 `src/utils/smartSavePolicy.ts`，定义统一动作类型与 ActionPlan。
- [x] 1.2 实现基础动作与组合动作规则（`SAVE`、`SAVE_AS`、`NEW`、`OVERWRITE_AND_NEW`、`SAVE_AS_AND_NEW`、`DISCARD_AND_NEW`）。
- [x] 1.3 实现名称校验边界：仅 `SAVE_AS` 需要名称非空。

## 2. 执行编排抽取（composable）
- [x] 2.1 新建 `src/composables/useSmartSaveRunner.ts`，接收 ActionPlan 并顺序执行。
- [x] 2.2 实现 `ship-build` 动作映射：`saveBlueprint / saveAsBlueprint / clearLoadoutForCurrentShip`。
- [x] 2.3 实现 `logicFlow` 动作映射：`saveCurrentPlan / activeId=null+saveCurrentPlan / clearAll`。
- [x] 2.4 实现 `empire` 动作映射：`saveEmpire / clone+saveEmpire / resetEmpireWithDefaultName`。

## 3. 组件接入收敛
- [x] 3.1 `SmartSaveDialog.vue` 改为“采集输入 + 调 policy + 调 runner”。
- [x] 3.2 `StationToolbar.vue` 移除重复动作分支，仅保留入口与弹窗控制。
- [x] 3.3 移除旧的分散判断，保证执行时映射唯一入口。

## 4. 行为一致性校验（实现内自检）
- [x] 4.1 逐模块确认 `OVERWRITE_AND_NEW` 执行序列为 `SAVE -> NEW`。
- [x] 4.2 逐模块确认 `SAVE_AS_AND_NEW` 执行序列为 `SAVE_AS -> NEW` 且创建新对象。
- [x] 4.3 确认 `DISCARD_AND_NEW` 仅执行 `NEW`。
