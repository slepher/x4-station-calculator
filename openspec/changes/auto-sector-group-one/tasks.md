# auto-sector-group-one Tasks

## 最终合并说明

本文件是 auto-sector-group 系列 tasks 的自包含合并版。完成本 change 后，旧 tasks 文档可以删除或归档；任务追踪以本文为准。

当前 OpenSpec task 只统计“最终任务清单”中的 checkbox。后面的“来源任务明细”保留旧任务内容，但 checkbox 已转成普通文本，避免旧任务状态干扰当前 change。

## 最终任务清单
## 1. 文档合并

- [x] 创建 `auto-sector-group-one` 作为唯一合并后的 change 目录
- [x] 以 `auto-sector-group-merged` 承接旧三份文档的核心算法、编辑态和 assignment 行为
- [x] 合并 `auto-sector-group-map` 的 Map binding 集成、focus、drag sort 和 compact UI 行为
- [x] 合并 `auto-sector-group-color` 的 hub color 分配、色卡、持久化和地图染色行为
- [x] 合并 `auto-sector-group-station` 的 trade station 候选、默认值、tab、gate 和持久化行为
- [x] 以 `auto-sector-group-draft` 作为最终 shared draft 架构口径
- [x] 移除 presenter-local 共享 draft 的旧口径
- [x] 移除面板挂载/切换自动计算的旧口径
- [x] 移除 `calcBaselinePillState` 归属不清的旧口径
- [x] 将 request/design/tasks/spec 全部改为中文主文档
- [x] 补回场景级需求，避免只保留摘要式描述

## 2. Spec 拆分

- [x] `auto-sector-group-core/spec.md`：核心分组、距离、MST、bridge、编辑态、pill、assignment、confirm
- [x] `auto-sector-group-binding-draft/spec.md`：共享 draft、初始化生命周期、重算条件、Live 双模式
- [x] `auto-sector-group-map/spec.md`：Map binding 面板复用、地图聚焦、紧凑布局、拖拽排序、地图入口
- [x] `auto-sector-group-color/spec.md`：hub color 自动分配、色卡、持久化、地图染色
- [x] `auto-sector-group-trade-station/spec.md`：trade station 候选、默认、交互、gate、重置、持久化

## 3. 一致性处理

- [x] 共享状态最终归属 `useLiveProductionStore`
- [x] `useAutoSectorGroupPresenter` 定义为 UI 连接与交互编排层
- [x] Live 和 Map 均使用同一 `autoGroupResult`
- [x] `needsAutoGroupRecalc` 只由 archive time 与 applied time 决定
- [x] `initAutoGroupDraft()` 只在 store 初始化或 active context 切换路径触发
- [x] 用户显式点击“计算”时才允许计算模式重新运行算法
- [x] 确认成功写入 `appliedAutoGroupArchiveTime`
- [x] `SaveBindingPlan` 新字段要求同步 `normalizeState()`
- [x] `BindingSectorGroup.color` 与 `BindingSectorGroup.tradeStation` 明确为持久化字段

## 4. 验证

- [x] 对照当前实现修正 `auto-sector-group-draft` 中已发现的矛盾
- [x] 对 `auto-sector-group-one` 执行 `openspec instructions apply --change auto-sector-group-one --json`
- [x] 执行 `npm run build`
- [x] 执行 `git diff --check`
- [x] 本次是文档合并，不新增专项单元测试
- [x] `auto-sector-group-one` 已自包含来源文档的有效内容；旧 source change 目录后续可删除或归档，不再作为需求依据

# 来源任务明细

## 来源任务：旧三文档合并基线：auto-sector-group-merged

承接 auto-sector-group、auto-sector-group-link、auto-sector-group-enchanted 的核心算法、编辑态、bridge、assignment、confirm 与早期测试规划。

> 以下为来源任务明细，保留用于删除旧目录后的追溯；不作为当前 OpenSpec task 计数。

# 自动星区划分合并版 — 任务列表

## 1. 合并旧状态模型

