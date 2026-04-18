# user-save-binding-data Design

## 设计目标

本变更将 save binding 从 empire 持久化和 empire 星区体系中拆出，形成独立的"存档绑定规划层"。用户在 binding 中维护星区划分、补给范围、规划模块和未来占位站；量化生产界面可以直接读取这些规划数据，而不再把 binding 理解为"把现有 empire station 独占绑定到 save station"的流程。

## 数据结构

### Binding store

新增独立 store 与 localStorage key：

```ts
interface SavedSaveBindingsState {
  version: 1
  activeGameGuid: string | null
  list: SaveBindingPlan[]
}
```

`SaveBindingPlan` 以 `gameGuid` 唯一：

```ts
interface SaveBindingPlan {
  gameGuid: string
  bindingName?: string  // 显示名称，创建时从 archive playerName 复制
  selectedArchiveTime: number | null
  blueprintEmpireId?: string
  groups: BindingSectorGroup[]
  stationPlans: BindingStationPlan[]
  updatedAt: number
}
```

`bindingName` 是用户可见的显示名称，创建 binding 时自动从 archive 的 `playerName` 复制，后续可在 UI 中编辑修改。`selectedArchiveTime` 是视角字段。`blueprintEmpireId` 只是导入候选来源的 UI 记忆，不是 station plan 的来源关系。

### Binding groups

```ts
interface BindingSectorGroup {
  id: string
  name: string
  order: number
  sectorMacro?: string
  jumpRange: number
  coverageSectorMacros: CoverageSectorEntry[]
  connectedGroupIds?: string[]
  supplyStation?: BindingSupplyStation
  tradeStation?: TradeStationBinding
}
```

group 管理星区划分和覆盖范围。覆盖范围用于从 save archive 派生该 group 下的 save station 视图。

### Binding station plans

`BindingStationPlan` 统一表示 save-station 和 virtual-station，通过 `saveStationCode` 派生类型：

```ts
interface BindingStationPlan {
  id: string
  saveStationCode?: string  // 有值 = save-station，无值 = virtual-station
  groupId?: string | null
  name: string
  type: StationType
  modules: SavedModule[]
  settings: StationSettings
  sectorMacro?: string
  position?: { x: number; y: number; z: number }
}
```

**派生规则**：
- `saveStationCode` 存在 → 该 plan 绑定到存档中的 save station
- `saveStationCode` 不存在 → 该 plan 是虚拟占位站

### Trade station

`TradeStationBinding` 表示星区中转站，不作为普通生产空间站参与 station modules 生产计算，但会在量化生产的 save-binding source 下映射为 transit hub：

```ts
interface TradeStationBinding {
  id: string
  saveStationCode?: string  // 有值 = 绑定存档站，无值 = 虚拟占位
  name: string
  sectorMacro?: string
  position?: { x: number; y: number; z: number }
}
```

**约束**：
- `modules` 始终为 `[]`，不参与普通 station modules 生产计算
- save-binding source 下需要把它映射为星区中转站 / transit hub
- 同一 `saveStationCode` 不能同时存在于 `stationPlans[]` 和 `tradeStation`

对于 save station，如果没有对应 `BindingStationPlan`，则视为存在一个派生 station view，但规划 modules 为空。进入 binding 时不自动创建 plan。

## 派生视图

binding UI 不直接把 `stationPlans` 当成完整 station 列表，而是由当前 archive、groups 和 stationPlans 派生：

```ts
interface BindingStationView {
  key: string
  kind: 'save-station' | 'virtual-station'
  groupId: string | null
  saveStationCode?: string
  saveStation?: PlayerStationEntry
  plan?: BindingStationPlan
  plannedModules: SavedModule[]
}
```

派生规则：

