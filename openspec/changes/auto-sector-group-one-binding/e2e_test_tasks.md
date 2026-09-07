# M2.1 当前迁移验收（2026-09-07）

状态：incomplete。未满足项：自动 activeBindingStation 变化不得覆盖 auto-sector-group workbench。恢复条件：在适用规范下定位真实 UI 引发自动 station 变化的路径，补上该路径的独立 expected 与 focused witness，经主 agent 审查后才能完成。稳定共享输入已交接，不阻塞 M3。

当前工作树基线 d590ede41d41913ab18f5c5a18247bf956a4685a + ENV runner 修复。下方原清单是历史追踪，旧勾选已全部清空；本轮有证据的事务只在当前映射/报告中说明，不将事务通过推断为每个历史子步骤通过。当前实现、命令、日志与逐项覆盖见 `tests/e2e/auto-sector-group-one-binding/migration-task-test-2.1.md` 和 `docs/plan/unified-test-repair/direct-migration/results/M2.1.md`。

- 当前公共文案依 `auto-sector-group-binding-mode/spec.md` 为 `[查看 | 编辑 | 重算]`、`[重新计算]`。旧 [退出]、[快速计算]、[生成方案] 入口替换为当前三态；不为旧 UI 改产品。
- Reset 按 saved binding groups + 当前参数重新计算；旧 3.3.5“不重新运行算法”与当前规范冲突，迁移为“保持 binding/archive context，保留当前参数”；旧 calculationBaseline 捕获项不再适用。
- Confirm 在 edit 中执行正常 gate；成功后仍处于 auto-sector-group，不返回展示。旧 3.4.1“edit 一律拦截”、3.5.6“回展示”不再适用。
- 当前运行态及持久化 group 身份均按 sectorMacro 对齐。normalize-fields fixture 中的旧 UUID 是专门验证 schema v1 迁移的输入，不能移除。
- 原重复/空壳编号整合为 16 个真实 UI 事务：无 skip、无条件通过、无业务 store 写代替点击；原有效目的保留在以下映射及历史清单。

| 原编号 | 当前事务/验收 |
| --- | --- |
| 1.1、1.2、1.3、2.1、2.4、3.2 | display 三列、calculate 三列、sidebar 红点/启用、三态保留颜色、overview 往返保留 virtual、菜单 reload 恢复；no-result 由删除全部 binding 的真实 UI 事务证明 |
| 1.3.5 | 旧“点击 station 不切菜单”过强：当前规范限制自动 active station 变化；显式 sidebar station 操作属于用户切菜单。自动变化保护没有单独 E2E witness，保留此验证界限待主 agent 审查 |
| 1.4、3.5、5.6 | 真实选择 trade station 并确认，持久化颜色/顺序/coverage/connections/jumpRange/applied time；确认禁用、无新增高亮、reload 恢复 |
| 2.2、4.1、4.2、5.1 | Live→Map→Live 双向改色；Map UI 删除 virtual draft，面板往返仍保留删除；未确认不写 binding |
| 2.3 | UI 载入不同 binding 后旧色不残留；同 GUID 从明确固定 667632.933 切到 700000 重新建 draft；删除全部 binding 后无 result/入口禁用 |
| 3.1 | 重算模式改阈值，重新计算后自动查看、不保存、不覆盖 saved pill baseline |
| 3.3、5.3 | Reset 丢弃颜色/virtual 删除、恢复 virtual 归属，保留当前阈值与 context；不对算法结果全对象深比较 |
| 3.4、3.6、5.5 | fixture 原始 station 等分候选产生 trade gate；正常 UI 选项解除 gate；独立单 hub fixture 产生 uncertain popup，取消不保存、再次确定保存 |
| 4.3 | 删除 virtual 后显式重新计算，删除内容仍在 draft 且未持久化 |
| 4.4 | fixture virtual 位于 hub coverage，真实 jumpRange 编辑使其未分组，Map 未分组行可见，Reset 恢复归属 |
| 4.5 | 真实 pointer 创建和再次移动 virtual，确认/reload 后保持相同 id/position；删除确认只删除 virtual，不改已有 save station 内容 |
| 5.2 | 真实 UI 改色只写 shared draft，reload 丢弃且持久化 binding 不变 |
| 5.4 | 通过版本化 localStorage 初始化 fixture 后 reload；字段保持精确常量，旧引用迁移为 sectorMacro |

## 历史原任务清单（保留原编号与目的，历史勾选已清空；本轮以以上映射为准）

