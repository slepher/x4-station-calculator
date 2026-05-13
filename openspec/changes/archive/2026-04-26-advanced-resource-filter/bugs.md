# bugs

## bug: advanced-candidate-jump-graph-missed-cluster-gates

- 发现时间: 2026-03-13
- 范围: `advanced-resource-filter`
- 现象:
  - 高级资源过滤在 `2` 跳和 `允许中转` 条件下，跨 cluster 的候选组合未进入结果。
  - 例如 `Black Hole Sun IV`、`Grand Exchange III/I/IV`、`Void of Opportunity` 这类本应通过 cluster gate 连通的星区被判定为不可达。
- 原因:
  - `buildSectorGraph()` 仅纳入了 cluster 内部的 `sector_links`，遗漏了 `cluster_gates.target_cluster_id` 对应的跨 cluster 连通关系。
- 修复:
  - 在跳数图构建中加入基于 `cluster_gates` 的双向 cluster 连接边，供高级候选 BFS 计算使用。
