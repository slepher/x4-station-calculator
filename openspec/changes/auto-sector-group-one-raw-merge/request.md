# auto-sector-group-one Request

## 最终合并说明

本文件是 auto-sector-group 系列 request 的自包含合并版。完成本 change 后，旧目录 `auto-sector-group-merged`、`auto-sector-group-map`、`auto-sector-group-color`、`auto-sector-group-station`、`auto-sector-group-draft` 可以删除或归档；需求上下文不应再依赖旧目录。

合并优先级从旧到新为：

1. `auto-sector-group-merged`
2. `auto-sector-group-map`
3. `auto-sector-group-color`
4. `auto-sector-group-station`
5. `auto-sector-group-draft`

当下方来源内容互相冲突时，以最新共享草案口径为准：

- `useLiveProductionStore` 持有当前 active binding/archive 的唯一共享 draft。
- Live 和 Map 面板读写同一份 `autoGroupResult`。
- 切换 active binding 或 selected archive 时重新初始化唯一 draft。
- 面板挂载、面板切换、详情模式切换不得自行触发分组算法。
- presenter 是 UI 连接与交互编排层，不再维护第二份共享 draft。

## 最终目标

自动星区分组应在 Live Production 与 Map Binding 中形成同一套可确认的 binding workflow：从存档和 binding 初始化共享草案，生成 hub group、coverage、connection、assignment、hub color 和 trade station，允许用户在 Live/Map 中编辑并解决未决项，最后一次性写入 save binding。

## 当前统一 Request
## 背景

`auto-sector-group` 相关 OpenSpec 文档已经经历多轮拆分与合并：

- `auto-sector-group`、`auto-sector-group-link`、`auto-sector-group-enchanted` 已合并为 `auto-sector-group-merged`
- 后续又新增了 `auto-sector-group-map`
- 后续又新增了 `auto-sector-group-color`
- 后续又新增了 `auto-sector-group-station`
- 最新口径是 `auto-sector-group-draft`

这些文档之间存在重复、过时口径和职责归属冲突。`auto-sector-group-one` 的目标是把以上文档合并成唯一权威 change，后续实现、验证和归档都应以本 change 为准。

## 合并优先级

当旧文档之间存在矛盾时，按以下顺序决定最终口径，越靠后优先级越高：

1. `auto-sector-group-merged`
2. `auto-sector-group-map`
3. `auto-sector-group-color`
4. `auto-sector-group-station`
5. `auto-sector-group-draft`

其中 `auto-sector-group-draft` 是最新文档，最终确认以下架构口径：

- `useLiveProductionStore` 持有当前 active binding/archive 的唯一共享 draft。
- `live` 面板和 `map` 面板读写同一份 `autoGroupResult`。
- 切换 `activeBinding` 或 `selectedArchive` 时重新初始化这份唯一 draft。
- 面板挂载、面板切换、详情模式切换不得自行触发分组算法。
- presenter 可以承担 UI 连接与交互编排，但不得再维护第二份共享 draft。

## 目标

本 change 要定义自动星区分组在 Live Production 和 Map Binding 中的完整行为：

- 根据玩家空间站、货柜容量、生产线数量、星区距离和阈值识别 hub。
- 支持 clean slate 和 incremental 两种计算路径。
- 使用 MST 生成 group 连接，并在断裂时提供 bridge plan。
- 支持编辑态作为“下一次计算输入”，而不是直接修改最终持久化结果。
- 支持玩家星区归属选择、扩展吸收、standalone 以及 unresolved gate。
- 支持 hub 颜色自动分配、色卡编辑、持久化和地图染色。
- 支持每个 hub group 的 trade station 候选、默认值、用户选择、保留和持久化。
- 支持 Live 展示/计算双模式和 Map binding 侧栏复用同一套 draft。
- 在确认时一次性写入 groups、coverage、connections、colors、trade stations、range 参数和 applied archive time。

## 范围

### 范围内

- 自动分组核心算法的可观察行为。
- `useLiveProductionStore` 中共享 draft 的生命周期和重算条件。
- `useAutoSectorGroupPresenter` 作为 UI 连接与交互编排层的职责边界。
- Live Production 的展示模式、计算模式和确认后返回展示模式。
- Map binding 阶段复用自动分组面板、地图聚焦、拖拽排序和紧凑布局。
- hub color 的自动分配、冲突处理、用户色卡和地图覆盖层。
- trade station 的候选、默认、选择、重置、保留、确认 gate 和持久化。
- `SaveBindingPlan`、`BindingSectorGroup`、`GroupDraftInfo` 等持久化/草案字段。
- 针对当前实现进行合理拆分后的 spec 文件。

### 范围外

- 恢复旧的多 binding 并行 draft 缓存。
- 恢复 `recalcState`。
- 恢复 per-group `exclude`、`disabledCoverageSectorMacros`、`excludedDefaultConnectedGroupIds`。
- 恢复旧的“覆盖星区 / 候选星区 / 连接星区”三 tab pill UI。
- 新增 bridge marker 持久化字段。
- Terraforming、research、blueprint recipe 等非 auto-sector-group 能力。
- 借本次文档合并重构 unrelated UI 或 unrelated map binding 行为。

## 验收标准

1. `auto-sector-group-one` 成为 auto-sector-group 当前唯一权威 change。
2. 文档使用中文描述，并保留场景级需求，而不是只保留摘要。
3. spec 按能力拆分，避免一个超大 spec 混杂所有主题。
4. 旧文档中的有效行为被保留到对应 spec。
5. 与最新实现不一致或已废弃的旧口径被明确移除或改写。
6. 共享 draft、live/map 复用、颜色、trade station、confirm gate 等最终规则没有互相矛盾。
7. `openspec instructions apply --change auto-sector-group-one --json` 能识别并通过文档任务。

# 来源 Request 全文

## 来源：旧三文档合并基线：auto-sector-group-merged

承接 auto-sector-group、auto-sector-group-link、auto-sector-group-enchanted 的核心算法、编辑态、bridge、assignment、confirm 与早期测试规划。

# 自动星区划分合并版 (auto-sector-group-merged)

## 目标

在 Live Production overview 中提供自动星区划分能力：用户绑定或上传存档后，系统根据 hub 识别、星区距离、MST/bridge 连通图和用户编辑输入生成 sector group 草案。Col 2 负责展示和编辑下一次计算输入，Col 3 负责让用户确认每个玩家星区的最终吸收或独立成组方案，确认后一次性写入 `saveBindingStore`。

本合并版整合：
- `auto-sector-group`：自动分组、三列布局、Col 2/Col 3 草稿交互、确认写入。
- `auto-sector-group-link`：MST 最小连通图、bridge 方案、桥接搜索跳数。
- `auto-sector-group-enchanted`：最新编辑态规则，覆盖旧版 `recalcState/exclude`、三 tab、pinned coverage/link 暂停恢复等方案。

冲突处理优先级：`auto-sector-group-enchanted` > `auto-sector-group-link` > `auto-sector-group`。

