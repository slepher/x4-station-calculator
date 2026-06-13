# Auto Sector Group Specification

## Purpose

This spec defines the auto sector grouping feature for Live Production mode. It covers:
- Hub detection based on container storage capacity and production line count
- Auto grouping algorithm (clean-slate and incremental)
- Col 2 / Col 3 layout and interaction in LiveProductionWorkbenchView overview mode
- Binding flow changes for SaveList and SaveUploadPanel
- Pin mechanism for new groups
- Jump range auto-extend / rollback

## ADDED Requirements

### Requirement: Hub Station Detection

系统 SHALL 扫描存档中所有玩家空间站的已建成模块（`modules[]`）和在建模块（`constructions[]`），合并统计后识别中转站（hub）候选。

**前提** 游戏存档已解析，`modules.json` 中的 cargo 数据已加载

**当** 系统扫描单个空间站的所有模块（built + construction）
**那么** 系统 SHALL：
- 仅统计 `cargo.type === 'container'` 的 `capacity` 总和，排除 solid/liquid
- 统计所有 `ref` 包含 `prod_` 前缀的模块数量作为产线数
- 若 `container_cap >= THRESHOLD`（可配置，默认 5,000,000 m³），该站进入 Tier 1
- Tier 1 score = `container_cap / (1 + ln(1 + prod_lines))`
- 若 `container_cap < THRESHOLD`，该站进入 Tier 2，score = `container_cap`
- Tier 1 始终排在 Tier 2 前

**并且** 纯 hub SHALL 定义为 `qualified AND prod_lines == 0`

**并且** 同一星区有多个纯 hub 时，选 score 最高的作为该星区的 anchor hub

### Requirement: Sector Jump Distance Calculation

系统 SHALL 使用与 `saveBindingUtils.ts:buildSectorGraphFromMaps()` 一致的 BFS 算法计算星区间跳数距离。

**前提** `maps.json` 中的 clusters 和 sectors 数据已加载

**当** 计算两个星区 sector_a 和 sector_b 的距离
**那么** 系统 SHALL：
- 若同 cluster → 距离 = 0
- 若跨 cluster → 距离 = cluster_gates BFS 层数
- 若不可达 → 返回 None

### Requirement: Clean-Slate Auto Grouping

系统 SHALL 支持在无任何已有 binding group 时，从零自动划分星区组。

**并且** 新建 group 的默认 `jumpRange` SHALL 来自“分组覆盖跳数”，默认值为 2。

**前提** jue 存档已绑定，无任何已有 group

**当** 触发自动分组
**那么** 系统 SHALL 执行三阶段分组：

**Phase A — 纯 hub 建组**：
- 所有 prod_lines == 0 的纯 hub 各建一个 group
- 每个玩家星区贪婪分配到 jumpRange 内最近的纯 hub（按 distance, -score 排序）
- 若两纯 hub 等距且 score 差距 < 30% → 标记存疑（不自动分配）

**Phase B — 带产线 Tier 1 处理**：
- 所在星区已在 Phase A 分配的 → 自动吸收
- 所在星区未分配：距最近纯 hub ≤ jumpRange → 吸收
- jumpRange < 距离 ≤ 5 → 存疑（吸收 vs 独立）
- 距离 > 5 → 独立成组

**Phase C — Tier 2 处理**：
- 未分配的 Tier 2 星区：距最近纯 hub ≤ 5 → 自动吸收
- 距离 > 5 → 标记为例外

### Requirement: Incremental Assignment

系统 SHALL 支持在已有 binding group 时，对新出现的玩家星区进行增量分配。

**前提** 已有 N 个 binding group（各有自己的 jumpRange），存档更新后新出现 M 个玩家星区

**当** 对每个新星区运行增量分配
**那么** 系统 SHALL：
- 对每个已有 group，用其**自己的 jumpRange** 计算是否能覆盖该新星区
- 若 ≤ jumpRange → 直接候选
- 若 jumpRange < 距离 ≤ 5 → 需扩展跳数的候选
- 若 > 5 → 不可覆盖

