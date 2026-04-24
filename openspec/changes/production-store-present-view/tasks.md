# Production Store Presenter View - 实现任务

## Tasks

- [x] Task 1: 公开导出 `archiveStation`，固定 live 领域对象边界
- [x] Task 2: 收窄 `context`，移除 `archiveModules` / `buildingModules`，消除 `stationContext` 中间层
- [x] Task 3: `stationState` 补齐 `modules` / `buildingModules` 统一字段，`activeStationState` 内完成 plan/live 切换
- [x] Task 4: 清理 `useBlueprintProductionStore` 的非必要 UI 职责
- [x] Task 5: 清理 `useLiveProductionStore` 的扁平 UI 组装残留
- [x] Task 6: 改造 `useProductionTabbarPresenter`
- [x] Task 7: 改造 `useProductionToolbarPresenter`
- [x] Task 8: 改造 `useProductionPlanningPresenter`
- [x] Task 9: 改造 `useProductionWareflowPresenter`
- [x] Task 10: 改造 `useProductionDashboardPresenter`
- [x] Task 11: 收缩 `BlueprintProductionWorkbenchView.vue`
- [x] Task 12: 收缩 `LiveProductionWorkbenchView.vue`
- [x] Task 13: 清理 panel-specific getter 与兼容层残留
- [x] Task 14: 为短暂残留旧入口建立静态告警门禁
- [x] Task 15: 构建验证

## Phase 1: 领域边界固定

### Task 1: 公开导出 `archiveStation`，固定 live 领域对象边界

- [ ] 将 `archiveStation` computed 加入 `useLiveProductionStore` 的 public return block
- [ ] 审查 `ArchiveStationData` 类型字段：`modules`、`building`（含 `building.modules`）、`cargo`、`reservation`、`sector`、`position` 等
- [ ] 为后续 live 专属字段（`workforces`、`tag`、`factoryGroup`、`productionProfile`、`profileName`）在 `ArchiveStationData` 中预留类型空间
- [ ] 禁止继续把 archive 领域字段先拍平到 `stationContext`
- [ ] 明确 `bindingStation`、`planningStationDraft` 与 `archiveStation` 的职责边界

### Task 2: 收窄 `context`，移除 `archiveModules` / `buildingModules`，消除 `stationContext` 中间层

- [ ] 从 `ProductionContextState` 类型中移除 `archiveModules` / `buildingModules` 字段
- [ ] 更新 `context` computed（live store 侧）：删除对 `stationContext.archiveModules` / `stationContext.buildingModules` 的引用
- [ ] `context` 的 `hasArchive` 判定保留（只表达“是否存在 archive”的判定结果）
- [ ] 消除 `stationContext` 内部 computed：将其剩余的附属字段（`stationCode`、`sectorName`、`sectorNameId`、`sectorResources`、`sectorSunlight`、`position`、`hasBinding`）合并到 `context` computed 直接组装
- [ ] 删除 `stationContext` computed 定义（`useLiveProductionStore.ts` 内）
- [ ] `visualMode` computed 中对 `stationContext.value?.hasArchive` 的依赖改为直接读取 `archiveStation.value` 判定

### Task 3: `stationState` 补齐 `modules` / `buildingModules` 统一字段

- [ ] 在 `ProductionStationState` 接口中新增 `modules: SavedModule[]` 和 `buildingModules: SavedModule[]`
- [ ] 在 `activeStationState` computed 中按 plan/live 切换填充：
  - plan：`modules = resolvedModules`（即 `plannedModules + autoIndustryModules + autoHabitationModules + autoInfrastructureModules`），`buildingModules = []`
  - live：`modules = archiveStation.value?.modules ?? []`，`buildingModules = archiveStation.value?.building.modules ?? []`
