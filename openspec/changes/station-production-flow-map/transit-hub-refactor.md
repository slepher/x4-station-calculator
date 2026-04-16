# Transit Hub Refactor

## Priority

本文件是 **最高优先级前置重构**。  
必须先完成本文件，再执行 [review2.md](/home/slepher/project/x4-station-calculator/worktrees/station-binding/openspec/changes/station-production-flow-map/review2.md) 的其余内容。

本文件不是讨论稿。  
本文件是直接施工说明。

---

## Purpose

当前 `transit hub` 在数据流上不是“特殊 station”，而是“第二套并行系统”：

- station 页走 `workbench + presenters + stationFlowMap`
- transit 页走 `sectorInternalData + sectorLinkCalc + transitHubViewModel + view 层 computed`
- station 的 plan/live 切换是 store 驱动
- transit 的 plan/live 切换现在仍混有 view 层临时拼装

这会直接导致：

- station 与 transit 的 mode 规则不一致
- station 与 transit 的数据接口不一致
- review2 里的接线项容易继续堆 view 层临时 computed
- agent 会不断在 “sector 数据” 和 “station 数据” 之间做二次设计

本重构的唯一目标是：

- **把 transit hub 收敛成一种特殊 station 数据源**
- **让 transit 与 normal station 使用同一种 source contract**
- **让 plan/live 切换在 store/facade 层统一完成**
- **让 view 层只做展示切换，不再重新设计数据流**
- **让 `autoInfrastructureModules` 在 `ProductionFlowMap` 聚合阶段完成，而不是 facade/组件临时算**

---

## Hard Decisions

以下结论已经定稿，不允许 agent 再改路线。

### D1. Transit hub 不是独立接口体系

`transit hub` 继续保留自己的页面组件：

- `TransitHubCenterDashboard`
- `TransitHubBuildPanel`
- `TransitHubMaterialsPanel`

但其上游数据接口必须与 normal station 一致。  
一致的含义是：

- 都由 store 提供 `planning source`
- 都由 store 提供 `live source`
- 都由 store 提供 `active source`
- view 层只按 `mode` 取 source

### D2. 不允许继续在 view 层拼 transit 数据源

以下模式必须删除：

- view 层自己组合 `getSectorInternalData + getSectorLinkCalc`
- view 层自己决定 planning/live 数据源结构
- view 层自己决定何时 fallback

允许保留的仅有：

- `computed(() => activeSource.xxx)` 这种简单读值

### D3. Transit 与 station 必须共用同一个 source contract

必须新增一个统一 contract。  
文件固定为：

- [src/types/production-panel-source.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/production-panel-source.ts)

必须定义以下类型：

```ts
import type {
  SavedModule,
  EmpireGroupedFlows,
  SupplyStorageFlow,
  TransitHubStorageModulePlan
} from '@/types/x4'
import type { WareProductionFlow } from '@/types/production-flow'
import type { SolveMultiWareByLinkOutput } from '@/store/logic/sectorLinkFlow'

export interface ProductionPanelModeSource {
  modules: SavedModule[]
  buildingModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  localGroupedFlows: EmpireGroupedFlows | null
  solverOutput: SolveMultiWareByLinkOutput | null
  supplyStorageFlows: SupplyStorageFlow[]
  storageModulePlans: TransitHubStorageModulePlan[]
}

export interface ProductionPanelSource {
  id: string
  entityType: 'station' | 'transit'
  planning: ProductionPanelModeSource
  live: ProductionPanelModeSource
  liveVisualState: 'planning' | 'live'
  canUseLiveModules: boolean
}
```

说明：

- `station` 与 `transit` 都返回这个结构
- `station` 不用的字段允许为空数组 / `null`
- `transit` 不用的字段也必须占位，不允许缺字段
- `liveVisualState` 专门处理 `transit no archive -> 按钮颜色保持 planning`
- `localGroupedFlows` 固定使用 `EmpireGroupedFlows`
- `TransitHubGroupedFlows` 只允许作为 center dashboard / transit 纯函数内部派生结果
- 不允许把 source contract 提前提升为 `TransitHubGroupedFlows`

### D4. Source contract 是内部数据总线

本 contract 只服务：

- `useLiveProductionStore`
- `LiveProductionWorkbenchView.vue`
- 后续 `review2` 里的 station/transit 接线

不要把它塞进 `ProductionWorkbenchStoreContract`。  
`ProductionWorkbenchStoreContract` 继续服务 presenters。  
本次重构先统一 `LiveProductionWorkbenchView` 的 station/transit source。

### D4.1 UI 层不直接使用 facade / source

`ProductionPanelSource` 只允许在 store / presenter 内部使用。  
禁止以下路径：

- `LiveProductionWorkbenchView.vue` 直接读 facade
- `LiveProductionWorkbenchView.vue` 直接读 source contract
- transit 组件直接接 `facade.get...(...)` 返回值

UI 层固定改为和 station 一样的 presenter 模式：

- `useTransitPlanningPresenter(...)`
- `useTransitWareflowPresenter(...)`
- `useTransitDashboardPresenter(...)`

所有 transit 组件只能接 presenter 输出的 `props` / `emits`。

### D5. Transit planning/live 语义写死

