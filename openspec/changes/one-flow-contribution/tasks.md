# One Flow Contribution - Tasks

## Tasks

### Phase 1: 类型定义

- [x] T1. 新 `FlowContribution`（class: `'module' | 'workforce' | 'station' | 'sector'`，去 `volumeFlow?`/`valueFlow?`/`transportFlow?`）
- [x] T2. 新 `DerivedFlowContribution extends FlowContribution`（含 `name`/`netValue`/`sortOrder?`/`storageVolume?`/`transportVolume?`）
- [x] T3. 删 `DerivedStationFlowAtom`
- [x] T4. 删 `SupplyStorageFlowDetail`，`SupplyStorageFlow.details` 改 `DerivedFlowContribution[]`
- [x] T5. `WareFlow`、`EmpireWareFlow`、`WareProductionFlow` 的 `contributions` 更新

### Phase 2: 原始层适配

- [x] T6. `calculateWareFlowDerived.ts`：`deriveProductionFlows` 产 `DerivedFlowContribution[]`，填 `name`/`netValue`/`transportVolume`
- [x] T7. `StationDerivedMap.ts`：`convertProductionFlowToWareFlow` 删 `volumeFlow/valueFlow/transportFlow`
- [x] T8. `StationWareFlow.vue`：`detail.volumeFlow` → 实时计算

### Phase 3: 派生层 name 填充

- [x] T9. `buildExternalCache`：`class: 'sector'`，`name` 留空由 facade 回填
- [x] T10. `stationGapViewModel.ts`：贡献使用 `DerivedFlowContribution`，`id: sectorId, class: 'sector'`，填 `name`
- [x] T11. `empireFlowFacade.ts`：`buildSupplyStorageFlows` 产 `DerivedFlowContribution[]`，填 `name`
- [x] T12. `getSectorFinalProductionFlows`：回填 `name`（station / sector）

### Phase 4: UI 层迁移

- [x] T13. `TransitHubStorageFlow.vue`：`stationId` → `id`，`kind` → `type`，`stationName` → `name`，`startsWith('external:')` → `class === 'sector'`
- [x] T14. `TransitHubTransportFlow.vue`：同上
- [x] T15. `EmpireWareFlowsDashboard.vue`：同上
- [x] T16. `deriveEmpireWareFlowView.ts`：`DerivedEmpireContribution` → `DerivedFlowContribution`

### Phase 5: 构建验证

- [x] T17. `npm run build` 通过

## 执行顺序

```
Phase 1 (type defs):     T1-T5
Phase 2 (raw layer):     T6-T8
Phase 3 (name fill):     T9-T12
Phase 4 (UI):            T13-T16
Phase 5 (build):         T17
```

## 依赖

- 前置依赖：`empire-sector-flows-cache`

## 完成定义

- [x] `FlowContribution` 只含原始字段，class 含 `'sector'`
- [x] `DerivedFlowContribution` 含 `name`，派生阶段填充
- [x] `DerivedStationFlowAtom` / `SupplyStorageFlowDetail` 删除
- [x] gap 分析用 `DerivedFlowContribution` + `class: 'sector'`
- [x] UI 使用 `detail.name` / `detail.class === 'sector'`
- [x] `npm run build` 通过
