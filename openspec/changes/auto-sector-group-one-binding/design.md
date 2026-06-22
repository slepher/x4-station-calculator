# auto-sector-group-one-binding Design

## 架构

```text
useLiveProductionStore
  owns current shared draft
  owns initAutoGroupDraft()
  owns needsAutoGroupRecalc

useAutoSectorGroupPresenter
  reads store refs
  assembles UI state
  orchestrates explicit user actions

Vue panels
  render and emit
```

Store 是共享 draft 的所有者。Presenter 可以保留交互 handler，但不得创建第二份跨面板共享数据。

## Store 状态

```ts
autoGroupResult: ShallowRef<AutoGroupResult | null>
calculationMode: Ref<'result' | 'edit'>
prefJumpRange: Ref<number>
bridgeSearchJumpRange: Ref<number>
prefThreshold: Ref<number>
calcBaselinePillState: Ref<CalcBaselinePillState | null>
needsAutoGroupRecalc: Computed<boolean>
```

Presenter 仍可持有 UI 辅助状态，但共享草案不得离开 live store。当前设计保留以下 presenter-local 状态：

- `calculationBaseline`: 最近一次初始化或显式计算后的重置快照。
- `nodeEnabled`: 下一次计算是否允许生成新 pure hub。
- `bridgeRetainEnabled` / `coverageRetainEnabled` / `tradeStationRetainEnabled`: 顶部主保留开关。
- `showHubAddMenu`: 添加 hub 菜单显示状态。
- `activeTab`: AutoSectorGroupPanel 内的 `hub | allocation | tradeStation` 当前页。

`needsAutoGroupRecalc`：

```ts
appliedAutoGroupArchiveTime === undefined
  || appliedAutoGroupArchiveTime < selectedArchive.meta.time
```

## 初始化

`initAutoGroupDraft()`：

1. 无 active binding 或 selected archive 时清空 draft。
2. `needsAutoGroupRecalc=true`：
   - binding 有 groups：incremental。
   - binding 无 groups：clean slate。
3. `needsAutoGroupRecalc=false`：
   - `buildAssignmentsFromBinding()`。
   - 不运行 grouping algorithm。
   - 不改变 group 结构。
4. 富化本地化名称、颜色上下文、trade station 展示状态。
5. 写入 `calcBaselinePillState`。
6. 设置 `calculationMode='result'`。

初始化只由 store 生命周期和 active context 切换触发。组件挂载和 tab 切换不得调用初始化。

## Snapshot 与基线

### calculationBaseline

`calculationBaseline` 是 [重置] 的数据源。

更新时间点：

1. `setAutoGroupResult(result)` 时克隆 `result` 写入。
2. Store 初始化或 active context 切换生成 result 后，经 `setAutoGroupResult()` 写入。
3. 用户显式 [计算] / [快速计算] 生成 result 后，经 `setAutoGroupResult()` 写入。
4. 确认成功后 SHOULD 更新为确认后的 result，避免 [重置] 回退到确认前。

使用点：

- [重置] 调用 `handleResetAssignments()`。
- `handleResetAssignments()` 从 `calculationBaseline` clone 恢复 `autoGroupResult`。
- 该恢复不改变 active binding、selected archive 或 liveMode。

### calcBaselinePillState

`calcBaselinePillState` 是 pill UI diff 基线，不是 [重置] 数据源。

更新时间点：

1. active binding/archive 初始化出第一份 result 时写入。
2. 显式 [计算] 不覆盖该基线。
3. 确认成功后更新为确认后的 groups。

用途：

- `SectorGroupList` 的 `baselineCoverageByGroupId`。
- `SectorGroupList` 的 `baselineConnectedGroupIdsByGroupId`。
- 用于粗边框、removed pill 等“与初始/已确认基线比较”的展示。

### 不再使用 edit restore snapshot

旧设计中的 `editSnapshot` / “取消恢复进入编辑前状态”不再作为最终口径。当前编辑态直接修改 shared draft：

- [编辑] 只设置 `calculationMode='edit'`。
- [退出] 只设置 `calculationMode='result'`。
- [退出] 不恢复 coverage、connection、assignment、trade station 或颜色。
- 用户若要回到最近计算结果，必须使用 [重置]。

## Presenter

Presenter 使用：

```ts
const liveStore = useLiveProductionStore()
const refs = storeToRefs(liveStore)
```

Handler 规则：

- 读写 `liveStore.autoGroupResult`。
- 计算按钮可以运行纯算法并更新共享 draft。
- 颜色修改只改共享 draft，不直接写 binding。
- 确认按钮执行最终持久化，并返回成功/失败状态给 panel。

## Button 行为

### 展示模式

| 按钮 | 行为 |
| --- | --- |
| 详情 | `liveMode='calculate'`，不计算 |
| 地图 | 进入 Map binding 面板，Map 复用 shared draft |

详情按钮状态：

- `needsAutoGroupRecalc=true` 时显示红点和 tooltip。
- `autoGroupResult=null` 时禁用。

### Live sidebar 入口

Live sidebar 在固定菜单和动态星区/站点列表之间的分隔线区域新增“星区编辑详情”入口。该入口是持久化 workbench 菜单项，而不是临时按钮：

