# station-derived-map Self Attributes

## 目标

`StationDerivedMap` 必须收拢 station 自身输入属性与派生更新判断。

外部不再直接调用计算接口，不再直接组合 `compute` / `setSemantics` / `updateAggregation`。  
外部只允许更新 station 自身属性，由 `StationDerivedMap` 内部决定是否重算 flow、semantics 与 aggregation。

## 对外接口

## Static Deps 规则

`StationDerivedMap` 的静态计算依赖必须只通过构造函数注入。

构造输入必须是：

```ts
new StationDerivedMap({
  modulesMap,
  waresMap,
  medicalConsumptionMap,
  modulesByMacroId
})
```

并且：

- `StationDerivedMap` 不得提供 `setComputeDeps`
- `StationDerivedMap` 不得提供 `updateStaticDeps`
- store 不得在实例创建后修改静态依赖
- 当静态依赖不可用时，store 不得创建实例
- 当静态依赖发生切换时，store 必须重建实例，不得复用旧实例并热更新依赖

## Store Instance Ownership

`StationDerivedMap` 实例所有权必须归 store 自己管理。

必须满足：

- `useBlueprintProductionStore` 必须维护自己的 planning `StationDerivedMap` 实例
- `useLiveProductionStore` 必须维护自己的 planning `StationDerivedMap` 实例
- `useLiveProductionStore` 必须另外维护自己的 archive/live `StationDerivedMap` 实例
- blueprint planning instance 与 live planning instance 不得共享同一个对象
- 不得继续从 `StationDerivedMap.ts` 导出模块级共享 planning instance
- facade / presenter / vue 不得直接 import 模块级共享 `StationDerivedMap` 实例

`StationDerivedMap` 对外必须只暴露以下写接口：

```ts
upsertStation(stationId, seed)
updateModules(stationId, modules)
updateSettings(stationId, settings)
updateLockedWares(stationId, lockedWares)
updateWarePriority(stationId, warePriority)
refreshStation(stationId)
refreshAll()
removeStation(stationId)
clear()
```

`StationDerivedMap` 不得对外暴露任何计算接口。

以下接口不得 export：

```ts
compute(...)
setSemantics(...)
buildStationSemantics(...)
buildArchiveSemantics(...)
```

## Station Seed

`upsertStation(stationId, seed)` 必须使用以下输入结构：

```ts
interface StationDerivedSeed {
  modulesMode: 'plan' | 'full'
  modules: SavedModule[]
  settings: StationDerivedSettingsInput
  lockedWares?: string[]
  warePriority?: Record<string, number>
  workforces?: WorkforceEntry[]
  archiveSemanticsSource?: StationSemanticDerivedSource
}
```

## modulesMode 规则

`modulesMode` 是功能模式，不是来源身份。

### `modulesMode: 'plan'`

表示：

- 外部传入的是规划模块
- `StationDerivedMap` 必须自动推导派生模块
- `StationDerivedMap` 必须基于规划模块与派生模块计算 flow
- `StationDerivedMap` 必须基于规划模块与派生模块计算 semantics

并且：

- `workforces` 不得生效
- `archiveSemanticsSource` 不得生效

### `modulesMode: 'full'`

表示：

- 外部传入的是完整模块
- `StationDerivedMap` 不得再自动补派生模块
- `StationDerivedMap` 必须直接基于完整模块计算 flow
- `StationDerivedMap` 必须直接基于完整模块计算 semantics

并且：

- `workforces` 仅在 `full` 模式下生效
- `archiveSemanticsSource` 仅在 `full` 模式下生效

## full 模式下的附加字段规则

### `workforces`

`workforces` 仅在 `modulesMode === 'full'` 时生效。

规则：

- 若传入 `workforces`，`StationDerivedMap` 必须将其作为 workforce override
- 有 `workforces` 时，`StationDerivedMap` 必须跳过内部工人推导
- 无 `workforces` 时，`StationDerivedMap` 才允许按现有逻辑计算工人

### `archiveSemanticsSource`

`archiveSemanticsSource` 仅在 `modulesMode === 'full'` 时生效。

规则：

- 若传入 `archiveSemanticsSource`，`StationDerivedMap` 必须将其作为 semantics 主来源
- 若 `archiveSemanticsSource` 字段不完整，`StationDerivedMap` 必须基于 full modules 补齐缺失字段
- 若未传入 `archiveSemanticsSource`，`StationDerivedMap` 必须完全基于 full modules 计算 semantics

## settings 输入规则

`StationDerivedMap` 不得保存外部传入的完整 `StationSettings` 对象。  
`StationDerivedMap` 只允许保存计算所必需的 settings 字段。

必须定义内部 settings 存储结构如下：

```ts
interface StationDerivedSettings {
  racePreference: string
  considerWorkforceForAutoFill: boolean
  sunlight: number
  useHQ: boolean
  workforceAuto: boolean
  manualWorkforce: number
}
```

