# auto-sector-group-one-binding Request

## 目标

定义 auto-sector-group 在 binding 语境中的共享 draft 生命周期、重算策略和 Live Production 双模式。该 change 负责把核心分组结果作为当前 active binding/archive 的唯一草案暴露给 Live 和 Map，但不负责核心算法细节、地图侧栏 UI 或颜色渲染。

Trade station 在 Live 计算模式中作为第三列展示和 confirm gate 的一部分，因此 binding change 需要定义它与共享 draft、Live 双模式、提交后的交互关系；候选和持久化规则由 core change 承担。

## 已确认方案（审核重点）

- `useLiveProductionStore` 持有当前 active binding/archive 的唯一共享 draft。
- 系统 SHALL NOT 为多个 binding 同时维护并行 draft cache。
- `autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`、`calcBaselinePillState` 归属于 live store。
- `calculationBaseline` 归属于 live store，作为跨 Live/Map/presenter 生命周期共享的重置快照。
- `SaveBindingPlan.groups` 的持久化身份 SHALL 使用定位星区 `sectorMacro`；group 不再保存独立 `id` 字段。
- save binding state 版本 SHALL 升至 2；从旧版本加载时，旧 group `id` 引用 SHALL 迁移为对应 group 的 `sectorMacro`。
- `connectedGroupIds` 与 `stationPlans.groupId` 在迁移后 SHALL 存储 hub `sectorMacro`，不再存储随机 group id。
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
- `calculationBaseline` SHALL 在 live store `setAutoGroupResult(result)` 时更新；显式 [计算] 会通过该路径刷新 baseline。
- `calculationBaseline` SHALL 覆盖 autoGroupResult 与 virtual station drafts，确保 [重置] 不产生 group 与 virtual station draft 的半旧半新状态。
- 确认成功后，系统 SHOULD 将 `calculationBaseline` 更新为确认后的 draft，避免之后 [重置] 回到确认前状态。
- 单纯 pin / unpin SHALL NOT 更新 `calculationBaseline`；它们只改变当前 shared draft 的展示/输入状态。
- [重置] SHALL 恢复到最近 `calculationBaseline`，不得恢复到用户 pin / unpin 后的临时状态，除非该状态已经通过初始化、显式计算或确认成功成为新的 baseline。
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
- [提交二次确认] popup SHALL 使用当前应用的确认弹窗视觉规格：有遮罩、边框面板、主次按钮样式和明确 hover/disabled 状态；不得出现无修饰纯文本按钮。
- popup [取消] 只关闭 popup，不修改 draft、binding、baseline 或当前 tab。
- popup [确定] 执行与直接提交相同的 `doConfirm()` 成功路径。

### 确认后的已保存态

- 系统 SHALL 明确区分“仍有 uncertain assignment / 未分配提示”和“当前 draft 有未保存改动”。
- uncertain assignment 只触发二次确认 gate 和未分配提示；确认成功后即使这些提示仍可见，也 SHALL NOT 让 `hasChanges` 保持为 true。
- 单纯 pin / unpin 不产生可持久化差异时，`hasChanges` SHALL 保持 false，顶部 [确定] SHALL 保持置灰/禁用。
- unpin 后若用户进一步在 assignment 中选择 absorb 或显式选择“独立成组”，并导致 group、coverage、connection、trade station 或 virtual station draft 的持久化结构变化，`hasChanges` SHALL 反映该真实差异。
- 确认成功后，若当前 shared draft 与保存后的 binding 在 group 顺序、coverage、connections、颜色、jump range、trade station 选择和 virtual station draft 上一致，则 `hasChanges` SHALL 为 false。
- `hasChanges=false` 时，顶部 [确定] 按钮 SHALL 置灰/禁用；该状态不得被仍存在的 uncertain assignment 覆盖。
- 确认成功后，当前 result groups SHALL 转为保存后的 baseline UI 状态：清理 `isNew`、新增 hub 高亮、跨覆盖临时提示等 transient 标记；保留用户确认后的 group 顺序、颜色、coverage、connections、trade station 选择。
- 确认成功后，`calcBaselinePillState` SHALL 更新为确认后的 groups，使 coverage/connected pill 不再显示相对确认前的差异高亮。
- 确认成功后仍停留在星区编辑页面，不跳转到 Live 展示模式。

### Pin / Unpin 口径

- `autoGroupResult.groups` SHALL 保留用户当前看到的 hub/group card；点击 unpin 不得让该 card 从 hub 列表消失。
- pin / unpin 按钮 SHALL 只出现在 hub/group card 上；assignment card SHALL NOT 显示 pin / unpin 按钮。
- result/edit 模式的 hub/group card 均 SHALL 显示 pin / unpin 按钮；result 模式不得隐藏该按钮。
- unpin hub SHALL 只将该 group 的 `isPinned` 置为 `false`；pin SHALL 只将该 group 的 `isPinned` 置为 `true`。
- unpin SHALL 让该 hub 的定位星区出现在 assignment 列表中，默认选中“独立成组” option；pin SHALL 从 assignment 列表移除该 hub 的定位星区。
- unpin 生成的 assignment options SHALL 复用标准 assignment 展示规则：当前范围内命中的 absorb 候选全部显示；无当前范围命中时只显示最小扩展候选；超过最大不确定扩展跳数的 absorb 候选 SHALL NOT 显示。
- pin / unpin SHALL NOT 修改 group 顺序、coverage、connections、trade station、virtual station draft 或其他 assignment 选择。
- `isPinned=false` 的 group 可以存在于当前 shared draft / hub card 列表中，用于展示和继续切回 pin。
- `isPinned=false` 的 group SHALL NOT 作为下一次显式 [计算] 的 pinned base input；这才是“不包含 unpinned 数据”的范围。
- result/edit 模式均可触发 card 上的 pin / unpin；二者都直接修改 shared draft，但不直接写持久化 binding。
- assignment 中用户显式选择“独立成组”仍 SHALL 使用既有 standalone 行为，包括按 `prefJumpRange` 计算 coverage、排除已占用 sector、追加 derived absorb candidates 并允许邻近 sector 被更优候选吸收。
- assignment 中用户选择 absorb 到其他 group SHALL 删除该 sector 自身 hub group（不论是否新建），清理其 trade station / connections，并将该 sector 加入目标 group coverage。
- 若历史数据或旧 bug 导致同一 `sectorMacro` 出现多个 hub group，absorb SHALL 以 `sectorMacro` 为依据清理全部重复 hub，避免残留重复身份。

### Hub 列控制按钮

- [编辑]：设置 `calculationMode='edit'`；不复制 edit snapshot。
- [退出]：设置 `calculationMode='result'`；不恢复 draft。
- [添加枢纽]：切换 hub add menu；Live 使用 overlay，Map 使用侧栏/弹出式入口。
- [桥接保留]：主开关同步所有 group 的 `connectionRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
- [覆盖保留]：主开关同步所有 group 的 `coverageRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
- [交易站保留]：主开关同步所有 group 的 `tradeStationRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
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
- `normalizeState()` SHALL 将旧版 group id 引用迁移为 hub `sectorMacro`，并从持久化 group 对象中移除 `id` 字段。
- Virtual station draft 与 shared draft 生命周期一致，计算保留、重置恢复、提交应用的边界明确。
- 提交时仅同步无 `saveStationCode` 的 virtual station plans，带 `saveStationCode` 的 save station plans 不被修改。

## 未决项

无。