# auto-sector-group-one-binding E2E Test Tasks

## 1 Live 展示与计算模式

- [ ] 1.1 展示模式布局与详情入口：覆盖展示模式三列布局、详情按钮、地图按钮、recalc 红点和无 result 禁用状态
  - [ ] 1.1.1 加载 fixture 并进入 live production，确认展示模式渲染三列布局（存档/星区/资源）
  - [ ] 1.1.2 确认星区列顶部显示桥接跳数、覆盖跳数、Hub 阈值数值（只读）
  - [ ] 1.1.3 确认星区列顶部存在详情按钮和地图按钮
  - [ ] 1.1.4 设置 `appliedAutoGroupArchiveTime` 使 `needsAutoGroupRecalc=true`，详情按钮红点和 tooltip 可见
  - [ ] 1.1.5 设置 `autoGroupResult=null`，详情按钮置灰禁用

- [ ] 1.2 计算模式布局与返回：覆盖进入计算模式不触发算法，通过 sidebar 总览返回展示模式不确认、不计算、不重置 draft
  - [ ] 1.2.1 在展示模式点击详情按钮，确认进入计算模式（三列变为星区/分配/交易站布局）
  - [ ] 1.2.2 通过检查 store 状态确认进入计算模式时未调用分组算法（`autoGroupResult` 未变化）
  - [ ] 1.2.3 确认计算模式顶部渲染共用 `AutoSectorBar`
  - [ ] 1.2.4 点击 sidebar 总览入口，确认回到展示模式（三列布局变回存档/星区/资源）
  - [ ] 1.2.5 确认通过 sidebar 返回操作未触发计算、未重置 draft

- [ ] 1.3 Sidebar 星区编辑详情入口：覆盖 workbench 选择持久化、刷新恢复、station/sector 选择不覆盖该入口
  - [ ] 1.3.1 确认 sidebar 分隔线区域存在星区编辑详情入口
  - [ ] 1.3.2 点击 sidebar 入口，确认进入计算/详情视图且 `activeBindingWorkbench` 设为 `auto-sector-group`
  - [ ] 1.3.3 刷新页面，确认 sidebar 入口仍然选中（active view 持久化恢复）
  - [ ] 1.3.4 确认刷新后恢复 `auto-sector-group` workbench 时未调用分组算法或 `initAutoGroupDraft()`
  - [ ] 1.3.5 当前在 auto-sector-group workbench 时选择一个 station，确认 `activeBindingWorkbench` 不被覆盖为 `station`
  - [ ] 1.3.6 当 `autoGroupResult=null` 时 sidebar 入口置灰禁用
  - [ ] 1.3.7 当 `needsAutoGroupRecalc=true` 时 sidebar 入口显示红点提示

- [ ] 1.4 确认成功后确认按钮置灰：覆盖确认成功后确认按钮置灰，不跳转，不捕获计算完成 baseline
  - [ ] 1.4.1 在计算模式完成所有 assignment 和 trade station 后点击确认
  - [ ] 1.4.2 确认后确认按钮置灰（hasChanges=false）
  - [ ] 1.4.3 确认后不维护 `calculationBaseline`
  - [ ] 1.4.4 确认后 `calcBaselinePillState` 更新为确认后的 groups

## 2 Shared Draft 生命周期

- [ ] 2.1 初始载入 shared draft：覆盖 active binding/archive 恢复后生成唯一 shared draft
  - [ ] 2.1.1 加载 fixture 进入 live production 后，确认 `autoGroupResult` 非 null 且 groups 非空
  - [ ] 2.1.2 当 `needsAutoGroupRecalc=false` 时，确认使用 `buildAssignmentsFromBinding()` 构建 assignments
  - [ ] 2.1.3 确认 `calcBaselinePillState` 在初始化时写入

- [ ] 2.2 Live/Map 共享同一 draft：覆盖 Live 修改后 Map 可见，Map 修改后 Live 可见
  - [ ] 2.2.1 在 Live 计算模式中修改 group 颜色，切换到 Map binding 面板
  - [ ] 2.2.2 在 Map 中确认颜色修改可见（共享同一 `autoGroupResult`）
  - [ ] 2.2.3 在 Map 中修改颜色，切回 Live，确认 Live 可见
  - [ ] 2.2.4 通过 store 确认两个面板读写同一份 `virtualStationDrafts`

