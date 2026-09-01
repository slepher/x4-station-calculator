# npc-trade-ui 设计文档

## Context

该页面依赖两个 archive 能力：

- `npc-storage`：NPC station 直属 offers、flags、desired，以及唯一归属的可选 buildStorage。
- `save-player-ships`：player ships 与 `selectedArchivePlayerShips` 可用性分类。

现有代码已经提供：

- `generateFilteredWaresGrouped` 多语言商品搜索。
- `SaveBindingPlan.groups/stationPlans/tradeStation` 玩家整理结构。
- `saveBindingSectorScope` 的 anchor/coverage sector 语义。
- `LiveProductionWorkbenchView.vue` 的 `grid-cols-12`、`3/5/4` 布局。
- `useProductionSidebarPresenter` 与 `ProductionSidebar.vue` 固定入口模式。

本 change 不新增数据适配层，也不新建只为页面筛选服务的 Pinia store。

## Architecture

```text
useSaveStore ───────────────┐
useSaveBindingStore ────────┤
useGameDataStore ───────────┼─> useNpcTradePresenter ─> NpcTradeWorkbench.vue
useActiveViewStore ─────────┤
store/logic/npcTradeOffers ─┘
```

- Store：继续提供 archive、binding、game data 和 active workbench state。
- `store/logic`：提供与 UI 无关的报价分类、目标数量计算和 comparator。
- Presenter：持有页面会话筛选并组装三列展示数据。
- Vue：渲染 presenter props，转发 presenter emits。

## Decisions

### 1. 只增加一个领域逻辑模块、一个 presenter 和一个 workbench SFC

最小新增结构：

```text
src/store/logic/npcTradeOffers.ts
src/components/empire/presenters/useNpcTradePresenter.ts
src/components/empire/NpcTradeWorkbench.vue
```

`NpcTradeWorkbench.vue` 内直接组成三个语义 section。只有在实现中出现可独立复用的真实组件边界时才拆分子组件；不预先创建 filters/candidates/ships 三套 facade。

页面筛选为 presenter 内的 session refs：方向、选中玩家空间站、搜索词、ware targets、主商品、排序指标和 sector 分组开关。离开当前工作台后无需持久化，因此不修改 `SaveBindingPlan` 或 `normalizeState()`。

### 2. live-only 导航使用现有 workbench mode

在现有 mode unions 中增加 `npc-trade`，并由 live sidebar presenter 暴露固定入口。blueprint/empire sidebar 不暴露该 capability。

固定入口顺序为：

```text
overview → npc-trade → blueprint-recipe → research → terraforming
```

`LiveProductionWorkbenchView.vue` 只根据 presenter 提供的 mode 渲染 `NpcTradeWorkbench`；新 SFC 内部不直接调用 store。

### 3. 玩家空间站 selector 从 binding 层级直接组装

Presenter 读取 active binding：

1. 按 `groups.order` 排序 groups。
2. 将 `stationPlans.groupId` 归入对应 group。
3. 将 group 的 `tradeStation` 作为同组可选 station entry。
4. entry sector 精确来自自身 `sectorMacro` 或其明确所属 group anchor；无法确定时禁用。

不读取 archive `player_stations` 来补齐遗漏 entry，也不把未整理的 archive station 加入 selector。

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
  desired: number
}
```

空间站直属 buy 根据 `flags.includes('supplies')` 分类；buildStorage buy 的 source 固定为 `buildStorage`。seller 只从 station 直属 offers 读取。

Presenter 再关联 maps/factions/locales/wares，生成 station card、source label、sector header 和空状态。Store 不输出组件专用 DTO。

### 5. station 身份使用明确静态映射

候选 station card 组合：

- sector：`maps.json` sector nameId → 当前游戏 locale。
- station 名称/类型：优先使用 archive 已解析的 profile/name contract；没有时显示本地化通用“NPC 空间站”，但 code 仍单独显示。
- faction：station owner → `factions.json` nameId → 当前游戏 locale。
- race：使用 `npcTradeOffers.ts` 内一张明确的 faction→race ID 常量表，再用已有 race locale 数据显示。

不能映射的 faction 返回 `null`，presenter 显示“未知”；不得用 faction 名、station code 或图标 fallback 推导。

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

### 8. sector 分组只包裹 station 排序结果

关闭分组时直接显示排序后的 station cards。

开启分组时：

1. 使用 station 的真实 `sectorMacro` 分组。
2. 每组内部使用当前 station comparator。
3. sector 的代表 station 为组内第一名。
4. sector 按代表 station comparator 排序。

不计算第二套 sector 分数，因此切换分组不会改变 station 排名语义。

### 9. 船只分组复用既有可用性与 sector scope

Presenter 从 `selectedArchivePlayerShips` 过滤：

```text
immediatelyAvailable | reclaimable
```

随后按 `sectorMacro` 分组并本地化 sector。对每个 sector，遍历 active binding groups，使用现有 anchor/coverage 判断收集全部命中 group 名称；不只取第一项。

船只条目显示 name/code、class 和 availability。当前 contract 没有可靠 remaining cargo capacity，因此不关联 ware volume 或宣称可装载数量。

### 10. 空状态和异常保持可区分

Presenter 输出互斥状态：

- context unavailable：binding/archive/schema 不可用。
- station not selected：尚未选择玩家空间站。
- wares empty：尚未选择商品。
- target missing：当前排序需要正目标数量。
- no matches：数据可用但没有匹配报价。
- results：存在候选。

`amount=0` 属于 results，不进入 no matches 或 unknown。

## Files and Responsibilities

- `src/store/logic/npcTradeOffers.ts`：方向化报价分类、单 ware comparator、综合评分、sector 排序和 faction→race 映射。
- `src/components/empire/presenters/useNpcTradePresenter.ts`：读取 stores，持有筛选状态，复用 ware search，组装三列 DTO。
- `src/components/empire/NpcTradeWorkbench.vue`：3/5/4 布局与事件转发。
- `src/types/production-ui.ts`、`src/types/production-workbench-contract.ts`、`src/store/useActiveViewStore.ts`：新增 live workbench mode。
- `src/components/empire/presenters/useProductionSidebarPresenter.ts`、`src/components/empire/ProductionSidebar.vue`、`src/components/empire/LiveProductionWorkbenchView.vue`：入口和页面切换。
- `src/locales/en.json`、`src/locales/zh-CN.json`：市场报价、方向、来源、排序与空状态文案。

## Risks / Trade-offs

- [前置 archive schema 尚未完成] → 页面依赖明确版本，不以旧四字段报价降级运行。
- [多 ware 数量单位不可直接比较价值] → 先用 fulfilled count 和 fill ratio 归一，再使用用户明确要求的总数量与金额作为后续 tie-breaker。
- [faction 没有通用 race 字段] → 使用单一显式映射，未知保持未知，不散落猜测逻辑。
- [单 SFC 可能增长] → 首版保持最少文件；仅在出现独立复用或清晰职责边界后拆分。

## Dependencies and Rollout

实现顺序：

1. 完成并合入 `npc-storage` 完整报价/buildStorage contract。
2. 完成并合入 `save-player-ships` archive 与可用性 contract。
3. 实现领域排序和 presenter。
4. 接入 live-only 导航与三列 Vue。
5. 完成中英文文案并运行生产构建。

若任一前置 contract 未满足，`npc-trade-ui` 不应通过旧字段 fallback 提前实现。
