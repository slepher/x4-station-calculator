# station-derived-map Review 2

## 结论

当前实现仍然不允许继续推进，必须先修正 `useBlueprintProductionStore` 中对 `StationDerivedMap` 的错误触发策略，再处理其余遗漏场景。

本轮 review 确认的问题不是抽象命名，而是**触发矩阵没有被落实到代码**。当前实现把不相关事件错误地接到 `planningDerivedMap.compute(...)`，直接破坏了已初始化的 semantics cache。

后续实现必须按本文件执行，不得保留现有 watch 逻辑，不得保留“切站时顺手 compute 一下”的做法。

## Findings

### F1. 当前 watch 实现错误，触发矩阵被整体违背

当前代码位于 [useBlueprintProductionStore.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:275)：

- 监听 `stationId`
- 监听 `gameReady`
- 监听 `buildPrice`
- 监听 `enforceDlcActivation`
- 回调中统一执行 `planningDerivedMap.compute(station.id, ...)`

这是错误实现。它把四种完全不同的触发源合并成了同一种动作。

当前触发矩阵必须被强制解释为：

| 触发源 | flow | semantics | 当前实现 |
|---|---|---|---|
| 站点切换 | 不得更新 | 不得更新 | 错误地执行 compute |
| gameReady | 必须初始化 | 必须初始化 | 只执行 compute，错误 |
| buildPrice | 不得更新 | 不得更新 | 错误地执行 compute |
| enforceDlcActivation | 必须更新 | 必须更新 | 只执行 compute，错误 |

因此，现有 watch 必须删除，不得保留。

受影响位置：

- [useBlueprintProductionStore.ts:275]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:275 )
- [useLiveProductionStore.ts:832]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:832 )

### F2. `compute()` 覆盖 cache 会清空 semantics，当前 watch 会稳定复现语义丢失

当前 `compute()` 使用整包覆盖写入 cache，不保留旧 `semantics`。在已有 semantics cache 的站点上再次执行 `compute()`，会直接清掉 semantics。

这与当前错误 watch 叠加后，形成稳定错误链：

1. 初始化阶段正确写入所有站点 semantics
2. 用户切换 activeStation
3. watch 被 `stationId` 触发
4. 当前站点执行 `compute()`
5. 当前站点 semantics 被覆盖丢失
6. `getTabs()` 读取 `semantics?.tag` 得到 `undefined`
7. UI 回退到默认值

这是现有实现的确定性错误，不是偶发问题。

直接原因位置：

- [StationDerivedMap.ts:280]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/state/StationDerivedMap.ts:280 ) 的 `compute()` 使用整包覆盖写入
- blueprint watch 在 [useBlueprintProductionStore.ts:286]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:286 ) 直接调用 `planningDerivedMap.compute(...)`
- live planning watch 在 [useLiveProductionStore.ts:843]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:843 ) 直接调用 `planningDerivedMap.compute(...)`

### F3. 现有实现遗漏了多个必须更新 semantics 的 module 变动场景

当前 requirement 已经固定：

- 初始化：flow + semantics
- 模块变动：flow + semantics
- setting 变动：仅 flow
- 站点切换：不更新
- buildPrice 变动：不更新
- enforceDlcActivation 变动：flow + semantics

但代码中仍有多个 module 相关动作没有被强制接入 “flow + semantics” 重算入口，包括但不限于：

- `createBindingStation`
- `duplicateBindingStation`
- `importBindingStation`
- `updateBindingStationType`
- module actions 路径

这些场景只要会改变 station modules 或影响 semantic classification，就必须统一进入 `flow + semantics` 重算入口，不得遗漏。

已确认需要修改的直接位置：

#### blueprint store

- [useBlueprintProductionStore.ts:126]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:126 ) `plannedModules` setter
- [useBlueprintProductionStore.ts:242]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:242 ) `moduleActions.recompute`
- [useBlueprintProductionStore.ts:365]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:365 ) `createStation`
- [useBlueprintProductionStore.ts:385]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:385 ) `duplicateStation`
- [useBlueprintProductionStore.ts:401]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:401 ) `updateStationModules`
- [useBlueprintProductionStore.ts:407]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:407 ) `updateStationType`

#### live store

- [useLiveProductionStore.ts:588]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:588 ) `plannedModules` setter
- [useLiveProductionStore.ts:787]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:787 ) `moduleActions.recompute`
- [useLiveProductionStore.ts:937]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:937 ) `createStation`
- [useLiveProductionStore.ts:985]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:985 ) `updateStationModules`
- [useLiveProductionStore.ts:990]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:990 ) `updateStationType`
- [useLiveProductionStore.ts:995]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:995 ) `applyImportedStationPayload`

### F4. 问题根因是上轮文档没有把“触发矩阵 + 禁止 watcher 混接”写死

