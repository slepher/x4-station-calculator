# design.md — blueprints-binding

## 架构

### 三层结构

```
useSaveStore / selectedArchive（现有数据来源）
    │ playerBlueprints, playerRelations, playerLicences
    ▼
useGameDataStore（现有游戏数据）
    │ blueprintsData, factions
    ▼
useBlueprintRecipePresenter（增强）
    │ playerData 入参
    │ faction rep display
    │ licence purchase state
    │ blueprint purchase status
    │ licence state filter
    │ blueprint status filter
    ▼
BlueprintRecipeWorkbench.vue（渲染）
    │ faction 声望
    │ licence 状态颜色
    │ 蓝图状态 badge / filter
```

Presenter 是购买状态与过滤逻辑的唯一归属。Vue 不直接读取 save store，也不直接计算 licence/blueprint 状态。

## 关键决策

### 1. PlayerBindingData 入参

Presenter 新增可选玩家绑定数据：

```typescript
export interface PlayerBindingData {
  blueprints: string[]
  relations: Record<string, number>
  licences: Record<string, string[]>
}
```

蓝图模式传入 `null`。实况模式从当前 archive 构造该对象。缺失字段在构造时归一为空数组/空对象。

`relations` 来自 `faction-binding` 输出的 `playerRelations`，表示当前有效声望。XML 中 `<relation>` / `<booster>` 的读取和优先级由 `faction-binding` 负责，本变更不得重新读取或解释 save XML 的声望节点。

`licences` 的 value 是 save 中该 `<licence>` 节点 `factions` 属性拆分后的 faction ID 列表。它不是 licence type 的全局 boolean。任何“已持证”判断都必须使用 `(licenceType, factionId)` 二元组。

```typescript
function hasPlayerLicenceForFaction(
  playerData: PlayerBindingData,
  licenceType: string,
  factionId: string,
): boolean {
  return playerData.licences[licenceType]?.includes(factionId) === true
}
```

`faction.licences` 仅用于读取该 faction 是否提供 licence、licence 显示名和 `minrelation`，不得替代 `playerData.licences` 判断玩家是否已持证。

### 2. 声望显示

提供 `formatRelation(raw: number | undefined): string`，其中 `raw` 是 `playerData.relations[factionId]` 的当前有效声望值：

- `raw == null`：显示空或 unknown 样式，不参与达标。
- `raw === 0`：显示 `0`。
- 其他值：`sign * ceil(10 * log10(abs(raw) * 1000))`。

玩家当前声望只显示在 faction checkbox 前。licence 行保留现有证书需求声望显示（`minrelation` 转换值），但不显示玩家当前声望，也不显示进度。

### 3. LicencePurchaseState

每个 faction+licence 组合生成证书状态：

```typescript
type LicencePurchaseState =
  | 'licensed'
  | 'eligible'
  | 'rep_needed'
  | 'default'
```

判定顺序：

1. 无玩家数据 -> `default`
2. `hasPlayerLicenceForFaction(playerData, licenceType, factionId)` -> `licensed`
3. faction licence 缺少 `minrelation` 或玩家声望缺失 -> `default`
4. `playerRelations[factionId] >= minrelation` -> `eligible`
5. 否则 -> `rep_needed`

对应颜色：

- `licensed`：绿色
- `eligible`：橙色
- `rep_needed`：红色
- `default`：蓝色

### 4. BlueprintPurchaseStatus

蓝图状态不包含 `licensed`。已持证是 `purchasable` 的判定依据。

```typescript
type BlueprintPurchaseStatus =
  | 'owned'
  | 'purchasable'
  | 'licence_needed'
  | 'rep_needed'
  | 'locked'
  | 'no_licence'
  | 'no_player_data'
```

判定函数按优先级短路：

