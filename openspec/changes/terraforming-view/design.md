# terraforming-view Design

## 架构

```
src/components/empire/
├── LiveProductionWorkbenchView.vue       # 修改: 3列占位 → 引入 TerraformingSectorPanel / TerraformingTaskList / TerraformingResourcePanel
├── terraforming/
│   ├── TerraformingSectorPanel.vue        # 新增: 左列星区 accordion + objectives
│   ├── TerraformingStatScale.vue          # 新增: 游戏方块式 stat/state/value 展示组件
│   ├── TerraformingTaskList.vue           # 新增: 中列分组任务树 + 交互
│   └── TerraformingResourcePanel.vue      # 新增: 右列执行序列面板
├── presenters/
│   └── useTerraformingPresenter.ts        # 修改: 新增 clusterDisplayNames / objectivesProgress / completedProjectCounts / executionTimeline / statScaleModels 等 computed
└── context_toolbar/
    └── TerraformingToolbar.vue            # 不变

src/store/
├── useLiveProductionStore.ts              # 修改: terraformingCompletedProjects 类型变更 Map<string, number>
│                                           # 新增 terraformingHousingBuilt ref
│                                           # 新增 terraformingHqClusterId computed
│                                           # 新增 terraformingCompletedProjectCounts writable computed
├── useGameDataStore.ts                    # 不变 (maps 已有 clusters 数据)
└── logic/
    └── terraformingTaskResolver.ts        # 修改: resolveAvailableTasks 适配 Map<string, number>

src/types/
└── production-workbench-contract.ts       # 不变
```

## 调用链

```
LiveProductionWorkbenchView (workbenchMode === 'terraforming')
  ├── TerraformingToolbar (不变)
  └── .main-layout (3:5:4 grid)
      ├── TerraformingSectorPanel (:col-span-3)
      │     └── useTerraformingPresenter → sectorPanel.props
      │           ├── clusterList (含 displayName / matchesHq / partName)
      │           ├── selectedClusterId (accordion 控制)
      │           └── objectivesProgress (展开内容)
      │
      ├── TerraformingTaskList (:col-span-5)
      │     └── useTerraformingPresenter → taskList.props
      │           ├── taskTree (分组树数据)
      │           └── completedProjectCounts (Map<string, number> 读写接口)
      │
      └── TerraformingResourcePanel (:col-span-4)
            └── useTerraformingPresenter → resourcePanel.props
                  ├── executionTimeline
                  ├── groupMarkers
                  └── cancelValidationPreview
```

## 数据流

```
maps.json (gameData.maps.clusters)
    ↓ nameId lookup
clusterDisplayNames (Presenter computed)
    ↓ i18n
Vue 渲染星区名

terraforming.json clusters[].objectives
    ↓ textId 翻译 + textReplaces 解析
objectivesProgress (Presenter computed)
    ↓
Vue 渲染 objectives 列表

terraforming.json projects + cluster.projectIds
    ↓ resolveAvailableTasks(cluster, state, data)
TaskTree { roots, blocked, groups, groupOrder }
    ↓
Presenter 组装 taskList.props
    ↓ stat ranges + conditions → conditionScaleModels
    ↓
Vue 渲染任务树

completedProjects: Map<string, number>
    ↓ 用户交互 toggle / x-number-input
re-resolve → 刷新 TaskTree
    ↓
→ 反馈到 objectivesProgress (已完项目影响 objective.build_project 判定)

completedProjects + 用户操作顺序
    ↓ Store / Presenter 维护 execution log
executionTimeline
    ↓ 逐条回放 runtime state
每条记录的 beforeStats / afterStats / resources / deliveries
    ↓
Vue 渲染右列执行序列
```

## 模块职责

### TerraformingSectorPanel.vue

- **Props**: clusters (含 displayName/matchesHq), selectedClusterId, objectivesProgress
- **Emits**: selectCluster(clusterId)
- **Behavior**:
  - 遍历 clusters 渲染 accordion header（名称 + partName + 当前星区 tag）
  - 当前展开项 = selectedClusterId 匹配的 cluster
  - 展开区域渲染 objectives 列表（step | 描述 | ✅/⬜）
  - 无选中时显示占位提示

### TerraformingTaskList.vue