#### Transit planning

- `modules = sectorInternalData.autoInfrastructureModules`
- `buildingModules = []`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = sectorInternalData.autoInfrastructureModules`
- `productionFlows = []`
- `localGroupedFlows = planning facade sector grouped flows`
- `solverOutput = planning facade sector solver output`
- `supplyStorageFlows = sectorInternalData.supplyStorageFlows`
- `storageModulePlans = sectorInternalData.storageModulePlans`

说明：

- planning transit 的“build 所需模块”主语义就是 `autoInfrastructureModules`
- 不再以 `TransitHubCenterDashboard` 内部 `storageModulePlans` 作为主数据
- `TransitHubCenterDashboard` 只允许基于同一份 sector 最终结果做价格与分组展示
- `TransitHubCenterDashboard` 不再参与 `autoInfrastructureModules` 主计算

#### Transit live with archive

- `modules = archiveModules`
- `buildingModules = buildingModules`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = []`
- `productionFlows = []`
- `localGroupedFlows = live facade sector grouped flows`
- `solverOutput = live facade sector solver output`
- `supplyStorageFlows = []`
- `storageModulePlans = []`

#### Transit live without archive

- `modules = planning.modules`
- `buildingModules = []`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = planning.autoInfrastructureModules`
- `productionFlows = []`
- `localGroupedFlows = live facade sector grouped flows`
- `solverOutput = live facade sector solver output`
- `supplyStorageFlows = planning.supplyStorageFlows`
- `storageModulePlans = []`
- `liveVisualState = 'planning'`

### D6. Station planning/live 也必须落到同一个 contract

必须新增 station 版本 source builder。

#### Station planning

- `modules = activeStation.modules`
- `buildingModules = []`
- `autoIndustryModules = planning cache.autoIndustryModules`
- `autoHabitationModules = planning cache.autoHabitationModules`
- `autoInfrastructureModules = planning cache.autoInfrastructureModules`
- `productionFlows = planning station flows`
- 其余 transit 专用字段置空

#### Station live

- `modules = archiveModules`
- `buildingModules = buildingModules`
- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = []`
- `productionFlows = live station flows`
- 其余 transit 专用字段置空

---

## Current Problems To Remove

以下旧模式必须在本重构中清理：

1. [LiveProductionWorkbenchView.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue) 中手工维护：
   - `planningTransitHubInput`
   - `liveTransitHubInput`
   - `activeTransitHubInput`
   - `planningTransitStorageModulePlans`
   - `liveTransitStorageModulePlans`
   - `activeTransitStorageModulePlans`
2. store 只提供 station active data，但 transit 仍靠 view 拼 input
3. `TransitHubCenterDashboard` 内部推导结果与 planning build/materials 主数据纠缠
4. transit planning/live 的 fallback 规则没有固定归属地
5. `liveVisualState` 没有统一来源

---

## Required Refactor Steps

## 1. 新增统一 source contract

新增文件：

- [src/types/production-panel-source.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/production-panel-source.ts)

内容按 `D3` 原样实现。  
不得自行删字段。

---

## 2. `SectorInternalData` 正式承载 sector 基础设施模块

修改文件：

- [src/types/x4.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/x4.ts)
- [src/store/logic/empireFlowFacade.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/empireFlowFacade.ts)

### 2.1 类型必须补齐

`SectorInternalData` 必须改为：

```ts
export interface SectorInternalData {
  sectorId: string
  planning: SupplyPlanningInput
  localGroupedFlows: EmpireGroupedFlows
  supplyStorageFlows: SupplyStorageFlow[]
  storageModulePlans: TransitHubStorageModulePlan[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
}
```

### 2.2 计算位置写死

`autoInfrastructureModules` 不得在 facade 内部直接计算。  
必须改为在 [src/store/state/StationProductionFlowMap.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/state/StationProductionFlowMap.ts) 的聚合阶段完成。

职责分工写死：

- `ProductionFlowMap`
  - 负责基础设施主计算
  - 负责 station cache
  - 负责 sector aggregation cache
- `empireFlowFacade`
  - 只读取聚合结果
  - 组装 `SectorInternalData`
- `TransitHubCenterDashboard`
  - 只基于同一份 sector 最终结果做价格 / 分组展示
  - 不参与 build 主计算

### 2.2.1 统一基础设施计算函数

`StationProductionFlowMap` 必须抽出统一 helper。  
固定形态：

```ts
computeInfrastructureModulesFromFlows(input: {
  productionFlows: WareProductionFlow[]
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  settings: Pick<
    StationSettings,
    | 'racePreference'
    | 'resourceBufferHours'
    | 'primaryProductBufferHours'
    | 'secondaryProductBufferHours'
    | 'transportShipCapacity'
  >
  warePriorityLevels: Record<string, number>
  deps: ProductionFlowComputeDeps
}): SavedModule[]
```

使用规则写死：

- station `compute(...)` 调这个 helper
- sector 聚合也调这个 helper
- 不允许再有第二套 sector 专用基础设施算法

### 2.2.2 sector 输入写死

sector 级 `autoInfrastructureModules` 的输入必须是“最终 sector flow 结果”。  
也就是：

