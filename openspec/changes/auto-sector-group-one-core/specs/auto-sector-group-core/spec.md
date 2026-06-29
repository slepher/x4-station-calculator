# Auto Sector Group Specification

## Purpose

定义 Live Production overview 中自动星区划分的最终行为：系统 SHALL 在绑定或上传存档后生成 sector group 草案，支持 MST/bridge 连通、Col 2 下一次计算输入编辑、Col 3 玩家星区归属确认，并在用户确认后一次性写入 save binding。

## ADDED Requirements

### Requirement: Automatic Grouping Entry Points

系统 MUST 在 Live Production 绑定和上传入口中按 guid 绑定状态触发自动星区划分或增量分配。

#### Scenario: guid 无绑定时点击绑定按钮
- **前提** 用户在 SaveList 中点击某个 save guid 的绑定按钮
- **并且** 该 guid 当前没有 binding
- **当** 系统处理绑定
- **那么** 系统 SHALL 创建 guid 级 binding
- **并且** SHALL 载入该 guid 的最新存档
- **并且** SHALL 运行自动星区划分
- **并且** SHALL 在 Live Production overview 的 Col 2/Col 3 展示草案

#### Scenario: guid 已绑定且存在未归组玩家星区
- **前提** 用户在 SaveList 中点击某个 save guid 的绑定按钮
- **并且** 该 guid 已有 binding
- **并且** 最新存档中存在未归入任何 group 的玩家星区
- **当** 系统处理绑定
- **那么** 系统 SHALL 载入存档
- **并且** SHALL 运行增量分配
- **并且** SHALL 保留已有 group 作为 baseline 输入

#### Scenario: 上传新 guid 存档且当前没有任何绑定
- **前提** 用户上传新存档
- **并且** 当前没有任何 binding
- **当** 系统识别存档 guid
- **那么** 系统 SHALL 创建 binding
- **并且** SHALL 运行自动星区划分
- **并且** SHALL 展示 Col 2/Col 3 草案

#### Scenario: 上传当前 guid 最新存档
- **前提** 用户上传新存档
- **并且** 当前已有 binding
- **并且** 新存档属于当前 guid
- **并且** 新存档是该 guid 最新时间
- **当** 系统完成导入
- **那么** 系统 SHALL 将 binding 迁移到新存档
- **并且** SHALL 运行增量分析

#### Scenario: 上传当前 guid 非最新存档
- **前提** 用户上传新存档
- **并且** 当前已有 binding
- **并且** 新存档属于当前 guid
- **并且** 新存档不是该 guid 最新时间
- **当** 系统完成导入
- **那么** 系统 SHALL 不运行自动分析
- **并且** SHALL 不切换当前 binding

### Requirement: Three-Column Auto Group Overview

系统 MUST 在 Live Production overview 使用三列布局展示自动分组入口、group 草案和 assignment/bridge 决策。

#### Scenario: 自动分组草案展示
- **前提** 自动星区划分已生成草案
- **当** overview 渲染
- **那么** 面板顶部 SHALL 显示共用 `AutoSectorBar`
- **并且** Col 1 SHALL 显示 `SectorGroupStatBar` 和 `SectorGroupList`
- **并且** Col 2 SHALL 显示 bridge 决策和 assignment cards
- **并且** Col 3 SHALL 显示 trade station cards 或确认后的资源视图

#### Scenario: 编辑输入态遮罩 Col 3
- **前提** Col 2 处于编辑输入态
- **当** Col 3 当前显示 assignment cards
- **那么** 系统 SHALL 保留 Col 3 当前内容
- **并且** SHALL 禁用 Col 3 所有操作
- **并且** SHALL 显示“编辑输入中，分配面板暂不可操作”的遮罩提示

#### Scenario: 资源视图编辑遮罩不显示提示文案
- **前提** Col 2 处于编辑输入态
- **并且** Col 3 当前显示资源视图
- **当** 系统渲染遮罩
- **那么** 系统 SHALL 禁用 Col 3 操作
- **并且** SHALL 不显示 assignment 编辑提示文案

