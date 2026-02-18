## Why

当前空间站的缺口分类中，工人建筑消耗的物资（如食物配给、医疗用品等）与工业生产消耗的 container 类物资被统一归类到"运营"分组中，无法区分。用户需要将这两类消耗分开显示，以便更清晰地了解空间站的补给需求和运营成本。

## What Changes

- 在 `WareFlow` 接口中新增 `workforceConsumption` 字段，单独记录工人消耗量
- 在 `GroupedFlows.rateGroups` 中新增 `supply` 分组，用于显示工人补给缺口
- 修改分组逻辑：有工人消耗且净产出为负的物资归入"补给"分组
- 更新 UI 显示，在数量视图和经济视图中新增"补给"分组
- 分组顺序调整为：产品 → 运营 → 补给 → 资源

## Capabilities

### New Capabilities

无

### Modified Capabilities

- `resource-dashboard`: 修改分组逻辑，将原来的三组（产品、运营、资源）扩展为四组（产品、运营、补给、资源），新增补给分组用于显示工人消耗导致的缺口

## Impact

- **类型定义**: `src/types/x4.ts` - `WareFlow` 接口新增 `workforceConsumption` 字段，`GroupedFlows.rateGroups` 新增 `supply` 分组
- **计算逻辑**: `src/store/logic/analyzeWareFlow.ts` - 分离工人消耗和工业消耗，更新分组逻辑
- **UI 组件**: `src/components/StationWareFlowsDashboard.vue` - 新增"补给"分组的显示
- **国际化**: i18n 文件 - 新增"补给"相关的翻译键