- [source pending] 将 `GroupDraftInfo.recalcState` 完全替换为 `isPinned: boolean`
- [source pending] 移除 per-group `exclude` 入口和算法分支
- [source pending] 将 `disabledCoverageSectorMacros` 替换为 `excludedDefaultAssignmentSectorMacros`
- [source pending] 删除 `excludedDefaultConnectedGroupIds` 方案和所有读写逻辑
- [source pending] 确认非玩家 sector 不进入 `excludedDefaultAssignmentSectorMacros`

## 2. Hub Detection 与基础自动分组

- [source pending] 保持 container-only 容量统计，合并 `modules[]` 与 `constructions[]`
- [source pending] 保持 Tier 1 / Tier 2 / pure hub 判定
- [source pending] `groupCleanSlate()` 支持 `generateHubs`
- [source pending] `groupIncremental()` 使用每个已有 group 自己的 jumpRange
- [source pending] 保持等距 score 差距小于 30% 的存疑规则
- [source pending] 保持 Tier 2 超出覆盖跳数但 5 跳内自动吸收规则

## 3. MST 与 Bridge

- [source pending] `computeGroupGraph()` 支持固定连接边输入
- [source pending] Kruskal 只补充新边，不删除用户保留的 `connectedGroupIds`
- [source pending] `buildSectorPath()` 保持 cluster-aware 0/1 跳语义
- [source pending] `buildBridgePlanOptions()` 按玩家 sector component 生成 bridge unit
- [source pending] 单向 superhighway 导致不可往返时拆分 bridge unit
- [source pending] bridge 方案保留最大连通覆盖，最多展示前 5 个
- [source pending] 单 bridge 方案自动采用，多 bridge 方案进入 Col 3 gate
- [source pending] bridge draft group 确认后作为普通 group 持久化

## 4. SectorConfirmBar

- [source pending] 编辑态按 `桥接 | 节点 | 阈值 | 覆盖` 排列控件
- [source pending] 节点 checkbox 默认勾选
- [source pending] clean slate 且无 baseline/pinned 输入时禁用节点 checkbox
- [source pending] 节点关闭后禁用阈值与覆盖控件，并传入 `generateHubs=false`
- [source pending] 桥接和覆盖下拉内嵌三态“保留” checkbox
- [source pending] 结果态只读展示参数并只显示 [编辑]
- [source pending] 编辑态显示 [添加] [取消] [计算]

## 5. SectorHubAddMenu

- [source pending] 从 `MapBindSectorMenu` 复制并改造为 fixed overlay popup
- [source pending] 支持点击背景和 Esc 关闭
- [source pending] 支持隐藏“定位地图”按钮
- [source pending] 无搜索时只列玩家星区
- [source pending] 搜索时列全地图 sector，包含无玩家空间站 sector
- [source pending] 已是任意 group anchor 的 sector 不允许重复添加
- [source pending] 新增 hub draft 默认 `isPinned=true`、`baseline=false`、`isNew=true`
- [source pending] 新增 hub draft 可删除

## 6. SectorGroupList Unified Pill Rows

- [source pending] 移除 coverage/candidate/connected 三 tab
- [source pending] 同一 jump row 混排 coverage、candidate、connected pill
- [source pending] coverage 金色、candidate 半金色、connected 绿色
- [source pending] baseline coverage pill 仅用粗边框标记
- [source pending] 有玩家空间站显示实心点，无玩家空间站显示空心点
- [source pending] candidate 只在编辑态显示
- [source pending] 非 pinned group 的 pill 只读
- [source pending] per-group 覆盖/连接保留关闭时对应 pill 只读但仍显示

## 7. Coverage / Candidate 操作

- [source pending] coverage `×` 后从 active coverage 移出并成为 candidate
- [source pending] candidate `+` 后加入当前 group active coverage
- [source pending] candidate 已是其他 group active coverage 时显示 `→`
- [source pending] 点击 `→` 后转入当前 group，并从原 group active coverage 移出
- [source pending] jumpRange 增大只自动加入新增跳数层内可归属玩家 sector
- [source pending] jumpRange 缩小移出超出范围的 coverage
- [source pending] 已成为 hub anchor 的 sector 不显示为 coverage/candidate