- [ ] 新增 `activeTransitState` computed（若尚未创建）：与 `activeStationState` 对称，负责 transit 模式的 plan/live 切换。从中取 `resolvedModules`、`modules`、`buildingModules`、`autoInfrastructureModules`、`productionFlows`。切换逻辑：plan 用 `planningFlowFacade`，live 用 `liveFlowFacade`
- [ ] `stationState` transit 分支改为从 `activeTransitState.value` 读取计算字段（不做计算、不做切换）
- [ ] `stationState` computed 从 `activeStationState` / `activeTransitState` 取出新旧字段，透传给 presenter
- [ ] transit 模式下（来自 `activeTransitState`）：`modules = resolvedModules`（infrastructure 结果），`buildingModules = []`

## Phase 2: Store 侧职责清理

### Task 4: 清理 `useBlueprintProductionStore` 的非必要 UI 职责

- [ ] 从 public return 中删除 `importModalOpen`（纯 UI 状态，由 ToolbarPresenter 自行托管 `ref<boolean>`）
- [ ] `titlePlaceholder` 检查：若为纯展示文案常量，移除；若可被 presenter 从 domain 对象派生，保留在 store 中并通过 presenter 暴露
- [ ] 禁止继续在 blueprint store 中新增 panel-specific getter
- [ ] 保证 blueprint store 只保留领域状态、计算结果与业务动作

### Task 5: 清理 `useLiveProductionStore` 的扁平 UI 组装残留

- [ ] 确认 `stationContext` 已被消除（Task 2 完成）
- [ ] 禁止继续通过扁平对象承接 archive 领域扩展
- [ ] `importModalOpen`：检查是否为 live store 的纯 UI 状态，若是则迁出
- [ ] 保证 presenter 能直接从 store 领域对象映射 UI
- [ ] 禁止新增 live workbench facade / view model

## Phase 3: Presenter 回收 UI 组装

### Task 6: 改造 `useProductionTabbarPresenter`

- [ ] 只从正式主接口与业务动作读取数据
- [ ] 停止依赖旧 panel-specific getter 主路径
- [ ] 保持 station / transit / overview tab 映射逻辑只存在于 presenter

### Task 7: 改造 `useProductionToolbarPresenter`

- [ ] 从 store 领域对象映射 toolbar props
- [ ] 将 archive/binding 相关显示映射收回 presenter
- [ ] 禁止 view 继续直接向 toolbar 透传零散 store 字段

**ToolbarPresenter 当前缺失的 props/emits（需要在合约和实现中补齐）：**

props 新增：
- [ ] `hasBinding: ComputedRef<boolean>` — 从 `bindingStation.value !== null` 判定
- [ ] `hasArchive: ComputedRef<boolean>` — 从 `archiveStation.value !== null` 判定（不再从 `context`）
- [ ] `hasActiveBinding: ComputedRef<boolean>` — 从 `activeBinding !== null` 判定
- [ ] `mode: ComputedRef<'planning' | 'live'>` — 从 `session.mode` 读取（plan/live 切换状态）
- [ ] `canToggle: ComputedRef<boolean>` — 从 `session.canToggle` 读取
- [ ] `importModalOpen: ComputedRef<boolean>` — `importModalOpen` 从 store 迁到 presenter 托管（或 presenter 新增 `ref<boolean>` 状态）

emits 新增：
- [ ] `toggleMode()`
- [ ] `openImport()`（当前是空函数 `() => {}`，需要真正打开 import modal）
- [ ] `closeImport()`

**Presenter 实现改动：**

- [ ] `stationCode` / `sectorName` / `sectorNameId` / `position` / `sectorResources` / `sectorSunlight` 当前从 `store.context.*` 读取。`context` 收缩后若这些字段仍留在 `context`（它们是合法的附加上下文），读取方式不变。若其中某些字段被移到了 `archiveStation`，则 presenter 改为从 `archiveStation` 读取。核心原则：archive 领域事实从 `archiveStation` 读；sector 位置信息继续从 `context` 读。
- [ ] `hasBinding` / `hasArchive` 不再从 `context.hasBinding` / `context.hasArchive` 读，改为 presenter 自己从 `store` 的领域对象判定

