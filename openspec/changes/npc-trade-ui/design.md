# npc-trade-ui 设计文档

## Context

该页面依赖两个 archive 能力：

- `npc-storage`：NPC station 直属 offers、flags、desired，以及唯一归属的可选 buildStorage。
- `save-player-ships`：player ships 与 `selectedArchivePlayerShips` 可用性分类。

现有代码已经提供：

- `generateFilteredWaresGrouped` 多语言商品搜索。
- `BuildGoalSearchBox` 与 `StationModulePicker` 已有向右弹出的分组候选交互，可提取共同边界。
- `SaveBindingPlan.groups/stationPlans/tradeStation` 玩家整理结构。
- `saveBindingSectorScope` 的 anchor/coverage sector 语义。
- `LiveProductionWorkbenchView.vue` 的 `grid-cols-12`、`3/5/4` 布局。
- `useProductionSidebarPresenter` 与 `ProductionSidebar.vue` 固定入口模式。

本 change 不新增数据适配层；新增一个只保存市场报价用户输入的薄 Pinia store，不保存展示 DTO 或派生候选。

## Architecture

```text
useSaveStore ───────────────┐
useSaveBindingStore ────────┤
useGameDataStore ───────────┼─> useNpcTradePresenter ─> NpcTradeWorkbench.vue
useActiveViewStore ─────────┤
useNpcTradeStore ───────────┤
store/logic/npcTradeOffers ─┘
```

- Store：继续提供 archive、binding、game data 和 active workbench state；薄 `useNpcTradeStore` 保存当前应用会话的用户输入。
- `store/logic`：提供与 UI 无关的报价分类、目标数量计算和 comparator。
- Presenter：持有搜索文字等临时交互，读取薄 store，校验上下文并组装三列展示数据。
- Vue：渲染 presenter props，转发 presenter emits。

## Decisions

### 1. 页面领域逻辑保持集中，重复候选交互提取为 common 控件

最小新增结构：

```text
src/store/logic/npcTradeOffers.ts
src/store/useNpcTradeStore.ts
src/components/empire/presenters/useNpcTradePresenter.ts
src/components/empire/NpcTradeWorkbench.vue
src/components/common/CandidateSearchBox.vue
src/components/common/GroupedCandidatePopover.vue
```

`NpcTradeWorkbench.vue` 内直接组成三个语义 section，不预先创建 filters/candidates/ships 三套 facade。商品和模块选择已经在市场报价、BuildPlan 与空间站模块选择中形成相同的搜索/右弹层交互，因此只提取两个职责明确的 common 控件，不增加 adapter、view model 或 facade。

方向、最大跳数、ware targets、主商品、排名方式、排序指标和玩家空间站选择进入薄 `useNpcTradeStore`，因此切换工作台页面不会丢失。sector 分组改为固定展示结构，不再需要开关或 store 状态。搜索词、正常候选页码、各 faction 页码、船只页码和声望不足 faction 展开集合仍是 presenter 内的临时状态。薄 store 只存在于当前应用会话，不修改 `SaveBindingPlan`、`normalizeState()` 或 `localStorage` schema。

三列 section 在模板上同时声明基础 `col-span-12` 和响应式 `lg:col-span-3/5/4`；`.panel-card` scoped 样式不再声明 `col-span-12`，避免 scoped selector specificity 覆盖响应式 utility。

### 2. live-only 导航使用现有 workbench mode

在现有 mode unions 中增加 `npc-trade`，并由 live sidebar presenter 暴露固定入口。blueprint/empire sidebar 不暴露该 capability。

固定入口顺序为：

```text
overview → npc-trade → blueprint-recipe → research → terraforming
```

`LiveProductionWorkbenchView.vue` 只根据 presenter 提供的 mode 渲染 `NpcTradeWorkbench`；新 SFC 内部不直接调用 store。

