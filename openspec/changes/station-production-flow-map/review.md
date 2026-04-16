# Review

## Scope

本次审核对象：

- `useLiveProductionStore`
- `StationProductionFlowMap`
- `empireFlowFacade`
- `liveProductionFlows`
- `LiveProductionWorkbenchView`
- `LiveTransitToolbar`
- 相关 presenter / contract 改动
- `tests/e2e/live-flow-map`

审核目标：

- 判断本次 live flow / transit hub 需求是否真正落地
- 找出行为级问题
- 直接给出修正办法

---

## Overall

结论：

- 重构部分有进展
- station 页 live flow 已接入一半
- transit hub 特殊规则**未完整实现**
- `liveFlowMap` 同步链路**未闭合**

因此当前成果**不能算完整完成需求**。

---

## Findings

## 1. Transit hub 无 archive 时，toggle 被直接禁掉，和需求相反

### 现状

`LiveProductionWorkbenchView.vue`：

- `transitCanToggle = transitHubContext.value?.hasArchiveTradeStation ?? false`

见：

- [src/components/empire/LiveProductionWorkbenchView.vue:111](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue:111)

`LiveTransitToolbar.vue`：

- 只有 `props.canToggle` 为真才渲染 toggle

见：

- [src/components/empire/context_toolbar/LiveTransitToolbar.vue:92](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/context_toolbar/LiveTransitToolbar.vue:92)

### 问题

需求明确是：

- 无 archive trade station
- 仍允许切 live
- 但只切 wareflow
- planner / materials 不切
- 按钮颜色保持 planning

当前实现变成：

- 无 archive trade station
- 连按钮都没有

这不是降级实现。  
这是直接违背需求。

### 改进办法

必须改成：

1. `transitCanToggle` 恒为 `true`
2. 是否 archive 只影响：
   - 切换后哪些面板变
   - 按钮颜色

建议直接改：

```ts
const transitCanToggle = computed(() => true)
const transitHasArchiveTradeStation = computed(() => transitHubContext.value?.hasArchiveTradeStation ?? false)
```

然后把“无 archive 时颜色保持 planning”交给 toolbar 的 `toggleVisualState`。

进一步定稿：

- 不要让 agent继续设计 transit toggle 路线
- 直接按上面写死
- transit 能否切换与 `hasArchiveTradeStation` 脱钩
- `hasArchiveTradeStation` 仅用于 special rule

---

## 2. Transit hub 只加了按钮，没有真正把三块面板接到 mode 分流

### 现状

当前 transit 区域仍然只读单一 `transitHubInput`：

- `TransitHubCenterDashboard`
- `TransitHubBuildPanel`
- `TransitHubMaterialsPanel`

都没有 planning/live 双输入。

见：

- [src/components/empire/LiveProductionWorkbenchView.vue:196](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue:196)
- [src/components/empire/LiveProductionWorkbenchView.vue:202](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue:202)
- [src/components/empire/LiveProductionWorkbenchView.vue:223](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/LiveProductionWorkbenchView.vue:223)

### 问题

现在按钮存在与否先不谈，核心问题是：

- 切 mode 后
- transit 三块面板实际数据仍走 planning 链

也就是说当前 transit toggle 主要是 UI 外观改动，不是行为改动。

### 改进办法

必须直接按以下执行，不再讨论替代路线。

#### Step 1: 在 store 中新增第二个 facade

`useLiveProductionStore` 中直接创建：

```ts
const planningFlowFacade = createEmpireFlowFacade({
  productionSource,
  activeEmpire: ref(null),
  activeBinding,
  sourceView,
  modulesMap: computed(() => gameData.modulesMap),
  waresMap: computed(() => gameData.waresMap),
  flowMap: stationProductionFlowMap
})

const liveFlowFacade = createEmpireFlowFacade({
  productionSource,
  activeEmpire: ref(null),
  activeBinding,
  sourceView,
  modulesMap: computed(() => gameData.modulesMap),
  waresMap: computed(() => gameData.waresMap),
  flowMap: liveFlowMap
})
```

理由：

- transit hub live mode 需要 live 版本的 `sectorInternalDataMap/sectorLinkCalcMap`
- 不能只改 filtering
- 不能在 view 层临时重算 sector 聚合

#### Step 2: 在 store 中新增 4 个方法

```ts
function getPlanningSectorInternalData(sectorId: string)
function getPlanningSectorLinkCalc(sectorId: string)
function getLiveSectorInternalData(sectorId: string)
function getLiveSectorLinkCalc(sectorId: string)
```

实现直接转发到两个 facade。

#### Step 3: 在 `LiveProductionWorkbenchView.vue` 增加四组 computed

