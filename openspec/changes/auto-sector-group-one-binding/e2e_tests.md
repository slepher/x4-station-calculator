# auto-sector-group-one-binding E2E Tests

## 1 Live 展示与计算模式

- [ ] 1.1 展示模式布局与详情入口：覆盖展示模式三列布局、详情按钮、地图按钮、recalc 红点和无 result 禁用状态
- [ ] 1.2 计算模式布局与返回：覆盖进入计算模式不触发算法，通过 sidebar 总览返回展示模式不确认、不计算、不重置 draft
- [ ] 1.3 Sidebar 星区编辑详情入口：覆盖 workbench 选择持久化、刷新恢复、station/sector 选择不覆盖该入口
- [x] 1.4 确认成功后确认按钮置灰：覆盖确认成功后确认按钮置灰，不跳转，保留确认后的 baseline

## 2 Shared Draft 生命周期

- [ ] 2.1 初始载入 shared draft：覆盖 active binding/archive 恢复后生成唯一 shared draft
- [ ] 2.2 Live/Map 共享同一 draft：覆盖 Live 修改后 Map 可见，Map 修改后 Live 可见
- [ ] 2.3 context 切换重置 draft：覆盖切换 active binding 或 selected archive 后旧 context 未提交内容不残留
- [ ] 2.4 面板切换不自动计算：覆盖 Live/Map 面板挂载、切换、详情模式进入不触发分组算法

## 3 计算、重置与提交

- [ ] 3.1 显式计算：覆盖 [计算] 按钮（edit 模式全重算 / result 模式快速重算共用）更新 shared draft 与 `calculationBaseline`
- [ ] 3.2 编辑退出：覆盖 [编辑] 后直接修改 shared draft，[退出] 只切回 result 不恢复 snapshot
- [ ] 3.3 重置：覆盖 [重置] 从 `calculationBaseline` 恢复 group、assignment、trade station、hub color、retain 和 virtual station drafts
- [ ] 3.4 确认 gate：覆盖 edit/no-result/trade-station/uncertain assignment gate 的阻断关系
- [ ] 3.5 确认成功：覆盖写入 binding、记录 `appliedAutoGroupArchiveTime`、同步 live flow、更新 baseline

## 4 Virtual Station Draft

- [ ] 4.1 初始化：覆盖从当前 binding 中无 `saveStationCode` 的 station plans 初始化 virtual station drafts
- [ ] 4.2 保留：覆盖 Live/Map 切换、tab 切换、同 context 重新进入后 virtual station drafts 不被覆盖
- [ ] 4.3 重新计算：覆盖 [计算] 后 virtual station drafts 保留并按新 groups 重算归属
- [ ] 4.4 未分组：覆盖 group/coverage 改变后 virtual station draft 进入未分组状态
- [ ] 4.5 确认应用：覆盖先应用 auto groups，再同步无 `saveStationCode` virtual station plans，且不修改带 `saveStationCode` 的 save station plans

## 5 回归风险

- [ ] 5.1 防止组件挂载或 tab 切换覆盖用户未提交 draft
- [ ] 5.2 防止 `handleColorChange` 直接写入持久化 binding
- [ ] 5.3 防止 [重置] 只恢复 groups 而遗漏 virtual station drafts
- [ ] 5.4 防止 `normalizeState()` 丢弃新增 SaveBindingPlan 字段
- [ ] 5.5 防止 trade station 未解决时进入 uncertain assignment 二次确认
