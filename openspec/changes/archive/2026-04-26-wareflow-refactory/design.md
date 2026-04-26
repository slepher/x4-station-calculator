# WareFlow Refactory - 设计文档

## 架构变更

### 1. 两阶段计算架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Store Layer                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ StationStateMap.recompute()                          │    │
│  │                                                      │    │
│  │  plannedModules ──────────────────────────┐         │    │
│  │                                            │         │    │
│  │  calculateProductionFlows()               │         │    │
│  │  ├─ Phase 1: 工业模块补完                  │         │    │
│  │  ├─ Phase 2: 居住舱补完                    │         │    │
│  │  └─ 产量计算                               │         │    │
│  │                                            │         │    │
│  │  输出:                                     │         │    │
│  │  ├─ autoIndustryModules (不含仓储/泊位)    │         │    │
│  │  └─ productionFlows                        │         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ productionFlows, autoIndustryModules
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Vue Layer                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ useWareFlowDerived composable                        │    │
│  │                                                      │    │
│  │  watch: bufferHours, priceMultiplier, transport     │    │
│  │                                                      │    │
│  │  calculateWareFlowDerived()                         │    │
│  │  ├─ 仓储需求 → 仓储模块                              │    │
│  │  ├─ 泊位需求 → 泊位模块                              │    │
│  │  ├─ 分组逻辑                                         │    │
│  │  ├─ 资金计算                                         │    │
│  │  ├─ 仓储规划                                         │    │
│  │  └─ 运输计算                                         │    │
│  │                                                      │    │
│  │  输出:                                               │    │
│  │  ├─ groupedFlows                                     │    │
│  │  └─ autoInfrastructureModules                        │    │
│  │                                                      │    │
│  │  emit: updateAutoInfrastructureModules              │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ StationPlanningPanel                                 │    │
│  │                                                      │    │
│  │  显示: autoIndustryModules + autoInfrastructureModules │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据流分离

**一阶段数据流**（依赖 plannedModules + waresMap）：
```
plannedModules + waresMap → autoIndustryModules + productionFlows (含静态数据)
```

**二阶段数据流**（依赖 settings 参数，无需 waresMap）：
```
productionFlows + bufferHours/priceMultiplier/transport → groupedFlows + autoInfrastructureModules
```

**分离原因**：
- 仓储/泊位模块不影响产量计算
- 一阶段预取所有静态数据（价格、体积、tier、transportType），避免二阶段查 waresMap
- 体积流可从产量 + unitVolume 直接计算
- 价格可从 minPrice/price/maxPrice + multiplier 直接计算
- bufferHours/priceMultiplier/transport 参数变化频繁，不应触发完整重算
- Vue 层可灵活 watch 参数变化，避免 store 层复杂依赖

## 关键决策

### 决策 1：新数据类型 WareProductionFlow

**问题**：一阶段输出如何与完整 WareFlow 区分？

**决策**：创建新类型 `WareProductionFlow`，包含产量字段 + 二阶段所需的静态数据。

**理由**：
- 类型安全：明确区分一阶段和二阶段数据
- 性能优化：二阶段无需查询 waresMap，直接使用预取数据
- 可扩展：未来如需更多阶段，可继续定义新类型
- 文档化：字段定义清晰表达计算阶段

**包含的静态数据**：
- `unitVolume`, `tier`, `transportType`：用于体积流计算和分组
- `minPrice`, `price`, `maxPrice`：用于动态价格计算

### 决策 2：autoIndustryModules 不含仓储/泊位

**问题**：autoIndustryModules 是否应包含仓储/泊位？

**决策**：autoIndustryModules 仅包含生产模块和居住舱，仓储/泊位放入 autoInfrastructureModules。

**理由**：
- 业务语义：生产 vs 基础设施是不同概念
- 触发分离：生产模块依赖 plannedModules，基础设施依赖 bufferHours/transport
- 显示合并：UI 合并显示，内部分离存储便于管理

