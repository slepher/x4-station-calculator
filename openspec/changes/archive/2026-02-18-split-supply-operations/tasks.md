## 1. 类型定义修改

- [x] 1.1 在 `src/types/x4.ts` 的 `WareFlow` 接口中新增 `workforceConsumption: number` 字段
- [x] 1.2 在 `src/types/x4.ts` 的 `GroupedFlows.rateGroups` 中新增 `supply: WareFlow[]` 分组

## 2. 计算逻辑修改

- [x] 2.1 修改 `src/store/logic/analyzeWareFlow.ts`，在 `getOrInitFlow` 函数中初始化 `workforceConsumption: 0`
- [x] 2.2 修改工人消耗计算部分，将工人消耗单独记录到 `workforceConsumption` 字段
- [x] 2.3 修改分组逻辑，新增 `supply` 分组的判断条件

## 3. UI 组件修改

- [x] 3.1 修改 `src/components/StationWareFlowsDashboard.vue`，在 `rateGroups` computed 中新增 `supply` 分组
- [x] 3.2 调整分组顺序为：产品 → 运营 → 补给 → 资源

## 4. 国际化

- [x] 4.1 在 i18n 文件中新增"补给"相关翻译键（数量视图：补给，经济视图：补给支出）
