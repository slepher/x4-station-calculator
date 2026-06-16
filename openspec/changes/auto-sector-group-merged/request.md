# 自动星区划分合并版 (auto-sector-group-merged)

## 目标

在 Live Production overview 中提供自动星区划分能力：用户绑定或上传存档后，系统根据 hub 识别、星区距离、MST/bridge 连通图和用户编辑输入生成 sector group 草案。Col 2 负责展示和编辑下一次计算输入，Col 3 负责让用户确认每个玩家星区的最终吸收或独立成组方案，确认后一次性写入 `saveBindingStore`。

本合并版整合：
- `auto-sector-group`：自动分组、三列布局、Col 2/Col 3 草稿交互、确认写入。
- `auto-sector-group-link`：MST 最小连通图、bridge 方案、桥接搜索跳数。
- `auto-sector-group-enchanted`：最新编辑态规则，覆盖旧版 `recalcState/exclude`、三 tab、pinned coverage/link 暂停恢复等方案。

冲突处理优先级：`auto-sector-group-enchanted` > `auto-sector-group-link` > `auto-sector-group`。

## 最终行为

### 1. 入口与触发

| 场景 | 触发条件 | 行为 |
|---|---|---|
| SaveList 点击绑定 | guid 无绑定 | 创建 guid 级绑定，载入最新存档，自动分组，Col 2/3 展示草案 |
| SaveList 点击绑定 | guid 有绑定 | 载入存档，若存在未归组玩家星区则运行增量分配 |
| 上传新存档 | 当前无任何绑定 | 创建绑定，自动分组，Col 2/3 展示草案 |
| 上传新存档 | 当前有绑定，且新存档属于当前 guid 最新时间 | 绑定迁移到新存档，运行增量分析 |
| 上传新存档 | 当前有绑定，属于当前 guid 但非最新 | 不分析、不切换 |
| 上传新存档 | 当前有绑定，属于其他 guid 且该 guid 无绑定 | 创建绑定，不分析 |
| 上传新存档 | 当前有绑定，属于其他 guid 且该 guid 已有绑定 | 不做任何事 |

### 2. Live Production 三列布局

| 列 | 内容 |
|---|---|
| Col 1 | 上传存档、分组覆盖跳数、预制容量、存档列表 |
| Col 2 | `SectorConfirmBar` + `SectorGroupList`，展示 group 草案和下一次计算输入 |
| Col 3 | bridge 决策、assignment cards，或确认后的 `EmpireWareFlowsDashboard` |

Col 2 有计算结果态和编辑输入态：
- 计算结果态：参数只读展示，显示 [编辑]。
- 编辑输入态：允许编辑桥接/节点/阈值/覆盖、添加 hub、编辑 group pill，显示 [取消] [计算]。
- 编辑输入态保留 Col 3 当前内容但加遮罩并禁用操作；若 Col 3 是 assignment 视图，遮罩显示“编辑输入中，分配面板暂不可操作”；若是资源视图，不显示遮罩文案。

### 3. 自动分组基础规则

Hub 识别：
- 数据来源为已建成 `modules[]` 与在建 `constructions[]`。
- 只统计 container 容量，排除 solid/liquid。
- Tier 1：`container_cap >= threshold`，score = `cap / (1 + ln(1 + prod_lines))`。
- Tier 2：`container_cap < threshold`，score = `cap`。
- 纯 hub = Tier 1 且 `prod_lines == 0`。

星区距离：
- 同 cluster 内距离为 0。
- 跨 cluster 使用与 `saveBindingUtils.ts:buildSectorGraphFromMaps()` 一致的 cluster gate BFS。
- `sector_links.render.lane_count === 1` 的单向 superhighway 不建双向边。

Clean slate：
- Phase A：纯 hub 建组，玩家星区贪婪分配到覆盖跳数内最近纯 hub。
- Phase B：带产线 Tier 1 在覆盖跳数内自动吸收，超出覆盖跳数但 5 跳内进入存疑。
- Phase C：Tier 2 超出覆盖跳数但 5 跳内自动吸收，Tier 2 不独立成 hub。
- 等距且 score 差距小于 30% 的候选进入存疑。