### 决策 3：移除 state.groupedFlows

**问题**：state 是否应保留 groupedFlows？

**决策**：移除 state.groupedFlows，改为 Vue 组件内计算。

**理由**：
- groupedFlows 依赖二阶段参数（bufferHours等），存储到 store 会增加 watch 复杂度
- Vue composable 可本地管理 groupedFlows，响应式更新更高效
- Empire 聚合使用 `groupedFlowsForEmpire`，需保留但需重新设计获取方式

**例外**：`groupedFlowsForEmpire` 保留，用于 Empire 视图聚合。需要基于 `productionFlows` 在 Empire 层计算。

### 决策 4：计算逻辑位置

**问题**：计算函数放在 store 还是 Vue？

**决策**：所有计算逻辑函数放在 `src/store/logic/`，store 和 Vue 通过导入使用。

**理由**：
- 可测试性：纯函数便于单元测试
- 可复用：store 和 Vue 可共享同一计算逻辑
- 维护性：逻辑集中管理，避免分散

### 决策 5：二阶段 emit 更新 store

**问题**：二阶段如何同步 autoInfrastructureModules 到 store？

**决策**：二阶段 emit `updateAutoInfrastructureModules` 事件，store 接收并更新 state。

**理由**：
- 单向数据流：Vue → store，符合 Vue 数据流原则
- store 作为唯一状态源：state.autoInfrastructureModules 由 store 管理
- 避免直接修改：Vue 不直接操作 store，通过 emit 通信

## 文件变更清单

### 新增文件

1. `src/types/production-flow.ts`
   - 定义 `WareProductionFlow` 类型

2. `src/store/logic/calculateProductionFlows.ts`
   - 一阶段计算函数：产量 + autoIndustryModules（不含仓储/泊位）

3. `src/store/logic/calculateWareFlowDerived.ts`
   - 二阶段计算函数：分组 + 资金 + 仓储 + 运输 + autoInfrastructureModules

### 修改文件

1. `src/store/state/StationStateMap.ts`
   - StationState 新增字段：`productionFlows`, `autoInfrastructureModules`
   - StationState 移除字段：`groupedFlows`
   - recompute() 调用 calculateProductionFlows()

2. `src/store/logic/moduleDiffCalculator.ts`
   - calculateAutoFill() 移除仓储/泊位生成逻辑
   - 或拆分为独立函数

3. `src/store/logic/analyzeWareFlow.ts`
   - 可能拆分为两个函数：calculateProductionOnly + calculateDerived

4. `src/components/empire/composables/useStationWareFlowsModel.ts`
   - 导入 calculateWareFlowDerived()
   - watch 参数变化触发二阶段计算
   - emit updateAutoInfrastructureModules

5. `src/components/empire/StationWareFlowsDashboard.vue`
   - 接收 productionFlows 而非 groupedFlows
   - 或由 composable 处理转换

6. `src/components/empire/StationPlanningPanel.vue`
   - props 新增 autoInfrastructureModules
   - 合并显示 autoIndustryModules + autoInfrastructureModules

7. `src/store/useBlueprintProductionStore.ts`
   - 新增 autoInfrastructureModules computed
   - 新增 updateAutoInfrastructureModules action

8. `src/types/x4.ts`
   - StationState 接口变更

## 潜在风险

### 风险 1：Empire 聚合依赖 groupedFlowsForEmpire

**影响**：移除 state.groupedFlows 后，Empire 聚合如何获取数据？

**缓解**：保留 `groupedFlowsForEmpire`，但改为基于 `productionFlows` 在 Empire 层计算。

### 风险 2：测试兼容性

**影响**：现有测试依赖 groupedFlows 结构。

**缓解**：测试改为检查 productionFlows + Vue 层 groupedFlows。

### 风险 3：性能影响

**影响**：二阶段频繁 watch 可能导致性能问题。

**缓解**：使用 computed 替代部分 watch，或添加 debounce。