# Production Workbench Refactory Plan

## Decision Summary

本方案直接定稿。

最终采用的结构是：

1. `useBlueprintProductionStore` 和 `useLiveProductionStore` 直接实现统一的功能性 `ProductionWorkbenchStoreContract`
2. 顶层 view 直接把 store 传给 `useProductionXxxPresenter`
3. presenter 负责把 store contract 组装成 `tabbar/toolbar/planning/wareflow/dashboard` 的 UI props 和 actions
4. 不引入 `createBlueprintProductionSource()` / `createLiveProductionSource()` 这类薄抽象
5. `addGapModule/removeGapModule` 不再单独存在，统一收敛为 `addModule/removeModule`

## Hard Decisions

### D1. store 只提供功能性 contract

store contract 只暴露：

- 业务状态读取
- 功能动作
- capability

store contract 不暴露：

- `tabbar`
- `toolbar`
- `planning`
- `wareflow`
- `dashboard`
- `importing`

这些区域级组装全部属于 presenter。

### D2. presenter 负责区域组装

`useProductionXxxPresenter` 负责：

- 读取 store contract
- 做区域级 props shape 映射
- 绑定 UI handlers
- capability 到可见性/禁用态的映射

presenter 不负责：

- 重新计算 step 2
- 决定 station / sector / empire 过滤边界
- 直接操作具体 store 实现细节

### D3. 不引入 source adapter

不创建：

- `createBlueprintProductionSource()`
- `createLiveProductionSource()`

理由已经固定：

- store 自己实现公共 interface 就足够
- 再包一层不会降低复杂度
- 真正需要收口的是 presenter 组装，而不是 store 转发

### D4. station 级 step 2 不过滤

station 级 step 2 必须吃完整 `productionFlows`。

过滤只允许发生在：

- sector 级聚合
- empire 级聚合

### D5. 删除的是 step 2 自动模块回写，不是显式用户动作

必须保留：

- `addModule`
- `removeModule`
- `toggleWareLock`
- `toggleWarePriority`

必须移除：

- `StationWareFlowsDashboard` 主动提交 step 2 自动模块变化
- `useWareFlowDerived` 通过 watch 把 step 2 自动模块写回 store 的职责

说明：

- `addGapModule/removeGapModule` 不再单独存在
- 星区运营 / 星区补给按钮如果仍需要显示，最终调用的也是 `addModule/removeModule`
- 是否属于 gap 来源是 presenter / UI 上下文语义，不再单独成为 store action

### D6. 顶层 view 文件目标形态

最终两个文件必须收缩为：

- 选择 store
- 创建 presenter
- 渲染子组件

这两个文件不再保留：

- 大段 `handleXxx`
- 大段 `computed(() => store.xxx)`
- 大段业务状态手工组装
- 大段 empire gap 转换

## Final File Layout

### New Files

以下文件是本次重构后必须存在的：

```text
src/components/empire/presenters/useProductionTabbarPresenter.ts
src/components/empire/presenters/useProductionToolbarPresenter.ts
src/components/empire/presenters/useProductionPlanningPresenter.ts
src/components/empire/presenters/useProductionWareflowPresenter.ts
src/components/empire/presenters/useProductionDashboardPresenter.ts
src/types/production-workbench-contract.ts
```

### Existing Files To Keep

保留并继续使用：

```text
src/store/useBlueprintProductionStore.ts
src/store/useLiveProductionStore.ts
src/components/empire/BlueprintProductionWorkbenchView.vue
src/components/empire/LiveProductionWorkbenchView.vue
src/components/empire/StationPlanningPanel.vue
src/components/empire/StationWareFlowsDashboard.vue
src/components/empire/StationDashboard.vue
src/store/logic/stationComputeService.ts
```

### Existing Files To Remove Or Stop Using

以下文件/职责必须退出主路径：

```text
src/components/empire/composables/useStationPlanningPanelModel.ts
src/components/empire/composables/useStationWareFlowsModel.ts
src/components/empire/composables/useStationDashboardModel.ts
src/components/empire/composables/useContextToolbarModel.ts
src/components/empire/composables/useStationTabBarModel.ts
src/components/empire/composables/useWareFlowDerived.ts
```

