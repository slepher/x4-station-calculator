# terraforming-view Design

## 当前架构

```
LiveProductionWorkbenchView
  └── useTerraformingPresenter
      ├── TerraformingSectorPanel
      ├── TerraformingTaskList
      └── TerraformingResourcePanel
```

相关文件：

```
src/components/empire/
├── LiveProductionWorkbenchView.vue
├── presenters/
│   └── useTerraformingPresenter.ts
└── terraforming/
    ├── TerraformingSectorPanel.vue
    ├── TerraformingTaskList.vue
    ├── TerraformingStatScale.vue
    └── TerraformingResourcePanel.vue

src/store/
├── useLiveProductionStore.ts
└── logic/
    ├── terraformingTaskResolver.ts
    └── terraformingRuntime.ts
```

## 当前数据流

### 1. 星区与 objective

- `useLiveProductionStore` 提供当前 selected cluster、runtime stats、completed projects、execution log
- `useTerraformingPresenter` 负责：
  - `clusterDisplayNames`
  - `clusterMatchesHq`
  - `objectivesProgress`
- `TerraformingSectorPanel` 只消费 presenter 输出

当前这一层的核心原则是：

- cluster 名称解析只做一次
- objective 文本解析只做一次
- objective 完成状态只基于当前 runtime state 计算，不在组件里重复判断

### 2. 项目列表

- `terraformingTaskResolver.ts` 负责根据当前 cluster、runtime stats 和 completed projects 生成 `TaskTree`
- `useTerraformingPresenter` 负责组装：
  - `taskTree`
  - `taskNodeDisplays`
  - `projectDisplayNames`
  - `statDisplayNames`
  - `statScaleModels`
  - `conditionScaleModels`
- `TerraformingTaskList` 只负责渲染和向上发出交互事件

这里当前最重要的设计约束是：

- task tree 保持纯结构
- 显示层翻译不回写 task tree
- Vue 组件不自己解释 blocked reason 或 stat condition 的底层语义

### 3. 执行序列

- `useLiveProductionStore` 维护 per-cluster `terraformingExecutionLog`
- `useTerraformingPresenter` 基于 execution log 和 runtime state 回放得到：
  - `executionTimeline`
  - `getCancelValidation(entryId)`
- `TerraformingResourcePanel` 渲染单条记录、展开明细并按需触发取消预演

右列当前的关键点不是“展示聚合结果”，而是“保留顺序和粒度”：

- execution log 是一等数据
- 每条 entry 都保留自己的 before/after snapshot
- 右列取消永远以 entry 为最小单位

## 当前 presenter 输出模型

`useTerraformingPresenter` 当前输出的核心模型可以分成四组：

### 星区侧

- `clusters`
- `selectedClusterId`
- `clusterDisplayNames`
- `clusterMatchesHq`
- `objectivesProgress`

### 任务树侧

- `taskTree`
- `taskNodeDisplays`
- `completedProjectCounts`
- `projectMap`
- `projectDisplayNames`

### 条件与状态侧

- `currentStats`
- `statDisplayNames`
- `statScaleModels`
- `conditionScaleModels`

### 执行序列侧

- `executionTimeline`
- `getCancelValidation(entryId)`

这些模型的职责边界当前已经固定：

- store 输出领域状态
- presenter 输出 UI 可直接消费的结构
- Vue 组件不再额外做 view model 转换

## 当前条件显示模型

### 统一条件区

当前任务节点中的条件区已经统一为一个 `condition-list`：

- stat 条件通过 `TerraformingStatScale` 显示
- 项目前置条件通过文本条目显示
- 两者共享同类容器视觉：
  - 深色背景
  - 细边框
  - 圆角
  - 一致的纵向间距

可用和阻塞前置条件只通过文字颜色区分，不再采用另一套布局。

当前这样设计的原因是：

- 避免 stat 条件与项目前置条件在视觉上被误读成不同层级
- 避免阻塞态回退到另一套纯文本布局
- 保持可用态和阻塞态之间只有“状态颜色差异”，没有“结构差异”

### 当前方块语义

`TerraformingStatScale` 现在有两种主要模式：

- `status`
- `condition`

两者都显示完整 value 色带。

关键点：

- 每格代表一个真实 `value`
- 当前值以前景实心/空心状态图表达
- `condition` 不再裁切为“只显示命中区”
- 命中条件区间通过外层连续片段边框表达

当前条件模式的目标不是“单独重绘一条需求条”，而是：

- 先复用完整状态图
- 再叠加条件命中范围

这样当前值和条件范围永远处在同一张图里。

### 命中区外框

当前命中区边框的实现方式是：

- 先把命中 value 按相邻关系切成连续片段
- 对每个连续片段分别绘制外框
- 外框横向 padding 当前与 `block-gap` 绑定
- 外框纵向留白较小，主要通过容器高度吸收，而不是继续放大边框本身
- 圆角按内部方块圆角和外框纵向留白共同计算

当前这套设计是为了分离两件事：

- 边框表示“条件命中范围”
- 容器表示“内容需要的实际高度”

### 无 ranges 的 stat

如果 stat 没有 `ranges`：

- 不画方块
- 直接显示数字
- 条件模式下显示当前值和需求文本

这条规则当前主要覆盖：

- `population`
- 其他将来可能出现的纯 value stat

## 当前交互模型

### 一次性项目

- 通过 toggle 完成或撤销
- 已完成后保留 `count = 1`

### 可重复项目

- 通过 `X4NumberInput` 调整次数
- 当前输入上界是轻量固定值 `99`
- 不再在 presenter 里预演未来总上限

