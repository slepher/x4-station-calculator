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
| Col 1 | 3 | `SaveUploadPanel` + 预制跳数 + 预制容量 + `SaveList` |
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

### Requirement: Col 2 Confirm Bar

Col 2 SHALL 包含独立的确定栏。

**前提** Col 2 可见

**当** 确定栏渲染
**那么** 包含：
- 默认跳数输入（仅影响新建 group，不影响已有 group 的 jumpRange）
- 默认容量输入（hub 识别 THRESHOLD）
- [重新计算] 按钮

**当** 用户修改已有/pin 后 group 的跳数并点击 [重新计算]
**那么** SHALL 用各 group 当前 jumpRange 重跑增量分配算法 → Col 3 重建内容

### Requirement: Jump Range Auto-Extend and Rollback

系统 SHALL 在分配超出预制跳数时自动扩展 jumpRange，撤销时自动回退。

**前提** 某 sector 被分配到 group，但其距离 > group 的 jumpRange

**当** 用户确认该分配
**那么** group 的 effective jumpRange SHALL 扩展到覆盖该 sector 所需的最小值
**并且** BFS 扩展覆盖星区

**当** 用户 [撤销] 该分配
**那么** jumpRange SHALL 回退到无需扩展的最小值
**并且** 移除多余覆盖星区

### Requirement: Pin Mechanism for New Groups

新创建的 group SHALL 支持 Pin 操作。

**前提** Col 2 中存在算法新建的 group（非已有 group）

**当** 用户点击 group 的 Pin 按钮
**那么** 该 group SHALL 被视为已有 group：
- 重新计算不会消除其地位
- 可以编辑跳数

**当** 用户取消 Pin
**那么** 该 group SHALL 恢复为新 group 状态，重新计算可能吸收/重组它

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
- `SectorGroupList` 从 store 读取已确认的 group（`isNew=false`, `isPinned=false`，跳数不可编辑，无存疑计数）
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