## 8. Connection 操作

- [source pending] hub anchor 显示为绿色 connected pill
- [source pending] 5 跳内未连接 hub 显示 `+`
- [source pending] 已连接 hub 显示 `×`
- [source pending] `+` / `×` 双向同步 `connectedGroupIds`
- [source pending] 连接修改即时反映 UI
- [source pending] 自动连接仍使用桥接搜索跳数

## 9. Edit Baseline 与 Unpinned 行为

- [source pending] 进入编辑态时保存完整 baseline snapshot
- [source pending] [取消] 恢复 baseline snapshot
- [source pending] baseline group 不可真正删除
- [source pending] unpinned baseline group 保留展示但不参与计算
- [source pending] unpinned baseline hub 可进入其他 pinned hub coverage
- [source pending] unpinned baseline hub 被其他 group 吸收后设置 `enteredOtherGroupCoverage`
- [source pending] `enteredOtherGroupCoverage=true` 时禁止重新 pin

## 10. Col 3 Bridge 与 Assignment

- [source pending] 多 bridge 方案时 Col 3 只显示 bridge plan cards
- [source pending] bridge plan unit 显示 locale sector 名与连接节点 jump pill
- [source pending] 采用 bridge 后重新生成 ordinary assignment cards
- [source pending] hub anchor sector 不生成 ordinary assignment card
- [source pending] 当前覆盖范围命中的所有 group 均成为 option
- [source pending] 无当前命中时仅最小扩展距离层 group 成为 option
- [source pending] 扩展 option 不默认选中
- [source pending] excluded group 可手动选但不可默认
- [source pending] standalone 始终为最后 option 且不自动兜底
- [source pending] 用户选择普通 option 不改变 Col 3 card 身份和顺序

## 11. 确认写入

- [source pending] [确定] 只在所有未决 assignment 已选择后启用
- [source pending] `createAutoGroups` UUID 优先、`sectorMacro` 兜底匹配已有 group
- [source pending] 移除不在 draft 中的废弃 group
- [source pending] 按最终 coverage 重建 `sector -> groupId`
- [source pending] 重分配 `stationPlans`
- [source pending] bridge/standalone/hub draft 都作为普通 `BindingSectorGroup` 写入
- [source pending] 非玩家 hub 沿用 `bindSectorGroup` tradeStation transit 逻辑
- [source pending] 确认后隐藏 confirm bars 并切换 Col 3 资源视图

## 12. i18n 与样式

- [source pending] 添加节点、保留、添加 hub、转入、连接、断开相关中文 key
- [source pending] 添加对应英文 key
- [source pending] 删除或停止引用旧三 tab 文案
- [source pending] 确认 popup、pill、checkbox 在窄屏下不重叠

## 13. 测试与验证

- [source pending] 更新 unit 测试覆盖 `isPinned`、excluded default、all-hit option
- [source pending] 更新 unit 测试覆盖 MST 固定边与 bridge unit component
- [source pending] 更新 unit 测试覆盖 standalone ID 复用和非玩家 hub transit
- [source pending] 增加 E2E 覆盖 `test.md` 中规划的关键 case
- [source pending] `npm run test:unit -- tests/unit/auto-sector-group/autoGroup.spec.ts` 通过
- [source pending] `npm run build` 通过

## 来源任务：Map 集成增量：auto-sector-group-map

补充 Map binding-sector 层的面板复用、focus-sector、compact UI、拖拽排序与生产入口替换。

> 以下为来源任务明细，保留用于删除旧目录后的追溯；不作为当前 OpenSpec task 计数。

# 自动星区划分接入 Map — 任务列表

## 1. Presenter 抽取