1. 先得到 `localGroupedFlows`
2. 再应用 `sectorLink` 结果
3. 转成最终 `WareProductionFlow[]`
4. 再调用 `computeInfrastructureModulesFromFlows(...)`

station 与 sector 唯一差异：

- station：输入是 station 原始 `productionFlows`
- sector：输入是经过 `sectorLink` 处理后的最终聚合 `productionFlows`

参数类型必须一致。

### 2.2.3 `storageModulePlans` 的位置

`storageModulePlans` 不是主计算源。  
它必须是同一份最终 sector 结果的注解输出。

固定顺序：

1. `FlowMap` 先得到最终 sector `productionFlows`
2. `FlowMap` 先算出 `autoInfrastructureModules`
3. `TransitHubCenterDashboard` 再使用同一份结果，通过现有 composable 计算：
   - price
   - grouped flows
   - module annotations

因此：

- `autoInfrastructureModules` 是主结果
- `storageModulePlans` 是展示注解结果
- 不允许反过来用 `storageModulePlans` 推导 `autoInfrastructureModules`

### 2.3 sector 固定规则

在 `sectorInternalDataMap` 中：

- `autoIndustryModules = []`
- `autoHabitationModules = []`
- `autoInfrastructureModules = flowMap.getSectorAutoInfrastructureModules(sectorId)`
- `storageModulePlans = 由同一份最终 sector 结果生成的 module annotations`

### 2.4 `FlowMap` 必须新增 sector 聚合 cache

固定新增类型：

```ts
export interface SectorFlowAggregationCache {
  sectorId: string
  productionFlows: WareProductionFlow[]
  autoInfrastructureModules: SavedModule[]
}
```

并新增：

```ts
getSectorAggregation(sectorId: string): SectorFlowAggregationCache | null
getSectorAutoInfrastructureModules(sectorId: string): SavedModule[]
```

不要把这套 cache 塞回 facade。  
这是 `FlowMap` 的职责。

### 2.5 `SupplyStorageFlow` / `TransitHubStorageModulePlan` / `SavedModule[]` 的分工

分工写死：

- `SupplyStorageFlow[]`
  - ware 级存储需求
  - 给 storage/materials 分析使用
- `SavedModule[] autoInfrastructureModules`
  - 主计算结果
  - 由 `FlowMap` 直接产出
- `TransitHubStorageModulePlan[]`
  - module 级 build 注解
  - 基于同一份最终 sector 结果生成
  - 给 planning build 区显示 `capacity / required / type`

三者不得互相替代。

---

## 3. `createEmpireFlowFacade` 必须新增 transit source 读取口

修改文件：

- [src/store/logic/empireFlowFacade.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/empireFlowFacade.ts)

### 3.1 必须保留现有方法

保留：

- `getSectorInternalData`
- `getSectorLinkCalc`

### 3.2 必须新增 source builder 方法

新增：

```ts
getTransitPanelSource(input: {
  sectorId: string | null
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
  hasArchiveTradeStation: boolean
}): ProductionPanelSource
```

规则：

- planning 部分只读当前 facade 对应的 planning 聚合结果
- live 部分只读当前 facade 对应的 live 聚合结果
- 不允许该方法内部自己决定用 planning facade 还是 live facade
- 哪个 facade 调它，它就只读哪个 facade 的 sector 数据

### 3.3 station source 也必须统一

新增：

```ts
getStationPanelSource(input: {
  stationId: string | null
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
}): ProductionPanelSource
```

说明：

- `station facade` 与 `transit facade` 不要再分别搞第二套结构
- 都返回 `ProductionPanelSource`

### 3.3.1 facade 只读 `FlowMap` 聚合结果

facade 在组装 `SectorInternalData` 时，必须直接从 `FlowMap` 读取：

- `getSectorFlows(sectorId)`
- `getSectorAggregation(sectorId)`
- `getSectorAutoInfrastructureModules(sectorId)`

不得在 facade 内部重新计算 `autoInfrastructureModules`。

### 3.4 facade 数量写死

必须是两个独立 facade 实例：

- `planningFlowFacade`
- `liveFlowFacade`

不要做成“单一 facade 同时提供 planning/live 两套结果”的超级 facade。  
原因：

- facade 依赖 `flowMap`
- planning/live `flowMap` 不同
- planning/live `sourceView` 也不同
- 单 facade 双语义只会把分支判断重新塞回 facade

### 3.5 live facade 的 deps 写死

`liveFlowFacade` 必须使用：

- `flowMap = liveFlowMap`
- `sourceView = liveSourceView`
- `productionSource = ref('save-binding')`
- `activeBinding = activeBinding`
- `activeEmpire = activeEmpire`
- `modulesMap = modulesMap`
- `waresMap = waresMap`

其中：

- `liveSourceView` 必须由 store 先构造
- `liveSourceView.productionStations` 必须是 archive 覆盖到的 live stations
- `liveSourceView.productionSectors / productionSectorLinks` 必须沿用当前 binding scope
- facade 不允许直接读取 `playerStationRecords`

### 3.6 `playerStationRecords` 归属写死

`playerStationRecords` 仍归 `useLiveProductionStore`。  
store 负责基于它构造：