### Requirement: Hub Detection and Base Assignment

系统 MUST 依据 container 容量、产线数量、星区距离和阈值识别 hub 并生成基础分组。

#### Scenario: Container-only hub capacity
- **前提** 存档中 station 同时包含 `container`、`solid` 或 `liquid` cargo 模块
- **当** 系统计算 hub 容量
- **那么** 系统 SHALL 只统计 `container` 容量
- **并且** SHALL 合并已建成 `modules[]` 与在建 `constructions[]`

#### Scenario: Pure hub detection
- **前提** 某 station 的 container 容量大于或等于阈值
- **并且** 该 station 的产线数为 0
- **当** 系统检测 hub
- **那么** 系统 SHALL 将该 station 所在 sector 识别为 pure hub 候选

#### Scenario: Tier 1 score formula
- **前提** 某 station 的 container 容量大于或等于阈值
- **当** 系统计算 hub score
- **那么** 系统 SHALL 使用 `cap / (1 + ln(1 + prod_lines))`

#### Scenario: Single-direction superhighway excluded from bidirectional graph
- **前提** maps 数据中存在 `sector_links.render.lane_count === 1`
- **当** 系统构建星区图
- **那么** 系统 SHALL 不将该 link 作为双向可达边

#### Scenario: Clean slate pure hub grouping
- **前提** 当前 guid 没有已有 group
- **并且** `generateHubs=true`
- **当** 系统运行 clean slate 分组
- **那么** 系统 SHALL 为 pure hub 创建初始 group
- **并且** SHALL 将覆盖跳数内玩家星区分配到最近 pure hub

#### Scenario: Generate hubs disabled uses only input hubs
- **前提** 当前存在 baseline 或手动输入 hub
- **并且** `generateHubs=false`
- **当** 系统运行 clean slate 或 incremental 分组
- **那么** 系统 SHALL NOT 从 pure hub 自动创建新 group
- **并且** SHALL 只使用 pinned baseline groups、手动新增 hub 和 bridge 输入继续生成 coverage、connections 和 assignments

#### Scenario: Incremental discovers hubs before assigning coverage
- **前提** 当前 incremental 输入中存在 baseline group `C`
- **并且** 最新存档中存在未作为 baseline anchor 的 pure hub sector `A`
- **并且** 玩家 sector `B` 位于 `A` 的覆盖范围内，也位于 `C` 的覆盖范围内
- **当** 系统运行 incremental 分组
- **那么** 系统 SHALL 先识别 `A` 并创建 hub group
- **并且** SHALL 在 `A` 和 `C` 都存在后再决定 `B` 的归属
- **并且** 系统 SHALL NOT 因 `C` 的保留 coverage 先占位而阻止 `B` 归属到距离更近或默认规则更优的 `A`

#### Scenario: Default assignment uses distance score and stable key
- **前提** 某玩家 sector 位于多个 group 当前覆盖范围内
- **并且** 这些 group 均未通过 `excludedDefaultAssignmentSectorMacros` 排除该 sector
- **当** 系统计算默认归属
- **那么** 系统 SHALL 优先选择距离最近的 group
- **并且** 距离相同时 SHALL 使用 hub score 决胜
- **并且** score 足以决胜时 SHALL 使用稳定 key 作为最终 tie breaker

#### Scenario: Score tie remains unresolved
- **前提** 某玩家 sector 到多个 candidate hub 等距
- **并且** candidate hub score 差距小于 30%
- **当** 系统生成 assignment
- **那么** 系统 SHALL 将该 sector 标记为需要用户选择

#### Scenario: Tier 2 auto absorb within five jumps
- **前提** 某 Tier 2 sector 超出 group 覆盖跳数
- **并且** 该 sector 在某 hub 的 5 跳内
- **当** 系统生成 assignment
- **那么** 系统 SHALL 自动生成吸收选项
- **并且** SHALL NOT 默认选中该扩展吸收选项
- **并且** SHALL 不将 Tier 2 sector 自动独立成 hub

