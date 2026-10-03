# trade-auto-fill — implementation bug records

## B1 — 离开页面期间的绑定切换未隔离会话
- Reproduction: `presenter.spec.ts` 的 `isolates automatic session state when bindings change while the presenter is unmounted` 在本轮修复前失败（autoFillEnabled 仍为 true）。
- Cause: binding 清理只由 presenter 挂载期间的 watch 驱动。
- Fix: 在 npcTrade store 的会话生命周期同步观察 active binding，清理自动状态、归属、待处理请求及撤销。
- Verification: focused Unit 在 apply 验证；最终验证由 `/x4:verify trade-auto-fill` 执行。

## B2 — 加载中重挂载丢失 archive-only 站点选择
- Reproduction: `presenter.spec.ts` 的 `preserves an archive-only selection during remount while the next snapshot records are loading` 在本轮修复前失败（选中 ID 被清为 null）。
- Cause: 空记录尚未完成加载，菜单校验将其误作有效的空成员集合。
- Fix: 只有所选有效快照的记录完成加载后才校验下级选择。
- Verification: focused Unit 在 apply 验证；最终验证由 `/x4:verify trade-auto-fill` 执行。

## B3 — 缺失 IndexedDB 快照被视作完整空记录
- Evidence: `loadPlayerStationsFlatByArchiveId` 的原有读取在没有 player_stations record 时返回 []，与存在 record 且 data 为空相同。
- Impact: 只有虚拟成员的组可能在缺失快照下计算合法结果。
- Fix: 为现有读取增加 requireRecord 选项；自动填充事实入口的加载必须确认快照记录存在，保留其他读取的既有行为。
- Verification: `archive-load.spec.ts` 覆盖缺失与完整空快照；最终验证由 `/x4:verify trade-auto-fill` 执行。

## B4 — 未绑定规划的真实中转站配置名称丢失
- Reproduction: `station-context.spec.ts` 的 `retains the configured actual trade station name when no station plan exists` 在本轮修复前失败（显示 AAA 而非 Hub）。
- Cause: archive 引用成为去重后的成员时，只读取了 station code，没有挂接 tradeStation 的配置名称。
- Fix: 无 stationPlan 的实际中转站使用确认 tradeStation.name；有 plan 的成员保留 plan.name。
- Verification: focused Unit 在 apply 验证；最终验证由 `/x4:verify trade-auto-fill` 执行。

## B5 — 商品名被同行数量控件挤压
- Evidence: 用户截图中商品名仅显示一个字与省略号；单行布局同时包含来源、说明、输入和删除按钮。
- Fix: 使用用户确认的两行卡片，名称完整换行；移除可见“目标数量”说明，保留读屏标签和原交互。
- Verification: 页面与 presenter focused Unit；最终验证仍由 `/x4:verify trade-auto-fill` 执行。

## B6 — 出售范围需按用户补充收窄为主产物
- Reproduction: 新规则回归用例在修改前有 4 个失败，组出售纳入 energycells 副产物，实际中转站的缺失分类仍返回 ready。
- Cause: 原实现按全部已建 outputs 并集筛选中转站出售，而用户现在要求仅主要产出。
- Fix: 组出售使用各站 resolved priority level 2 与已建产出的交集并集；真实中转站也必须提供主产物分类，继续扣全组建材。
- Verification: targets/station-facts/presenter focused Unit；最终验证仍由 `/x4:verify trade-auto-fill` 执行。
