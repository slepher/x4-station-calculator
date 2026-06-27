# auto-sector-group-one-map Request

## 目标

定义 auto-sector-group 在 Map binding 中的呈现和地图联动，并把 hub color 纳入 map change。Color 的主要价值是地图可视化和 map overlay，因此不单独作为 change。

本 change 复用 `auto-sector-group-one-binding` 提供的共享 draft，不拥有自己的分组状态；核心分组与 trade station 领域规则由 `auto-sector-group-one-core` 承担。

## 已确认方案（审核重点）

### Map binding 面板

- Map binding-sector 阶段使用自动分组面板，而不是旧 `MapBindingSectorGroup`。
- `MapBindingSectorGroup.vue` 不再作为 Map production entry；若文件仍保留，只能作为未接入生产路径的遗留代码，不得被 `MapSavePanel` 的 `binding-sector` 层渲染。
- Map 面板读取 `liveStore.autoGroupResult`。
- Map 面板挂载、tab 切换、从其他 layer 返回时不得触发分组算法或 `initAutoGroupDraft()`。
- Map 支持 Hub / Allocation / Trade Station 视图。
- Map 支持仅地图可见的 Virtual Station tab；Live columns 不显示该 tab。
- Hub 视图展示 group 管理，并保持顶部共用 `AutoSectorBar`。
- Allocation 视图展示 assignment cards。
- Trade Station 视图展示 trade station cards。
- Virtual Station tab 展示 blueprint station 来源和当前 virtual station draft 列表。
- Virtual Station tab 不受 Hub edit/result、Allocation、Trade Station tab 状态限制；Map binding 界面打开后即可通过地图创建、移动或删除虚拟生产空间站 draft。
- 确认完成后隐藏 draft tabs，显示进入 station binding 的 group 按钮。

### Virtual Station tab

- Virtual Station tab 顶部提供 blueprint empire 选择，复用当前 binding 的 `blueprintEmpireId`。
- 已创建的 virtual station 是一次性复制结果，不随 blueprint empire 后续切换同步变化。
- Blueprint station 列表复用 Step 3 对应列表的视觉风格与拖拽体验。
- Blueprint station 列表额外提供“空白空间站”，表示没有任何 module 的 virtual station 模板。
- 从 blueprint station 拖拽创建 virtual station draft 时，必须复制 `name`、`type`、`modules`、`settings`、`lockedWares`、`warePriority`；不得复制 source station 的 `id`、`sectorId` 或持续同步引用。
- 空白空间站拖拽创建 `type='industrial'`、`modules=[]`、默认 settings、空 `lockedWares`、空 `warePriority` 的 draft。
- Virtual station 列表按当前 `autoGroupResult.groups` 顺序分组显示，每组内按 sector 显示名再按创建顺序排序。
- Item 显示 station 名称、所属 sector 显示名、坐标和 `×` 删除按钮；不显示 group 名，因为 group 标题已经表达归属。
- 未分组 virtual stations 显示在“未分组/提交时移除”区域，并显示提交时会被移除的说明。

### 地图联动

- Map 上下文点击 coverage/candidate/connected pill 时 emit `focus-sector`。
- Map 上下文点击 anchor 或 trade station pill 时 emit `focus-sector` 到该 group anchor sector。
- Map 上下文点击 assignment sector name 时 emit `focus-sector`。
- Live 上下文点击 pill 不 emit `focus-sector`。
- `MapWorkbenchView` 接收事件并居中地图。
- Blueprint station、空白空间站和已存在 virtual station 可拖拽到地图；落点必须命中唯一一个当前 draft group 的 anchor/coverage。
- 落点无 group 覆盖或异常命中多个 group 时，系统 SHALL 拒绝落点并保持原 draft 不变。
- 已存在 virtual station 再拖拽时必须携带 draft id，只更新该 draft 的 `sectorMacro`、`position` 和 `groupId`，不得创建重复 station plan。
- Virtual station overlay 从 store draft 渲染，Map binding 界面打开后即可拖动，不要求 Virtual Station tab 激活。
- Virtual trade station overlay 仍属于 group trade station draft；拖动只更新对应 group draft position，不修改 `sectorMacro`，且 drop 必须限制在 hub sector。
- Virtual station overlay 与 virtual trade station overlay 沿用现有图标、颜色和样式，不新增额外视觉区分。
- Map 当前显示目标使用单一状态表达：`default-map` 或具体 save archive，不再用 `selectedArchive=null` 隐式表示默认地图。
- 进入 Map 时如果用户尚未显式选择显示目标，且存在 active binding，则默认显示该 active binding 对应的 save archive；否则显示默认地图。
- 用户点击默认地图时，Map 显示目标 SHALL 明确变为 `default-map`；用户点击某个存档时，Map 显示目标 SHALL 变为该 archive。
- 星区组染色与 hub 连线只由 Map 当前显示目标与 active binding 的 `gameGuid` 是否一致决定，不由 save panel 当前 layer 决定。
- Save panel 关闭再打开 SHALL 回到关闭前 layer；只有显式跳转入口才覆盖 layer/stage。
- 地图背景填充按单个星区决策，优先级 SHALL 为：星区组染色 > 势力背景色 > 默认地图背景。
- 当星区组染色关闭且势力背景色打开时，星区 SHALL 显示势力背景色，不得因为存在 `sectorGroupColorMap` 而退回默认地图背景。
- 当星区组染色和势力背景色同时打开时，属于星区组且存在组色的星区 SHALL 只显示星区组染色；不属于星区组或没有组色的星区 MAY 显示势力背景色。

