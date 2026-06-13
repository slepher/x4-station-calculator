# 星区群组最小连通图 (auto-sector-group-link)

## 目标

修改 auto-sector-group 的连接算法：使普通 sector group 的 `connectedGroupIds` 形成**最小生成树（MST）**。当 hub anchor 之间超过桥接搜索跳数无法直达时，自动生成可创建为 sector group 的 bridge 方案；若方案唯一则自动采用，若存在多个方案则在 Col 3 顶部先让用户选择一个方案，再继续处理普通节点。

## 已确认方案（审核重点）

### 1. 最小连通图算法

**输入**：所有 group 的 anchor 星区 + 所有玩家星区（含未分配/存疑）

**Phase 1 — 完全距离矩阵**：
- 对每对 group anchor (a, b) 计算 BFS cluster-jump 距离（与现有 `getDistance()` 一致）

**Phase 2 — Kruskal MST（直达边）**：
- 边集 E = { (a, b, weight) | distance(a,b) ≤ bridgeSearchJumpRange }
- 按 weight 升序排列
- Union-Find 构建 MST
- 选中的边 → 写入 `connectedGroupIds`（双向）

**Phase 3 — bridge 方案生成（断裂分量间）**：
- 若 MST 后已全连通 → 不生成 bridge 方案
- 若无法找到能连通断裂分量的 bridge 组合 → 跳过 bridge 决策，保留断裂分量，继续普通节点处理
- 若存在可连通组合 → 生成完整 bridge 方案列表，每个方案由一个或多个 bridge unit 组成
- 方案最多保留前 5 个推荐组合

### 2. Bridge 方案与评分

**Bridge unit 定义**：
- bridge unit 是可创建为 sector group 的候选中心单元
- unit 不是原始 cluster，而是“同 cluster 内按有效双向可达 sector graph 划分出的玩家 sector component”
- 若 cluster 内部因单向 superhighway 或不可往返路径断裂，断裂部分不得合并为一个整体方案，只能按各自可达 component/sector 参与
- 若 unit 只有一个玩家 sector，UI 直接显示 sector 名
- 若 unit 有多个玩家 sector，UI 显示 cluster/component 名，并在 unit 内让用户选择中心 sector

**Bridge 方案定义**：
- 一个 bridge 方案是若干 bridge unit 的组合，例如 `Cluster A + Sector BA`、`Sector BA + Cluster C`
- 方案被采用后，每个 bridge unit 创建一个普通 `GroupDraftInfo`
- 该 draft group 的 anchor 为 unit 内选中的 sector
- bridge draft group 采用后成为新的固定起点，普通 assignment cards 必须重新计算
- bridge 选择前生成的普通 assignment 结果不得继续复用
- 点击 [确定] 后，已采用方案中的 bridge draft group 作为普通 `BindingSectorGroup` 写入 store
- 不新增 `BindingSectorGroup.bridgeSectors` 或其他 bridge marker 持久化字段

**评分规则**：
- 每个 bridge unit 的 score = 该 unit 内所有 station 的最高 hub score
- 每个 bridge 方案的 score = 方案内所有 bridge unit score 的最小值
- 推荐排序：`planScore` 高优先 → `totalJump` 小 → `maxJump` 小 → bridge unit 数少 → 稳定 key 排序
- 多个方案时可以默认高亮推荐方案，但不得自动采用，必须用户选择
- 只有一个方案时自动采用该方案；若方案内部某个 unit 有多个 sector，仍保留中心 sector 的默认选择并允许用户调整

### 3. 重算触发时机

| 事件 | 行为 |
|------|------|
| `groupCleanSlate()` Phase A 完成 | `computeGroupGraph()` 替换当前 nearest-neighbor 循环 |
| bridge 方案被自动采用或用户选择 | 创建 bridge draft groups 后重算 `computeGroupGraph()` |
| `applyStandaloneToResult()` 新建 group | 全量重算 `computeGroupGraph()` |
| `applyAbsorbToResult()` 吸收/删除 group | 全量重算 `computeGroupGraph()` |
| `groupIncremental()` 构建 groups 后 | 全量重算 `computeGroupGraph()` |
| Col 2 [重新计算] | 自然触发 |
| Pin/Unpin | 触发 `computeGroupGraph()` |

### 4. Col 3 bridge 决策交互