**并且** 候选排序规则：
- 无需扩展的候选优先于需扩展的
- 同优先级时按距离排序
- 若最佳候选是 score_tie（等距且 score < 30% 差距）→ 存疑
- 若最佳候选需扩展 → 存疑（扩展吸收 vs 独立）
- 否则 → 自动分配（默认选中 ●）

**并且** 无任何 group 在 5 跳内可覆盖 → 建议 standalone

### Requirement: LiveProductionWorkbenchView Overview Layout

`LiveProductionWorkbenchView.vue` 的 overview 模式 SHALL 采用三列布局。

**前提** 用户在 Live Production 模式且 workbenchMode === 'overview'

**当** overview 模式激活
**那么** 布局 SHALL 为 `grid-cols-12` 三列：

| Col | Span | 内容 |
|---|---|---|
| Col 1 | 3 | `SaveUploadPanel` + 分组覆盖跳数 + 预制容量 + `SaveList` |
| Col 2 | 5 | [确定栏] + 星区 group 列表（与 MapBindingSectorGroup 同形态） |
| Col 3 | 4 | 存在未决 sector 时：分配列表 + 存疑列表；无未决时：`EmpireWareFlowsDashboard` |

**并且** `ProductionSidebar` 仍存在于左侧，仅在确定写入后更新

### Requirement: Col 3 Candidate Selection Interaction

Col 3 SHALL 展示所有 sector 的统一分配列表，支持候选切换。

**前提** Col 3 中存在 sector 卡片

**当** sector 卡片渲染
**那么** 每个卡片 SHALL：
- 上下列表展示所有候选选项（含「独立成组」作为最后一项）
- 算法自动分配的 → 对应选项默认选中（●）
- 存疑 → 全部未选中（○）
- 点击任意选项 → 该选项选中 → Col 2 即时更新 group 构成
- 所有 sector 在同一列表中，不区分「已分配」和「存疑」

**当** 所有存疑 sector 均已选择
**那么** Col 3 确定栏的 [确定] 按钮 SHALL 变为可用

**当** 点击 [确定]
**那么** 系统 SHALL 一次性写入 `saveBindingStore` → Col 3 切换为资源视图 → `ProductionSidebar` 刷新

### Requirement: Col 2 Draft Coverage Synchronization

Col 2 SHALL reflect the currently selected Col 3 absorb decisions, including default auto decisions.

#### Scenario: Show selected absorb sectors in target group coverage

**前提** Col 3 card 当前选中 absorb 到某个 group

**当** Col 2 渲染该 group
**那么** 该 sector SHALL 出现在目标 group 的 coverage 药丸列表中
**并且** 若该 sector 原先存在于其他 group 的 coverage 中，其他 group SHALL 不再显示该 sector。

### Requirement: Standalone-Derived Candidate Lifecycle

Standalone 新建 group SHALL only append derived candidates to other cards and SHALL remove only those derived candidates when rolled back.

#### Scenario: Append derived candidate without removing original candidates

**前提** Col 3 中 sector A 选择“独立成组”

**当** 新 group 可覆盖 sector B
**那么** sector B 的 card SHALL 追加一个指向 sector A 新 group 的 absorb 候选
**并且** sector B 原有候选 SHALL 保留
**并且** 若新候选是当前最佳候选，sector B SHALL 自动切换选中该新候选。

#### Scenario: Remove derived candidate when standalone group is removed

**前提** sector A 曾选择“独立成组”，并向 sector B 追加了派生候选

**当** sector A 切回 absorb，导致该 standalone group 被删除
**那么** 系统 SHALL 只移除来源于该 standalone group 的派生候选
**并且** 不得移除 sector B 的初始候选
**并且** 若 sector B 当前选中的正是被移除的派生候选，系统 SHALL 在剩余候选中重新选择当前最佳候选。

### Requirement: Assignment Baseline Reset

Col 3 SHALL allow resetting the current ordinary assignment draft to the baseline that existed when ordinary assignment started.

#### Scenario: Reset ordinary assignment draft

**前提** 系统已经进入普通 assignment 阶段

**当** 用户点击 Col 3 status bar 中 [重置]
**那么** 系统 SHALL：
- 恢复进入普通 assignment 阶段时的 groups 和 assignments
- 保留已采用的 bridge 方案
- 不回到 bridge 方案选择前
- 清除普通 assignment 阶段产生的 absorb、standalone、派生候选和跳数扩展影响

