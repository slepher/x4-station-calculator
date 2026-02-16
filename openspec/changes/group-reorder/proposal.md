## Why

当前规划区的产线组顺序是固定的，用户无法调整。当用户需要重新组织产线布局时，只能删除后重新创建。这导致用户需要重新配置每个产线组的产物和设置，效率低下。

## What Changes

- 新增产线组上下移动排序功能，用户可以通过上下箭头按钮重新排列产线组顺序
- 第一个产线组隐藏上箭头，最后一个产线组隐藏下箭头
- 单个产线组时隐藏所有箭头

## Capabilities

### New Capabilities
- `group-reorder`: 产线组上下移动排序功能，支持通过上下箭头按钮重新排列规划区中的产线组顺序

### Modified Capabilities
无（不修改现有规格）

## Impact

- **Store**: `useLogicFlowStore.ts` 需要新增 `moveGroupUp` 和 `moveGroupDown` 函数
- **Components**: `ProductionLineGroup.vue` 需要将拖拽手柄替换为上下箭头按钮
