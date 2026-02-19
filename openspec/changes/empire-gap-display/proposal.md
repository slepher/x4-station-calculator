## Why

用户在规划空间站时，需要了解帝国整体的资源缺口情况，以便决定在当前空间站生产哪些资源来填补缺口。目前需要切换到帝国总览才能看到缺口信息，操作不便。

## What Changes

- 在 ContextToolbar 的"技术与运营组"添加"显示缺口"开关
- 开启后，在空间站视图顶部显示帝国运营缺口和补给缺口
- 每个缺口项提供 + 按钮，点击直接添加默认产线模块
- 缺口分组仅在资源视图和经济视图显示，体积视图不显示

## Capabilities

### New Capabilities

- `empire-gap-display`: 空间站视图显示帝国缺口功能，包括开关控制、缺口分组展示、快速添加模块

### Modified Capabilities

- `context-toolbar`: 添加"显示缺口"开关到技术与运营组
- `station-dashboard`: 支持在顶部显示帝国缺口分组

## Impact

- **ContextToolbar.vue**: 添加新开关组件
- **StationWareFlowsDashboard.vue**: 添加缺口分组显示逻辑
- **useStationStore.ts**: 添加 `showEmpireGaps` 设置字段
- **useEmpireStore.ts**: 提供缺口数据给空间站视图使用
