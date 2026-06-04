# request.md — blueprints-binding

## 目标

在实况（live/save-binding）模式下，让蓝图配方页面基于玩家绑定数据展示蓝图购买能力。页面应同时展示 faction 当前声望、faction+licence 的证书状态，以及蓝图本身的购买分类；蓝图模式（无玩家绑定数据）保持现有行为不变。

原先以 licence 声望进度条和“已持证蓝图状态”为核心的方案作废。本方案中，“已持证”只属于 faction+licence 证书状态；对蓝图来说，已持有所需证书意味着该蓝图 `可购买`。

## 已确认方案（审核重点）

### 1. 双模式行为

- **蓝图模式**（`playerData = null`）：保持当前 `BlueprintRecipeWorkbench` 行为，不显示玩家声望、证书状态颜色、蓝图购买状态 badge 或新增状态过滤。
- **实况模式**（`playerData` 来自当前 save archive）：启用玩家绑定数据展示、证书状态颜色、蓝图购买状态分类和过滤。

### 2. 玩家绑定数据

实况模式使用以下 archive 数据：

- `playerBlueprints: string[]`：玩家已拥有蓝图 ID。
- `playerLicences: Record<string, string[]>`：licence type -> 已购买该证书的 faction ID 列表。该列表来自 save 中 `<licence type="..." factions="...">` 的 `factions` 属性。
- `playerRelations: Record<string, number>`：faction ID -> 当前原始声望值，范围沿用 X4 save 原始值。

缺失字段按空数据处理，但不应影响页面渲染。

玩家是否已持证必须同时匹配 licence type 和 faction ID：只有 `playerLicences[licenceType]` 包含当前 faction ID 时，当前 faction+licence 才能视为已持证。禁止仅因为 `playerLicences[licenceType]` 存在，就把该 licence type 下所有 faction 都标记为已持证。

Game data 中 `faction.licences` 的职责是判断该 faction 是否提供此 licence、证书名称和 `minrelation`；它不代表玩家已经持有该 faction 的证书。

### 3. Faction 行显示

- faction checkbox 前显示该 faction 当前声望。
- 当前声望使用与现有 blueprint-view 一致的显示公式：`ceil(10 * log10(abs(rawRep) * 1000))`，带符号显示（如 `+18`、`-15`）。
- `rawRep = 0` 时显示 `0`，不得显示 `Infinity`、`-Infinity` 或空进度。
- faction 行显示玩家当前声望，不替代 licence 行现有的证书需求声望显示。

### 4. Licence 行状态颜色

licence 行保留现有证书需求声望显示（来自该 faction licence 的 `minrelation`），不显示玩家当前声望或进度条。证书名称按该 faction 下该 licence 的状态着色：

| 证书状态 | 判定条件 | 显示 |
|----------|----------|------|
| `licensed` | `playerLicences[licenceType]` 包含当前 faction ID | 绿色 |
| `eligible` | 未持证，且玩家对该 faction 的当前声望 `>= minrelation` | 橙色 |
| `rep_needed` | 未持证，且当前声望 `< minrelation` | 红色 |
| `default` | 无玩家数据或无法判定 | 蓝色 |

`noblueprintsale` / `nodiplomacyselection` faction 不展示 licence 子项，沿用现有 faction 行占位表现。

### 5. 蓝图购买状态分类

蓝图状态按以下优先级判定：

| 优先级 | 蓝图状态 | 判定条件 |
|--------|----------|----------|
| 1 | `owned` 已拥有 | 蓝图 ID 在 `playerBlueprints` 中 |
| 2 | `no_licence` 无需证书 | 蓝图无 `licence` 字段 |
| 3 | `purchasable` 可购买 | 至少一个销售 faction 的对应 licence 已持有 |
| 4 | `licence_needed` 需购买证书 | 未持证，但至少一个销售 faction 当前声望达到该 licence 的 `minrelation` |
| 5 | `rep_needed` 声望不足 | 有 faction 出售该 licence，但所有相关 faction 声望均不足 |
| 6 | `locked` 不可购买 | 无可用销售 faction、全部不售蓝图/无外交，或无任何 faction 提供该 licence |
| — | `no_player_data` | `playerData === null`（蓝图模式，仅内部状态，不显示） |

“已持证”不是蓝图状态。对蓝图来说，已持有所需证书即为 `purchasable`。

### 6. 蓝图购买状态过滤

在 filter 面板顶部新增「蓝图状态」过滤区域，位于 faction filter 之上。过滤项：

- 已拥有
- 可购买
- 需购买证书
- 声望不足
- 不可购买
- 无需证书

过滤采用包含式语义：默认包含全部状态；取消勾选某状态后隐藏该状态蓝图；所有状态均取消时显示空列表。切换 class 时不重置。

状态计数 N 基于当前 class、搜索条件、faction/licence filter 后统计，但不受蓝图状态 filter 自身影响。

### 7. 蓝图条目增强

- 蓝图名称左侧显示购买状态 badge。
- `owned`、`purchasable`、`licence_needed`、`rep_needed`、`locked`、`no_licence` 分别使用可区分样式。
- 蓝图条目中的 faction+licence tag 按 licence 状态着色：已持证绿色、声望达标未持证橙色、声望不足红色、默认蓝色。
- 不显示旧方案中的 licence 进度条或 `+current/+required` 缺口行；licence 行现有的证书需求声望仍保留。
- `locked` 蓝图显示不可购买原因，例如「阵营不售蓝图」或「无可用销售来源」。

### 8. 三层结构约束

- Store 不新增 UI 定制职责。
- Presenter 接收 game data 与 `playerData`，负责证书状态、蓝图状态、过滤和展示字段组装。
- Vue 组件只消费 Presenter 输出，不直接拼装玩家绑定数据或购买状态逻辑。

## 边界

### In Scope

- 实况模式下显示 faction 当前声望。
- 实况模式下按玩家 licence/relation 数据给 licence 行着色。
- 新增蓝图购买状态分类、badge、过滤和计数。
- 蓝图条目 faction+licence tag 按证书状态着色。
- 蓝图模式保持现有行为不变。
- 处理旧 archive 缺失玩家绑定字段的兼容性。
- `npm run build` 验证。

### Out of Scope

- 修改 save parser、`useSaveStore` 或 `saveArchiveDB` 的数据结构。
- 修改 `blueprints.json` 数据生成。
- 在 licence 行显示进度条。
- 变更或删除 licence 行现有证书需求声望。
- 把“已持证”作为蓝图购买状态。
- 测试代码与测试执行。

## 验收标准（DoD）

1. `npm run build` 成功。
2. 蓝图模式下不显示玩家声望、蓝图状态过滤、状态 badge 或新增颜色语义。
3. 实况模式下 faction checkbox 前显示当前 faction 声望，`rawRep = 0` 显示为 `0`。
4. 实况模式下 licence 行保留证书需求声望，并按已持证/可购买证书/声望不足/default 给证书名称着色。
5. 实况模式下不再显示旧方案的 licence 进度条。
6. 蓝图状态按已拥有、可购买、需购买证书、声望不足、不可购买、无需证书分类正确。
7. 已持证蓝图显示为 `可购买`，不出现“已持证”蓝图状态。
8. 蓝图状态过滤默认包含全部状态；取消状态后隐藏对应蓝图；全取消时列表为空。
9. 状态计数 N 不受蓝图状态 filter 自身影响。
10. `locked` 蓝图显示明确不可购买原因。
11. `noplayerblueprint` 蓝图继续保持现有默认隐藏行为。

## 未决项

无
