# Test Tasks: sector-link-calc

## 1. 纯函数单测（由 sector-link 迁移）

- [x] 1.1 `solveSingleWareDistancePull` 基础分配
- [x] 1.2 距离优先分配（替代跳数）
- [x] 1.3 同层按缺口比例分配
- [x] 1.4 环路网络稳定性
- [x] 1.5 中转边流量结算
- [x] 1.6 不可达缺口保留
- [x] 1.7 并列最短路径确定性
- [x] 1.8 分网 `splitSectorNetwork` 与缺口来源映射
- [x] 1.9 `allocatedDemandBySector` 输出正确

## 2. 多货物聚合单测（由 sector-link 迁移）

- [x] 2.1 `linkWareFlows` 结构与方向正确
- [x] 2.2 货物间隔离性
- [x] 2.3 与单货物基线一致
- [x] 2.4 `deficitSummary` 按 sector 汇总
- [x] 2.5 `allocatedDemandBySector` 按 sector + byWare 汇总

## 3. 后续增补回归

- [x] 3.1 `linkId` 含分隔符时 `linkWareFlows.from/to` 不串位
- [x] 3.2 空星区回退到连接且有站星区产物集合后仍可生成中转流量
- [x] 3.3 中转缓存：切换数量/经济/仓储/运输 tab 不重复触发纯函数
- [x] 3.4 仓储/运输外部条目文案显示输入/输出，本地条目保持产出/消耗
- [x] 3.5 仓储/运输空态下不显示孤立分组标题