为什么 agent 会实现歪：

1. 上轮文档虽然写了“模块变动 / setting 变动 / 初始化”的高层矩阵，但没有把 **`stationId` / `gameReady` / `buildPrice` / `enforceDlcActivation`** 这些实际触发源逐项写死。
2. 上轮文档没有明确写出：**禁止通过一个 watch 合并多个来源后统一调用 `compute()`**。
3. 上轮文档没有把 blueprint store 的现有 watcher 列为强制 review 对象，导致 agent 直接沿用旧模式。
4. 上轮文档没有明确写出：**站点切换和 buildPrice 变动不得触发 derived 重算**。

因此，agent 实际上是在“填补未写死的空白”，不是在执行一份足够收口的实现方案。

结论：

这不是单纯实现粗心，根因是计划没有把实际触发层写到可执行粒度。  
本轮文档必须补齐这一层，后续实现不得再自行解释。

## 重新审核后的具体修改结论

### 1. blueprint store 需要修改的地方

#### A. 删除错误 watch

必须删除：

- [useBlueprintProductionStore.ts:275]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:275 )

不得保留 `stationId`、`gameReady`、`buildPriceMultiplier`、`enforceDlcActivation` 的混合监听。

#### B. 将直接 `compute(...)` 的写路径收口

以下位置不得继续直接调用 `planningDerivedMap.compute(...)`，必须改为调用固定重算入口：

- [useBlueprintProductionStore.ts:126]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:126 )
- [useBlueprintProductionStore.ts:143]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:143 )
- [useBlueprintProductionStore.ts:160]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:160 )
- [useBlueprintProductionStore.ts:181]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:181 )
- [useBlueprintProductionStore.ts:242]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:242 )
- [useBlueprintProductionStore.ts:266]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:266 )

#### C. 已有函数必须重命名并保留唯一职责

当前已有：

- [useBlueprintProductionStore.ts:297]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:297 ) `recomputeStationDerived`
- [useBlueprintProductionStore.ts:315]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:315 ) `recomputeStationFlowOnly`
- [useBlueprintProductionStore.ts:334]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:334 ) `initializeAllStationCaches`

这些函数必须整理为正式入口，并统一命名为：

- `initializeAllStationDerived`
- `recomputePlanStationDerived`
- `recomputePlanStationFlowOnly`

不得保留旧命名。

#### D. 场景绑定必须修改

- `createStation` 必须调用 `recomputePlanStationDerived`
- `duplicateStation` 必须调用 `recomputePlanStationDerived`
- `updateStationModules` 必须调用 `recomputePlanStationDerived`
- `updateStationType` 必须按现有实现继续走 `recomputePlanStationDerived`
- `updateStationCount` 必须继续走 flow-only
- `updateStationMinerals` 必须继续走 flow-only

#### E. settings / module / rule actions 必须接到固定入口

- [useBlueprintProductionStore.ts:780]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:780 ) `settingActions.recompute` 必须改为 `recomputePlanStationFlowOnly`
- [useBlueprintProductionStore.ts:230]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:230 ) `moduleActions.recompute` 必须改为 `recomputePlanStationDerived`
- [useBlueprintProductionStore.ts:252]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:252 ) `wareRuleActions.recompute` 不得继续直接 `compute(...)`，必须收口到 flow-only 固定入口

### 2. live store 需要修改的地方

#### A. 删除错误 watch

必须删除：

- [useLiveProductionStore.ts:832]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:832 )

该 watch 与 blueprint store 的错误相同，也不得保留。

#### B. planning 路径直接 `compute(...)` 的位置必须收口

以下位置不得继续直接调用 `planningDerivedMap.compute(...)`：

- [useLiveProductionStore.ts:571]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:571 )
- [useLiveProductionStore.ts:597]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:597 )
- [useLiveProductionStore.ts:628]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:628 )
- [useLiveProductionStore.ts:654]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:654 )
- [useLiveProductionStore.ts:697]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:697 )
- [useLiveProductionStore.ts:787]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:787 )
- [useLiveProductionStore.ts:820]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:820 )
- [useLiveProductionStore.ts:843]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:843 )
- [useLiveProductionStore.ts:859]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:859 )

#### C. live store 中必须建立 planning 侧固定入口

当前 live store 没有像 blueprint store 那样清晰的固定入口，必须补齐：

- `initializeAllPlanningDerived`
- `recomputeBindingPlanDerived`
- `recomputeBindingPlanFlowOnly`

其中：

- [useLiveProductionStore.ts:563]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:563 ) `syncAllBindingStationsToStateMap` 必须重命名为 `initializeAllPlanningDerived`
- [useLiveProductionStore.ts:854]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:854 ) `refreshStationFlowCache` 必须拆分，不得继续同时承担 flow + semantics 的模糊职责