live workbench 挂载时立即激活 binding archive，保证从地图 archive 预览返回后恢复 binding 选择。Presenter 还会校验 `selectedArchive.meta.guid/time` 与 `binding.gameGuid/selectedArchiveTime` 精确一致；`selectedArchiveTime=null` 时以该 binding 最新 archive meta 为期望值。校验失败期间显示 context unavailable，不读取预览 archive。

### 3. 玩家空间站 selector 复用左侧分组结果

Presenter 读取 active binding 与 live production store 已供左侧使用的 `orderedStationsBySector`：

1. 按 `groups.order` 排序 groups。
2. 按 station 的 `sectorId === group.sectorMacro` 复用左侧同 group 的玩家空间站。
3. 实际存档站使用对应 `playerStationRecord` 的精确 sector 与当前 binding archive position；station plan 使用自身明确绑定。
4. group 的虚拟 `tradeStation` 作为同组可选 entry；已绑定到同一实际站时按 `saveStationCode` 去重。
5. entry sector 无法确定时禁用。

archive `player_stations` 只通过左侧既有的 binding anchor/coverage 分组结果进入二级菜单，不跨 group 平铺。

Vue 使用两个原生 select：一级选 sector group，二级只渲染该 group 的 options；不再使用单个 select 的 `<optgroup>` 伪装二级菜单。切换一级 group 时清空旧 station selection。Presenter 将二级 option 固定组装为 `<sector>-<station>`。选择完成后不再渲染占位 option。

binding 的 canonical group key 是 `group.sectorMacro`。`resolveVirtualStationGroupId` 写入 `stationPlan.groupId` 时返回命中 group 的 `sectorMacro`，不返回 auto-group 临时 `id`。这样 presenter 无需兼容错误关联键。

实际 station entry 的 position 按 `saveStationCode + sectorMacro` 从当前 binding archive 的对应玩家站精确解析；虚拟 station entry 使用 `getSectorZoneBoundingCenter()` 解析的星区中心。map sector 无法解析时保持 position unknown，绝不以 `(0,0,0)` 冒充中心。两种来源为互斥业务分支，不形成 fallback 链。

station option 同时保留其精确 `sectorMacro` 与 `position` 供相对位置计算。binding 或 options 改变后，presenter 校验 session 中的 selected ID；entry 不存在或被禁用时直接清空，不让旧选择继续驱动结果。

### 4. 报价先归一为领域候选，再由 presenter 本地化

`npcTradeOffers.ts` 使用不带 UI 文案的最小领域结构：

```ts
type PlayerTradeDirection = 'buy' | 'sell'
type DemandSource = 'station' | 'supplies' | 'buildStorage'

interface WareTarget {
  wareId: string
  targetQty: number | null
}

interface DemandOffer {
  source: DemandSource
  price: number
  amount: number
  desired?: number
}
```

空间站直属 buy 根据 `flags.includes('supplies')` 分类；buildStorage buy 的 source 固定为 `buildStorage`。seller 只从 station 直属 offers 读取。Presenter 使用 `direction + source` 选择方向化文案：玩家买入的 station seller 显示“空间站出售”/“Station selling”，玩家卖出的 station buy 保持“空间站自身需求”/“Station demand”。parser 已排除缺少或零 `amount` 的买卖单，展示和排序直接使用原始 `amount`；`desired` 仅保留在 archive/领域事实中，不作为数量 fallback，也不进入 presenter 报价展示 DTO。

Presenter 再关联 maps/factions/locales/wares，生成 station card、source label、sector header 和空状态。Store 不输出组件专用 DTO。

### 5. station 身份复用地图 tooltip 语义

候选身份组合：

- sector：`maps.json` sector nameId → 当前游戏 locale。
- station 名称/类型：直接复用 `components/map/savePoiLabel.ts` 的 station label helper，使 factory profile、module group 与 station tag 的名称和地图 tooltip 完全一致。
- sector owner：直接读取解析后的 map sector owner；owner 为空时 sector 标题省略该项。
- station owner：读取 NPC station owner；仅在 station owner 与 sector owner 不同时显示在正常 station card，sector owner 为空时必须显示 station owner。

