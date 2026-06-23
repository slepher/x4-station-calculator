# auto-sector-group-one-virtual-station Design

## 总览

本 change 将 Map binding 中的虚拟生产空间站编辑前移到自动星区分组面板。它与 `auto-sector-group-one-binding` 的共享 draft 方案保持一致：Map 组件不直接写 binding，而是读写 store 中的 draft；提交时统一应用。

核心分离：

```text
Virtual Station
  BindingStationPlan
  saveStationCode === undefined
  参与普通生产计算
  由 Virtual Station tab 管理

Virtual Trade Station
  BindingSectorGroup.tradeStation
  saveStationCode === undefined
  不参与普通生产模块计算
  由 Trade Station draft 管理
```

## Store 状态

`useLiveProductionStore` 作为共享 draft owner，新增或维护以下状态：

```ts
virtualStationDrafts: Ref<BindingStationPlan[]>
virtualStationDraftInitializedKey: Ref<string | null>
```

draft key 使用当前 active binding/archive 语境，例如：

```text
gameGuid:archiveTime
```

初始化由 auto group result 生成路径触发，不由组件挂载或 tab 打开触发。

## 初始化与重算

### 初始化

当 `autoGroupResult.groups` 生成后：

1. 若当前 binding context 尚未初始化 virtual station draft：
   - 从 `binding.stationPlans` 中读取 `saveStationCode === undefined` 的 plans。
   - clone 到 `virtualStationDrafts`。
2. 若已初始化：
   - 保留当前 `virtualStationDrafts`。
3. 调用归属重算，把每个 virtual station 按当前 groups 的 anchor/coverage 映射到 group。

### 重新计算

[计算] / [快速计算] 重新生成 groups 时不得重置 virtual station draft：

```text
当前 virtualStationDrafts
  -> 保留内容
  -> 根据新 groups 重新计算 groupId
  -> 无归属项进入未分组状态
```

这保证用户在调整 hub/coverage 过程中不会丢失已放置的虚拟空间站。

## 归属规则

归属由 station 的 `sectorMacro` 和当前 draft groups 决定：

```text
sectorMacro === group.sectorMacro
  -> group

sectorMacro in group.coverageSectorMacros
  -> group

无命中
  -> ungrouped

多命中
  -> invariant violation，按拒绝落点/未分组处理，不自动决胜
```

active coverage 互斥是当前 auto group 方案的前提。因此正常情况下不会出现多命中。

## Map-only Tab

Map `AutoSectorGroupPanel layout="tabs"` 增加：

```ts
type ActiveTab = 'hub' | 'allocation' | 'tradeStation' | 'virtualStation'
```

Live `layout="columns"` 不显示该 tab。

Map binding 面板使用固定头部、tab 内滚动布局：

```text
MapSavePanel body
  AutoSectorBar
  tab-bar
  tab-content (only scroll container)
```

在 binding layer 下，`MapSavePanel` body 不承担纵向滚动和横向 padding；`AutoSectorGroupPanel` 负责头部、tab bar、tab content 的统一横向 padding。滚动条只挂在 `tab-content`，内容左右 padding 保持对称，并保留内容到滚动条的间距。

Virtual Station tab 分两段：

```text
Blueprint 空间站
  - Blueprint empire selector
  - 空白空间站
  - blueprint station list

虚拟空间站
  - 按当前 groups 分组
  - 未分组/提交时移除区域
```

Blueprint empire selector 复用 binding 的 `blueprintEmpireId`。切换来源只影响可拖拽来源列表，不回写已创建 virtual station。

## Map Binding 面板状态

地图上的“存档”按钮是面板 toggle：

```text
isSavePanelOpen === true
  -> close panel only

isSavePanelOpen === false
  -> open panel and restore previous MapSavePanel layer
```

关闭面板只隐藏 UI，不重置 `mapSavePanelLayer`、`mapBindingGameGuid` 或 `mapSavePanelSectorGroupId`。再次打开应回到关闭前的 binding tab/sector group 语境。

首次从 list 打开且存在当前 auto group draft 时，可以进入 `binding-sector`。但该初始化只在当前 layer 仍为 `list` 时发生；不得覆盖用户关闭前保留的 layer。

## Draft Overlay 激活条件

Map overlay 只有在当前确实处于 binding draft 编辑态时才能读取 draft：

```text
isSavePanelOpen
  && mapBindingStage === 'select-sector'
  && mapBindingGameGuid === activeBinding.gameGuid
  && autoGroupResult exists
```

该条件用于：

- 从 `virtualStationDrafts` 渲染虚拟生产空间站。
- 从 `autoGroupResult.groups` 渲染 virtual trade station draft。
- 用 draft 中的 player trade station selection 标记 save POI tradestation。

关闭 binding 面板后，地图必须回到 persisted binding 视图，不得继续混用 `autoGroupResult` 中未确认的 draft。这样未提交的 virtual trade station 选择不会残留在地图，也不会影响原 player trade station 图标。

## Drag 输入

### Blueprint station

