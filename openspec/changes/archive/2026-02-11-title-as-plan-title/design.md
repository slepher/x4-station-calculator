# Design: Title as Plan Title

## 1. 核心变更
将方案标题（Station Name）作为方案的唯一标识名称，贯穿编辑、保存、加载全流程。

## 2. Store 状态设计
在 `useStationStore` 中显式添加 `currentPlanName` 字段。

```typescript
// store/useStationStore.ts
state: () => ({
  // ... existing state
  currentPlanName: '', // 默认为空，表示未命名/新建
})
```

### 状态流转
- **New Plan**: `currentPlanName = ''` (UI 显示默认值 "Station Planner")
- **Load Plan**: `currentPlanName = savedPlan.name`
- **Edit Title**: 直接修改 `currentPlanName`
- **Save**:
  - 如果 `currentPlanName` 非空，作为默认文件名。
  - 保存成功后，更新 `savedPlans` 列表。
- **Clear All**: 重置 `currentPlanName = ''`

## 3. UI 交互设计 (`StationToolbar.vue`)

### 显示逻辑
- **非编辑态**: 显示 `store.currentPlanName || t('default_title')`。
- **编辑态**: Input 框，初始值为当前显示值。

### 编辑逻辑
- **Click**: 进入编辑模式，自动聚焦全选。
- **Enter / Blur**: 提交更改。
  - 如果输入为空 -> 回退到上一个有效值（或空）。
  - 如果输入有效 -> 更新 `store.currentPlanName`。
  - 同步更新 `document.title`。

### 保存拦截
- 点击 Save/Save As 时：
  - 检查 `plannedModules` 是否为空。
  - 如果为空 -> 阻止保存，弹出 StatusMonitor 警告。
  - 如果非空 -> 打开保存对话框。

## 4. 对话框逻辑 (`SmartSaveDialog.vue`)
- 新增 Prop: `initialName`。
- 打开时：如果 `initialName` 有值，预填到输入框；否则留空或默认逻辑。

## 5. 浏览器标题同步
- 使用 `watch(() => store.currentPlanName)` 同步更新 `document.title`。