非空但不能本地化的 owner 显示“未知”。页面不显示 race，也不保留 faction→race 映射。

### 6. 单 ware comparator 是全部排序的唯一基础

共同定义：

```text
targetQty = ware target 的正数值
fillableQty = min(offer.amount, targetQty)
fillRatio = fillableQty / targetQty
```

没有正 targetQty 时，依赖数量门槛的 comparator 返回“条件缺失”，由 presenter 禁用对应选项；不代入默认数量。

玩家卖出时，每个 station/ware 可能包含三类 demand。按指标产生代表值：

| 指标 | 子单代表值 | 顺序 |
| --- | --- | --- |
| 数量 | `max(amount)` | 高到低 |
| 价格 | `max(price)` | 高到低 |
| 足量价格 | 在 `amount >= targetQty` 中取 `max(price)` | 足量先，高价先 |
| 目标总收入 | `max(min(amount,targetQty) × price)` | 高到低 |

玩家买入只消费单一 station seller：

| 指标 | station 值 | 顺序 |
| --- | --- | --- |
| 数量 | `amount` | 高到低 |
| 价格 | `price` | 低到高 |
| 足量价格 | `amount >= targetQty` 后的 `price` | 足量先，低价先 |
| 目标总成本 | 足量时 `targetQty × price` | 足量先，低成本先 |

所有 comparator 最后使用稳定 station key（sectorMacro + code）打破完全相等，不使用 `a || b || c` 形式的业务 fallback 链。

### 7. 多 ware 排名先计算每个 ware，再组合 lexicographic key

主商品排序直接复用单 ware comparator；station 缺少主商品时进入末尾 missing bucket。

综合排序先为每个 station/ware 选出当前方向的最佳可成交 offer，然后构造：

```ts
interface CompositeScore {
  fulfilledWareCount: number
  averageFillRatio: number
  totalFillableQty: number
  totalAmount: number // sell: revenue; buy: cost
}
```

- 玩家卖出：前三项降序，`totalAmount`（收入）降序。
- 玩家买入：前三项降序，`totalAmount`（成本）升序。

缺失 ware 明确贡献 0 fill，不从同 station 的其他 ware 替代。

### 8. 交易资格先分流，再固定生成 sector 层级

Presenter 使用当前游戏版本 faction `tags` 与当前 archive `playerRelations` 对已构建 station candidates 做一次明确分流：

1. owner faction 带 `notradeoffer`：在排序和展示前直接丢弃，不进入任一列表。
2. 普通 faction 且 raw relation `<= -0.01`：进入声望不足列表。
3. 其他普通 faction：进入正常列表。

`rawRelation > -0.01` 是普通交易资格；display `-9/-10` 仅为 raw relation 的非线性显示结果。Presenter 复用 `formatDisplayRelation` 组装 faction 标题，不使用 display 整数反向决定资格。

正常列表固定按真实 `sectorMacro` 分组，不再提供关闭路径。每组内部使用当前 station comparator，sector 以组内第一名为代表排序。sector 标题承载本地化 sector、非空的 sector owner 和跳数；station owner 不从组内 station 推断为 sector owner，仅在不同于 sector owner 时显示在正常 station card，sector owner 为空时必须显示 station owner。same-sector 的精确直线距离仍可留在对应 station，因为它不是 sector 共享值。

声望不足列表放在正常列表之后，保持原排序结果的首次出现顺序按 station owner 分组。资格比较、分组键和 display 声望都读取 station owner，不读取 sector owner。Vue 使用原生 `<details>`/`<summary>` 渲染 station owner，但由 presenter 临时展开集合控制 `open`。折叠时 presenter 输出空 `sectors`，Vue 通过 `v-if` 不挂载内部节点；展开后才复用同一个 sector grouping，将 station 组织为 station-owner→sector→station。内部 sector 标题显示 sector、非空的 sector owner 与跳数，station card 不重复父级已显示的 station owner、sector 或跳数。

