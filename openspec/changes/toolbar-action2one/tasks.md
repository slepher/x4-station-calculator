# Tasks: toolbar-action2one

## 1. 流程收敛
- [x] 1.1 建立/完善 `useToolbarWorkflowController` 作为 Toolbar 唯一编排入口。
- [x] 1.2 在 controller 内实现统一 `runAction(action, payload?)` 与 storeType 识别。
- [x] 1.3 移除 `StationToolbar.vue` 的三模块业务分支，改为只调用 controller。
- [x] 1.4 `SmartSaveDialog.vue` 改为仅回传用户决策与输入，不直接编排 store 执行。

## 2. 统一语义映射
- [x] 2.1 在 controller 建立 store 语义映射（`save` / `saveAs` / `new` / `isDirty` / `isEmptyForSave`）。
- [x] 2.2 保持 store 函数名可不同，但行为语义一致。

## 3. isEmptyForSave 规则落地
- [x] 3.1 ship-build 实现 `isEmptyForSave()` 并覆盖 `SAVE/SAVE_AS/NEW` 前置判定。
- [x] 3.2 logicFlow 实现 `isEmptyForSave()` 并覆盖 `SAVE/SAVE_AS/NEW` 前置判定。
- [x] 3.3 empire 实现 `isEmptyForSave()` 并覆盖 `SAVE/SAVE_AS/NEW` 前置判定。
- [x] 3.4 ship-build 特例：`equipment_id` 非空且 `count=0` 判非空。
- [x] 3.5 empire 特例：存在 station 即判非空。

## 4. 动作序列统一
- [x] 4.1 `OVERWRITE_AND_NEW` 固定执行 `SAVE -> NEW`。
- [x] 4.2 `SAVE_AS_AND_NEW` 固定执行 `SAVE_AS(name) -> NEW`。
- [x] 4.3 `DISCARD_AND_NEW` 固定执行 `NEW`。
- [x] 4.4 `NEW` 固定先走 `isEmptyForSave()`：空直接新建，非空再看 dirty。

## 5. 消息提示统一（Toolbar 范围）
- [x] 5.1 将保存成功 toast 触发从组件分支迁移到 controller 统一出口。
- [x] 5.2 约束：每次成功执行 `SAVE` 或 `SAVE_AS`，只触发一次 success toast。
- [x] 5.3 约束：纯 `NEW` 不触发 success toast。
- [x] 5.4 约束：空方案/空名称拦截统一触发 warning。

## 6. 边界控制
- [x] 6.1 保持 station 模式、game-blueprint、x4-station 导入链路不改造。

## 7. Import 路径（empire 模式）
- [x] 7.1 在 controller 增加 `import` 操作路径。
- [x] 7.2 增加原子操作 `IMPORT_DATA`（导入数据落盘）。
- [x] 7.3 接管 `ImportPlanModal(mode=import)` 的 empire 模式确认分支。
- [x] 7.4 落地 `SAVE_AND_IMPORT = SAVE -> RESET -> IMPORT_DATA`。
- [x] 7.5 落地 `DISCARD_AND_IMPORT = RESET -> IMPORT_DATA`。
- [x] 7.6 import 路径直接复用 controller 既有 `save/reset/dirty` 逻辑，不新增 store 级 import 接口。
- [x] 7.7 在 controller.import 为 `logic-flow` 与 `ship-build` 提供 dummy handler（unsupported）作为预留入口。

## 8. 后续对齐（已落实）
- [x] 8.1 三模块 store 增加 `isEditable` 语义，按钮禁用由当前 store 统一控制。
- [x] 8.2 empire 名称允许为空字符串，默认名仅用于展示层兜底。
- [x] 8.3 三模块 store 增加 `requiresSaveAsOnSave` 语义，未保存对象点击 `SAVE` 统一弹 `SAVE_AS` 对话框。
- [x] 8.4 `SAVE_AS` 对话框输入初值与当前 `displayTitle` 保持一致，不追加 copy 后缀。