1. planning input

```ts
const planningTransitHubInput = computed(() => ...)
```

2. live input

```ts
const liveTransitHubInput = computed(() => ...)
```

3. 当前 center dashboard 输入

```ts
const activeTransitHubInput = computed(() => {
  return mode.value === 'live' ? liveTransitHubInput.value : planningTransitHubInput.value
})
```

4. 当前 build/materials 输入

```ts
const activeTransitStorageModulePlans = computed(() => {
  if (mode.value !== 'live') return planningPlans.value
  if (transitHubContext.value?.hasArchiveTradeStation) return livePlans.value
  return planningPlans.value
})
```

#### Step 4: 组件接线改成

- `TransitHubCenterDashboard` 读 `activeTransitHubInput`
- `TransitHubBuildPanel` 读 `activeTransitStorageModulePlans`
- `TransitHubMaterialsPanel` 读 `activeTransitStorageModulePlans`

这样才能实现：

- 有 archive：三块都切
- 无 archive：只 center 切

#### Step 4.1: `storageModulePlans` 来源修正

这里之前的思路不正确。  
**live 模式下的 transit modules 不应从 grouping 计算“推导”出来。**

正确规则：

- planning 模式：
  - `TransitHubBuildPanel` / `TransitHubMaterialsPanel` 继续使用现有规划侧 `storageModulePlans`
  - 允许来自现有 `computeTransitHubGrouping(...)` 结果

- live 模式：
  - `TransitHubBuildPanel` / `TransitHubMaterialsPanel` 不应再使用“计算出的 storageModulePlans”
  - 应直接读取 archive trade station 的真实 storage modules

也就是：

- planning panel 显示“建议建造什么”
- live panel 显示“存档里实际有什么”

这两者语义不同，不能共用同一个“推导 storageModulePlans”来源。

#### Step 4.2: live transit modules 正确来源

在 `useLiveProductionStore` 的 `transitHubContext` 中已经有：

- `archiveModules`
- `buildingModules`

本次需求下，live transit build/materials 应直接使用：

- `archiveModules + buildingModules`

而不是：

- `computeTransitHubGrouping(...).storageModulePlans`

原因：

- `archiveModules` = 已有真实模块
- `buildingModules` = 在建/建造仓相关模块
- live 视图要表达“存档当前状态”
- 不能只看已建成，不看 build modules

#### Step 4.3: view 层接线定稿

应改为：

```ts
const planningTransitStorageModulePlans = computed(
  () => transitHubPlanningRef.value?.storageModulePlans || []
)

const liveTransitModules = computed(() => [
  ...(transitHubContext.value?.archiveModules || []),
  ...(transitHubContext.value?.buildingModules || [])
])

const activeTransitBuildModules = computed(() => {
  if (mode.value !== 'live') return planningTransitStorageModulePlans.value.map(p => p.item)
  if (transitHubContext.value?.hasArchiveTradeStation) return liveTransitModules.value
  return planningTransitStorageModulePlans.value.map(p => p.item)
})
```

然后：

- `TransitHubBuildPanel`
  - planning: 显示计算出的 `storageModulePlans`
  - live with archive: 不再使用 `TransitHubBuildPanel`
  - live without archive: 保持 planning 显示

- `ArchiveModuleList`
  - live with archive: 直接显示 `archiveModules + buildingModules`

- `TransitHubMaterialsPanel`
  - planning: 继续吃 planning modules
  - live with archive: 直接吃 `activeTransitBuildModules`
  - live without archive: 保持 planning modules

#### Step 4.4: 组件修改要求

要落地这个修正，不要改 `TransitHubBuildPanel` 成双输入组件。  
直接切组件。

1. planning build 区
- 继续使用 `TransitHubBuildPanel`
- props 不变
- 继续显示规划侧推导的 `storageModulePlans`

2. live build 区
- 直接改为使用 `ArchiveModuleList`
- props：
  - `modules = archiveModules`
  - `buildingModules = buildingModules`

建议接线：

```vue
<TransitHubBuildPanel
  v-if="mode !== 'live' || !transitHubContext?.hasArchiveTradeStation"
  :storage-module-plans="planningTransitStorageModulePlans"
/>

<ArchiveModuleList
  v-else
  :modules="transitHubContext?.archiveModules || []"
  :building-modules="transitHubContext?.buildingModules || []"
/>
```

说明：

- `mode === 'live' && hasArchiveTradeStation`
  - 切到 `ArchiveModuleList`
- 其他情况
  - 保持 `TransitHubBuildPanel`

3. `TransitHubMaterialsPanel`
- 继续只吃 `SavedModule[]`
- 不需要知道这些模块来自 planning 推导还是 archive/build 实况