- **Props**: taskTree, completedProjectCounts (Map<string, number>), groupNames
- **Emits**: toggleProject(projectId: string), setProjectCount(projectId: string, count: number)
- **Behavior**:
  - 按 groupOrder 分组渲染
  - 每组 header 显示 group 名称
  - 任务节点渲染: 状态图标 + 名称 + effects + 标签 + 依赖/阻塞
  - 仅“同组强制前置”形成父子树
  - “跨组强制前置”保留在自身 group 中显示，只作为依赖/阻塞信息展示
  - 对含 stat 条件的节点渲染 `TerraformingStatScale`，展示当前 state 与要求区间
  - 项目前置条件与 stat 条件进入同一个 `condition-list`
  - 前置条件不再单独显示为自由文本，而是使用与 stat 条件相同的边框/背景条目样式
  - 可用/阻塞前置条件使用同一文本格式，仅通过字体颜色区分状态
  - 一次性任务: 点击行 toggle → emit toggleProject
  - 可重复任务: 内嵌 `<XNumberInput :value="count" @change="setProjectCount(id, $event)" />`
  - 已完成节点带 `✅` 标记，阻塞节点灰色
  - 子节点缩进 (margin-left)
  - 无选中时显示占位提示

### TerraformingStatScale.vue

- **Props**:
  - `ranges`: stat 的完整 range 定义（含 start/end/state/rgb/habitable）
  - `currentValue`
  - `currentState`
  - `requirement`
  - `mode`: `'state-range' | 'value-range' | 'current-only'`
- **Behavior**:
  - 复现游戏中的一排彩色正方形方块，外观接近游戏内 terraforming UI
  - 每个方块对应一个实际 `value`，不是一个 `state`
  - 当前 stat 卡片显示完整 value 色带
  - 项目条件 / objective neutralize 也显示完整 value 色带，保持与 stat 卡片一致的空心/实心语义
  - 命中条件的 value 区间在完整色带外额外叠加连续片段外框
  - 外框与内部方块保留约 `2px` 间距，圆角需与方块圆角视觉匹配
  - 若一个命中的 state 覆盖多个 value，则必须展开显示该 state 对应的全部同色方块
  - 若 stat 没有 `ranges`（例如 `population` / `housing`），则不显示方块，改为显示数值与需求文本
  - 需求区间高亮：支持 state 区间、value 阈值、单点要求
  - 不再基于“是否满足条件”切换额外空心/实心逻辑，当前状态图本身已足够表达
  - tooltip 显示当前 value、当前 state，以及需求是 state 约束还是 value 约束

### TerraformingResourcePanel.vue

- **Props**: executionTimeline, projectDisplayNames, groupNames
- **Behavior**:
  - 不再渲染 tab
  - 逐条显示执行记录，顺序与用户真实点击顺序一致
  - 每条记录可展开，展示该次执行自己的资源 / 交付 / price / beforeStats / afterStats
  - 每条记录有单独取消入口
  - 取消合法性按需计算，不在 executionTimeline 渲染期对每条记录预先计算
  - 用户展开某条记录或点击撤销时，才触发该条记录的取消预演
  - 单条取消预演结果按 `entryId` 在组件侧缓存；execution log 变化后缓存整体失效
  - 相邻且同组的记录，仅在视觉上显示同组关系标记
  - 该标记只显示组名，不折叠、不合并、不隐藏任何记录
  - 无选中时显示占位提示

### 执行序列模型

右列的核心模型不再是聚合后的资源表，而是 `executionTimeline`：

```ts
type TerraformingExecutionEntry = {
  id: string
  projectId: string
  groupId: string
  ordinal: number
  resources: { wares: Array<{ ware: string; amount: number }>; price: number }
  deliveries: Array<{ macro: string; amount: number; buildDuration: number }>
  beforeStats: Record<string, number>
  afterStats: Record<string, number>
}
```

要求：

- 一次用户执行，对应一条 entry
- 可重复项目每次增加 1 次，对应新增一条 entry
- `completedProjects` 仍然保留为聚合态给 resolver 使用，但右列必须额外维护顺序化 execution log
- execution log 是右列展示、取消、重放校验的唯一来源
- 取消合法性不属于 executionTimeline 的固定字段，而是按 entry 触发的惰性预演结果

### 相邻同组标记

执行序列允许标记“相邻同组关系”，但不是结构聚合：

- 若 `entry[i].groupId === entry[i-1].groupId`，则该条记录显示该连续段的组名标记
- 一旦中间插入其他组记录，同组关系立即断开
- 后续再次出现同组项目时，视为新的连续段
- 标记只显示组名，不显示数量、汇总资源、汇总交付
- 标记不改变单条记录的展开、取消和校验粒度

### 取消与后续校验