- [ ] 2.3 context 切换重置 draft：覆盖切换 active binding 或 selected archive 后旧 context 未确认内容不残留
  - [ ] 2.3.1 在 Live 计算模式中修改 draft（如修改 assignment）
  - [ ] 2.3.2 切换到另一个 active binding（修改 `activeBinding`），确认旧 context 的修改不残留
  - [ ] 2.3.3 切换到同一 gameGuid 但不同 archive time，确认 draft 重新初始化
  - [ ] 2.3.4 清空 active binding/archive（设置 `activeBinding=null`），确认 draft 清空

- [ ] 2.4 面板切换不自动计算：覆盖 Live/Map 面板挂载、切换、详情模式进入不触发分组算法
  - [ ] 2.4.1 在 Live 展示模式下切到 Map binding 面板再切回，确认未触发分组算法
  - [ ] 2.4.2 在 Live 展示模式与计算模式间多次切换，确认每次切换不运行算法
  - [ ] 2.4.3 确认组件挂载（如 Map 面板挂载）时不调用 `initAutoGroupDraft()`（通过 watch 或 spy 验证）

## 3 计算、重置与提交

- [ ] 3.1 显式生成：覆盖 [生成方案] 按钮更新 shared draft，但不捕获计算完成 baseline
  - [ ] 3.1.1 切到生成模式，修改跳数或阈值后点击生成方案按钮
  - [ ] 3.1.2 确认 `autoGroupResult` 更新为新的分组结果
  - [ ] 3.1.3 确认不捕获 `calculationBaseline`
  - [ ] 3.1.4 在生成模式点击生成方案按钮，确认执行生成路径
  - [ ] 3.1.5 确认显式生成后自动切换到首个未解决 tab（pending bridge -> allocation，unresolved trade station -> tradeStation，否则 -> hub）

- [ ] 3.2 编辑切换：覆盖通过三态按钮进入编辑后直接修改 shared draft，切回预览不恢复 snapshot
  - [ ] 3.2.1 通过三态按钮从预览切到编辑，确认进入编辑模式
  - [ ] 3.2.2 在编辑模式下修改 coverage/assignment 等，通过三态按钮切回预览，确认不恢复 snapshot
  - [ ] 3.2.3 确认切回预览后 draft 修改保留（不恢复进入编辑前的 snapshot）
  - [ ] 3.2.4 确认模式切换不调用 snapshot 恢复逻辑

- [ ] 3.3 重置：覆盖 [重置] 从 saved binding groups + 当前参数重算 group、assignment、trade station、hub color、retain 和 virtual station drafts
  - [ ] 3.3.1 在计算模式中修改 draft（改 assignment、改颜色），点击重置按钮
  - [ ] 3.3.2 确认 `autoGroupResult` 来自 saved binding groups + 当前参数重算，而非当前 draft
  - [ ] 3.3.3 确认 `virtualStationDrafts` 从 binding 重新初始化并按重算 groups 归属
  - [ ] 3.3.4 确认重置不切换 active binding 或 selected archive
  - [ ] 3.3.5 确认重置不重新运行分组算法

- [ ] 3.4 确认 gate：覆盖 edit/no-result/trade-station/uncertain assignment gate 的阻断关系
  - [ ] 3.4.1 在编辑模式下点击确认，确认被拦截（返回 false，不写入 binding）
  - [ ] 3.4.2 在无 result 时点击确认，确认被拦截
  - [ ] 3.4.3 存在未解决 trade station 时点击确认，确认被拦截且不打开 uncertain assignment popup
  - [ ] 3.4.4 存在 uncertain assignment 时点击确认，确认打开二次确认 popup 并返回 false
  - [ ] 3.4.5 在二次确认 popup 中再次点击确认，所有 gate 通过后确认成功

- [ ] 3.5 确认成功：覆盖写入 binding、记录 `appliedAutoGroupArchiveTime`、同步 live flow、更新 baseline
  - [ ] 3.5.1 确认成功后确认 binding 中 groups 已写入
  - [ ] 3.5.2 确认 `appliedAutoGroupArchiveTime` 记录为当前 selected archive time
  - [ ] 3.5.3 确认 live flow 已同步
  - [ ] 3.5.4 确认 `calcBaselinePillState` 更新为确认后的 groups
  - [ ] 3.5.5 确认不维护 `calculationBaseline`
  - [ ] 3.5.6 确认后 Live 回到展示模式

## 4 Virtual Station Draft