- `liveSourceView`
- `archiveModules`
- `buildingModules`
- `hasArchiveTradeStation`

facade 只消费构造后的 `sourceView`。

### 3.7 presenter 才是 UI 对接层

不得让 view 直接消费 `getStationPanelSource / getTransitPanelSource`。  
这些 source getter 只给 presenter 使用。

必须新增文件：

- [src/components/empire/presenters/useTransitPlanningPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitPlanningPresenter.ts)
- [src/components/empire/presenters/useTransitWareflowPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitWareflowPresenter.ts)
- [src/components/empire/presenters/useTransitDashboardPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitDashboardPresenter.ts)

要求：

- presenter 文件结构必须与 station presenters 一致
- 都返回：

```ts
{
  props: ...,
  emits: ...
}
```

- `LiveProductionWorkbenchView.vue` 只消费 presenter

---

## 4. `useLiveProductionStore` 负责组装双 source，而不是 view 层

修改文件：

- [src/store/useLiveProductionStore.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts)

### 4.1 必须保留双 facade

store 内必须存在：

- `planningFlowFacade`
- `liveFlowFacade`

并且必须新增：

- `planningSourceView`
- `liveSourceView`

### 4.1.1 store 必须触发 sector 聚合更新

`FlowMap` 负责算。  
`useLiveProductionStore` 负责在正确时机触发：

- planning station flow 更新后，更新 planning sector aggregation
- live archive flow 更新后，更新 live sector aggregation
- transit settings 变化后，若影响基础设施计算，必须重跑对应 sector aggregation

### 4.2 必须新增以下 getters

新增：

```ts
getPlanningStationPanelSource(stationId: string | null): ProductionPanelSource
getLiveStationPanelSource(stationId: string | null): ProductionPanelSource
getActiveStationPanelSource(stationId: string | null): ProductionPanelSource

getPlanningTransitPanelSource(sectorId: string | null): ProductionPanelSource
getLiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
getActiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
```

这些 getter 只允许给 presenter 使用。  
不得在 view 层直接消费。

### 4.3 active 规则写死

`getActiveStationPanelSource`：

- `mode = planning` -> 返回 planning source
- `mode = live` -> 返回 live source

`getActiveTransitPanelSource`：

- `mode = planning` -> 返回 planning source
- `mode = live` -> 返回 live source
- `liveVisualState` 不在 view 层判断
- 必须由 source 自身携带

### 4.3.1 transit source 的具体拼装规则

`getPlanningTransitPanelSource(sectorId)`：

- 调 `planningFlowFacade.getTransitPanelSource(...)`
- `archiveModules / buildingModules / hasArchiveTradeStation` 从 `transitHubContext` 传入

`getLiveTransitPanelSource(sectorId)`：

- 调 `liveFlowFacade.getTransitPanelSource(...)`
- `archiveModules / buildingModules / hasArchiveTradeStation` 从 `transitHubContext` 传入

`getActiveTransitPanelSource(sectorId)`：

- `mode = planning` -> 返回 planning source
- `mode = live` -> 返回 live source

说明：

- source 的 `planning/live` 字段都必须完整
- active getter 只负责选 source 实例，不负责改写字段

### 4.4 transit context 只保留 archive 判定与标题类信息

`transitHubContext` 继续保留，但职责缩窄为：

- `hasArchiveTradeStation`
- `archiveModules`
- `buildingModules`
- toolbar 标题与名字类数据

禁止继续在 `transitHubContext` 内加入 grouped flows / solverOutput。

### 4.5 旧 getter 的处理

以下旧 getter 先保留，供过渡使用：

- `getSectorInternalData`
- `getLiveSectorInternalData`
- `getSectorLinkCalc`
- `getLiveSectorLinkCalc`

但在 `LiveProductionWorkbenchView.vue` 中必须停止直接消费它们。

### 4.6 `productionFlows` 对 transit 的语义写死

`productionFlows` 字段只保留 station 语义：

- station: 当前站 `WareProductionFlow[]`
- transit: 恒为 `[]`

不要把 sector grouped flows 塞进 `productionFlows`。  
transit 已经有专用字段：

- `localGroupedFlows`
- `solverOutput`

---

## 5. `LiveProductionWorkbenchView.vue` 必须只读 presenter

修改文件：

- [src/components/empire/LiveProductionWorkbenchView.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue)

### 5.1 必删 computed

必须删除：

- `planningTransitHubInput`
- `liveTransitHubInput`
- `activeTransitHubInput`
- `planningTransitStorageModulePlans`
- `liveTransitStorageModulePlans`
- `activeTransitStorageModulePlans`
- 所有直接读取 `get...PanelSource(...)` 的 computed

### 5.2 必增 presenter

新增：

```ts
const transitPlanningPresenter = useTransitPlanningPresenter(liveStore)
const transitWareflowPresenter = useTransitWareflowPresenter(liveStore)
const transitDashboardPresenter = useTransitDashboardPresenter(liveStore)
```

规则：

- station 继续使用现有：
  - `useProductionPlanningPresenter`
  - `useProductionWareflowPresenter`
  - `useProductionDashboardPresenter`
- transit 改用对应 transit presenters
- view 层不再自行翻译 store/source 数据