#### D. archive 路径保持“初始化 flow + 写 semantics”

archive 路径当前在 [useLiveProductionStore.ts:92]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:92 ) 到 [136]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useLiveProductionStore.ts:136 ) 已经接近正确：

- 计算 archive flow
- 调用 `buildArchiveSemantics(...)`
- 写入 `liveFlowMap.setSemantics(...)`

这一路不需要改成“archive semantics 重算入口”，但必须明确只用于 archive 初始化/同步。

### 3. `createProductionModuleActions` 接口需要修改

当前 [productionModuleActions.ts:29]( /home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/actions/productionModuleActions.ts:29 ) 只要求注入一个泛化 `recompute(station, deps)`。

这会继续诱导调用方传入直接 `compute(...)`。

因此该接口必须修改为场景型能力，而不是泛化 recompute。

必须改为：

- `recomputeDerived(station, deps)` 用于模块变动

不得继续保留当前含糊的 `recompute` 命名。

## 强制性实现方案

### 1. 删除当前 watch

必须删除 [useBlueprintProductionStore.ts](/home/slepher/project/x4-station-calculator/worktrees/station-binding/src/store/useBlueprintProductionStore.ts:275) 这一段 watch。

不得保留其结构，不得保留“一个 watcher 监听多个来源然后统一 compute”的做法。

### 2. 将触发源拆成固定入口

必须拆成以下固定入口：

- blueprint store:
  - `initializeAllStationDerived()`
  - `recomputePlanStationDerived(stationId)`
  - `recomputePlanStationFlowOnly(stationId)`
- live store planning 路径:
  - `initializeAllPlanningDerived()`
  - `recomputeBindingPlanDerived(stationId)`
  - `recomputeBindingPlanFlowOnly(stationId)`

这三个入口的行为必须固定：

#### `initializeAllStationDerived()` / `initializeAllPlanningDerived()`

必须：

1. 遍历全部 planning stations
2. 对每个站点计算 flow
3. 对每个站点计算 semantics
4. 写入 planning derived map
5. 更新聚合

#### `recomputePlanStationDerived(stationId)` / `recomputeBindingPlanDerived(stationId)`

必须：

1. 更新该站点 flow
2. 更新该站点 semantics

只能用于：

- 模块变动
- `enforceDlcActivation` 变动
- 任何改变 station semantic classification 的场景

#### `recomputePlanStationFlowOnly(stationId)` / `recomputeBindingPlanFlowOnly(stationId)`

必须：

1. 只更新该站点 flow
2. 不得更新 semantics

只能用于：

- setting 变动

### 3. 触发源必须绑定到唯一动作

以下映射必须写死：

#### `gameData.isReady`

当从未就绪变为就绪时：

- 必须执行 `initializeAllStationDerived()`

#### `gameData.enforceDlcActivation`

当值发生变化时：

- 必须对全部 planning stations 执行 `recomputePlanStationDerived(stationId)`
- 必须在最后更新聚合

#### `buildPriceMultiplier`

当值发生变化时：

- 不得触发 planning derived map 重算

#### `activeStationId`

当值发生变化时：

- 不得触发 planning derived map 重算

### 4. 所有模块变动路径必须统一进入 `recomputePlanStationDerived`

只要行为会改变 station modules、module composition、module classification，必须调用 `recomputePlanStationDerived(stationId)`。

这包括：

- 新建 station
- 复制 station
- 导入 station modules
- 修改 station type（若该路径会影响模块构成或分类）
- 所有 module action 写路径
- live binding 的 `applyImportedStationPayload`

不得在这些路径中直接手写 `planningDerivedMap.compute(...)`。

### 5. 所有 setting 变动路径必须统一进入 `recomputePlanStationFlowOnly`

所有纯 setting 变动路径必须调用 `recomputePlanStationFlowOnly(stationId)`。

不得在 setting 变动路径中重算 semantics。

## 禁止事项

- 禁止保留当前 watch
- 禁止把 `stationId` 切换接到 `compute()`
- 禁止把 `buildPriceMultiplier` 变动接到 `compute()`
- 禁止在 blueprint store 中继续散落调用 `planningDerivedMap.compute(...)`
- 禁止 module 变动路径漏掉 semantics 更新
- 禁止 setting 变动路径更新 semantics

## 最终矩阵

| 场景 | flow | semantics |
|---|---|---|
| 初始化 | 必须更新 | 必须更新 |
| 模块变动 | 必须更新 | 必须更新 |
| setting 变动 | 必须更新 | 不得更新 |
| 站点切换 | 不得更新 | 不得更新 |
| buildPrice 变动 | 不得更新 | 不得更新 |
| enforceDlcActivation 变动 | 必须更新 | 必须更新 |
