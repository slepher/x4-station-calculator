## Context
当前 Toolbar 相关流程分散在多个位置：
- 默认命名在 toolbar 分支计算。
- dirty 与空方案判断分散在多个视图分支。
- SmartSave 组合动作拆散在 toolbar/dialog/runner。
- 保存成功消息（toast）由局部分支手动触发，行为不一致。

该分散结构导致同名操作在不同模块出现提示与行为漂移。

## Goals
1. Toolbar 行为由单一 controller 编排。
2. 三模块 `NEW/SAVE/SAVE_AS` 语义一致。
3. `isEmptyForSave()` 统一并覆盖 `NEW`。
4. 默认命名统一入口，不接管 `useTitleEditor`。
5. 保存成功 toast 统一由编排层按执行结果触发。
6. 为 empire-import 提供可扩展的 controller.import 路径与原子导入操作。

## Non-Goals
1. 不变更业务 schema。
2. 不处理 import 的 station 模式与 blueprint/x4-station 策略弹窗收敛。
3. 不调整 UI 视觉。

## Architecture

### 1) Unified Workflow Controller
文件：`src/composables/useToolbarWorkflowController.ts`

职责：
- 识别当前 storeType（`ship-build | logicFlow | station`）。
- 提供统一入口：`runAction(action, payload?)`。
- 统一前置判定：`isEmptyForSave()`、`isDirty()`。
- 统一 SmartSave 子动作编排。
- 统一默认名策略：`getDefaultName(storeType, ctx)`。
- 统一消息分发（success/warning/error）。
- 增加 `import` 路径编排能力（empire 模式）。

约束：
- 流程分支只存在于 controller。
- 组件不再直接操作三模块业务流程。

### 2) Store Semantic Adapter
保留各 store 现有方法名，通过 controller 的语义映射层调用：
- `saveCurrent`
- `saveAs(name)`
- `newDraft`
- `isDirty`
- `isEmptyForSave`
- `isEditable`
- `requiresSaveAsOnSave`

要求：
- 行为语义一致，不强制函数同名。
- 复杂空判定特例留在 store 内实现。
- import 路径复用同一语义映射，不新增 import 专用 save/reset API。
- 未保存对象的 `SAVE -> SAVE_AS` 跳转由 store 语义提供，controller 不直接读取模块内部状态字段。

### 2.1) Name Behavior Alignment
- empire 与 flow/ship-build 对齐：持久化层允许 `name=''`。
- 默认名只用于展示（`displayTitle`），不强制写入数据层。

### 3) Import Path (Empire Mode Only)
controller 新增 import 编排：
- `runImportAction({ storeType: 'station', choice, importData })`
- `choice = 'SAVE_AND_IMPORT' | 'DISCARD_AND_IMPORT'`

原子动作：
- `IMPORT_DATA`：由业务侧回调提供具体导入落盘逻辑。

执行序列：
- `SAVE_AND_IMPORT = SAVE -> RESET -> IMPORT_DATA`
- `DISCARD_AND_IMPORT = RESET -> IMPORT_DATA`

约束：
- import 路径直接复用 controller 既有 `save/reset/dirty` 逻辑。
- controller 内部按原有映射调用普通 store 语义方法（如 `saveEmpire`、`resetEmpireWithDefaultName`）。
- 不引入 store 级 import 专用接口（如 `saveBeforeImport/resetBeforeImport/shouldConfirmBeforeImport`）。
- `logic-flow` 与 `ship-build` 在 controller.import 中提供 dummy handler（unsupported），统一未来接入点。

### 4) Message Strategy (Toolbar + Empire Import Scope)
消息由 controller 统一触发，不在组件分支手动发：
- `SAVE` / `SAVE_AS` 执行成功：发 1 条 success toast。
- `SAVE` / `SAVE_AS` 被空方案或空名称拦截：发 warning toast。
- `NEW` 仅在包含保存步骤且保存成功时附带 success；纯 `NEW` 不发 success。
- empire-import 中 `SAVE_AND_IMPORT` 的保存步骤成功时，也只发 1 条 success toast。

边界：
- Toolbar 全量 + `ImportPlanModal(mode=import)` 的 empire 模式。
- station 模式、game-blueprint、x4-station 维持现状。

## Execution Flow
1. Toolbar 触发 action（`NEW/SAVE/SAVE_AS` 或 SmartSave 子动作）。
2. controller 识别 storeType，并先执行 `isEmptyForSave()`。
- `SAVE/SAVE_AS` 空：拒绝 + warning。
- `NEW` 空：直接 `NEW`（无 SmartSave）。
2.1 若 `SAVE` 且 `requiresSaveAsOnSave() === true`：直接打开 `SAVE_AS` 弹窗。
2.2 `SAVE_AS` 弹窗输入初值使用 `displayTitle`（`name || defaultName`）。
3. `NEW` 非空：再看 `isDirty()`。
- dirty：打开 SmartSave。
- non-dirty：直接 `NEW`。
4. SmartSave 回传具体子动作后，controller 执行步骤序列。
5. controller 按实际执行结果统一发 toast（成功/拦截/错误）。
6. empire-import 经 controller.import 路径执行：`SAVE_AND_IMPORT` 或 `DISCARD_AND_IMPORT`，最终通过 `IMPORT_DATA` 完成落盘。

