# Auto Sector Group Link Specification

## Purpose

此 spec 定义星区群组最小连通图功能，覆盖：
- 基于 MST（Kruskal）的普通 group 互连算法，替换 nearest-neighbor 策略
- 断裂 group 分量的 bridge 方案生成、评分和选择
- bridge 方案采用后创建普通 sector group
- Col 3 bridge 决策交互
- 每次 group 变更后的连接图全量重算

## MODIFIED Requirements

### Requirement: Auto-Group Inter-Connection Algorithm

The system SHALL use a Minimum Spanning Tree (MST) algorithm to compute `connectedGroupIds` for all sector groups, replacing the current single-nearest-neighbor strategy.

#### Scenario: Compute MST direct group connections

**前提** 多个 group 已创建，各有 anchor sector

**当** 计算 group 之间的连接
**那么** 系统 SHALL：
- 对每对 group anchor 使用 BFS cluster-jump 距离计算边权重
- 仅考虑权重 ≤ “桥接搜索跳数”的边
- 使用 Kruskal 算法构建 MST
- 选中的边写入对应两个 group 的 `connectedGroupIds`（双向）
- 所有可通过桥接搜索跳数内边连通的 group anchor SHALL 在同一连通分量内

**并且** `connectedGroupIds` SHALL 只表达 group-to-group 的直接连接，不表达 bridge marker。

### Requirement: Bridge Search Jump Range Configuration

The system SHALL provide a configurable bridge search jump range for group inter-connection and bridge plan generation.

#### Scenario: Configure bridge search radius

**前提** 用户位于自动星区划分确认栏

**当** 用户设置桥接搜索跳数
**那么** 系统 SHALL：
- 提供 2 到 5 跳的可选值
- 默认值为 5
- 不允许桥接搜索跳数小于分组覆盖跳数
- 若分组覆盖跳数被调高到超过当前桥接搜索跳数，系统 SHALL 自动将桥接搜索跳数抬高到分组覆盖跳数
- `computeGroupGraph()` 和 `buildBridgePlanOptions()` SHALL 使用桥接搜索跳数作为最大连接距离

**并且** 桥接搜索跳数 SHALL 只影响连接图和 bridge 方案搜索，不改变普通 assignment 的存疑 5 跳上限。

### Requirement: MST Recalculation on Group Changes

The system SHALL recalculate the full MST whenever groups change.

#### Scenario: Recalculate graph after draft group changes

**前提** draft group 结构发生变更

**当** 发生以下任一事件：
- `groupCleanSlate()` Phase A group 创建完成
- bridge 方案被自动采用或用户选择
- `applyStandaloneToResult()` 新建 standalone group
- `applyAbsorbToResult()` 合并或删除 standalone group
- `groupIncremental()` 构建 groups 后
- Col 2 [重新计算] 按钮点击
- 三态重新计算状态切换

**那么** 系统 SHALL 仅更新下次 [重新计算] 的输入状态
**并且** SHALL NOT 立即调用 `computeGroupGraph()` 改变当前 `connectedGroupIds`

### Requirement: Bridge Plan Decision Flow

The system SHALL generate bridge plans for disconnected group components and resolve them before ordinary assignment cards are shown.

#### Scenario: Resolve disconnected components with bridge plans

**前提** MST 计算后存在 ≥2 个断裂连通分量

**当** 系统尝试生成 bridge 方案
**那么** 系统 SHALL：
- 生成能减少断裂分量数量的 bridge unit 组合
- 若无法连通所有断裂分量，但可连通其中至少两个分量，该方案 SHALL 视为有效 bridge
- 若存在更大连通覆盖的组合，系统 SHALL 只保留当前可达到最大连通覆盖的方案
- 若无可连通方案，则跳过 bridge 决策并继续普通节点处理
- 若仅有一个方案，则自动采用该方案
- 若存在多个方案，则最多展示前 5 个推荐方案
- 多方案时 Col 3 SHALL 只显示 bridge 方案选项，并隐藏普通 assignment cards
- 用户选择一个 bridge 方案后，系统 SHALL 创建对应 bridge draft groups，并恢复普通 assignment cards

**并且** bridge 决策 SHALL NOT 采用多轮流程；一次生成的完整方案要么被采用一个，要么跳过。

### Requirement: Bridge Plan Scoring

The system SHALL rank bridge plans by bridge node quality first.

#### Scenario: Rank bridge plans by weakest unit score

**前提** 已生成多个 bridge plan option

