# auto-sector-group-one-binding Request

## 目标

定义 auto-sector-group 在 binding 语境中的共享 draft 生命周期、重算策略、Live Production 双模式，以及 binding 面板的预览 / 编辑 / 生成三态交互。该 change 负责把核心分组结果作为当前 active binding/archive 的唯一草案暴露给 Live 和 Map，并定义生成参数入口、retain/pin/unpin 展示与提交语义；不负责核心算法细节、地图侧栏 UI 或颜色渲染。

Trade station 在 Live 计算模式中作为第三列展示和 confirm gate 的一部分，因此 binding change 需要定义它与共享 draft、Live 双模式、提交后的交互关系；候选和持久化规则由 core change 承担。

## 已确认方案（审核重点）

- `useLiveProductionStore` 持有当前 active binding/archive 的唯一共享 draft。
- 系统 SHALL NOT 为多个 binding 同时维护并行 draft cache。
- `autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`、`calcBaselinePillState` 归属于 live store。
- 系统不再维护“计算完成 baseline”作为 [重置] 数据源；[重置] SHALL 使用当前 active binding 的已保存 groups 与当前参数重新计算。
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
- Auto-sector-group binding 面板 SHALL 使用 `[预览 | 编辑 | 生成]` 作为外显主模式。
- `预览` 用于查看当前 shared draft/result；`编辑` 用于直接编辑当前 shared draft 结构；`生成` 用于编辑下一次生成方案所需参数并执行生成。
- 三态按钮 SHALL 替换原 hub stat bar 中的单独 `[编辑]` 按钮；页面顶部操作区不承载三态模式切换。
- `编辑` 模式 SHALL NOT 再显示单独 `[退出]` 按钮；离开编辑由三态按钮切换到 `预览` 或 `生成` 完成。
- 原 `[计算]` / `[快速计算]` 外显入口 SHALL 取消，新的动作按钮 SHALL 命名为 `[生成方案]`，且只显示在 `生成` 模式的生成设置 card 内。
- 点击 `[生成方案]` 成功后 SHALL 自动切回 `预览` 模式，展示新生成的当前 draft/result；不会自动保存。
- 生成失败或被 gate 阻止时 SHALL 保持在 `生成` 模式。
- 生成 `autoGroupResult.groups` 时同步初始化 virtual station draft；初始化来源是当前 binding 中无 `saveStationCode` 的 `BindingStationPlan`。
- 同一 active binding/archive context 内，组件挂载、切换 Virtual Station tab、Live/Map 来回切换不得覆盖 virtual station draft。
- [生成方案] 或其他显式重算入口重新生成 groups 时，必须保留当前 virtual station draft 内容，并按最新 groups 重算归属；仍无归属的 draft 保留为未分组状态。
- 用户在计算模式内显式点击“计算”时，可以由 presenter 编排输入并更新共享 draft。
- `useAutoSectorGroupPresenter` 是 UI 连接与交互编排层，必须以 live store 的 `autoGroupResult` 作为唯一共享 draft 数据源。
- `handleColorChange` 不得直接调用 `saveBindingStore.updateGroup()` 写持久化 binding；颜色写入由确认流程处理。
- binding shared draft SHALL 保留 one-map 定义的 hub color 状态；独立成组、bridge 等交互式新增 hub 的颜色分配规则由 one-map 的 Hub color 章节定义，binding 只负责承载和确认写入 shared draft 中的 `color`。
- `handleConfirm()` 成功后记录 `appliedAutoGroupArchiveTime`。
- `handleConfirm()` 成功流程 SHALL 先应用 auto groups，再应用 virtual station drafts；virtual station apply 只同步无 `saveStationCode` 的 station plans。
- Live 展示模式为 `[存档 3fr] | [星区 4fr] | [资源 5fr]`。
- Live 计算模式为 `[星区 5fr] | [分配 4fr] | [交易站 3fr]`。
- 详情按钮只切换到计算模式，不运行算法。
- 确认成功后确认按钮置灰，不跳转到展示模式。

### Reset 与 saved binding 基线口径

