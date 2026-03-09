# 需求说明：toolbar-action2one

## 目标
将 Toolbar 操作点的“默认命名、dirty 判定、空方案判定、SmartSave 编排、保存成功消息提示（toast）”从分散分支收敛到统一流程，并为 `ImportPlanModal(mode=import)` 的 empire 导入链路增加 controller 编排入口，保证行为一致与可扩展。

## 已确认方案（审核重点）
1. 单一编排入口
- 以 `useToolbarWorkflowController` 作为 Toolbar 流程唯一入口。
- `StationToolbar.vue` 只触发 action，不再写三模块业务分支。
- `SmartSaveDialog.vue` 只负责收集选择/名称并回传，不直连 store 分支。

2. 统一动作语义
- 基础动作：`SAVE`、`SAVE_AS(name)`、`NEW`。
- 组合动作：
  - `OVERWRITE_AND_NEW = SAVE -> NEW`
  - `SAVE_AS_AND_NEW = SAVE_AS(name) -> NEW`
  - `DISCARD_AND_NEW = NEW`

3. store 对外语义统一（允许函数名不同）
- 各 store 提供等价语义能力：`save`、`saveAs`、`new`、`isDirty`、`isEmptyForSave`、`isEditable`、`requiresSaveAsOnSave`。
- controller 可映射到不同函数名，但语义必须一致。
- 不要求把 store 方法改成纯 proxy，允许内部保留原有实现。

4. `isEmptyForSave()` 统一规则（含 NEW）
- `SAVE`、`SAVE_AS`、`NEW` 均先走 `isEmptyForSave()`。
- 行为：
  - `SAVE/SAVE_AS`：`true` 时拒绝并提示。
  - `NEW`：`true` 时直接新建；`false` 时进入非空流程（dirty 决定是否走 SmartSave）。
- 特例：
  - ship-build：`equipment_id` 非空且 `count=0`，判定为非空。
  - empire/station：存在 station 即判定为非空（即使无 module）。

5. 默认命名策略统一
- 统一由 `getDefaultName(storeType, ctx)` 产出默认名。
- `useTitleEditor` 保留，仅负责编辑交互。
- empire 与其它模块一致：数据层允许 `name=''`，标题由 `displayTitle` 走默认名展示。

6. 未保存对象的保存行为统一
- `SAVE` / `SAVE_AS` 在“当前对象未保存过”时，行为与当前 `SAVE_AS` 一致：弹输入弹窗。
- 该判断由各 store 的 `requiresSaveAsOnSave` 提供，controller 不直接读取模块内部状态。
- 弹窗输入初值按当前 `displayTitle`（`name || defaultName`），不拼 copy 后缀。
- `SAVE_AS` 场景无“另存为副本”勾选，主按钮仅为保存。

7. 保存成功消息（toast）统一策略
- 保存成功 toast 不再由 `StationToolbar.vue` 分支手动触发。
- 统一由 controller 按“实际执行结果”触发：
  - 仅当本次 action 实际执行了 `SAVE` 或 `SAVE_AS` 且成功时，触发一次 success toast。
  - `NEW`（无保存步骤）不触发 success toast。
- warning/error 也由 controller 统一出口触发（如空方案、空名称等）。

8. 新增 import 路径与原子导入操作
- controller 增加 `path: import`（仅接管 `ImportPlanModal(mode=import)` 的 empire 模式）。
- 新增原子操作 `importData`，用于执行“将导入数据落盘到 store”的动作。
- import 路径直接复用 controller 既有 `save/reset/dirty` 能力，不新增 store 级 `...BeforeImport` 接口。
- controller 内部再按既有映射调用 store 普通 `save/reset` 语义实现。
- import 组合语义：
  - `SAVE_AND_IMPORT = SAVE -> RESET -> IMPORT_DATA`
  - `DISCARD_AND_IMPORT = RESET -> IMPORT_DATA`
- controller.import 为 `logic-flow` 与 `ship-build` 提供 dummy handler（unsupported），避免后续另起分支实现。
- 其他 import（station 模式、game-blueprint、x4-station）保持不变。

## In Scope
- 收敛 Toolbar + SmartSave 的流程编排。
- 统一三模块动作语义、`isEmptyForSave`、dirty 入口。
- 统一 Toolbar 操作点的保存成功/失败提示触发策略。
- controller 新增 import 路径并接管 empire-import 流程编排。

## Out of Scope
- 不改业务数据模型（blueprint/flow/empire schema）。
- 不改导入导出流程。
- 不改 `ImportPlanModal` 的 station 模式与 blueprint/x4-station 导入策略弹窗逻辑。
- 不改 UI 样式与视觉。

## 验收标准（DoD）
1. `StationToolbar.vue` 与 `SmartSaveDialog.vue` 不再直接维护三模块流程分支。
2. `NEW/SAVE/SAVE_AS` 都通过 controller 单一入口执行。
3. 三模块组合动作序列满足：
- `OVERWRITE_AND_NEW = SAVE -> NEW`
- `SAVE_AS_AND_NEW = SAVE_AS -> NEW`
- `DISCARD_AND_NEW = NEW`
4. 三模块均实现 `isEmptyForSave()`，并满足 ship-build/empire 两个特例。
5. `NEW` 也经过 `isEmptyForSave()` 判定，空/非空分支行为一致。
6. 默认名通过 `getDefaultName(storeType, ctx)` 统一产出。
7. empire 数据层允许空名称；默认名仅用于展示层兜底。
8. 未保存对象触发 `SAVE` 时，必须与 `SAVE_AS` 一致弹窗；输入初值为 `displayTitle`。
9. Toolbar 操作中，执行成功的 `SAVE/SAVE_AS` 统一只弹一次 success toast；不发生保存步骤时不弹 success toast。
10. `ImportPlanModal(mode=import)` 的 empire 模式改由 controller.import 路径编排，且 `SAVE_AND_IMPORT` / `DISCARD_AND_IMPORT` 序列满足已确认方案。
11. import 路径新增原子 `importData`；`save/reset/dirty` 复用 controller 既有能力，不新增 store 级 import 接口。
12. `logic-flow`/`ship-build` 在 controller.import 存在 dummy handler（unsupported），统一未来扩展入口。

## 未决项
无。
