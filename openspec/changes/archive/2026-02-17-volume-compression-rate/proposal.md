## Why

在 X4 游戏中，空间站的仓储空间是有限资源。用户在规划产线时需要一个直观的指标来判断模块的体积效率——有些模块会将大量原材料压缩成少量高价值产品（体积压缩），而有些模块则可能产生体积膨胀。当前系统缺少这个关键指标，用户无法快速评估产线的仓储效率。

## What Changes

- **新增**：模块体积压缩率计算功能
- **新增**：FlowNode 组件底部显示压缩率指标
- **新增**：`useGameDataStore` 中预计算模块压缩率数据

## Capabilities

### New Capabilities

- `volume-compression`: 为每个模块节点计算并显示体积压缩率，帮助用户评估产线的仓储效率

### Modified Capabilities

无

## Impact

- **Store**: `useGameDataStore.ts` 新增 `volumeCompressionMap` 和 `buildVolumeCompressionMap()` 函数
- **Component**: `FlowNode.vue` 底部 Subtitle 区域新增压缩率显示
- **数据**: 压缩率在游戏数据初始化时预计算，不影响运行时性能
