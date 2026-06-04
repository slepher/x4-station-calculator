# Blueprints-Binding Specification

## Purpose

为实况模式下的蓝图配方页面定义玩家绑定数据展示、证书状态着色、证书状态过滤和蓝图购买状态分类。蓝图模式下此规格不生效，现有行为 SHALL 保持不变。

## ADDED Requirements

### Requirement: Live Player Binding Data

实况模式 SHALL 使用玩家已拥有蓝图、已购买证书和当前 faction 声望来驱动蓝图配方页面展示。

#### Scenario: use player binding data in live mode

- **前提** 当前为实况模式
- **前提** 当前 archive 包含 `playerBlueprints`、`playerLicences`、`playerRelations`
- **当** 蓝图配方页面渲染
- **那么** 页面 SHALL 基于这些玩家绑定数据展示 faction 声望、证书状态和蓝图购买状态

#### Scenario: player licence is faction scoped

- **前提** 当前为实况模式
- **前提** `playerLicences[licenceType]` 包含 faction A，但不包含 faction B
- **当** 判定 faction A 和 faction B 下同一 licence type 的证书状态
- **那么** faction A 的该 licence SHALL 视为已持证
- **并且** faction B 的该 licence SHALL NOT 仅因 licence type 相同而视为已持证

#### Scenario: missing player binding fields are empty

- **前提** 当前为实况模式
- **前提** 当前 archive 缺少部分玩家绑定字段
- **当** 蓝图配方页面渲染
- **那么** 缺失的 `playerBlueprints` SHALL 视为 `[]`
- **并且** 缺失的 `playerLicences` SHALL 视为 `{}`
- **并且** 缺失的 `playerRelations` SHALL 视为 `{}`
- **并且** 页面 SHALL NOT 抛错

#### Scenario: no player binding display in blueprint mode

- **前提** 当前为蓝图模式（`playerData === null`）
- **当** 蓝图配方页面渲染
- **那么** SHALL NOT 显示玩家声望、证书状态过滤、蓝图状态过滤或蓝图状态 badge

### Requirement: Faction Reputation Display

实况模式下 faction 行 SHALL 在 checkbox 前显示玩家对该 faction 的当前声望。

#### Scenario: faction row shows current reputation

- **前提** 当前为实况模式
- **前提** `playerRelations` 包含当前 faction 的原始声望值
- **当** 渲染 faction filter 行
- **那么** faction checkbox 前 SHALL 显示当前声望
- **并且** 正声望 SHALL 带 `+` 前缀
- **并且** 负声望 SHALL 带 `-` 前缀

#### Scenario: zero reputation displays zero

- **前提** 当前 faction 的原始声望为 `0`
- **当** 渲染 faction filter 行
- **那么** 声望 SHALL 显示为 `0`
- **并且** SHALL NOT 显示 `Infinity` 或 `-Infinity`

#### Scenario: licence row keeps required reputation

- **前提** 当前为实况模式
- **当** 渲染 licence 子项
- **那么** licence 行 SHALL 保留该证书的需求声望显示
- **并且** licence 行 SHALL 显示证书名称
- **并且** licence 行 SHALL NOT 显示玩家当前声望
- **并且** licence 行 SHALL NOT 显示进度条

### Requirement: Licence Purchase State Coloring

实况模式下每个 faction+licence 子项 SHALL 根据玩家是否持证、是否声望达标来着色。

#### Scenario: licensed licence is green

- **前提** 当前为实况模式
- **前提** `playerLicences[licenceType]` 的 faction 列表包含当前 faction ID
- **当** 渲染该 licence 子项
- **那么** licence 名称 SHALL 使用绿色样式

#### Scenario: same licence type without matching faction is not licensed

- **前提** 当前为实况模式
- **前提** `playerLicences[licenceType]` 存在
- **前提** `playerLicences[licenceType]` 的 faction 列表不包含当前 faction ID
- **当** 渲染当前 faction 的该 licence 子项
- **那么** licence 名称 SHALL NOT 使用已持证绿色样式

#### Scenario: eligible licence is orange

- **前提** 当前为实况模式
- **前提** 玩家未持有当前 faction 的该 licence
- **前提** 玩家对该 faction 的当前声望大于等于该 licence 的 `minrelation`
- **当** 渲染该 licence 子项
- **那么** licence 名称 SHALL 使用橙色样式

#### Scenario: reputation needed licence is red

- **前提** 当前为实况模式
- **前提** 玩家未持有当前 faction 的该 licence
- **前提** 玩家对该 faction 的当前声望小于该 licence 的 `minrelation`
- **当** 渲染该 licence 子项
- **那么** licence 名称 SHALL 使用红色样式

#### Scenario: default licence is blue

- **前提** 当前为蓝图模式，或当前 licence 状态无法基于玩家数据判定
- **当** 渲染该 licence 子项
- **那么** licence 名称 SHALL 使用蓝色默认样式

#### Scenario: no licence children for non-selling factions

- **前提** faction 为 `noblueprintsale` 或 `nodiplomacyselection`
- **当** 渲染 faction filter
- **那么** SHALL NOT 显示该 faction 的 licence 子项
- **并且** SHALL 保持现有 faction 行占位和 checkbox 行为

### Requirement: Blueprint Purchase Status Classification

实况模式下每条蓝图 SHALL 基于玩家绑定数据判定最终购买状态。已持证不是蓝图状态；已持有所需证书的蓝图 SHALL 视为可购买。

#### Scenario: owned status when blueprint is already owned

- **前提** 当前为实况模式
- **前提** 蓝图 ID 存在于 `playerBlueprints`
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `owned`
- **并且** SHALL 不继续检查 licence 或声望

