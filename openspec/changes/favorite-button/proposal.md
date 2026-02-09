## Why

当前仓储规划系统对所有产物采用统一的缓冲时间计算，无法区分主产物和副产物的不同销售策略需求。用户需要一种直观的方式标记产物优先级，让主产物获得更长的销售缓冲时间（如12小时），而副产物获得较短的缓冲时间（如2小时），从而优化仓储空间分配。

## What Changes

- **新增 FavoriteButton 组件**：一个三态星形按钮，允许用户标记产物的优先级级别（Level 0: 无需求/空心，Level 1: 副产物/半空心，Level 2: 主产物/实心）
- **扩展 StationSettings 接口**：新增 `primaryProductBufferHours`（默认12.0）和 `secondaryProductBufferHours`（默认2.0）两个配置项
- **新增优先级覆盖状态**：在 Store 中添加 `warePriorityOverrides` 记录用户的手动优先级设置
- **修改仓储计算逻辑**：根据产物优先级动态应用不同的缓冲时间计算
- **更新设置面板**：在 StationSettings.vue 中添加两个滑块控件用于调整缓冲时间

## Capabilities

### New Capabilities
- `ware-priority`: 产物优先级管理系统，包括优先级状态存储、判定逻辑和UI交互
- `dual-buffer-calculation`: 双轨仓储缓冲计算，根据产物优先级应用不同的缓冲时间

### Modified Capabilities
- `ware-flow-display`: 在产物流显示组件中集成优先级按钮和状态展示

## Impact

- **Store 层**: `useStationStore.ts` 新增状态和计算属性
- **组件层**: `StationWareFlow.vue`, `StationWareFlowGroup.vue`, `StationSettings.vue` 需要更新
- **类型定义**: `StationSettings` 接口扩展
- **算法层**: `analyzeWareFlow` 函数中的缓冲计算逻辑调整
