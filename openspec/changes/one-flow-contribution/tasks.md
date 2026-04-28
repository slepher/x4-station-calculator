# One Flow Contribution - Tasks

## Tasks

### Phase 1: 类型定义

- [x] T1. 在 `src/types/production-flow.ts` 中新增 `FlowContribution` 接口，替代 `BaseModuleFlowAtom`
- [x] T2. 删除 `src/types/production-flow.ts` 中的 `BaseModuleFlowAtom` 接口
- [x] T3. 更新 `src/types/production-flow.ts` 中 `WareProductionFlow.contributions` 类型为 `FlowContribution[]`
- [x] T4. 删除 `src/types/x4.ts` 中的 `ModuleFlowAtom` 和 `StationFlowAtom` 接口
- [x] T5. 更新 `src/types/x4.ts` 中 `WareFlow.contributions` 类型为 `FlowContribution[]`
- [x] T6. 更新 `src/types/x4.ts` 中 `EmpireWareFlow.contributions` 类型为 `FlowContribution[]`
- [x] T7. 删除 `src/types/x4.ts` 中 `EmpireWareFlow.workforceConsumption` 字段
- [x] T8. 删除 `src/types/production-flow.ts` 中 `WareProductionFlow.workforceConsumption` 字段
- [x] T9. 删除 `src/types/x4.ts` 中 `WareFlow.workforceConsumption` 字段
- [x] T10. 删除 `DerivedStationFlowAtom` 和 `DerivedProductionFlow`（或更新其类型引用）

### Phase 2: 生成侧适配

- [x] T11. 更新 `src/store/logic/calculateProductionFlows.ts`，workforce contribution 改为 `class='workforce'` + 实际种族名 + 直接用工人数量，不再生成居住舱模块贡献
- [x] T12. 确保 amount 为 0，消耗量写入 flow 顶层的 `consumption`

### Phase 3: 消费侧适配

- [x] T13. 替换所有 `flow.workforceConsumption > 0` 判定为 `flow.contributions.some(c => c.class === 'workforce')`
- [x] T14. 更新 `src/store/logic/calculateWareFlowDerived.ts` 中的 contribution 类型引用，将 volumeFlow/valueFlow/transportFlow 附加到 `FlowContribution`
- [x] T15. 更新 `src/store/logic/analyzeWareFlow.ts` 中的 workforce 判定
- [x] T16. 更新 `src/store/logic/analyzeEmpireWareFlow.ts` 中的 workforce 判定和 contribution 构建
- [x] T17. 更新 `src/store/state/StationDerivedMap.ts` 中 filter/group 函数的 `workforceConsumption` 引用
- [x] T18. 更新 `src/store/logic/empireFlowFacade.ts` 中 `workforceConsumption` 引用
- [x] T19. 搜索整个 `src/` 目录，替换所有残留的 `workforceConsumption` 字段引用和旧 contribution 类型引用

### Phase 4: 构建验证

- [x] T20. `npm run build`，确认无编译错误（仅 pre-existing 错误残留，非本 change 引入）
- [x] T21. 若有编译错误，修复后重跑直到通过或显式阻塞

### Phase 5: stationContributions 双路径消除

- [x] T22. 删除 `src/types/production-flow.ts` 中 `WareProductionFlow.stationContributions` 字段
- [x] T23. 删除 `src/types/production-flow.ts` 中 `DerivedProductionFlow.stationContributions` 字段
- [x] T24. 更新 `src/store/logic/calculateWareFlowDerived.ts` 移除 `stationContributions` 分支逻辑和 `DerivedStationFlowAtom` 转换
- [x] T25. 更新 `src/store/logic/empireFlowFacade.ts` 中 `getSectorFinalProductionFlows` 写入 `contributions` 而非 `stationContributions`
- [x] T26. 更新 `src/components/empire/transit-hub/TransitHubCenterDashboard.vue` 读取 `contributions` 而非 `stationContributions`
- [x] T27. `npm run build` 确认无编译错误（仅 pre-existing 错误残留）

### Phase 6: FlowContribution 字段精简

- [x] T28. 从 `FlowContribution` 中移除 `production`、`consumption`、`workforceConsumption`、`netRate` 四个冗余字段，保留 `type`/`amount` 表示产消方向和数值
- [x] T29. 更新所有 creation site（`calculateProductionFlows`、`analyzeEmpireWareFlow`、`empireFlowFacade`、`stationGapViewModel`）不再设置这四个字段
- [x] T30. 更新所有消费方：`deriveEmpireWareFlowView`、`EmpireWareFlowsDashboard`、`TransitHubCenterDashboard`、`EmpireWareFlow` 改用 `amount` 替代 `netRate`/`production`/`consumption`
- [x] T31. 为 Vue 组件增加类型限制（`EmpireWareFlow.details` → `FlowContribution[]`，`EmpireWareFlowGroup.items` 声明接口）
- [x] T32. `npm run build` 确认通过

## 完成定义

- [x] `FlowContribution` 只保留 `id`/`class`/`type`/`count`/`amount`/`bonusPercent` + 可选衍生字段
- [x] 旧类型从主路径清理
- [x] `workforceConsumption` 字段从三个 flow 类型中移除
- [x] 自动 workforce 使用 `class='workforce'` + 实际种族名 + 工数量，`amount` 为负的实际消耗值
- [x] workforce 判定逻辑全部迁移到 `class='workforce'` 检查
- [x] `npm run build` 通过（仅 pre-existing 错误残留，非本 change 引入）