处理规则：

- 可以分阶段保留文件
- 但主路径必须切到 `useProductionXxxPresenter`
- `useWareFlowDerived.ts` 的 store 回写职责必须彻底停止

## Final Contracts

以下 contract 为定稿，其他 agent 直接按这个做。

## 1. Store Root Contract

文件：

`src/types/production-workbench-contract.ts`

```ts
export interface ProductionWorkbenchStoreContract {
  mode: 'blueprint' | 'live'
  capabilities: ProductionWorkbenchCapabilities

  getTabs(): ProductionTabItem[]
  getActiveTabId(): string | null
  getExpandedSectorId(): string | null
  getWorkbenchMode(): 'overview' | 'station' | 'transit'
  getActiveStationId(): string | null
  getActiveTransitSectorId(): string | null

  getTitleModel(): {
    value: string
    placeholder: string
  }
  getToolbarStation(): {
    id: string
    name: string
    type: StationType
    count: number
    minerals: string[]
  } | null
  getToolbarSettings(): StationSettings | null
  getToolbarRaces(): Array<{ value: string; label: string }>
  getToolbarStationTypes(): Array<{ value: StationType; label: string }>
  getAvailableMinerals(): string[]
  getSingleBerthThroughput(): number

  getPlannedModules(): SavedModule[]
  getAutoModules(): SavedModule[]
  getEnforceDlcActivation(): boolean

  getWareflowViewMode(): WareFlowViewMode
  getGroupedFlows(): GroupedFlows
  getWareflowSettings(): {
    resourceBufferHours: number
    primaryProductBufferHours: number
    secondaryProductBufferHours: number
    buyMultiplier: number
    sellMultiplier: number
    racePreference: string
    showEmpireGaps: boolean
    transportMinutes?: number
  }
  getEmpireGaps(): {
    operations: EmpireGapItem[]
    supply: EmpireGapItem[]
  }

  getStationAnalysis(): StationAnalysis
  getDashboardSettings(): {
    transportShipCapacity: number
    workforceAuto: boolean
    manualWorkforce: number
    useHQ: boolean
  }
  getCurrentEfficiency(): number
  getActualWorkforce(): number
  getBuildPriceMultiplier(): number

  isOverview(): boolean
  getProductionSource(): 'empire' | 'save-binding'
  getImportActiveStationId(): string | null
  getImportActiveStation(): { id: string; modules: SavedModule[] } | null

  selectOverview(): void
  selectTransit(sectorId: string): void
  selectStation(stationId: string): void
  expandSector(sectorId: string | null): void

  createStation(name?: string, type?: StationType): string | null
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): string | null
  deleteStation(stationId: string): void

  updateTitle(value: string): void
  updateStationName(value: string): void
  updateStationType(value: StationType): void
  updateStationCount(value: number): void
  toggleMineral(mineral: string): void
  updateSunlight(value: number): void
  updateTransportMinutes(value: number): void
  updateRacePreference(value: string): void
  updateWorkforce(value: boolean): void
  updateShowEmpireGaps(value: boolean): void

  updatePlannedModules(modules: SavedModule[]): void
  addModule(moduleId: string, options?: ProductionAddModuleOptions): void
  removeModule(target: ProductionRemoveModuleTarget): void
  updateModuleCount(index: number, count: number): void

  updateViewMode(value: WareFlowViewMode): void
  updateResourceBufferHours(value: number): void
  updatePrimaryProductBufferHours(value: number): void
  updateSecondaryProductBufferHours(value: number): void
  updateBuyMultiplier(value: number): void
  updateSellMultiplier(value: number): void
  toggleWareLock(wareId: string): void
  toggleWarePriority(wareId: string): void

  updateTransportShipCapacity(value: number): void
  updateBuildPriceMultiplier(value: number): void
  updateManualWorkforce(value: number): void
  updateWorkforceAuto(value: boolean): void
  updateUseHQ(value: boolean): void

  openImport(): void
  applyImportedStationPayload(stationId: string, payload: ImportPayload): void
  updateStationModules(stationId: string, modules: SavedModule[]): void
  getStationById(stationId: string): { id: string; modules: SavedModule[] } | null

  isWareLocked(wareId: string): boolean
  getResolvedLevel(wareId: string): number
  isWareOperable(wareId: string): boolean
  isPlannedWare(wareId: string): boolean
}
```