- [source done] 创建 `src/components/empire/presenters/useAutoSectorGroupPresenter.ts`
- [source done] 将 `SectorOverviewPanel.vue` 中所有 `ref()` / `computed()` / 核心方法迁移到 presenter
- [source done] 重构 `SectorOverviewPanel.vue`：移除直接 store import，改为通过 presenter 获取所有状态和方法

## 2. liveProductionStore 自动检查

- [source done] 新增自动分组检查 flag 状态（含 gameGuid/reason）
- [source done] 刷新/切换 binding/archive timing 切换后触发检查
- [source done] presenter 监听 flag 并消费 + 清除

## 3. 子组件 view prop 适配

- [source done] `SectorGroupList.vue` 新增 `view: 'map' | 'live'` prop + map 紧凑样式
- [source done] `SectorGroupList.vue` map view 下 pill 点击 emit `focus-sector`
- [source done] `SectorGroupList.vue` 集成 `vuedraggable`（`:draggable` prop 控制）
- [source done] `SectorGroupCard.vue` 抽取 group card 为独立组件
- [source done] `SectorGroupCard.vue` 完成态 station binding 图标按钮（旧 MapBindingSectorGroup 图标）
- [source done] `SectorAllocationList.vue` 新增 `view` prop + map 紧凑 + `focus-sector` emit
- [source done] `SectorConfirmBar.vue` 新增 `view` prop + map 紧凑 + `showConfirm`/`confirm` prop/emit

## 4. Map wrapper 创建

- [source done] 创建 `AutoSectorGroupMapPanel.vue`（双分支：确认态 / 未确认态 tab）
- [source done] Hub/分配方案 tab 切换，编辑态禁用分配方案 tab
- [source done] 完成态不显示 tab/AllocationList，group 上显示 station binding 按钮
- [source done] `focus-sector` 事件 relay 到 MapSavePanel → MapWorkbenchView
- [source done] `HubAddMenu.vue` 创建为独立内联组件（使用 `useSectorNameFilter` 复刻原 MapBindSectorMenu 功能）
- [source done] `onCalculate`：计算后若有存疑自动切到分配方案 tab
- [source done] 确认态分支支持编辑（补全事件处理 + `:editable` 联动）

## 5. Map 面板替换

- [source done] `MapSavePanel.vue` 替换 `MapBindingSectorGroup` → `AutoSectorGroupMapPanel`
- [source done] 清理 `MapBindingPanel.vue`
- [source done] `MapBindingSectorGroup.vue` 保留作为对照参考

## 6. Live overview 适配

- [source done] 保持三列布局，live 编辑态仅分配区域显示遮罩
- [source done] 确认态不显示 SectorAllocationList，资源面板无遮罩

## 7. 排序持久化

- [source done] `groups` 数组顺序为排序权威，`order` 仅按 index 兼容写入

## 8. i18n

- [source done] `auto_sector.hub_tab` / `allocation_tab` / `edit_overlay_hint` 中英文
- [source done] `map.binding_search_results` 中英文

## 9. 类型清理

- [source done] `X4MapSector.macro` 移除（数据中始终为 null），全部替换为 `s.id`

## 10. Bug 修复

- [source done] `handleAddHubDraft`：添加 hub 时从其他 group coverage 中移除该 sector
- [source done] 确认态 SectorConfirmBar/SectorGroupList 缺事件处理 → 补全
- [source done] `handleEnterEdit` 不再改变 `autoGroupConfirmed`
- [source done] vuedraggable `:force-fallback="true"` 恢复滚轮滚动
- [source done] `X4MapSector.macro` 移除，全部替换为 `s.id`
- [source done] HubAddMenu 全地图搜索：`s.id` 作为标识符，接入 `useSectorNameFilter`
- [source done] HubAddMenu 双模式：`inline`（Map） / `overlay`（Live）
- [source done] 删除 `SectorHubAddMenu.vue`，Live 改用 `HubAddMenu mode="overlay"`
- [source done] Map 添加枢纽按钮 toggle：打开/取消添加
- [source done] i18n `sector.cancel_add_hub` 中英文

