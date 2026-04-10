# stand-alone-binding Tasks

## Documentation

- [x] D1. 创建 `request.md` 并记录独立 binding、按需 station plan、显式保存、量化生产数据源等已确认方案
- [x] D2. 创建 `design.md` 并说明 store、派生视图、UI 和保存策略
- [x] D3. 创建 delta specs 覆盖 save binding、empire 管理、地图 binding、量化生产和星区总览
- [x] D4. 更新 `design.md` 添加派生空间站名称与星区归属逻辑说明
- [x] D5. 更新 `design.md` 添加 D9: Production source 路由架构说明

## Implementation

- [x] T1. 新增 save binding 类型与独立 storage 版本
- [x] T2. 新增 `useSaveBindingStore`，支持按 `gameGuid` 创建/打开唯一 binding
- [x] T3. 实现 binding draft、dirty、保存、放弃改动和 selected archive time/source empire 视角状态
- [x] T4. 从 `EmpirePlan` 与 `useEmpireStore` 中移除 save binding 写入路径
- [x] T5. 从 empire 业务中移除 binding 星区职责，避免 Step 2 继续读写 `activeEmpire.sectors`
- [x] T6. 实现 binding group actions：创建、排序、重命名、anchor、coverage、jump range、connected groups
- [x] T7. 实现 covered save station 派生 view model，进入 binding 时不自动创建 station plan
- [x] T8. 实现 source empire station 候选选择与单次复制导入
- [x] T9. 实现 save station plan 的按需创建、更新、清空删除
- [x] T10. 实现 virtual station 显式创建、编辑、定位和删除
- [x] T11. 改造 `MapSaveArchiveList` / `MapSavePanel` 使用独立 save binding store
- [x] T12. 改造 `MapBindingSectorGroup` 读写 binding groups
- [x] T13. 改造 `MapBindingStation` 显示派生 save station views、source empire 导入和 virtual station 操作
- [x] T14. 改造地图 binding POI 投影，从独立 binding store 派生
- [x] T15. 为量化生产新增 production source adapter，支持 `empire` 与 `save-binding`
- [x] T16. 量化生产在 `save-binding` source 下只使用 planned modules
- [x] T17. 移除星区总览中的星区管理面板内容，并保留左侧布局占位防止右侧资源视图扩张
- [x] T18. 更新 storage import/export，把 `x4_save_bindings` 作为独立模块处理
- [x] T19. 更新 i18n 文案：保存绑定、绑定 dirty、binding 星区、source empire 导入、virtual station
- [x] T20. 清理旧 `EmpirePlan.saveBindings` 相关引用和旧 binding action
- [x] T21. 运行 `npm run build`，修复编译错误并重复执行直到通过或明确 blocker
- [x] T22. 将 Step 3 改为 station blueprint 来源，并在 Step 2 新建星区时复用定位星区菜单创建 group draft
- [x] T23. 点击 binding 入口时，如果当前 ordinary empire dirty，复用 dirty empire 新建确认流程；保存或放弃后再进入 binding，取消则中止
- [x] T24. 点击 binding 入口成功后，将量化生产 active source 切换到当前 `gameGuid` 对应的 `save-binding`
- [x] T25. 将 save-binding production adapter 改为基于 binding 派生视图：covered save stations 和 virtual stations 映射为空间站，未覆盖 save stations 不映射
- [x] T26. 在 save-binding production source 中将 `TradeStationBinding` 映射为 transit hub，而不是普通生产空间站

## 数据源完整切换 (Phase 2)

- [x] T27. 扩展 `useSaveBindingStore` 添加 `activeStationId`、`selectStation`、`updateStationPlan`、`createStationPlanInGroup`
- [x] T28. 创建 `useEmpireDataStore` 纯数据持久化层，提取 localStorage 操作
- [x] T29. 修改 `useEmpireStore` 使用 `useEmpireDataStore` 保持 API 兼容
- [x] T30. 在 `useEmpireStore` 添加 `productionSource` ref，支持 `'empire' | 'save-binding'`
- [x] T31. 重构 `useEmpireStore.orderedStationsBySector` computed 根据 `productionSource` 路由到 empire 或 binding 数据
- [x] T32. 重构 `useEmpireStore.sectors` computed 根据 `productionSource` 路由（binding groups 作为 sectors）
- [x] T33. 重构 `useEmpireStore.activeStation`/`activeStationId` 根据 `productionSource` 路由
- [x] T34. 重构 `useEmpireStore.selectStation()` 方法根据 `productionSource` 路由
- [x] T35. 重构 `useEmpireStore.createStation()`/`deleteStation()` 根据 `productionSource` 路由
- [x] T36. 添加 `useEmpireStore.switchToBinding(gameGuid)` 方法处理切换逻辑和 dirty 确认
- [x] T37. 更新 `MapSavePanel.vue` 使用 `switchToBinding()` 替代直接操作
- [x] T38. 移除 `ProductionWorkbenchView.vue` 中的手动 `productionSource` 管理
- [x] T39. 运行 `npm run build` 验证所有改动

## 空间站名称与星区归属 (Phase 3)

- [x] T40. 修正 `deriveBindingStations` 计算 groupId：有 plan 用 plan.groupId，无 plan 通过 sectorMacro 找 group
- [x] T41. 设置 `station.sectorId = groupId` 确保 UI 组件兼容
- [x] T42. 更新 `design.md` 记录名称与星区逻辑

## 当前状态

**已完成**：T1-T42 全部完成，Phase 1-3 完整实现。

**Build 状态**：通过 ✓

**核心实现**：
- `useEmpireDataStore` 纯数据层
- `productionSource` ref 控制数据源
- `sectors`/`orderedStationsBySector`/`activeStationId` 路由
- `deriveBindingStations` 派生空间站列表
- `switchToBinding`/`confirmSwitchToBinding` 切换方法
- 空间站名称与星区归属正确计算