1. `playerData === null` -> `no_player_data`
2. `playerData.blueprints` 包含 `bp.id` -> `owned`
3. `bp.licence` 为空 -> `no_licence`
4. 解析 `bp.factions` 中可出售该 licence 的 faction
5. 任一可售 faction 的 licence state 为 `licensed` -> `purchasable`
6. 任一可售 faction 的 licence state 为 `eligible` -> `licence_needed`
7. 存在可售 faction，但均为 `rep_needed` 或 `default` 中可判定不足 -> `rep_needed`
8. 无可售 faction -> `locked`

`noblueprintsale` / `nodiplomacyselection` faction 不作为可售 faction。

`player` / `ownerless` 不在 presenter 中按 faction ID 特判；它们必须由 `scripts/x4-game/factions/converter.py` 在生成 `factions.json` 时写入 `noblueprintsale: true`。这样 faction 行与 `xenon` 等不售蓝图 faction 使用同一展开/销售语义。

Faction filter 排序分两组：

1. 可售蓝图 faction：按显示名排序。
2. `noblueprintsale` / `nodiplomacyselection` faction：统一排在最下面，组内按显示名排序。

### 5. Locked Reason

Presenter 为 locked 蓝图输出 reason code：

```typescript
type BlueprintLockedReason =
  | 'no_seller'
  | 'faction_no_blueprint_sale'
  | 'no_diplomacy'
  | 'unknown_licence'
```

Vue 只负责根据 reason code 渲染 i18n 文案。

### 6. 过滤模型

新增一个包含式 filter：

```typescript
const blueprintStatusFilter = ref<Set<BlueprintPurchaseStatus>>(
  new Set(['owned', 'purchasable', 'licence_needed', 'rep_needed', 'locked', 'no_licence'])
)
```

蓝图模式隐藏该过滤区域，且不应用该 filter。未选择 class 时同样隐藏。

`blueprintStatusAllState` 计算当前全选/部分/全不选状态，`toggleAllBlueprintStatusFilter` 用于全选或全不选切换。

过滤顺序：

1. class
2. search
3. faction/licence filter
4. blueprintStatusFilter（过滤最终蓝图状态）

`statusCounts` 统计当前 class/search/faction/licence 后各蓝图状态数量，但不受 `blueprintStatusFilter` 影响。

### 7. Presenter 输出结构

`factionLicenceTree` 的 licence entry 扩展：

```typescript
interface FactionLicenceEntry {
  factionId: string
  factionName: string
  relationLabel?: string
  licences: {
    id: string
    name: string
    state: LicencePurchaseState
  }[]
}
```

蓝图列表可以继续输出 `filteredBlueprints`，同时提供：

- `blueprintStatusMap`
- `blueprintLockedReasonMap`
- `blueprintStatusCounts`
- `blueprintStatusFilter`
- `blueprintStatusAllState`
- `toggleBlueprintStatusFilter`
- `toggleAllBlueprintStatusFilter`
- `getFactionLicenceState(factionId, licenceType)`

### 8. UI 布局

Filter 面板顺序：

```
蓝图状态
Factions
```

蓝图状态过滤显示计数。

licence 行保留现有证书需求声望显示，并通过 class 改变证书名称颜色。不得添加进度条。

### 9. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/empire/presenters/useBlueprintRecipePresenter.ts` | 修改 | 新增 playerData、证书状态、蓝图状态和过滤逻辑 |
| `src/components/empire/BlueprintRecipeWorkbench.vue` | 修改 | 渲染 faction 声望、证书颜色、蓝图状态 filter/badge |
| `src/components/empire/BlueprintProductionWorkbenchView.vue` | 修改 | 蓝图模式传入 `playerData = null` 或等价 presenter 输入 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | 修改 | 从 archive 构造 `PlayerBindingData` |
| `scripts/x4-game/factions/converter.py` | 修改 | 为 `player` / `ownerless` faction 写入 `noblueprintsale: true` |
| `src/locales/zh-CN.json` | 修改 | 新增蓝图状态、证书状态、locked reason 文案 |
| `src/locales/en.json` | 修改 | 新增对应英文文案 |
