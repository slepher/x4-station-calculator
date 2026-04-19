# station-derived-map Tasks

## Tasks

### Phase 1: 纯改名，不改行为

- [x] T1. 新建 `src/store/state/StationDerivedMap.ts`，将 `StationProductionFlowMap.ts` 文件级命名迁移为 `StationDerivedMap`
- [x] T2. 将类名 `StationProductionFlowMap` 改为 `StationDerivedMap`
- [x] T3. 将 blueprint/planning 单例主名改为新 derived 命名，不保留兼容别名，不允许新旧名称并存
- [x] T4. 更新 `useBlueprintProductionStore`、`useLiveProductionStore`、`productionStationShared`、`empireFlowFacade`、`liveProductionFlows` 等所有 import/type 引用
- [x] T5. 将 `useLiveProductionStore` 内部 archive/live 实例改为 `new StationDerivedMap()`
- [x] T6. 同步更新 OpenSpec 文档中对 `StationProductionFlowMap` 的主名词引用，明确其后续由 `StationDerivedMap` 取代
- [x] T7. 第一阶段自检：确认未新增字段、未改变 compute/updateAggregation/getCache/getGrouped 行为
- [x] T8. 第一阶段构建验证：`npm run build`

### Phase 2: 扩展 semantic derived cache

- [x] T9. 为 `StationDerivedCache` 增加 `semantics` 子结构，至少包含 `tag`、`factoryGroup`、`productionProfile`、`profileName`
- [x] T10. 在 `StationDerivedMap` 内新增 `setSemantics(stationId, semantics)` 功能型写口，禁止身份型 API
- [x] T11. 在 logic 层新增 `buildStationSemantics(...)` 和 `buildArchiveSemantics(...)` builder 函数
- [x] T12. 明确 archive/live 路径的 fallback 规则：当 archive 缺失 semantic 字段时，必须使用 modules 计算或默认值补齐
- [x] T13. 更新 `useBlueprintProductionStore`，使 `getTabs()` 从 blueprint/planning derived map 读取 `cache.semantics`
- [x] T14. 更新 `useLiveProductionStore`，使 binding/planning 与 archive/live 路径分别读取对应实例的 `cache.semantics`
- [x] T15. 删除 `useBlueprintProductionStore.getTabs()` 中直接调用 `classifyPlayerStationPoi(...)` 组装 `tag/factoryGroup` 的主路径
- [x] T16. 删除 `useLiveProductionStore.getTabs()` 中直接维护 binding plan / archive record 双路 `tag/factoryGroup` 分支的主路径
- [x] T17. 校正 `ProductionTabItem` 读取链路，确保 `tag/factoryGroup` 外部行为不变
- [x] T18. 文档同步：将 `user-save-binding-station` 与相关设计文档中"tab 组装时计算 tag"的描述更新为"tab 组装时读取 derived cache"
- [x] T19. 第二阶段构建验证：`npm run build`

### Phase R: Review 修正

- [x] R1-R4. 删除 map 层身份泄漏 API（`computeSemanticForPlan`、`computeSemanticForArchive`），禁止身份词
- [x] R5-R7. 提供 `setSemantics` 功能型写口，map 层不感知来源身份
- [x] R8-R11. 上移 semantic builder 到 logic 层（`stationDerivedSemantics.ts`）
- [x] R12-R16. 收口上层场景入口（初始化、模块变动、setting 变动）
- [x] R17-R20. 替换调用点，按场景矩阵执行
- [x] R21-R22. 文档同步与构建验证

## 执行顺序

```text
Phase 1:
  T1-T7 仅允许 rename / import path / 文档主名词同步 ✓
  T8 build 验证 ✓

Phase 2:
  T9-T12 先补 cache 与 compute 能力 ✓
  T13-T17 再迁移 blueprint/live 调用方 ✓
  T18 文档同步 ✓
  T19 build 验证 ✓
```

## 禁止事项

- [x] 禁止在 Phase 1 顺手调整缓存结构
- [x] 禁止在 Phase 1 改写 semantic 计算规则
- [x] 禁止在 Phase 1 保留兼容别名
- [x] 禁止把 planning/binding 与 archive/live 两套来源合并为单实例
- [x] 禁止只迁移 `useLiveProductionStore` 而遗漏 `useBlueprintProductionStore`
- [x] 禁止在 `getTabs()` 中留下新的 duplicated classification 逻辑

## 完成定义

- [x] 第一阶段完成后，主抽象名已经统一为 `StationDerivedMap`，且行为不变
- [x] 第二阶段完成后，blueprint/planning 与 archive/live 两个实例都能提供 `cache.semantics`
- [x] blueprint/live 两个 production store 的 tab 组装逻辑都改为"读取 derived cache"
- [x] 实现阶段至少通过一次 `npm run build`