- [重置] SHALL 丢弃当前 shared draft 中尚未确认的 group、assignment、bridge decision、trade station、hub color、retain 与 virtual station draft 变更。
- [重置] SHALL 从当前 active binding 的已保存 groups 构造计算输入，并按当前参数重新运行核心算法。
- 当前参数包括 `bridgeSearchJumpRange`（连接跳数）、`prefJumpRange`（覆盖跳数）、`nodeEnabled`（节点开关）与 `prefThreshold`（交易站/Hub 阈值）。
- binding 有已保存 groups 时，[重置] SHALL 使用这些 groups 作为 incremental base input；binding 无 groups 时 SHALL 使用 clean slate input。
- [重置] 不切换 active binding 或 selected archive，但会重建当前 active binding/archive 的唯一 shared draft。
- [重置] 后 virtual station drafts SHALL 重新从当前 binding 中无 `saveStationCode` 的 station plans 初始化，并按重算后的 groups 归属。
- [重置] 不再恢复或维护最近一次计算完成的 `calculationBaseline`。
- `calcBaselinePillState` 是“saved binding UI diff 基线”，用于 group 新增高亮、coverage/connected pill 的粗边框、虚线 removed 等基线展示；它 SHALL 只从已保存 `SaveBindingPlan.groups` 构造。
- `calcBaselinePillState` SHALL 使用 hub `sectorMacro` 作为 key；runtime group id 不得影响 saved baseline 对齐。
- 显式生成/重算、[重置]、pin / unpin SHALL NOT 用当前计算结果覆盖 `calcBaselinePillState`。
- 确认成功后，系统 SHALL 先写入 binding，再从保存后的 `SaveBindingPlan.groups` 刷新 `calcBaselinePillState`。
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

- 页面顶部操作区 SHALL 移除历史遗留 [返回] 按钮。
- 页面顶部操作区 SHALL 在 live columns 布局显示 [地图] 入口。
- 页面顶部操作区 SHALL 在 Map/tabs 布局隐藏 [地图] 入口，避免当前已处于地图模式时显示重复动作。
- [重置]：使用当前 active binding 的已保存 groups 与当前参数重新运行核心算法，替换整份 `autoGroupResult`；不切换 active binding/archive。
- [重置] 同时重建 virtual station drafts，并按重算结果归属。
- [重置] 完成后 SHALL 与 [生成方案] 使用同一 tab 自动切换规则；若重算结果存在 pending bridge plans，SHALL 切到 allocation/bridge 页面。
- [提交]：调用 `handleConfirm()`；当 trade station 未解决、无 result、或需要二次确认时不提交。
- [提交二次确认]：当仍有 uncertain assignment 但无 trade station 未解决时，第一次点击打开 popup；popup 中再次确认才允许提交。
- [提交二次确认] popup SHALL 使用当前应用的确认弹窗视觉规格：有遮罩、边框面板、主次按钮样式和明确 hover/disabled 状态；不得出现无修饰纯文本按钮。
- popup [取消] 只关闭 popup，不修改 draft、binding 或当前 tab。
- popup [确定] 执行与直接提交相同的 `doConfirm()` 成功路径。

### 三态模式与生成设置 card

- 面板 SHALL 使用 `[预览 | 编辑 | 生成]` 作为外显主模式。
- `预览` 模式 SHALL 展示当前 shared draft/result，不显示生成设置 card 或生成模式 retain checkbox。
- `编辑` 模式 SHALL 允许直接编辑当前 shared draft 结构，不显示生成设置 card 或生成模式 retain checkbox，也不显示单独 [退出] 按钮。
- `生成` 模式 SHALL 在 hub stat bar 下方显示生成设置 card。
- 生成设置 card 第一行 SHALL 显示全局生成参数：
  - 连接跳数 `bridgeSearchJumpRange`
  - 是否生成新节点 `nodeEnabled`
  - 覆盖跳数 `prefJumpRange`
  - 交易站阈值 `prefThreshold`
- 生成设置 card 第二行 SHALL 左侧显示三个 retain 聚合/批量 checkbox：保留连接、保留覆盖、保留交易站。
- 生成设置 card 第二行 SHALL 右侧显示“忽略当前节点”图标按钮和 `[生成方案]` 按钮。
- 三个 retain checkbox 只存在于 `生成` 模式；`预览` 与 `编辑` 模式不显示 retain checkbox。
- retain 聚合 SHALL 支持 checked / unchecked / mixed 三态显示。
- 生成设置 card 中的 retain checkbox 是所有 hub card retain 状态的聚合/批量入口；真实 retain 状态仍属于各 hub card。
- Live columns 和 Map hub tab 中的生成设置 card SHALL 保持相同信息结构；Map compact 布局中“忽略当前节点”图标按钮和 `[生成方案]` 按钮 SHALL 高度一致。
- [确定] 仍只保存当前 shared draft，不运行生成。
- [生成方案] 只生成新的当前 draft/result，不自动保存。

