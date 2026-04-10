# user-save-binding-data Tasks

## Documentation

- [ ] D1. 创建 `request.md` 并记录独立 binding、按需 station plan、显式保存、量化生产数据源等已确认方案
- [ ] D2. 创建 `design.md` 并说明 store、派生视图、UI 和保存策略
- [ ] D3. 创建 delta specs 覆盖 save binding、empire 管理、量化生产

## Implementation: Save Binding Store

- [ ] T1. 新增 save binding 类型与独立 storage 版本
- [ ] T2. 新增 `useSaveBindingStore`，支持按 `gameGuid` 创建/打开唯一 binding
- [ ] T3. 实现 binding draft、dirty、保存、放弃改动和 selected archive time/source empire 视角状态
- [ ] T4. 从 `EmpirePlan` 与 `useEmpireStore` 中移除 save binding 写入路径
- [ ] T5. 从 empire 业务中移除 binding 星区职责，避免 Step 2 继续读写 `activeEmpire.sectors`
- [ ] T6. 实现 binding group actions：创建、排序、重命名、anchor、coverage、jump range、connected groups
- [ ] T7. 实现 covered save station 派生 view model，进入 binding 时不自动创建 station plan
- [ ] T8. 实现 source empire station 候选选择与单次复制导入（仅使用 module_id）
- [ ] T9. 实现 save station plan 的按需创建、更新、清空删除
- [ ] T10. 实现 virtual station 显式创建、编辑、定位和删除
- [ ] T11. 为量化生产新增 production source adapter，支持 `empire` 与 `save-binding`
- [ ] T12. 量化生产在 `save-binding` source 下只使用 planned modules
- [ ] T13. 更新 storage import/export，把 `x4_save_bindings` 作为独立模块处理
- [ ] T14. 清理旧 `EmpirePlan.saveBindings` 相关引用和旧 binding action

## Implementation: Empire Store Production Source 路由

- [ ] T15. 扩展 `useSaveBindingStore` 添加 `activeStationId`、`selectStation`、`updateStationPlan`、`createStationPlanInGroup`
- [ ] T16. 创建 `useEmpireDataStore` 纯数据持久化层，提取 localStorage 操作
- [ ] T17. 修改 `useEmpireStore` 使用 `useEmpireDataStore` 保持 API 兼容
- [ ] T18. 在 `useEmpireStore` 添加 `productionSource` ref，支持 `'empire' | 'save-binding'`
- [ ] T19. 重构 `useEmpireStore.stations` computed 根据 `productionSource` 路由到 empire 或 binding 数据
- [ ] T20. 重构 `useEmpireStore.sectors` computed 根据 `productionSource` 路由（binding groups 作为 sectors）
- [ ] T21. 重构 `useEmpireStore.activeStation`/`activeStationId` 根据 `productionSource` 路由
- [ ] T22. 重构 `useEmpireStore.selectStation()` 方法根据 `productionSource` 路由
- [ ] T23. 重构 `useEmpireStore.createStation()`/`deleteStation()` 根据 `productionSource` 路由
- [ ] T24. 添加 `useEmpireStore.switchToBinding(gameGuid)` 方法处理切换逻辑和 dirty 确认
- [ ] T25. 将 save-binding production adapter 改为基于 binding 派生视图：covered save stations 和 virtual stations 映射为空间站，未覆盖 save stations 不映射
- [ ] T26. 在 save-binding production source 中将 `TradeStationBinding` 映射为 transit hub，而不是普通生产空间站

## Verification

- [ ] V1. 运行 `npm run build`，修复编译错误并重复执行直到通过或明确 blocker
- [ ] V2. 验证 binding 数据写入独立 storage
- [ ] V3. 验证 productionSource 路由正确切换 empire / save-binding