- 对每个 group，按 anchor/coverage 找出当前 archive 中覆盖范围内的 save stations。
- 每个 covered save station 自动生成 `save-station` view。
- 若 `stationPlans` 中存在同 `saveStationCode` 的 `BindingStationPlan`，使用其 `modules/settings/name`。
- 若不存在 plan，`plannedModules = []`。
- `stationPlans` 中没有 `saveStationCode` 的 plan 是虚拟占位站 view。
- `group.tradeStation` 作为独立的 trade station view，不进入普通 station modules 生产计算，但可映射为 transit hub。
- `groupId` 不存在或为空的 station plan 是合法未分组规划；本次只保证数据层与全局量化可处理，详细 UI 后续规划。

## 关键决策

### D1: 按需物化 save station plan

save station 本身来自存档，是事实数据。binding 只保存用户的规划层覆盖，因此系统 SHALL NOT 在进入 binding 时为每个 save station 自动写入 `BindingStationPlan`。

只有以下操作会创建或更新 `BindingStationPlan`：

- 从 source empire station 导入规划模块到 save station。
- 在量化生产界面修改 save station 的规划 modules/settings。
- 用户显式保存对该 save station 规划层的修改。

清空规划后可以删除 plan，使 save station 回到"自动派生、规划为空"的状态。

### D2: Virtual station 是显式占位

virtual station 表示"当前存档还没有建好，但用户想在 binding 中预留的站"。因此 virtual station 只由用户明确创建或导入为占位产生。解绑、换绑或清空 save station plan 不得把对象转成 virtual station。

### D3: Trade station 不参与生产

`TradeStationBinding` 表示星区中转站，其职责是物流中转而非普通 station modules 生产。因此：
- 不存储 `modules`、`settings`、`type` 字段
- 普通 station 生产计算时忽略 trade station
- save-binding source 需要把 trade station 映射到量化生产中的 transit hub 视角/模型
- 同一 save station 不能同时作为生产站和中转站

### D4: Source empire 导入是单次复制

source empire station 只是规划模板。导入时复制 `name/type/modules/settings`，复制完成后不保存 source station 引用，也不做后续同步。这样 binding 修改不会污染 empire，empire 修改也不会隐式改变 binding。

### D5: 导入时仅使用 module_id

从 save station 导入规划模块时，只使用 save parser 提供的 `module_id` 导入全部模块，不回退到 `ref`。这确保导入的是模块 ID 而不是宏 ID，符合 station 规划侧的需求。

### D6: 显式保存 binding

binding 使用独立 dirty 状态。编辑 group、coverage、station plan、trade station 或规划 modules 后，只更新内存 draft。点击 `保存绑定` 才写入 `x4_save_bindings`。

`保存帝国` 不触发 binding 保存。dirty binding 的切换/关闭需要给出保存、放弃、继续编辑路径。

### D7: Production source adapter

量化生产界面通过统一 adapter 读取生产输入：

```ts
type ProductionSourceKind = 'empire' | 'save-binding'

interface ProductionSource {
  kind: ProductionSourceKind
  stations: StationPlanLike[]
  groups?: ProductionGroupLike[]
}
```

`empire` source 直接来自 empire stations。`save-binding` source 来自 binding 派生视图，而不是只读取已物化的 `stationPlans[]`：

- 对当前 archive 中被 `BindingSectorGroup.coverageSectorMacros` 覆盖的 save stations 生成普通 station 输入。
- 若 covered save station 有同 `saveStationCode` 的 `BindingStationPlan`，使用该 plan 的 planned modules/settings/name。
- 若 covered save station 没有 plan，仍生成空 modules station，对普通生产计算贡献为 0。
- `stationPlans[]` 中没有 `saveStationCode` 的 virtual station 生成普通 station 输入。
- `BindingSectorGroup.tradeStation` 生成 transit hub 输入，不生成普通 station 输入。
- 不在任何 group coverage 内的 save station 不生成量化生产输入。
- save archive 自身解析出的 modules 不进入本次计算。

### D8: Empire Store Production Source 路由