#### Scenario: Extension options are capped at five jumps
- **前提** 某玩家 sector 不在任何 group 当前覆盖范围内
- **并且** 该 sector 到最近 hub 的距离大于 5
- **当** 系统生成 assignment
- **那么** 系统 SHALL NOT 为该 hub 生成 absorb option
- **并且** 系统 SHALL NOT 显示“扩展跳数至 6/7/...”
- **并且** options SHALL 仅包含 standalone
- **并且** `selectedOptionIndex` SHALL 为 `null`
- **并且** 该 card SHALL 处于 unresolved / 待选择状态

#### Scenario: Repeated standalone selection is idempotent
- **前提** 某玩家 sector `S` 存在 ordinary assignment card
- **并且** `S` 的 Standalone option 已被选中
- **当** 用户再次点击该已选中的 Standalone option
- **那么** UI / presenter SHALL NOT 再次触发 Standalone 添加行为
- **并且** 系统 SHALL 至多保留一个 `sectorMacro=S` 的 hub group
- **并且** 领域层收到重复 Standalone 请求时 SHALL 更新/复用已有 group，而不是再次 append 新 group

### Requirement: MST Connections and Bridge Plans

系统 MUST 使用 MST 生成普通 group 连接，并在断裂分量存在可连通 bridge 方案时提供 bridge 决策。

#### Scenario: MST writes bidirectional connected groups
- **前提** 自动分组结果中存在多个 group anchor
- **当** 系统运行 `computeGroupGraph`
- **那么** 系统 SHALL 对 anchor pair 计算距离
- **并且** SHALL 仅使用距离小于等于桥接搜索跳数的边运行 Kruskal MST
- **并且** SHALL 将选中边双向写入 `connectedGroupIds`

#### Scenario: Candidate links are bounded by bridge search range
- **前提** 两个 group anchor 的双向图距离大于 `bridgeSearchJumpRange`
- **当** 系统生成 link 候选
- **那么** 该 anchor pair SHALL NOT 进入 MST 候选边
- **并且** SHALL NOT 因普通 MST 自动写入 `connectedGroupIds`

#### Scenario: Fixed edited connections survive recalculation
- **前提** 用户在编辑态保留某两个 group 的连接
- **当** 用户点击 [计算]
- **那么** 系统 SHALL 将该连接作为固定边输入
- **并且** MST SHALL 只添加新边
- **并且** SHALL 不删除该固定连接

#### Scenario: Fixed edge retention is decided per link endpoint
- **前提** group A 与 group B 已有 connected link
- **当** 用户点击 [计算]
- **那么** 若 A 或 B 任一端 `connectionRetainEnabled=true`，该 link SHALL 作为 fixed edge 输入 MST
- **并且** 若 A 与 B 两端 `connectionRetainEnabled=false`，该 link SHALL NOT 作为 fixed edge 输入 MST

#### Scenario: Bridge units use bidirectional sector components
- **前提** 某 cluster 内玩家 sector 因单向 superhighway 或不可往返路径断裂
- **当** 系统生成 bridge unit
- **那么** 系统 SHALL 按有效双向可达 component 拆分 unit
- **并且** SHALL NOT 将 raw cluster 直接视为单个 unit

#### Scenario: Multiple bridge plans gate ordinary assignments
- **前提** MST 后存在断裂分量
- **并且** 系统生成多个可减少断裂分量数量的 bridge 方案
- **当** Col 3 渲染
- **那么** Col 3 SHALL 只显示 bridge plan cards
- **并且** SHALL 隐藏普通 assignment cards
- **并且** SHALL 等待用户选择一个 bridge 方案

#### Scenario: Single bridge plan auto apply
- **前提** MST 后存在断裂分量
- **并且** 系统只生成一个有效 bridge 方案
- **当** 系统处理 bridge 阶段
- **那么** 系统 SHALL 自动采用该方案
- **并且** SHALL 创建普通 bridge draft groups
- **并且** SHALL 基于采用后的 groups 重新生成 ordinary assignment cards

