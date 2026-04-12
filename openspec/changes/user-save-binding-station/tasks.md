# user-save-binding-station Tasks

## Documentation

- [x] D1. 创建 `request.md` 描述量化生产界面交互需求
- [x] D2. 创建 `design.md` 描述 UI 和 store 适配设计
- [x] D3. 从 `stand-alone-binding` 提取相关设计内容

## Store 适配

- [x] T1. 重构 `useStationStore.updateModules()` 根据 `productionSource` 路由
- [x] T2. 重构 `useStationStore.updateSettings()` 根据 `productionSource` 路由
- [x] T3. 重构 `useStationStore.addModule()` / `removeModule()` 根据 `productionSource` 路由
- [x] T4. 在 `useEmpireStore.isDirty` 合并 binding dirty 状态
- [x] T5. 添加 `useEmpireStore.saveCurrentSource()` 方法根据 source 调用正确保存方法

## UI 适配 - StationPlanningPanel

- [x] T6. 添加"保存绑定"按钮，仅在 `productionSource === 'save-binding'` 时显示
- [x] T7. 显示 binding dirty 状态指示器
- [x] T8. 蓝图导入功能适配 binding 模式

## UI 适配 - StationTabBar

- [x] T9. 验证 binding 模式下星区显示为 binding groups
- [x] T10. 创建空间站按钮适配 binding 模式（创建虚拟空间站）
- [x] T11. 右键菜单适配 binding 操作（删除行为差异）

## UI 适配 - StationDashboard

- [x] T12. 验证 dirty 状态正确显示（合并 empire + binding）
- [x] T13. 保存按钮根据 source 调用正确方法

## UI 适配 - ProductionWorkbenchView

- [x] T14. 验证数据源切换按钮工作正常
- [x] T15. binding 模式禁用 empire 专属功能（星区链接等）

## 测试验证

- [x] T16. E2E 测试：进入 binding → 编辑空间站 → dirty 状态 → 保存绑定
- [x] T17. E2E 测试：编辑空间站 → 切换 empire → binding 保持 draft → 再次进入恢复
- [x] T18. E2E 测试：创建虚拟空间站 → 分配到 group → 保存
- [x] T19. 运行 `npm run build` 验证编译通过

## 后续修正 - Source-aware 数据源与职责分离

- [x] T20. 建立 production source 统一读取抽象：`stations` / `sectors` / `sectorLinks` 在 empire 与 save-binding 模式下分别从正确数据源读取
- [x] T21. 修正 binding 模式星区中转站聚合：`sectorInternalDataMap`、`stationMap`、`sectorLinkCalcMap` 不再固定读取 `activeEmpire`
- [x] T22. 将 empire station 管理动作下沉到 `useEmpireDataStore`，`useEmpireStore` 仅保留 source-aware facade
- [x] T23. 将 empire sector 管理动作下沉到 `useEmpireDataStore`，保留删除星区时的 station/link 清理语义
- [x] T24. 将 empire sector link 理动作下沉到 `useEmpireDataStore`，binding 模式下 `getLinkedSectors()` 改读 `connectedGroupIds`
- [x] T25. 补充回归测试：binding 中转站可聚合本星区 station flow，binding connected groups 参与 link solver
- [x] T26. 运行相关 unit/e2e/build 验证

## 后续修正 - 载入界面统一与数据源分发

- [x] T28. LoadPlanModal 添加 empire/binding tab 切换，binding 显示 bindingName
- [x] T29. ContextToolbar binding 模式下名称输入框使用 `activeBindingName` 双向绑定
- [x] T30. ProductionWorkbenchView 移除 productionSource 切换按钮，数据分发移到 empireStore
- [x] T31. `empireStore.empireGroupedFlows` 根据 `productionSource` 自动分发数据源
- [x] T32. `loadEmpire` 调用 `switchToEmpire` 正确切换 productionSource
- [x] T33. 添加 i18n 文本：bindingName、tab_empire、tab_binding 等

