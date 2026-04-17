# Production Store Actions 拆分设计

## 目标

为 `production-store-present-view` 重构补充一份可直接执行的 action 拆分文档，明确：

1. 只先抽 3 个共享模块
   - `productionModuleActions.ts`
   - `productionWareRuleActions.ts`
   - `productionSettingActions.ts`
2. 新模块位于 `src/store/actions/`
3. `gap module` 映射层不再单独建文件，直接整合进 `productionModuleActions.ts`
4. helper 设计到可以直接照着实现，不依赖 chat 上下文再补脑

本文档不是泛泛讨论，而是 implementation-ready 设计稿。

---

## 范围

### In Scope

- `useBlueprintProductionStore`
- `useLiveProductionStore`
- `src/store/actions/productionModuleActions.ts`
- `src/store/actions/productionWareRuleActions.ts`
- `src/store/actions/productionSettingActions.ts`

### Out of Scope

- station / empire / binding 生命周期动作拆分
- `selectionActions`
- import / save / discard 拆分
- transit-only 专属动作模块
- 测试实现与测试运行

---

## 为什么先抽这三个

### 1. `productionModuleActions.ts`

优先级最高。

原因：

- blueprint / live 两边重复最多
- 逻辑最集中
- 副作用边界最容易通过注入统一
- 改完最容易用 `npm run build` 验证

### 2. `productionWareRuleActions.ts`

第二阶段。

原因：

- 纯计算比例高
- 共享逻辑边界清楚
- 只需把“改完后如何提交”作为回调注入

### 3. `productionSettingActions.ts`

第三阶段。

原因：

- 虽然重复多，但最容易卷入 blueprint/live 的 persistence 差异
- 适合在 module / ware rule 已稳定后再抽

---

## 最终目录

```text
src/store/actions/
  productionModuleActions.ts
  productionWareRuleActions.ts
  productionSettingActions.ts
```

说明：

- `src/store/actions/` 只放“共享编辑动作”
- 不放 `StationProductionFlowMap` 这类计算缓存逻辑
- 不放 `empireDataStore` / `saveBindingStore` 这种持久化 store

---

## 总体原则

### 1. helper 只统一“共同编辑逻辑”

抽出去的 helper 只做两件事：

- 计算下一版 station 编辑状态
- 调用统一注入的提交回调

不直接依赖：

- `empireDataStore`
- `saveBindingStore`
- `activeViewStore`
- `stationProductionFlowMap`
- `planningFlowFacade`
- `liveFlowFacade`

这些差异都由调用方注入。

### 2. helper 不直接感知 blueprint / live

helper 设计必须是模式无关的。

禁止出现：

- `if (mode === 'blueprint')`
- `if (mode === 'live')`

正确做法是由 store 传入：

- 当前 station getter
- 模块/setting 写入方式
- recompute 回调
- recompute 后的附加同步回调

### 3. helper 返回值统一

建议所有 action helper 使用统一返回模式：

```ts
type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }
```

原因：

- 比 `boolean` 更容易定位失败原因
- 比抛异常更适合当前 store 风格
- 调用侧可以先只用 `ok`

如果当前仓库不想扩大返回值改动，也允许第一版维持 `void | boolean`，但本文推荐最终统一成 `ActionResult`。

### 4. gap module 映射并入 module actions

不再单独建 `productionGapActions.ts`。

原因：

- gap add/remove 最终还是对 planned modules 做增删改
- 它不是独立状态域
- 单独拆文件只会让调用链再多一层跳转

因此在 `productionModuleActions.ts` 中直接包含：

- `addModuleByWare`
- `removeModuleByWare`

---

## 共享依赖设计

三个 actions 模块都应基于“依赖注入”。

### 共同输入对象建议

```ts
export interface ProductionActionContext<TStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  cloneModules(modules: SavedModule[]): SavedModule[]
  now(): number
}
```

说明：