### 5.2.1 transit presenters 的 props 形状写死

`useTransitPlanningPresenter`：

```ts
{
  props: {
    mode: ComputedRef<'planning' | 'live'>
    visualMode: ComputedRef<'planning' | 'live'>
    hasArchiveTradeStation: ComputedRef<boolean>
    plannedModules: ComputedRef<SavedModule[]>
    modulePlans: ComputedRef<TransitHubStorageModulePlan[]>
    liveModules: ComputedRef<SavedModule[]>
    liveBuildingModules: ComputedRef<SavedModule[]>
  },
  emits: {}
}
```

`useTransitWareflowPresenter`：

```ts
{
  props: {
    sectorId: ComputedRef<string | null>
    localGroupedFlows: ComputedRef<EmpireGroupedFlows | null>
    solverOutput: ComputedRef<SolveMultiWareByLinkOutput | null>
    mode: ComputedRef<'planning' | 'live'>
    visualMode: ComputedRef<'planning' | 'live'>
  },
  emits: {
    updateBuyMultiplier(value: number): void
    updateSellMultiplier(value: number): void
    updateProductBufferHours(value: number): void
  }
}
```

`useTransitDashboardPresenter`：

```ts
{
  props: {
    mode: ComputedRef<'planning' | 'live'>
    hasArchiveTradeStation: ComputedRef<boolean>
    plannedModules: ComputedRef<SavedModule[]>
    liveModules: ComputedRef<SavedModule[]>
    liveBuildingModules: ComputedRef<SavedModule[]>
    storageFlows: ComputedRef<SupplyStorageFlow[]>
  },
  emits: {}
}
```

要求：

- `props` 命名必须稳定
- `LiveProductionWorkbenchView.vue` 不允许再造同义 computed

### 5.3 Transit 三块区域改为只读 presenter props

#### CenterDashboard

传值必须来自 `transitWareflowPresenter.props`。  
不要再在 view 层拼 planning/live input。  
不要再在 view 层直接读 source。

要求：

- `CenterDashboard` 只使用 presenter 提供的数据做价格和分组展示
- `CenterDashboard` 继续复用现有 composable
- `CenterDashboard` 不再承担 `autoInfrastructureModules` 主计算职责

#### Build 区

规则固定：

- `mode = planning` -> `TransitHubBuildPanel`
- `mode = live && hasArchiveTradeStation` -> `ArchiveModuleList`
- `mode = live && !hasArchiveTradeStation` -> `TransitHubBuildPanel`

其中：

- `TransitHubBuildPanel` 数据源固定来自 `transitPlanningPresenter.props`
- `ArchiveModuleList` 数据源固定来自 `transitPlanningPresenter.props.liveModules/liveBuildingModules`

说明：

- transit planning build 主语义是“计划要补的基础设施模块”
- transit live build 主语义是“存档中真实已建 + 在建模块”

#### Materials 区

规则固定：

- `mode = planning` -> 分析 `transitDashboardPresenter.props.plannedModules`
- `mode = live && hasArchiveTradeStation` -> 分析 `transitDashboardPresenter.props.liveModules + transitDashboardPresenter.props.liveBuildingModules`
- `mode = live && !hasArchiveTradeStation` -> 分析 `transitDashboardPresenter.props.plannedModules`

### 5.4 Toolbar 颜色状态

`LiveTransitToolbar` 必须接收：

- `mode`
- `canToggle = true`
- `hasArchiveTradeStation`
- `visualMode = transitPlanningPresenter.props.visualMode`

不要再在 toolbar 组件内部自己推导 `visualState`。

---

## 6. `LiveTransitToolbar.vue` 只做展示，不做规则判断

修改文件：

- [src/components/empire/context_toolbar/LiveTransitToolbar.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/context_toolbar/LiveTransitToolbar.vue)

### 必改

props 改为直接接：

```ts
mode?: 'live' | 'planning'
visualMode?: 'live' | 'planning'
canToggle?: boolean
hasArchiveTradeStation?: boolean
```

颜色规则固定：

- `visualMode = planning` -> planning 色
- `visualMode = live` -> live 色

组件内部不得再根据 `hasArchiveTradeStation` 推颜色。  
颜色规则由 source 决定。

---

## 7. `TransitHubBuildPanel` 只承接 planning build

修改文件：

- [src/components/empire/transit-hub/TransitHubBuildPanel.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/transit-hub/TransitHubBuildPanel.vue)

### 最终职责写死

- 只显示 planning transit 的 `autoInfrastructureModules`
- 不再承担 live 显示

### 输入改造

组件 props 必须改为和 presenter 对齐。  
固定为：

```ts
modules: SavedModule[]
modulePlans?: TransitHubStorageModulePlan[]
```

显示规则写死：

- 主循环以 `modules` 为准
- `modulePlans` 只负责补充显示：
  - `capacity`
  - `required`
  - `type`
- 若某模块找不到注解，允许只显示基础模块信息

但主输入必须是 `SavedModule[]`。  
原因：

- station 与 transit 接口必须统一为 `modules`
- 但 planning build 现有 module 级信息不得丢失

---

## 8. `ArchiveModuleList` 负责 live transit build 展示

修改文件：