### 忽略当前节点 overlay

- `生成` 模式的生成设置 card SHALL 提供“忽略当前节点”图标按钮，并通过 tooltip 解释语义：`忽略当前节点：本次生成不使用当前 Hub 作为基础。`
- 该按钮 SHALL 只在 `生成` 模式显示和生效。
- 点击后进入 overlay 激活态；再次点击还原。
- overlay SHALL NOT 覆写任何 hub 自身的 pin/unpin 状态。
- overlay 激活时，`生成` 模式下所有 hub card 的 pin/unpin 显示 SHALL 被覆盖为 unpin。
- overlay 激活时，card 上的单个 pin/unpin 控件 SHALL 禁用。
- overlay 激活时，由于 hub 显示为 unpin，retain checkbox SHALL 按现有 unpin 禁用逻辑禁用。
- overlay 激活时，点击 `[生成方案]` SHALL 提交空 base input。
- overlay 未激活时，点击 `[生成方案]` SHALL 按当前 draft 的 hub pin/unpin 状态提交 base input。
- overlay SHALL 在进入 `生成` 模式时默认为关闭；切出 `生成` 模式或生成成功后清除；不得持久化。

### 生成模式中的 Hub card 与 retain

- card pin/unpin 并非只在 `生成` 模式显示；现有非生成模式 pin/unpin 展示仍可保留。
- `生成` 模式下 card pin/unpin SHALL 直接编辑当前 draft 的 hub pin 状态，除非“忽略当前节点”overlay 激活。
- card retain checkbox 只在 `生成` 模式显示。
- unpin 状态下 card retain checkbox SHALL 禁用。
- retain unchecked 时，对应 card 数据仍显示，但 SHALL 半透明展示，表示该类数据不会携带进本次生成输入：
  - 覆盖 retain unchecked：范围星区半透明。
  - 交易站 retain unchecked：空间站/交易站半透明。
  - 连接 retain unchecked：连接关系按双方状态判断后半透明。
- link/connection 的携带与半透明显示 SHALL 考虑双方 hub 状态：双方 retain 均允许携带时连接正常显示并可提交；双方 unchecked 时连接不携带并半透明；一方 unchecked 且另一方 unpin 时连接不携带并半透明。
- `生成` 模式下 hub card jumpRange 可编辑。
- jumpRange 修改 SHALL 实时改写当前 draft 中该 hub 的范围星区，保持数据一致。
- jumpRange 修改 SHALL NOT 默认吸收 assignment，也不得自动改变 assignment 选择；该约束与编辑模式一致。
- `生成` 模式下 pin/unpin、retain、jumpRange 等变更后，Assignment 与 Trade Station 列可以实时刷新，不必延迟到点击 `[生成方案]`。
- bridge 产生的 hub 默认 `unpin` 是通用默认值变更，不是 `[重置]` 的专属补丁。

### 确认后的已保存态

- 系统 SHALL 明确区分“仍有 uncertain assignment / 未分配提示”和“当前 draft 有未保存改动”。
- uncertain assignment 只触发二次确认 gate 和未分配提示；确认成功后即使这些提示仍可见，也 SHALL NOT 让 `hasChanges` 保持为 true。
- 用户调整 group 显示顺序后，若当前顺序与已保存 binding group 顺序不同，`hasChanges` SHALL 变为 true，顶部 [确定] SHALL 可用。
- Live 总览 display 界面的星区列表 SHALL NOT 显示拖拽把手。
- 单纯 pin / unpin 不产生可持久化差异时，`hasChanges` SHALL 保持 false，顶部 [确定] SHALL 保持置灰/禁用。
- unpin 后若用户进一步在 assignment 中选择 absorb 或显式选择“独立成组”，并导致 group、coverage、connection、trade station 或 virtual station draft 的持久化结构变化，`hasChanges` SHALL 反映该真实差异。
- 确认成功后，若当前 shared draft 与保存后的 binding 在 group 顺序、coverage、connections、颜色、jump range、trade station 选择和 virtual station draft 上一致，则 `hasChanges` SHALL 为 false。
- `hasChanges=false` 时，顶部 [确定] 按钮 SHALL 置灰/禁用；该状态不得被仍存在的 uncertain assignment 覆盖。
- 确认成功后，当前 result groups SHALL 转为保存后的 baseline UI 状态：清理 `isNew`、新增 hub 高亮、跨覆盖临时提示等 transient 标记；保留用户确认后的 group 顺序、颜色、coverage、connections、trade station 选择。
- 确认成功后，`calcBaselinePillState` SHALL 从保存后的 binding groups 刷新，使 group 新增高亮和 coverage/connected pill 不再显示相对确认前的差异高亮。
- 确认成功后仍停留在星区编辑页面，不跳转到 Live 展示模式。