拖拽 payload 需要包含完整复制来源：

```ts
{
  kind: 'blueprintStation'
  source: StationPlan
}
```

drop 到有效 sector 时创建新的 virtual station draft：

```ts
{
  id: crypto.randomUUID(),
  saveStationCode: undefined,
  groupId: targetGroup.id,
  name: source.name,
  type: source.type ?? 'industrial',
  modules: deepClone(source.modules ?? []),
  settings: deepClone(source.settings ?? DEFAULT_STATION_SETTINGS),
  lockedWares: deepClone(source.lockedWares ?? []),
  warePriority: deepClone(source.warePriority ?? {}),
  sectorMacro: targetSectorMacro,
  position: dropPosition
}
```

现有 Step 3 漏传 `lockedWares` 与 `warePriority` 是历史缺陷，新实现不得沿用。

### Blank station

空白空间站 drop 后创建：

```ts
{
  id: crypto.randomUUID(),
  saveStationCode: undefined,
  groupId: targetGroup.id,
  name: t('sector.virtual_station'),
  type: 'industrial',
  modules: [],
  settings: deepClone(DEFAULT_STATION_SETTINGS),
  lockedWares: [],
  warePriority: {},
  sectorMacro: targetSectorMacro,
  position: dropPosition
}
```

### Existing virtual station

已存在 virtual station 再次拖拽时，payload 必须携带 draft id：

```ts
{
  kind: 'virtualStationDraft'
  draftId: string
}
```

drop 后只更新该 draft：

```ts
sectorMacro = targetSectorMacro
position = dropPosition
groupId = targetGroup.id
```

不得走“blueprint source 新建”路径，避免生成重复 station plan。

## Drop 校验

drop handler 先从地图坐标解析 `sectorMacro`，再按当前 groups 判断归属：

```text
命中唯一 group
  -> 接受

无命中
  -> 拒绝，保持原 draft

多命中
  -> 拒绝，保持原 draft
```

这里不使用最近 group、数组第一个 group 或 standalone fallback。

## 列表展示

Virtual station item 显示：

```text
虚拟空间站 | Sector 名 | x/z 或 x/y/z | ×
```

不显示 group 名，因为 item 已按 group 分组。

坐标格式沿用当前地图/Step 3 的坐标呈现习惯；如果现有 UI 用平面坐标，则显示 `x, z`；如果统一三维显示，则显示 `x, y, z`。

未分组区域显示所有无当前 group 归属的 drafts，并在列表下显示说明。提交时这些 drafts 会被移除。

## 应用到 Binding

提交顺序：

```text
1. apply auto groups
2. recalculate virtual station draft groupId against persisted/final groups
3. apply virtual station drafts
4. apply virtual trade station draft positions
```

Virtual station apply 只处理无 `saveStationCode` 的 plans：

1. 当前 binding 中无 `saveStationCode` 的 station plans 作为同步目标集合。
2. draft 中仍有 group 归属的 station：
   - id 已存在：update。
   - id 不存在：create。
3. 目标集合中存在但 draft 中没有，或 draft 仍未分组：
   - delete。
4. 带 `saveStationCode` 的 station plans 不参与此同步。

## Virtual Trade Station

Virtual trade station 不进入 Virtual Station tab，但仍需要 draft 化地图拖动。

Group draft 应能表达 virtual trade station position，例如：

```ts
tradeStationDraft?: {
  mode: 'player' | 'virtual'
  saveStationCode?: string
  position?: { x: number; y: number; z: number }
}
```

不在 draft 中保存 `sectorMacro`，因为它派生自 group hub：

```ts
tradeStation.sectorMacro = group.sectorMacro
```

拖拽规则：

- Map binding 界面打开即可拖动，不要求 Trade Station tab 激活。
- 只有当前 group 选择 virtual trade station 时可拖。
- drop sector 必须等于 `group.sectorMacro`。
- 拖动只更新 position。
- 不修改 `group.sectorMacro`、coverage、station plan 或 trade station sectorMacro。

Trade Station tab 中，当选项为 virtual 时显示当前坐标。

## 组件边界

### Store

- 持有 virtual station draft。
- 初始化、保留、归属重算。
- 提供创建、移动、删除、应用 actions。
- 持有或更新 virtual trade station draft position。

### Presenter

- 组装 Virtual Station tab UI 数据。
- 提供 drag payload、drop handler 所需 action。
- 负责把 Map overlay 与 store draft 连接。

### Vue

- 渲染 Virtual Station tab。
- 渲染列表和按钮。
- 发出拖拽、删除、blueprint empire selection 事件。
- 不直接调用 store 进行业务组装。

## 不迁入 Step 3 能力

本 change 不迁入：

- save station 列表。
- save station 绑定 blueprint station。
- save station 导入模块规划。
- save station 解绑后转 virtual station。
- trade station / 中转站绑定。
- station plan 详细模块/settings 编辑。
- lockedWares / warePriority 编辑 UI。

这些能力不作为 Virtual Station tab 的职责。