## 后续修正 - useStationStore 职责收缩与重构

- [x] T34. 编写 `refactory.md`，明确 `useStationStore` 的复杂度来源、边界问题与目标架构
- [x] T35. 建立统一站点命令层的基础设施文件：`stationCommands.ts`
- [ ] T36. 将 `useStationStore` 主写路径正式迁移到 `stationCommands`
- [x] T37. 抽出 `stationComputeService` 基础设施，统一部分 `compute deps`、persisted 同步与 `recompute()` 流程
- [x] T38. 让 `useEmpireStore.refreshStationFlowCache()` 开始复用统一计算服务
- [x] T39. 让 `productionSourceAdapter` 开始复用统一计算服务，减少重复的 `patch + recompute`
- [x] T40. 创建独立 plan library 模块：`useStationPlanLibrary.ts`
- [x] T41. 创建独立 importer service：`stationImporter.ts`
- [ ] T42. 将组件与主业务路径真正切换到命令层 / importer / plan library，移除旧路径并修复导入回归
- [ ] T43. 补充“主路径已接线”的回归测试，覆盖 empire/save-binding 两种 source 与导入行为
- [x] T44. 运行 `npm run build` 验证当前重构中间态可编译

## 后续修正 - useStationStore 重构第二阶段

- [x] T45. 编写 `refactory2.md`，记录当前重构中间态的评估结论、回归问题与二阶段任务
- [x] T46. 修复 `ImportPlanModal` 导入时 `lockedWares` / `warePriority` / `lastUpdated` 语义丢失问题
- [x] T47. 在 `useStationStore` 中接入 `stationCommands`，让其成为正式主写路径
- [x] T48. 将组件侧站点更新统一改走命令接口，禁止"直接改 station + refresh cache"
- [x] T49. 继续收紧 `stationComputeService` 边界，减少上层直接依赖 `stationStateMap`
- [x] T50. 统一 persisted -> state -> recompute 编排，消除重复流程
- [ ] T51. 接入 `useStationPlanLibrary`，移除 `useStationStore` 内部 `savedPlans` 持久化细节
- [x] T52. 接入 `stationImporter`，移除 `useStationStore.importPlan()` 中的内联解析细节
- [ ] T53. 补充主路径接线测试：`useStationStore -> stationCommands`、导入流程、empire/save-binding source 路由
- [ ] T54. 完成二阶段后重新核对 `tasks.md` 状态，只在真实主路径切换完成后标记完成

## 后续修正 - useEmpireStore 降复杂度专项

- [x] T55. 编写 `refactory3.md`，将重构目标重新对齐为"实质性降低 `useEmpireStore` 复杂度"
- [x] T56. 抽出 `empireSourceView` 或等价模块，统一 `activeStation` / `sectors` / `sectorLinks` / `orderedStationsBySector` / `production*` 读取
- [x] T57. 将 `getStationById`、binding 派生站点查找与 source-aware 读取逻辑迁入 `empireSourceView`
- [x] T58. 抽出 `empireFlowFacade` 或等价模块，迁移 `stationFlowCache`、`empireGroupedFlows`
- [x] T59. 继续迁移 `sectorInternalDataMap`、`sectorLinkCalcMap`、`getSupplyPlanningInput`、`getSectorInternalData`
- [x] T60. 迁移 `getSectorLinkCalc`、`getStationComponentGapFlows`、`getTransitHubViewModel` 到 flow facade
- [x] T61. 抽出 `empireMutationService` 基础设施文件
- [ ] T62. 接入 `empireMutationService`，统一 mutation 路由（类型适配待完成）
- [ ] T63. 补充专项回归测试，验证 empire / save-binding 两种 source 下读取、聚合语义不变
- [x] T67. 完成专项后复核 `useEmpireStore` 文件体积与职责边界，并更新文档状态