### UI 与排序

- Map 使用适配 360px 侧栏的 compact 样式。
- Pill 不得溢出侧栏宽度。
- Map compact card 必须收紧 group card padding、header 间距、label 字号、pill gap 和 jump row 间距。
- Map 和 Live 共用 `HubAddMenu`；Map 使用默认/侧栏入口并显示定位地图能力，Live 使用 `mode='overlay'` fixed overlay，二者都必须遵守 already-anchor 不可重复添加规则。
- Hub list 支持 drag sort。
- Drag sort 使用专用 drag handle 和虚线占位；非拖拽状态不得因为 hover/placeholder 改变 card 尺寸。
- Drag sort 只改变 groups 数组顺序，不触发重新计算。
- 确认写入时 groups 数组顺序是排序权威，`order` 只作为兼容字段。

### Hub color

- Hub color 是地图显示辅助，不是不可变用户决策。
- 自动分配应尽量保持已有有效颜色稳定。
- 与自身 anchor/coverage faction 色冲突，或与 5 跳内 hub 色冲突时，可以重分配。
- 5 跳外 hub 允许复用颜色。
- 用户色卡选择是 preset，不是永久锁定；后续 compute 可在冲突时调整。
- Transparent 表示清空颜色，不得持久化为 `0x00000000`。
- Binding 模式地图颜色来自共享 draft。
- 非 binding 模式地图颜色来自持久化 active binding。

## 边界

### In Scope

- Map binding-sector 面板复用。
- Hub / Allocation / Trade Station / Virtual Station tab/view 行为。
- Map-only Virtual Station tab、blueprint/blank 来源、virtual station 列表和未分组展示。
- Virtual station 与 virtual trade station 的 map overlay 拖拽交互。
- focus-sector / fit-sectors 事件转发。
- Map compact 样式和 drag sort。
- Hub color 自动分配、色卡、持久化和 map overlay。
- Map context 下 group card 的 compact 样式、focus-sector 事件和完成态进入 station binding 按钮。
- `MapBindingSectorGroup.vue` 从 Map production entry 移除。

### Out of Scope

- 核心分组、MST、bridge、assignment option 算法。
- Trade station 候选和持久化规则。
- Live 展示/计算双模式。
- Shared draft 初始化逻辑。
- Virtual station draft 生命周期与应用到 binding 的 store 规则。

## 验收标准（DoD）

- Map 和 Live 展示同一份 shared draft。
- `MapSavePanel` 的 `binding-sector` 层不再渲染 `MapBindingSectorGroup`。
- Map 视图切换不触发自动计算。
- Map 显示 Virtual Station tab，Live 不显示；Virtual Station tab 与 Hub/Allocation/Trade Station 共享同一 draft。
- Blueprint/blank station 拖拽可以创建 virtual station draft；已存在 virtual station 拖拽只更新自身 draft。
- Virtual station drop 只接受唯一 group 覆盖 sector；无覆盖或多命中时拒绝。
- 未分组 virtual stations 在列表中提示提交时移除。
- Map pill/assignment 点击可以聚焦地图。
- Virtual trade station overlay 拖动只改 draft position，不改 `sectorMacro`，且限制在 hub sector。
- Drag sort 不改变 group 领域数据，不触发计算。
- Hub color 在 Map 中稳定显示，binding 模式和非 binding 模式来源正确。
- 透明色不会作为颜色值持久化。
- 默认地图目标下不显示星区组染色和 hub 连线；显示具体 archive 且 archive guid 等于 active binding guid 时才显示。
- 关闭并重新打开 save panel 保持关闭前 layer/stage；点击明确入口时按入口指定界面跳转。
- 地图背景填充优先级为星区组染色 > 势力背景色 > 默认地图背景；关闭星区组染色但打开势力背景色时，星区显示势力背景色。

## 未决项

无。
