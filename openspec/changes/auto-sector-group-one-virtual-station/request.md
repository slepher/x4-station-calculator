# auto-sector-group-one-virtual-station Request

## 目标

在 Map binding 的自动星区分组面板中新增仅地图界面可见的 Virtual Station tab，用于替代原 Step 3 中“虚拟生产空间站”的创建、移动、删除和 blueprint 来源选择能力。该 change 只处理无 `saveStationCode` 的 `BindingStationPlan` 草案，不处理 save station 绑定、save station 导入、trade station 绑定或 station plan 详细编辑。

本 change 需要把虚拟生产空间站从“Step 3 页面直接修改 binding”改为“绑定界面打开后即可通过 store draft 编辑，提交时统一应用”。同时保留 virtual trade station 的地图拖动能力，但 virtual trade station 仍属于 `BindingSectorGroup.tradeStation`，不进入 Virtual Station tab。

## 已确认方案（审核重点）

### Virtual Station tab

- Map 的 `AutoSectorGroupPanel layout="tabs"` 新增 `virtualStation` tab。
- 该 tab 仅在地图界面显示，Live 三列界面不显示。
- Virtual Station tab 不受 Hub edit/result、Allocation、Trade Station tab 状态限制；Map binding 界面打开后即可编辑虚拟生产空间站。
- 该 tab 分两段显示：
  - Blueprint 空间站列表。
  - 虚拟空间站列表。
- Blueprint 空间站列表复用 Step 3 对应列表的视觉风格与拖拽体验。
- Blueprint 空间站列表额外提供一个“空白空间站”，表示没有任何 module 的虚拟生产站模板。
- Virtual Station tab 顶部提供 blueprint empire 选择，复用现有 binding 的 `blueprintEmpireId`；已创建的虚拟空间站是一次性复制结果，不随 blueprint empire 后续切换同步变化。

### 虚拟生产空间站数据

- 这里的 virtual station 指无 `saveStationCode` 的 `BindingStationPlan`，参与普通生产计算。
- 初始化时从现有 binding 中读取无 `saveStationCode` 的 station plans，作为 store draft 起点。
- 初始化不由“进入页面”或“打开 tab”触发，而是在生成 `autoGroupResult.groups` 时同步完成。
- 再次点击 [计算] / [快速计算] 重新生成 groups 时，必须保留当前 store draft 中的虚拟空间站内容，并按最新 groups 实时重算归属。
- 数据必须存于 store，不放在组件本地状态。
- 虚拟空间站可以拖拽跨 sector；拖拽落点必须属于某个当前 draft group 的 anchor/coverage。
- 若落点 sector 不属于任何 group，系统 SHALL 拒绝落点并保持原位置。
- active coverage 互斥是系统 invariant；若代码意外发现目标 sector 命中多个 group，系统 SHALL 拒绝落点，不做 UI 选择。
- 虚拟空间站 `groupId` 由其 `sectorMacro` 在当前 draft groups 中的归属实时派生/更新。
- 未提交 draft group 下允许创建虚拟空间站；提交时先应用 groups，再应用虚拟空间站 drafts。

### 虚拟空间站列表

- 虚拟空间站列表按 sector group 分组显示。
- 分组顺序使用当前 `autoGroupResult.groups` 顺序。
- 每个 item 显示：
  - 固定文案“虚拟空间站”。
  - 所属 sector 显示名。
  - 坐标。
  - `×` 删除按钮。
- item 不显示所属 sector group 名，因为 group 标题已经表达归属。
- 每组内按 sector 显示名，再按创建顺序排序。
- 删除按钮只移除 store draft 中的虚拟空间站；若该虚拟空间站来自现有 binding，实际 binding 删除发生在提交应用阶段。
- 已放置虚拟空间站可以从列表或地图 overlay 再次拖动，拖动时必须带自己的 draft id，只更新该 draft 的 `sectorMacro`、`position` 和归属 group，不得沿用 Step 3 可能新建重复 plan 的缺陷。

### 未分组虚拟空间站

- 当 group/coverage 编辑导致某个虚拟空间站不再属于任何 group 时，不立即删除。
- 这些虚拟空间站显示在“未分组/提交时移除”区域。
- 该区域下方必须显示说明：这些虚拟空间站当前不属于任何 sector group，提交时会被移除。
- 如果后续用户把虚拟空间站拖到有效 group sector，或重新编辑 coverage/group 使其 sector 被 group 覆盖，它必须恢复到对应 group 列表。
- 提交时仍未分组的虚拟空间站 SHALL 被移除，不写回 binding。

### Blueprint 导入复制范围