**当** 计算 bridge unit 和 bridge plan 的 score
**那么** 系统 SHALL：
- 将 bridge unit 定义为同 cluster 内按有效双向可达 sector graph 划分出的玩家 sector component
- 若 cluster 内部因单向 superhighway 或不可往返路径断裂，则 SHALL 拆分为不同 unit，不能作为一个整体方案
- `unitScore` = 该 unit 内所有 station 的最高 hub score
- `planScore` = 该 plan 内所有 unitScore 的最小值
- 按 `planScore` 高 → `totalJump` 小 → `maxJump` 小 → bridge unit 数少 → stable key 排序
- 仅保留前 5 个方案用于 UI 展示

**并且** 多方案时可以默认高亮推荐方案，但 SHALL NOT 自动采用。

### Requirement: Bridge Plan Adoption as Sector Groups

The system SHALL turn adopted bridge units into ordinary sector groups.

#### Scenario: Adopt bridge units as draft groups

**前提** bridge 方案被自动采用或被用户选择

**当** 应用 bridge 方案
**那么** 系统 SHALL：
- 为方案中的每个 bridge unit 创建一个 `GroupDraftInfo`
- 以 unit 内选中的 center sector 作为 `sectorMacro`
- 若 unit 只有一个玩家 sector，则该 sector 自动作为 center sector
- 若 unit 有多个玩家 sector，则默认选择 score 最高的 sector，用户可调整
- 创建出的 bridge draft group SHALL 默认进入 `normal` 状态，不默认进入 `pin` 状态
- 将创建出的 bridge draft groups 纳入 `computeGroupGraph()` 重新计算
- 将 bridge draft groups 视为与原 hub 一样的固定起点，重新生成剩余普通 assignment cards
- 不得复用 bridge 选择前已经生成的普通 assignment 结果
- 点击 [确定] 后，将 bridge draft groups 作为普通 `BindingSectorGroup` 写入 store

**并且** 系统 SHALL NOT 新增 `BindingSectorGroup.bridgeSectors` 或其他 bridge marker 持久化字段。

#### Scenario: Excluded group is not bridge candidate

**前提** Col 2 中某 group 被用户切换为 `exclude`

**当** 用户点击 [重新计算]
**那么** 该 group 的 anchor sector SHALL NOT 作为 bridge unit 候选
**并且** 该 group 的 anchor sector SHALL NOT 作为自动 hub 候选。

### Requirement: Bridge Plan UI Display

Col 3 SHALL display bridge plans as a blocking decision UI before ordinary assignment cards.

#### Scenario: Show bridge plan cards before ordinary assignments

**前提** 存在多个 bridge plan option

**当** Col 3 渲染 bridge 决策
**那么** 系统 SHALL：
- 每个 bridge 方案显示为一个 card/选项卡
- 方案标题 SHALL 由方案内 unit 组成，例如 `Cluster A + Sector BA`
- 单 sector unit SHALL 直接显示 sector 名，并在下一行以药丸显示连接节点和跳数
- 多 sector unit SHALL 在 unit 行显示名称，在下一行以药丸显示连接节点和跳数，并在子项中展示 center sector 选择
- 多 sector unit 名称 SHALL 使用 locale/map 解析后的 cluster 显示名，不得直接显示 `cluster_*_macro`
- 连接节点 SHALL 使用 locale/map 解析后的 sector 显示名，不得直接显示 `Sector 1` 或 `cluster_*_macro` 等内部名
- 每个连接节点药丸 SHALL 同时包含 sector 名和跳数，例如 `虔诚之雾 IV (2)`
- 多 sector unit 的子 sector 行 SHALL NOT 重复显示连接跳数
- 方案选择和 center sector 选择 SHALL NOT 改变 Col 3 中 card 的既有顺序

## ADDED Requirements

### Requirement: Shortest Path with Sector Tracing

The system SHALL provide a path function that returns the actual shortest path of sectors between two sectors.

#### Scenario: Return traced shortest path

**前提** 星区图已构建

**当** 需要确认两个 sector 之间的具体路径
**那么** `buildSectorPath(from, to, sectorGraph, sectorClusterMap)` SHALL 返回中间经过的所有 sector macro 列表（含首尾）
**否则** 若不可达 SHALL 返回 null

**并且** 该函数 SHALL 与现有 jump 距离语义一致：同 cluster 边为 0，跨 cluster 边为 1。

### Requirement: Connected Component Collection

The system SHALL be able to collect connected components from the `connectedGroupIds` graph.

#### Scenario: Collect group graph components

**前提** groups 的 `connectedGroupIds` 已设置

**当** 调用 `collectConnectedComponents(groups)`
**那么** SHALL 返回每个连通分量中的 group 索引列表
**并且** 同一分量内的任意两个 group 通过 `connectedGroupIds` 可达