- [src/components/empire/ArchiveModuleList.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/ArchiveModuleList.vue)

### 必做

确认该组件支持：

- `modules`
- `buildingModules`

若当前缺字段，则补齐。  
不得把 live transit build 再塞回 `TransitHubBuildPanel`。

---

## 9. review2 的执行顺序被本文件改写

在执行 [review2.md](/home/slepher/project/x4-station-calculator/worktrees/station-binding/openspec/changes/station-production-flow-map/review2.md) 时，顺序必须改为：

1. 先完成本文件全部内容
2. 再做 review2 中的双 `FlowMap` / 双 facade 接线补全
3. 再做 station 页 live source 补全
4. 再做 transit hub live source 切换
5. 最后补测试

说明：

- 本文件解决的是“接口地基”
- review2 解决的是“功能接线”
- 顺序不能反

---

## Acceptance

完成本文件后，必须满足：

1. `LiveProductionWorkbenchView.vue` 不再自行拼 transit planning/live input
2. station 与 transit 都能从 store 拿到同结构 `ProductionPanelSource`
3. transit build 区 planning/live 主数据语义固定：
   - planning = `autoInfrastructureModules`
   - live = `archiveModules + buildingModules`
4. transit planning build 的 module 级信息未丢失：
   - `capacity`
   - `required`
   - `type`
5. `liveVisualState` 不再由 toolbar 组件自行推导
6. `SectorInternalData` 已正式承载 `autoInfrastructureModules`
7. `TransitHubBuildPanel` 已从 `storageModulePlans` 主输入迁移到 `modules` 主输入

---

## Forbidden Routes

禁止以下做法：

1. 不要新增第三套 transit 专用 store
2. 不要把 `TransitHubCenterDashboard` 变成数据总线
3. 不要用两个 `TransitHubCenterDashboard` 实例做双 ref 切换
4. 不要继续在 view 层自己 `computeTransitHubGrouping(...)` 作为主数据源
5. 不要让 `TransitHubBuildPanel` 同时承担 planning/live 双语义
6. 不要把 `ProductionWorkbenchStoreContract` 改成 transit/station 全量通用巨型接口
7. 不要把 `sector autoInfrastructureModules` 的计算留在组件层

---

## Tasks

以下任务必须按顺序执行。  
不得跳步。  
每完成一项，再进入下一项。

### T1. 扩类型与 source contract

修改文件：

- [src/types/production-panel-source.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/production-panel-source.ts)
- [src/types/x4.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/x4.ts)

必须完成：

1. 新增 `ProductionPanelModeSource`
2. 新增 `ProductionPanelSource`
3. 给 `SectorInternalData` 补字段：
   - `storageModulePlans`
   - `autoIndustryModules`
   - `autoHabitationModules`
   - `autoInfrastructureModules`
4. 保证 `localGroupedFlows` 类型固定为 `EmpireGroupedFlows`

完成标准：

- 类型文件可编译
- 没有临时 `any`

### T2. 重构 `StationProductionFlowMap`，加入 sector 聚合 cache

修改文件：

- [src/store/state/StationProductionFlowMap.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/state/StationProductionFlowMap.ts)

必须完成：

1. 抽出统一 helper：
   - `computeInfrastructureModulesFromFlows(...)`
2. station `compute(...)` 改为调用该 helper
3. 新增 `SectorFlowAggregationCache`
4. 新增类成员：
   - `sectorAggregationCache`
5. 新增 getter：
   - `getSectorAggregation(sectorId)`
   - `getSectorAutoInfrastructureModules(sectorId)`
6. 扩展 sector 聚合更新逻辑：
   - 能接收 sector 最终 `WareProductionFlow[]`
   - 计算 sector `autoInfrastructureModules`
7. 保证 station / sector 共用同一基础设施计算 helper

完成标准：

- station 原有行为不回归
- sector 级 `autoInfrastructureModules` 可从 `FlowMap` 直接读到

### T3. 抽出 transit 结果注解 helper

修改文件：

- [src/store/logic/transitHubViewModel.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/transitHubViewModel.ts)

必须完成：

1. 把“价格/分组/module annotation”相关纯逻辑整理为可复用 helper
2. 保留 `buildTransitHubViewModel(...)`
3. 保证 helper 可以基于同一份 sector 最终结果生成：
   - grouped flows 展示结果
   - `storageModulePlans`

要求：

- 不得再让 `buildTransitHubViewModel(...)` 成为基础设施主计算入口
- 它现在只能消费最终结果，做展示级派生

完成标准：

- `TransitHubCenterDashboard` 仍能复用这套逻辑
- `storageModulePlans` 仍能生成

### T4. 重构 `empireFlowFacade` 为只读装配层

修改文件：

- [src/store/logic/empireFlowFacade.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/logic/empireFlowFacade.ts)

必须完成：

1. 删除 facade 内直接计算 sector `autoInfrastructureModules` 的路径
2. `sectorInternalDataMap` 改为直接读取 `FlowMap`：
   - `getSectorFlows`
   - `getSectorAggregation`
   - `getSectorAutoInfrastructureModules`
3. 同一份 sector 最终结果生成：
   - `storageModulePlans`
   - `supplyStorageFlows`