**并且** 无 bridge、唯一 bridge 自动采用、多 bridge 用户选择后，均 SHALL 建立同一种普通 assignment baseline。

### Requirement: Col 3 Card Identity and Order Stability

Col 3 card 的显示身份和排序 SHALL 在一次算法输出后保持稳定。

#### Scenario: Preserve unresolved card identity after selection

**前提** 自动分组或重新计算已经生成 Col 3 cards

**当** 系统为 card 建立显示状态
**那么** 系统 SHALL：
- 将算法已有默认选择的 card 标记为 `resolved`
- 将算法没有默认选择、需要用户决策的 card 标记为 `unresolved`
- 仅在本次算法输出生成时确定该身份

**当** 用户为 `unresolved` card 选择 absorb、standalone 或其他候选
**那么** 系统 SHALL：
- 保持该 card 的 `unresolved` 身份
- 不因 `selectedOptionIndex !== null` 将其移动到 `resolved` 区
- 不改变该 card 与其他已有 cards 的显示顺序
- 仅更新 card 内部选中态和 Col 2 draft 预览

**并且** 只有显式 [重新计算] 或重新运行自动分组时，系统 MAY 重建 Col 3 card 的顺序和显示身份。

### Requirement: Col 2 Confirm Bar

Col 2 SHALL 包含独立的计算状态栏。

#### Scenario: Result mode shows fixed parameters

**前提** 当前处于计算结果态

**当** Col 2 状态栏渲染
**那么** SHALL 只读展示：
- 分组覆盖跳数
- 桥接搜索跳数
- Hub 阈值

**并且** SHALL 显示 [编辑] 按钮。

#### Scenario: Enter input edit mode

**前提** 当前处于计算结果态

**当** 用户点击 [编辑]
**那么** SHALL 进入编辑输入态
**并且** SHALL 复制当前计算结果作为可取消恢复的快照
**并且** Col 2 SHALL 允许编辑：
- 三个全局参数
- group `normal / pin / exclude` 三态
- pinned group jumpRange
- pinned coverage/link 参与状态

#### Scenario: Cancel input edit mode

**前提** 当前处于编辑输入态

**当** 用户点击 [取消]
**那么** SHALL 放弃编辑输入态中的所有修改
**并且** SHALL 恢复进入编辑前的计算结果态、Col 2 结果、Col 3 状态和三个参数。

#### Scenario: Calculate from input edit mode

**前提** 当前处于编辑输入态

**当** 用户点击 [计算]
**那么** SHALL 使用当前编辑输入重新计算
**并且** SHALL 将三个参数固化为本次计算结果的只读值
**并且** SHALL 进入计算结果态并重建 Col 3 内容。

### Requirement: Jump Range Auto-Extend and Rollback

系统 SHALL 在分配超出分组覆盖跳数时自动扩展 jumpRange，撤销时自动回退。

**前提** 某 sector 被分配到 group，但其距离 > group 的 jumpRange

**当** 用户确认该分配
**那么** group 的 effective jumpRange SHALL 扩展到覆盖该 sector 所需的最小值
**并且** BFS 扩展覆盖星区

**当** 用户 [撤销] 该分配
**那么** jumpRange SHALL 回退到无需扩展的最小值
**并且** 移除多余覆盖星区

### Requirement: Recalculation State for Groups

Col 2 group SHALL 支持 `normal / pin / exclude` 三态重新计算状态。

**前提** Col 2 中存在 group

**当** group 来源于已持久化 binding
**那么** 进入自动分组界面时 SHALL 默认显示为 `pin`

**当** group 来源于本轮算法新建 group 或 bridge draft group
**那么** SHALL 默认显示为 `normal`

**当** 用户在编辑输入态将 group 切换到 `pin`
**那么** 该 group 的 anchor sector SHALL 作为点击 [重新计算] 时的固定 hub 输入
**并且** 重新计算不得消除该 hub 地位

**当** 用户在编辑输入态将 group 切换到 `normal`
**那么** 该 group SHALL 不作为固定初始 hub，重新计算 MAY 由算法重新决定其归属或是否成组

