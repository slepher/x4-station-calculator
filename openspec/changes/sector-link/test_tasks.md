# Test Tasks: sector-link

## 1. 纯函数单测

- [x] 1.1 `solveSingleWareDistancePull` 基础分配
- [x] 1.2 距离优先分配（替代跳数）
- [x] 1.3 同层按缺口比例分配
- [x] 1.4 环路网络稳定性
- [x] 1.5 中转边流量结算
- [x] 1.6 不可达缺口保留
- [x] 1.7 并列最短路径确定性
- [x] 1.8 分网 `splitSectorNetwork` 与缺口来源映射
- [x] 1.9 `allocatedDemandBySector` 输出正确

## 2. 多货物聚合单测

- [x] 2.1 `linkWareFlows` 结构与方向正确
- [x] 2.2 货物间隔离性
- [x] 2.3 与单货物基线一致
- [x] 2.4 `deficitSummary` 按 sector 汇总
- [x] 2.5 `allocatedDemandBySector` 按 sector + byWare 汇总

## 3. 星区管理面板单测

- [x] 3.1 星区创建重名自动编号（`2` 起）
- [x] 3.2 星区创建后输入不清空
- [x] 3.3 未分配创建重名自动编号（`2` 起）
- [x] 3.4 未分配创建后输入不清空
- [x] 3.5 未分配创建不自动切页
- [x] 3.6 星区内空间站 `x` 按钮移回未分配
- [x] 3.7 未分配删除：无模块直删
- [x] 3.8 未分配删除：有模块确认后删除

## 4. Tab 与 Store 行为单测

- [x] 4.1 空星区 tab 不显示
- [x] 4.2 空星区分割线不显示
- [x] 4.3 `isEmptyForSave`：仅当星区与空间站都为空时返回 true

## 5. 回归执行

- [x] 5.1 `tests/unit/sector-link/*.spec.ts`
- [x] 5.2 `tests/unit/station-tab-drag/station-tab-bar-empty-sector.spec.ts`
- [x] 5.3 `tests/unit/multi-station-empire/empire-store.spec.ts -t isEmptyForSave`
