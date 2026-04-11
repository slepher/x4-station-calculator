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