## 2. Capability Contract

```ts
export interface ProductionWorkbenchCapabilities {
  uniqueWorkbench: boolean
  uniqueStation: boolean
  hasSectors: boolean
}
```

语义固定如下：

- `uniqueWorkbench`: workbench 记录唯一，不能新建同类 workbench
- `uniqueStation`: station 记录唯一，不能新建 / 复制 / 删除
- `hasSectors`: 具备星区层级与星区相关 UI/行为

## 3. Module Action Types

```ts
export interface ProductionAddModuleOptions {
  source?: 'planning' | 'gap'
  wareId?: string
}

export type ProductionRemoveModuleTarget =
  | { index: number; source?: 'planning' }
  | { moduleId: string; source: 'gap'; wareId?: string }
```

明确要求：

- store 直接平铺返回功能数据，不再额外定义 `ProductionSelectionState/ProductionToolbarState/...`
- store 不返回组件 props
- `autoModules` 是最终给 UI 的自动模块列表
- UI 不再区分 step 1 / step 2
- store 内部可以继续保留 step 1 / step 2 边界
- `source: 'gap'` 只是调用上下文标记，不再单独设计 `addGapModule/removeGapModule`

## Presenter Decisions

以下 presenter 为定稿，其他 agent 不需要再做命名讨论。

### P1. useProductionTabbarPresenter

输入：

- `store: ProductionWorkbenchStoreContract`

输出：

- `props: StationTabBarProps`
- `actions`

presenter 负责：

- 从 `getTabs/getActiveTabId/getExpandedSectorId/getWorkbenchMode/getActiveStationId/getActiveTransitSectorId` 组装 tabbar props
- 用 `capabilities.uniqueWorkbench` / `capabilities.uniqueStation` 决定创建、复制、删除按钮可见性
- 绑定 `selectOverview/selectTransit/selectStation/createStation/renameStation/duplicateStation/deleteStation/expandSector`

### P2. useProductionToolbarPresenter

输入：

- `store: ProductionWorkbenchStoreContract`

输出：

- `props: ContextToolbarProps`
- `actions`

presenter 负责：

- 读取 `getTitleModel/getToolbarStation/getToolbarSettings/getToolbarRaces/getToolbarStationTypes/getAvailableMinerals/getSingleBerthThroughput`
- 结合 `getWorkbenchMode()` 决定 overview / station / transit 的 toolbar 展示差异
- 绑定标题、station 信息与 settings 操作

### P3. useProductionPlanningPresenter

输入：

- `store: ProductionWorkbenchStoreContract`

输出：

- `props: StationPlanningPanelProps`
- `actions`

presenter 负责：

- 读取 `getPlannedModules/getAutoModules/getEnforceDlcActivation`
- 把 `plannedModules/autoModules/enforceDlcActivation` 组装给 `StationPlanningPanel`
- 绑定 `updatePlannedModules/addModule/removeModule/updateModuleCount`

### P4. useProductionWareflowPresenter

输入：

- `store: ProductionWorkbenchStoreContract`
- `gameDataStore`

输出：

- `props: StationWareFlowsDashboardProps`
- `actions`

presenter 负责：

- 读取 `getWareflowViewMode/getGroupedFlows/getAutoModules/getWareflowSettings/getEmpireGaps`
- 读取 `getWorkbenchMode()` 和 `capabilities.hasSectors`
- 做 `wares/modulesMap` 文本翻译和轻量 shape 映射
- 将星区运营 / 星区补给按钮动作绑定到 `addModule/removeModule`

presenter 不允许：

- 对 station 级 step 2 做过滤
- 重新计算 step 2
- 重新发明 `gap module` store action

### P5. useProductionDashboardPresenter

输入：

- `store: ProductionWorkbenchStoreContract`

输出：