**当** 用户在编辑输入态将 group 切换到 `exclude`
**那么** 点击 [计算] 时 SHALL 排除该 group 的 anchor sector 作为 hub 候选
**并且** SHALL 排除该 anchor sector 作为 bridge 候选

**并且** 三态切换 SHALL 只影响点击 [计算] 时的初始输入，不立即改变当前 Col 2 coverage、Col 3 cards、候选选中态或当前连接图。

#### Scenario: Edit pinned group jump range as recalculation input only

**前提** 当前处于编辑输入态，且 Col 2 中存在 `pin` group

**当** 用户修改该 group 的跳数
**那么** 系统 SHALL：
- 只更新该 group 的 jumpRange 数值
- 不立即重算 coverageSectorMacros
- 不立即改变 Col 2 范围星区药丸
- 不立即重算 Col 3 assignments

**并且** 新 jumpRange SHALL 只作为用户点击 [计算] 时的初始输入数据。

### Requirement: Col 3 Input Edit Overlay

编辑输入态下 Col 3 SHALL 保留主界面显示但禁止操作。

#### Scenario: Col 3 locked while editing inputs

**前提** 当前处于编辑输入态

**当** Col 3 渲染
**那么** SHALL 保留当前主界面内容作为背景
**并且** SHALL 显示遮罩
**并且** SHALL 禁止 bridge、assignment、standalone、重置、确定等所有 Col 3 操作
**并且** 若当前是分配候选视图，遮罩 SHALL 显示“编辑输入中，分配面板暂不可操作”
**并且** status bar SHALL NOT 重复显示编辑态提示。

#### Scenario: Resource view overlay has no prompt text

**前提** 当前处于编辑输入态，且 Col 3 当前是资源视图

**当** Col 3 渲染
**那么** SHALL 保留资源视图作为背景并显示遮罩
**并且** SHALL NOT 显示“分配面板暂不可操作”提示文案。

#### Scenario: Col 3 restored after cancel

**前提** 当前处于编辑输入态，且 Col 3 已显示遮罩

**当** 用户点击 [取消]
**那么** SHALL 移除遮罩
**并且** SHALL 恢复进入编辑前的 Col 3 状态和用户已做选择。

#### Scenario: Col 3 replaced after calculate

**前提** 当前处于编辑输入态，且 Col 3 已显示遮罩

**当** 用户点击 [计算]
**那么** SHALL 移除遮罩
**并且** SHALL 使用新计算结果替换 Col 3 内容。

#### Scenario: Calculate does not use initial full-coverage short-circuit

**前提** 当前处于编辑输入态，且所有玩家星区在进入编辑前均已有 group

**当** 用户点击 [计算]
**那么** 系统 SHALL 按当前编辑输入重新计算
**并且** SHALL 退出已确认资源视图状态，展示新计算生成的 bridge 或 assignment 结果
**并且** SHALL NOT 使用初始化时的“无未归组星区则跳过计算”判断直接返回资源视图。

### Requirement: Pinned Coverage and Link Input Editing

`pin` group 的 coverage/link SHALL 作为重新计算输入编辑态展示，而不是直接编辑当前结果。

#### Scenario: Pinned coverage as default assignment only

**前提** 某 `pin` group 的 coverage 中包含 sector X

**当** 用户点击 [计算] 后，sector X 按正常 assignment 流程生成 Col 3 card
**那么** 该 card 的默认选择 SHALL 优先指向该 pinned hub
**并且** 用户 SHALL 仍可切换为其他 coverage 候选或选择「独立成组」

**当** sector X 未按正常 assignment 流程生成 Col 3 card
**那么** 系统 SHALL NOT 仅因为 pinned coverage 额外生成 card。

#### Scenario: Pinned coverage does not become hub

**前提** 某 `pin` group 的 coverage 中包含 sector X

**当** 用户点击 [计算]
**那么** sector X SHALL NOT 因为出现在 pinned coverage 中而成为 hub
**并且** sector X SHALL 只作为归属默认值输入参与 assignment 默认选择。

#### Scenario: Toggle pinned coverage/link participation

**前提** Col 2 中存在 `pin` group，且其 coverage pill 或 link pill 可见

