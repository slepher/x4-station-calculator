# 星区群组最小连通图 — 实现任务

## 1. 新增路径与连通组件工具

- [x] 在 `saveBindingUtils.ts` 新增 `buildSectorPath(from, to, sectorGraph, sectorClusterMap): string[] | null`
- [x] 路径函数返回 from → to 的最短路径（含首尾 sector macro），不可达返回 null
- [x] 路径函数保持 cluster-aware jump 语义（同 cluster +0，跨 cluster +1）
- [x] 在 `autoGroup.ts` 新增 `collectConnectedComponents(groups): number[][]`

## 2. 新增 MST 核心算法

- [x] 在 `autoGroup.ts` 新增 `computeGroupGraph()`
- [x] 实现 metric closure：对每对 anchor 计算距离
- [x] 实现 Kruskal MST（Union-Find，边权重 ≤ 桥接搜索跳数）
- [x] 每次重算前清空旧 `connectedGroupIds`
- [x] 选中边写入双向 `connectedGroupIds`
- [x] 保持 `connectedGroupIds` 只表达 group-to-group 直接连接

## 3. 新增 Bridge 方案生成

- [x] 在 `autoGroup.ts` 新增 bridge unit 构建逻辑
- [x] bridge unit 按同 cluster 内有效双向可达 sector component 划分，不直接等同 raw cluster
- [x] 单向 superhighway 或不可往返导致的 cluster 内断裂必须拆分为不同 unit
- [x] 新增 `buildBridgePlanOptions()`：生成能连通断裂分量的完整 bridge unit 组合
- [x] `buildBridgePlanOptions()` 使用桥接搜索跳数作为最大搜索距离
- [x] 无可连通 bridge 方案时跳过 bridge 决策
- [x] 仅保留前 5 个 bridge 方案

## 4. Bridge 评分与默认选择

- [x] unit score = unit 内所有 station 的最高 hub score
- [x] plan score = plan 内所有 unit score 的最小值
- [x] plan 排序：`planScore desc` → `totalJump asc` → `maxJump asc` → bridge unit 数少 → stable key
- [x] 多方案时仅默认高亮推荐方案，不自动采用
- [x] 单方案时自动采用
- [x] 多 sector unit 默认 center sector：score 高优先，stable key 兜底

## 5. Bridge 方案应用为 Draft Groups

- [x] 新增 `applyBridgePlanToDraft()`
- [x] 被采用方案中的每个 bridge unit 创建一个普通 `GroupDraftInfo`
- [x] 单 sector unit 直接使用该 sector 作为 anchor
- [x] 多 sector unit 使用用户选择的 center sector 作为 anchor
- [x] bridge draft groups 加入 groups 后调用 `computeGroupGraph()`
- [x] bridge draft groups 成为固定起点后重新生成普通 assignments
- [x] bridge 选择前生成的普通 assignments 不得复用
- [x] 确认写入时不新增 bridge marker 持久化字段，bridge groups 作为普通 `BindingSectorGroup` 写入

## 6. Col 3 Bridge 决策 UI

- [x] 多个 bridge 方案存在时，Col 3 只显示 bridge 方案 cards，隐藏普通 assignment cards
- [x] 每个方案 card 显示方案标题，例如 `Cluster A + Sector BA`
- [x] 单 sector unit 显示 `Sector BA -> Hub 2 (2), Hub 3 (3)`
- [x] 多 sector unit 显示 `Cluster A -> Hub 1 (2), Hub 2 (3)`，子项只显示 center sector 选择
- [x] 选择方案后 Col 2 立即显示对应 bridge draft groups
- [x] bridge 方案选择完成后恢复普通 assignment cards
- [x] 方案选择和 center sector 选择不得改变 Col 3 card 既有顺序

## 7. 集成点修改

- [x] `groupCleanSlate()`：替换 nearest-neighbor auto-connect 为 `computeGroupGraph()` + bridge 方案流程
- [x] `applyStandaloneToResult()`：替换 nearest-neighbor auto-connect 为 `computeGroupGraph()`
- [x] `applyAbsorbToResult()`：删除 standalone group 后调用 `computeGroupGraph()`
- [x] `groupIncremental()`：构建 groups 后调用 `computeGroupGraph()` + bridge 方案流程
- [x] Col 2 [重新计算] 和 Pin/Unpin 触发连接图重算

## 8. Bridge 搜索跳数配置

- [x] 新增桥接搜索跳数配置，默认 5
- [x] 桥接搜索跳数可选 2-5
- [x] 桥接搜索跳数不得小于分组覆盖跳数
- [x] `computeGroupGraph()`、`buildBridgePlanOptions()`、bridge 方案采用后的重算均使用桥接搜索跳数
- [x] 分组覆盖跳数默认改为 2

## 9. Build Validation

- [x] `npm run build` 通过