- `TStation` 允许 blueprint/live 使用各自当前 station 结构
- `cloneModules` 由调用方传 `deepClone`
- `now` 默认传 `Date.now`

### 共同提交回调建议

```ts
export interface ProductionCommitHooks<TStation> {
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}
```

约束：

- `commitStationMutation` 负责把 station 变更写入对应持久层
- `recompute` 负责更新 flow/cache
- `afterCommit` 负责 live 特有聚合同步等后处理

blueprint / live 差异主要体现在这里。

---

# Phase 1: `productionModuleActions.ts`

## 目标

收口以下重复逻辑：

- `addModule`
- `removeModule`
- `updateModuleCount`
- `removeModuleById`
- `clearAllModules`
- `transferModuleFromAutoIndustry`
- `updatePlannedModules`
- `addModuleByWare`
- `removeModuleByWare`

其中 `addModuleByWare/removeModuleByWare` 直接吸收过去的 gap module 映射层。

## 模块职责

`productionModuleActions.ts` 只负责：

1. 读取当前 active station
2. 生成下一版 `modules`
3. 设置 `lastUpdated`
4. 触发注入的 `commit + recompute + afterCommit`

它不负责：

- ware priority
- locked wares
- setting patch
- station create/delete
- import payload 合并

## 推荐接口

```ts
import type { SavedModule, X4Module } from '@/types/x4'
import type { StationComputeDeps } from '@/store/state/stationSettings'

export interface ProductionModuleStation {
  id: string
  modules?: SavedModule[]
  lastUpdated?: number
}

export interface ProductionModuleActionDeps<TStation extends ProductionModuleStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  findModuleForWare(wareId: string, racePreference: string): X4Module | null
  getRacePreference(): string
  isModuleCountEditable?(moduleId: string): boolean
  cloneModules(modules: SavedModule[]): SavedModule[]
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionModuleActions {
  updatePlannedModules(modules: SavedModule[]): ActionResult
  addModule(moduleId: string, count?: number): ActionResult
  addModuleByWare(wareId: string): ActionResult
  removeModule(index: number): ActionResult
  removeModuleByWare(wareId: string): ActionResult
  removeModuleById(moduleId: string): ActionResult
  updateModuleCount(index: number, count: number): ActionResult
  clearAllModules(): ActionResult
  transferModuleFromAutoIndustry(module: SavedModule, autoIndustryModules: SavedModule[]): ActionResult
}

export function createProductionModuleActions<TStation extends ProductionModuleStation>(
  deps: ProductionModuleActionDeps<TStation>
): ProductionModuleActions
```

## 为什么这个接口合理

### 1. `findModuleForWare + getRacePreference`

这样 `addModuleByWare/removeModuleByWare` 可以直接内聚进 module actions。

调用方不再需要在 presenter/store 上重复写：

- `findModuleForWare`
- `plannedIndex`
- `count <= 1 ? remove : decrement`

### 2. `commitStationMutation + recompute + afterCommit`

这是 blueprint/live 共享与差异的分界线。

共享部分：

- 变更模块列表
- 设置 `lastUpdated`
- 调 `recompute`

差异部分：

- blueprint：只更新 empire station + flow cache
- live：还要 `updateBindingStationPlan`，并且追加 sector/live aggregation sync

### 3. `transferModuleFromAutoIndustry`

这里不让 helper 自己判断 auto 来源，而是把 `autoIndustryModules` 当输入。

这样 helper 保持纯粹。

## 行为定义

### `updatePlannedModules(modules)`

行为：

- 用传入 `modules` 完整替换 `station.modules`
- 设置 `lastUpdated`
- 提交并重算

失败条件：

- 无 active station
- 无 compute deps

### `addModule(moduleId, count = 1)`

行为：

- 如果 station 已有同 id module，则累加 `count`
- 否则 append 新条目
- 设置 `lastUpdated`
- 提交并重算

失败条件：

- 无 active station
- `moduleId` 非空但无效
- 无 compute deps

### `addModuleByWare(wareId)`