**当** 用户点击 pill 上的 `x`
**那么** 该 coverage/link SHALL 暂停参与下次 [计算]
**并且** pill SHALL 保留显示为可恢复状态
**并且** 当前 Col 2 coverage、Col 3 cards、候选选中态 SHALL NOT 立即改变

**当** 用户点击已暂停 pill 上的 `+`
**那么** 该 coverage/link SHALL 恢复参与下次 [计算]
**并且** 当前 Col 2 coverage、Col 3 cards、候选选中态 SHALL NOT 立即改变

#### Scenario: Recalculate uses edited pinned inputs

**前提** 用户已编辑 `pin` group 的 coverage/link 参与状态

**当** 用户点击 [计算]
**那么** 系统 SHALL 使用当前启用的 pinned coverage 作为对应 sector 的默认归属输入
**并且** 使用当前启用的 pinned link 作为 pinned 内部连接输入
**并且** pinned 节点与外部新节点之间的 link MAY 重新生成。

### Requirement: SaveList Bind Button Behavior

`SaveList.vue` 中的绑定按钮 SHALL 不再直接跳转到地图面板。

**前提** 用户在 SaveList 中看到存档条目

**当** 点击绑定按钮且该 guid 无绑定
**那么** SHALL：
- 创建 guid 级绑定（`selectedArchiveTime = null`）
- 载入该 guid 的最新有效存档
- 运行自动分组（无已有 group 则纯净分组，有则增量分配）
- Col 2/3 展示结果（不跳转到地图视图）

**当** 点击绑定按钮且该 guid 已有绑定
**那么** SHALL：
- 载入该 guid 对应的存档（guid 级=最新，time 级=对应时间）
- 判定是否有未分配到 group 的玩家星区
- 有 → 运行增量分配 → Col 2/3 展示

### Requirement: SaveUploadPanel Upload Flow

`SaveUploadPanel.vue` 的上传逻辑 SHALL 根据当前绑定状态决定是否自动分析。

**前提** 用户上传存档文件

**当** 当前无任何绑定
**那么** SHALL：创建绑定 → 自动分组 → Col 2/3 展示

**当** 当前有绑定，且新存档属于当前 guid，且是该 guid 最新时间
**那么** SHALL：绑定迁移到新存档 → 运行增量分析 → Col 2/3 展示

**当** 当前有绑定，新存档属于该 guid，但非最新
**那么** SHALL NOT 分析或切换

**当** 当前有绑定，新存档属于其他 guid（该 guid 无绑定）
**那么** SHALL：创建绑定，但不分析

**当** 当前有绑定，新存档属于其他 guid（该 guid 已有绑定）
**那么** SHALL NOT 做任何事

### Requirement: One-Way Superhighway Detection

系统 SHALL 通过 `maps.json` 中 `sector_links` 的 `render.lane_count` 字段检测单向超高速公路，并在构建星区图时排除单向通道。

**前提** `maps.json` 加载完毕，`buildSectorGraph` 执行

**当** 遍历 cluster 的 `sector_links`
**那么** 系统 SHALL：
- 若 `render.lane_count >= 2` → 双向通道，正常建边
- 若 `render.lane_count === 1` → 单向通道，**不建边**（货船无法往返，不视为连通）
- 若 `lane_count` 缺失 → 默认双向

**并且** 仅凭 `from_zone_id` 无法可靠判断方向性（Grand Exchange 的两条双向超高速 `from` 字段均指向 sector001）

### Requirement: Coverage Exclusivity

系统 SHALL 确保每个玩家星区最多出现在一个 group 的覆盖中。

**前提** 自动分组算法运行中

**当** 为每个 group 计算覆盖
**那么** 系统 SHALL：
- 按 group 优先级（高分 hub 优先）依次计算覆盖
- 已被高优先级 group 占用的星区不进入后续 group 的覆盖
- 纯 hub 的 **anchor 星区** SHALL 不进入其他 group 的覆盖（互不侵犯）

### Requirement: Anchor Exclusion from Coverage List

每个 group 的 `coverageSectorMacros` SHALL NOT 包含自身的 anchor 星区。

**当** group 覆盖计算完成
**那么** anchor 星区 SHALL 从 `coverageSectorMacros` 中移除
**并且** Col 2 的"定位星区"行单独展示 anchor，不重复出现在覆盖列表中

