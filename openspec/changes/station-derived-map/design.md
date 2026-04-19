# station-derived-map Design

## 背景

现有 `StationProductionFlowMap` 已经不只是“flow map”。

它当前已经承载：
- 单站 production cache
- sector / empire 聚合 cache
- auto modules 派生
- workforce / efficiency 派生

同时，`useBlueprintProductionStore` 与 `useLiveProductionStore` 都已经围绕该对象建立读取路径，只是 tab 相关 semantic derived（`tag`、`factoryGroup`）仍散落在 store 的 `getTabs()` 阶段临时计算。

因此，本次设计必须遵循以下结构，而不是重做实例拓扑：

1. 承认现有抽象应改名为 `StationDerivedMap`
2. 保持 blueprint/planning 与 archive/live 的双实例结构
3. 在第二阶段把 station semantic derived 正式纳入该抽象

## 设计目标

### Goal 1: 先修正抽象名，不改行为

第一阶段只允许解决命名失真问题：
- 类名改为 `StationDerivedMap`
- 文件名改为 `StationDerivedMap.ts`
- 调用侧按新名称引用
- 必须一次性完成全仓替换，不保留兼容别名，不允许新旧名称并存

此阶段不得修改 cache shape，不得新增 `semantics` 字段，不得改 compute 入口。

### Goal 2: 在双实例结构上扩展 semantic derived cache

第二阶段不得引入第三实例，不得将两套来源合并进一个实例，而必须在现有两个实例上增加 semantic cache：

```text
StationDerivedMap (class)
├── planning/blueprint instance
│   └── source: StationPlan / BindingStationPlan
└── archive/live instance
    └── source: archive station record / playerStationRecords
```

## 当前状态确认

### 1. blueprint/planning 实例

当前由全局单例承担：
- `useBlueprintProductionStore` 负责 compute / getCache / updateAggregation
- `useLiveProductionStore` 在 planning/binding 路径也会读取这一实例

### 2. archive/live 实例

当前由 `useLiveProductionStore` 内部单独创建：
- `liveFlowMap = new StationProductionFlowMap()`
- 由 `syncLiveFlowMapForStation()` 依据 archive record 重算

### 3. semantic derived 仍分散在 store

当前两个 store 的 `getTabs()` 都直接做 semantic 计算：

1. `useBlueprintProductionStore`
   - 聚合 modules
   - 调用 `classifyPlayerStationPoi(...)`
   - 临时填充 `tag/factoryGroup`

2. `useLiveProductionStore`
   - 若有 binding plan：聚合 modules 后调用 `classifyPlayerStationPoi(...)`
   - 若无 binding plan：直接读取 archive record 的 `tag/factoryGroup`

这会导致：
- tab 语义散落在 store 组装阶段
- 双入口维护方式不一致
- 后续若其他地方也需要 station semantic derived，会继续复制逻辑

## 目标结构

第二阶段目标 cache 结构：

```ts
interface StationSemanticDerived {
  tag?: string
  factoryGroup?: string
  productionProfile?: string
  profileName?: string
}

interface StationDerivedCache {
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  productionFlows: WareProductionFlow[]
  warePriorityLevels: Record<string, number>
  actualWorkforce: number
  currentEfficiency: number
  semantics?: StationSemanticDerived
}
```

说明：
- 必须保持现有平铺 production 字段，避免第二阶段额外引入大规模消费方改造
- 必须新增 `semantics` 子区，作为 station semantic derived 的唯一落点
- 后续新增 semantic 字段时，必须统一进入 `semantics`

## 计算模型

### Phase 1: 纯改名

```text
StationProductionFlowMap
  └─ rename → StationDerivedMap

stationProductionFlowMap
  └─ rename → planningDerivedMap / blueprintDerivedMap（待定）

liveFlowMap = new StationProductionFlowMap()
  └─ rename type only → new StationDerivedMap()
```

