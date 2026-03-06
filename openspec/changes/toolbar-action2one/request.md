# 需求说明：toolbar-action2one

## 目标
统一 `ship-build`、`logicFlow`、`empire/station` 三个模块在 Toolbar 的 `新建/保存/另存为` 与 `SmartSaveDialog` 的行为口径，消除同名操作行为不一致与分支散落问题。

## 已确认方案（审核重点）
1. 统一动作语义与组合动作
- 基础动作：`SAVE`（覆盖当前活动对象）、`SAVE_AS(name)`（创建新对象）、`NEW`（进入新建工作态）。
- 组合动作：
  - `OVERWRITE_AND_NEW = SAVE -> NEW`
  - `SAVE_AS_AND_NEW = SAVE_AS(name) -> NEW`
  - `DISCARD_AND_NEW = NEW`

2. 统一“执行时映射”原则
- 仅在用户点击具体动作按钮时，映射到对应模块函数。
- 禁止使用 `isNewPlan/showInput` 等状态推断替代动作映射。
- 名称校验仅适用于 `SAVE_AS(name)` 场景。

3. 分层抽取方案
- 纯策略函数下沉到 `src/utils/smartSavePolicy.ts`：
  - 负责动作计划生成与输入校验，不产生副作用。
- 执行编排下沉到 `src/composables/useSmartSaveRunner.ts`：
  - 负责将动作计划映射到各模块 store 函数并按序执行。
- `SmartSaveDialog.vue` 与 `StationToolbar.vue` 仅保留 UI 事件采集与调用入口。

4. 各模块执行映射（执行时）
- ship-build：
  - `SAVE` -> `saveBlueprint()`
  - `SAVE_AS(name)` -> `saveAsBlueprint(name)`
  - `NEW` -> `clearLoadoutForCurrentShip()`
- logicFlow：
  - `SAVE` -> `saveCurrentPlan(currentName?)`
  - `SAVE_AS(name)` -> `activeId=null` 后 `saveCurrentPlan(name)`
  - `NEW` -> `clearAll()`
- empire/station：
  - `SAVE` -> `saveEmpire()`
  - `SAVE_AS(name)` -> 复制当前 empire 并写入为新对象
  - `NEW` -> `resetEmpireWithDefaultName(...)`

## In Scope
- 统一 Toolbar 与 SmartSaveDialog 的动作决策与执行映射。
- 抽取并落地 `utils` 与 `composables` 的共享模块。
- 修复“覆盖并新建/另存为并新建”在不同模块行为不一致问题。

## Out of Scope
- 不修改各模块业务数据模型（blueprint/flow/empire schema）。
- 不改导入导出策略与业务计算逻辑。
- 不改视觉样式与文案体系。

## 验收标准（DoD）
1. 三模块 `OVERWRITE_AND_NEW` 均执行 `SAVE -> NEW`，且不会被空名称拦截。
2. 三模块 `SAVE_AS_AND_NEW` 均执行 `SAVE_AS(name) -> NEW`，并能创建新对象。
3. 三模块 `DISCARD_AND_NEW` 均只执行 `NEW`。
4. `SAVE_AS` 空名称会被阻断，`SAVE/OVERWRITE_AND_NEW` 不受空名称阻断。
5. `StationToolbar.vue` 与 `SmartSaveDialog.vue` 不再各自维护分散的动作分支细节。
6. 抽取文件固定为：`src/utils/smartSavePolicy.ts` 与 `src/composables/useSmartSaveRunner.ts`。

## 未决项
无。
