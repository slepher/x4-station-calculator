# 星区群组最小连通图 — 设计方案

## 架构概览

```
autoGroup.ts
├── computeGroupGraph()              ← 新增：普通 group 的 MST 连接图
│   ├── buildMetricClosure()         ← 构建 anchor 间完全距离矩阵
│   ├── kruskalMST()                 ← Kruskal MST（≤桥接搜索跳数直连边）
│   └── collectConnectedComponents() ← 收集仍断裂的 group 分量
├── buildBridgePlanOptions()         ← 新增：生成完整 bridge 方案，最多保留前 5 个
├── applyBridgePlanToDraft()         ← 新增：把已采用 bridge 方案转成普通 draft groups
├── buildSectorPath()                ← 新增：返回最短路径（非仅距离）
│
├── groupCleanSlate()                ← 修改：auto-connect 替换为 MST + bridge 方案
├── applyStandaloneToResult()        ← 修改：新 group 后重算 MST
├── applyAbsorbToResult()            ← 修改：group 删除后重算 MST
└── groupIncremental()               ← 修改：构建后重算 MST
```

## 核心模块

### 1. `computeGroupGraph()`

```typescript
function computeGroupGraph(
  groups: GroupDraftInfo[],
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>,
  maxDistance: number = DEFAULT_BRIDGE_SEARCH_JUMP_RANGE
): void
```

**职责**：
- 清空并重建当前 draft groups 的 `connectedGroupIds`
- 对所有有 anchor 的 group 计算 pairwise distance
- 仅使用 `distance <= maxDistance` 的边构建 MST；`maxDistance` 来自桥接搜索跳数
- 只写入 group-to-group 的直接连接，不表达 bridge marker

**流程**：

```
anchors = groups with sectorMacro
if anchors.length <= 1:
  clear connectedGroupIds
  return

edges = all anchor pairs with distance <= bridgeSearchJumpRange
sort edges by weight asc, stable key asc
run Kruskal
write selected edges to connectedGroupIds bidirectionally
```

桥接搜索跳数：
- UI 名称：桥接搜索跳数
- 默认值：5
- 可选范围：2-5
- 不得小于分组覆盖跳数；分组覆盖跳数调高时同步抬高桥接搜索跳数
- 仅影响 `computeGroupGraph()` 与 `buildBridgePlanOptions()`，不改变普通 assignment 的 5 跳存疑上限

### 2. Bridge 方案生成

```typescript
interface BridgePlanOption {
  id: string
  recommended: boolean
  selected: boolean
  units: BridgePlanUnit[]
  planScore: number
  totalJump: number
  maxJump: number
  stableKey: string
}

interface BridgePlanUnit {
  unitId: string
  label: string
  reaches: BridgeReach[]
  candidates: BridgeSectorCandidate[]
  selectedSectorMacro: string
}

interface BridgeSectorCandidate {
  sectorMacro: string
  score: number
}

interface BridgeReach {
  nodeId: string
  label: string
  jump: number
}
```

**Bridge unit**：
- unit 是“同 cluster 内按有效双向可达 sector graph 划分出的玩家 sector component”
- raw cluster 不是 unit；如果 cluster 内部因为单向 superhighway 或不可往返路径断裂，必须拆成多个 unit 或单 sector
- unit 只有一个玩家 sector 时，UI 直接显示 sector
- unit 有多个玩家 sector 时，UI 显示 cluster/component 名，并在内部选择中心 sector

**方案生成**：
- 输入为 MST 后的断裂 connected components、玩家 sector、hub score、sector graph
- 输出为能减少断裂 components 数量的 bridge unit 组合
- 若无法连通全部 components，但至少能合并两个 components，方案仍有效
- 若存在更大连通覆盖的组合，只保留当前可达到最大连通覆盖的方案
- 搜索边界使用桥接搜索跳数
- 如果没有可连通组合，返回空列表，UI 跳过 bridge 决策
- 如果有组合，按评分保留前 5 个
- 本 change 不做多轮 bridge 决策；一次方案必须覆盖当前 bridge 目标

**评分**：
- `unitScore = max(stationHubScore in unit)`
- `planScore = min(unitScore in plan.units)`
- 排序：`planScore desc` → `totalJump asc` → `maxJump asc` → `units.length asc` → `stableKey asc`
- 多方案时只默认高亮推荐方案，不自动采用
- 单方案时自动采用

### 3. Bridge 方案应用

```typescript
function applyBridgePlanToDraft(
  result: AutoGroupResult,
  plan: BridgePlanOption,
  prefJumpRange: number,
  getSectorName: (macro: string) => string
): AutoGroupResult
```

**行为**：
- 对方案中的每个 unit 创建一个普通 `GroupDraftInfo`
- anchor = `unit.selectedSectorMacro`
- `isNew = true`
- `recalcState = normal`
- 可选 draft-only 标记 `role = 'bridge'` 仅用于 Col 2 预览；确认时不持久化
- 创建后调用 `computeGroupGraph()`，让原 group 与 bridge groups 一起形成 MST
- bridge groups 成为新的固定起点后，调用 assignment 构建逻辑重新生成普通 cards
- bridge 选择前生成的普通 assignments 必须丢弃，避免 bridge sector 继续作为普通候选出现
- 点击 [确定] 时，这些 bridge draft groups 作为普通 `BindingSectorGroup` 写入 store
- 不新增 `BindingSectorGroup.bridgeSectors`，不新增 bridge marker 持久化字段