取消某条执行记录时，不是简单地把聚合 count 减 1，而是：

1. 从 executionTimeline 中移除目标 entry
2. 从头按剩余 executionTimeline 顺序重新回放 runtime state
3. 对每条后续 entry 重新检查：
   - stat 条件
   - predecessors
   - blockedProjects / blockedGroups
   - removedProjects
   - runtime project pool 中该项目是否仍存在
4. 若后续记录不再合法，必须把失效信息返回给右列，而不能静默吞掉

本 change 先把需求固定为“必须做逐条后验校验”，具体 UI 采用：
- 阻止取消
- 允许取消并标红后续非法记录
- 允许取消并级联删除

留到后续实现设计再定，但文档要求必须明确暴露受影响记录列表。

### useTerraformingPresenter (增量)

新增 computed/props:

```
clusterDisplayNames: Map<clusterId, string>
  → cluster.macro → strip 'macro.' → maps.clusters[id].nameId → i18n

clusterMatchesHq: Record<clusterId, boolean>
  → terraformingHqArchiveStation.sector.id
  → maps.sectors[sectorId].cluster_id
  → === cluster.macro (去掉 macro. 前缀)

objectivesProgress: Array<{
  step, action, text (i18n 翻译后),
  completed: boolean,
  targetVariable?: string
}>
  → cluster.objectives[].forEach → 按 action 判定 completed

statScaleModels: Map<statId, {
  ranges,
  currentValue,
  currentState,
  colorBlocks
}>
  → 基于 terraforming-data 的 `ranges.start/end/state/rgb`

conditionScaleModels: Map<projectId, Array<{
  statId,
  mode: 'state-range' | 'value-range',
  requirement,
  currentValue,
  currentState
}>>
  → 基于 condition 的 `usesStateBounds/usesValueBounds` 组装

runtimeProjectPool: {
  visibleProjectIds: Set<string>,
  hiddenProjectIds: Set<string>
}
  → 基于 cluster 初始项目 + 动态项目规则 + 当前 runtime stats 重新计算
  → Presenter / TaskResolver / Vue 共用，不允许某层单独静态缓存

completedProjectCounts: Map<string, number> (writable computed)
  → 绑定 store.terraformingCompletedProjects

statDisplayNames: Map<statId, i18nName> (computed)
  → data.stats[].nameId → resolveTerraformingText → stats 卡片翻译

projectDisplayNames: Map<projectId, i18nName> (computed)
  → data.projects[].nameId → resolveTerraformingText → 依赖标签翻译

executionTimeline: Array<{
  id,
  projectId,
  groupId,
  ordinal,
  beforeStats,
  afterStats,
  resources,
  deliveries
}>
  → 按真实执行顺序组装
  → 每条记录单独展开/取消
  → 相邻同组仅做 groupName 视觉标记

getCancelValidation(entryId): TerraformingCancelValidation
  → 右列按需计算单条记录的取消预演结果
  → 不在 executionTimeline computed 中预先为每条记录执行后验校验
```

### 交互行为

- **条件阻止完成，不阻止撤销**: toggle/`X4NumberInput` `:disabled` 仅当 `!node.available && count === 0`
- **完成即永久**: 无级联撤销，完成的项目永不自动取消，永不变灰（`blocked` CSS 仅对 `count === 0` 生效）
- **输入上界**: `X4NumberInput` 不再预演 terraforming 项目的未来总可执行上限
  - Presenter 不为 `:max` 重建 task tree 或预演未来状态
  - 当前实现使用轻量上界 `99`
  - 真实执行有效性仍由 execution log 与 runtime state 在交互后决定
- **effect clamp**: runtime stat 计算中的 `effect.change × count` 受 `min/max` 约束 + 整体 floor 0
- **ignore stat**: 若 cluster 显式忽略某 stat，则不显示该 stat 条件，也不参与可用性判定
- **执行日志**: 右列以单条执行记录为最小单位；取消、回放、校验都基于 execution log，而不是只看聚合后的 `completedProjects`
- **同组标记**: 右列仅对相邻且同组的记录显示组名标记，不折叠、不合并、不跨段重组

### Events 渲染

`group === 'events'` 的项目与普通项目分开渲染：

```
[Stats 卡片]
  ─── Events (⚠️) ───     ← 位于状态与项目之间
  ─── 项目任务树 ───
```

- Events 全部显示（含阻塞，灰色），阻塞事件显示触发条件
- 有 `effects` 的事件可交互（toggle/X4NumberInput）
- 无 `effects` 的事件仅显示副作用（`sideEffects[].chance + setback`），不可操作