这意味着当前输入层的职责已经收缩为：

- 提供编辑入口
- 不提前做昂贵未来预测
- 交给 runtime state 和 resolver 在交互后决定是否合法

### 撤销规则

- 中列项目计数撤销和右列单条 execution 撤销是两套不同粒度
- 右列单条 execution 撤销按 execution log 顺序重新校验后续记录
- 该校验是按需触发，不在列表首屏渲染时预计算

这里当前明确区分了两种撤销：

- 中列项目计数层面的撤销
- 右列 execution entry 层面的撤销

后者优先级更高，因为它保留真实顺序语义。

## 当前性能取向

当前实现已经做了几项关键收敛：

- 任务树构造不再在 resolver/presenter 阶段整树翻译
- `projectMaxCounts` 预测逻辑已移除
- 右列 `cancelValidation` 改为惰性计算

因此当前文档默认的设计前提是：

- 树构造返回纯结构
- presenter 负责显示层翻译与组装
- Vue 只消费 presenter 输出

额外还有一条默认前提：

- 如果后续继续优化性能，应优先优化 presenter 计算边界，而不是把逻辑再塞回 Vue 模板

## 效果区 (effect-list)

### 统一效果卡片

当前任务节点中新增统一 `effect-list`，三条来源收敛为同类视觉卡片：

- stat effects（如 `温度 +2`）
- rebates（如 `shiptech 10%`）
- sideEffects（如 `25% 概率: 触发 ind_refineries_retrofit, 毒性+1`）

每条 `effect-list-item` 使用与 `condition-dependency` 相同的布局（`rounded border px-2 py-1.5` + `flex gap`），但使用不同配色以区分条件区。

### 效果卡片语义

- stat 效果直接显示项目完成后的 stat 变化
- rebate 显示对应 `wareGroup` 或 `ware` 的名称和折扣比例，名称通过 `module_groups.json` 或 `wares.json` 的 `nameId` 经 i18n 解析
- sideEffect 完整显示概率、触发项目、stat 变化和回退
- 当项目已完成（`completedProjectCount > 0`）时，sideEffect 概率显示为 100%

### 全覆盖

effect-list 对所有项目节点生效（events + 普通节点 + 子节点），不再仅 events 组展示 sideEffects。

## 当前已知关注点

- 条件方块的视觉仍有继续微调空间，但语义模型已稳定
- 某些特殊星区仍需针对 runtime event、ignore stat、removed stat 做回归验证

## 执行序列面板详情

每条 entry 展开后按固定顺序展示以下 section：

### 材料需求

- 显示每个 ware 的**实际消耗量** (`actualAmount`)，格式: `name  ×1,234`
- ware 名称通过 `gameDataStore.waresMap` + `useX4I18n().translateWare()` 翻译
- 末尾汇总行: `Cr  XXX Cr`（即 `resources.price`）

### 返还

- 累计折扣产生的物质返量，独立 flat card
- 每个 ware: `floor(actualAmount × cumulativeRebate%)`
- 匹配逻辑: ware 的 `wareGroup` 经翻译后与累计折扣 key 比较

### 累计折扣

- 独立 card，纯百分比列表: `name  -value%`
- 不计算返量（属于未来交易折扣）

### 交付清单

- 舰船名 ×数量（名称从 `deliveryShips.nameId` 经 i18n 翻译）
- 每行标注单艘建造时间 `30s`
- 汇总行: `建造时间  HH:MM:SS`（并行建造总耗时）
- 并行公式: `ceil(Σ amount_i × buildDuration_i / totalSlots)`
- 无建造港时标题栏显示 `⚠ HQ 缺少 S/M 建造港`，不显示建造时间

### 建造 card

- 每栋建造港一行：`name  ×count`（名称从 `localizedModulesMap.localeName` 取 i18n）
- 槽位汇总行：`建造槽位  ×totalSlots`（`totalSlots = Σ count × buildProcessorCount`）
- 建造时间行：`建造时间  HH:MM:SS`（无建造港时不显示）
- S/M 无人机竞争同一槽位池，`totalTime = ceil(totalWork / totalSlots)`

### 建造港槽位计算

- HQ 有效模块来源: `effectivePlannedModules = maxSavedModules(plannedModules, archiveModules)`（来自 `live-planning-modules`），即 `max(planned, archive)` — archive 作为地板，planned 可超出（在建）
- live 模式下无 planned 覆盖时，等价于 `archiveCurrentTotalModules`（已建 + 建造中合并）
- 通过 `modulesMap[moduleId]` 查找 `X4Module`
- 筛选: `buildShipClasses.length > 0`（排除维护港，仅制造港）
- 槽位: `buildProcessorCount`（从 `module_macros.xml` 的 `buildprocessorconnection` 连接数提取）
- S/M 综合建造港: 8 个共享槽位（`buildShipClasses: [ship_m, ship_s]`）
- S/M 无人机竞争同一槽位池

### 状态变化

- stats: `name  before → after`
- 折扣变化: `折扣: name  0% → 10%`（before → after diff，delta=0 不显示）
- `rebateChanges` 由 entry 执行前后累计折扣的 diff 计算

## 当前已知关注点（续）

- 条件方块的视觉仍有继续微调空间，但语义模型已稳定
- 某些特殊星区仍需针对 runtime event、ignore stat、removed stat 做回归验证

## 当前已知关注点（续2）

目前设计上最不希望回退的几件事：

- 不要恢复整树预翻译
- 不要恢复 `projectMaxCounts` 预演
- 不要让条件区重新分裂为"stat 一套、前置一套"
- 不要让效果区回退为散落的文字渲染