行为：

- 使用 `findModuleForWare(wareId, racePreference)`
- 找到模块后委托给 `addModule`

失败条件：

- 找不到对应模块

### `removeModule(index)`

行为：

- 按 index 移除一条 module
- 设置 `lastUpdated`
- 提交并重算

### `removeModuleByWare(wareId)`

行为：

- 先通过 `findModuleForWare` 找模块
- 再在 planned modules 中找 index
- `count <= 1` 时删除
- 否则 count 减 1

### `updateModuleCount(index, count)`

行为：

- 若有 `isModuleCountEditable` 且结果为 false，则拒绝
- 修改 index 对应 module 的 count
- 设置 `lastUpdated`
- 提交并重算

### `clearAllModules()`

行为：

- 清空 `station.modules`
- 设置 `lastUpdated`
- 提交并重算

### `transferModuleFromAutoIndustry(module, autoIndustryModules)`

行为：

- 先确认该 module 存在于 `autoIndustryModules`
- 然后委托给 `addModule(module.id, module.count)`

## blueprint 接入方式

blueprint store 应注入：

```ts
const moduleActions = createProductionModuleActions({
  getActiveStation: () => activeStation.value,
  getComputeDeps,
  findModuleForWare: (wareId, racePreference) => gameData.findModuleForWare(wareId, racePreference),
  getRacePreference: () => settings.value.racePreference,
  isModuleCountEditable,
  cloneModules: (modules) => deepClone(modules),
  now: () => Date.now(),
  commitStationMutation: () => {
    // blueprint 直接在 activeStation 上改，必要时可空实现
  },
  recompute: (station, deps) => {
    stationProductionFlowMap.compute(station.id, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
  }
})
```

注意：

- blueprint 侧 station 本身就是当前 draft 对象
- 不需要额外 persistence callback

## live 接入方式

live store 应注入：

```ts
const moduleActions = createProductionModuleActions({
  getActiveStation: () => activeStation.value,
  getComputeDeps,
  findModuleForWare: (wareId, racePreference) => gameData.findModuleForWare(wareId, racePreference),
  getRacePreference: () => settings.value.racePreference,
  isModuleCountEditable,
  cloneModules: (modules) => deepClone(modules),
  now: () => Date.now(),
  commitStationMutation: (station) => {
    updateBindingStationPlan(station.id, {
      modules: station.modules,
      lockedWares: station.lockedWares,
      warePriority: station.warePriority,
      settings: station.settings
    })
  },
  recompute: (station, deps) => {
    stationProductionFlowMap.compute(station.id, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
  },
  afterCommit: (station, deps) => {
    syncAfterStationFlowChange(station.id, deps)
  }
})
```

## 先挑一个接口，给出定稿示例

先定 `addModuleByWare`。

理由：

- 它直接验证“gap module 映射层并入 module action”的设计是否站得住
- 它同时覆盖 shared logic 和 deps 注入

### 定稿接口

```ts
addModuleByWare(wareId: string): ActionResult
```

### 定稿行为

1. 读取 `racePreference`
2. 调 `findModuleForWare(wareId, racePreference)`
3. 若无模块，返回 `{ ok: false, reason: 'module-not-found-for-ware' }`
4. 若有模块，委托给 `addModule(module.id, 1)`

### helper 实现示例

下面给出一份可以直接照着实现的示例，目标是明确：

- `addModuleByWare` 应当位于 `productionModuleActions.ts`
- helper 自己不区分 blueprint / live
- blueprint / live 的差异只通过 deps 注入