#### Scenario: Bridge draft persists as normal group
- **前提** 用户确认包含 bridge draft group 的草案
- **当** 系统写入 save binding
- **那么** bridge draft group SHALL 作为普通 `BindingSectorGroup` 保存
- **并且** 系统 SHALL NOT 新增 bridge marker 持久化字段

#### Scenario: Confirm applies virtual station drafts after groups
- **前提** 用户确认包含 auto groups 和 virtual station drafts 的草案
- **当** 系统写入 save binding
- **那么** 系统 SHALL 先写入最终 groups、coverage、connections 和 trade station
- **并且** SHALL 再按最终 groups 重算无 `saveStationCode` virtual station plans 的 group 归属
- **并且** SHALL 同步这些 virtual station plans 到 binding

#### Scenario: Ungrouped virtual station plans are not persisted
- **前提** 确认时某个无 `saveStationCode` virtual station draft 仍未归属于任何最终 group
- **当** 系统同步 station plans
- **那么** 该 draft SHALL NOT 写回 binding
- **并且** 若 binding 中存在对应旧 virtual station plan，系统 SHALL 删除它

#### Scenario: Save station plans are not modified by virtual station sync
- **前提** binding 中存在带 `saveStationCode` 的 station plans
- **当** 系统同步 virtual station drafts
- **那么** 这些 save station plans SHALL 保持不变

### Requirement: Edit Input State

系统 MUST 将 Col 2 编辑态作为“下一次计算输入编辑”，而不是最终归属编辑。

#### Scenario: Baseline groups become pinned on edit
- **前提** 用户点击 Col 2 [编辑]
- **当** 系统进入编辑态
- **那么** 系统 SHALL NOT 创建用于取消恢复的 edit snapshot
- **并且** SHALL 将当前存在的 group 标记为 `baseline=true`
- **并且** SHALL 将当前存在的 group 默认设为 `isPinned=true`

#### Scenario: Exit edit keeps current draft
- **前提** 用户进入编辑态后修改节点、hub、coverage 或 connection
- **当** 用户点击 [退出]
- **那么** 系统 SHALL 只切回 result 模式
- **并且** SHALL 保留当前 shared draft
- **并且** SHALL NOT 恢复进入编辑前的 group、assignment、jumpRange、coverage 或 connection 状态

#### Scenario: Node checkbox disabled for clean slate without initial hubs
- **前提** 当前没有 baseline group
- **并且** 当前没有 pinned group
- **当** 用户进入编辑态
- **那么** “节点” checkbox SHALL disabled
- **并且** SHALL 保持勾选

#### Scenario: Node disabled suppresses pure hub generation
- **前提** 当前存在 baseline 或 pinned group
- **并且** 用户取消“节点” checkbox
- **当** 用户点击 [计算]
- **那么** 系统 SHALL 使用 `generateHubs=false`
- **并且** SHALL 不生成新的 pure hub
- **并且** SHALL 禁用阈值与覆盖控件

#### Scenario: Baseline group cannot be deleted
- **前提** 某 group 来自进入编辑态前的 baseline
- **当** 用户取消固定该 group
- **那么** 系统 SHALL 将其设为 `isPinned=false`
- **并且** SHALL 保留其 coverage、connection 和 jumpRange 展示
- **并且** SHALL NOT 从 draft 中真正删除该 group

#### Scenario: New hub draft can be deleted
- **前提** 用户在编辑态新增 hub draft
- **当** 用户删除该 draft
- **那么** 系统 SHALL 从当前编辑 draft 中移除该 group

### Requirement: Sector Group Card Display And Controls

系统 MUST 在 sector group card 中区分非编辑态展示、编辑态输入和 baseline/current diff 标记。Card 层只编辑 shared draft，不直接写入持久化 binding。