两条展示路径都复用现有 station comparator 与 sector grouping；不计算第二套分数，也不将分页或折叠状态写入 store。Presenter 在 grouping 后以 10 个完整 sector 为一页切片，再调用 `toStationCard` 构造当前页 DTO，因此同一 sector 不会跨页，未显示页和折叠 faction 也不会产生卡片 DTO。候选依赖变化时，normal page、faction pages 和展开集合一起重置。

### 9. 船只分组复用既有可用性、静态船型与 sector scope

Presenter 从 `selectedArchivePlayerShips` 过滤：

```text
immediatelyAvailable | reclaimable
```

再用存档 `macro` 关联游戏静态 `X4Ship`，只保留：

```text
ship_l + freighter
ship_m + transporter
```

随后按 `sectorMacro` 分组并本地化 sector。对每个 sector，遍历 active binding groups，使用现有 anchor/coverage 判断收集全部命中 group 名称；不只取第一项。

船只身份分开组装：

- `shipName`：静态飞船本地化名称，例如“苍鹭”。
- `shipType`：静态 `X4Ship.type` 对应的本地化型号，例如“运输船”。
- `size`：由 `ship_l/ship_m` 明确映射为 L/M。
- `customName`：存档 `name` trim 后非空且不匹配 `/^\{\d+,\d+\}$/` 才显示。
- 不输出 component ID 或 code。

容量取静态飞船的 container cargo capacity。对每个已选 ware，若 transport 为 container 且 volume 为正，则最大可装数量为 `floor(capacity / volume)`；否则为 0。该值不读取 targetQty 或当前 archive cargo。

为支持同 sector 距离，既有 player ship archive contract 增加存档坐标，并由 `selectedArchivePlayerShips` 原样携带，不新增 UI adapter。

船只继续先按真实 `sectorMacro` 生成现有 sector groups，再复用候选列表的分页边界，每页显示 10 个完整 sector groups。分页只限制当前 Vue 挂载的 group，不改变 sector 内船只过滤、排序或 group 命中语义；船只集合变化时 presenter 将临时船只页码重置为第一页。

### 10. NPC 与船只相对所选空间站的位置

选中 station option 后，presenter 同时解析其 `sectorMacro` 与 `position`。选择变化或 binding/station options 变化时，若旧 ID 已不存在或禁用则清空选择。

- exact same `sectorMacro`：使用目标与玩家空间站的存档三维坐标计算直线距离，单位转换为 km。
- different `sectorMacro`：复用 `mapSectorGraph.ts` 已有 `buildSectorGraph()` 与 `breadthFirstReachable()`，以当前 `jumpLimit` 动态计算地图跳数；同 cluster 不同 sector 的值可为 0。
- 坐标、地图节点或路径缺失：输出 unknown，不使用其他 archive 或字段 fallback。

选择 station 后显示 session-only `jumpLimit`，使用现有 `X4NumberInput` 且不设置业务最大值。候选 NPC 与船只进入展示分组前均要求存在于本次动态距离表；same-sector 的过滤距离为 0，路径缺失时不进入结果。`sector_reachability.json` 的 5 跳上限只属于静态缓存生成，不参与本页面计算。

商品 targetQty 同样改用现有 `X4NumberInput`，0 仍表示目标数量缺失，不改变既有排序约束。

NPC 与船只复用同一 presenter 内的最小格式化函数，不新增中间层。

### 11. 空状态和异常保持可区分

Presenter 输出互斥状态：

- context unavailable：binding/archive/schema 不可用。
- station not selected：尚未选择玩家空间站。
- wares empty：尚未选择商品。
- target missing：当前排序需要正目标数量，并列出缺失数量的 ware；依赖目标的选项在无效时禁用。
- no matches：数据可用但没有匹配报价。
- results：存在候选。