```ts
type ActionResult =
  | { ok: true }
  | { ok: false; reason: string }

interface ProductionModuleStation {
  id: string
  modules?: SavedModule[]
  settings: StationSettings
  lockedWares?: string[]
  warePriority?: Record<string, number>
  lastUpdated?: number
}

function createProductionModuleActions<TStation extends ProductionModuleStation>(
  deps: ProductionModuleActionDeps<TStation>
) {
  function addModule(moduleId: string, count = 1): ActionResult {
    const station = deps.getActiveStation()
    if (!station) return { ok: false, reason: 'no-active-station' }

    const computeDeps = deps.getComputeDeps()
    if (!computeDeps) return { ok: false, reason: 'compute-deps-unavailable' }

    const current = deps.cloneModules(station.modules || [])
    const existing = current.find((module) => module.id === moduleId)

    if (existing) existing.count += count
    else current.push({ id: moduleId, count })

    station.modules = current
    station.lastUpdated = deps.now()

    deps.commitStationMutation(station)
    deps.recompute(station, computeDeps)
    deps.afterCommit?.(station, computeDeps)

    return { ok: true }
  }

  function addModuleByWare(wareId: string): ActionResult {
    const racePreference = deps.getRacePreference()
    const module = deps.findModuleForWare(wareId, racePreference)

    if (!module) {
      return { ok: false, reason: 'module-not-found-for-ware' }
    }

    return addModule(module.id, 1)
  }

  return {
    addModule,
    addModuleByWare
  }
}
```

实现约束：

- `addModuleByWare` 不得自己写 `station.modules`
- 它只负责 `wareId -> moduleId` 映射，然后委托给 `addModule`
- 所有提交、副作用、重算，都必须由 `addModule` 统一处理
- 这样 `addModuleByWare` 和其他入口不会出现提交链分叉

### blueprint store 调用示例

`useBlueprintProductionStore` 内部应当先实例化共享 helper，再把 UI 侧 action 映射到 helper。

```ts
const moduleActions = createProductionModuleActions({
  getActiveStation: () => activeStation.value,
  getComputeDeps,
  findModuleForWare: (wareId, racePreference) =>
    gameData.findModuleForWare(wareId, racePreference),
  getRacePreference: () => settings.value.racePreference,
  cloneModules: (modules) => deepClone(modules),
  now: () => Date.now(),
  commitStationMutation: () => {
    // blueprint 当前直接修改 activeStation draft，可为空实现
  },
  recompute: (station, deps) => {
    stationProductionFlowMap.compute(station.id, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
  }
})

function addWareModule(wareId: string): ActionResult {
  return moduleActions.addModuleByWare(wareId)
}
```

要求：

- store 对外仍然暴露面向当前工作台的动作名，例如 `addWareModule`
- 但实际实现必须转发到 `moduleActions.addModuleByWare`
- 不允许再在 store 内复制一份 `findModuleForWare + 写 modules + recompute` 逻辑

### live store 调用示例

`useLiveProductionStore` 的接法相同，差异只在提交和后置同步。

```ts
const moduleActions = createProductionModuleActions({
  getActiveStation: () => activeStation.value,
  getComputeDeps,
  findModuleForWare: (wareId, racePreference) =>
    gameData.findModuleForWare(wareId, racePreference),
  getRacePreference: () => settings.value.racePreference,
  cloneModules: (modules) => deepClone(modules),
  now: () => Date.now(),
  commitStationMutation: (station) => {
    updateBindingStationPlan(station.id, {
      modules: station.modules,
      lockedWares: station.lockedWares,
      warePriority: station.warePriority,
      settings: station.settings
    })
  },
  recompute: (station, deps) => {
    stationProductionFlowMap.compute(station.id, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
  },
  afterCommit: (station, deps) => {
    syncAfterStationFlowChange(station.id, deps)
  }
})

function addWareModule(wareId: string): ActionResult {
  return moduleActions.addModuleByWare(wareId)
}
```

要求：

- live 侧额外同步只能放在 `afterCommit`
- 不允许在 `addModuleByWare` 内直接调用 `syncAfterStationFlowChange`
- 这样 module helper 仍然保持模式无关

### 设计结论

`addModuleByWare` 的调用链应固定为：

