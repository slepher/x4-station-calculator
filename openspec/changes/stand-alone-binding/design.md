# stand-alone-binding Design

## 设计目标

本变更将 save binding 从 empire 持久化和 empire 星区体系中拆出，形成独立的“存档绑定规划层”。用户在 binding 中维护星区划分、补给范围、规划模块和未来占位站；量化生产界面可以直接读取这些规划数据，而不再把 binding 理解为“把现有 empire station 独占绑定到 save station”的流程。

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
  selectedArchiveTime: number | null
  sourceEmpireId?: string
  groups: BindingSectorGroup[]
  stationPlans: SaveStationPlan[]
  updatedAt: number
}
```

`selectedArchiveTime` 是视角字段。`sourceEmpireId` 只是导入候选来源的 UI 记忆，不是 station plan 的来源关系。

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
  virtualStation?: VirtualStationPlan
}
```

group 管理星区划分和覆盖范围。覆盖范围用于从 save archive 派生该 group 下的 save station 视图。

### Binding station plans

`SaveStationPlan` 是 save station 的用户规划层，不是 save station 本体。

interface SaveStationPlan {
  id: string
  kind: 'save-station'
  saveStationCode: string
  groupId?: string | null
  modules: SavedModule[]
  settings: StationSettings
  name?: string
}

interface VirtualStationPlan {
  id: string
  kind: 'virtual-station'
  groupId?: string | null
  name: string
  type: StationType
  modules: SavedModule[]
  settings: StationSettings
  sectorMacro?: string
  position?: { x: number; y: number; z: number }
}
```

`VirtualStationPlan` 不属于 `stationPlans`。它是 `BindingSectorGroup.virtualStation` 的单体字段，表示该 group 的未来占位站或特殊中转站。

对于 save station，如果没有对应 `SaveStationPlan`，则视为存在一个派生 station view，但规划 modules 为空。进入 binding 时不自动创建 plan。

## 派生视图

binding UI 不直接把 `stationPlans` 当成完整 station 列表，而是由当前 archive、groups 和 stationPlans 派生：

```ts
interface BindingStationView {
  key: string
  kind: 'save-station' | 'virtual-station'
  groupId: string | null
  saveStationCode?: string
  saveStation?: PlayerStationEntry
  plan?: SaveStationPlan | VirtualStationPlan
  plannedModules: SavedModule[]
}
```

派生规则：

- 对每个 group，按 anchor/coverage 找出当前 archive 中覆盖范围内的 save stations。
- 每个 covered save station 自动生成 `save-station` view。
- 若 `stationPlans` 中存在同 `saveStationCode` 的 `SaveStationPlan`，使用其 `modules/settings/name`。
- 若不存在 plan，`plannedModules = []`。
- `group.virtualStation` 直接生成 virtual station view。
- `groupId` 不存在或为空的 station plan 是合法未分组规划；本次只保证数据层与全局量化可处理，详细 UI 后续规划。

## 关键决策

### D1: 按需物化 save station plan

save station 本身来自存档，是事实数据。binding 只保存用户的规划层覆盖，因此系统 SHALL NOT 在进入 binding 时为每个 save station 自动写入 `SaveStationPlan`。

只有以下操作会创建或更新 `SaveStationPlan`：

- 从 source empire station 导入规划模块到 save station。
- 在量化生产界面修改 save station 的规划 modules/settings。
- 用户显式保存对该 save station 规划层的修改。

清空规划后可以删除 plan，使 save station 回到“自动派生、规划为空”的状态。

### D2: Virtual station 是显式占位

virtual station 表示“当前存档还没有建好，但用户想在 binding 中预留的站”。因此 virtual station 只由用户明确创建或导入为占位产生。解绑、换绑或清空 save station plan 不得把对象转成 virtual station。

### D3: Source empire 导入是单次复制

source empire station 只是规划模板。导入时复制 `name/type/modules/settings`，复制完成后不保存 source station 引用，也不做后续同步。这样 binding 修改不会污染 empire，empire 修改也不会隐式改变 binding。

### D4: 显式保存 binding

binding 使用独立 dirty 状态。编辑 group、coverage、station plan、virtual station 或规划 modules 后，只更新内存 draft。点击 `保存绑定` 才写入 `x4_save_bindings`。

`保存帝国` 不触发 binding 保存。dirty binding 的切换/关闭需要给出保存、放弃、继续编辑路径。

### D5: Production source adapter

量化生产界面通过统一 adapter 读取生产输入：

```ts
type ProductionSourceKind = 'empire' | 'save-binding'

