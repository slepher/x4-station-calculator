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
- Hub 视图展示 group 管理，并保持顶部共用 `AutoSectorBar`。
- Allocation 视图展示 assignment cards。
- Trade Station 视图展示 trade station cards。
- Hub 编辑态下 Allocation 和 Trade Station 视图 disabled。
- 确认完成后隐藏 draft tabs，显示进入 station binding 的 group 按钮。

### 地图联动

- Map 上下文点击 coverage/candidate/connected pill 时 emit `focus-sector`。
- Map 上下文点击 anchor 或 trade station pill 时 emit `focus-sector` 到该 group anchor sector。
- Map 上下文点击 assignment sector name 时 emit `focus-sector`。
- Live 上下文点击 pill 不 emit `focus-sector`。
- `MapWorkbenchView` 接收事件并居中地图。

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
- Hub / Allocation / Trade Station tab/view 行为。
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

## 验收标准（DoD）

- Map 和 Live 展示同一份 shared draft。
- `MapSavePanel` 的 `binding-sector` 层不再渲染 `MapBindingSectorGroup`。
- Map 视图切换不触发自动计算。
- Map pill/assignment 点击可以聚焦地图。
- Drag sort 不改变 group 领域数据，不触发计算。
- Hub color 在 Map 中稳定显示，binding 模式和非 binding 模式来源正确。
- 透明色不会作为颜色值持久化。

## 未决项

无。
