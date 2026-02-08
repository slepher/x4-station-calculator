## Why

当前module-list中的模块标记颜色单一（统一为蓝色），且自动生成的module-list缺少明确的排序逻辑，导致用户体验不佳。需要改进颜色标记系统以更好地区分不同类型的模块，并实现合理的排序逻辑以提升用户查找效率。

## What Changes

- 更改module-list和搜索过滤结果中module的标记颜色，不再统一使用蓝色
- 实现自动生成的module-list的排序逻辑，使模块按某种有意义的顺序排列
- 更新相关的UI组件以支持新的颜色标记和排序功能
- 添加模块层级（Tier）计算功能，用于更智能的排序和自动填充算法

## Capabilities

### New Capabilities
- `module-color-coding`: 实现模块的颜色编码系统，根据不同类型或属性为模块分配不同的颜色标记
- `module-sorting-logic`: 实现模块列表的自动排序逻辑，定义模块在列表中的排列顺序

### Modified Capabilities
- `module-list-ui`: 现有模块列表UI的显示逻辑将被修改以支持新颜色标记和排序

## Impact

- UI组件需要更新以支持新的颜色标记系统
- 模块数据结构需要扩展以支持颜色分类和层级(Tier)信息
- 排序算法需要集成到现有的module-list生成逻辑中
- 自动填充算法需要按Tier优先级处理模块
- 现有的搜索过滤功能需要适配新的排序机制