1. presenter / view 调 `store.addWareModule(wareId)`
2. store 转发到 `moduleActions.addModuleByWare(wareId)`
3. helper 内部完成 `ware -> module` 映射
4. helper 委托 `addModule`
5. `addModule` 统一执行 `commit + recompute + afterCommit`

这条链路是本次 `productionModuleActions.ts` 抽取的标准范式。后续 `removeModuleByWare`、`addModule`、`clearAllModules` 都应保持同样结构。

### 为什么不做成

```ts
addGapModule(wareId: string)
```

因为“gap”是 UI 语义，不是 store action 语义。  
store 层只关心“按 ware 增加模块”。

---

# Phase 2: `productionWareRuleActions.ts`

## 目标

收口以下共享逻辑：

- `isWareOperable`
- `isWareLocked`
- `isPlannedWare`
- `isAutoWare`
- `getResolvedLevel`
- `toggleWareLock`
- `toggleWarePriority`

## 模块职责

`productionWareRuleActions.ts` 负责：

1. 计算 ware 在当前 station 下的解析状态
2. 修改 `lockedWares`
3. 修改 `warePriority`
4. 提交并重算

它不负责：

- 模块列表增删
- setting patch
- gap 模块映射

## 推荐接口

```ts
export interface ProductionWareRuleStation {
  id: string
  modules?: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  settings: StationSettings
  lastUpdated?: number
}

export interface ProductionWareRuleActionDeps<TStation extends ProductionWareRuleStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  getPlannedModules(): SavedModule[]
  getAutoIndustryModules(): SavedModule[]
  getModulesMap(): Record<string, X4Module>
  getWaresMap(): Record<string, X4Ware>
  cloneStringList(values: string[]): string[]
  clonePriorityMap(values: Record<string, number>): Record<string, number>
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionWareRuleActions {
  isWareOperable(wareId: string): boolean
  isWareLocked(wareId: string): boolean
  isPlannedWare(wareId: string): boolean
  isAutoWare(wareId: string): boolean
  getResolvedLevel(wareId: string): number
  toggleWareLock(wareId: string): ActionResult
  toggleWarePriority(wareId: string): ActionResult
}

export function createProductionWareRuleActions<TStation extends ProductionWareRuleStation>(
  deps: ProductionWareRuleActionDeps<TStation>
): ProductionWareRuleActions
```

## 关键规则

### `isWareOperable`

规则：

- 只要 `waresMap[wareId]?.transport === 'container'` 才可操作

### `getResolvedLevel`

规则保持现状：

- planned 且 override = 0 -> 1
- auto 且 override = 2 -> 1
- override 已定义 -> override
- planned -> 2
- auto -> 0
- default -> 0

### `toggleWareLock`

规则：

- 不可操作 ware 直接拒绝
- 在 `lockedWares` 中存在则移除，否则追加
- 提交并重算

### `toggleWarePriority`

规则：

- 先算 `currentLevel`
- planned：`2 -> 1 -> delete`
- auto：`0 -> 1 -> delete`
- 其他不操作

## blueprint/live 差异处理

与 module actions 相同：

- blueprint 侧 `commitStationMutation` 可为空或仅维护本地 station
- live 侧 `commitStationMutation + afterCommit` 负责 binding plan 与 sector/live sync

---

# Phase 3: `productionSettingActions.ts`

## 目标

收口当前 store 内一堆围绕 `updateStationSettingsDirect` 的包装动作。

## 模块职责

`productionSettingActions.ts` 负责：

1. 统一按 key patch `station.settings`
2. 提交并重算
3. 提供一层语义化包装动作

它不负责：

- transit 独立对象
- 模块列表编辑
- ware 锁和 priority

## 推荐接口

