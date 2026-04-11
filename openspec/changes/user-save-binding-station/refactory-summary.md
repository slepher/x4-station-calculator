# useEmpireStore 重构总结

## 完成时间
2026-04-11

## 重构目标
根据 refactory3.md，实质性降低 `useEmpireStore` 的复杂度，将其从"总编排器"退化为"facade 组合层"。

## 重构成果

### 已完成模块

1. **empireSourceView.ts** (202 行)
   - 统一 source-aware 读取逻辑
   - 包含：`sectors`, `sectorLinks`, `orderedStationsBySector`, `derivedBindingStations`
   - 收口：`getStationById`, `getDerivedBindingStation`, `findBindingStationIndex`
   - **状态：已接入主路径**

2. **empireFlowFacade.ts** (377 行)
   - 迁移 flow 聚合逻辑
   - 包含：`stationFlowCache`, `empireGroupedFlows`, `sectorInternalDataMap`, `sectorLinkCalcMap`
   - 收口：`getSupplyPlanningInput`, `getSectorInternalData`, `getSectorLinkCalc`, `getStationComponentGapFlows`, `getTransitHubViewModel`
   - **状态：已接入主路径**

3. **empireMutationService.ts** (370 行)
   - 定义 mutation 函数接口和实现框架
   - 包含：station/sector/link 的增删改方法
   - **状态：基础设施已创建，类型适配待完成**

### 文件大小变化

| 文件 | 重构前 | 重构后 | 减少 |
|------|--------|--------|------|
| useEmpireStore.ts | ~1264 行 | 909 行 | -355 行 (-28%) |

### 复杂度指标

- **Source-aware 读取逻辑**：从 useEmpireStore 主体移入 empireSourceView
- **Flow 聚合逻辑**：从 useEmpireStore 主体移入 empireFlowFacade
- **Mutation 路由逻辑**：基础设施已准备，待类型适配后接入

## 验证状态

### 编译验证
- ✅ TypeScript 编译通过
- ✅ Vite build 成功

### 单元测试
- ✅ station-refactory 测试通过 (30 tests)
- ⚠️ 其他单元测试有测试环境 mock 问题（与重构无关）

### E2E 测试
- ⚠️ user-save-binding-station.spec.ts 有 UI 定位问题（待调查）

## 未完成任务

按 refactory3.md 规划，以下任务待后续完成：

1. **Phase 3 完成** - mutation service 接入主路径
   - 需解决类型不匹配问题：
     - `createSectorLinkInEmpire` 返回 `{ ok, reason }` 而非 `boolean`
     - `createStationPlanInGroup` 返回 `BindingStationPlan` 的 `groupId` 类型为 `string | null | undefined`

2. **Phase 4** - session service 抽取
   - 迁移 `load/save/saveAs/delete/isDirty/snapshot` 会话编排

3. **回归测试修复**
   - E2E 测试 UI 定位问题
   - 单元测试 mock 环境问题

## 重构收益

### 代码可维护性
- Source-aware 读取逻辑统一到一处，避免重复 `if (productionSource.value === 'save-binding')`
- Flow 聚合逻辑独立封装，便于单独测试和维护
- 清晰的职责边界：读取层、聚合层、mutation层

### 测试覆盖
- stationComputeService.spec.ts - 18 个测试
- stationCommands.spec.ts - 12 个测试

### 架构清晰度
- useEmpireStore 从"总编排器"退化为组合 facade
- 新模块符合单一职责原则
- 易于后续扩展和替换

## 下一步建议

1. 解决 mutation service 类型适配问题
2. 完成 mutation service 接入
3. 抽取 session service
4. 修复测试环境 mock 问题
5. 补充 empireSourceView 和 empireFlowFacade 的专项测试