## 最终行为

### 1. 入口与触发

| 场景 | 触发条件 | 行为 |
|---|---|---|
| SaveList 点击绑定 | guid 无绑定 | 创建 guid 级绑定，载入最新存档，自动分组，Col 2/3 展示草案 |
| SaveList 点击绑定 | guid 有绑定 | 载入存档，若存在未归组玩家星区则运行增量分配 |
| 上传新存档 | 当前无任何绑定 | 创建绑定，自动分组，Col 2/3 展示草案 |
| 上传新存档 | 当前有绑定，且新存档属于当前 guid 最新时间 | 绑定迁移到新存档，运行增量分析 |
| 上传新存档 | 当前有绑定，属于当前 guid 但非最新 | 不分析、不切换 |
| 上传新存档 | 当前有绑定，属于其他 guid 且该 guid 无绑定 | 创建绑定，不分析 |
| 上传新存档 | 当前有绑定，属于其他 guid 且该 guid 已有绑定 | 不做任何事 |

### 2. Live Production 三列布局

| 列 | 内容 |
|---|---|
| Col 1 | 上传存档、分组覆盖跳数、预制容量、存档列表 |
| Col 2 | `SectorConfirmBar` + `SectorGroupList`，展示 group 草案和下一次计算输入 |
| Col 3 | bridge 决策、assignment cards，或确认后的 `EmpireWareFlowsDashboard` |

Col 2 有计算结果态和编辑输入态：
- 计算结果态：参数只读展示，显示 [编辑]。
- 编辑输入态：允许编辑桥接/节点/阈值/覆盖、添加 hub、编辑 group pill，显示 [取消] [计算]。
- 编辑输入态保留 Col 3 当前内容但加遮罩并禁用操作；若 Col 3 是 assignment 视图，遮罩显示“编辑输入中，分配面板暂不可操作”；若是资源视图，不显示遮罩文案。

### 3. 自动分组基础规则

Hub 识别：
- 数据来源为已建成 `modules[]` 与在建 `constructions[]`。
- 只统计 container 容量，排除 solid/liquid。
- Tier 1：`container_cap >= threshold`，score = `cap / (1 + ln(1 + prod_lines))`。
- Tier 2：`container_cap < threshold`，score = `cap`。
- 纯 hub = Tier 1 且 `prod_lines == 0`。

星区距离：
- 同 cluster 内距离为 0。
- 跨 cluster 使用与 `saveBindingUtils.ts:buildSectorGraphFromMaps()` 一致的 cluster gate BFS。
- `sector_links.render.lane_count === 1` 的单向 superhighway 不建双向边。

Clean slate：
- Phase A：纯 hub 建组，玩家星区贪婪分配到覆盖跳数内最近纯 hub。
- Phase B：带产线 Tier 1 在覆盖跳数内自动吸收，超出覆盖跳数但 5 跳内进入存疑。
- Phase C：Tier 2 超出覆盖跳数但 5 跳内自动吸收，Tier 2 不独立成 hub。
- 等距且 score 差距小于 30% 的候选进入存疑。

Incremental：
- 已有 group 使用各自 jumpRange 吸收新玩家星区。
- 预制覆盖跳数只用于新建 group。
- 超出 group jumpRange 但 5 跳内进入需扩展跳数的选择。
- 超过 5 跳建议 standalone。

### 4. MST 与 Bridge

普通 group 的 `connectedGroupIds` 必须由 MST 连接图生成或由用户编辑输入保留：
- 对所有 group anchor 构造 pairwise distance。
- 使用 `distance <= bridgeSearchJumpRange` 的边运行 Kruskal MST。
- 选中边双向写入 `connectedGroupIds`。
- [计算] 时，用户保留的 `connectedGroupIds` 作为固定边，Kruskal 只添加新边，不删除固定边。

Bridge 方案：
- 当 MST 后仍有断裂分量时，生成可减少断裂分量数量的 bridge 方案。
- bridge unit 是同 cluster 内按有效双向 sector graph 划分出的玩家 sector component，不等同 raw cluster。
- 若 cluster 内部因单向 superhighway 或不可往返路径断裂，必须拆成不同 unit。
- 若有多个方案，Col 3 先显示 bridge 方案决策，隐藏普通 assignment cards。
- 若只有一个方案，自动采用；多方案只默认高亮推荐，不自动采用。
- 采用 bridge 后，每个 unit 创建普通 draft group，不新增持久化 bridge marker。

桥接搜索跳数：
- 默认 5，可选 2-5。
- 不得小于分组覆盖跳数；覆盖跳数调高时桥接搜索跳数同步抬高。
- 只影响 MST 和 bridge 搜索，不改变普通 assignment 的 5 跳存疑上限。

### 5. 最新编辑态规则

旧 `recalcState: normal/pin/exclude` 被 `isPinned: boolean` 替代：
- baseline group 进入编辑态时默认 `isPinned=true`。
- 新增 hub draft 和 bridge draft 默认 `isPinned=true`。
- 不再提供 per-group `exclude`。
- baseline group 不可真正删除；取消固定只变为 unpinned，并保留 link、coverage、jumpRange 展示数据。
- 新建 hub draft 可删除。

全局“节点” checkbox：
- 位于 SectorConfirmBar，顺序为 `桥接 | 节点 | 阈值 | 覆盖`。
- 默认启用。
- 关闭后算法不生成新的 pure hub，并禁用阈值与覆盖控件。
- clean slate 且没有可作为初始输入的 baseline/pinned group 时不可关闭。

添加 hub：
- 编辑态 [添加] 打开 `SectorHubAddMenu` fixed overlay。
- 无搜索时列出玩家星区；搜索时遍历全地图 sector，包含无玩家空间站 sector。
- 已是任意 group anchor 的星区不可重复添加。
- 新 hub 可选择非玩家星区作为 anchor。

统一 pill 行：
- 取消 `覆盖星区 | 候选星区 | 连接星区` 三 tab。
- 每个 jump row 混排 coverage、candidate、connected pill。
- coverage 金色，candidate 半金色，connected 绿色。
- baseline 只用粗边框标记，不提供恢复语义。
- 有玩家空间站用实心点，无玩家空间站用空心点。
- 按钮语义：`+` 加入/连接，`×` 移出/断开，`→` 从其他 group active coverage 转入。

### 6. Coverage、Candidate 与 Connection

Coverage/candidate 使用当前 group 自己的 `jumpRange`：
- 增大 jumpRange 时，仅新增跳数层内符合条件且未被其他 group active coverage 占用的玩家星区自动加入 coverage。
- 缩小 jumpRange 时，超出范围的 coverage 移出；若仍符合候选条件则显示为 candidate。
- jumpRange 改回后，只能按普通 candidate `+` 重新加入。
- 修改 coverage jumpRange 不增删连接。

Candidate：
- 可在多个 group 中同时显示。
- active coverage 同一时间只能属于一个 group。
- 若 sector 已是其他 group active coverage，在当前 group 中显示 `→`，点击后转入当前 group。
- 已成为任意 hub anchor 的 sector 不作为 coverage/candidate 显示，改为 connected pill。