## 当前状态

**已完成**：D1-D3 文档任务完成；T1-T26 UI、store 适配、测试验证和 source-aware 职责分离完成

**已完成**：T28-T33 载入界面统一与数据源分发完成

**已完成（第一阶段）**：T35、T37-T41、T44 完成了基础设施抽取与部分接入

**已完成（第二阶段）**：
- T46: 修复导入回归，添加 `applyImportedStationPayload` 方法
- T47: useStationStore 接入 stationCommands
- T48: ImportPlanModal 使用 `applyImportedStationPayload`
- T49-T50: stationComputeService 收口 stationStateMap 访问，统一计算流程
- T52: importPlan 使用 `stationImporter.parseImportInput`

**已完成（降复杂度专项 Phase 1/2）**：
- T56-T57: 创建 `empireSourceView.ts` (202行)，统一 source-aware 读取逻辑，**已接入主路径**
- T58-T60: 创建 `empireFlowFacade.ts` (377行)，迁移 flow 聚合逻辑，**已接入主路径**
- T61: 创建 `empireMutationService.ts` (370行) 基础设施文件
- `useEmpireStore.ts` 从 **~1264 行 → 909 行**（减少 28%）
- 编译验证通过
- station-refactory 单元测试通过 (30 tests)
- 创建 `refactory-summary.md` 总结文档

**待后续完成**：
- T62: empireMutationService 接入主路径（类型适配）
- T63: 专项回归测试
- T51: useStationPlanLibrary 接入
- Phase 4: empireSessionService 抽取

**已完成（Refactory 4 Phase 1）**：
- T107: 创建 `production-context.ts` 定义共享 props/actions contract
- T108: 创建 `useBlueprintProductionStore.ts` 接管 blueprint 入口
- T109: 创建 `useLiveProductionStore.ts` 接管 live 入口
- T112: 创建 `BlueprintProductionWorkbenchView.vue` 直接接入 blueprint store
- T113: 创建 `LiveProductionWorkbenchView.vue` 直接接入 live store
- T115: 简化 `MainWorkbench.vue` 按 activeView 直接选择入口组件
- 编译验证通过

**待后续完成（Refactory 4 Phase 2）**：
- T110-T111: session 生命周期完全拆分
- T114: ProductionWorkbenchView 职责迁移（已大部分完成）
- T116-T123: 收缩旧兼容层、测试验证

**重构收益**：
- Source-aware 读取逻辑统一，减少重复分支判断
- Flow 聚合逻辑独立封装，便于测试和维护
- 清晰的职责边界：读取层、聚合层、mutation层
- 代码行数显著减少，可维护性提升

## Tabbar 折叠展开逻辑

- [x] T70. 在 StationTabBar 添加 `expandedSectorId` ref，跟踪当前展开的星区
- [x] T71. 计算 `expandedSectorId` 默认值：根据 activeStationId / activeTransitSectorId 所在星区
- [x] T72. 调整模板渲染逻辑：未展开星区仅显示中转站，展开星区显示中转站+站点（中转站在前）
- [x] T73. 点击中转站时：展开对应星区 + 调用 openSupply(sectorId)
- [x] T74. 点击站点时：自动展开其所在星区
- [x] T75. 监听 activeStationId / activeTransitSectorId 变化，自动更新 expandedSectorId
- [ ] T76. E2E 测试：验证折叠展开行为符合需求
- [x] T77. 运行 build 验证编译通过

## Production Tab 拆分

