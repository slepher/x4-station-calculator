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
- [x] T24. 将 empire sector link 管理动作下沉到 `useEmpireDataStore`，binding 模式下 `getLinkedSectors()` 改读 `connectedGroupIds`
- [x] T25. 补充回归测试：binding 中转站可聚合本星区 station flow，binding connected groups 参与 link solver
- [x] T26. 运行相关 unit/e2e/build 验证

## 当前状态

**已完成**：D1-D3 文档任务完成；T1-T19 UI、store 适配和测试验证完成

**已完成**：T20-T26 source-aware 中转聚合与 empire 管理职责下沉完成

**依赖**：基于 `stand-alone-binding` 已实现的 `productionSource` 路由架构