Connection：
- hub anchor 统一作为绿色 connected pill 显示。
- 当前 group 到目标 hub anchor 距离 5 跳内即可手动连接。
- 已连接显示 `×`，未连接候选显示 `+`。
- 连接只由 `connectedGroupIds` 表达，不使用 `excludedDefaultConnectedGroupIds`。

### 7. Assignment Option 规则

Col 3 为所有玩家星区生成 card，但任意 hub anchor 不生成普通 assignment card。

对玩家 sector S：
1. 若 S 是任意 group anchor，跳过。
2. 收集所有当前覆盖范围命中的 group，全部成为 option。
3. 若无当前范围命中，收集最小扩展距离层的 group，作为扩展 option，且不默认选中。
4. 若仍无 group option，若 S 是 baseline 星区，可按 baseline group 重新吸收并作为默认；否则仅保留 standalone option。
5. standalone 始终为最后 option，但不作为自动兜底默认。

默认选择：
- `excludedDefaultAssignmentSectorMacros` 中的玩家 sector 不可默认选中对应 group，但仍可手动选择。
- 扩展命中 group 不默认选中。
- 当前范围命中且未 excluded 的 group 按距离、score、stable key 选择默认。
- 若所有命中 option 都被 excluded，则不设置默认选项。

### 8. 确认写入与 Live 继承

确认写入：
- Col 3 全部未决解决后 [确定] 可用。
- 点击 [确定] 一次性写入 `saveBindingStore`。
- bridge/standalone/hub draft 都作为普通 `BindingSectorGroup` 写入。
- 不新增 bridge marker 持久化字段。
- `createAutoGroups` 按 UUID 优先、`sectorMacro` 兜底匹配已有 group，避免 standalone 重建时重复。
- 写入后按最终 group coverage 重建 `sector -> groupId` 映射，并重分配 `stationPlans`。

非玩家 hub：
- 不新增虚拟 stationPlan，不修改 save archive 原始记录。
- 通过现有 `bindSectorGroup` 确保 `BindingSectorGroup.tradeStation` 存在。
- Live transit 页面通过现有 `BindingSectorGroup.tradeStation -> buildTransitHubsFromBinding` 路径继承。

## 边界

In Scope：
- Live Production overview 三列布局下的自动分组、编辑输入和确认写入。
- Hub 识别、clean slate、incremental、MST、bridge、all-hit assignment options。
- `SectorConfirmBar`、`SectorGroupList`、`SectorOverviewPanel`、`SectorHubAddMenu`。
- `GroupDraftInfo.isPinned`、`excludedDefaultAssignmentSectorMacros`。
- i18n 文案。

Out of Scope：
- `MapBindingSectorGroup` 交互改造。
- Terraforming / Research / Blueprint Recipe。
- 把 bridge 扩展为“自动联通所有玩家星区”。

## 验收标准

1. 绑定或上传新 guid 存档后自动创建 binding 并生成 Col 2/3 草案。
2. 已有 guid 有新玩家星区时运行增量分配。
3. Col 2 编辑态支持桥接、节点、阈值、覆盖、添加 hub、统一 pill 行编辑。
4. clean slate 下节点 checkbox 不可取消；有 baseline/pinned 输入时可取消且不生成新 pure hub。
5. 新 hub 可选择非玩家星区，确认后通过 transit hub 逻辑继承。
6. MST 生成 `connectedGroupIds`；断裂时按规则显示或自动采用 bridge 方案。
7. coverage/candidate/connected pill 行为符合 `+`、`×`、`→` 语义。
8. Col 3 每个玩家 sector card 包含所有当前命中 group option；扩展命中和 excluded 不默认选中。
9. standalone 始终为最后 option 且不自动兜底。
10. Col 3 card 身份与顺序在普通选择中保持稳定，只有重新计算或重新运行自动分组时重建。
11. [确定] 后一次性写入 store，Col 3 切换资源视图。
12. `npm run build` 通过。

## 来源：Map 集成增量：auto-sector-group-map

补充 Map binding-sector 层的面板复用、focus-sector、compact UI、拖拽排序与生产入口替换。

# 自动星区划分接入 Map 界面 (auto-sector-group-map)

## 目标

将 `auto-sector-group-merged` 的自动星区划分能力整合到 Map 界面，替换原有的 `MapBindingSectorGroup`（step 2），使用 tab 切换 Hub（群组管理）和分配方案视图，Vue 组件根据 map/live 上下文做样式适配，并保留地图上点击 pill 聚焦星区的功能。

## 已确认方案（审核重点）

### 1. 架构重构

| 步骤 | 内容 |
|------|------|
| Phase 1 | 从 `SectorOverviewPanel.vue` 抽取核心逻辑到 `useAutoSectorGroupPresenter.ts`，使其遵守 `store → presenter → vue` 三层规则 |
| Phase 2 | 保持 `SectorConfirmBar + SectorGroupList` 作为 Col 2 组合，`SectorAllocationList + AllocationConfirmBar` 作为 Col 3 组合，不新增 unit wrapper |
| Phase 3 | 创建 map 上层 wrapper 承载 Hub/分配方案 tab、360px 容器和地图事件 relay，并替换 `MapSavePanel.vue` 的 `binding-sector` 层 |
| Phase 4 | 清理无生产入口的遗留 `MapBindingPanel.vue`，避免继续维护两套 binding panel |

Presenter 先完成重构（确保 live 侧不受影响），然后再迁移到 map。Presenter 抽取的是 SectorOverviewPanel 中的字段级响应式状态、computed 派生、纯逻辑方法（runAutoGroup / enterEditMode / cancelEdit / runCalculation / addHubDraft / removeHubDraft / togglePin / updateJumpRange / coverage 操作 / connection 操作 / selectAssignment / selectBridge / confirmAndWrite），不包含 DOM 操作。

### 2. 入口与触发

自动计算触发检查移动到 `useLiveProductionStore` 层级：
- `liveProductionStore` 检查当前 binding 中所有有玩家资产的 sector 是否都已经归到 group
- 检查触发时机包括刷新、手动切换 binding、上传新存档或 archive timing 变化导致的 binding 切换
- 检查完成后设置“需要自动分组计算”的 flag，并记录触发原因（如 refresh / binding switch / archive timing switch）
- presenter 监听该 flag 并执行 auto group 计算；计算执行完成后由 presenter 清除 flag
- 已有 guid 绑定时运行增量分配（保留已有 group 作为 baseline/pinned 输入）

### 3. Tab 结构（Map Context）

在 Map binding 上层 wrapper 内部（非新增独立主 tab）渲染两个 tab：