- [x] T80. 修改 `StationActiveView` type：移除 `save-import`，添加 `blueprint-production`、`live-production`
- [x] T81. 修改 `ActiveViewState` 结构：分离为 `activeEmpireId`、`activeEmpireStation`、`activeBinding`、`activeBindingStation`
- [x] T82. 实现旧格式迁移：`{ productionSource, activeId }` → 分离字段
- [x] T83. 添加兼容层 computed：`productionSource`、`activeId`、`activeStationId` 根据 `activeView` 推断
- [x] T84. 修改 `TopViewSwitch.vue`：替换 tabs 为"蓝图产能"/"实况产能"
- [x] T85. 修改 `MainWorkbench.vue`：切换 tab 时自动加载对应 empire/binding
- [x] T86. 更新 `useEmpireStore.fallbackToFirstEmpire()`：使用 `activeEmpireId`
- [x] T87. 更新 `useSaveBindingStore.initialize()`：使用 `activeBinding`
- [x] T88. 更新 locales：添加 `view.blueprint_production`、`view.live_production`
- [x] T89. 运行 build 验证编译通过
- [ ] T90. E2E 测试：验证切换 tab 加载正确数据源

## 后续修正 - UI 去耦优先专项（Refactory UI）

- [x] T91. 编写 `refactory-ui.md`，明确 production workbench 子树的 UI 去耦范围、组件层级、允许保留的 `useGameDataStore` 依赖与 Definition of Done
- [x] T94. 按组件边界拆分局部 UI model / composable，禁止创建单一 `productionUiViewModel.ts`；已创建 `useStationTabBarModel`、`useContextToolbarModel`、`useStationPlanningPanelModel`、`useStationWareFlowsModel`、`useStationDashboardModel`、`useTransitHubWorkbenchModel` 六类局部模型
- [x] T95. 重构 `StationTabBar`：移除对 `useEmpireStore` 的直接依赖，将 tab 分组、展开状态、active tab、相关动作改为 props + emits
- [x] T96. 重构 `ProductionWorkbenchView`：作为顶层切入口读取 store 并向下传递 props，处理子组件 emits
- [x] T98. 重构 `ContextToolbar`：移除 `useEmpireStore` / `useSaveBindingStore` / `useActiveViewStore` / `useStationStore` 依赖，改为 props + emits
- [x] T99. 重构 `StationModulePicker` + `StationPlanningPanel`：保留 `useGameDataStore` 读取静态模块/DLC 元数据，移除 `useStationStore`，改为 props + emits
- [x] T100. 重构 `StationWareFlowsDashboard`：移除 `useEmpireStore` / `useStationStore` 依赖，仅保留 `useX4I18n`，将 `groupedFlows/settings/empireGaps` 通过 props 注入
- [x] T101. 重构 `StationDashboard`：移除 `useStationStore` 依赖，仅保留 `useGameDataStore` + `useX4I18n`，将 `stationAnalysis/settings/currentEfficiency/actualWorkforce` 通过 props 注入
- [x] T105. 运行 `npm run build` 验证编译通过
- [ ] T102. 重构 `ImportPlanModal` 的 production workbench 接入方式：移除对 `useEmpireStore` 的直接依赖，将当前站点导入、新建站点导入等动作改为上层注入
- [ ] T103. 在 production workbench 子树中建立约束：除顶层容器外，不再新增 `useEmpireStore`；`useGameDataStore` 仅用于静态游戏数据与翻译
- [ ] T104. 补充 UI 去耦回归测试：验证 props 化后 overview / station / transit 三种布局渲染和主要交互不回归
- [ ] T93. 定义 production UI props / actions 类型文件（如 `production-ui.types.ts`），覆盖 `ProductionWorkbenchView`、`ContextToolbar`、`StationPlanningPanel`、`StationWareFlowsDashboard`、`StationDashboard`
- [ ] T94. 按组件边界拆分局部 UI model / composable，禁止创建单一 `productionUiViewModel.ts`；至少拆为 layout、tabbar、toolbar、planning、ware-flows、dashboard、transit-hub、import-modal 八类局部模型
- [ ] T95. 重构 `ProductionWorkbenchView`：移除对 `useEmpireStore` / `useStationStore` 的直接依赖，仅通过 props 渲染 overview / station / transit 三种布局
- [ ] T96. 重构 `ContextToolbar`：移除 `useEmpireStore` / `useSaveBindingStore` / `useActiveViewStore` / `useStationStore` 依赖，改为 props + emits
- [ ] T95. 重构 `StationTabBar`：移除对 `useEmpireStore` 的直接依赖，将 tab 分组、展开状态、active tab、相关动作改为 props + emits
- [ ] T96. 重构 `ProductionWorkbenchView`：移除对 `useEmpireStore` / `useStationStore` 的直接依赖，仅通过 props 渲染 overview / station / transit 三种布局
- [ ] T97. 重构 `ContextToolbar`：移除 `useEmpireStore` / `useSaveBindingStore` / `useActiveViewStore` / `useStationStore` 依赖，改为 props + emits
- [ ] T98. 重构 `StationPlanningPanel`：移除 `useStationStore` 依赖，改为通过 props 接收 `plannedModules/autoIndustryModules/searchQuery` 和相关 actions
- [ ] T99. 重构 `StationModulePicker`：保留 `useGameDataStore` 读取静态模块/DLC 元数据，移除 `useStationStore`，改为 props + emits
- [ ] T100. 重构 `StationWareFlowsDashboard`：移除 `useEmpireStore` / `useStationStore` 依赖，仅保留 `useGameDataStore`，将 `groupedFlows/settings/empireGaps` 通过 props 注入
- [ ] T101. 重构 `StationDashboard`：移除 `useStationStore` 依赖，仅保留 `useGameDataStore`，将 `stationAnalysis/settings/currentEfficiency/actualWorkforce` 通过 props 注入
- [ ] T102. 重构 `ImportPlanModal` 的 production workbench 接入方式：移除对 `useEmpireStore` 的直接依赖，将当前站点导入、新建站点导入等动作改为上层注入
- [ ] T103. 在 production workbench 子树中建立约束：除顶层容器外，不再新增 `useEmpireStore`；`useGameDataStore` 仅用于静态游戏数据与翻译
- [ ] T104. 补充 UI 去耦回归测试：验证 props 化后 overview / station / transit 三种布局渲染和主要交互不回归
- [ ] T105. 运行 `npm run build` 与相关 unit/e2e 验证，确认 UI 去耦改造不影响现有行为