### Per-Cluster 状态

### Store 层改动 (`useLiveProductionStore`)

```
terraformingCompletedProjectsByCluster: ref<Record<string, Map<string, number>>>
  → per-cluster: 切换星区自动切换对应数据
terraformingCompletedProjects: computed<Map<string, number>>
  → 读取当前 selectedClusterId 对应的 completedProjects
terraformingHousingBuilt: computed<number>
  → 读取当前 selectedClusterId 对应的 housingBuilt
terraformingSelectedClusterId: ref<string | null>
terraformingHqClusterId: computed<string | null>       # 新增
gameDataMaps: ComputedRef<X4Map>                       # 新增 (暴露 maps.clusters/sectors)
```

### terraformingCurrentStats 效果应用

```
terraformingRuntimeState:
  1. 从 cluster.initialStats 开始
  2. 应用已完成项目 effects（change 累加，value 直接设置，effect.min/max clamp）
  3. 基于 oxygen + methane + carbondioxide 重新派生 airpressure
     - floor((O2 + CH4 + CO2) / 4) + cluster AddedAtmoPressure
     - IgnoreAirPressure=true 时不派生、不显示、不参与判定
  4. 基于 methane / CO2 与 cluster GlobalWarmingLimit 应用 warming events
     - 直到稳定或达到 event / cluster 上限
  5. 基于当前 stats + Ignore 开关重算动态项目池
  6. 输出给 Presenter / resolver 的必须是同一份 runtime state
```

这里的关键约束是：**显示、可用性判定、objective 进度、项目存在性** 都必须消费同一份 `terraformingRuntimeState`。不允许再出现：

- Presenter 把缺失 stat 当 `0`
- resolver 把缺失 stat 当“忽略不检查”
- project list 仍然使用初始化时的静态项目池

### terraformingTaskResolver 适配

`resolveAvailableTasks()` 的 `state.completedProjects` 参数类型从 `Set<string>` 改为 `Map<string, number>`。

**any:true predecessor 处理**: `evaluateProject` 中 `anyPreds.some(p => completed)` → 满足任一个即解除阻塞，不再逐个 check。

**树构造优化**:
- `any:true` 前置不作为父子链（信息性依赖，仅标注 `⟸ 任一:`）
 - 仅“同组强制前置”形成父子链
 - 跨组强制前置不形成父子链，节点保留在自身 group 中
 - `topLevelNodeIds` = `roots ∪ blocked`，子节点不显示于 group 列表
- `blocked` 去重（`blockedSet` guard）
- predecessor 引用仅在该 cluster `projectIds` 中存在时有效

**blockedProjects/removedProjects**: 见 terraforming-data design。

### I18n 系统

所有 UI 文本使用 `terraforming.*` namespace + `i18n.global.t()`:

```
src/locales/{lang}.json:
  terraforming.sectorPanel/taskPanel/resourcePanel    面板标题
  terraforming.currentSector/selectCluster/...        UI 标签
  terraforming.oneTime/repeatable/cooldown            重复性标签
  terraforming.undo/complete                          操作按钮
  terraforming.min/max/current/depends/...            效果/阻塞标签
```

### effects/stats 名称 i18n

Presenter `walkNode` 后处理 taskTree 节点：
- `node.name` → `project.nameId` → `resolveTerraformingText`
- `node.effects` 中 stat 名用 `stat.nameId` 替换
- `node.blockedReason` 中 `depends:` 项目名 + stat 名翻译；`(removed)`/`(blocking)` 后缀通过 `vI18nLookup` 查 locale
- `groupNames` 通过 `vI18nLookup(nameId)` 翻译

### 交互行为

## 当前星区匹配逻辑

```
Presenter:
  const hqSectorId = terraformingHqArchiveStation.value?.sector?.id
  const hqClusterId = hqSectorId
    ? gameData.maps?.sectors?.[hqSectorId]?.cluster_id
    : null

  clusterMatchesHq[cluster.id] = cluster.macro.replace(/^macro\./, '') === hqClusterId
```

maps.json 中: sector 有 `cluster_id` 字段，cluster 的 key 如 `cluster_21_macro`。
terraforming cluster 的 `macro` 如 `macro.cluster_21_macro` → 去掉 `macro.` → `cluster_21_macro` → 直接比较。

## objective.neutralize 判定逻辑

