# Task List: StationDashboard UI Refactor

- [x] **Task 1: 创建 StationModuleDetail 子组件**
  - [x] 实现 `StationModuleDetail.vue`: 整合 `CollapsibleDetailList` 和物料行渲染逻辑。
  - [x] 确保物料行视觉风格对齐 `StationWareFlow` 但移除操作轨。

- [x] **Task 2: 开发主仪表盘组件**
  - [x] 创建 `StationDashboard.vue`。
  - [x] 实现视图模式切换器（Materials/Time/Workers 按钮组）。
  - [x] 编写数据转换逻辑，将 `store.constructionBreakdown` 转换为总计分组和模块分组所需的格式。
  - [x] 集成 `PriceSlider` 到仪表盘底部。

- [x] **Task 3: 组件集成与替换**
  - [x] 在 `StationPlanner.vue` 中引入 `StationDashboard`。
  - [x] 替换原有的 `StationConstruction` 引用。
  - [x] 验证数据传递（`buildPriceMultiplier`）是否工作正常。

- [x] **Task 4: 逻辑重构与数据对齐**
  - [x] 创建 `analyzeStation.ts` 独立文件。
  - [x] 将 `calculateConstructionBreakdown` 等通用逻辑移动到 `calculatorUtils.ts`。
  - [x] 在 `analyzeStation.ts` 中实现 `analyzeStation`。
  - [x] 确保模块按 `allIndustryModules` 顺序合并。
  - [x] 确保材料按 `tier` 降序、`name` 升序排序。
  - [x] 在 `useStationStore.ts` 中增加基于 `analyzeStation` 的 `stationAnalysis` 计算属性。
  - [x] 更新 `StationDashboard.vue` 使用新的 `stationAnalysis`。

- [x] **Task 5: UI 细节修复与优化**
  - [x] 修复 UI bug: 移除材料列表前的无意义 dot (仅限于 StationModuleDetail)。
  - [x] 撤销对 ResourceItem.vue 的误操作。
  - [x] 在 `zh-CN.json` 和 `en.json` 中添加缺失的 `ui` 键值。
  - [x] 移除 `StationDashboard` 和 `StationModuleDetail` 中可能的硬编码文案。

- [x] **Task 6: 验证与微调**
  - [x] 验证模块合并功能（添加两个相同的模块，应显示为一个分组且数量叠加）。
  - [x] 验证材料排序（高级材料应在低级材料之后，或按特定 tier 顺序）。
  - [x] 运行自动化测试与构建验证 (`npm run build`)。

- [x] **Task 7: UI 视觉风格对齐与精细化**
  - [x] 更新 `StationModuleDetail.vue` 以支持 `variant` 属性和结构化标题渲染。
  - [x] 应用 `WareFlow` 系列组件的字体大小、粗细和颜色规范。
  - [x] 实现标题栏 `x` 符号的视觉弱化样式。
  - [x] 更新 `StationDashboard.vue` 适配新的组件接口。
  - [x] 验证所有支出类价格是否统一为红色 (`red-400`)。
  - [x] 运行自动化测试与构建验证 (`npm run build`)。