| Tab | 内容 | 说明 |
|-----|------|------|
| **Hub** | `SectorConfirmBar(view='map')` + `SectorGroupList(view='map')` | Col 2 组合：编辑跳数/阈值/节点/覆盖/保留、添加枢纽、统一 pill 操作、拖拽排序 |
| **分配方案** | `SectorAllocationList(view='map')` + `AllocationConfirmBar` | Col 3 组合：每个玩家星区的归属选择（absorb/standalone），确认写入 |

Tab 切换不改变计算状态，只切换显示内容。Map 编辑态下禁止切换到分配方案 tab。完成态（即 live 界面不显示 `SectorAllocationList` 的状态）下，Map binding 界面也不显示 tab 和 `SectorAllocationList`。

### 4. Vue 组件上下文适配

所有从 `SectorOverviewPanel` 引用的子组件（`SectorConfirmBar`、`SectorGroupList`、`SectorAllocationList`、`SectorHubAddMenu`）新增 `view` prop：`'map' | 'live'`。`SectorConfirmBar` 已有 `mode: 'result' | 'edit'`，不得复用 `mode` 表达 map/live 视图。

**map 模式差异：**
- 紧凑样式适配 360px 侧边栏宽度
- pill 点击 emit `focus-sector`（sectorMacro），由 map 上层 wrapper relay 到 map 父组件
- `SectorConfirmBar` 隐藏 Col 1 的 SaveUploadPanel（map 侧独立管理存档选择）
- `SectorHubAddMenu` 在 map 下使用原始 `MapBindSectorMenu` 的 teleported popup 模式（锚定 trigger element），保留"定位地图"按钮

**live 模式差异：**
- 保持现有三列全宽布局
- 无 focus-sector emit
- SaveUploadPanel + SaveList 在 Col 1 显示
- edit 模式下 Col 3 保留 allocation 区域但显示遮罩禁用操作

### 5. Pill 点击聚焦星区

保留 `MapBindingSectorGroup` 中原有的 pill → 地图聚焦功能，事件链：

```
SectorGroupList pill @click
  → emit('focus-sector', sectorMacro)
  → Map binding wrapper relay
  → emit('focus-sector', sectorMacro)
  → MapSavePanel relay (已有逻辑)
  → MapWorkbenchView.onBindingFocusSector(sectorMacro)
  → mapStore.resolveSectorByMacro() + focusSector(sectorId)
```

`SectorAllocationList` 中的 assignment card sector 名也支持点击聚焦（map 模式下）。

### 6. Hub 弹出菜单

| Context | 组件 | 行为 |
|---------|------|------|
| `map` | `MapBindSectorMenu`（保留现有） | teleported popup，锚定 trigger element，有"定位地图"按钮；无搜索时列玩家星区，搜索时列全地图 sector |
| `live` | `SectorHubAddMenu`（保留现有） | fixed overlay modal，点击背景/Esc 关闭；无搜索时列玩家星区，搜索时列全地图 sector |

两者共享相同的过滤规则：已是任意 group anchor 的 sector 不显示添加按钮；新增 hub draft 默认 `isPinned=true`、`baseline=false`、`isNew=true`。

### 7. 拖拽排序

Hub tab 中的 group 列表使用 `vuedraggable` 支持拖拽排序（复用现有 `MapBindingSectorGroup` 中使用的 `vuedraggable`）。拖拽只改变 `groups` 数组顺序，不触发重新计算。排序权威状态是数组顺序；`order` 字段不参与排序语义，如保存时必须填充则仅按数组 index 机械写入以兼容旧 schema。

### 8. 确认写入

与 live 侧一致：
- 所有未决 assignment 解决后 [确定] 可用
- 一次性写入 `saveBindingStore`（`createAutoGroups`）
- 按最终 coverage 重建 `sector → groupId` 并重分配 `stationPlans`
- 确认后进入完成态，不自动切换到 station binding 阶段
- 完成态下 live 不显示 `SectorAllocationList`；Map binding 也不显示 tab 和 `SectorAllocationList`
- 完成态下在每个 group 上显示进入 station binding 的按钮，按钮图标保持原 `MapBindingSectorGroup` 的图标；不再提供旧的单 group 编辑按钮

## 边界

### In Scope

- `useAutoSectorGroupPresenter.ts` 抽取（SectorOverviewPanel 核心逻辑）
- Map binding wrapper 创建（map tab、完成态、360px 容器、事件 relay）
- `SectorGroupList`、`SectorAllocationList`、`SectorConfirmBar` 的 `view` prop 适配
- `liveProductionStore` 自动分组检查 flag 与 presenter 消费逻辑
- pill click → focus-sector 事件链（map context）
- Hub tab 拖拽排序
- MapSavePanel 中的 `binding-sector` 层替换
- 无生产入口的 `MapBindingPanel.vue` 清理
- `MapBindingSectorGroup.vue` 删除
- i18n 新 key（`auto_sector.hub_tab`、`auto_sector.allocation_tab` 中英文）

### Out of Scope

- 地图 canvas 上的星区组覆盖高亮
- MapBindingStation（step 3）的改造
- Terraforming / Research / Blueprint Recipe
- 非 auto-sector-group 相关的 MapBindingSectorGroup 功能迁移
- 已无生产入口的 `MapBindingPanel.vue` 行为兼容

## 验收标准（DoD）

1. `useAutoSectorGroupPresenter.ts` 抽取后 `SectorOverviewPanel.vue` 不再直接 import 业务 store（`useSaveBindingStore`、`useLiveProductionStore`）
2. Live Production overview 的自动分组功能与重构前行为一致
3. Map Save Panel 的 `binding-sector` 层使用新的 map binding wrapper 渲染，不再渲染 `MapBindingSectorGroup`
4. 无生产入口的 `MapBindingPanel.vue` 被清理，源码不再保留第二套 binding panel
5. Hub tab 中 group 列表支持拖拽排序
6. Hub tab 中 pill 点击正确触发地图聚焦（星区居中显示）
7. 分配方案 tab 中 sector 名点击正确触发地图聚焦
8. `view='map'` 时子组件使用紧凑样式，不溢出 360px 侧边栏
9. `view='live'` 时子组件保持现有三列布局
10. Hub 添加菜单在 map 下使用 MapBindSectorMenu 模式（teleported popup + 定位按钮）
11. `liveProductionStore` 在刷新、binding 切换、archive timing 切换后检查未归组玩家 sector，并通过 flag 驱动 presenter 执行自动分组；执行完成后 flag 被清除
12. 完成态下 live 与 map 都不显示 `SectorAllocationList`；Map 不显示 tab，并在 group 上显示进入 station binding 的按钮
13. edit 模式下 live 显示 allocation 遮罩；Map 禁止切换到分配方案 tab
14. 拖拽排序持久化以 `groups` 数组顺序为准，不以 `order` 作为排序权威
15. `npm run build` 通过

## 未决项

无

## 来源：Hub 颜色增量：auto-sector-group-color

补充 hub color 自动分配、用户色卡、持久化和地图染色。

# Hub 色卡与地图星区染色 (auto-sector-group-color)

## 目标