```ts
export interface ProductionSettingStation {
  id: string
  settings: StationSettings
  modules?: SavedModule[]
  lockedWares?: string[]
  warePriority?: Record<string, number>
  lastUpdated?: number
}

export interface ProductionSettingActionDeps<TStation extends ProductionSettingStation> {
  getActiveStation(): TStation | null
  getComputeDeps(): StationComputeDeps | null
  mergeSettings(base: StationSettings, patch: Partial<StationSettings>): StationSettings
  now(): number
  commitStationMutation(station: TStation): void
  recompute(station: TStation, deps: StationComputeDeps): void
  afterCommit?(station: TStation, deps: StationComputeDeps): void
}

export interface ProductionSettingActions {
  updateSetting<K extends keyof StationSettings>(key: K, value: StationSettings[K]): ActionResult
  updateSettings(patch: Partial<StationSettings>): ActionResult
  updateSunlight(value: number): ActionResult
  updateTransportMinutes(value: number): ActionResult
  updateRacePreference(value: string): ActionResult
  updateWorkforce(value: boolean): ActionResult
  updateShowEmpireGaps(value: boolean): ActionResult
  updateResourceBufferHours(value: number): ActionResult
  updatePrimaryProductBufferHours(value: number): ActionResult
  updateSecondaryProductBufferHours(value: number): ActionResult
  updateBuyMultiplier(value: number): ActionResult
  updateSellMultiplier(value: number): ActionResult
  updateTransportShipCapacity(value: number): ActionResult
  updateManualWorkforce(value: number): ActionResult
  updateWorkforceAuto(value: boolean): ActionResult
  updateUseHQ(value: boolean): ActionResult
}

export function createProductionSettingActions<TStation extends ProductionSettingStation>(
  deps: ProductionSettingActionDeps<TStation>
): ProductionSettingActions
```

## 关键设计

### 1. 核心只有两个底层动作

底层其实只需要：

- `updateSetting(key, value)`
- `updateSettings(patch)`

其余都是语义包装。

### 2. `updateWorkforce` 不直接写 `workforceAuto`

当前语义保持现状：

- `updateWorkforce(value)` 实际写的是 `considerWorkforceForAutoFill`

要在 helper 中写死映射，不要让 presenter 再知道内部字段名。

### 3. transit hub settings

`updateTransitHubSettings` 不适合直接塞进这个 helper。

原因：

- live transit patch 写入的是 group settings，不是当前 station settings

因此：

- `productionSettingActions.ts` 只处理当前 station settings
- transit hub group settings 仍由 live store 自己管理

---

## 三阶段实施顺序

### Step 1. 抽 `productionModuleActions.ts`

在两个 store 中先替换：

- `updatePlannedModules`
- `addModule`
- `addModuleByWare`
- `removeModule`
- `removeModuleByWare`
- `updateModuleCount`
- `removeModuleById`
- `transferModuleFromAutoIndustry`
- `clearAllModules`

### Step 2. 抽 `productionWareRuleActions.ts`

替换：

- `isWareOperable`
- `isWareLocked`
- `isPlannedWare`
- `isAutoWare`
- `getResolvedLevel`
- `toggleWareLock`
- `toggleWarePriority`

### Step 3. 抽 `productionSettingActions.ts`

替换：

- `updateStationSettingsDirect`
- 各种 `updateXxx` setting wrapper

---

## 对 agent 的硬性执行要求

1. 不允许先抽公共文件，再让 blueprint/live 分别继续复制一份逻辑
2. `gap module` 映射必须并入 `productionModuleActions.ts`
3. 不允许在 helper 内写 blueprint/live 分支
4. blueprint/live 差异必须通过 deps/hook 注入
5. 每抽完一个 actions 文件，就先让两个 store 都接入，再继续下一阶段
6. 每一阶段完成后至少执行一次 `npm run build`

---

## 最后定稿

本 change 的 action 拆分顺序与文件定稿如下：

1. `src/store/actions/productionModuleActions.ts`
2. `src/store/actions/productionWareRuleActions.ts`
3. `src/store/actions/productionSettingActions.ts`

其中：

- `productionModuleActions.ts` 内含 `addModuleByWare/removeModuleByWare`
- 不再创建独立 gap action 文件
- 这三份文件都必须采用“共享逻辑 + 注入回调”的结构
