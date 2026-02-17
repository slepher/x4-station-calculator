## 1. 数据结构准备

- [x] 1.1 在 `src/types/x4.ts` 中添加 `SavedFlowNode` 类型定义
- [x] 1.2 在 `src/types/x4.ts` 中添加 `SavedFlowGroup` 类型定义
- [x] 1.3 在 `src/types/x4.ts` 中添加 `LogicFlowSettings` 类型定义（方案级设置）
- [x] 1.4 在 `src/types/x4.ts` 中添加 `LogicFlowPlan` 类型定义（包含 settings 字段）
- [x] 1.5 在 `src/types/x4.ts` 中添加 `SavedFlowPlansState` 类型定义

## 2. Store 扩展

- [x] 2.1 在 `useLogicFlowStore.ts` 中添加 `currentPlanName` 状态
- [x] 2.2 在 `useLogicFlowStore.ts` 中添加 `savedPlans` 状态
- [x] 2.3 在 `useLogicFlowStore.ts` 中添加 `lastSavedSnapshot` 状态
- [x] 2.4 在 `useLogicFlowStore.ts` 中添加 `settings` 状态
- [x] 2.5 在 `useLogicFlowStore.ts` 中添加 `isDirty` 计算属性
- [x] 2.6 在 `useLogicFlowStore.ts` 中实现 `saveCurrentPlan()` 方法
- [x] 2.7 在 `useLogicFlowStore.ts` 中实现 `loadPlan()` 方法
- [x] 2.8 在 `useLogicFlowStore.ts` 中实现 `applyPlan()` 方法（含 auto 节点重建逻辑）
- [x] 2.9 在 `useLogicFlowStore.ts` 中实现 `deletePlan()` 方法
- [x] 2.10 在 `useLogicFlowStore.ts` 中实现 `clearAll()` 方法
- [x] 2.11 在 `useLogicFlowStore.ts` 中添加 localStorage 持久化逻辑
- [x] 2.12 在 `useLogicFlowStore.ts` 中添加初始化加载逻辑

## 3. SmartSaveDialog 组件扩展

- [x] 3.1 在 `SmartSaveDialog.vue` 中添加 `storeType` prop
- [x] 3.2 在 `SmartSaveDialog.vue` 中根据 `storeType` 动态获取对应的 Store
- [x] 3.3 在 `SmartSaveDialog.vue` 中根据 `storeType` 动态显示默认名称

## 4. LoadFlowPlanModal 组件创建

- [x] 4.1 创建 `LoadFlowPlanModal.vue` 组件文件
- [x] 4.2 实现方案列表展示（显示产线组信息）
- [x] 4.3 实现加载方案功能
- [x] 4.4 实现删除方案功能（含确认对话框）
- [x] 4.5 实现脏检查确认逻辑

## 5. StationToolbar 主题切换

- [x] 5.1 在 `StationToolbar.vue` 中添加 `themeColors` 计算属性
- [x] 5.2 在 `StationToolbar.vue` 中将标题颜色改为动态绑定
- [x] 5.3 在 `StationToolbar.vue` 中将按钮颜色改为动态绑定
- [x] 5.4 在 `StationToolbar.vue` 中添加 `btn-fuchsia` 和 `btn-purple` 样式类

## 6. StationToolbar 功能切换

- [x] 6.1 在 `StationToolbar.vue` 中修改 `displayTitle` 计算属性（根据视图返回对应标题）
- [x] 6.2 在 `StationToolbar.vue` 中修改 `handleNew` 方法（根据视图调用对应 Store）
- [x] 6.3 在 `StationToolbar.vue` 中修改 `handleSave` 方法（根据视图调用对应 Store）
- [x] 6.4 在 `StationToolbar.vue` 中修改 `handleSaveAs` 方法（根据视图调用对应 Store）
- [x] 6.5 在 `StationToolbar.vue` 中修改 `handleLoad` 方法（根据视图显示对应对话框）
- [x] 6.6 在 `StationToolbar.vue` 中修改标题编辑逻辑（根据视图更新对应 Store）
- [x] 6.7 在 `StationToolbar.vue` 中修改 SmartSaveDialog 的 `storeType` prop 绑定

## 7. i18n 翻译

- [x] 7.1 添加 `menu.default_flow_name` 翻译键
- [x] 7.2 添加 `menu.dialog_title_save_flow_as` 翻译键（如需要）
- [x] 7.3 添加逻辑组网方案加载对话框相关翻译键

## 8. 样式扩展

- [x] 8.1 在 `StationToolbar.vue` 中添加 `btn-fuchsia` 样式类
- [x] 8.2 在 `StationToolbar.vue` 中添加 `btn-purple` 样式类