### Pin / Unpin 口径

- `autoGroupResult.groups` SHALL 保留用户当前看到的 hub/group card；点击 unpin 不得让该 card 从 hub 列表消失。
- pin / unpin 按钮 SHALL 只出现在 hub/group card 上；assignment card SHALL NOT 显示 pin / unpin 按钮。
- 预览/编辑/生成模式的 hub/group card 均 SHALL 显示 pin / unpin 按钮；预览模式不得隐藏该按钮。
- unpin hub SHALL 只将该 group 的 `isPinned` 置为 `false`；pin SHALL 只将该 group 的 `isPinned` 置为 `true`。
- unpin SHALL 让该 hub 的定位星区出现在 assignment 列表中，默认选中“独立成组” option；pin SHALL 从 assignment 列表移除该 hub 的定位星区。
- unpin 生成的 assignment SHALL 在 assignment 列表最上方的专门位置展示；多次 unpin 时 SHALL 按用户 unpin 的先后顺序排列。
- unpin 生成的 assignment SHALL 设 `displayBucket='unpin'` 并携带 `unpinOrder`；`displayBucket` 扩展为三态 `'resolved' | 'unresolved' | 'unpin'`。
- `displayBucket` 在 assignment 创建时确定，用户选择 absorb 或 standalone option 后 SHALL NOT 改变。
- unpin assignment 被选择 absorb 后 SHALL 只更新 `selectedOptionIndex` 和 `status`，SHALL NOT 改变 `displayBucket` 或 `unpinOrder`，继续留在 unpin 顶部位置。
- unpin 生成的 assignment options SHALL 复用标准 assignment 展示规则：当前范围内命中的 absorb 候选全部显示；无当前范围命中时只显示最小扩展候选；超过最大不确定扩展跳数的 absorb 候选 SHALL NOT 显示。
- pin / unpin SHALL NOT 修改 group 顺序、coverage、connections、trade station、virtual station draft 或其他 assignment 选择。
- `isPinned=false` 的 group 可以存在于当前 shared draft / hub card 列表中，用于展示和继续切回 pin。
- `isPinned=false` 的 group SHALL NOT 作为下一次显式生成/重算的 pinned base input；这才是"不包含 unpinned 数据"的范围。
- 若某个此前 unpin 的定位星区在下一次显式生成/重算后重新成为 hub/group card，系统 SHALL 将其视为计算结果中的正常 hub，不得继续保留为 unpin 状态，也不得保留对应的 unpin assignment。
- 预览/编辑/生成模式均可触发 card 上的 pin / unpin；这些操作都直接修改 shared draft，但不直接写持久化 binding。
- assignment 中用户显式选择"独立成组"仍 SHALL 使用既有 standalone 行为，包括按 `prefJumpRange` 计算 coverage、排除已占用 sector、追加 derived absorb candidates 并允许邻近 sector 被更优候选吸收。
- `applyStandaloneToResult()` 追加 derived absorb candidates 时 SHALL 覆盖 range 内和扩展两种距离：距离 `≤ prefJumpRange` 追加 `extendsRange=false`；距离 `> prefJumpRange` 且 `≤ MAX_UNCERTAIN_JUMP` 追加 `extendsRange=true`，但目标 sector 已有 range 内命中时 SHALL NOT 追加扩展候选；距离 `> MAX_UNCERTAIN_JUMP` 不追加。
- 追加候选后 `selectedOptionIndex` 更新采用"新 hub 相对当前选中项是否更优"的比较：新 hub 在 range 内且比当前选中项更优时切换；不更优或产生平局时保持原选择；当前为显式 standalone 选择时只追加 option 不切换；新 hub 为扩展候选且无 range 内命中时 `selectedOptionIndex=null`、`status` 保持 `uncertain_extend`；不强制切换到全局 best。
- assignment 中用户选择 absorb 到其他 group SHALL 删除该 sector 自身 hub group（不论是否新建），清理其 trade station / connections，并将该 sector 加入目标 group coverage。
- 若历史数据或旧 bug 导致同一 `sectorMacro` 出现多个 hub group，absorb SHALL 以 `sectorMacro` 为依据清理全部重复 hub，避免残留重复身份。
- 系统在载入存档生成 `AutoGroupResult` 时 SHALL 为每个 player sector 预计算 station 原始候选池 `sectorStationCandidates`，按 score 排序；`score` SHALL 统一使用 `containerCap / (1 + ln(1 + prodLines))`，不得按 `qualified` 分支切换公式；原始候选池不得按 `qualified` / `requireQualified` 过滤，也不得做 top 5 截断。
- 原始候选池 SHALL 携带存档已生成的玩家空间站图标语义字段（`tag`、`factoryGroup`、`isHeadquarter`、`iconTag`），候选池计算阶段 SHALL NOT 重新按模块或 construction 推导空间站类型。
- 原始候选池 SHALL 应用零货舱规则：存在任意 `containerCap > 0` 的空间站时剔除 `containerCap = 0`；全部空间站均为 `containerCap = 0` 时保留这些空间站。
- Vue Trade Station 栏从预计算数据按当前 hub group 的 `sectorMacro` 过滤，并由 presenter 按当前 `containerThreshold` 与 top 5 原则生成展示候选；若展示候选池中存在 pure qualified 候选（`isPureHub=true`），top 5 SHALL 尽量保留最多 2 个 pure qualified 候选；提交时也只提交当前 hub group 的选择。
- Vue Trade Station 栏 SHALL 使用与 save station sidebar 一致的图标映射和绿色染色显示候选图标，以图标替代旧 radio 圆点；选中图标 SHALL 使用绿色光晕；普通模式图标为 24px，地图紧凑模式为 20px，不显示额外圆形背景。
- Standalone option SHALL 复用与 Trade Station 栏一致的展示候选规则，取该 sector 展示候选中排序最靠前的候选，显示 station code 和 containerCap（格式与 Trade Station 栏一致）；不存在展示候选时只显示「独立成组」。

