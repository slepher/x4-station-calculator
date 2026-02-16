## 1. Store 层实现

- [x] 1.1 在 `useLogicFlowStore.ts` 中添加 `moveGroupUp(groupId: string)` 函数
- [x] 1.2 在 `useLogicFlowStore.ts` 中添加 `moveGroupDown(groupId: string)` 函数
- [x] 1.3 在 store 返回中导出 `moveGroupUp` 和 `moveGroupDown` 函数

## 2. UI 组件实现

- [x] 2.1 在 `ProductionLineGroup.vue` 中移除原拖拽手柄元素
- [x] 2.2 添加上箭头按钮，绑定 `moveGroupUp` 点击事件
- [x] 2.3 添加下箭头按钮，绑定 `moveGroupDown` 点击事件
- [x] 2.4 实现边界条件：第一个产线组隐藏上箭头
- [x] 2.5 实现边界条件：最后一个产线组隐藏下箭头

## 3. 样式优化

- [x] 3.1 箭头按钮悬停高亮样式
- [x] 3.2 确保按钮布局顺序正确：[锁定开关] [删除] [上箭头] [下箭头]