4. 保留：
   - `getSectorInternalData`
   - `getSectorLinkCalc`
5. 新增：
   - `getStationPanelSource(...)`
   - `getTransitPanelSource(...)`

要求：

- facade 只装配，不主算
- facade 不直接读 `playerStationRecords`

完成标准：

- `SectorInternalData` 数据完整
- `autoInfrastructureModules` 来源明确是 `FlowMap`

### T5. 在 `useLiveProductionStore` 中建立双 sourceView + 双 facade

修改文件：

- [src/store/useLiveProductionStore.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts)

必须完成：

1. 新增：
   - `planningSourceView`
   - `liveSourceView`
2. 保留并理顺：
   - `planningFlowFacade`
   - `liveFlowFacade`
3. 由 store 基于 `playerStationRecords` 构造：
   - `liveSourceView`
   - `archiveModules`
   - `buildingModules`
   - `hasArchiveTradeStation`
4. 新增 getters：
   - `getPlanningStationPanelSource`
   - `getLiveStationPanelSource`
   - `getActiveStationPanelSource`
   - `getPlanningTransitPanelSource`
   - `getLiveTransitPanelSource`
   - `getActiveTransitPanelSource`
5. 增加聚合更新触发：
   - planning station 变更时更新 planning sector aggregation
   - live archive 变更时更新 live sector aggregation
   - transit settings 变更时重跑相关 sector aggregation

要求：

- source getter 只给 presenter 用
- view 不得直接读这些 getter

完成标准：

- store 能稳定提供 station/transit 的 planning/live source

### T6. 新增 transit presenters

新增文件：

- [src/components/empire/presenters/useTransitPlanningPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitPlanningPresenter.ts)
- [src/components/empire/presenters/useTransitWareflowPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitWareflowPresenter.ts)
- [src/components/empire/presenters/useTransitDashboardPresenter.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/presenters/useTransitDashboardPresenter.ts)

必须完成：

1. presenter 结构与 station presenters 对齐
2. `useTransitPlanningPresenter` 输出：
   - `mode`
   - `visualMode`
   - `hasArchiveTradeStation`
   - `plannedModules`
   - `modulePlans`
   - `liveModules`
   - `liveBuildingModules`
3. `useTransitWareflowPresenter` 输出：
   - `sectorId`
   - `localGroupedFlows`
   - `solverOutput`
   - `mode`
   - `visualMode`
4. `useTransitDashboardPresenter` 输出：
   - `mode`
   - `hasArchiveTradeStation`
   - `plannedModules`
   - `liveModules`
   - `liveBuildingModules`
   - `storageFlows`

完成标准：

- presenter props 命名稳定
- 不再需要 view 层自造同义 computed

### T7. 改 `LiveTransitToolbar` 为纯展示组件

修改文件：

- [src/components/empire/context_toolbar/LiveTransitToolbar.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/context_toolbar/LiveTransitToolbar.vue)

必须完成：

1. props 改为直接接：
   - `mode`
   - `visualMode`
   - `canToggle`
   - `hasArchiveTradeStation`
2. 颜色只看 `visualMode`
3. 删除内部基于 archive 判定颜色的逻辑

完成标准：

- toolbar 只渲染，不裁决规则

### T8. 改 `TransitHubBuildPanel` props 对齐 station 风格

修改文件：

- [src/components/empire/transit-hub/TransitHubBuildPanel.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/transit-hub/TransitHubBuildPanel.vue)

必须完成：

1. 主输入改为：
   - `modules: SavedModule[]`
2. 保留注解输入：
   - `modulePlans?: TransitHubStorageModulePlan[]`
3. 主循环基于 `modules`
4. 从 `modulePlans` 补充显示：
   - `capacity`
   - `required`
   - `type`

完成标准：

- planning build 显示不丢 module 级信息
- 组件不承担 live 语义

### T9. 确认 `ArchiveModuleList` 满足 live transit build

修改文件：

- [src/components/empire/ArchiveModuleList.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/ArchiveModuleList.vue)

必须完成：

1. 确认支持：
   - `modules`
   - `buildingModules`
2. 若缺字段则补齐

完成标准：

- 可直接用于 transit live build 区

### T10. 改 `LiveProductionWorkbenchView.vue` 为 presenter 驱动

修改文件：

- [src/components/empire/LiveProductionWorkbenchView.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue)

必须完成：

1. 删除 transit 相关手工 computed：
   - `planningTransitHubInput`
   - `liveTransitHubInput`
   - `activeTransitHubInput`
   - `planningTransitStorageModulePlans`
   - `liveTransitStorageModulePlans`
   - `activeTransitStorageModulePlans`
2. 删除所有直接读 source getter 的 transit computed
3. 改为使用：
   - `useTransitPlanningPresenter`
   - `useTransitWareflowPresenter`
   - `useTransitDashboardPresenter`
4. `TransitHubCenterDashboard` 只吃 wareflow presenter props
5. `TransitHubBuildPanel` / `ArchiveModuleList` 按 presenter props 切换
6. `TransitHubMaterialsPanel` 按 dashboard presenter props 切换
7. `LiveTransitToolbar` 吃 presenter 提供的 `visualMode`