#### Scenario: Result card shows read-only group summary
- **前提** group card 处于非编辑态
- **当** 系统渲染该 card
- **那么** SHALL 显示 group 名称
- **并且** SHALL 显示 anchor sector pill
- **并且** 若 group 已选中 trade station，SHALL 显示 trade station pill；玩家站显示 station code 和容量后缀，虚拟站只显示虚拟交易站文案
- **并且** SHALL 以只读值显示 `jumpRange`
- **并且** SHALL 显示统一 jump rows、coverage/connected/candidate pills、覆盖星区数和 uncertain 数量
- **并且** SHALL NOT 显示 retain checkbox、pin/unpin、删除按钮或 pill action 按钮

#### Scenario: Edit card exposes draft input controls
- **前提** group card 处于编辑态
- **当** 系统渲染该 card
- **那么** SHALL 显示 connection、coverage、trade station 三个 retain checkbox
- **并且** checkbox 状态 SHALL 对应 `connectionRetainEnabled`、`coverageRetainEnabled`、`tradeStationRetainEnabled`
- **并且** 若 group `isPinned=true`，SHALL 允许编辑 `jumpRange`
- **并且** 若 group `isPinned=false`，SHALL 禁用 retain checkbox 并以只读值显示 `jumpRange`
- **并且** SHALL 显示 pin/unpin 按钮用于切换 `isPinned`

#### Scenario: Only new non-baseline hub card can be deleted
- **前提** group card 处于编辑态
- **当** group 满足 `isNew=true` 且 `baseline=false`
- **那么** 系统 SHALL 显示删除按钮
- **当** group 来自 baseline 或不是新 hub draft
- **那么** 系统 SHALL NOT 显示删除按钮

#### Scenario: Baseline and current diff markers are visual only
- **前提** `diffEnabled=true`
- **当** 系统渲染统一 jump rows
- **那么** baseline pill SHALL 保留普通边框标记
- **并且** 新增 coverage/connected pill SHALL 使用加粗边框和侧边色块标记
- **并且** removed coverage/connected pill SHALL 使用虚线和弱化透明度标记
- **并且** 这些标记 SHALL NOT 提供恢复到 baseline 的交互语义

### Requirement: Hub Add Menu

系统 MUST 通过 popup 菜单允许用户添加玩家或非玩家 sector 作为 hub draft。

#### Scenario: Hub add menu opens as overlay
- **前提** Col 2 处于编辑态
- **当** 用户点击 [添加]
- **那么** 系统 SHALL 以 fixed overlay 方式打开 hub 添加菜单
- **并且** SHALL NOT 将菜单作为普通页面流元素渲染

#### Scenario: Empty search lists player sectors
- **前提** hub 添加菜单已打开
- **并且** 用户未输入搜索条件
- **当** 系统渲染列表
- **那么** 系统 SHALL 只列出有玩家空间站的 sector

#### Scenario: Search includes non-player sectors
- **前提** hub 添加菜单已打开
- **并且** 用户输入搜索条件
- **当** 系统渲染搜索结果
- **那么** 系统 SHALL 遍历全地图 sectors
- **并且** SHALL 包含无玩家空间站的 sector

#### Scenario: Existing anchor cannot be added again
- **前提** 某 sector 已是任意 group anchor
- **当** hub 添加菜单显示该 sector
- **那么** 系统 SHALL 不提供添加操作

#### Scenario: Non-player sector hub creates transit-capable group
- **前提** 用户选择无玩家空间站 sector 作为 hub
- **当** 用户确认写入草案
- **那么** 系统 SHALL 不创建虚拟 stationPlan
- **并且** SHALL 通过 `BindingSectorGroup.tradeStation` 保存 transit hub 定位信息

#### Scenario: Adding player sector hub updates assignments and trade station default
- **前提** 用户在编辑态选择有玩家空间站的 sector 作为新 hub
- **当** 系统创建 hub draft
- **那么** 该 sector SHALL 从其他 group active coverage 中移除
- **并且** 该 sector SHALL NOT 生成 ordinary assignment card
- **并且** 系统 SHALL 为新 group 生成 trade station 候选
- **并且** 系统 SHALL 根据手动 hub 默认值规则设置 `selectedTradeStation`