## 11. Stat Bar 重构

- [source done] SectorConfirmBar 两行布局，live/map 各异
- [source done] 参数持久化到 `SaveBindingPlan`（`normalizeState` 同步更新）
- [source done] 刷新初始化默认值：bridgeRetain=false, coverageRetain=true, node=有group则false
- [source done] 进入编辑：全局 retain 同步到 card；取消/计算：card 任一 checked → 全局 checked
- [source done] 编辑态不重置 retain 值
- [source done] `editSnapshot` 补充 retain/node 字段
- [source done] `handleQuickCalculate` 尊重 checkbox 当前值

## 12. Map 面板挂载与 Tab 切换

- [source done] Map panel mount 时设置 `activeViewStore.activeBinding` + 调用 `activateBinding`
- [source done] 初始 auto-calc 有存疑→切 allocation；只触发一次
- [source done] `[计算]` 后存疑→allocation，无存疑→hub

## 13. 构建验证

- [source done] `npm run build` 通过


## 未解决

- [source pending] vuedraggable 完成态仍可拖拽（v-if/v-else 分支切换后 Sortable.js 事件残留）

## 来源任务：Hub 颜色增量：auto-sector-group-color

补充 hub color 自动分配、用户色卡、持久化和地图染色。

> 以下为来源任务明细，保留用于删除旧目录后的追溯；不作为当前 OpenSpec task 计数。

# Hub 色卡与地图染色 — 任务列表

## 1. 数据模型

- [source done] `BindingSectorGroup` 添加 `color?: string`（`src/types/x4.ts`）
- [source done] `GroupDraftInfo` 添加 `color?: string`（`src/store/logic/autoGroup.ts`）
- [source done] `normalizeState()` 保留 `color` 字段（`src/store/useSaveBindingStore.ts`）

## 2. 色板与分配算法

- [source done] 创建 `src/store/logic/hubColor.ts`，定义 `HUB_PALETTE`（30 色）、`HUB_COLORFUL`（27 色）
- [source done] 实现 `stabilizeHubColors()`：先固定满足约束的已有颜色，再重分配缺色/新增/冲突 hub；用户选择的预设颜色不视为不可更改颜色
- [source done] 实现 [计算] 后到提交前的单 hub 颜色稳定流程：新增 hub 或调整覆盖星区时，只判断并可能重分配当前 hub
- [source done] 实现 Stage 1 自身 faction 避色：
  - 定位星区、覆盖星区 faction 色均参与避色
  - ownerless、缺失 owner_color、无法解析颜色不参与避色
  - 阈值按 ΔE ≥ 20→15→10→5→0 放宽，直到至少 5 个候选或无进一步放宽空间
- [source done] 实现 Stage 2 5 跳 hub 避色：
  - 仅考虑 5 跳以内 hub，允许与 5 跳外 hub 颜色重复
  - 避色输入包含 5 跳内已固定/已分配 hub 颜色与其中央/定位星区 faction 色
  - 阈值按 ΔE ≥ 20→15→10→5 放宽，并用 maximin 选最优
- [source done] 实现随机颜色 fallback，仅在无可解析候选时使用
- [source done] 导出颜色稳定/分配函数供 presenter 使用

## 3. 计算集成

- [source done] `runCalculationFromEditInput()` 或等效流程中，计算完成后调用颜色稳定流程
- [source done] Clean slate / Incremental 首次分组时也调用颜色稳定流程
- [source done] [计算] 后保留满足约束的已有自动颜色；对缺色、新增、或与自身/5 跳内约束冲突的 hub 重分配
- [source done] 从已保存 binding 恢复为 result 时不单独补色；缺色 group 等待下次 [计算] 后补色
- [source done] [计算] 后到提交前，因覆盖计算新增覆盖星区时：新增覆盖星区 faction 色与当前 hub 颜色 ΔE > 5 不触发当前 hub 重分配；ΔE ≤ 5 时仅重分配当前 hub
- [source done] [计算] 后到提交前，新增 hub 时只为新增 hub 分配颜色；单次操作不得自动改变超过一个 hub 的颜色
- [source done] 用户通过色卡调整的预设颜色可持久化，但后续 compute 发现冲突时可以修改