为自动星区划分中的每个 hub 分配颜色（色卡），并在 Live Production 的地图六边形上对覆盖星区染色，让用户直观区分各 hub 的管辖范围。

本变更依赖 `auto-sector-group-merged` 的 `GroupDraftInfo`、`BindingSectorGroup`、SectorGroupCard 和地图渲染层。

## 已确认方案

### 1. 色板

- 固定 30 色色板：27 彩色（取自 CompactPicker 默认按色系 9×3 排列）+ 白/黑/透明
- SketchPicker UI 展示为 10 列 × 3 行 Grid
- 自动分配仅从 27 彩色中选择；白/黑/透明仅能由用户从色卡选择
- 透明是清空颜色的预设：选择透明等同于 `color = undefined`，不保存为 `0x00000000` 或其他透明色值

### 2. 颜色自动分配与稳定策略

颜色仅用于地图上的 hub 管辖范围区分，不代表用户业务选择。用户可以通过色卡调整预设颜色，但颜色不可锁定：预设颜色会被保存以保持相对稳定，但后续 [计算] 或提交前交互调整仍可在发现冲突时修改它。

**颜色稳定总览**

| 时机 | 处理范围 | 规则 |
|------|----------|------|
| Clean slate / Incremental / [计算] | 可批量处理多个 hub | 先保留满足约束的既有颜色，再为缺色、新增、冲突 hub 分配颜色 |
| [计算] 后到提交前：新增 hub | 仅新增 hub | 只为新增 hub 分配颜色，不改变其他 hub |
| [计算] 后到提交前：调整覆盖星区 | 仅当前 hub | 只判断并可能重分配当前 hub，不改变其他 hub |
| 色卡选色 | 仅当前 hub | 更新当前 hub 的预设颜色；该颜色可持久化，但后续 compute 可在冲突时修改 |
| 从已保存 binding 恢复为 result | 不补色 | 缺色保持缺色，等待下次 [计算] 后补色 |

**Stage 0 — 先判定可保留颜色**

用户点击 [计算] 时，系统先检查每个已有颜色的 hub。已有颜色若同时满足以下条件，则加入固定颜色集合并保持不变：

- 与自身定位星区 faction 色、覆盖星区 faction 色的 ΔE 均 > 5
- 与 5 跳以内 hub 的已固定颜色不重复；重复按 ΔE ≤ 5 判定

点击 [计算] 后到提交之前，用户每次操作只会调整一个 hub：新增一个 hub，或调整一个 hub 的覆盖星区。因此交互态颜色稳定只判断当前被调整的 hub，且一次最多重分配这一个 hub 的颜色。

若当前操作因覆盖计算新增覆盖星区，且新增覆盖星区 faction 色与该 hub 当前颜色 ΔE > 5，则该新增覆盖星区本身不触发重新分配。若新增覆盖星区与当前颜色 ΔE ≤ 5，或当前操作新增 hub，或当前 hub `color` 为 null/undefined，或当前 hub 现有颜色与定位/覆盖星区 faction 色、5 跳内 hub 颜色发生冲突，则仅对当前 hub 即时重新分配颜色。

**Stage 1 — 避开自身定位与覆盖星区 faction 色**

对待分配 hub，从 27 彩色中筛选候选，避开的 faction 色包括：

- hub 中央/定位星区 faction 色
- hub 覆盖星区 faction 色

ownerless、缺失 owner_color 或无法解析的 faction 色不参与避色。

Stage 1 使用逐步降低阈值的方式获得至少 5 个候选：按 ΔE ≥ 20 → 15 → 10 → 5 → 0 依次尝试。达到至少 5 个候选时停止；如果 27 彩色总数仍不足 5 个可用候选，则使用当前可用候选继续 Stage 2。

**Stage 2 — 避开 5 跳内 hub**

Stage 2 只考虑 5 跳以内的 hub，允许与 5 跳外 hub 颜色重复。避色集合包含：

- 5 跳以内已固定或已分配 hub 的颜色
- 5 跳以内 hub 的中央/定位星区 faction 色

对 Stage 1 候选逐步降低 ΔE 阈值，直到找到可用候选：

| 尝试 | 条件 | 说明 |
|------|------|------|
| 1 | 候选色与 5 跳内避色集合 ΔE ≥ 20 | 严格避色 |
| 2 | ΔE ≥ 15 | 放宽 |
| 3 | ΔE ≥ 10 | 再放宽 |
| 4 | ΔE ≥ 5 | 再放宽 |
| 5 | 不做过滤 | 从 Stage 1 候选中 maximin 选最优 |

多个候选可选时，用 maximin 取与避色集合最小距离最大者。批量计算阶段处理一个重分配 hub 后，将其颜色加入已分配集合，再处理下一个 hub；点击 [计算] 后到提交前的交互调整阶段，只处理当前被调整的单个 hub。

**Stage 3 — 极端 Fallback**

仅当颜色解析失败、Stage 1/2 无法产生任何候选时，才随机生成颜色。

- 5 跳外的 hub 色不参与避色
- 允许 5 跳外重复颜色，不做全局唯一性限制
- ΔE 计算使用 culori CIE2000

### 3. 分配时机

- **Clean slate / Incremental 首次计算**：所有 hub 均无颜色 → 按算法分配
- **[计算] 重算**：
  - 先判定可保留颜色
  - 对新增、缺色、或与自身/5 跳内约束冲突的 hub 重分配
  - 已满足约束的 `color` 保留
- **[计算] 后到提交前的交互调整**：
  - 新增 hub 时，只为该新增 hub 分配颜色
  - 调整某 hub 覆盖星区时，只判断并可能重分配该 hub 颜色
  - 一次用户操作最多改变一个 hub 的颜色
- **用户通过色卡选色**：直接覆盖当前 `group.color`，作为新的预设颜色；若选择透明，则清空为 `undefined`

### 4. 数据持久化

| 位置 | 字段 | 说明 |
|------|------|------|
| `BindingSectorGroup` | `color?: string` | 持久化到 localStorage，用于保持颜色相对稳定 |
| `GroupDraftInfo` | `color?: string` | draft 阶段携带 |
| `normalizeState()` | `color: group.color` | 加载时保留 |

旧数据无 `color` 字段不报错，视为"未着色"，下次点击 [计算] 后由颜色稳定流程自动补色。

透明色不持久化为颜色值。用户选择透明时应删除/置空 `color` 字段；地图不绘制该 hub 的内部六边形。

### 5. UI — SectorGroupCard 色卡控件

| 维度 | 说明 |
|------|------|
| 位置 | `group-title-row` 中，group name 与详情按钮之间 |
| 外观 | 16×16 圆角色块；有颜色填充，无颜色虚线边框 |
| 状态覆盖 | 默认态、计算结果态、编辑态**均显示**色卡 |
| 编辑态交互 | 点击色块弹出 SketchPicker（10×3 色板 + SV 取色区）；点预设色 dismiss |
| 非编辑态 | 色块仅展示，不可点击 |

**SketchPicker 配置：**