- `ActiveViewState.activeBindingWorkbench` 新增星区编辑详情专用值，例如 `auto-sector-group`。
- 点击入口设置 `activeBindingWorkbench='auto-sector-group'`，由 `useActiveViewStore` 现有 `x4_station_active_view` 持久化。
- `useLiveProductionStore.workbenchMode` 将该值解析为星区编辑详情模式，并渲染 `AutoSectorGroupPanel layout="columns"`。
- 该模式进入详情/计算视图，但计算语义仍等同展示模式 [详情]。
- 不运行分组算法。
- 不调用 `initAutoGroupDraft()`。
- 不修改 binding 或 shared draft。
- `autoGroupResult=null` 时置灰禁用。
- `needsAutoGroupRecalc=true` 时显示红点提示。
- `activeBindingStation` 变化时，星区编辑详情必须加入固定模式保护列表，避免选择站点或星区后被自动改写为 `station` / `overview`。
- AutoSectorBar [返回] 或用户点击其他 sidebar 菜单时，应显式切回对应 workbench 值。

图标使用与 `blueprint.svg`、`tlt_research.svg` 一致的 128pt 单色 SVG 风格：粗圆环外框，内部用星区节点、连接线和编辑笔表达“星区分组编辑”。该入口只在 Live/save-binding sidebar 显示；Map binding 面板继续通过自己的 binding-sector 流程进入自动分组面板。

### AutoSectorBar

| 按钮/控件 | edit 模式 | result 模式 |
| --- | --- | --- |
| 返回 | emit `back`，Live 返回展示模式 | 同 edit |
| 地图 | emit `map`，进入 Map binding | 同 edit |
| 桥接跳数 | 更新 `bridgeSearchJumpRange`，不得小于覆盖跳数 | 可作为下一次计算参数 |
| 覆盖跳数 | 更新 `prefJumpRange`，必要时抬高桥接跳数 | 可作为下一次计算参数 |
| Hub 阈值 | 更新 `prefThreshold` | 可作为下一次计算参数 |
| 节点 | 控制下一次计算是否生成新 pure hub | 只作为下一次计算输入 |
| 计算 | 运行 `runCalculationFromEditInput()`，更新 result 和 `calculationBaseline` | 同 edit |
| 快速计算 | 运行同一计算路径 | 同 edit |
| 重置 | 从 `calculationBaseline` 恢复 | 同 edit |
| 提交 | edit 模式返回 false，不提交 | 通过 gate 后提交 |

### SectorGroupStatBar

| 按钮/控件 | 行为 |
| --- | --- |
| 编辑 | `calculationMode='edit'` |
| 退出 | `calculationMode='result'`，不恢复 draft |
| 添加枢纽 | 切换 `showHubAddMenu` |
| 桥接保留 | 同步所有 group 的 `connectionRetainEnabled` |
| 覆盖保留 | 同步所有 group 的 `coverageRetainEnabled` |
| 交易站保留 | 同步所有 group 的 `tradeStationRetainEnabled` |

### Confirm

`handleConfirm()` 返回 boolean：

- edit 模式：返回 `false`。
- 无 result：返回 `false`。
- trade station 未解决：返回 `false`。
- uncertain assignment 未解决且 popup 未打开：打开二次确认 popup，返回 `false`。
- 二次确认后或无 uncertain assignment：执行 `doConfirm()`，返回 `true`。

确认成功后：

1. 写入 groups、coverage、connections、colors、trade station。
2. 写入 `appliedAutoGroupArchiveTime`。
3. 保存 binding。
4. 同步 live flow。
5. 将 result groups 标记为 baseline。
6. 更新 `calcBaselinePillState`。
7. emit `confirmed`，Live 返回展示模式。

### Tab 自动切换

`switchToFirstUnresolvedTab()`：

1. pending bridge 或 uncertain assignment -> `allocation`。
2. unresolved trade station -> `tradeStation`。
3. 否则 -> `hub`。

触发时机：

- 初次 `autoGroupResult` 有 groups 时，仅执行一次。
- [计算] 后执行。
- [快速计算] 后执行。

## SaveBindingPlan

新增字段：

```ts
appliedAutoGroupArchiveTime?: number
bridgeSearchJumpRange?: number
prefJumpRange?: number
prefThreshold?: number
```

`normalizeState()` 必须显式保留这些字段。

## Live 双模式

### 展示模式

布局：`[存档 3fr] | [星区 4fr] | [资源 5fr]`

星区列顶部展示：

- 桥接跳数
- 覆盖跳数
- Hub 阈值
- 详情按钮
- 地图按钮

详情按钮只设置 `liveMode='calculate'`。

### 计算模式

布局：`[星区 5fr] | [分配 4fr] | [交易站 3fr]`

使用 `AutoSectorGroupPanel layout="columns"`。确认成功后 emit `confirmed`，Live 切回展示模式。

## Map 共享关系

Map 面板不拥有自己的 draft。进入 binding 阶段时读取 live store 共享 draft。Map 的具体 UI 和颜色渲染由 map change 定义。