**ToolbarPresenterStore 合约新增字段：**
```typescript
export interface ToolbarPresenterStore {
  // ... existing ...
  archiveStation: ArchiveStationData | null       // 新增：用于判定 hasArchive
  bindingStation: StationPlan | null              // 新增：用于判定 hasBinding
  activeBinding: BindingData | null               // 新增：用于判定 hasActiveBinding
  toggleMode(): void                              // 新增
  importModalOpen: Ref<boolean> | boolean          // 新增：或由 presenter 自己托管
}
```

### Task 8: 改造 `useProductionPlanningPresenter`

- [ ] 从 `stationState` 与必要领域对象映射 planning props
- [ ] `liveModules` / `liveBuildingModules` 改从 `store.archiveStation` 读取（不再从 `context`）
- [ ] `hasArchive`：不再从 `store.context.hasArchive` 读，改为 presenter 自身从 `store.archiveStation !== null` 判定
- [ ] `PlanningPresenterStore` 合约新增 `archiveStation: ArchiveStationData | null`
- [ ] 处理 station / transit / live / planning 的显示差异
- [ ] 禁止在 view 中保留 planning 数据拼装逻辑

### Task 9: 改造 `useProductionWareflowPresenter`

- [ ] 从 `stationState` 读取主计算结果
- [ ] 将 view 中残留的 wareflow 展示拼装收回 presenter
- [ ] 统一交互行为到业务动作

### Task 10: 改造 `useProductionDashboardPresenter`

核心改动量最大，必须逐项执行：

- [ ] 移除以 `store.context.archiveModules` / `store.context.buildingModules` 为来源的 activeModules / activeBuildingModules 编排
- [ ] 统一从 `store.stationState.modules` / `store.stationState.buildingModules` 读取
- [ ] 删除 presenter 内对 `visualMode === 'live'` 的判断分支（不再自己选数据源）
- [ ] `workforceAuto` 在 live 下强制 `true` 的逻辑保持不变（这是 UI 行为决策，属于 presenter）
- [ ] archive 独有的 live 专属展示字段（后续 cargo、reservation、tag 等）直接从 `store.archiveStation` 映射
- [ ] 合约 `DashboardPresenterStore` 移除对 `context.archiveModules` / `context.buildingModules` 的声明（如果有）
- [ ] 确认 presenter 返回的 props 被正确消费

## Phase 4: View 收缩

### Task 11: 收缩 `BlueprintProductionWorkbenchView.vue`

当前已知问题（约 160 行）：

**逐行修复方式：**

| 行号 | 当前写法 | 修复方式 |
|---|---|---|
| 22-23 | `blueprintStore.activeEmpire` / `blueprintStore.loadEmpire(empireId)` | view 只负责监听 `activeViewStore.activeEmpire` 变化，调用 `blueprintStore.loadEmpire`。可保留（这是生命周期初始化，不是 UI 组装） |
| 28-29 | watch 内 `blueprintStore.activeEmpire?.id` / `blueprintStore.loadEmpire(newId)` | 同上，保留 |
| 34-35 | `importModalOpen` get/set 包裹 `blueprintStore.importModalOpen` | 删除。`importModalOpen` 已从 store 迁出（Task 4），ToolbarPresenter 自行托管。改为从 `toolbarPresenter.props.showImportModal.value` 读取 |
| 44 | `blueprintStore.activeStation` computed | 移入 presenter 或直接通过 `stationState` 获取。若仅用于 `createImportStation` 函数，则随该函数一起移入 presenter |
| 51 | `blueprintStore.createStation(name, type)` | 移入 ToolbarPresenter emits |
| 53 | `blueprintStore.getStationById(createdId)` | 移入 ToolbarPresenter emits |
| 94 | `:activeStationId="blueprintStore.activeStationId"` | 从 `toolbarPresenter.props.importStationId.value` 获取 |
| 97-99 | ImportPlanModal store 方法绑定 | 全部改为 `toolbarPresenter.emits.xxx` |