## 后续修正 - 两个入口彻底拆分（Refactory 4）

- [x] T106. 编写 `refactory4.md`，明确“同内容从同一入口拆成两个入口”后的目标架构与重构原则
- [x] T107. 定义共享子组件 props / actions contract，覆盖 `StationTabBar`、`ContextToolbar`、`StationPlanningPanel`、`StationWareFlowsDashboard`、`StationDashboard`、`ImportPlanModal`、`TransitHub*` 的最小输入接口；禁止定义单一 `ProductionWorkbenchContext`
- [x] T108. 创建 `useBlueprintProductionStore`，接管 blueprint 入口的 selection / mutation / flow / save / dirty 生命周期
- [x] T109. 创建 `useLiveProductionStore`，接管 live 入口的 selection / mutation / draft / save / discard 生命周期
- [ ] T110. 将 empire session/saveAs/delete/snapshot 生命周期从旧总 store 中拆出，收口到 `useBlueprintProductionStore`
- [ ] T111. 将 binding draft/save/discard/confirm lifecycle 从旧总 store 中拆出，收口到 `useLiveProductionStore`
- [x] T112. 创建 `BlueprintProductionWorkbenchView.vue`，直接接入 `useBlueprintProductionStore`，并向共享 workbench 子树注入 blueprint 主路径 props / actions
- [x] T113. 创建 `LiveProductionWorkbenchView.vue`，直接接入 `useLiveProductionStore`，并向共享 workbench 子树注入 live 主路径 props / actions
- [ ] T114. 将 `ProductionWorkbenchView` 当前承担的 overview / station / transit 布局编排、子组件 props 接线与 import modal 接线迁移到 `BlueprintProductionWorkbenchView` / `LiveProductionWorkbenchView`
- [x] T115. 简化 `MainWorkbench`：按 active view 直接选择 `BlueprintProductionWorkbenchView` / `LiveProductionWorkbenchView`，移除“view -> productionSource -> load”双重翻译逻辑
- [ ] T116. 将共享可复用逻辑下沉到纯 service / query / command / importer / mapper 层，禁止在两个新 store 中复制计算逻辑
- [ ] T117. 将 station 编辑命令整理为入口无关的 command builder，由 blueprint/live 两个入口分别注入持久化依赖
- [ ] T118. 停止在新主路径中扩散 `productionSource` / `activeId` / `activeStationId` 兼容 computed，仅保留过渡适配层
- [ ] T119. 在 `BlueprintProductionWorkbenchView` / `LiveProductionWorkbenchView` 主路径稳定后，移除 `useEmpireStore` 中对 binding 的主路径编排职责
- [ ] T120. 在两个新入口主路径稳定后，移除 `useStationStore` 中基于 `productionSource` 的写路由，改为显式接入对应入口 command
- [ ] T121. 补充入口级回归测试：分别验证 `BlueprintProductionWorkbenchView` 与 `LiveProductionWorkbenchView` 下的 station 选择、overview、transit、dirty/save 语义
- [ ] T122. 补充共享 UI 回归测试：同一套已去耦 workbench 子树在 blueprint/live 两个入口下行为一致，仅入口语义差异不同
- [ ] T123. 移除 `ProductionWorkbenchView`，完成迁移后删除旧 watcher/compat 主路径，并更新 `tasks.md` 状态与剩余兼容清单