### Requirement: Trade-Station-Only Sector Filtering

自动分组 SHALL 仅处理真正有玩家空间站的星区，排除仅含 NPC 贸易站的星区。

**前提** `getSaveSectorsWithPlayerStations()` 返回的 sector 列表

**当** 构建 `playerSectorMacros` 列表
**那么** SHALL 过滤掉 `playerStations.length === 0` 的 sector
**原因** `getSaveSectorsWithPlayerStations` 会包含 `tradeStations > 0` 但无玩家站的 sector

### Requirement: Post-Confirm Display

确认写入 store 后，Col 2 SHALL 继续展示已确认的 group 列表，Col 3 切换为 `EmpireWareFlowsDashboard`。

**当** 用户点击 [确定] 写入 store
**那么**：
- `SectorConfirmBar` 和 `AllocationConfirmBar` 隐藏
- `SectorGroupList` 从 store 读取已确认的 group（`isNew=false`, `recalcState=pin`，作为重新计算固定输入，无存疑计数）
- `SectorAllocationList` 隐藏
- Col 3 显示 `EmpireWareFlowsDashboard`

### Requirement: Standalone Group Auto-Setup

当用户为存疑星区选择「独立成组」后确认，系统 SHALL 为该 sector 创建完整的 group。

**当** 确认时处理 `selectedOptionIndex` 指向 `type === 'standalone'`
**那么** SHALL：
- 创建新 group，名称为该星区本地化名
- 绑定 anchor 为该星区、跳数为预制值
- 计算并设置覆盖
- 自动连接跳数最近的已有 group

### Requirement: Test Fixture Design

测试夹具 SHALL 采用紧凑、自文档化的 JSON 格式，仅包含存档特有数据。

**格式**：
```json
{
  "sectors": {
    "sector_macro": {
      "n": "sector_name",
      "s": {
        "station_code": {
          "m": [["ref", amount], ...],
          "c": [["ref", count], ...]
        }
      }
    }
  }
}
```

**原则**：
- type/cargo 信息从游戏数据 `modules.json` 读取，不存入 fixture
- 无关模块类型（connection, habitation, defence 等）在提取时过滤
- sector graph 从 `maps.json` 构建，不存入 fixture

### Requirement: TDD Test Coverage

自动分组算法 SHALL 有 20+ 单元测试覆盖。

**测试覆盖点**：
- fixture 结构验证（22 sectors, 45 stations）
- group 数量与 anchor 验证（7 个纯 hub）
- 覆盖排他性（无重叠）
- anchor 不在自身覆盖中
- 22 sector 全覆盖
- auto/uncertain_tie/uncertain_extend 数量
- 状态一致性（auto 有 selectedOptionIndex ≥ 0, uncertain 为 null）
- 选项结构（standalone 存在, extendsRange 标记）
- 单向超高速影响（Savage Spur I/II 各归可达 group）
- anchor 分配列表过滤（不显示纯 hub anchor 的 assignment card）

### Requirement: Real-time Coverage Update on Absorb Selection

当用户在 Col 3 选择星区归入某 group，Col 2 SHALL 实时更新该 group 的覆盖。

**当** 用户点击 absorb 选项（归入某 group）
**那么** SHALL：
- 该 sector 立即加入目标 group 的 `coverageSectorMacros`
- 若该 sector 之前在其他 group 的覆盖中 → 从旧 group 移除
- 若距离超出 group 的 jumpRange → 自动扩展 `jumpRange` 至覆盖所需值
- Col 2 覆盖列表即时刷新（含跳数）

### Requirement: Standalone Group Live Creation and Candidate Recalculation

当用户选择「独立成组」，Col 2 SHALL 创建新 group，Col 3 SHALL 为剩余存疑星区重算候选。

**当** 用户点击 standalone 选项（独立成组）
**那么** SHALL：
- Col 2 立即新增 group（以该 sector 为 anchor，计算覆盖，自动连接最近已有 group）
- Col 3 其他存疑星区重算候选：新增的独立 group 若在跳数范围内 → 作为候选加入选项列表（排在 standalone 之前）
- 若新 group 是某存疑星区的最佳候选 → 不影响选中状态（仍为存疑，等待用户明确选择）