## 操作点清单

### A. 模组与按钮操作点（Toolbar）
- station（empire）
  - `NEW`：空方案直接新建；非空且 dirty 进入 SmartSave；非空且 non-dirty 直接新建
  - `SAVE`：空方案拦截 warning；未保存对象转 `SAVE_AS`；已保存且 dirty 执行保存
  - `SAVE_AS`：空方案拦截 warning；非空打开输入并保存
- logicFlow
  - `NEW`：与 station 同语义
  - `SAVE`：与 station 同语义
  - `SAVE_AS`：与 station 同语义
- ship-build
  - `NEW`：与 station 同语义（落到 ship-build 的 clear/new 语义）
  - `SAVE`：与 station 同语义（落到 ship-build 的 save 语义）
  - `SAVE_AS`：与 station 同语义（落到 ship-build 的 saveAs 语义）

### A.1 分支状态维度（必须进入测试矩阵）
- dirty / non-dirty
- 新建未保存对象（new）/ 非新建已存在对象（non-new）
- 空方案（empty）/ 非空方案（non-empty）

要求：
- 每个模组的每个按钮（`NEW/SAVE/SAVE_AS`）都要覆盖上述关键分支组合。
- 用例断言必须是可观察行为（弹窗、按钮可见性、流程完成状态、消息触发次数）。

### B. 导入操作点（Import）
- empire 模式 direct import：
  - `SAVE_AND_IMPORT = SAVE -> RESET -> IMPORT_DATA`
  - `DISCARD_AND_IMPORT = RESET -> IMPORT_DATA`
- 非 station import handler（`logicFlow` / `ship-build`）：
  - 固定返回 unsupported，并走统一 warning 出口

### C. 统一横切操作点
- `isEmptyForSave`：三模组统一前置判定（影响 NEW/SAVE/SAVE_AS）
- `requiresSaveAsOnSave`：三模组未保存对象触发 SAVE 时进入 SAVE_AS 意图
- `getDefaultName`：三模组默认名策略统一入口
- message strategy：保存成功 success 仅一次；拦截 warning 统一出口；纯 NEW 不发 success

## 测试计划（按操作点映射）

### 1) 单元测试主覆盖（完整矩阵）
- 覆盖 `station / logicFlow / ship-build` 三模组的 `NEW/SAVE/SAVE_AS` 全组合。
- 覆盖三模组的未保存对象 `SAVE -> SAVE_AS` 分流。
- 覆盖 SmartSave 三类组合动作：
  - `OVERWRITE_AND_NEW = SAVE -> NEW`
  - `SAVE_AS_AND_NEW = SAVE_AS(name) -> NEW`
  - `DISCARD_AND_NEW = NEW`
- 覆盖 message strategy（success/warning）与 defaultName 口径。
- 覆盖 import 编排序列和 unsupported handler 分支。

### 2) E2E 集成覆盖（关键流程）
- Toolbar 分支矩阵：`3 模组 x 3 按钮 x 4 状态(dirty/new)` = 36 个 case。
- empire 入口导入流程：
  - 打开导入弹窗 -> 进入导入确认 -> 保存并导入完成
  - 打开导入弹窗 -> 进入导入确认 -> 放弃并导入完成
  - 打开与关闭可交互性、保存/放弃后的动作按钮消失断言
- 合计 Chapter 3 目标规模：36（Toolbar）+ 导入矩阵 case（>=6）。
- 断言统一采用可观察 UI 信号：
  - modal/dialog 可见性
  - action 按钮可操作性
  - 流程结束后的弹窗关闭状态

### 3) 章节落地规则
- `test_tasks.md` 第 1 章承载“模组 x 按钮 x 导入”完整单元矩阵。
- `test_tasks.md` 第 2/3 章承载关键 E2E 状态与流程回归。
- 第 4 章保留章节结构；如无已登记缺陷可为空。

## Risks
1. 若保留旧分支消息触发，会出现重复 toast。
2. 若 `isEmptyForSave()` 仍在 UI 层判断，语义会再次分散。
3. 若 controller 不接管成功提示，三模块仍会出现“有的保存提示、有的没有”。

## Validation Plan
1. controller 行为验证：动作分发与前置判定路径。
2. 三模块 `isEmptyForSave()` 特例验证。
3. Toolbar 消息矩阵验证：
- `SAVE/SAVE_AS` 成功 -> 1 条 success
- 被拦截 -> warning
- 纯 `NEW` -> 不发 success