#### Scenario: no licence status

- **前提** 当前为实况模式
- **前提** 蓝图无 `licence` 字段
- **前提** 蓝图 ID 不存在于 `playerBlueprints`
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `no_licence`

#### Scenario: purchasable when required licence is held

- **前提** 当前为实况模式
- **前提** 蓝图 ID 不存在于 `playerBlueprints`
- **前提** 蓝图有 `licence`
- **前提** 至少一个销售 faction 的该 licence 状态为 `licensed`
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `purchasable`

#### Scenario: licence needed when certificate can be bought

- **前提** 当前为实况模式
- **前提** 蓝图 ID 不存在于 `playerBlueprints`
- **前提** 蓝图有 `licence`
- **前提** 玩家未持有任一销售 faction 的该 licence
- **前提** 至少一个销售 faction 的该 licence 状态为 `eligible`
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `licence_needed`

#### Scenario: reputation needed when certificate cannot yet be bought

- **前提** 当前为实况模式
- **前提** 蓝图 ID 不存在于 `playerBlueprints`
- **前提** 蓝图有 `licence`
- **前提** 有 faction 出售该 licence
- **前提** 所有销售 faction 的该 licence 状态均不是 `licensed` 或 `eligible`
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `rep_needed`

#### Scenario: locked when no selling source exists

- **前提** 当前为实况模式
- **前提** 蓝图 ID 不存在于 `playerBlueprints`
- **前提** 蓝图有 `licence`
- **前提** 无可用销售 faction，或所有相关 faction 均不售蓝图/无外交
- **当** 判定该蓝图状态
- **那么** 状态 SHALL 为 `locked`
- **并且** SHALL 提供不可购买原因

#### Scenario: no player data status in blueprint mode

- **前提** 当前为蓝图模式
- **当** 判定蓝图状态
- **那么** 状态 SHALL 为 `no_player_data`
- **并且** SHALL NOT 显示任何蓝图状态 badge

### Requirement: Blueprint Status Filter

实况模式下 filter 面板 SHALL 提供蓝图最终购买状态过滤。

#### Scenario: blueprint status filter is shown in live mode

- **前提** 当前为实况模式
- **当** 渲染 filter 面板
- **那么** SHALL 显示「蓝图状态」过滤区域
- **并且** SHALL 包含「已拥有」「可购买」「需购买证书」「声望不足」「不可购买」「无需证书」

#### Scenario: blueprint status filter is inclusive

- **前提** 当前为实况模式
- **前提** 所有蓝图状态默认勾选
- **当** 用户取消勾选「需购买证书」
- **那么** 蓝图列表 SHALL 隐藏状态为 `licence_needed` 的蓝图

#### Scenario: all blueprint statuses unchecked shows empty list

- **前提** 当前为实况模式
- **前提** 用户取消勾选所有蓝图状态
- **当** 过滤生效
- **那么** 蓝图列表 SHALL 为空

#### Scenario: blueprint status filter persists across class changes

- **前提** 用户已设置蓝图状态过滤
- **当** 用户切换左侧 class
- **那么** 蓝图状态过滤 SHALL 保持不变

#### Scenario: blueprint status counts ignore status filter

- **前提** 当前为实况模式
- **前提** 用户设置了蓝图状态过滤
- **当** 计算状态数量 N
- **那么** N SHALL 基于当前 class、搜索和 faction/licence filter 后的结果
- **并且** N SHALL NOT 受蓝图状态 filter 自身影响

#### Scenario: blueprint status filter hidden in blueprint mode

- **前提** 当前为蓝图模式
- **当** 渲染 filter 面板
- **那么** SHALL NOT 显示「蓝图状态」过滤区域

### Requirement: Blueprint Item Status Display

实况模式下蓝图条目 SHALL 显示最终购买状态，并按证书状态给 faction+licence tag 着色。

#### Scenario: blueprint item shows purchase status badge

- **前提** 当前为实况模式
- **当** 渲染蓝图条目
- **那么** 蓝图名称左侧 SHALL 显示其购买状态 badge

#### Scenario: held licence means purchasable badge

- **前提** 当前为实况模式
- **前提** 蓝图所需 licence 已由至少一个销售 faction 持有
- **当** 渲染蓝图条目
- **那么** badge SHALL 显示「可购买」
- **并且** SHALL NOT 显示「已持证」蓝图状态

#### Scenario: faction licence tags use licence state colors

- **前提** 当前为实况模式
- **当** 渲染蓝图条目的 faction+licence tag
- **那么** 已持证 tag SHALL 使用绿色
- **并且** 声望达标未持证 tag SHALL 使用橙色
- **并且** 声望不足 tag SHALL 使用红色
- **并且** 默认 tag SHALL 使用蓝色

#### Scenario: locked blueprint shows reason

- **前提** 蓝图状态为 `locked`
- **当** 渲染蓝图条目
- **那么** SHALL 显示不可购买原因

#### Scenario: no extra status display in blueprint mode

- **前提** 当前为蓝图模式
- **当** 渲染蓝图条目
- **那么** SHALL NOT 显示购买状态 badge
- **并且** SHALL NOT 应用玩家绑定数据驱动的 tag 颜色

### Requirement: Backward Compatibility

蓝图模式下的所有行为 SHALL 与改动前保持一致。

#### Scenario: blueprint mode unchanged

- **前提** 当前为蓝图模式
- **当** `BlueprintRecipeWorkbench` 渲染
- **那么** 现有 type/class 导航、搜索、faction/licence filter 和蓝图列表行为 SHALL 保持不变
- **并且** `noplayerblueprint` 蓝图 SHALL 继续保持现有默认隐藏行为