这就是当前一阶段 flow 计算允许保存的完整 settings 字段集合。  
未列入该结构的字段，一律不得保存。

## settings 截断规则

当外部调用：

```ts
upsertStation(...)
updateSettings(...)
```

并传入额外字段时，`StationDerivedMap` 必须在保存前执行截断。

规则：

1. 只提取内部允许字段
2. 丢弃所有额外字段
3. 不得把完整原始 settings 对象原样写入内部快照
4. 不得让外部额外字段影响缓存比较与重算判断
5. 当截断后的有效字段未变化时，不得触发重算

也就是说，内部保存的永远只能是截断后的 `StationDerivedSettings`。

## 内部快照

`StationDerivedMap` 内部必须维护 station 自身输入快照。

最小结构必须包含：

```ts
interface StationDerivedSnapshot {
  modulesMode: 'plan' | 'full'
  inputModules: SavedModule[]
  fullModules: SavedModule[]
  settings: StationDerivedSettings
  lockedWares: string[]
  warePriority: Record<string, number>
  workforcesOverride?: WorkforceEntry[]
  archiveSemanticsSource?: StationSemanticDerivedSource
}
```

说明：

- `inputModules` 是外部传入模块
- `fullModules` 是 map 内部归一化后的完整模块集
- `workforcesOverride` 仅在 `full` 模式使用
- `archiveSemanticsSource` 仅在 `full` 模式使用

## 更新判断

所有 `update*` 接口在执行任何重算前，必须先进行一层“实质性影响判断”。

规则：

1. 必须先将输入归一化为内部快照格式
2. 必须将归一化后的新值与当前 snapshot 中对应字段比较
3. 只有存在实质性变化时，才允许触发后续重算
4. 若无实质性变化，必须直接返回，不得触发 flow、semantics 或 aggregation 更新

“实质性变化”仅指会改变内部有效快照字段的变化，不包含：

- 额外无效 settings 字段变化
- 仅对象引用变化但归一化后内容不变
- 默认值填充后与现有快照等价的输入
- 顺序、空值、结构差异在归一化后等价的输入

### `updateModules(stationId, modules)`

`StationDerivedMap` 必须读取该 station 的 `modulesMode` 后再判断如何更新。

并且：

1. 必须先比较归一化后的 `modules` 与现有 `inputModules`
2. 若无实质性变化，不得触发任何更新

#### 当 `modulesMode === 'plan'`

必须：

1. 更新 `inputModules`
2. 重新推导 `fullModules`
3. 重算 flow
4. 重算 semantics
5. 更新 aggregation

#### 当 `modulesMode === 'full'`

必须：

1. 更新 `inputModules`
2. 令 `fullModules = inputModules`
3. 重算 flow
4. 重算 semantics
5. 更新 aggregation

### `updateSettings(stationId, settings)`

必须：

1. 对输入 settings 执行截断
2. 只保存截断后的字段
3. 比较截断后的有效字段与现有 `snapshot.settings`
4. 仅当存在实质性变化时，重算 flow
5. 仅当存在实质性变化时，更新 aggregation

不得：

1. 重算 semantics

### `updateLockedWares(stationId, lockedWares)`

必须：

1. 更新 station 自身属性
2. 先比较归一化后的值与现有 `snapshot.lockedWares`
3. 仅当存在实质性变化时，重算 flow
4. 仅当存在实质性变化时，更新 aggregation

不得：

1. 重算 semantics

### `updateWarePriority(stationId, warePriority)`

必须：

1. 更新 station 自身属性
2. 先比较归一化后的值与现有 `snapshot.warePriority`
3. 仅当存在实质性变化时，重算 flow
4. 仅当存在实质性变化时，更新 aggregation

不得：

1. 重算 semantics

### `refreshStation(stationId)`

必须基于当前内部快照执行一次完整刷新：

- 重算 flow
- 重算 semantics
- 更新 aggregation

### `refreshAll()`

必须遍历当前 map 管辖的全部 stations：

- 重算 flow
- 重算 semantics
- 最后统一更新 aggregation

## 责任边界

### `StationDerivedMap` 必须负责

- 保存 station 自身输入快照
- 判断每次属性变更需要更新哪些派生结果
- 执行 flow 重算
- 执行 semantics 重算
- 执行 aggregation 更新
- 截断 settings 输入

### 外部不得负责

- 判断本次更新是否要重算 semantics
- 判断本次更新是否只重算 flow
- 手工调用内部计算接口
- 手工组合 `compute + setSemantics + updateAggregation`
- 保存未经截断的 settings 到 map

## 最终约束

`StationDerivedMap` 必须成为 station derived state 的唯一更新入口。  
外部只能更新属性，不能直接驱动计算流程。  
计算接口必须全部收回到 map 内部。