完成标准：

- view 层不再拼 transit 数据源
- view 层只消费 presenter

### T11. 验证前置重构完成

必须完成检查：

1. station / transit 都能通过 presenter 拿数据
2. transit planning build 主数据 = `autoInfrastructureModules`
3. transit live build 主数据 = `archiveModules + buildingModules`
4. `autoInfrastructureModules` 来源 = `FlowMap`
5. `TransitHubCenterDashboard` 只做展示派生
6. toolbar 颜色由 presenter/source 决定，不由 toolbar 内部判断

只有 T11 完成后，才允许进入 [review2.md](/home/slepher/project/x4-station-calculator/worktrees/station-binding/openspec/changes/station-production-flow-map/review2.md)。

---

## Clarifications

以下疑问已经定稿。  
agent 不得再自行发挥。

### C1. `autoInfrastructureModules` 与 `storageModulePlans` 的关系

前提写死：

- [TransitHubBuildPanel.vue](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/transit-hub/TransitHubBuildPanel.vue) 必须改造成“只接收 `SavedModule[]` 并显示”的简单组件
- `TransitHubBuildPanel` 不负责计算
- `TransitHubBuildPanel` 不要求显示 `capacity / required / type`

因此结论：

- transit planning 的主数据就是 `autoInfrastructureModules: SavedModule[]`
- `storageModulePlans` 不再是 build panel 的输入
- `storageModulePlans` 只作为其它展示/调试/过渡数据保留
- 若 `modules` 中某项在 `modulePlans` 中找不到对应注解，不算问题
- 因为 build panel 已不再依赖这些注解字段

也就是说：

- `modules` 与 `modulePlans` 不需要建立强一致一一映射 contract
- build panel 以 `modules` 为唯一可信输入

### C2. station 基础设施计算与 transit 存储模块计算的统一方式

统一原则写死：

- 主计算结果统一为 `SavedModule[] autoInfrastructureModules`
- station 与 sector 都使用同一套基础设施计算 helper
- helper 的输入统一为 `WareProductionFlow[]`

因此：

- station 侧：直接得到 `SavedModule[]`
- transit planning 侧：也直接得到 `SavedModule[]`

`TransitHubStorageModulePlan[]` 的地位降级为：

- 可选展示注解
- 不参与主数据流
- 不再决定 build panel 展示

结论：

- 不需要为了 transit 再设计一套“主输出 = TransitHubStorageModulePlan[]”的算法
- 若仍需要 `TransitHubStorageModulePlan[]`，必须由同一份最终结果做派生
- 但该派生不进入主接口合同

### C3. `SupplyStorageFlow[]` 的归属

`SupplyStorageFlow[]` 不属于 build 主计算结果。  
它属于 sector 展示/分析数据。

归属写死：

- `autoInfrastructureModules`
  - 由 `FlowMap` 负责
  - 属于主计算结果
- `SupplyStorageFlow[]`
  - 由 facade 负责装配
  - 属于 `SectorInternalData` 的展示/分析字段
- `TransitHubCenterDashboard`
  - 只消费这些结果
  - 不主算

因此：

- `SupplyStorageFlow[]` 不需要挪进 `FlowMap`
- 也不应该留在 `TransitHubCenterDashboard` 内部临时生成
- 它应留在 facade 装配层，并进入 `SectorInternalData`

### C4. `liveSourceView` 与 `planningSourceView` 的关系

必须分开。  
不能共用一个 `sourceView`。

两者差异写死：

- `planningSourceView`
  - 代表 binding/planned 视角
  - `productionStations` = binding derived stations
  - `flowMap` = planningFlowMap

- `liveSourceView`
  - 代表 archive/live 视角
  - `productionStations` = archive 覆盖到的 live stations
  - `flowMap` = liveFlowMap

两者相同点：

- `productionSectors`
- `productionSectorLinks`
- 当前 binding scope

结论：

- 不是“完全独立世界”
- 但也不是“同一个 sourceView 加一点过滤”
- 它们必须是两个独立实例，因为它们服务两套不同 `flowMap` 和 station 集

### C5. transit presenter 接口形式

transit presenter 不应直接接收裸 store 实例。  
也不应继续让 view 直接读 store。

固定做法：

- 新增 transit-specific presenter contract

文件固定为：

- [src/types/transit-presenter-contract.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/types/transit-presenter-contract.ts)

必须定义最小接口，只暴露 transit presenters 需要的方法。

示意：

```ts
export interface TransitPresenterContract {
  getActiveTransitSectorId(): string | null
  getTransitMode(): 'planning' | 'live'
  getPlanningTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getLiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getActiveTransitPanelSource(sectorId: string | null): ProductionPanelSource
  getTransitHasArchiveTradeStation(): boolean
  updateTransitHubSettings(patch: Partial<StationSettings>): void
}
```

然后：

- `useLiveProductionStore` 实现这个 contract
- `useTransitPlanningPresenter`
- `useTransitWareflowPresenter`
- `useTransitDashboardPresenter`
  只接收这个 contract

结论：

- presenter 不直接吃裸 store
- presenter 也不复用 `ProductionWorkbenchStoreContract`
- transit presenter 使用自己的最小 contract