Incremental：
- 已有 group 使用各自 jumpRange 吸收新玩家星区。
- 预制覆盖跳数只用于新建 group。
- 超出 group jumpRange 但 5 跳内进入需扩展跳数的选择。
- 超过 5 跳建议 standalone。

### 4. MST 与 Bridge

普通 group 的 `connectedGroupIds` 必须由 MST 连接图生成或由用户编辑输入保留：
- 对所有 group anchor 构造 pairwise distance。
- 使用 `distance <= bridgeSearchJumpRange` 的边运行 Kruskal MST。
- 选中边双向写入 `connectedGroupIds`。
- [计算] 时，用户保留的 `connectedGroupIds` 作为固定边，Kruskal 只添加新边，不删除固定边。

Bridge 方案：
- 当 MST 后仍有断裂分量时，生成可减少断裂分量数量的 bridge 方案。
- bridge unit 是同 cluster 内按有效双向 sector graph 划分出的玩家 sector component，不等同 raw cluster。
- 若 cluster 内部因单向 superhighway 或不可往返路径断裂，必须拆成不同 unit。
- 若有多个方案，Col 3 先显示 bridge 方案决策，隐藏普通 assignment cards。
- 若只有一个方案，自动采用；多方案只默认高亮推荐，不自动采用。
- 采用 bridge 后，每个 unit 创建普通 draft group，不新增持久化 bridge marker。

桥接搜索跳数：
- 默认 5，可选 2-5。
- 不得小于分组覆盖跳数；覆盖跳数调高时桥接搜索跳数同步抬高。
- 只影响 MST 和 bridge 搜索，不改变普通 assignment 的 5 跳存疑上限。

### 5. 最新编辑态规则

旧 `recalcState: normal/pin/exclude` 被 `isPinned: boolean` 替代：
- baseline group 进入编辑态时默认 `isPinned=true`。
- 新增 hub draft 和 bridge draft 默认 `isPinned=true`。
- 不再提供 per-group `exclude`。
- baseline group 不可真正删除；取消固定只变为 unpinned，并保留 link、coverage、jumpRange 展示数据。
- 新建 hub draft 可删除。

全局“节点” checkbox：
- 位于 SectorConfirmBar，顺序为 `桥接 | 节点 | 阈值 | 覆盖`。
- 默认启用。
- 关闭后算法不生成新的 pure hub，并禁用阈值与覆盖控件。
- clean slate 且没有可作为初始输入的 baseline/pinned group 时不可关闭。

添加 hub：
- 编辑态 [添加] 打开 `SectorHubAddMenu` fixed overlay。
- 无搜索时列出玩家星区；搜索时遍历全地图 sector，包含无玩家空间站 sector。
- 已是任意 group anchor 的星区不可重复添加。
- 新 hub 可选择非玩家星区作为 anchor。

统一 pill 行：
- 取消 `覆盖星区 | 候选星区 | 连接星区` 三 tab。
- 每个 jump row 混排 coverage、candidate、connected pill。
- coverage 金色，candidate 半金色，connected 绿色。
- baseline 只用粗边框标记，不提供恢复语义。
- 有玩家空间站用实心点，无玩家空间站用空心点。
- 按钮语义：`+` 加入/连接，`×` 移出/断开，`→` 从其他 group active coverage 转入。

### 6. Coverage、Candidate 与 Connection

Coverage/candidate 使用当前 group 自己的 `jumpRange`：
- 增大 jumpRange 时，仅新增跳数层内符合条件且未被其他 group active coverage 占用的玩家星区自动加入 coverage。
- 缩小 jumpRange 时，超出范围的 coverage 移出；若仍符合候选条件则显示为 candidate。
- jumpRange 改回后，只能按普通 candidate `+` 重新加入。
- 修改 coverage jumpRange 不增删连接。

Candidate：
- 可在多个 group 中同时显示。
- active coverage 同一时间只能属于一个 group。
- 若 sector 已是其他 group active coverage，在当前 group 中显示 `→`，点击后转入当前 group。
- 已成为任意 hub anchor 的 sector 不作为 coverage/candidate 显示，改为 connected pill。

