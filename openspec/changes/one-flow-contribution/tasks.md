# One Flow Contribution - Tasks

## Tasks

### Phase 1: 类型定义

- [ ] T1. 在 `src/types/production-flow.ts` 中新增 `FlowContribution` 接口，替代 `BaseModuleFlowAtom`
- [ ] T2. 删除 `src/types/production-flow.ts` 中的 `BaseModuleFlowAtom` 接口
- [ ] T3. 更新 `src/types/production-flow.ts` 中 `WareProductionFlow.contributions` 类型为 `FlowContribution[]`
- [ ] T4. 删除 `src/types/x4.ts` 中的 `ModuleFlowAtom` 和 `StationFlowAtom` 接口
- [ ] T5. 更新 `src/types/x4.ts` 中 `WareFlow.contributions` 类型为 `FlowContribution[]`
- [ ] T6. 更新 `src/types/x4.ts` 中 `EmpireWareFlow.contributions` 类型为 `FlowContribution[]`
- [ ] T7. 删除 `src/types/x4.ts` 中 `EmpireWareFlow.workforceConsumption` 字段
- [ ] T8. 删除 `src/types/production-flow.ts` 中 `WareProductionFlow.workforceConsumption` 字段
- [ ] T9. 删除 `src/types/x4.ts` 中 `WareFlow.workforceConsumption` 字段
- [ ] T10. 删除 `DerivedStationFlowAtom` 和 `DerivedProductionFlow`（或更新其类型引用）

### Phase 2: 生成侧适配

- [ ] T11. 更新 `src/store/logic/calculateProductionFlows.ts`，workforce contribution 改为 `class='workforce'` + 实际种族名 + 直接用工人数量，不再生成居住舱模块贡献
- [ ] T12. 确保 amount 为 0，消耗量写入 flow 顶层的 `consumption`

### Phase 3: 消费侧适配

- [ ] T13. 替换所有 `flow.workforceConsumption > 0` 判定为 `flow.contributions.some(c => c.class === 'workforce')`
- [ ] T14. 更新 `src/store/logic/calculateWareFlowDerived.ts` 中的 contribution 类型引用，将 volumeFlow/valueFlow/transportFlow 附加到 `FlowContribution`
- [ ] T15. 更新 `src/store/logic/analyzeWareFlow.ts` 中的 workforce 判定
- [ ] T16. 更新 `src/store/logic/analyzeEmpireWareFlow.ts` 中的 workforce 判定和 contribution 构建
- [ ] T17. 更新 `src/store/state/StationDerivedMap.ts` 中 filter/group 函数的 `workforceConsumption` 引用
- [ ] T18. 更新 `src/store/logic/empireFlowFacade.ts` 中 `workforceConsumption` 引用
- [ ] T19. 搜索整个 `src/` 目录，替换所有残留的 `workforceConsumption` 字段引用和旧 contribution 类型引用

### Phase 4: 构建验证

- [ ] T20. `npm run build`，确认无编译错误
- [ ] T21. 若有编译错误，修复后重跑直到通过或显式阻塞

## 执行顺序

```
Phase 1 (类型定义):
  T1-T10  新类型 + 旧类型清理 + workforceConsumption 字段删除

Phase 2 (生成侧):
  T11-T12  workforce contribution 生成改造

Phase 3 (消费侧):
  T13-T19  workforce 判定迁移 + 旧类型引用替换

Phase 4 (构建验证):
  T20-T21  build 验证
```

## 完成定义

- [ ] `FlowContribution` 类型定义完成，旧类型从主路径清理
- [ ] `workforceConsumption` 字段从三个 flow 类型中移除
- [ ] 自动 workforce 使用 `class='workforce'` + 实际种族名 + 工数量
- [ ] workforce 判定逻辑全部迁移到 `class='workforce'` 检查
- [ ] `npm run build` 通过
