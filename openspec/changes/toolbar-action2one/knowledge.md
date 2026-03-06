# Knowledge: toolbar-action2one

## 文档目的

本文件同步 `toolbar-action2one` 的测试定位器、状态定义、fixture 数据口径与断言标准，供 `test_tasks.md` 直接引用。

## 组件与流程边界

- Toolbar 编排入口：`src/composables/useToolbarWorkflowController.ts`
- Toolbar 触发组件：`src/components/StationToolbar.vue`
- 导入弹窗编排入口：`src/components/ImportPlanModal.vue`
- 导入计划列表：`src/components/LogicFlowImportBody.vue`
- 导入确认弹窗：`src/components/SmartSaveDialog.vue`（`mode='import'`）

## 操作点覆盖矩阵口径

- 模组维度：`station` / `logicFlow` / `ship-build`
- 按钮维度：`NEW` / `SAVE` / `SAVE_AS`
- 状态维度：`dirty` / `non-dirty`、`new` / `non-new`、`empty` / `non-empty`
- 导入维度：`SAVE_AND_IMPORT` / `DISCARD_AND_IMPORT` + unsupported handler

约束：
- 每个模组的三个按钮都要覆盖上述状态维度中的关键分支。
- 断言统一落到可观察信号：弹窗可见性、按钮可操作性、流程结束可见性、消息次数。

## 稳定定位器（data-testid）

### 导入入口与主弹窗
- 帝国导入入口：`logicflow-import-entry-empire`
- Toolbar 导入按钮：`toolbar-import-btn`
- 导入主弹窗：`import-view-modal`
- 导入弹窗关闭按钮：`import-view-close`
- 计划卡列表：`logicflow-import-plan-list`
- 计划卡：`logicflow-import-plan-item-<planId>`
- 计划直接导入按钮：`logicflow-import-plan-direct-<planId>`

### 导入确认（SmartSaveDialog）
- 输入框：`.dialog-input`
- 主按钮（保存并导入）：按钮文本 `保存并导入|Save & Import`
- 次按钮（放弃并导入）：按钮文本 `放弃并导入|Discard & Import`

### Toolbar 三按钮（无 data-testid）
- 统一定位域：`.toolbar-panel`
- 按钮定位：在 `.toolbar-panel` 中使用按钮文本定位 `New|新建`、`Save|保存`、`Save As|另存为`

### ship-build 固定前置口径（Chapter 3.25~3.36）
- fixture：`tests/fixtures/db.json`（去除 `vsn`）写入 localStorage。
- 初始化：`page.reload()`。
- 语言：通过 UI 语言选择器切到 `zh-CN`。
- 视图：切换到 ship-build 视图。
- 目标 ship：固定为 `武士刀`（避免 ship 选择漂移导致断言不稳定）。

说明：`SmartSaveDialog` 当前无 `data-testid`，E2E 统一使用 `.dialog-input` + 按钮文本双条件定位。

### 常规 SmartSave（非 import）按钮定位
- 保存按钮：`button:has-text(/Save|保存/)`
- 放弃并新建按钮：`button:has-text(/Discard & New|丢弃并新建/)`
- 覆盖并新建按钮：`button:has-text(/Overwrite & New|覆盖并新建/)`
- 另存为按钮：`button:has-text(/Save As|另存为/)`

## Fixture 与计划 ID 映射

- 基础 fixture：`tests/fixtures/db.json`（写入 localStorage 时移除 `vsn`）
- Empire 总览入口前置：`x4_empire_data.activeStationId = null`
- 计划卡 ID：`logic-flow-1`（来自 `db.json` 的 `x4_logic_flow_plans.list[0].id`）
- 计划卡显示名：`Logic Flow 1`（来自 `db.json` 的 `x4_logic_flow_plans.list[0].name`）

## Chapter 2 状态/切换定义（与 test_tasks.md 同步）

- `状态: import-view-modal-open-on-empire`
  - 含义：从帝国入口打开导入主弹窗，计划列表区域已渲染。

- `状态: empire-import-smartsave-open`
  - 含义：dirty 前置下点击计划直接导入后，导入确认 SmartSaveDialog 已打开。

- `切换: empire-import-smartsave-open -> empire-import-finished-after-save`
  - 含义：在导入确认弹窗点击 `保存并导入` 后流程完成并关闭导入主弹窗。

- `切换: empire-import-smartsave-open -> empire-import-finished-after-discard`
  - 含义：在导入确认弹窗点击 `放弃并导入` 后流程完成并关闭导入主弹窗。

## 断言口径

### 弹窗可见性
- 打开：`import-view-modal` 可见。
- 关闭：`import-view-modal` 不可见，且页面中无导入确认按钮文本。

### 导入确认弹窗可操作性
- `.dialog-input` 可见。
- `保存并导入` 与 `放弃并导入` 两个动作按钮均可点击。

### 稳定性
- 点击计划导入按钮后页面保持响应，不允许出现主弹窗与页面根节点同时不可见的中断状态。

### 消息断言定位口径（Toolbar 保存相关）
- Toast 容器：`div.fixed.bottom-6.right-6`
- 保存消息匹配：`getByText(/save|保存/i)`
- 计数规则：
  - 触发保存成功：匹配计数 `+1`
  - 不触发保存：匹配计数 `unchanged`

## Unit 语义断言口径

- `runAction(SAVE)`：
  - 空方案：返回 `blocked` 且 warning 一次。
  - 未保存对象：返回 `open-smart-save(intent=SAVE_AS)`。
- `runSmartSaveSteps([SAVE, NEW])`：顺序固定 `SAVE -> NEW`，success 一次。
- `runImportAction(station, SAVE_AND_IMPORT)`：顺序固定 `SAVE -> NEW -> IMPORT_DATA`。