#### Scenario: Adding non-player sector hub uses virtual trade station
- **前提** 用户在编辑态选择无玩家空间站的 sector 作为新 hub
- **当** 系统创建 hub draft
- **那么** 系统 SHALL 创建普通 hub draft group
- **并且** SHALL 将其 trade station 默认设置为虚拟交易站
- **并且** SHALL NOT 创建虚拟 `stationPlan`
- **并且** SHALL NOT 修改 save archive 原始记录

#### Scenario: Removing new hub updates assignments and related state
- **前提** 用户在编辑态删除 `isNew=true` 且 `baseline=false` 的 hub draft
- **当** 系统移除该 group
- **那么** 系统 SHALL 移除指向该 group 的 `connectedGroupIds`
- **并且** SHALL 移除该 group 的 trade station draft state
- **并且** SHALL 重新生成受影响玩家 sector 的 assignment options
- **并且** SHALL NOT 留下 orphan assignment、orphan connection 或 orphan trade station card

### Requirement: Unified Pill Rows

系统 MUST 在编辑态用统一 jump row 混排 coverage、candidate 和 connected pill。

#### Scenario: No three-tab pill UI
- **前提** Col 2 处于编辑态
- **当** 系统渲染 group 详情
- **那么** 系统 SHALL NOT 显示 `覆盖星区 | 候选星区 | 连接星区` 三 tab
- **并且** SHALL 在同一 jump row 中混排 coverage、candidate 和 connected pill

#### Scenario: Pill visual semantics
- **前提** group 详情中存在三类 pill
- **当** 系统渲染 pill
- **那么** coverage pill SHALL 使用金色语义
- **并且** candidate pill SHALL 使用半金色语义
- **并且** connected pill SHALL 使用绿色语义
- **并且** baseline coverage pill SHALL 只通过粗边框标记

#### Scenario: Coverage remove becomes candidate
- **前提** 某 sector 是当前 group active coverage
- **当** 用户点击该 coverage pill 的 `×`
- **那么** 系统 SHALL 将该 sector 从 active coverage 移出
- **并且** 若该 sector 仍满足候选条件，SHALL 将其显示为 candidate
- **并且** SHALL 重新生成该 sector 的 ordinary assignment options 和默认状态

#### Scenario: Candidate add becomes coverage
- **前提** 某 sector 是当前 group candidate
- **当** 用户点击该 candidate pill 的 `+`
- **那么** 系统 SHALL 将该 sector 加入当前 group active coverage
- **并且** SHALL 重新生成该 sector 的 ordinary assignment options 和默认状态

#### Scenario: Candidate transfer from another group
- **前提** 某 sector 是 group A 的 active coverage
- **并且** 该 sector 是 group B 的 candidate
- **当** 用户在 group B 点击 `→`
- **那么** 系统 SHALL 将该 sector 加入 group B active coverage
- **并且** SHALL 将该 sector 从 group A active coverage 移出
- **并且** SHALL 重新生成该 sector 的 ordinary assignment options 和默认状态

#### Scenario: Connection pill add and remove
- **前提** 两个 group anchor 距离在 5 跳内
- **当** 用户点击绿色 connected candidate pill 的 `+`
- **那么** 系统 SHALL 双向添加 `connectedGroupIds`
- **当** 用户点击绿色 connected active pill 的 `×`
- **那么** 系统 SHALL 双向移除 `connectedGroupIds`

#### Scenario: Candidate hidden in result state
- **前提** Col 2 处于计算结果态
- **当** 系统渲染 group 详情
- **那么** 系统 SHALL 不显示 candidate pill

### Requirement: Jump Range Coverage Semantics

系统 MUST 在编辑 group jumpRange 时采用 MapBinding 的覆盖半径语义。

#### Scenario: Increasing jump range adds only new layer player sectors
- **前提** 用户将 group jumpRange 从 N 增大到 M
- **当** 系统更新 coverage
- **那么** 系统 SHALL 只自动加入 `N < distance <= M` 范围内符合条件的玩家 sector
- **并且** SHALL 不抢占其他 group active coverage
- **并且** SHALL 重新生成受影响 sector 的 ordinary assignment options 和默认状态