- 组件：`vue-color` 的 `SketchPicker`
- `disable-alpha`：true（禁用透明度）
- `preset-colors`：`HUB_PALETTE`（30 色）
- 容器宽度：260px
- 预设区：CSS Grid `repeat(10, 1fr)`，间距 3px
- 选中态：`aria-selected="true"` → 蓝色双层 ring（`#1e293b` + `#60a5fa`）
- dismiss 行为：点预设色块关闭，拖拽 SV/Hue 不关闭，ESC/点遮罩关闭
- 点击透明预设时清空 `group.color`

### 6. 地图星区染色

- 覆盖星区从定义上互斥：一个星区最多被一个 hub 覆盖，因此 `sectorGroupColorMap` 不需要处理多 hub 同星区冲突
- 对每个 hub 的 coverage 星区，在 `MapSectorLayer` 六边形中心绘制 2/3 半径的内部填充六边形
- 颜色为对应 hub 的 `color`，无边框
- 当 hub `color` 为 undefined（包括选择透明后）时，不绘制内部六边形
- 渲染层级：faction owner 色之上，resource pie 之下
- 新的 prop：`sectorGroupColorMap: Record<string, string>`（sectorMacro → color）

### 7. 依赖

- `vue-color`：SketchPicker（已安装）
- `culori`：ΔE 计算（已安装）
- 无需新增 npm 依赖

## 边界

In Scope：
- 色卡控件在 SectorGroupCard 中的展示与交互
- 颜色自动分配算法（三阶段 + culori maximin）
- `color` 字段持久化到 `BindingSectorGroup` 和 `GroupDraftInfo`
- `normalizeState()` 兼容 `color` 字段
- 地图六边形 2/3 区域染色
- 旧数据兼容（无 color 不报错）
- i18n 文案

Out of Scope：
- Terraforming / Research / Blueprint Recipe
- `MapBindingSectorGroup` 交互改造
- 颜色在 Live transit / EmpireWareFlowsDashboard 中的展示
- 色差阈值 UI 可配置

## 验收标准

1. 自动分组生成后每个 hub 有可用于地图区分的颜色
2. hub 颜色优先避开自身定位/覆盖星区 faction 色；ownerless 不参与避色
3. 5 跳以内 hub 颜色优先区分，允许与 5 跳外 hub 颜色重复
4. SectorGroupCard 在所有状态下显示色卡，编辑态可打开 SketchPicker 选色
5. 色卡选色后颜色持久化，reload 不丢失；选择透明时清空颜色且不绘制地图染色
6. [计算] 后满足约束的已有颜色保留；新增、缺色或冲突 hub 自动重分配
7. 用户调整的预设颜色可被后续 compute 在冲突时修改，不存在锁定颜色
8. 点击 [计算] 后到提交前，新增 hub 或调整覆盖星区时，一次最多自动改变当前被调整的一个 hub 颜色
9. 从已保存 binding 恢复为 result 时不单独补色；缺色 group 在下次 [计算] 后补色
10. 地图上各 hub coverage 星区 2/3 中心区域显示对应颜色；覆盖星区互斥，无需多 hub 颜色冲突处理
11. `npm run build` 通过

## 未决项

无

## 来源：Trade Station 增量：auto-sector-group-station

补充 hub trade station 候选、默认值、选择、gate、重置、保留与持久化。

# 请求：Auto Sector Group - 贸易站选择

## 目标

在 auto-sector-group 结果计算完成后，为每个 hub group 提供贸易站（Trade Station）选择控件。用户可以手动选择该 group 锚点星区内的玩家空间站作为交易站，或使用虚拟交易站（定位于星区中央）。该选择在提交时写入 `BindingSectorGroup.tradeStation`。

## 已确认方案（审核重点）

### 1. 候选值算法

- 对 hub group 锚点星区的 **玩家空间站** 使用 `detectStationHub()` 计算 score
- 按 score 降序取 top 5
- 硬性约束：top 5 中 `isPureHub`（qualified 且 prodLines===0）的站至少保留 2 个（如星区内存在 >= 2 个 pureHub）；不足则从后续 pureHub 补充

**用户手动添加的 hub 的特殊规则：**
- 如星区内存在 qualified 站 → 候选仅从 qualified 站中选择
- 如星区内无 qualified 站 → 候选从所有玩家站中选择（忽略阈值）

### 2. 默认值算法

默认值按以下优先级判断，前序命中后不再进入后续分支：

| 条件 | 行为 |
|------|------|
| 锚点星区无玩家空间站 | 仅显示虚拟交易站，并默认选中虚拟交易站 |
| 最高分站是 `isPureHub` | 直接选中该站 |
| 最高分不是 `isPureHub`，且同时存在 `isPureHub` 和生产站 | **无默认值**，用户手动选择 |
| 全为生产站，第一名 score > 第二名 × 1.3 | 选中第一名 |
| 全为生产站，差距不满足 30% | **无默认值**，用户手动选择 |

### 3. Card 选项

每个成为 hub 的 group 都需要一个 trade station card。每个 group card 以 `<li>` 列举：
- 候选玩家空间站（radio 选一个），显示 score 和 containerCap
- **虚拟交易站**（`__virtual__`，定位于星区中央）
- 如锚点星区无玩家空间站，则 card 仅显示虚拟交易站，并默认选中

### 4. UI 布局

**Map 面板 (`AutoSectorGroupMapPanel.vue`)：**
- 新增第3个 tab `activeTab = 'hub' | 'allocation' | 'tradeStation'`
- tab 顺序：Hub → Allocation → TradeStation
- Allocation tab 和 TradeStation tab 内各自放置 `AllocationConfirmBar`
- tradeStation tab 仅在未确认状态下展示
- 初次计算完成以及点击计算后，自动跳转到首个有未解决内容的 tab（allocation > tradeStation）
- Map: 全部解决后跳转到 hub tab；Live Col3: 全部解决后跳转到 allocation tab

**Live Col3 (`SectorOverviewPanel.vue`)：**
- 未确认状态下 Col3 改为 tab 结构（Allocation | TradeStation）
- 各 tab 内各自放置 `AllocationConfirmBar`

### 5. AllocationConfirmBar 改造

```typescript
// 旧 props
hasUncertain: boolean

// 新 props
unresolved: string[]  // i18n keys 数组
```

显示规则：
- `unresolved.length > 0` → `unresolved.map(k => t(k)).join(', ')`
- `unresolved.length === 0` → `t('sector.all_resolved')`
- status 文本可以按当前 tab 传入局部 unresolved key
- 确认按钮必须使用全局 gate：`disabled = unresolvedGlobal.length > 0 || disabled`

Allocation tab 传入 `['sector.allocation_unresolved']`，TradeStation tab 传入 `['sector.trade_station_unresolved']`。

### 6. 保留 (Retain) Trade Station