`amount=0` 的买卖单已在 parser 边界过滤，不进入 presenter results。

### 12. 商品全集与共用候选控件边界

市场报价的商品候选直接来自当前游戏版本 `localizedWaresMap`，其集合与 `wares.json` 一致。Presenter 仅排除已经加入目标药丸的 ware，再复用 `generateFilteredWaresGrouped` 完成多语言匹配和分组：

```text
candidate wares = wares.json - selected wares
```

该集合不读取当前 archive 的 buy/sell offers，也不要求 ware 存在 production module。TEMP/内部商品的排除属于游戏数据生成阶段；UI 不维护 TEMP ID、名称模式或报价白名单。合法商品一旦进入 `wares.json`（包括 `condensate`），就自动成为候选。ware 的 `group` 为空时沿用既有 grouped search 语义归入 `others`。

`others` 是应用界面结构，不是 X4 游戏数据分组。英文 `Others` 和中文“其他”定义在应用 `src/locales/en.json`、`src/locales/zh-CN.json` 的 `common.others`，由 presenter 在组装候选 DTO 时替换原始 `others` label；不得向游戏文本 locale 或 `module_groups.json` 注入该标题。

候选交互拆为两个联动控件：

- `CandidateSearchBox`：query 输入、focus/blur、清空、Escape、焦点快照和基于所属 panel/list 的右侧定位。
- `GroupedCandidatePopover`：Teleport、过渡、分组标题、颜色、DLC 标签和候选选择事件。

两个 common 控件只接收展示 props 并发出交互事件，不直接访问 store。各功能 presenter 负责组装 group/item DTO：

- `useNpcTradePresenter`：全部未选择 ware。
- `useBuildGoalSearchPresenter`：可生产商品或玩家生产模块，保持原 BuildPlan 选择语义。
- `useStationModulePickerPresenter`：父级已过滤的空间站模块。

BuildPlan 的舰队入口继续使用 `FleetGoalSearchBox`，不为表面统一而塞入商品/模块候选 DTO。聚焦商品或模块搜索时，空 query 也显示全部当前候选；选择候选后由调用方执行领域动作并关闭弹出框。

### 13. 薄 store 只保存用户意图

`useNpcTradeStore` 保存两类输入：

- 通用查询输入：direction、jumpLimit、targets、primaryWareId、rankMode、sortMetric。
- binding 上下文选择：bindingGameGuid、selectedPlayerStationGroupId、selectedPlayerStationId。

Presenter 每次进入页面时比较当前 `activeBinding.gameGuid` 与 store 的 `bindingGameGuid`。首次进入记录当前 GUID；GUID 改变时只清除 group/station，继续保留通用查询输入。相同 binding 的 groups、stationPlans、tradeStation 或 archive 改变时，既有 `stationGroups` immediate watch 继续验证 group/station：group 消失时清除两级选择，station 消失、移动到其他 group 或禁用时只清除 station。

以下内容不进入薄 store：searchQuery、候选弹窗状态、normal/faction/ship 页码、faction 展开集合、stationGroups、jumpDistances、sortedCandidates、candidateSections、ineligibleFactionGroups、shipGroups 和 pageState。NPC 与船只候选继续由 presenter 的 reactive computed 从当前 archive、binding、地图数据和 store 输入派生。这样新 archive、玩家声望、星区结构、空间站位置或 coverage 变化会自然生成新结果，不需要维护不完整的缓存失效键。

## Files and Responsibilities

