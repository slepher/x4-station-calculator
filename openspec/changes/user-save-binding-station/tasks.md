# user-save-binding-station Tasks

## Documentation

- [x] D1. 创建 `request.md` 描述量化生产界面交互需求
- [x] D2. 创建 `design.md` 描述 UI 和 store 适配设计
- [x] D3. 从 `stand-alone-binding` 提取相关设计内容

## Store 适配

- [ ] T1. 重构 `useStationStore.updateModules()` 根据 `productionSource` 路由
- [ ] T2. 重构 `useStationStore.updateSettings()` 根据 `productionSource` 路由
- [ ] T3. 重构 `useStationStore.addModule()` / `removeModule()` 根据 `productionSource` 路由
- [ ] T4. 在 `useEmpireStore.isDirty` 合并 binding dirty 状态
- [ ] T5. 添加 `useEmpireStore.saveCurrentSource()` 方法根据 source 调用正确保存方法

## UI 适配 - StationPlanningPanel

- [ ] T6. 添加"保存绑定"按钮，仅在 `productionSource === 'save-binding'` 时显示
- [ ] T7. 显示 binding dirty 状态指示器
- [ ] T8. 蓝图导入功能适配 binding 模式

## UI 适配 - StationTabBar

- [ ] T9. 验证 binding 模式下星区显示为 binding groups
- [ ] T10. 创建空间站按钮适配 binding 模式（创建虚拟空间站）
- [ ] T11. 右键菜单适配 binding 操作（删除行为差异）

## UI 适配 - StationDashboard

- [ ] T12. 验证 dirty 状态正确显示（合并 empire + binding）
- [ ] T13. 保存按钮根据 source 调用正确方法

## UI 适配 - ProductionWorkbenchView

- [ ] T14. 验证数据源切换按钮工作正常
- [ ] T15. binding 模式禁用 empire 专属功能（星区链接等）

## 测试验证

- [ ] T16. E2E 测试：进入 binding → 编辑空间站 → dirty 状态 → 保存绑定
- [ ] T17. E2E 测试：编辑空间站 → 切换 empire → binding 保持 draft → 再次进入恢复
- [ ] T18. E2E 测试：创建虚拟空间站 → 分配到 group → 保存
- [ ] T19. 运行 `npm run build` 验证编译通过

## 当前状态

**已完成**：D1-D3 文档任务完成

**待实现**：T1-T19 UI 和 store 适配任务

**依赖**：基于 `stand-alone-binding` 已实现的 `productionSource` 路由架构