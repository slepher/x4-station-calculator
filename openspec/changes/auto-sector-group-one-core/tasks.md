# auto-sector-group-one-core Tasks

## 1. 核心状态模型

- [ ] 移除 `GroupDraftInfo.recalcState`，统一使用 `isPinned`
- [ ] 移除 per-group `exclude` 入口和算法分支
- [ ] 使用 `excludedDefaultAssignmentSectorMacros` 表达“可手动选但不默认”
- [ ] 删除 `disabledCoverageSectorMacros`、`excludedDefaultConnectedGroupIds` 和 bridge marker 持久化字段

## 2. Hub detection 与分组算法

- [ ] 保持 container-only 容量统计，并合并 `modules[]` 与 `constructions[]`
- [ ] 实现 pure hub、hub score、clean slate 和 incremental 的最终规则
- [ ] Clean slate 按 `generateHubs` 决定是否自动生成 pure hub
- [ ] Sector 默认归属按距离、hub score、稳定 key 和 excluded default 规则决胜
- [ ] Incremental 使用每个既有 group 自己的 `jumpRange`
- [ ] 保持等距 score 差距小于 30% 的 unresolved assignment 规则
- [ ] 保持 Tier 2 超出覆盖跳数但 5 跳内的扩展吸收规则

## 3. MST 与 bridge

- [ ] 构建排除单向 superhighway 的双向星区图
- [ ] Link 候选只包含 `distance <= bridgeSearchJumpRange` 的 anchor pairs
- [ ] `computeGroupGraph()` 支持 fixed connection edges
- [ ] Fixed edge 按 link 两端 retain 独立判定
- [ ] Kruskal MST 只补充缺失边，不删除 fixed edges
- [ ] Bridge unit 基于双向连通 component 生成
- [ ] 多 bridge plan gate ordinary assignments，单 bridge plan 自动采用
- [ ] Bridge group 作为普通 `BindingSectorGroup` 持久化

## 4. 编辑态与 pill

- [ ] 编辑态直接修改 shared draft，[退出] 只切回 result 模式
- [ ] Baseline groups 默认 pinned，unpin 后保留展示但不参与计算
- [ ] 手动新增 hub 可删除
- [ ] Sector group card 非编辑态展示 group、anchor、trade station、jump、pill rows、统计信息
- [ ] Sector group card 编辑态展示 retain、pin/unpin、jumpRange 和删除等输入控件
- [ ] Baseline/current diff 使用普通边框、加粗边框/侧边色块、虚线弱化等视觉标记
- [ ] 移除旧 coverage/candidate/connected 三 tab，改为统一 jump row
- [ ] 实现 coverage `×`、candidate `+`、transfer `→` 和 connected `+ / ×`
- [ ] 修改 connection 时双向同步 `connectedGroupIds`
- [ ] Card 中 coverage/jumpRange/transfer 变更后同步重建 affected assignments
- [ ] Hub 添加/删除后同步重建 affected assignments
- [ ] Assignment 同步保持既有 card 身份和排序

## 5. Assignment 与 confirm

- [ ] Hub anchor sector 不生成 ordinary assignment card
- [ ] 当前 coverage 命中的所有 groups 都成为 options
- [ ] 扩展 options 只取最近距离层，且不默认选中
- [ ] 无当前命中时处理 baseline 重新吸收或 standalone-only 默认规则
- [ ] Standalone 始终最后，且不作为自动 fallback
- [ ] 用户选择 option 后不改变 card 身份和排序
- [ ] Confirm 按 UUID 优先、`sectorMacro` 兜底匹配 groups
- [ ] Confirm 后按最终 coverage 重分配 station plans

## 6. Trade station

- [ ] 实现 trade station candidate 计算
- [ ] 实现自动 hub、手动 hub、bridge hub、无玩家站 hub 的默认值规则
- [ ] Hub 添加时同步生成 trade station 候选和默认选择
- [ ] Hub 删除时同步移除 trade station draft 状态
- [ ] 实现 `tradeStationRetainEnabled` 与 `savedTradeStationCode`
- [ ] Confirm gate 覆盖 bridge、assignment、trade station 三类未决项
- [ ] Confirm 显式写入玩家站或虚拟站 trade station
- [ ] 防止旧 `hubStationCode` / fallback best station 逻辑覆盖用户选择

## 7. 构建验证

- [ ] 实现完成后运行 `npm run build`