## 4. SectorGroupCard 色卡控件

- [source done] `group-title-row` 中 group name 右侧添加 16×16 色块
- [source done] 有颜色填充，无颜色虚线边框
- [source done] 编辑态点击弹出 SketchPicker（`vue-color`），10×3 色板 + SV 取色区
- [source done] 非编辑态色块不可点击
- [source done] 点预设色块 → 更新 `group.color` + dismiss popover
- [source done] 点透明预设 → 清空 `group.color` 为 undefined，不保存 `0x00000000`
- [source done] 点外部 / Esc → dismiss
- [source done] CSS 覆写 SketchPicker 布局、选中环
- [source done] `main.ts` 引入 `vue-color/style.css`

## 5. 地图星区染色

- [source done] `useMapSvgSectors.ts` 新增 `sectorGroupColorMap` 参数
- [source done] 构建 `sectorGroupColorMap` 时基于覆盖互斥约束：一个星区最多映射一个 hub 颜色，无需处理多 hub 优先级
- [source done] 对有 hub 颜色的星区，生成 2/3 半径内部六边形（无边框、仅填充）
- [source done] `group.color` 为 undefined 时不生成内部六边形
- [source done] `MapSectorLayer.vue` 在 faction owner 色之上渲染内部六边形
- [source done] 确保 resource pie 覆盖层在内六边形之上

## 6. i18n

- [source done] 添加色卡相关 tooltip key（zh-CN + en）

## 来源任务：Trade Station 增量：auto-sector-group-station

补充 hub trade station 候选、默认值、选择、gate、重置、保留与持久化。

> 以下为来源任务明细，保留用于删除旧目录后的追溯；不作为当前 OpenSpec task 计数。

# Tasks: Auto Sector Group - 贸易站选择

## 1. 类型与基础工具

- [source done] 1.1 创建 `src/store/logic/tradeStationSelection.ts`
  - `TradeStationCandidate` 类型
  - `TradeStationSelection` 类型（玩家站 code 或 UI/计算层 `__virtual__`）
  - `selectCandidates(sectorMacro, stations, modulesByMacroId, config)` — top 5 + pureHub 约束，支持 `requireQualified` 参数
  - `determineDefault(candidates)` — 默认值算法（空候选默认虚拟、第一名 pureHub 优先、mixed 非 pureHub 第一名留空、全生产站 30% 阈值）

## 2. GroupDraftInfo 扩展

- [source done] 2.1 `autoGroup.ts` — `GroupDraftInfo` 新增 `savedTradeStationCode?: string`、`tradeStationRetainEnabled?: boolean`
- [source done] 2.2 `autoGroup.ts` — `groupCleanSlate()` / `groupIncremental()` 生成 group 时初始化新字段

## 3. Presenter 扩展

- [source done] 3.1 `useAutoSectorGroupPresenter.ts`
  - `tradeStationCandidates: computed<Record<string, TradeStationCandidate[]>>`
  - `selectedTradeStations: ref<Record<string, TradeStationSelection | null>>`
  - `tradeStationRetainEnabled: ref`
  - `hasUnresolvedTradeStations: computed`
  - `unresolvedTradeStationGroups: computed<string[]>` — i18n keys
  - `handleSelectTradeStation(groupId, selection)`
  - `handleResetTradeStations()`
  - `handleMasterTradeStationRetain(enabled)`
  - `handleToggleTradeStationRetain(groupId)`
- [source done] 3.2 `handleConfirm()` — 遍历 groups 调 `upsertTradeStation()`
- [source done] 3.3 `handleConfirm()` — 玩家站持久化为 `saveStationCode`，虚拟站 `__virtual__` 持久化为 `saveStationCode: undefined` 且 position 为星区中心
- [source done] 3.4 `handleConfirm()` — 若既有 trade station 绑定玩家站，改选虚拟站时清除旧 `saveStationCode`
- [source done] 3.5 `handleResetAssignments()` — 仅重置 allocation，不影响 trade station

