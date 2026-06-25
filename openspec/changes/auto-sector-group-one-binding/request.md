# auto-sector-group-one-binding Request

## 目标

定义 auto-sector-group 在 binding 语境中的共享 draft 生命周期、重算策略和 Live Production 双模式。该 change 负责把核心分组结果作为当前 active binding/archive 的唯一草案暴露给 Live 和 Map，但不负责核心算法细节、地图侧栏 UI 或颜色渲染。

Trade station 在 Live 计算模式中作为第三列展示和 confirm gate 的一部分，因此 binding change 需要定义它与共享 draft、Live 双模式、提交后的交互关系；候选和持久化规则由 core change 承担。

## 已确认方案（审核重点）

- `useLiveProductionStore` 持有当前 active binding/archive 的唯一共享 draft。
- 系统 SHALL NOT 为多个 binding 同时维护并行 draft cache。
- `autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`、`calcBaselinePillState` 归属于 live store。
- Virtual station drafts 归属于同一份 live store shared draft，用于保存 Map-only 虚拟生产空间站草案。
- `needsAutoGroupRecalc` 只由 `SaveBindingPlan.appliedAutoGroupArchiveTime` 与当前 selected archive time 判断。
- `initAutoGroupDraft()` 是共享 draft 初始化入口。
- 有变化时执行 `groupCleanSlate()` 或 `groupIncremental()`。
- 无变化时调用 `buildAssignmentsFromBinding()`，从已保存 groups 构建 assignments，不重新决定 group 结构。
- active binding 或 selected archive 切换时重新初始化唯一 draft。
- Live/Map 面板挂载、面板切换、详情模式切换不得触发自动计算。
- 生成 `autoGroupResult.groups` 时同步初始化 virtual station draft；初始化来源是当前 binding 中无 `saveStationCode` 的 `BindingStationPlan`。
- 同一 active binding/archive context 内，组件挂载、切换 Virtual Station tab、Live/Map 来回切换不得覆盖 virtual station draft。
- [计算] / [快速计算] 重新生成 groups 时，必须保留当前 virtual station draft 内容，并按最新 groups 重算归属；仍无归属的 draft 保留为未分组状态。
- 用户在计算模式内显式点击“计算”时，可以由 presenter 编排输入并更新共享 draft。
- `useAutoSectorGroupPresenter` 是 UI 连接与交互编排层，必须以 live store 的 `autoGroupResult` 作为唯一共享 draft 数据源。
- `handleColorChange` 不得直接调用 `saveBindingStore.updateGroup()` 写持久化 binding；颜色写入由确认流程处理。
- `handleConfirm()` 成功后记录 `appliedAutoGroupArchiveTime`。
- `handleConfirm()` 成功流程 SHALL 先应用 auto groups，再应用 virtual station drafts；virtual station apply 只同步无 `saveStationCode` 的 station plans。
- Live 展示模式为 `[存档 3fr] | [星区 4fr] | [资源 5fr]`。
- Live 计算模式为 `[星区 5fr] | [分配 4fr] | [交易站 3fr]`。
- 详情按钮只切换到计算模式，不运行算法。
- 确认成功后确认按钮置灰，不跳转到展示模式。

### Snapshot 与基线口径

- `calculationBaseline` 是“重置快照”，用于 [重置] 恢复到最近一次初始化或显式 [计算] 形成的计算结果。
- `calculationBaseline` SHALL 在 `setAutoGroupResult(result)` 时更新；显式 [计算] 会通过该路径刷新 baseline。
- `calculationBaseline` SHALL 覆盖 autoGroupResult 与 virtual station drafts，确保 [重置] 不产生 group 与 virtual station draft 的半旧半新状态。
- 确认成功后，系统 SHOULD 将 `calculationBaseline` 更新为确认后的 draft，避免之后 [重置] 回到确认前状态。
- `calcBaselinePillState` 是“UI diff 基线”，用于 coverage/connected pill 的粗边框、虚线 removed 等基线展示。
- `calcBaselinePillState` SHALL 在 active binding/archive 初始化时写入；显式 [计算] 不应覆盖它。
- 确认成功后，`calcBaselinePillState` SHALL 更新为确认后的 groups。
- edit/result 仅为视图切换，不改变共享 draft 数据。

### Live 展示模式按钮

- [详情]：进入计算模式，设置 `liveMode='calculate'`；不得运行分组算法。
- [详情红点]：当 `needsAutoGroupRecalc=true` 时显示，提示当前 archive 相对已应用时间有变化。
- [详情禁用]：当 `autoGroupResult` 为空时禁用。
- [地图]：跳转到当前 active binding 的 Map binding 面板；不得修改 draft。

### Live sidebar 详情入口