```
┌─────────────────────────────────────────────────────────────┐
│                   useEmpireStore                             │
│  - productionSource: 'empire' | 'save-binding'               │
│  - 根据source路由到对应数据层                                 │
│  - stations / sectors / activeStation (统一接口)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│ useEmpireDataStore  │        │ useSaveBindingStore │
│ - 纯数据持久化       │        │ - binding draft     │
│ - localStorage CRUD │        │ - 派生 station views │
│ - 无业务逻辑         │        │ - dirty 管理        │
└─────────────────────┘        └─────────────────────┘
```

核心原则：
1. **useEmpireStore 保持为"工作上下文"入口** - 其他组件无需修改
2. **useEmpireDataStore 只做持久化** - 无业务逻辑
3. **useSaveBindingStore 已有独立存储** - 只需扩展接口

### D9: 平铺存储，树状展示

`groups[]` 与 `stationPlans[]` 平铺保存，但 trade station 是 group 内部单体字段。`stationPlans[]` 保存 save-station 和 virtual-station 的规划数据，方便按 `gameGuid`、`saveStationCode`、`groupId` 做唯一性检查和全局生产汇总。UI 需要树状结构时使用 view model 组装。未分组 station plan 允许存在，后续可在量化生产输出区作为单独 bucket 展示。

### D10: Modules/Equipments 聚合迁移到 post.ts

将聚合逻辑从 rust-parser 移到 saveParser.post.ts，原因：
- post.ts 可以访问 buildstorage 与 station 的关联关系
- post.ts 可以处理 progress.sequenceindex 的排除逻辑
- rust-parser 只负责原始数据提取，保持职责单一

#### 数据流

```
rust-parser 输出:
  PlayerStationEntry { constructions: [...], modules?: [], equipments?: [] }
  BuildStorageEntry { constructions: [...], modules?: [], equipments?: [], progress?: {...} }
  NpcStationEntry { modules?: [], equipments?: [] }  // 在 rust-parser 中聚合
  FactionStationEntry { modules?: [], equipments?: [] }  // 在 rust-parser 中聚合

saveParser.post.ts 处理:
  1. 对 station: aggregate(constructions) - 排除正在建造的
  2. 对 buildstorage: aggregate(constructions) - station.modules/equipments
```

**注意**：`modules` 和 `equipments` 使用 **Array 格式** `[{ref, amount}]`，而非 HashMap。

#### progress.sequenceindex 处理流程

```
buildstorage.progress.sequenceindex = N (从 0 开始)
  ↓
buildstorage.constructions[N].id = constructionId
  ↓
在 station.constructions 中找到 id === constructionId 的项
  ↓
从聚合中排除该项（原始 construction 数据保持不变）
```

**重要**：不修改原 construction 对象，只在聚合计算时将其排除。construction 数组作为原始数据完整保留。

#### 差值计算

```typescript
// Station 聚合（返回 Array）
const stationModules = aggregateModules(station.constructions, excludeInProgress(buildstorage))
// stationModules = [{ref, amount}, ...]

// BuildStorage 聚合
const buildstorageRawModules = aggregateModules(buildstorage.constructions)
const buildstorageModules = subtractArrays(buildstorageRawModules, stationModules)
// buildstorageModules = buildstorageRaw 减去 station 已有（差值）
```

**差值语义**：buildstorage 显示的是"新增/正在建造但未完成"的模块。

## 错误与边界处理

- 如果当前 archive 缺失，binding 保留，但派生 save station view 为空，并显示当前 time 不可用状态。
- 如果 `stationPlans` 中的 `saveStationCode` 当前 archive 不存在，该 plan 保留，但不参与当前 group 派生视图；后续 UI 可放入未覆盖/失效规划区。
- 如果 `blueprintEmpireId` 指向不存在的 empire，只清空候选列表，不删除已有 station plans。
- 如果同一 `gameGuid` 下出现重复 `saveStationCode` plan，store 规范化时保留最后一次有效编辑或阻止写入，确保唯一。
- 如果尝试将已绑定到 `stationPlans` 的 save station 绑定为 trade station，应先移除原 plan。