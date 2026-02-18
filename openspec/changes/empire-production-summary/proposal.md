## Why

帝国总览界面需要一个汇总视图，展示所有空间站的产出和消耗情况。当前帝国总览只显示 "Coming Soon"，用户无法在帝国层面了解整体生产状况。此功能将帮助玩家快速识别帝国的产品盈余、运营缺口和补给需求。

## What Changes

- 在 EmpireStore 中添加 `stationFlowCache` 缓存机制，存储每个空间站的 `GroupedFlows` 分析结果
- 在 EmpireStore 初始化时为所有空间站执行 `analyzeWareFlow` 并缓存结果
- 当空间站模块更新时，自动更新对应的缓存
- 创建 `analyzeEmpireWareFlow` 聚合函数，从缓存中汇总帝国级数据
- 创建 `EmpireWareFlowsDashboard` 组件，复制 `StationWareFlowsDashboard` 的两级子模块结构
- 帝国视图只包含两个视图：数量视图和经济视图（无体积视图）
- 帝国视图按三组显示：产品组、运营组、补给组

## Capabilities

### New Capabilities
- `empire-production-summary`: 帝国级生产汇总视图，聚合所有空间站的产出和消耗数据，按产品/运营/补给分组显示

### Modified Capabilities
- `empire-management`: 扩展 EmpireStore 以支持空间站级别的流量缓存和帝国级聚合

## Impact

- **Store**: `useEmpireStore.ts` - 添加缓存机制和聚合逻辑
- **Logic**: 新增 `analyzeEmpireWareFlow.ts` - 帝国级数据聚合函数
- **Components**: 新增 `EmpireWareFlowsDashboard.vue`、`EmpireWareFlowGroup.vue`、`EmpireWareFlow.vue`
- **Types**: 扩展 `EmpireWareFlow` 和 `EmpireGroupedFlows` 接口
- **UI**: `StationWorkbench.vue` - 替换帝国总览的 "Coming Soon" 占位符
