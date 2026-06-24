# auto-sector-group-one-core Request

## 目标

定义自动星区分组的核心领域行为：从玩家空间站和星区图生成 hub groups、coverage、connections、bridge groups、assignment options，并在确认时写入 binding。Trade station 选择属于 group 写入的核心数据，因此并入本 change，而不是作为独立 change。

本 change 不负责 Live/Map 面板如何共享 draft，也不负责地图侧栏和颜色渲染；这些分别由 `auto-sector-group-one-binding` 和 `auto-sector-group-one-map` 承担。

## 已确认方案（审核重点）

### Hub 与基础分组

- Hub 容量只统计 `container` cargo，不统计 `solid` 或 `liquid`。
- Hub 容量必须合并已建模块 `modules[]` 和在建模块 `constructions[]`。
- Pure hub 是 container 容量达到阈值且生产线数为 0 的玩家站。
- Hub score 使用 `cap / (1 + ln(1 + prod_lines))`。
- Clean slate 模式先扫描所有玩家站并生成 sector 级 hub 信息；`generateHubs=true` 时从 pure hubs 创建初始 groups，再将覆盖跳数内玩家星区分配给最近 hub。
- Clean slate 下若 `generateHubs=false`，不得自动生成新的 pure hub，只使用 pinned/手动输入 hub 继续计算。
- Incremental 模式以已保存 groups 作为 baseline input，既有 group 使用自己的 `jumpRange`，新 group 使用当前默认覆盖跳数。
- Sector 默认归属必须按明确规则决定：当前覆盖范围命中且未被 `excludedDefaultAssignmentSectorMacros` 排除的 group 才可默认；多命中时按距离、hub score、稳定 key 决胜；等距且 score 差距小于 30% 时 unresolved。
- 等距且 hub score 差距小于 30% 的玩家星区必须成为 unresolved assignment。
- 超出覆盖跳数但在 5 跳内的 Tier 2 玩家星区可生成扩展吸收 option，但不得自动独立成 hub。

### 星区图、MST 与 bridge

- 单向 superhighway 不得作为双向可达边。
- `computeGroupGraph()` 基于 group anchor 之间的距离构建 MST，并双向写入 `connectedGroupIds`。
- Link 生成只在 anchor pair 距离小于等于 `bridgeSearchJumpRange` 时作为候选边。
- 用户保留的连接是固定边；重新计算时 MST 只补充缺失边，不删除固定边。
- 保留连接按每条 link 独立判定：任一端 group 的 `connectionRetainEnabled=true` 时该 link 作为 fixed edge，双方都关闭时该 link 不作为 fixed edge。
- bridge unit 必须基于有效双向连通 component，而不是 raw cluster。
- 多个 bridge plan 存在时，普通 assignment 必须被 bridge decision gate 阻塞。
- 只有一个有效 bridge plan 时可自动采用。
- Bridge draft group 最终作为普通 `BindingSectorGroup` 持久化，不新增 bridge marker 持久化字段。

### 编辑态与 pill

- 编辑态表示“下一次计算输入编辑”，不是直接修改最终 binding。
- 进入编辑态时不创建恢复 snapshot；已有 groups 标记为 `baseline=true` 且默认 `isPinned=true`。
- Baseline group 取消固定后保留展示但不参与下一次计算，不被物理删除。
- 手动新增 hub 和 bridge group 可以删除。
- 退出编辑只切回 result 模式，不恢复 draft；如需回到最近一次计算结果，由 binding 层的 [重置] 使用 `calculationBaseline` 恢复。
- Sector group card 在非编辑态展示 group 名称、anchor sector、选中的 trade station、覆盖跳数、统一 pill rows、覆盖星区数和 uncertain 数量；非编辑态不得显示 retain checkbox、pin/unpin、删除和 pill 操作按钮。
- Sector group card 在编辑态展示 connection/coverage/trade station retain checkbox、pin/unpin 按钮、可编辑 jumpRange、可操作 pill action；仅 `isNew && !baseline` 的 hub 显示删除按钮。
- Coverage、candidate、connected pill 在统一 jump row 中混排，不再恢复旧三 tab UI。
- Coverage `×`、candidate `+`、candidate transfer `→` 和 connected `+ / ×` 都必须即时更新当前 draft。
- Card 中任何 sector 归属变更都必须同步重建 ordinary assignments：coverage 移出、candidate 加入、transfer、jumpRange 变化、hub 添加/删除后，assignment cards 的选项、默认值和 resolved/unresolved 状态必须与当前 draft 一致。
- Assignment 同步不得改变仍存在 card 的身份和排序；只更新 card 内部 option/default/selected 状态，新增/删除 card 只发生在 sector 变为 hub anchor 或不再是 hub anchor 时。
- Baseline/current diff 只用于视觉标记：baseline pill 用普通边框保留基线感知，新增 pill 用加粗边框/侧边色块，removed pill 用虚线和弱化样式；这些标记不得表达恢复语义。