### Hub 列控制按钮

- [预览 / 编辑 / 生成]：三态切换面板外显模式；切出 `生成` 时清除“忽略当前节点”overlay；切出 `编辑` 不恢复 draft。
- [添加枢纽]：切换 hub add menu；Live 使用 overlay，Map 使用侧栏/弹出式入口。
- [桥接保留]：仅在生成设置 card 中显示；主开关同步所有 group 的 `connectionRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
- [覆盖保留]：仅在生成设置 card 中显示；主开关同步所有 group 的 `coverageRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
- [交易站保留]：仅在生成设置 card 中显示；主开关同步所有 group 的 `tradeStationRetainEnabled`；主开关由各 group 状态聚合得出，mixed 时新 hub 默认 off。
- [节点]：控制下一次计算是否允许生成新的 pure hub；clean slate 且无 baseline/pinned input 时不可关闭。
- [桥接跳数]：更新 `bridgeSearchJumpRange`，且不得小于覆盖跳数。
- [覆盖跳数]：更新 `prefJumpRange`；若桥接跳数低于覆盖跳数，需要同步抬高桥接跳数。覆盖跳数只影响下一次显式生成/重算，不触发 assignment 增量重算。
- [Hub 阈值]：更新 `prefThreshold`，影响下一次显式生成/重算。
- Group card jumpRange 修改存在于编辑/生成模式。它 SHALL 增量维护受影响 assignment 的 options / `extendsRange` / R2 候选不共存状态：距离该 hub 在 `(oldRange, newRange]`（增大）或 `(newRange, oldRange]`（减小）的 sector 重算 options，距离 `≤ min(oldRange, newRange)` 的 sector 不动。`selectedOptionIndex` 不因更优、更近或平局自动切换；仅当当前选中 option 因本次跳数变化失效时清除。

### Tab 与自动切换