#### Scenario: Decreasing jump range removes out-of-range coverage
- **前提** 用户将 group jumpRange 从 M 缩小到 N
- **当** 系统更新 coverage
- **那么** 系统 SHALL 将 `distance > N` 的 active coverage 移出
- **并且** 若被移出 sector 仍满足候选条件，SHALL 显示为 candidate
- **并且** SHALL 重新生成受影响 sector 的 ordinary assignment options 和默认状态

#### Scenario: Coverage jump range does not alter connections
- **前提** 用户修改 group jumpRange
- **当** 系统更新 coverage/candidate
- **那么** 系统 SHALL NOT 因 coverage jumpRange 修改而增删 `connectedGroupIds`

### Requirement: Assignment Options

系统 MUST 为每个非 hub-anchor 玩家 sector 生成可选择的 assignment card，并按当前命中、扩展命中、baseline 和 standalone 规则确定 options。

#### Scenario: Hub anchor has no ordinary assignment card
- **前提** 某玩家 sector 是任意 group anchor
- **当** 系统生成 ordinary assignment cards
- **那么** 系统 SHALL 跳过该 sector

#### Scenario: All current hit groups become options
- **前提** 某玩家 sector 位于多个 group 当前 jumpRange 覆盖范围内
- **当** 系统生成该 sector 的 assignment card
- **那么** 所有命中 group SHALL 成为 option

#### Scenario: Extend options use nearest distance layer only
- **前提** 某玩家 sector 不在任何 group 当前 jumpRange 内
- **并且** 多个 group 可在 5 跳内通过扩展 jumpRange 命中该 sector
- **当** 系统生成 options
- **那么** 系统 SHALL 只保留最小扩展距离层的 group
- **并且** SHALL 将这些 options 标记为扩展 option
- **并且** SHALL 不默认选中扩展 option

#### Scenario: Baseline reabsorb is preferred before standalone-only
- **前提** 某玩家 sector 不在任何 group 当前 jumpRange 内
- **并且** 没有可用扩展 group option
- **并且** 该 sector 在 baseline 中属于某个 group
- **当** 系统生成 assignment card
- **那么** baseline group SHALL 作为可重新吸收 option
- **并且** 系统 MAY 将该 baseline option 作为默认值

#### Scenario: No group option leaves standalone only
- **前提** 某玩家 sector 不在任何 group 当前 jumpRange 内
- **并且** 没有 5 跳内可用扩展 group option
- **并且** 不存在 baseline group 可重新吸收该 sector
- **当** 系统生成 assignment card
- **那么** options SHALL 仅包含 standalone
- **并且** standalone SHALL NOT 作为自动兜底默认值
- **并且** `selectedOptionIndex` SHALL 为 `null`

#### Scenario: Excluded default remains manually selectable
- **前提** 某玩家 sector 位于 group G 覆盖范围内
- **并且** 该 sector 在 G 的 `excludedDefaultAssignmentSectorMacros` 中
- **当** 系统生成 assignment card
- **那么** G SHALL 作为可手动选择 option 显示
- **并且** G SHALL NOT 作为默认选中项

#### Scenario: Standalone is last and not automatic fallback
- **前提** 系统生成任意玩家 sector assignment card
- **当** 系统排列 options
- **那么** standalone SHALL 始终作为最后一个 option
- **并且** standalone SHALL NOT 作为自动兜底默认值

#### Scenario: Ordinary selection preserves card identity and order
- **前提** Col 3 显示 ordinary assignment cards
- **当** 用户选择 absorb 或 standalone option
- **那么** 系统 SHALL 只更新该 card 内部选中态和 Col 2 draft
- **并且** SHALL NOT 改变 card 的 `displayBucket`
- **并且** SHALL NOT 改变既有 card 顺序

### Requirement: Draft Mutation Assignment Synchronization