- Live 页面 sidebar SHALL 在固定菜单和星区/站点列表之间的分隔线区域提供星区编辑详情入口。
- 该入口 SHALL 作为持久化 workbench 菜单选择，而不是仅作为临时按钮状态。
- 点击该入口 SHALL 将 `activeBindingWorkbench` 设置为星区编辑详情专用值，并通过现有 active view storage 持久化当前菜单选择。
- 该入口与展示模式 [详情] 使用同一计算语义：进入详情/计算视图时不得运行分组算法，不得调用 `initAutoGroupDraft()`。
- 当 `autoGroupResult=null` 时，该入口 SHALL 置灰禁用。
- 当 `needsAutoGroupRecalc=true` 时，该入口 SHALL 显示红点提示。
- 入口图标 SHALL 使用与蓝图配方、研究入口一致的单色 SVG 风格，优先表达“星区节点/连接 + 编辑”语义。
- 该入口只属于 Live/save-binding sidebar，不影响 Map binding 面板和 empire production sidebar。
- Station/sector 选择变化不得把该 workbench 选择自动覆盖为 `station` 或 `overview`；只有用户显式选择其他 sidebar 菜单或返回展示模式时才切换。

### 计算模式顶部栏按钮

- [返回]：从计算模式回到展示模式；不提交、不计算、不重置 draft。
- [地图]：跳转到 Map binding 面板；Map 读取同一 shared draft。
- [计算]：使用当前编辑输入运行核心算法，更新 `autoGroupResult` 和 `calculationBaseline`，结束后进入 result 模式，并切到首个未解决 tab。
- [快速计算]：与 [计算] 一样运行 `runCalculationFromEditInput()`，用于 result/toolbar 场景的快速重算入口。
- [重置]：从 `calculationBaseline` 克隆恢复整份 `autoGroupResult`，包括 group、assignment、bridge decision、trade station、hub color 和 retain 字段；不切换 active binding/archive，不运行算法。
- [重置] 同时恢复 virtual station drafts 到 `calculationBaseline` 中记录的状态。
- [提交]：调用 `handleConfirm()`；当 trade station 未解决、无 result、或需要二次确认时不提交。
- [提交二次确认]：当仍有 uncertain assignment 但无 trade station 未解决时，第一次点击打开 popup；popup 中再次确认才允许提交。

### Hub 列控制按钮

- [编辑]：设置 `calculationMode='edit'`；不复制 edit snapshot。
- [退出]：设置 `calculationMode='result'`；不恢复 draft。
- [添加枢纽]：切换 hub add menu；Live 使用 overlay，Map 使用侧栏/弹出式入口。
- [桥接保留]：主开关同步所有 group 的 `connectionRetainEnabled`。
- [覆盖保留]：主开关同步所有 group 的 `coverageRetainEnabled`。
- [交易站保留]：主开关同步所有 group 的 `tradeStationRetainEnabled`。
- [节点]：控制下一次计算是否允许生成新的 pure hub；clean slate 且无 baseline/pinned input 时不可关闭。
- [桥接跳数]：更新 `bridgeSearchJumpRange`，且不得小于覆盖跳数。
- [覆盖跳数]：更新 `prefJumpRange`；若桥接跳数低于覆盖跳数，需要同步抬高桥接跳数。
- [Hub 阈值]：更新 `prefThreshold`，影响下一次显式 [计算]。

### Tab 与自动切换

- 计算模式包含 `hub`、`allocation`、`tradeStation` 三个 tab/view。
- 初始 auto result 出现后，只执行一次自动 tab 选择。
- 显式 [计算] / [快速计算] 后，若存在 pending bridge 或 uncertain assignment，切到 `allocation`。
- 否则若存在 unresolved trade station，切到 `tradeStation`。
- 否则切回 `hub`。
- Hub 编辑态下，Map 侧 Allocation / Trade Station tab disabled；Live columns 布局三列同时展示，但分配/交易站操作必须受 edit gate 约束。

## 边界

### In Scope

- `useLiveProductionStore` 共享 draft 状态和初始化。
- `SaveBindingPlan.appliedAutoGroupArchiveTime`、range 参数的持久化要求。
- `buildAssignmentsFromBinding()` 的无变化路径。
- Presenter 与 shared draft 的职责边界。
- Live 展示/计算双模式。
- Live sidebar 星区编辑详情入口及其持久化菜单选择、禁用、红点和图标语义。
- Live 中 assignment/trade station confirm gate 的展示关系。

### Out of Scope

- 核心 hub grouping、MST、bridge、assignment option 算法细节。
- Trade station 候选、默认值和持久化细节。
- Map 侧栏、focus-sector、drag sort。
- Hub color 分配和地图染色。

## 验收标准（DoD）

- Live 和 Map 读写同一份当前 active binding/archive draft。
- 切换 active binding/archive 后不残留旧 draft。
- 无变化路径不重新分组，只从 binding 构建 assignments。
- 展示模式和详情模式切换不触发计算。
- 每个按钮的状态变化、提交 gate 和 tab 自动切换符合上文定义。
- `calculationBaseline` 与 `calcBaselinePillState` 的更新时间点明确，且互不替代。
- 确认成功记录 applied archive time，确认按钮置灰。
- `normalizeState()` 保留新增 SaveBindingPlan 字段。
- Virtual station draft 与 shared draft 生命周期一致，计算保留、重置恢复、提交应用的边界明确。
- 提交时仅同步无 `saveStationCode` 的 virtual station plans，带 `saveStationCode` 的 save station plans 不被修改。

## 未决项

无。