#### Step 4.5: 展示方式定稿

这里不要再做额外 wrapper、额外边框、双区域并排。

正确行为：

- 同一块 build 区域
  - `planning` 显示 `TransitHubBuildPanel`
  - `live` 显示 `ArchiveModuleList`
- 同一块 `TransitHubMaterialsPanel` 区域
  - `planning` 显示 planning modules 的分析
  - `live` 显示 `archiveModules + buildingModules` 的分析

也就是：

- 直接切换组件/展示内容
- 不增加额外视觉容器
- 不再额外加边框区分 live/build

#### Step 4.6: 明确禁止

禁止以下错误路线：

- live transit build/materials 继续使用 `computeTransitHubGrouping(...).storageModulePlans`
- live 只显示 `archiveModules` 而丢掉 `buildingModules`
- 把 archive/build 实际 modules 和 planning 推导 modules 混成一套来源
- 为了偷懒继续复用 planning 侧推导结果冒充 live 实况
- 为 live 再额外包一层边框/外壳/二级容器
- 把 `TransitHubBuildPanel` 改成同时承担 planning 推导展示和 archive 实况展示

---

## 3. Transit toolbar 颜色规则没有实现“无 archive 但 live 时保持 planning 色”

### 现状

当前逻辑：

```ts
if (!props.canToggle) return 'disabled'
if (!props.hasArchiveTradeStation && props.mode === 'planning') return 'planning'
if (props.mode === 'live') return 'live'
return 'planning'
```

见：

- [src/components/empire/context_toolbar/LiveTransitToolbar.vue:51](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/components/empire/context_toolbar/LiveTransitToolbar.vue:51)

### 问题

无 archive 且 mode 已切到 `live` 时：

- 当前会返回 `live`
- 颜色变成 live 色

这和需求相反。  
需求是：

- 无 archive trade station
- 即使 mode 真实为 `live`
- 按钮颜色仍显示 planning 色

### 改进办法

直接改成：

```ts
const toggleVisualState = computed(() => {
  if (!props.canToggle) return 'disabled'
  if (!props.hasArchiveTradeStation) return 'planning'
  return props.mode === 'live' ? 'live' : 'planning'
})
```

这是最小正确修复。

如果还想增加提示，再加：

- `wareflow only`
- 或 tooltip

但颜色规则本身必须先修正。

同时补一句：

- `props.canToggle` 不再表示“是否有 archive”
- 它在 transit 下应恒为 `true`

---

## 4. `liveFlowMap` 只在初始化时同步一次，后续 planning settings 变化不会带动 live cache 更新

### 现状

`syncLiveFlowMap()` 只在初始化路径调用：

- [src/store/useLiveProductionStore.ts:61](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:61)
- [src/store/useLiveProductionStore.ts:1259](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:1259)
- [src/store/useLiveProductionStore.ts:1271](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:1271)

而 live compute 明确借用了 planning station settings：

- [src/store/useLiveProductionStore.ts:89](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:89)

但各种 settings / modules 修改路径只会重算 `stationProductionFlowMap`，不会重算 `liveFlowMap`。

见：

- [src/store/useLiveProductionStore.ts:559](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:559)
- [src/store/useLiveProductionStore.ts:609](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:609)
- [src/store/useLiveProductionStore.ts:808](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:808)
- [src/store/useLiveProductionStore.ts:857](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:857)

### 问题

如果 live mode 的定义是：

- modules 用 archive
- 但 settings 借 planning/binding

那 settings 变化后，live flow / live dashboard 就必须重算。  
否则 `liveFlowMap` 会陈旧。

### 改进办法

不要在每个 setter 里分别补一份 `liveFlowMap.compute`。  
那会继续复制逻辑。

更直接做法：

1. 抽一个最小 helper

```ts
function syncLiveFlowMapForStation(stationId: string) { ... }
```

2. 在以下变更后补调用：

- `settings` setter
- `updateStationSettingsDirect`
- `updateStationSettings(stationId, ...)`
- 任何会改变 live 计算输入的写路径

3. 若某次变更影响全局 source station set，再调用：

```ts
syncLiveFlowMap()
```

最小闭环版本：

- settings 变化 -> 重算当前 station 对应 live cache
- archive 上传/切换 -> 重算整套 live cache

直接执行建议：

- 先做 `syncLiveFlowMapForStation(stationId)`
- 不要先大规模改所有 setter
- 先接三条路径：
  - `settings` computed setter
  - `updateStationSettingsDirect`
  - `updateStationSettings(stationId, ...)`

这样能先闭合 live dashboard/live wareflow 最关键链路

### 说明

