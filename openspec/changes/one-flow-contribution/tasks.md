# One Flow Contribution - Tasks

## Tasks

### Phase 1: 类型清理

- [ ] T1. 删 `SupplyStorageFlow` / `SupplyStorageFlowDetail`（x4.ts）
- [ ] T2. `SectorInternalData` 删 `supplyStorageFlows`
- [ ] T3. `StationComponentGapFlows.operations/supply` 改为 `DerivedProductionFlow[]`
- [ ] T4. `DerivedProductionFlow.contributions` 改为 `DerivedFlowContribution[]`
- [ ] T5. `EmpireGapItem` 类型改为 `DerivedProductionFlow`

### Phase 2: deriveProductionFlows 统一

- [ ] T6. `deriveProductionFlows` 入参扩展 `stationNameMap`/`sectorNameMap`
- [ ] T7. 统一 name 解析：所有 class 都在 `deriveProductionFlows` 内处理
- [ ] T8. `getSectorFinalProductionFlows` 不自填 name
- [ ] T9. `deriveEmpireWareFlows` 统一到 `deriveProductionFlows`

### Phase 3: 删除冗余函数

- [ ] T10. 删 `buildSupplyStorageFlows`（empireFlowFacade.ts）
- [ ] T11. 删 `buildStorageFlowsFromProductionFlows`（TransitHubCenterDashboard.vue）
- [ ] T12. 删 `groupDerivedProductionFlows` 独立函数，改 `useWareFlowGrouping` composable

### Phase 4: 组件统一

- [ ] T13. `StationWareFlowsDashboard` 调 `useWareFlowGrouping` composable
- [ ] T14. `TransitHubCenterDashboard` 调 `useWareFlowGrouping` composable
- [ ] T15. `EmpireWareFlowsDashboard` 调 `useWareFlowGrouping` composable

### Phase 5: Gap 分析统一

- [ ] T16. `buildStationComponentGapFlows` 产出 `DerivedProductionFlow[]`
- [ ] T17. `getStationComponentGapFlows` 返回 `DerivedProductionFlow[]`
- [ ] T18. `StationWareFlowsDashboard` gap 部分适配新类型

### Phase 6: 构建验证

- [ ] T19. `npm run build` 通过

## 完成定义

- [ ] `SupplyStorageFlow` / `SupplyStorageFlowDetail` 删除
- [ ] `groupDerivedProductionFlows` 改为 composable
- [ ] `deriveProductionFlows` 统一 name 解析
- [ ] 三个 dashboard 调同一 grouping composable
- [ ] Gap 分析统一为 `DerivedProductionFlow[]`
- [ ] `npm run build` 通过