**view 内删除项：**
- [ ] `importModalOpen` computed（wrapper 包裹 `blueprintStore.importModalOpen`）
- [ ] `activeStation` computed
- [ ] `createImportStation` 函数

**view 最终保留：**
- `blueprintStore`：仅用于初始化、生命周期方法（`loadEmpire`）、传给 presenter 构造函数
- `activeViewStore`：仅用于监听 empire 切换
- presenter 创建（5 个）+ props/emits 透传
- 区域切换（来自 presenter）

### Task 12: 收缩 `LiveProductionWorkbenchView.vue`

当前已知问题（约 301 行，大量直接 store 访问）。逐行标注修复方式：

**区域切换分支 `v-if`**（全部用 `liveStore.session.workbenchMode`）：

| 行号 | 当前写法 | 修复方式 |
|---|---|---|
| 87 | `v-if="liveStore.session.workbenchMode === 'overview'"` | `v-if="toolbarPresenter.props.workbenchMode.value === 'overview'"` |
| 97 | `v-if="liveStore.session.workbenchMode === 'transit'"` | `v-if="toolbarPresenter.props.workbenchMode.value === 'transit'"` |
| 118 | `v-if="liveStore.session.workbenchMode === 'station'"` | `v-if="toolbarPresenter.props.workbenchMode.value === 'station'"` |
| 144 | `liveStore.session.workbenchMode === 'overview'` | `toolbarPresenter.props.workbenchMode.value === 'overview'` |
| 155 | `liveStore.session.workbenchMode === 'overview' \|\| ... === 'transit'` | 改用 `toolbarPresenter.props.workbenchMode.value` |
| 156 | `liveStore.session.workbenchMode === 'transit'` | 改用 `toolbarPresenter.props.workbenchMode.value` |
| 198 | `liveStore.session.workbenchMode === 'overview'` | 改用 `toolbarPresenter.props.workbenchMode.value` |

**Toolbar props 直接读 store**：

| 行号 | 当前写法 | 修复方式 |
|---|---|---|
| 87 | `liveStore.activeBinding` | `toolbarPresenter.props.hasActiveBinding.value`（ToolbarPresenter 新增 computed） |
| 97 | `liveStore.activeBinding` | 同上 |
| 108 | `:mode="liveStore.session.mode"` | `:mode="toolbarPresenter.props.mode.value"`（已在 ToolbarPresenter 中暴露） |
| 114 | `@toggle-mode="liveStore.toggleMode"` | `@toggle-mode="toolbarPresenter.emits.toggleMode"`（已在 ToolbarPresenter 中暴露） |
| 118 | `liveStore.activeBinding` | `toolbarPresenter.props.hasActiveBinding.value` |
| 126 | `:has-binding-station="liveStore.context.hasBinding"` | `:has-binding-station="toolbarPresenter.props.hasBinding.value"`（已在 ToolbarPresenter 合约中声明） |
| 127 | `:has-save-station="liveStore.context.hasArchive"` | `:has-save-station="toolbarPresenter.props.hasArchive.value"`（从 `archiveStation` 判定，不再从 `context`） |
| 128 | `:mode="liveStore.session.mode"` | `:mode="toolbarPresenter.props.mode.value"` |
| 129 | `:can-toggle="liveStore.session.canToggle"` | `:can-toggle="toolbarPresenter.props.canToggle.value"` |
| 134 | `@toggle-mode="liveStore.toggleMode"` | `@toggle-mode="toolbarPresenter.emits.toggleMode"` |
| 266 | `:force-workforce-auto="liveStore.session.visualMode === 'live'"` | 移入 DashboardPresenter：presenter 内部判断后直接产出 `forceWorkforceAuto` 布尔 prop |