行为必须保持不变：
- compute 输入不变
- cache 内容不变
- getCache/getGrouped/updateAggregation/remove/clear 语义不变

### Phase 2: 新增 semantic derived 计算

#### planning/blueprint 实例

输入：
- `StationPlan.modules`
- `BindingStationPlan.modules`
- `gameData.modulesMap`
- `gameData.modulesByMacroId`

输出：
- `semantics.tag`
- `semantics.factoryGroup`
- `semantics.productionProfile`
- `semantics.profileName`

计算方式：
- 继续复用 `buildAggregatedModulesFromStationPlan(...)`
- 继续复用 `classifyPlayerStationPoi(...)`
- 将结果写入 `cache.semantics`

#### archive/live 实例

输入：
- archive record (`PlayerStationEntry`)
- archive 已有 semantic 字段
- 必要时由 archive modules 转换后的 `SavedModule[]`

输出：
- `cache.semantics`

优先级：
1. 优先使用 archive record 已有 semantic 字段
2. 若字段不完整，再走 fallback 计算

这样可以避免在第二阶段改动 archive 数据模型时引入不必要的回归风险，因此必须采用此优先级。

## 调用方迁移

### `useBlueprintProductionStore`

当前：
- `getTabs()` 直接调用 `classifyPlayerStationPoi(...)`

目标：
- `getTabs()` 必须改读 planning/blueprint derived map 的 `cache.semantics`
- `getTabs()` 只负责组装 `ProductionTabItem`

### `useLiveProductionStore`

当前：
- `getTabs()` 自己维护 binding plan 路径与 archive record 路径的分支逻辑

目标：
- planning 模式必须读取 planning/blueprint derived map 的 `cache.semantics`
- live/archive 模式必须读取 archive/live derived map 的 `cache.semantics`
- `getTabs()` 不再承担 semantic 分类职责

## 关键决策

### 决策 1：不拆成两个类

不得拆成：
- `StationProductionDerivedMap`
- `StationSemanticDerivedMap`

理由：
- 两者都属于 station 级派生快照
- 生命周期一致，随 station/modules 变更一起失效/重算
- 当前系统已经有多份类似对象，继续拆分类只会放大维护复杂度

### 决策 2：保持两个实例，不做单实例双源混合

不得将 planning/binding 与 archive/live 两套来源硬合并为单实例。

理由：
- 两套输入集合不同
- 生命周期不同
- 当前代码已经形成双实例结构
- 单实例只会引入更多 source 判断和覆盖优先级分支

### 决策 3：第二阶段先加 `semantics`，不重整全部 cache shape

理由：
- 第二阶段目标是收口 semantic derived
- 不得把“命名修正”和“大规模 cache shape 重构”捆绑在一起
- 必须先保持 production 字段平铺，降低迁移风险

## 风险与缓解

### 风险 1：第一阶段误改行为

风险：
- 改名时顺手修改逻辑，导致行为漂移

缓解：
- 第一阶段任务明确禁止改 cache 内容与 compute 语义
- 第一阶段只允许 rename / import path / 文档同步

### 风险 2：第二阶段 blueprint/live 读取路径不一致

风险：
- 只改 live，不改 blueprint

缓解：
- tasks 中将两个 store 的迁移拆成显式独立任务，且 blueprint 在 live 之前完成或同步完成

### 风险 3：archive 语义字段不完整

风险：
- 部分 archive 记录只有 `tag` 没有 `factoryGroup`

缓解：
- 先按 archive 字段优先写入
- 缺失字段时显式 fallback 计算
- 将 fallback 策略写进实现任务与 spec

## 与现有文档的同步要求

必须同步更新：
- `station-production-flow-map` 文档中的主名词
- `user-save-binding-station` 中引用 `StationProductionFlowMap` 的描述
- 所有任务中涉及 `StationProductionFlowMap` 的后续步骤说明

但本次 change 不得修改它们的业务需求。