- [ ] 4.1 初始化：覆盖从当前 binding 中无 `saveStationCode` 的 station plans 初始化 virtual station drafts
  - [ ] 4.1.1 确认 fixture 的 binding 中存在无 `saveStationCode` 的 `BindingStationPlan`
  - [ ] 4.1.2 确认 `autoGroupResult.groups` 生成后 `virtualStationDrafts` 从 binding clone
  - [ ] 4.1.3 确认带 `saveStationCode` 的 station plans 未被纳入 `virtualStationDrafts`
  - [ ] 4.1.4 确认 `virtualStationDraftInitializedKey` 记录当前 context key

- [ ] 4.2 保留：覆盖 sidebar 切换、tab 切换、同 context 重新进入后 virtual station drafts 不被覆盖
  - [ ] 4.2.1 在 Live 中修改 virtual station draft（如修改名称/属性），切换到 Map 面板
  - [ ] 4.2.2 通过 sidebar 总览回到展示模式再进入，确认 drafts 未被重置或覆盖
  - [ ] 4.2.3 打开 Virtual Station tab 再关闭，确认 drafts 不变
  - [ ] 4.2.4 同 context 下反复进出计算模式，确认 drafts 保留

- [ ] 4.3 重新生成：覆盖 [生成方案] 后 virtual station drafts 保留并按新 groups 重算归属
  - [ ] 4.3.1 在已有 virtual station drafts 的状态下点击生成方案
  - [ ] 4.3.2 确认 `virtualStationDrafts` 内容保留
  - [ ] 4.3.3 确认按新 groups 重算了归属（`groupId` 更新）
  - [ ] 4.3.4 确认无当前 group 归属的 draft 保留为未分组状态

- [ ] 4.4 未分组：覆盖 group/coverage 改变后 virtual station draft 进入未分组状态
  - [ ] 4.4.1 修改 groups 或 coverage 导致某个 virtual station draft 失去 group 归属
  - [ ] 4.4.2 确认该 draft 进入未分组状态（`groupId` 为 null/undefined）
  - [ ] 4.4.3 确认未分组 drafts 在 UI 中可见且可编辑

- [ ] 4.5 确认应用：覆盖先应用 auto groups，再同步无 `saveStationCode` virtual station plans，且不修改带 `saveStationCode` 的 save station plans
  - [ ] 4.5.1 确认后，确认先应用 auto groups（groups/coverage/connections/colors/trade station）
  - [ ] 4.5.2 确认再同步 virtual station drafts：创建的创建、更新的更新、删除的删除
  - [ ] 4.5.3 确认未分组 drafts 不写回 binding（binding 中对应旧 plan 被删除）
  - [ ] 4.5.4 确认带 `saveStationCode` 的 save station plans 不被 virtual station 同步修改

## 5 回归风险

- [ ] 5.1 防止组件挂载或 tab 切换覆盖用户未确认 draft
  - [ ] 5.1.1 用户编辑 draft 后，通过程序触发组件重新挂载（如切换 view 再切回）
  - [ ] 5.1.2 确认 `autoGroupResult` 保留编辑内容
  - [ ] 5.1.3 确认 `virtualStationDrafts` 保留编辑内容

- [ ] 5.2 防止 `handleColorChange` 直接写入持久化 binding
  - [ ] 5.2.1 在编辑模式中修改 group 颜色
  - [ ] 5.2.2 通过 store 确认颜色修改只写入 shared draft 而非 binding
  - [ ] 5.2.3 在未确认状态下 refresh 页面，确认 binding 中颜色未改变

- [ ] 5.3 防止 [重置] 只恢复 groups 而遗漏 virtual station drafts
  - [ ] 5.3.1 修改 groups 和 virtual station drafts 后点击重置
  - [ ] 5.3.2 确认 `virtualStationDrafts` 与 `autoGroupResult` 同时恢复到 baseline

- [ ] 5.4 防止 `normalizeState()` 丢弃新增 SaveBindingPlan 字段
  - [ ] 5.4.1 在 binding 中设置 `appliedAutoGroupArchiveTime`、`bridgeSearchJumpRange`、`prefJumpRange`、`prefThreshold`
  - [ ] 5.4.2 通过 localStorage 保存并触发 store 重载
  - [ ] 5.4.3 确认重载后这些字段值保持不变（未被 `normalizeState()` 丢弃）

- [ ] 5.5 防止 trade station 未解决时进入 uncertain assignment 二次确认
  - [ ] 5.5.1 保留 trade station 未解决状态
  - [ ] 5.5.2 点击确认，确认被拦截且不出现 uncertain assignment 二次确认 popup
  - [ ] 5.5.3 确认拦截时只显示 trade station 未解决的提示/状态