## 4. AllocationConfirmBar 改造

- [source done] 4.1 props: `hasUncertain: boolean` → `unresolved: string[]`
- [source done] 4.2 显示逻辑：`unresolved.length > 0 ? unresolved.map(k => t(k)).join(', ') : t('sector.all_resolved')`
- [source done] 4.3 新增或复用全局 disabled/gate props，确认按钮 disabled 必须覆盖 allocation、bridge、trade station 三类 unresolved

## 5. SectorConfirmBar 扩展

- [source done] 5.1 阈值/参数行新增 `tradeStationRetainEnabled` checkbox
- [source done] 5.2 新增 prop `tradeStationRetainEnabled` 和 emit `update:trade-station-retain-enabled`

## 6. SectorGroupCard 扩展

- [source done] 6.1 Edit 模式下每 group card 新增 `tradeStationRetainEnabled` 开关
- [source done] 6.2 显示 saved trade station 名称（如有）

## 7. 新 Vue 组件

- [source done] 7.1 `SectorTradeStationCard.vue`
  - props: `group`, `candidates`, `selected`, `disabled`
  - li 列表：候选站 radio（显示 score + containerCap）+ 虚拟交易站
  - 无玩家站时仅显示虚拟交易站并默认选中
  - emit `select`
- [source done] 7.2 `SectorTradeStationList.vue`
  - props: `groups`, `candidates`, `selected`, `disabled`, `view`
  - 遍历所有成为 hub 的 groups 生成 SectorTradeStationCard

## 8. Map 面板改动

- [source done] 8.1 `activeTab` 类型扩展为 `'hub' | 'allocation' | 'tradeStation'`
- [source done] 8.2 新增 TradeStation tab（与 Allocation tab 同级）
- [source done] 8.3 TradeStation tab 内放置 `AllocationConfirmBar` + `SectorTradeStationList`
- [source done] 8.4 Allocation tab 内 `AllocationConfirmBar` 传入 `unresolvedAllocationGroups`
- [source done] 8.5 tab 切换逻辑：allocation 解决后可手动切到 tradeStation
- [source done] 8.6 初始 auto-switch 逻辑调整

## 9. Live Col3 改动

- [source done] 9.1 Col3 未确认状态下改为 tab 结构（Allocation | TradeStation）
- [source done] 9.2 Allocation tab：`AllocationConfirmBar` + `SectorAllocationList`
- [source done] 9.3 TradeStation tab：`AllocationConfirmBar` + `SectorTradeStationList`

## 10. i18n

- [source done] 10.1 `en.json`
  - `sector.allocation_unresolved`: "Sector allocation unresolved"
  - `sector.trade_station_unresolved`: "Trade station assignment unresolved"
  - `sector.all_resolved`: "All resolved"
  - `auto_sector.trade_station_tab`: "Trade Station"
  - `sector.trade_station_retain`: "Retain Trade Station"
  - `sector.virtual_trade_station`: "Virtual Trade Station"
- [source done] 10.2 `zh-CN.json`
  - 对应中文翻译

## 11. 持久化与旧自动逻辑

- [source done] 11.1 调整 `createAutoGroups()` 或提交流程，避免旧逻辑根据 `hubStationCode` / fallback best station 自动写入 trade station 并覆盖用户选择
- [source done] 11.2 确认 `__virtual__` 只存在于 UI/计算层，不写入 `BindingSectorGroup.tradeStation.saveStationCode`
- [source done] 11.3 确认虚拟站提交可以清除已有玩家站 `saveStationCode`

## 12. Build 验证

- [source done] 12.1 `npm run build` 通过，无 compile error

## 来源任务：最新共享草案口径：auto-sector-group-draft

最终修正共享 draft 所有权、初始化生命周期、archive time 重算策略、Live 双模式与面板不自动计算规则。