interface ProductionSource {
  kind: ProductionSourceKind
  stations: StationPlanLike[]
  groups?: ProductionGroupLike[]
}
```

`empire` source 直接来自 empire stations。`save-binding` source 来自 binding station views，并且只读取 `plannedModules`。save modules 不进入本次计算。

### D6: 平铺存储，树状展示

`groups[]` 与 `stationPlans[]` 平铺保存，但 virtual station 是 group 内部单体字段。`stationPlans[]` 只保存按需物化的 save-station 规划，方便按 `gameGuid`、`saveStationCode`、`groupId` 做唯一性检查和全局生产汇总。UI 需要树状结构时使用 view model 组装。未分组 save-station plan 允许存在，后续可在量化生产输出区作为单独 bucket 展示。

### D7: 星区总览移除管理面板但保留占位

`empire` 不再拥有星区，因此星区总览中的 `SectorManagementPanel` 不再有业务对象。`save-binding` 虽然拥有 binding groups，但它们由 save binding Step 2 管理，不应复用星区总览入口。

因此总览态应移除星区管理面板内容，但保留原左侧布局占位。占位的职责只是稳定布局，避免右侧资源视图在面板移除后横向扩张或产生明显跳变。

## UI 设计

### Save homepage

存档首页 binding 图标打开或创建对应 `gameGuid` 的唯一 binding。点击 guid 级入口打开 latest 视角，点击 time 级入口更新 `selectedArchiveTime` 并打开同一个 binding。

### Step 2: Binding groups

Step 2 不再显示“帝国星区”，改为 binding 星区列表。用户在这里创建、排序、重命名 group，设置 anchor、coverage、jump range 和 connected groups。

### Step 3: Station planning

Step 3 的主对象是 group coverage 派生出的 save stations 和用户显式创建的 virtual stations。用户不需要逐个绑定已有 save station。额外操作集中在：

- 选择 source empire，用其中 station 作为规划模块导入模板。
- 将 source empire station 的规划模块导入到某个 save station plan。
- 创建 virtual station 占位。
- 编辑或清空规划 modules。

### Binding save status

binding 面板和量化生产的 binding source 视图都需要显示同一 dirty 状态：

- `绑定已保存`
- `绑定有未保存改动`
- `正在保存绑定...`
- `保存失败`

主要操作按钮为 `保存绑定` 与 `放弃改动`。

### Sector overview placeholder

量化生产总览态不再提供星区管理操作。原 `SectorManagementPanel` 所在区域应替换为无交互占位，保持原布局宽度，使右侧资源视图和总体工作台的空间分配保持稳定。

## 错误与边界处理

- 如果当前 archive 缺失，binding 保留，但派生 save station view 为空，并显示当前 time 不可用状态。
- 如果 `stationPlans` 中的 `saveStationCode` 当前 archive 不存在，该 plan 保留，但不参与当前 group 派生视图；后续 UI 可放入未覆盖/失效规划区。
- 如果 `sourceEmpireId` 指向不存在的 empire，只清空候选列表，不删除已有 station plans。
- 如果同一 `gameGuid` 下出现重复 `saveStationCode` plan，store 规范化时保留最后一次有效编辑或阻止写入，确保唯一。

## 测试关注点

- binding 保存与 empire 保存完全分离。
- 覆盖范围变化会改变派生 save station view，但不会自动写入 stationPlans。
- 导入 source empire station 后，修改 source empire 不会改变 binding planned modules。
- virtual station 只由显式操作创建。
- save-binding 生产 source 只使用 planned modules。