“archive 变化由上传动作主动触发”这个前提可接受。  
所以不要求 `selectedArchive watch` 本身重算。  
但 settings 变化这条链仍必须补闭。

---

## 5. `liveFlowMap` key 语义和文档目标不一致，目前仍是 `station.id` 而不是 archive code

### 现状

`syncLiveFlowMap()` 中：

- 查 archive record 用 `r.code === station.id`
- 写 cache 也用 `station.id`

见：

- [src/store/useLiveProductionStore.ts:67](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:67)
- [src/store/useLiveProductionStore.ts:91](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:91)

### 问题

这依赖了“plan.id 已简化为 saveStationCode”这个前提。  
当前这批提交里确实朝这个方向改了：

- [src/store/useSaveBindingStore.ts:353](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useSaveBindingStore.ts:353)

但这会留下两个风险：

1. 虚拟站 / 新建站仍是 `crypto.randomUUID()`
2. 代码里没有显式表达“live key = archive code”的意图

现在实现可跑，但可读性差。后续继续做 transit/live source 时容易误用。

### 改进办法

不要强行回退现状。  
直接补一个显式 helper：

```ts
function getLiveFlowKeyForStation(station: StationPlan): string | null
```

规则：

- 若 station 对应 archive record -> 返回 archive code
- 否则返回 null

然后 `syncLiveFlowMap()` 里改成：

```ts
const flowKey = getLiveFlowKeyForStation(station)
if (!flowKey) return
...
liveFlowMap.compute(flowKey, ...)
```

这样：

- 逻辑意图清楚
- 未来改 key 规则时不需要全文件搜改

---

## 6. E2E 覆盖只覆盖了 station 页，没有覆盖 transit hub 规则

### 现状

当前新增 e2e 只测：

- station planning modules 不含 auto-fill
- station live wareflow 显示 archive 真实产物

见：

- [tests/e2e/live-flow-map/live-flow-map.spec.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/tests/e2e/live-flow-map/live-flow-map.spec.ts:1)

### 问题

本次需求最复杂的部分其实是 transit hub：

- 有 archive -> 三块切
- 无 archive -> 只切 center
- 按钮颜色保持 planning

现在一条都没测。

### 改进办法

至少补 3 条 e2e：

1. `transit with archive`
- 点击 toggle
- center/build/materials 三块都变化

2. `transit without archive`
- toggle 可见且可点
- center 变化
- build/materials 不变

3. `transit without archive visual state`
- 切到 live 后
- toggle 文案为 live
- 样式仍是 planning 色

没有这三条，transit 需求很容易再次回退。

---

## Positive Changes

这些改动方向是对的：

1. `stationContext` 抽出
- view 不再直接到处读 `bindingStation/archiveStation`

2. `productionStationShared.ts`
- 开始收口一部分 active-station 共用逻辑

3. `liveProductionFlows.ts`
- 已把“source 构造”和“读取聚合”拆开
- 不再在 helper 内部隐式 compute

4. `StationProductionFlowMap`
- 已支持第二实例
- `skipAutoFill` 也已接入

这些都值得保留。  
问题主要在 live/transit 最后一层接线没闭合。

---

## Fix Plan

建议直接按这个顺序修：

### Step 1
- 修 transit toggle 可见性
- `transitCanToggle` 恒为 `true`

### Step 2
- 修 `LiveTransitToolbar` 颜色规则
- 无 archive 时固定 planning 色

### Step 3
- 在 `useLiveProductionStore` 增加：
  - `planningFlowFacade`
  - `liveFlowFacade`
  - `getPlanningSectorInternalData`
  - `getPlanningSectorLinkCalc`
  - `getLiveSectorInternalData`
  - `getLiveSectorLinkCalc`

### Step 4
- 在 `LiveProductionWorkbenchView` 增加：
  - `planningTransitHubInput`
  - `liveTransitHubInput`
  - `activeTransitHubInput`
  - `planningTransitStorageModulePlans`
  - `liveTransitStorageModulePlans`
  - `activeTransitStorageModulePlans`

### Step 5
- `TransitHubCenterDashboard` 改读 `activeTransitHubInput`
- `TransitHubBuildPanel` / `TransitHubMaterialsPanel` 改读 `activeTransitStorageModulePlans`

### Step 6
- 补 `syncLiveFlowMapForStation(stationId)`
- settings 变化后重算当前 live cache

### Step 7
- 补 transit hub e2e 三条

---

## Final Verdict

当前成果：

- 可作为阶段性重构成果
- 不能作为“需求已完成”的最终状态

主要原因：

- transit 特殊规则没落完
- live cache 同步链路没闭合
- 测试未覆盖最关键场景

建议：

- 先按本文件的 `Fix Plan` 收尾
- 再做最终验收