- SectorConfirmBar 阈值 `param-field` 的 label 改为 `sector.trade_station_short`（"交易站"/"Trade Station"），与桥接控件模式一致：同一 box 内 label + dropdown + checkbox
- result 模式仅显示 flat 值；edit 模式显示 dropdown + `保留` checkbox（`sector.retain`）
- `tradeStationRetainEnabled` checkbox 支持三态 indeterminate，与 group cards 双向联动
- Edit 模式下 group cards 显示 `tradeStationRetainEnabled` 开关（SectorGroupCard 内）
- GroupDraftInfo 新增 `tradeStationRetainEnabled` 字段
- 保留的 trade station 仅在计算时提供默认选中值；用户手动选择始终优先于 retain 默认值
- 虚拟交易站 code `__virtual__` 仅用于 UI/计算层，不得写入最终持久化结构

### 7. 确认按钮 Gate

确认按钮启用条件（三者全部满足）：
1. `hasUncertainAssignments === false`
2. `hasPendingBridgeDecision === false`
3. `hasUnresolvedTradeStations === false`

新增 `hasUnresolvedTradeStations`：存在需要选择 trade station 的 group 但 `selectedTradeStations[groupId]` 为 `null`。

`selectedTradeStations` 语义：
- `null`：未决，不允许确认
- `{ stationCode: '__virtual__' }`：已选择虚拟交易站，允许确认；最终持久化时 `saveStationCode` 写入 `undefined`
- `{ stationCode: '<player-station-code>' }`：已选择玩家空间站，允许确认；最终持久化时写入该 code

所有确认按钮（SectorConfirmBar、Allocation tab、TradeStation tab）都必须使用同一个全局 gate。Allocation tab 即使自身 allocation 已解决，只要 trade station 未解决，确认按钮也必须 disabled。

### 8. 重置行为

- Allocation tab 的重置按钮：仅重置 sector assignment 选择（bridge plan + uncertain sector options）
- TradeStation tab 的重置按钮：仅重置 trade station 选择，恢复为默认值

### 9. 统一确认

SectorConfirmBar 和 AllocationConfirmBar 的确认按钮功能等价，均为调用 `handleConfirm()`。

### 10. 持久化与旧自动写入逻辑

- `handleConfirm()` 必须按 `selectedTradeStations` 显式写入每个 hub group 的 trade station
- 选择玩家空间站时，最终 `BindingSectorGroup.tradeStation.saveStationCode` 为玩家站 code
- 选择虚拟交易站时，最终 `BindingSectorGroup.tradeStation.saveStationCode` 为 `undefined`，`position` 为锚点星区中心
- 现有 `createAutoGroups()` 内自动绑定 `hubStationCode` 或 fallback best station 的逻辑必须被移除、绕过或由新 selection 覆盖，不能绕过用户选择
- 如既有 group 已绑定玩家 trade station，用户改选虚拟交易站时必须清除旧 `saveStationCode`

## 边界

### In Scope

- 新组件 `SectorTradeStationList.vue` / `SectorTradeStationCard.vue`
- 候选值/默认值算法 `tradeStationSelection.ts`（复用 `detectStationHub`、`rankStationHubs`）
- Map 面板新增 TradeStation tab
- Live Col3 改为 tab 结构
- AllocationConfirmBar 改造（`hasUncertain` → `unresolved: string[]`）
- SectorConfirmBar 新增 `tradeStationRetainEnabled` checkbox
- SectorGroupCard 新增 `tradeStationRetainEnabled` 开关
- Presenter 新增 trade station 相关状态和方法
- GroupDraftInfo 新增 `tradeStationRetainEnabled` 字段
- `handleConfirm()` 调用 `upsertTradeStation()` 写入 trade station
- 调整 `createAutoGroups()` 或提交流程，避免旧自动 trade station 写入逻辑覆盖新选择
- 虚拟交易站提交时清除旧 `saveStationCode` 并写入星区中心 position

### Out of Scope

- 地图 Canvas 覆盖层
- 其他已有功能的重构
- 测试代码（由 `/x4:test` 负责）
- NPC 贸易站选择（本次仅处理玩家空间站）

## 验收标准（DoD）

1. 自动分组完成后，TradeStation tab 显示所有成为 hub 的 group card
2. 自动生成 hub（有 pureHub）和用户手动添加 hub 的候选列表正确
3. 用户手动添加 hub 且星区无 qualified 站时，候选不设阈值限制
4. 默认值按算法正确选中或留空
5. 无玩家空间站的 hub group 仅显示虚拟交易站且默认选中
6. 用户可手动选择候选站或虚拟交易站
7. tradeStation 选择未完成时所有确认按钮 disabled
8. sector assignment、bridge decision 和 trade station 全部完成后确认可用
9. 确认后 trade station 选择写入 `BindingSectorGroup.tradeStation`
10. 虚拟交易站不会把 `__virtual__` 写入持久化，最终 `saveStationCode` 为 `undefined`
11. 保留 checkbox 正确控制默认选中已有 tradeStationCode
12. 重置按钮仅重置当前 tab 的选择
13. `npm run build` 通过

## 未决项

无

## 来源：最新共享草案口径：auto-sector-group-draft

最终修正共享 draft 所有权、初始化生命周期、archive time 重算策略、Live 双模式与面板不自动计算规则。

# Binding 模式共享草案 (auto-sector-group-draft)

## 目标

将 binding 模式的 group 方案数据搬入 `liveStore`，使 live 面板和 map 面板共享同一份编辑状态，切换不丢进度。同时草案数据不直接修改 `draftBinding`，退出 binding 不回滚已确认内容。

本变更只维护一份全局唯一的 binding draft。系统不需要、也不支持同时维护多个 binding 的并行草案；`liveStore` 中的共享状态始终表示“当前正在编辑的 binding 草案”。

## 已确认方案（审核重点）

### 1. 当前问题

- `useAutoSectorGroupPresenter()` 每次调用创建独立实例，live 面板和 map 面板各有独立状态
- `handleColorChange` 调用 `saveBindingStore.updateGroup()` 直接修改 `draftBinding`，选色立即持久化
- live 改一半切到 map 面板，进度丢失

### 2. 最小搬迁清单

以下 6 个状态从 presenter 搬入 `useLiveProductionStore`（Pinia 单例），两个面板共享：

| 状态 | 类型 | 说明 |
|------|------|------|
| `autoGroupResult` | `ShallowRef<AutoGroupResult \| null>` | groups（含 selectedTradeStation、color）+ assignments + bridgePlans |
| `calculationMode` | `Ref<'edit' \| 'result'>` | 编辑/结果模式 |
| `prefJumpRange` | `Ref<number>` | 覆盖 hop 数 |
| `bridgeSearchJumpRange` | `Ref<number>` | bridge 搜索 hop 数 |
| `prefThreshold` | `Ref<number>` | hub 阈值 |

`autoGroupResult` 可以为非 null 且未确认（编辑中草案），也可以为非 null 且已确认（已提交结果）。确定栏始终显示，不因确认状态隐藏。

### 3. 存档时间比对与变化 flag

`SaveBindingPlan` 新增 `appliedAutoGroupArchiveTime`，与 `needsAutoGroupRecalc` 构成变化 flag：

