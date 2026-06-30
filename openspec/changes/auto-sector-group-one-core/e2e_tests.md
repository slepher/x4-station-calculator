# auto-sector-group-one-core E2E Tests

## 1 自动分组与连接

- [ ] 1.1 Clean slate 分组：覆盖 pure hub 生成 groups、coverage、assignments
- [ ] 1.2 Incremental 分组：覆盖已有 binding groups 作为 baseline input，新玩家 sector 进入 assignment
- [ ] 1.3 hub detection 结果：覆盖 container-only 容量、constructions 合并、hub score 对默认归属的影响
- [ ] 1.4 MST connections：覆盖 group anchor 之间按 bridgeSearchJumpRange 生成 connected groups
- [ ] 1.5 Bridge plan：覆盖多 bridge plan gate ordinary assignments，单 bridge plan 自动采用

## 2 编辑态与 Assignment

- [ ] 2.1 非编辑态 group card：覆盖 group、anchor、trade station、jump、pill rows、统计信息展示
- [ ] 2.2 编辑态 group card：覆盖 retain、pin/unpin、jumpRange、pill 操作、删除按钮规则
- [ ] 2.3 coverage 操作：覆盖 coverage `×`、candidate `+`、transfer `→` 后 affected assignments 同步
- [ ] 2.4 jumpRange 操作：覆盖 jumpRange 变化后 coverage/candidate 与 assignment 状态同步
- [ ] 2.5 assignment options：覆盖当前命中、扩展 options、baseline 重新吸收、standalone 末位规则
- [ ] 2.6 assignment 稳定性：覆盖用户选择后 card 身份和排序不变化

## 3 Hub 添加/删除

- [ ] 3.1 already-anchor 禁止：覆盖已是任意 group anchor 的 sector 不可重复添加
- [ ] 3.2 添加玩家 sector hub：覆盖从其他 group active coverage 移除，并不再生成 ordinary assignment card
- [ ] 3.3 添加非玩家 sector hub：覆盖不创建虚拟 stationPlan，默认使用 virtual trade station
- [ ] 3.4 删除新 hub：覆盖移除 group、connections、trade station 状态，并重建 affected assignments
- [ ] 3.5 orphan 清理：覆盖 hub 删除后不残留 orphan assignment、connection、trade station card 或重复 standalone group

## 4 Trade Station

- [ ] 4.1 候选列表：覆盖原始候选池、presenter 展示筛选、top 5 保留 pure qualified、零货舱规则、无玩家站 hub
- [ ] 4.2 默认值：覆盖 pure hub、混合候选、全生产站候选、无玩家站 virtual station 默认值
- [ ] 4.3 retain：覆盖 trade station retain 启用时优先使用 saved code
- [ ] 4.4 confirm gate：覆盖 bridge、assignment、trade station 三类未解决项阻断提交
- [ ] 4.5 持久化：覆盖玩家站与虚拟交易站写入 `BindingSectorGroup.tradeStation`
- [ ] 4.6 virtual trade station 位置：覆盖 position 可来自 map draft，`sectorMacro` 固定为 group hub sector

## 5 Confirm 写入

- [ ] 5.1 group 匹配：覆盖 UUID 优先、`sectorMacro` 兜底匹配已有 group
- [ ] 5.2 group 写入：覆盖 groups、coverage、connections、jumpRange、trade station 一次性写入一致
- [ ] 5.3 station plan 归属：覆盖 confirm 后按最终 coverage 重分配 station plans
- [ ] 5.4 virtual station plans：覆盖无 `saveStationCode` virtual station plans 同步，未分组不写回
- [ ] 5.5 save station 隔离：覆盖带 `saveStationCode` 的 station plans 不被 virtual station 同步修改

## 6 回归风险

- [ ] 6.1 防止 solid/liquid cargo 被计入 hub 容量
- [ ] 6.2 防止单向 superhighway 被当作双向 MST 边
- [ ] 6.3 防止 standalone 作为自动 fallback 默认值
- [ ] 6.4 防止 baseline group unpin 后被物理删除
- [ ] 6.5 防止 connection retain 关闭后仍作为 fixed edge 输入
- [ ] 6.6 防止 `__virtual__` 写入持久化 `saveStationCode`
- [ ] 6.7 防止旧 `hubStationCode` 或 fallback best station 覆盖用户选择