系统 MUST 在 card 操作或 hub 操作改变当前 draft 后同步 assignment 状态。同步 SHALL 只更新受影响 card 的 options/default/selected，除非 sector 变为 hub anchor 或不再是 hub anchor，否则不得改变既有 card 身份和排序。

#### Scenario: Sector card mutation preserves existing assignment card identity
- **前提** 某 assignment card 已存在
- **当** 用户通过 coverage `×`、candidate `+`、transfer `→` 或 jumpRange 修改改变该 sector 的候选归属
- **那么** 系统 SHALL 更新该 card 的 options、default 和 selected state
- **并且** SHALL NOT 改变该 card 的 `displayBucket`
- **并且** SHALL NOT 改变该 card 在列表中的相对顺序

#### Scenario: Hub add removes anchor assignment card
- **前提** 玩家 sector S 当前有 ordinary assignment card
- **当** 用户把 S 添加为 hub anchor
- **那么** 系统 SHALL 删除 S 的 ordinary assignment card
- **并且** SHALL 从其他 groups active coverage 中移除 S
- **并且** SHALL 重新生成受 S 影响的其他 assignment options

#### Scenario: Hub remove returns affected sectors to assignment flow
- **前提** 用户删除一个新 hub draft
- **当** 被删除 group 的 anchor 或 coverage 中包含玩家 sector
- **那么** 这些玩家 sector SHALL 重新进入 ordinary assignment 生成流程
- **并且** 系统 SHALL 基于剩余 groups 重新计算 options、default 和 unresolved 状态

### Requirement: Confirm and Persist Auto Groups

系统 MUST 在所有未决 assignment 解决后一次性写入最终 group、coverage、connection 和 stationPlan 分配。

#### Scenario: Confirm disabled with unresolved assignments
- **前提** Col 3 存在未选择的 unresolved assignment
- **当** 系统渲染确认栏
- **那么** [确定] SHALL disabled

#### Scenario: Confirm enabled after all unresolved assignments selected
- **前提** Col 3 所有 unresolved assignment 都已有选择
- **当** 系统渲染确认栏
- **那么** [确定] SHALL enabled

#### Scenario: Persist draft groups once
- **前提** 用户点击 [确定]
- **当** 系统写入 save binding
- **那么** 系统 SHALL 按 UUID 优先匹配已有 group
- **并且** SHALL 在需要时按 `sectorMacro` 兜底匹配已有 group
- **并且** SHALL 创建或更新最终 groups
- **并且** SHALL 移除不在 draft 中的废弃 group

#### Scenario: Rebuild station plan group assignment
- **前提** 用户确认自动分组草案
- **当** 系统完成最终 group coverage 映射
- **那么** 系统 SHALL 按最终 `sector -> groupId` 映射重新分配 `stationPlans`

#### Scenario: Confirm switches to resource view
- **前提** 用户点击 [确定] 且写入成功
- **当** overview 重新渲染
- **那么** 系统 SHALL 隐藏 Col 2 和 Col 3 确认栏
- **并且** Col 2 SHALL 只读展示 store-derived groups
- **并且** Col 3 SHALL 显示 `EmpireWareFlowsDashboard`

### Requirement: Localization and Display Safety

系统 MUST 使用本地化 sector 名和稳定 UI 显示，避免 raw macro 泄漏到 bridge/assignment 用户界面。

#### Scenario: Bridge reaches display localized sector names
- **前提** Col 3 显示 bridge plan card
- **当** 系统渲染 bridge reach pill
- **那么** 系统 SHALL 使用 locale/map 解析后的 sector 名
- **并且** SHALL 显示 jump 数
- **并且** SHALL NOT 显示 `cluster_*_macro` 或 raw sector macro 作为用户可见名称

#### Scenario: Hub add rows display player station marker
- **前提** hub 添加菜单显示 sector 行
- **当** sector 有玩家空间站
- **那么** 系统 SHALL 显示实心点
- **当** sector 无玩家空间站
- **那么** 系统 SHALL 显示空心点