- 从 blueprintProduction 的 station 拖拽创建 virtual station 时，必须复制：
  - `name`
  - `type`
  - `modules`
  - `settings`
  - `lockedWares`
  - `warePriority`
- 不复制 blueprint station 的 `id`、`sectorId` 或任何持续同步引用。
- `groupId`、`sectorMacro`、`position` 由地图落点决定。
- 现有 Step 3 未复制 `lockedWares` / `warePriority` 属于历史缺陷，新实现不得沿用。
- 空白空间站默认：
  - `name` 使用本地化“虚拟空间站”。
  - `type='industrial'`。
  - `modules=[]`。
  - `settings=DEFAULT_STATION_SETTINGS`。
  - `lockedWares=[]`。
  - `warePriority={}`。
  - `saveStationCode=undefined`。

### 提交与应用

- Virtual station drafts 与 auto group 使用同一次提交/应用流程。
- 提交流程 SHALL 先应用 auto groups，再应用 virtual station drafts。
- 只同步无 `saveStationCode` 的 virtual station plans。
- 应用时按当前 draft 结果更新 binding 中的 virtual station plans：
  - draft 中存在且 binding 中不存在：创建。
  - draft 中存在且 binding 中存在：更新。
  - binding 中存在但 draft 中不存在：删除。
  - 仍未分组的 drafts：删除/不写回。
- 有 `saveStationCode` 的 save station plans 不属于本 change，不得被 Virtual Station tab 应用逻辑修改。

### Virtual trade station 地图拖动

- Virtual trade station 功能不再关联 virtual station。
- Virtual trade station 仍需在 Map binding 界面打开后即可通过地图拖动。
- 该拖动能力不要求 Trade Station tab 激活。
- 当 Trade Station tab 中某个 group 的选项切换到 virtual station / virtual trade station 时，UI 需要显示坐标。
- Virtual trade station 拖动只更新对应 group draft 的 trade station position。
- `TradeStationBinding.sectorMacro` 不可被拖拽修改，必须始终等于所属 group 的 hub `sectorMacro`。
- Virtual trade station 的拖拽落点必须在 hub sector 内；落到其他 sector 时拒绝并保持原位置。
- Virtual Station overlay 与 Virtual TradeStation overlay 不做额外视觉设计，沿用现状的图标、颜色和样式。

### 不再迁入的 Step 3 能力

以下 Step 3 能力不迁入 Virtual Station tab：

- save station 列表。
- save station 绑定 blueprint station。
- save station 导入模块规划。
- save station 解绑后转 virtual station。
- trade station / 中转站绑定。
- station plan 详细模块/settings 编辑。
- locked wares / ware priority 编辑界面。

## 边界

### In Scope

- Map-only Virtual Station tab。
- Blueprint empire 选择与 blueprint station / blank station 拖拽创建 virtual station draft。
- Store 层 virtual station draft 初始化、保留、归属重算、删除和应用。
- 当前 draft groups 变化时虚拟空间站列表与地图 overlay 实时反映。
- 未分组虚拟空间站展示与提交移除规则。
- Virtual trade station 地图拖动改为 draft position 更新，并保持 `sectorMacro` 固定为 hub sector。
- 与 auto group 提交流程的顺序衔接。

### Out of Scope

- save station 绑定、导入和解绑。
- Trade station 候选/默认算法本身。
- Station plan 详细模块、settings、lockedWares、warePriority 编辑 UI。
- Overlay 新视觉设计。
- Live 三列界面的 Virtual Station tab。
- 生产计算逻辑本身。

## 验收标准（DoD）

- Map 自动分组面板出现仅地图可见的 Virtual Station tab，Live 不显示。
- 生成 auto group result 时从现有 binding 初始化 virtual station draft；重新计算时保留当前 draft 内容。
- Blueprint station 拖拽创建 virtual station draft，并复制 `name/type/modules/settings/lockedWares/warePriority`。
- 空白空间站拖拽创建无 module 的 virtual station draft。
- 虚拟空间站可以在 Map binding 界面任意状态下拖拽创建/移动，不依赖 Virtual Station tab 激活。
- 虚拟空间站落到无 group 覆盖 sector 时被拒绝。
- group/coverage 编辑实时重算虚拟空间站归属；未分组项显示说明并在提交时移除。
- 提交先应用 groups，再应用 virtual station drafts；有 `saveStationCode` 的 station plans 不被本流程修改。
- virtual trade station 可以在 Map binding 界面打开后拖动；拖动只改 draft position，不改 `sectorMacro`，并限制在 hub sector。
- 不新增 overlay 视觉设计。

## 未决项

无。