- `rust-parser/src/model.rs`、`rust-parser/src/core.rs`、`src/types/saveArchive.ts`：为 player ship archive contract 保留存档坐标。
- `src/store/logic/npcTradeOffers.ts`：方向化报价分类、单 ware comparator、综合评分、普通交易资格分流和 sector 排序。
- `src/store/useNpcTradeStore.ts`：保存当前应用会话的市场报价用户输入和 binding 归属，不持久化派生候选。
- `src/components/empire/presenters/useNpcTradePresenter.ts`：读取 stores，持有临时搜索、候选/船只分页和 faction 展开状态，校验 binding/空间站选择，复用 ware search，并输出当前页正常 sector、已展开声望不足 faction→sector 与 ship sector groups。
- `src/components/empire/NpcTradeWorkbench.vue`：3/5/4 布局与事件转发。
- `src/components/common/CandidateSearchBox.vue`、`src/components/common/GroupedCandidatePopover.vue`：无 store 依赖的搜索交互与右侧分组弹出框。
- `src/components/empire/presenters/useBuildGoalSearchPresenter.ts`、`src/components/empire/presenters/useStationModulePickerPresenter.ts`：为既有 BuildPlan 商品/模块和空间站模块入口组装共用候选 DTO。
- `src/components/empire/BuildGoalSearchBox.vue`、`src/components/empire/StationModulePicker.vue`：复用 common 控件并保持既有领域事件；舰队搜索仍使用 `FleetGoalSearchBox`。
- `src/types/production-ui.ts`、`src/types/production-workbench-contract.ts`、`src/store/useActiveViewStore.ts`：新增 live workbench mode。
- `src/components/empire/presenters/useProductionSidebarPresenter.ts`、`src/components/empire/ProductionSidebar.vue`、`src/components/empire/LiveProductionWorkbenchView.vue`：入口和页面切换。
- `src/locales/en.json`、`src/locales/zh-CN.json`：市场报价、方向、来源、排序与空状态文案。

## Risks / Trade-offs

- [前置 archive schema 尚未完成] → 页面依赖明确版本，不以旧四字段报价降级运行。
- [多 ware 数量单位不可直接比较价值] → 先用 fulfilled count 和 fill ratio 归一，再使用用户明确要求的总数量与金额作为后续 tie-breaker。
- [玩家船只没有坐标] → 在既有 parser/player ship contract 增加解析时已知的 world position，不在 UI 推测。
- [单 SFC 可能增长] → 首版保持最少文件；仅在出现独立复用或清晰职责边界后拆分。
- [`wares.json` 暂时仍含 TEMP 商品] → 不在市场报价建立第二套过滤；由数据生成 change 在源头剔除，合并后所有消费者同时收敛。
- [合法 ware 缺少 group] → 沿用 `generateFilteredWaresGrouped` 的 `others` 分组，不在 UI 猜测业务分类。
- [保存派生候选会在 archive 或 binding 编辑后过期] → 薄 store 只保存输入，候选始终从当前依赖重新派生；若未来实测存在性能问题，再为领域计算增加完整依赖键缓存。
- [特殊 faction 的内部 NPC 交易事件被误认为玩家报价] → 先按 `notradeoffer` 硬排除 owner faction；`moneyvirtual` 不作为货币类型或可交易资格。
- [display 声望的整数边界掩盖 raw relation] → 资格直接比较 raw relation `> -0.01`，仅在 faction 标题格式化 display 声望。
- [常用商品和较大跳数导致候选卡片成百上千] → 在 sector grouping 后按每页 10 个完整 sector 切片，并在切片后才构造 station card；折叠 faction 输出空 sectors。若单个 sector 自身成为实测瓶颈，再评估虚拟列表，不提前拆分 sector。

## Dependencies and Rollout

实现顺序：

1. 完成并合入 `npc-storage` 完整报价/buildStorage contract。
2. 完成并合入 `save-player-ships` archive 与可用性 contract。
3. 实现领域排序和 presenter。
4. 接入 live-only 导航与三列 Vue。
5. 完成中英文文案并运行生产构建。

若任一前置 contract 未满足，`npc-trade-ui` 不应通过旧字段 fallback 提前实现。