- 计算模式包含 `hub`、`allocation`、`tradeStation` 三个 tab/view。
- 初始 auto result 出现后，只执行一次自动 tab 选择。
- 显式生成/重算后，若存在 pending bridge 或 uncertain assignment，切到 `allocation`。
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
- Auto-sector-group binding 面板 `[预览 | 编辑 | 生成]` 三态模式。
- 生成设置 card 的参数、retain 聚合、忽略当前节点、生成方案按钮行为。
- retain checkbox 的显示模式、聚合、局部 card 展示与半透明规则。
- 生成模式下 pin/unpin、jumpRange 对当前 draft 与实时刷新行为的定义。
- Live sidebar 星区编辑详情入口及其持久化菜单选择、禁用、红点和图标语义。
- Live 中 assignment/trade station confirm gate 的展示关系。

### Out of Scope

- 核心 hub grouping、MST、bridge、assignment option 算法细节。
- Trade station 候选、默认值和持久化细节。
- Map 侧栏、focus-sector、drag sort。
- Hub color 分配和地图染色。
- 新增测试代码或运行测试。

## 验收标准（DoD）

- Live 和 Map 读写同一份当前 active binding/archive draft。
- 切换 active binding/archive 后不残留旧 draft。
- 无变化路径不重新分组，只从 binding 构建 assignments。
- 展示模式和详情模式切换不触发计算。
- 面板清晰展示 `[预览 | 编辑 | 生成]` 三态，且三态切换符合上文定义。
- `生成` 模式显示生成设置 card；`预览` 与 `编辑` 模式不显示 retain checkbox。
- `[生成方案]` 只在生成设置 card 中出现，生成成功后切回 `预览` 且不自动保存。
- “忽略当前节点”仅在 `生成` 模式生效，不覆写 hub pin/unpin，激活时提交空 base input。
- retain unchecked 时对应 card 数据半透明；unpin 状态下 retain 禁用。
- `生成` 模式下 jumpRange 修改实时更新范围星区，但不默认吸收、不自动改变 assignment 选择。
- Assignment / Trade Station 列可随生成模式参数变更实时刷新。
- bridge 产生的 hub 默认 unpin。
- 每个按钮的状态变化、提交 gate 和 tab 自动切换符合上文定义。
- [重置] 基于 saved binding 与当前参数重算；`calcBaselinePillState` 仅作为 saved binding UI diff 基线。
- 确认成功记录 applied archive time，确认按钮置灰。
- `normalizeState()` 保留新增 SaveBindingPlan 字段。
- `normalizeState()` SHALL 将旧版 group id 引用迁移为 hub `sectorMacro`，并从持久化 group 对象中移除 `id` 字段。
- Virtual station draft 与 shared draft 生命周期一致，计算保留、重置重建、提交应用的边界明确。
- 提交时仅同步无 `saveStationCode` 的 virtual station plans，带 `saveStationCode` 的 save station plans 不被修改。

## Assignment 变更规则

以下为增量变更规则汇总（全量重建仅发生于显式生成/重算）：

- **追加候选（R1）**：独立成组后，新 hub 距离 `≤ prefJumpRange` 追加 range 内 option；`> prefJumpRange && ≤ MAX_UNCERTAIN_JUMP` 追加扩展 option；`> MAX_UNCERTAIN_JUMP` 不追加。
- **不共存（R2）**：range 内命中与扩展候选不共存于同一 sector。新增 range 内命中时移除扩展候选；已有 range 内命中时独立成组不追加扩展候选。
- **选择更新（R3）**：`selectedOptionIndex` 只在"新 hub range 内且更优"时切换；不更优/平局保持原选择；standalone 选择只加不切；仅扩展候选时 `selected=null` + `uncertain_extend`。
- **跳数变化（R4）**：预览模式没有直接增减 range 的 card 编辑；只有扩展 absorb 会导致 hub range 扩大，并按 R3 更新选择。**编辑/生成模式**（card 直接修改跳数）只维护 options / extendsRange / R2，不自动选新的，原选中失效才清除。
- **Unpin 排序（R5）**：`displayBucket='unpin'` + `unpinOrder` 维持顶部位置；absorb 不清除；standalone 改为 `'resolved'`；pin 移除。
- **编辑/生成直接操作（R6）**：编辑/生成模式下 options 可随 groups/coverage/hub/jumpRange 的结构变化维护；`selectedOptionIndex` 只允许在用户直接操作的 sector 或原选中 option 被删除/失效的 sector 上修改。不得因更优、更近、平局、range 内/扩展变化，对其他 sector 自动切换选择。

## 未决项

无。