Connection：
- hub anchor 统一作为绿色 connected pill 显示。
- 当前 group 到目标 hub anchor 距离 5 跳内即可手动连接。
- 已连接显示 `×`，未连接候选显示 `+`。
- 连接只由 `connectedGroupIds` 表达，不使用 `excludedDefaultConnectedGroupIds`。

### 7. Assignment Option 规则

Col 3 为所有玩家星区生成 card，但任意 hub anchor 不生成普通 assignment card。

对玩家 sector S：
1. 若 S 是任意 group anchor，跳过。
2. 收集所有当前覆盖范围命中的 group，全部成为 option。
3. 若无当前范围命中，收集最小扩展距离层的 group，作为扩展 option，且不默认选中。
4. 若仍无 group option，若 S 是 baseline 星区，可按 baseline group 重新吸收并作为默认；否则仅保留 standalone option。
5. standalone 始终为最后 option，但不作为自动兜底默认。

默认选择：
- `excludedDefaultAssignmentSectorMacros` 中的玩家 sector 不可默认选中对应 group，但仍可手动选择。
- 扩展命中 group 不默认选中。
- 当前范围命中且未 excluded 的 group 按距离、score、stable key 选择默认。
- 若所有命中 option 都被 excluded，则不设置默认选项。

### 8. 确认写入与 Live 继承

确认写入：
- Col 3 全部未决解决后 [确定] 可用。
- 点击 [确定] 一次性写入 `saveBindingStore`。
- bridge/standalone/hub draft 都作为普通 `BindingSectorGroup` 写入。
- 不新增 bridge marker 持久化字段。
- `createAutoGroups` 按 UUID 优先、`sectorMacro` 兜底匹配已有 group，避免 standalone 重建时重复。
- 写入后按最终 group coverage 重建 `sector -> groupId` 映射，并重分配 `stationPlans`。

非玩家 hub：
- 不新增虚拟 stationPlan，不修改 save archive 原始记录。
- 通过现有 `bindSectorGroup` 确保 `BindingSectorGroup.tradeStation` 存在。
- Live transit 页面通过现有 `BindingSectorGroup.tradeStation -> buildTransitHubsFromBinding` 路径继承。

## 边界

In Scope：
- Live Production overview 三列布局下的自动分组、编辑输入和确认写入。
- Hub 识别、clean slate、incremental、MST、bridge、all-hit assignment options。
- `SectorConfirmBar`、`SectorGroupList`、`SectorOverviewPanel`、`SectorHubAddMenu`。
- `GroupDraftInfo.isPinned`、`excludedDefaultAssignmentSectorMacros`。
- i18n 文案。

Out of Scope：
- `MapBindingSectorGroup` 交互改造。
- Terraforming / Research / Blueprint Recipe。
- 把 bridge 扩展为“自动联通所有玩家星区”。

## 验收标准

1. 绑定或上传新 guid 存档后自动创建 binding 并生成 Col 2/3 草案。
2. 已有 guid 有新玩家星区时运行增量分配。
3. Col 2 编辑态支持桥接、节点、阈值、覆盖、添加 hub、统一 pill 行编辑。
4. clean slate 下节点 checkbox 不可取消；有 baseline/pinned 输入时可取消且不生成新 pure hub。
5. 新 hub 可选择非玩家星区，确认后通过 transit hub 逻辑继承。
6. MST 生成 `connectedGroupIds`；断裂时按规则显示或自动采用 bridge 方案。
7. coverage/candidate/connected pill 行为符合 `+`、`×`、`→` 语义。
8. Col 3 每个玩家 sector card 包含所有当前命中 group option；扩展命中和 excluded 不默认选中。
9. standalone 始终为最后 option 且不自动兜底。
10. Col 3 card 身份与顺序在普通选择中保持稳定，只有重新计算或重新运行自动分组时重建。
11. [确定] 后一次性写入 store，Col 3 切换资源视图。
12. `npm run build` 通过。
