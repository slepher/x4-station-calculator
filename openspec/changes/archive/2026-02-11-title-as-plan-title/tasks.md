# Tasks: Title Implementation

- [x] **1. Store 层改造 (`useStationStore.ts`)**
  - [x] 添加 `currentPlanName` 状态。
  - [x] 更新 `applyPlan`：同步设置 `currentPlanName`。
  - [x] 更新 `clearAll`：重置 `currentPlanName` 为 `""`。
  - [x] 更新 `saveCurrentPlan`：支持可选参数 `name`，并更新 `currentPlanName`。

- [x] **2. UI 组件改造 (`StationToolbar.vue`)**
  - [x] 移除旧的 `pageTitle` 计算属性，改为基于 `store.currentPlanName` 的 `displayTitle`。
  - [x] 实现标题编辑模式（Input + Toggle Icon）。
  - [x] 实现空值回退逻辑（Focus 记录 -> Blur 检查 -> 回退）。
  - [x] 实现保存拦截（空方案检查 + 默认标题透传）。
  - [x] 样式调整：移除 `.toolbar-title` 的 `uppercase`。

- [x] **3. 对话框改造 (`SmartSaveDialog.vue`)**
  - [x] 新增 `initialName` prop。
  - [x] 在 `watch(isOpen)` 中优先使用 `initialName` 初始化输入框。

- [x] **4. 验证与测试**
  - [x] 验证新建/载入时的标题状态。
  - [x] 验证编辑时的回退逻辑。
  - [x] 验证保存流程的拦截与命名正确性。