### Hub 添加/移除与 station 生成

- 添加 hub 时，已是任意 group anchor 的 sector 不得重复添加。
- 添加玩家 sector hub 时，该 sector 从其他 group active coverage 中移除，且不再生成 ordinary assignment card。
- 添加非玩家 sector hub 时，不新增虚拟 `stationPlan`，不修改 save archive 原始记录；确认时通过 `BindingSectorGroup.tradeStation` 保存 transit hub 定位。
- 添加 hub draft 后必须同步生成该 group 的 trade station 候选和默认选择：有玩家站时按手动 hub 候选规则，无玩家站时生成虚拟交易站默认值。
- 删除新 hub draft 时，必须移除该 group、移除指向它的 connections、移除对应 trade station 状态，并重新生成受影响玩家 sector 的 assignment options。
- 删除 hub 后，不得遗留 orphan assignment、orphan connection、orphan trade station card 或重复 standalone group。

### Assignment 与确认

- Hub anchor sector 不生成普通 assignment card。
- 玩家 sector 位于多个 group 当前覆盖范围时，所有命中 group 都必须作为 option。
- 无当前命中时，只保留最小扩展距离层的 group options，且扩展 option 不默认选中。
- 若无当前命中且存在 baseline group 可重新吸收该 sector，则可按 baseline group 生成默认吸收；否则仅保留 standalone option。
- Excluded default group 仍可手动选择，但不得默认选中。
- Standalone 始终作为最后 option，且不得作为自动 fallback 默认值。
- 用户选择 assignment 后不得改变 card 身份和顺序。
- 确认时按 UUID 优先、`sectorMacro` 兜底匹配已有 group，避免重复 standalone group。
- 确认时重建 `sector -> groupId`，并按最终 coverage 重分配 station plans。
- 确认时必须先写入最终 groups/coverage/connections/trade station，再按最终 group 结果处理 virtual station drafts。
- 无 `saveStationCode` 的 virtual station plans 按最终 group 归属同步；仍未分组的 virtual station 不写回 binding。
- 带 `saveStationCode` 的 save station plans 不得被 virtual station 同步流程修改。

### Trade station

- 每个 hub group 都必须有 trade station 选择。
- 自动 hub 候选来自 anchor sector 内玩家站，按 score 排序，最多 top 5，并保护 pure hub。
- 手动 hub 和 bridge hub 有 qualified 站时只列 qualified；没有 qualified 时列全部玩家站。
- 无玩家站 hub 使用虚拟交易站，默认选中。
- Mixed pure hub/生产站候选中，若第一名不是 pure hub，则不自动默认。
- 全生产站候选中，第一名 score 大于第二名 1.3 倍才默认选中。
- Trade station retain 开启且存在 saved code 时，重算默认值优先使用 saved code。
- `__virtual__` 只存在于 UI/计算层，持久化时不得写入 `saveStationCode`。
- 用户选择不得被旧的 `hubStationCode` 或 fallback best station 逻辑覆盖。
- Virtual trade station 的 `sectorMacro` 是 group hub `sectorMacro` 的派生结果；拖动只能改变 position，不得改变 trade station `sectorMacro`、group `sectorMacro`、coverage 或 station plan。

## 边界

### In Scope

- Hub detection、clean slate、incremental、sector graph distance。
- MST connections、bridge plan、bridge group 持久化。
- 编辑态输入、统一 pill 行、assignment option 与 confirm 写入。
- Sector group card 的编辑态/非编辑态展示、操作按钮和 baseline/current diff 标记。
- Trade station 候选、默认、retain、reset、confirm gate 与持久化。
- `BindingSectorGroup.tradeStation` 相关核心数据写入。
- Confirm 后 station plan group assignment 与 virtual station 同步的不变量。

### Out of Scope

- Live/Map 共享 draft 生命周期。
- Live 展示/计算双模式。
- Map 侧栏 UI、focus-sector、地图色块渲染。
- Hub color 自动分配和地图染色。
- Terraforming、research、blueprint recipe 等非 auto-sector-group 能力。

## 验收标准（DoD）

- 自动分组生成的 groups、coverage、connections、assignments 与 trade station 状态符合本 change specs。
- 编辑态输入可以实时修改 shared draft，但不会直接污染最终 binding；只有确认动作写入持久化。
- 确认前 bridge、assignment、trade station 未决项均被 gate。
- 确认后 groups、coverage、connections、station plan group assignment、trade station 均写入一致。
- 确认后 virtual station plans 只同步无 `saveStationCode` 的草案；save station plans 保持不变。
- 不引入已移除的 `recalcState`、per-group `exclude`、旧三 tab pill UI 或 bridge marker 持久化字段。

## 未决项

无。
