## 1. 类型定义

- [x] 1.1 在 `src/types/x4.ts` 的 `StationSettings` 接口中添加 `showEmpireGaps?: boolean` 字段（可选，默认为 false）

## 2. Store 更新

- [x] 2.1 在 `useStationStore.ts` 的默认设置中添加 `showEmpireGaps: false`
- [x] 2.2 在数据加载逻辑中处理 `showEmpireGaps` 为 `null` 或 `undefined` 的情况，设为 `false`

## 3. ContextToolbar 开关

- [x] 3.1 在 `ContextToolbar.vue` 的技术与运营组添加"显示缺口"开关
- [x] 3.2 开关绑定到 `stationStore.settings.showEmpireGaps`
- [x] 3.3 添加 i18n 翻译键 `ui.show_empire_gaps`

## 4. 扩展现有组件

- [x] 4.1 在 `EmpireWareFlow.vue` 中添加 `showAddButton` prop 和 `add` emit
- [x] 4.2 在 `EmpireWareFlow.vue` 中添加 + 按钮渲染逻辑
- [x] 4.3 在 `EmpireWareFlowGroup.vue` 中添加 `showAddButton` prop 和 `add` emit 透传
- [x] 4.4 添加 i18n 翻译键（帝国运营缺口、帝国补给缺口）

## 5. StationWareFlowsDashboard 集成

- [x] 5.1 在 `StationWareFlowsDashboard.vue` 中引入 `useEmpireStore`
- [x] 5.2 添加 `empireGaps` computed 属性：帝国运营沿用既有过滤规则；帝国补给过滤为 `netRate < 0` 或 `netRate > 0` 且在当前站 `plannedModules` 中存在对应模块
- [x] 5.3 在 `list-body` 顶部添加缺口分组渲染逻辑（使用 `EmpireWareFlowGroup`）
- [x] 5.4 实现 `handleAddModule` 函数，点击 + 按钮添加默认产线模块
- [x] 5.5 确保分组仅在资源视图显示，经济视图不显示
- [x] 5.6 帝国运营分组使用 `empireGroups.operations`，并应用过滤规则（`netRate < 0` 或 `priority > 0`）
- [x] 5.7 priority 使用空间站“修正后的优先级”结果（非原始覆盖值）
- [x] 5.8 帝国运营分组顺序直接使用 `empireStore` 数据，不在页面层额外排序
- [x] 5.9 帝国补给分组对 `netRate > 0` 的项仅在当前站 `plannedModules` 中存在对应模块时显示

## 6. 测试

- [x] 6.1 编写开关功能单元测试
- [x] 6.2 编写缺口数据过滤逻辑单元测试
- [x] 6.3 编写 + 按钮添加模块 E2E 测试
- [x] 6.4 编写分组显示顺序 E2E 测试（帝国运营→帝国补给→产品→运营→补给→资源）
- [x] 6.5 编写帝国运营优先级过滤 E2E 测试（priority > 0 时显示）
- [x] 6.6 编写帝国补给正净值显示条件 E2E 测试（`netRate > 0` 且在 `plannedModules` 中时才显示）
- [x] 6.7 编写帝国运营顺序继承 E2E 测试（验证页面不做额外排序）