- `props: StationDashboardProps`
- `actions`

presenter 负责：

- 读取 `getStationAnalysis/getDashboardSettings/getCurrentEfficiency/getActualWorkforce/getBuildPriceMultiplier`
- 绑定 `updateTransportShipCapacity/updateBuildPriceMultiplier/updateManualWorkforce/updateWorkforceAuto/updateUseHQ`

## Store Changes Required

其他 agent 必须按下面做，不要自行换方案。

### S1. useBlueprintProductionStore

必须直接实现 `ProductionWorkbenchStoreContract`。

明确要求：

- 不再暴露 `workbench.tabbar/workbench.toolbar/...` 这类预组装区域 contract
- 可以保留现有内部 getter/computed/action
- 但对 presenter 的公共入口必须是统一功能接口

### S2. useLiveProductionStore

同上，直接实现 `ProductionWorkbenchStoreContract`。

### S3. Step 2 store responsibility

store 必须承担：

- step 2 结果派生
- station 级完整 `groupedFlows`
- 自动模块最终列表

store 不再依赖 `useWareFlowDerived` 去 watch 后回写。

### S4. Empire filtering responsibility

只有 empire/sector 聚合路径允许过滤。

允许继续保留在：

- `useEmpireWareFlowDerived`
- 其他 empire facade

禁止回流到 station 级 store contract。

### S5. Module action unification

必须完成：

- 删除 `addGapModule/removeGapModule` 作为独立 store contract 的设计
- 统一以 `addModule/removeModule` 表达显式模块变更

要求如下：

- planning 区添加模块：`addModule(moduleId, { source: 'planning' })`
- wareflow gap 区添加模块：`addModule(moduleId, { source: 'gap', wareId })`
- planning 区移除模块：`removeModule({ index, source: 'planning' })`
- wareflow gap 区移除模块：`removeModule({ moduleId, source: 'gap', wareId })`

是否需要按 `source` 做埋点或额外逻辑，属于 store 内部实现，不再外泄成两个动作名。

## View Changes Required

### V1. BlueprintProductionWorkbenchView.vue

最终文件必须只做：

1. 获取 `blueprintStore`
2. 创建五个 presenter
3. 渲染子组件

明确不再保留：

- 大段 gap 数据映射
- 大段 settings 路由函数
- 大段子组件 props 手工组装

### V2. LiveProductionWorkbenchView.vue

与 blueprint 同样处理。

### V3. MainWorkbench.vue

不需要感知 presenter 细节。

只负责按 active view 切换：

- `BlueprintProductionWorkbenchView`
- `LiveProductionWorkbenchView`

## Migration Order

这个顺序是定稿，其他 agent 不要自行调整。

### Phase 1. 类型先行

1. 创建 `src/types/production-workbench-contract.ts`
2. 写入 `ProductionWorkbenchStoreContract` 及 module action 类型
3. 修改两个 store，使其实现统一功能 contract，但暂不删旧逻辑

### Phase 2. presenter 接线

1. 创建五个 `useProductionXxxPresenter`
2. presenter 直接消费 `ProductionWorkbenchStoreContract`
3. 与旧的 `useStationXxxModel` 并行存在

### Phase 3. 顶层切线

1. `BlueprintProductionWorkbenchView.vue` 改为只消费 `blueprintStore`
2. `LiveProductionWorkbenchView.vue` 改为只消费 `liveStore`
3. 用五个 presenter 替换现有 `useStationXxxModel`

### Phase 4. 清理

1. 删除或废弃旧 `useStationXxxModel`
2. 删除 `useWareFlowDerived` 在站点主路径中的职责
3. 删除顶层遗留的手工 `handleXxx` / `computed`

## Concrete Tasks

以下任务可直接派发给其他 agent。

## Agent A: Contract Typing

- [ ] A1. 创建 `src/types/production-workbench-contract.ts`
- [ ] A2. 定义 `ProductionWorkbenchStoreContract`、`ProductionWorkbenchCapabilities`、module action 类型
- [ ] A3. 调整 `src/types/production-ui.ts`，让 UI props/emits 与 presenter 输出对齐