> 以下为来源任务明细，保留用于删除旧目录后的追溯；不作为当前 OpenSpec task 计数。

# Binding 模式共享草案 — 任务列表

## 1. liveStore 扩展

- [source done] 导入 `AutoGroupResult` 类型
- [source done] 新增状态：`autoGroupResult`、`calculationMode`、`prefJumpRange`、`bridgeSearchJumpRange`、`prefThreshold`
- [source done] 新增 `needsAutoGroupRecalc` computed（从 `appliedAutoGroupArchiveTime` 和 archive time 计算）
- [source done] 明确所有状态为当前 active binding/archive 的唯一 draft 状态

## 2. SaveBindingPlan 扩展

- [source done] 新增 `appliedAutoGroupArchiveTime?: number` 字段
- [source done] `normalizeState()` 保留该字段

## 3. Presenter 改造

- [source done] 删除 6 个本地 ref 声明，改为从 `liveStore` 读取
- [source done] Presenter 改为使用 liveStore 共享 draft 作为唯一数据源，并保留面板交互编排
- [source done] handler 内统一通过 `liveStore.xxx` 属性读写共享状态，组件 ref 由 presenter 使用 `storeToRefs(liveStore)` 转出
- [source done] `handleColorChange` 移除 `updateGroup()` 调用
- [source done] `handleConfirm` 记录 `appliedAutoGroupArchiveTime`；不覆盖 `autoGroupResult`
- [source done] 「详情」按钮仅切换 `liveMode`，不触发计算

## 4. MapWorkbenchView 读取草案

- [source done] binding 模式下 `sectorGroupColorMap` 从 `liveStore.autoGroupResult` 计算
- [source done] 非 binding 模式回退到 `saveBindingStore.activeBinding`

## 5. 面板组件适配

- [source done] SectorOverviewPanel 从 presenter 拿到的 ref 是 liveStore 的
- [source done] AutoSectorGroupMapPanel → AutoSectorGroupPanel 重命名
- [source done] 新增 `layout?: 'tabs' | 'columns'` prop；columns 始终三列
- [source done] Map 模式进入 binding 阶段直接读取 `liveStore.autoGroupResult` 渲染

## 6. Live 面板模式切换

- [source done] `liveMode: 'display' | 'calculate'`
- [source done] 展示模式：`[存档3 | 星区4 | 资源5]`，列表从 `activeBinding` 读取
- [source done] 展示模式星区列表列顶部：桥接跳数、覆盖跳数、Hub 阈值（纯数值只读，从 store 读取）
- [source done] 计算模式：嵌入 `AutoSectorGroupPanel layout="columns"`
- [source done] 展示模式「详情」→ `liveMode = 'calculate'`（仅模式切换，不触发计算）
- [source done] 展示模式「地图」→ 跳转到 map binding 面板
- [source done] 确认 → `handleConfirm` → `@confirmed` → 展示模式
- [source done] 详情按钮红点：`liveStore.needsAutoGroupRecalc`
- [source done] 详情按钮置灰：`!liveStore.autoGroupResult`
- [source done] 展示模式不显示「计算」按钮

## 7. 构建验证

- [source done] `npm run build` 通过

## 8. Store 数据生成（双路径）

- [source done] 实现 `initAutoGroupDraft()` — store 初始化/上下文切换时调用
- [source done] 有变化 flag → 跑分组算法（`groupCleanSlate` / `groupIncremental`）→ 生成 `autoGroupResult`
- [source done] 没有变化 flag → 实现 `buildAssignmentsFromBinding()`：从 `activeBinding.groups` 为每个覆盖星区计算所有候选 group 构建 `SectorAssignment[]`
- [source done] Store 在 `activeBinding` 或 `selectedArchive` 切换时自动调用 `initAutoGroupDraft()`
- [source done] Live 面板「详情」按钮仅切换模式，不触发计算
- [source done] 计算模式「返回」→ 回到展示模式（不提交）