**ImportPlanModal 直接读 store**（行 141-153）：

| 行号 | 当前写法 | 修复方式 |
|---|---|---|
| 142 | `:isOpen="liveStore.importModalOpen"` | `importModalOpen` 移至 ToolbarPresenter 作为 `showImportModal` |
| 144 | `liveStore.session.workbenchMode` | `toolbarPresenter.props.workbenchMode.value` |
| 146 | `:activeStationId="liveStore.activeStationId"` | 从 `toolbarPresenter` 获取 |
| 147 | `:activeStation` (view 内 computed `importModalActiveStation`) | 移入 ToolbarPresenter 的 `importPayload` props |
| 148 | `:createStation` | `toolbarPresenter.emits.createStation` |
| 149 | `:applyImportedStationPayload` | `toolbarPresenter.emits.applyImport` |
| 150 | `:updateStationModules` | `toolbarPresenter.emits.updateImportModules` |
| 151 | `:getStationById` | `toolbarPresenter.emits.getImportStation` |
| 93/138 | `@open-import="liveStore.importModalOpen = true"` | `@open-import="toolbarPresenter.emits.openImport"` |
| 152 | `@close="liveStore.importModalOpen = false"` | `@close="toolbarPresenter.emits.closeImport"` |

**StationPlanningPanelWrapper props**（行 221-231）：

| 行号 | 当前写法 | 修复方式 |
|---|---|---|
| 227 | `:mode="liveStore.session.mode"` | 删除。Wrapper 改为接收 `:show-archive="planningPresenter.props.visualMode.value === 'live'"` 布尔 prop |
| 228 | `:archive-modules="liveStore.context.archiveModules"` | `:archive-modules="planningPresenter.props.liveModules.value"`（已在 Presenter 中） |
| 229 | `:building-modules="liveStore.context.buildingModules"` | `:building-modules="planningPresenter.props.liveBuildingModules.value"`（已在 Presenter 中） |
| 230 | `:has-archive="liveStore.context.hasArchive"` | 删除。Wrapper 不再需要自己判定，直接接收 `showArchive` 布尔 |

**StationPlanningPanelWrapper 内部同步改动**：

- [ ] props 中删除 `mode: 'live' \| 'planning'` 和 `hasArchive?: boolean`
- [ ] 新增 `showArchive: boolean` prop
- [ ] `showArchivePanel` computed 改为 `computed(() => props.showArchive)`

**view 内 computed 清理**：

| computed | 处理 |
|---|---|
| `importModalActiveStation`（行 52-56） | 移入 ToolbarPresenter |
| `showArchiveModuleList`（行 65-67） | 保留不动——已全部从 presenter 读取 |

**view 最终保留**：
- `liveStore`：仅用于打开 binding（`openBinding`）、初始化直播 store、传给 presenter 构造函数
- `activeViewStore`：仅用于监听 `activeBinding` 变化
- `gameData`：仅用于传给 `useEmpireWareFlowDerived`（view-local composable）
- presenter 创建（5 个）+ props/emits 透传
- `session.workbenchMode` 区块切换（值来自 presenter）

## Phase 5: 旧入口清理

### Task 13: 清理 panel-specific getter 与兼容层残留

- [x] 删除旧 `getToolbarXxx/getPlanningXxx/getDashboardXxx/getWareflowXxx` 主路径（若存在）
- [x] 删除或停止导出兼容层
- [x] 禁止新增新的按面板命名主 getter

### Task 14: 为短暂残留旧入口建立静态告警门禁

- [x] 对短暂残留旧入口加 `@deprecated`
- [x] 配置静态检查让调用点触发告警
- [x] 将静态告警纳入门禁
- [x] 验证新增旧入口调用会被工具指出

## Phase 6: 构建验证

### Task 15: 构建验证

- [x] 运行 `npm run build`
- [x] 修复本次重构引入的编译错误，直到构建通过或出现明确阻塞
- [x] 记录构建结论