- 若存在多个 bridge 方案，Col 3 进入 bridge 决策模式
- bridge 决策模式下，Col 3 只显示 bridge 方案选项卡，隐藏普通 assignment cards 和其他剩余节点
- 每个方案占一个选项卡/卡片，例如 `Cluster A + Sector BA`
- 方案内单 sector unit 直接显示 sector；连接节点与跳数另起一行，以 pill 显示，例如 `虔诚之雾 IV (2)`
- 方案内多 sector unit 在 cluster/component 级别显示名称；连接节点与跳数另起一行以 pill 显示；子项只显示 `Sector AA / Sector AB` 等中心 sector 选择
- 连接节点必须显示 locale/map 解析后的 sector 名，不得显示 `Sector 1` 或 `cluster_*_macro` 等内部名
- 多 sector unit 默认选择更契合的 sector：score 高优先，稳定 key 作为兜底
- 用户选择方案后，Col 2 立即显示对应 bridge draft groups；普通 assignment cards 随后恢复显示
- 普通 assignment cards 恢复显示时，必须基于已采用 bridge groups 重新生成，bridge sector 不得继续作为普通候选卡出现
- 方案选择和 unit 内中心 sector 选择都不得改变 Col 3 中 card 的既有顺序
- bridge 决策不存在多轮：一次生成的完整 bridge 方案要么被采用一个，要么因无方案直接跳过

### 5. 当前 nearest-neighbor 逻辑替换

以下 2 处 auto-connect 逻辑被替换：

1. `autoGroup.ts:263-284` — `groupCleanSlate()` 中「每个 group 连最近邻」
2. `autoGroup.ts:840-858` — `applyStandaloneToResult()` 中「新 group 连最近邻」

全部替换为 `computeGroupGraph(groups, ..., bridgeSearchJumpRange)` 单次调用。

### 6. 桥接搜索跳数配置

- UI 名称：桥接搜索跳数
- 默认值：5
- 可选范围：2-5
- 不得小于 auto-sector-group 的分组覆盖跳数
- 分组覆盖跳数从默认 3 改为默认 2
- 若分组覆盖跳数调高到超过当前桥接搜索跳数，桥接搜索跳数自动抬高到相同值
- 该配置只影响 MST 连接图和 bridge 方案搜索，不改变普通 assignment 的 5 跳存疑上限

## 边界

**In Scope**：
- `computeGroupGraph()` 函数实现（MST + bridge 方案后的 draft group 连接）
- bridge 方案生成、排序、最多展示前 5 个推荐组合
- bridge 方案选择 UI（Col 3 顶部阻塞式决策）
- 已采用 bridge 方案创建普通 `GroupDraftInfo`
- 4 处集成点替换
- `saveBindingUtils.ts` 新增 `buildSectorPath()` 辅助函数（记录路径，非仅距离）

**Out of Scope**：
- 地图覆盖高亮
- bridge marker 持久化字段（确认后 bridge 是普通 sector group）
- bridge 方案的手动编辑（除选择方案和选择中心 sector 外）

## 验收标准（DoD）

1. `groupCleanSlate()` 输出：`connectedGroupIds` 形成 MST，所有桥接搜索跳数内可连通的 anchor 在同一个连通分量内
2. 存在可连通断裂分量的 bridge 组合时，生成最多 5 个 bridge 方案并按 planScore 规则排序
3. 仅有一个 bridge 方案时自动采用；多个 bridge 方案时 Col 3 先只显示 bridge 方案并要求用户选择
4. 多 sector unit 在 unit 级展示名称，连接节点/跳数另起一行用 pill 展示，sector 子项只负责选择中心 sector；单 sector unit 直接显示 sector + 连接节点/跳数 pill
5. 被采用的 bridge 方案在 Col 2 创建普通 draft groups，点击 [确定] 后作为普通 `BindingSectorGroup` 写入
6. bridge 方案采用后，普通 assignments 基于 bridge groups 重新生成，bridge sector 自身不再显示为普通候选卡
7. 无法生成可连通 bridge 方案时跳过 bridge 决策，普通节点处理继续
8. `applyStandaloneToResult()` / `applyAbsorbToResult()` / `groupIncremental()` 后全量重算 MST
9. bridge 方案选择和中心 sector 选择不改变 Col 3 card 顺序
10. 桥接搜索跳数默认 5，可选 2-5，且不得小于分组覆盖跳数；分组覆盖跳数默认 2
11. `npm run build` 通过

## 未决项

无