三态重新计算状态与 bridge：
- bridge draft group 默认 `normal`，不默认 `pin`
- `exclude` group 的 anchor sector 在点击 [重新计算] 时不得作为 bridge unit 候选
- 三态切换不即时触发 `computeGroupGraph()`；只有点击 [重新计算] 或普通 assignment/bridge 采用流程才重算连接图

### 4. Col 3 bridge 决策 UI

Bridge 决策是普通 assignment 之前的阻塞步骤。

```
if bridgePlans.length === 0:
  show ordinary assignment cards
if bridgePlans.length === 1:
  apply the only plan automatically
  show ordinary assignment cards
if bridgePlans.length > 1:
  show only bridge plan cards
  hide ordinary assignment cards
```

多方案 UI：

```
Bridge options

○ Plan A: Cluster A + Sector BA
  score 32M · total 7 jumps · max 3
  Cluster A -> Hub 1 (2), Hub 2 (3)
    ● Sector AA
    ○ Sector AB
  Sector BA -> Hub 2 (2), Hub 3 (3)

○ Plan B: Sector BA + Cluster C
  score 30M · total 8 jumps · max 4
  Sector BA -> Hub 1 (4), Hub 2 (2)
  Cluster C -> Hub 2 (1), Hub 4 (3)
    ● Sector CA
    ○ Sector CB
```

UI 规则：
- 每个方案占一个 card/选项卡
- 单 sector unit 不显示多余 cluster 层级；连接节点和跳数另起一行显示
- 多 sector unit 在 unit 行显示 unit 名称；连接节点和跳数另起一行显示；子 sector 只负责中心选择
- 连接节点必须使用 locale/map 解析后的 sector 显示名
- 连接节点以 pill 显示，sector 名和跳数包含在同一个 pill 内，例如 `虔诚之雾 IV (2)`
- unit 内默认中心 sector：score 高优先，稳定 key 兜底
- 用户选中某方案后，Col 2 立即显示该方案创建的 bridge draft groups
- bridge 方案选择完成后才恢复普通 assignment cards
- 方案选择和中心 sector 选择都不得改变 Col 3 中已有 card 的顺序

### 5. `buildSectorPath()` (saveBindingUtils.ts 新增)

```typescript
function buildSectorPath(
  from: string,
  to: string,
  sectorGraph: Record<string, string[]>,
  sectorClusterMap: Record<string, string>
): string[] | null
```

返回 from → to 的最短路径（含首尾）。由于现有跳数语义包含同 cluster `+0`、跨 cluster `+1`，实现应使用与距离计算一致的 predecessor 追踪方式，不能用会破坏 0 权边语义的普通无权 BFS。

### 6. 集成点

#### 6.1 `groupCleanSlate()`

- Phase A 创建初始 pure hub groups 后调用 `computeGroupGraph()`
- 若存在断裂 components，调用 `buildBridgePlanOptions()`
- 若 bridge 方案唯一，自动 `applyBridgePlanToDraft()`
- 若 bridge 方案多个，将 `bridgePlans` 放入 `AutoGroupResult`，等待 Col 3 用户选择；选择完成后以 bridge groups 为固定起点重建普通 assignments
- 若无 bridge 方案，继续生成普通 assignments

#### 6.2 `applyStandaloneToResult()`

- 新建 standalone group 后调用 `computeGroupGraph()`
- 不重建 Col 3 card 顺序

#### 6.3 `applyAbsorbToResult()`

- 删除 standalone group 或改变覆盖后调用 `computeGroupGraph()`
- 不重建 Col 3 card 顺序

#### 6.4 `groupIncremental()`

- 现有 groups 映射为 draft groups 后调用 `computeGroupGraph()`
- 若断裂且可 bridge，生成 bridge 方案；否则跳过 bridge 决策

### 7. 数据模型变更

```typescript
interface AutoGroupResult {
  groups: GroupDraftInfo[]
  assignments: SectorAssignment[]
  bridgePlans: BridgePlanOption[]
  selectedBridgePlanId?: string
  playerSectorMacros: string[]
}
```

```typescript
interface GroupDraftInfo {
  // existing fields
  role?: 'normal' | 'bridge' // draft/UI only; not persisted
}
```

不修改 `BindingSectorGroup` 持久化结构。

### 8. 测试影响

需要更新现有测试：

| 测试 | 变化 |
|------|------|
| `auto-connects each group to nearest neighbor` | 改为验证 MST 连通性 |
| `standalone auto-connects to nearest group` | 改为验证 standalone 后重算 MST |

新增测试：

| 测试 | 描述 |
|------|------|
| bridge plan generation | 断裂分量存在可连通组合时生成 bridge 方案 |
| bridge plan ranking | 最多保留 5 个，并按 `planScore` 优先排序 |
| single bridge plan auto apply | 只有一个方案时自动创建 bridge draft groups |
| multiple bridge plans gate UI | 多方案时 Col 3 只显示 bridge 方案，普通 cards 隐藏 |
| bridge unit display | 单 sector 直显连接节点/跳数，多 sector 在 unit 级显示连接节点/跳数 |
| disconnected skip | 无可连通组合时跳过 bridge 决策 |
| no persistence field | 确认后 bridge 作为普通 group 写入，不新增 bridge marker 字段 |
