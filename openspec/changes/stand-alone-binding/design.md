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
  blueprintEmpireId?: string
  groups: BindingSectorGroup[]
  stationPlans: BindingStationPlan[]
  updatedAt: number
}
```

`selectedArchiveTime` 是视角字段。`blueprintEmpireId` 只是导入候选来源的 UI 记忆，不是 station plan 的来源关系。

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

清空规划后可以删除 plan，使 save station 回到“自动派生、规划为空”的状态。

### D2: Virtual station 是显式占位

virtual station 表示“当前存档还没有建好，但用户想在 binding 中预留的站”。因此 virtual station 只由用户明确创建或导入为占位产生。解绑、换绑或清空 save station plan 不得把对象转成 virtual station。

### D3: Trade station 不参与生产

`TradeStationBinding` 表示星区中转站，其职责是物流中转而非普通 station modules 生产。因此：
- 不存储 `modules`、`settings`、`type` 字段
- 普通 station 生产计算时忽略 trade station
- save-binding source 需要把 trade station 映射到量化生产中的 transit hub 视角/模型
- 同一 save station 不能同时作为生产站和中转站

### D4: Source empire 导入是单次复制

source empire station 只是规划模板。导入时复制 `name/type/modules/settings`，复制完成后不保存 source station 引用，也不做后续同步。这样 binding 修改不会污染 empire，empire 修改也不会隐式改变 binding。

### D5: 显式保存 binding

binding 使用独立 dirty 状态。编辑 group、coverage、station plan、trade station 或规划 modules 后，只更新内存 draft。点击 `保存绑定` 才写入 `x4_save_bindings`。

`保存帝国` 不触发 binding 保存。dirty binding 的切换/关闭需要给出保存、放弃、继续编辑路径。

### D6: Production source adapter

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

点击存档首页 binding 按钮后，量化生产 active source 需要切到该 `gameGuid` 对应的 `save-binding`。如果当前 active source 是普通 empire 且 active empire dirty，则在进入 binding 前复用 dirty empire 点击新建时的保存/放弃确认：保存或放弃后继续进入 binding，关闭确认则中止进入和 source 切换。

**派生空间站名称与星区归属**：

空间站名称：
- 若 covered save station 有对应 `BindingStationPlan`，使用 `plan.name`
- 若无 plan，使用 save station 的 `code`

空间站所属星区 (`sectorId`)：
- 若 covered save station 有对应 `BindingStationPlan`，使用 `plan.groupId`
- 若无 plan，通过 save station 的 `sectorMacro` 找到 `coverageSectorMacros` 包含该 `sectorMacro` 的 group，使用该 `group.id`
- virtual station（无 `saveStationCode`）使用 `plan.groupId`

此逻辑在 `deriveBindingStations` 和 `buildSaveBindingProductionFlows` 中实现，确保 `station.sectorId` 正确指向所属 binding group，供 `StationTabBar` 等组件使用。

### D7: 平铺存储，树状展示

`groups[]` 与 `stationPlans[]` 平铺保存，但 trade station 是 group 内部单体字段。`stationPlans[]` 保存 save-station 和 virtual-station 的规划数据，方便按 `gameGuid`、`saveStationCode`、`groupId` 做唯一性检查和全局生产汇总。UI 需要树状结构时使用 view model 组装。未分组 station plan 允许存在，后续可在量化生产输出区作为单独 bucket 展示。

### D8: 星区总览移除管理面板但保留占位

`empire` 不再拥有星区，因此星区总览中的 `SectorManagementPanel` 不再有业务对象。`save-binding` 虽然拥有 binding groups，但它们由 save binding Step 2 管理，不应复用星区总览入口。

因此总览态应移除星区管理面板内容，但保留原左侧布局占位。占位的职责只是稳定布局，避免右侧资源视图在面板移除后横向扩张或产生明显跳变。

### D9: Production source 路由架构

`useEmpireStore` 持有 `productionSource` ref，控制数据源切换：

```ts
productionSource: 'empire' | 'save-binding'
```

**核心属性路由**：

- `sectors`：empire 模式返回 `activeEmpire.sectors`，binding 模式返回 `binding.groups`（映射为 SectorLike）
- `orderedStationsBySector`：binding 模式使用 `deriveBindingStations` 派生空间站列表
- `activeStationId`：computed 双向绑定，binding 模式路由到 `saveBindingStore.activeStationId`
- `activeStation`：binding 模式从派生列表查找

**切换方法**：

```ts
switchToBinding(gameGuid): { needsConfirm: boolean }
confirmSwitchToBinding(gameGuid): void
switchToEmpire(): void
```

`switchToBinding` 检查 empire dirty 状态，返回 `needsConfirm` 供 UI 显示确认对话框。用户确认后调用 `confirmSwitchToBinding`。

**数据层分离**：

`useEmpireDataStore` 负责纯数据持久化，`useEmpireStore` 调用其方法处理 localStorage。此分离为后续支持多数据源切换奠定基础。

## UI 设计

### Save homepage

存档首页 binding 图标打开或创建对应 `gameGuid` 的唯一 binding。点击 guid 级入口打开 latest 视角，点击 time 级入口更新 `selectedArchiveTime` 并打开同一个 binding。

进入 binding 前需要处理当前 ordinary empire 的未保存改动：如果量化生产当前 active source 是 `empire` 且 active empire dirty，系统先显示与“新建帝国”同源的 SmartSave 确认。用户选择保存或放弃后才继续进入 binding；用户关闭确认时停留在原状态。成功进入 binding 后，量化生产 active source 切换为当前 `gameGuid` 的 save-binding。

### Step 2: Binding groups

Step 2 不再显示"帝国星区"，改为 binding 星区列表。用户在这里创建、排序、重命名 group，设置 anchor、coverage、jump range 和 connected groups。

新建 group 复用编辑 group 的 anchor sector 选择菜单。点击"新建星区"时只打开候选菜单，不立即创建空 group；用户选择一个未被其他 group 占用的 save sector 后，UI 展开一个新 group draft：

- `sectorMacro` 使用被点击的 save sector
- `name` 默认使用该 save sector 的显示名称
- coverage 按当前默认 jump range 自动计算
- 菜单候选、样式和禁用逻辑与编辑 anchor sector 完全一致

### Step 3: Station planning

Step 3 的主对象是 group coverage 派生出的 save stations 和用户显式创建的 virtual stations。用户不需要逐个绑定已有 save station。额外操作集中在：

- 选择 blueprint empire，用其中 station 作为空间站蓝图导入模板。
- 将 blueprint empire station 的规划模块导入到某个 save station plan。
- 创建 virtual station 占位或星区中转站。
- 编辑或清空规划 modules。

### 拖拽交互

#### 从 save panel 拖拽

- 拖拽自由空间站到地图 → 创建 `BindingStationPlan`（无 `saveStationCode`）
- 拖拽星区中转站到地图 → 创建 `TradeStationBinding`（无 `saveStationCode`）

#### 拖拽已放置的 station

- 拖拽已放置的 binding station → 移动位置（调用 `setStationPlanPosition`）
- 拖拽星区中转站 → 移动位置（调用 `setTradeStationPosition`）

#### 拖拽预览

拖拽时显示与 POI 一致的图标风格：
- 正确的图标大小和 owner 颜色
- 虚线外圈表示 binding overlay
- 使用 `activeBindingDragPreview` 构建 `savePoiVisual`

### Binding save status

save panel 的 binding 分支标题栏右侧提供保存控制：

- `取消`：放弃当前 binding draft 改动
- `保存`：写入 `x4_save_bindings`
- `关闭`：关闭 binding 面板

面板底部只显示 dirty 状态，例如 `绑定已保存` / `绑定有未保存改动`。量化生产界面只选择 `empire` / `save-binding` 数据源，不再提供保存 binding 或放弃 binding 改动的入口。

### Sector overview placeholder

量化生产总览态不再提供星区管理操作。原 `SectorManagementPanel` 所在区域应替换为无交互占位，保持原布局宽度，使右侧资源视图和总体工作台的空间分配保持稳定。

## 错误与边界处理

- 如果当前 archive 缺失，binding 保留，但派生 save station view 为空，并显示当前 time 不可用状态。
- 如果 `stationPlans` 中的 `saveStationCode` 当前 archive 不存在，该 plan 保留，但不参与当前 group 派生视图；后续 UI 可放入未覆盖/失效规划区。
- 如果 `blueprintEmpireId` 指向不存在的 empire，只清空候选列表，不删除已有 station plans。
- 如果同一 `gameGuid` 下出现重复 `saveStationCode` plan，store 规范化时保留最后一次有效编辑或阻止写入，确保唯一。
- 如果尝试将已绑定到 `stationPlans` 的 save station 绑定为 trade station，应先移除原 plan。

## 测试关注点

- binding 保存与 empire 保存完全分离。
- 覆盖范围变化会改变派生 save station view，但不会自动写入 stationPlans。
- 导入 source empire station 后，修改 source empire 不会改变 binding planned modules。
- virtual station 只由显式操作创建。
- save-binding 生产 source 的普通 station 计算只使用 planned modules，不读取 save archive 自身 modules。
- trade station 映射为 transit hub，不参与普通 station modules 生产计算。