## 后续修正 - StationPlanningPanel 整包提交流程（Refactory 5）

- [x] T124. 编写 `refactory5.md`，明确 `StationPlanningPanel` 改为方案 B：整包提交 `plannedModules`
- [x] T125. 修改 `StationPlanningPanel` 对外 contract：props 仅保留 `plannedModules`、`autoIndustryModules`、`enforceDlcActivation`
- [x] T126. 修改 `StationPlanningPanel` 对外 contract：emits 仅保留 `updatePlannedModules`
- [x] T127. 在 `StationPlanningPanel` 内部实现统一数组变换提交流程：新增模块、删除模块、修改数量、拖拽排序后统一生成 `nextModules`
- [x] T128. 在 `StationPlanningPanel` 内部实现批量缩放与自动模块转入：移除 `applyScale` / `transferAutoModule` 对外事件，统一改为提交 `nextModules`
- [x] T129. 将搜索输入、模块筛选、高亮、闪烁状态全部内聚到 `StationPlanningPanel` / `StationModulePicker` 内部，不再由入口层提供 `searchQuery` / `filteredModulesGrouped`
- [x] T130. 更新 `useStationPlanningPanelModel` 与相关类型文件，只暴露整包 `plannedModules` 输入/输出 contract
- [x] T131. 更新 `BlueprintProductionWorkbenchView`：删除面向 panel 的细粒度 handler，只保留 `updatePlannedModules`
- [x] T132. 更新 `LiveProductionWorkbenchView`：删除面向 panel 的细粒度 handler，只保留 `updatePlannedModules`
- [x] T133. 调整 `useBlueprintProductionStore` / `useLiveProductionStore` 的 planning 写接口，改为接收整包 `plannedModules`
- [x] T134. 清理新入口主路径对 `useStationStore` 细粒度规划编辑入口的依赖，停止为 `StationPlanningPanel` 保留这些适配接口
- [ ] T135. 补充回归测试：验证模块添加、删除、改数量、拖拽、批量缩放、自动模块转入在整包提交模式下行为不回归
- [x] T136. 运行 `npm run build` 与相关 unit/e2e 验证，确认 Refactory 5 不引入 planning 面板回归
