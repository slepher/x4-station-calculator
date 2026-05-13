# WareFlow Refactory - 需求文档

## 目标

将 WareFlow 计算拆分为两个阶段，一阶段在 Store 层计算产量数据（不含仓储/泊位），二阶段在 Vue 组件内计算完整 WareFlow（含分组、资金、仓储、运输）并生成基础设施模块（仓储/泊位）。

## 已确认方案（审核重点）

### 1. 一阶段：Store 层计算（产量计算）

**位置**：`StationStateMap.recompute()` → 调用 `src/store/logic/` 中的函数

**输入**：
- `plannedModules: SavedModule[]`
- `settings`：racePreference, sunlight, workforceAuto, considerWorkforceForAutoFill, lockedWares, warePriority

**计算内容**：
1. Phase 1: 工业模块补完（不含仓储/泊位）
2. Phase 2: 居住舱补完
3. 产量计算：`production/consumption/workforceConsumption/netRate`（不含体积流）

**输出到 state**：
- `autoIndustryModules: SavedModule[]`（生产模块 + 居住舱，不含仓储/泊位）
- `productionFlows: WareProductionFlow[]`（新数据类型，仅产量数据）

**触发方式**：
- 不是 watch，而是在 `plannedModules` 更新时直接调用
- 包括切换 tab 导致的 `plannedModules` 更新

### 2. 二阶段：Vue 组件内计算（完整 WareFlow）

**位置**：Vue composable → 调用 `src/store/logic/` 中的函数

**输入**：
- 一阶段输出：`productionFlows: WareProductionFlow[]` + `autoIndustryModules`
- `settings`：bufferHours (resource/primaryProduct/secondaryProduct), priceMultiplier (buy/sell), transportMinutes, transportShipCapacity
- `waresMap`, `modulesMap`

**计算内容**：
1. 仓储需求计算 → 生成 `autoInfrastructureModules`（仓储模块）
2. 泊位需求计算 → 生成 `autoInfrastructureModules`（泊位模块）
3. 分组逻辑：rateGroups, volumeGroups
4. 资金计算：unitPrice, netValue
5. 仓储规划：totalOccupiedCount, totalOccupiedVolume
6. 运输计算：transportDemand

**输出**：
- `groupedFlows: GroupedFlows`（完整 WareFlow 数据）
- `autoInfrastructureModules: SavedModule[]`（仓储 + 泊位）
- emit 更新事件 → store 更新 `state.autoInfrastructureModules`

**触发方式**：watch 上述参数变化

### 3. 数据结构设计

#### 3.1 新类型：WareProductionFlow（一阶段输出）

```typescript
export interface WareProductionFlow {
  // 核心标识（来自 X4Ware）
  wareId: string;
  orderIndex: number;
  tier: number;
  transportType: TransportType;
  unitVolume: number;

  // 价格数据（来自 X4Ware，供二阶段资金计算使用）
  minPrice: number;
  price: number;      // 平均价格
  maxPrice: number;

  // 数量流（一阶段计算）
  production: number;
  consumption: number;
  workforceConsumption: number;
  netRate: number;

  // 明细（一阶段计算基础字段）
  contributions: ModuleFlowAtom[];
}
```

**说明**：一阶段包含二阶段计算所需的所有静态数据（来自 waresMap），避免二阶段查 map。

#### 3.2 ModuleFlowAtom 字段分离

**一阶段计算**：
- `moduleId`: 模块ID
- `count`: 模块数量
- `type`: 'production' | 'consumption'
- `amount`: 贡献数量（有符号）
- `bonusPercent`: 效率加成百分比

**二阶段计算**：
- `volumeFlow`: amount * unitVolume
- `valueFlow`: amount * dynamicPrice
- `transportFlow`: abs(amount) * unitVolume

#### 3.2 StationState 新字段

```typescript
export interface StationState {
  // ...existing fields
  autoIndustryModules: SavedModule[];      // 生产模块 + 居住舱（不含仓储/泊位）
  autoInfrastructureModules: SavedModule[]; // 新增：仓储 + 泊位（二阶段写入）
  productionFlows: WareProductionFlow[];    // 新增：一阶段产量数据
  // groupedFlows 移除，由 Vue 组件计算
}
```

### 4. StationPlanningPanel 显示

**props 传入**：
- `autoIndustryModules`（一阶段生成）
- `autoInfrastructureModules`（二阶段生成）

**显示**：
- "tier_industry" 分组下显示合并列表：`autoIndustryModules + autoInfrastructureModules`

### 6. TransitHub 和 Empire 视图独立计算

**TransitHub 视图**：
- 输入：`productionFlows`（从 StationStateMap 获取）
- 独立调用 `calculateWareFlowDerived`
- 提供独立的 UI 滑动条：
  - 产品价格滑动条（buyMultiplier, sellMultiplier）
  - 产物缓冲时间滑动条（primaryProductBufferHours, secondaryProductBufferHours）
- **滑动条持久化**：保存到 StationState.settings（已存在的字段）

**Empire 视图**：
- 输入：各 station 的 `productionFlows`（从 StationStateMap 获取）
- 独立调用 `calculateWareFlowDerived`（聚合前先计算每个 station 的完整 WareFlow）
- 提供独立的 UI 滑动条：
  - 产品价格滑动条（全局）
- **滑动条不持久化**：仅组件内部临时状态，会话结束后丢失
- Empire 聚合基于完整的 WareFlow（含 netValue）

**设计要点**：
- Store 层仅保存一阶段数据（productionFlows, warePriorityLevels），不涉及二阶段参数
- TransitHub 的二阶段参数持久化到 StationState.settings（现有字段）
- Empire 的二阶段参数不持久化，仅在组件内部管理
- UI 层各自管理二阶段参数，触发独立计算
- 一次滑动条调整只影响当前视图，不触发其他视图重算

**强制规则**：所有计算逻辑函数放在 `src/store/logic/` 目录下，store 和 Vue 通过导入使用：

- 一阶段计算函数：`src/store/logic/calculateProductionFlows.ts`
- 二阶段计算函数：`src/store/logic/calculateWareFlowDerived.ts`
- 仓储/泊位生成函数：保持或从 `moduleDiffCalculator.ts` 中提取

## 边界

### In Scope

- WareFlow 计算拆分为两阶段
- 新数据类型 `WareProductionFlow`
- StationState 新增字段 `productionFlows`, `autoInfrastructureModules`
- StationState 移除 `groupedFlows`（改为 Vue 计算）
- StationPlanningPanel 显示合并后的 auto modules
- 计算逻辑函数放在 `src/store/logic/`

### Out of Scope

- Empire 视图的 WareFlow（`EmpireWareFlow`）- 本次仅处理 Station 级别
- 其他 store 或组件的修改
- 测试代码编写

## 验收标准（DoD）

1. **一阶段计算**：`StationStateMap.recompute()` 正确计算 `productionFlows` 和 `autoIndustryModules`（不含仓储/泊位）
2. **二阶段计算**：Vue composable 正确计算 `groupedFlows` 和 `autoInfrastructureModules`
3. **数据同步**：二阶段 emit 事件正确更新 `state.autoInfrastructureModules`
4. **UI 显示**：StationPlanningPanel 显示 `autoIndustryModules + autoInfrastructureModules`
5. **触发正确**：
   - 一阶段：`plannedModules` 更新时触发
   - 二阶段：watch bufferHours/priceMultiplier/transportMinutes 触发
6. **构建通过**：`npm run build` 无编译错误

## 未决项

无