## Agent B: Blueprint Store Contract

- [ ] B1. 在 `useBlueprintProductionStore.ts` 中实现 `mode` 和 `capabilities`
- [ ] B2. 实现 contract 中全部 `getXxx()` 数据读取接口
- [ ] B3. 将顶层选择、toolbar、planning、wareflow、dashboard、import 动作统一挂到 store contract
- [ ] B4. 删除独立 `addGapModule/removeGapModule` contract 设计，改为 `addModule/removeModule`

## Agent C: Live Store Contract

- [ ] C1. 在 `useLiveProductionStore.ts` 中实现 `mode` 和 `capabilities`
- [ ] C2. 实现 contract 中全部 `getXxx()` 数据读取接口
- [ ] C3. 将顶层选择、toolbar、planning、wareflow、dashboard、import 动作统一挂到 store contract
- [ ] C4. 删除独立 `addGapModule/removeGapModule` contract 设计，改为 `addModule/removeModule`

## Agent D: Presenters

- [ ] D1. 创建 `useProductionTabbarPresenter.ts`
- [ ] D2. 创建 `useProductionToolbarPresenter.ts`
- [ ] D3. 创建 `useProductionPlanningPresenter.ts`
- [ ] D4. 创建 `useProductionWareflowPresenter.ts`
- [ ] D5. 创建 `useProductionDashboardPresenter.ts`
- [ ] D6. presenter 输入全部改为 `ProductionWorkbenchStoreContract`
- [ ] D7. wareflow presenter 中把 gap 按钮绑定到 `addModule/removeModule`

## Agent E: Blueprint View Cutover

- [ ] E1. `BlueprintProductionWorkbenchView.vue` 改为只消费 `blueprintStore`
- [ ] E2. 用五个 presenter 替换现有 `useStationXxxModel`
- [ ] E3. 删除本文件中的旧 props 组装和大段 `handleXxx`

## Agent F: Live View Cutover

- [ ] F1. `LiveProductionWorkbenchView.vue` 改为只消费 `liveStore`
- [ ] F2. 用五个 presenter 替换现有 `useStationXxxModel`
- [ ] F3. 删除本文件中的旧 props 组装和大段 `handleXxx`

## Agent G: Cleanup + Verification

- [ ] G1. 删除 `useWareFlowDerived` 的主路径职责
- [ ] G2. 废弃 `useStationPlanningPanelModel.ts`
- [ ] G3. 废弃 `useStationWareFlowsModel.ts`
- [ ] G4. 废弃 `useStationDashboardModel.ts`
- [ ] G5. 废弃 `useContextToolbarModel.ts`
- [ ] G6. 废弃 `useStationTabBarModel.ts`
- [ ] G7. 运行 `npm run build`
- [ ] G8. 补充回归测试，覆盖 blueprint/live 主路径和 station/empire 过滤边界

## Acceptance Criteria

### AC1. 顶层页面收缩

`BlueprintProductionWorkbenchView.vue` 和 `LiveProductionWorkbenchView.vue` 不再包含大段手工组装逻辑。

### AC2. 统一功能 contract

两个 store 都直接实现相同语义的 `ProductionWorkbenchStoreContract`。

### AC3. presenter 边界清晰

presenter 只做 UI 映射与区域组装，不承担业务编排。

### AC4. 过滤边界正确

- station 级 step 2 不过滤
- empire/sector 级聚合才过滤

### AC5. 动作边界正确

- `addModule/removeModule` 是唯一的显式模块变更入口
- 不再存在独立 `addGapModule/removeGapModule` contract
- step 2 自动模块不由 UI 回写

## Notes For Agents

1. 不要再提 source adapter 方案。
   此方案已否决。

2. 不要把 capability 散落在 view 模板里。
   capability 必须来自 store contract，且只允许使用：
   - `uniqueWorkbench`
   - `uniqueStation`
   - `hasSectors`

3. 不要让 presenter 重新算 step 2。
   presenter 只消费结果。

4. 不要再设计独立 `addGapModule/removeGapModule`。
   gap 只是 `addModule/removeModule` 的调用语义。