| 字段 | 类型 | 说明 |
|------|------|------|
| `appliedAutoGroupArchiveTime` | `number \| undefined` | 最近一次已应用 auto group 的 `archive.meta.time` |

**变化 flag**：
```
needsAutoGroupRecalc := appliedAutoGroupArchiveTime === undefined
                     || appliedAutoGroupArchiveTime < archiveTime
```

Store 初始化（或 activeBinding/archive 切换）时调用 `initAutoGroupDraft()`，根据变化 flag 分两条路径：

- **有变化 flag** → 运行分组算法（`groupCleanSlate` / `groupIncremental`）生成 `autoGroupResult`
- **没有变化 flag** → 从已有 binding 的 groups 为每个覆盖星区计算所有候选目标，构建 assignments（不跑分组算法）

Live 面板和 Map 面板直接读取 store 中已生成的数据。「详情」按钮仅切换显示模式，不执行计算；计算模式内用户显式点击「计算」时，可更新共享 draft。

`handleConfirm()` 记录 `appliedAutoGroupArchiveTime`，不覆盖 `autoGroupResult`。

**不搬的（留在 presenter 本地）：**

- `tradeStationCandidates` — computed，每次切换 tab 从 archive + groups 重算
- `editSnapshot` — 与当前面板 UI 绑定
- `bridgeRetainEnabled` 等保留开关 — 局部 UI 状态
- `hasGlobalUnresolved`、`hasUncertainAssignments` 等 — computed，本地重算

`calcBaselinePillState` 随共享 draft 初始化写入 `liveStore`，用于 live/map 两个面板展示同一份初始覆盖和连接基线。

### 4. Presenter 改造

Presenter 作为 view 连接与交互编排层：共享 draft 状态必须从 `liveStore` 读取 refs 暴露给组件；初始化双路径数据生成由 `liveStore.initAutoGroupDraft()` 负责。与当前面板交互强绑定的 handler / computed 可继续留在 presenter，但不得维护第二份共享 draft，也不得在颜色编辑时直接写 `draftBinding`。

```ts
export function useAutoSectorGroupPresenter() {
  const liveStore = useLiveProductionStore()
  const { autoGroupResult, calculationMode, ... } = storeToRefs(liveStore)
  // computed / handler 使用 liveStore 的共享 draft 作为唯一数据源
}
```

### 5. 地图草案渲染

`MapWorkbenchView` 的 `sectorGroupColorMap` 计算：

```ts
const sectorGroupColorMap = computed(() => {
  const isBinding = bindingContextStage.value === 'select-sector'
                 || bindingContextStage.value === 'select-station'
  if (isBinding && liveStore.autoGroupResult) {
    return buildColorMap(liveStore.autoGroupResult.groups)
  }
  const binding = saveBindingStore.activeBinding
  if (!binding) return {}
  return buildColorMap(binding.groups)
})
```

非 binding 模式下始终使用 `saveBindingStore.activeBinding` 的持久数据。

### 6. 生命周期

Store 在初始化及 activeBinding/archive 切换时调用 `initAutoGroupDraft()` 生成数据。Live 和 Map 面板不因挂载、面板切换或详情模式切换触发计算。

### 7. Live 面板模式切换

Live 面板（`SectorOverviewPanel`）两种显示模式（仅切换 UI 布局，store 数据已就绪）：

| 模式 | 布局 | 按钮 |
|------|------|------|
| 展示模式 | `[存档 3fr] \| [星区 4fr] \| [资源 5fr]` | 详情、地图 |
| 计算模式 | `[星区 5fr] \| [分配 4fr] \| [交易站 3fr]` | 返回、提交 |

**展示模式内容**（数据直接从 store 读取，只读展示）：

星区列表列顶部参数区（纯数值显示，不可编辑）：
- 桥接搜索跳数（`bridgeSearchJumpRange`）
- 分组覆盖跳数（`prefJumpRange`）
- Hub 阈值（`prefThreshold`，如 5M m³）

- 展示模式「详情」→ `liveMode = 'calculate'`（仅模式切换）
- 展示模式「地图」→ 跳转到 map binding 面板对应的星区/group 视图
- 计算模式「提交」→ 写 binding + 回到展示模式
- 计算模式「返回」→ 回到展示模式（不提交）
- 详情按钮红点：`needsAutoGroupRecalc`
- 详情按钮置灰：`!autoGroupResult`

计算模式内部列按钮（取消/计算等）保留不变。

| 时机 | 行为 |
|------|------|
| 进入 binding 模式 | presenter 读取 liveStore ref，恢复上次编辑状态 |
| binding 中编辑 | 两个面板读写同一份 liveStore ref |
| 切换 activeBinding 或 archive | 用新 binding/archive 重新初始化唯一草案；旧草案不按 gameGuid 缓存 |
| 确认提交 | `handleConfirm` → `createAutoGroups` → 写入 `draftBinding` → `saveBinding` |
| 展示模式「地图」 | 跳转到 map binding 面板 |
| 退出 binding | 不做回滚（已确认的内容在 draftBinding 中保存） |

## 边界

In Scope：
- `liveStore` 新增状态：`autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`、`needsAutoGroupRecalc`、`initAutoGroupDraft()`、`buildAssignmentsFromBinding()`
- `SaveBindingPlan` 新增并持久化 `appliedAutoGroupArchiveTime`
- Store 初始化时根据变化 flag 自动生成 `autoGroupResult`（双路径）
- Presenter 使用 `liveStore` 共享 draft 作为唯一数据源，并保留面板交互编排
- `MapWorkbenchView` 从 liveStore 读取渲染地图
- `handleColorChange` 移除 `updateGroup` 调用
- live 面板和 map 面板共享编辑状态
- 移除 overview 界面的 `LiveOverviewToolbar`

Out of Scope：
- 全部 presenter 内容搬迁
- `tradeStationCandidates` 搬迁
- UI 保留开关搬迁
- 修改 E2E 测试
- 多 binding 并行 draft 缓存

## 验收标准（DoD）

1. live 面板编辑 groups → 切到 map 面板 → 继续编辑 → 切回 live 面板，数据一致
2. binding 模式时修改 group 颜色，地图从 `autoGroupResult` 实时反映
3. `handleColorChange` 不再修改 `draftBinding`
4. binding 模式确认后地图从 `autoGroupResult` 渲染（与 `activeBinding` 数据一致）
5. 切换 activeBinding 或 archive 后，唯一草案按新上下文重新初始化，不显示上一上下文的未提交草案
6. Store 初始化/上下文切换时自动根据变化 flag 生成数据（有 flag → 分组算法，无 flag → 从 binding 构建 assignments）
7. `needsAutoGroupRecalc = applied === undefined || applied < archiveTime`
8. Live 面板「详情」仅切换模式不触发计算；红点/置灰状态正确
9. 确认提交后数据持久化，reload 不丢失
10. `npm run build` 通过

## 未决项

无