```
function isStatNeutralized(statId, currentVal, stats):
  1. 找 stat 的 ranges，按 end 排序
  2. 找到 currentVal 落入的 range
  3. 如果该 range 的 state >= 2: true
  4. 否则如果 habitable !== false 且 state === 0: true（无害阈值，如 toxicity=0）
  5. 否则: false
```

动态 stats（如 toxicity）无 state >= 2 的 range，退而检查 state=0 + habitable !== false。

## state/value 展示规则

方案 A 约束：

- `terraforming-data` 只输出领域语义，不输出 view 专用 block model
- `terraforming-view` presenter 负责把 `ranges + currentValue + conditions` 组装成方块模型

具体规则：

1. `condition.min/max` → 按 state 区间高亮方块
2. `condition.minvalue/maxvalue` → 先把 value 阈值投影到落入的方块区间，再高亮
3. `effect.min/max` 不作为任务前置条件展示，只出现在效果摘要/tooltip 中，文案明确为“该效果本次最低/最高落点”
4. stat 卡片、项目条件、objective neutralize 三处都复用同一套 range→color 规则

## objective.build_project 判定

projectId 在 `completedProjects` 中且计数 > 0 → complete。

## 右列详细设计

### 数据职责拆分

- `store`
  - 继续维护 `completedProjects`
  - 新增按 cluster 隔离的 `terraformingExecutionLog`
  - 提供“追加一条执行记录”“删除某条执行记录”“按日志重放当前完成态”能力

- `presenter`
  - 将 execution log 转成右列可直接渲染的 `executionTimeline`
  - 计算每条记录的 before/after stats
  - 计算相邻同组标记
  - 生成取消预校验结果

- `vue`
  - 只负责按顺序渲染
  - 只负责展开/收起与点击取消
  - 不直接拼装资源聚合、合法性链条或同组关系

### 执行日志生成规则

- 一次性项目从 `0 -> 1` 时，日志追加 1 条
- 一次性项目从 `1 -> 0` 时，按目标项目记录删除
- 可重复项目每增加 1 次，追加 1 条
- 可重复项目每减少 1 次，必须删除最后一次对应执行记录，除非用户显式点右侧某条记录取消
- 右列单条取消优先于中间区聚合减数，因为右列保留了顺序语义

### 相邻同组标记算法

给每条记录计算：

```ts
showGroupMarker = index === 0 || timeline[index - 1].groupId !== timeline[index].groupId
```

含义：

- 若当前记录是该连续同组段的第一条，则显示组名
- 段内后续记录不重复显示组名
- 一旦被其他组打断，后续重新开始新段

### 取消校验输出

Presenter 在取消预演时至少产出：

```ts
type CancelValidationResult = {
  canCancel: boolean
  affectedEntryIds: string[]
  reasonsByEntryId: Record<string, string[]>
}
```

用于支持未来三类 UI 策略：

- 阻止取消并提示
- 允许取消但标记非法后续记录
- 允许取消并级联清理

当前详细设计只要求数据结构与校验链条准备到位，不强制先定具体交互文案。

## objective.build_housing 判定

`currentStats.population >= housingTarget`（取 cluster initial stats + 已完成项目 effects 累积的 population）。

## objective.relocate 判定

HQ archive station sector 的 `cluster_id` === terraforming cluster macro。

## objective 文本解析

objective 的 `textId` 如 `{1004,1091}` 或 `terraforming.project.xxx.name`:
- `{page,id}` 格式 → 从 locale 查找翻译
- `terraforming.xxx.name` 直接键 → 从 terraforming 专用 i18n 表查找

`textReplaces` 替换变量:
- `$STATION$` → `{20102,2011}` → i18n 为 "HQ"
- `$LOCATION$` → `{20003,210001}` → i18n 为 "鳞片之绿"
- `$AMOUNT$` → 数值字符串，如 "1000000000"

Presenter 层完成文本解析后输出 `text` 字段直接供 Vue 渲染。

## Known Limitations

### MD 动态事件未实现
详见 terraforming-data 文档。

### 空气压力公式
`airpressure = floor((O2 + CH4 + CO2) / 4)` — 动态计算未实现。

### 温室效应事件
`evt_globalwarming_*` 事件在运行时动态触发升温，静态工具无法模拟。

### research 解锁
4 项目需 `research_tf_tech`，`evaluateProject` 未检查。

### 副作用与概率
`sideEffects` (setback/spawn stat 修改)、project `chance` (成功率 < 100%) 均未实现。

### DLC 动态注入
Boron/Terran DLC MD 文件中的条件项目注入未纳入静态解析。
