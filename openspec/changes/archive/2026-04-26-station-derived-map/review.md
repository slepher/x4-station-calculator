# station-derived-map Review

## 结论

当前未提交实现不允许直接继续扩展，必须先按本文件完成结构修正后再继续代码改动。

本 review 已确认两类强制性问题：

1. `StationDerivedMap` 错误地感知了上游身份来源
2. planning 路径的 flow-only 重算与 semantic 重算职责没有被强制分离

本 review 不提供备选设计，不保留“可以这样也可以那样”的路径。后续实现必须按本文件执行。

## Findings

### F1. `StationDerivedMap` 不得感知 plan/archive 身份

当前实现存在以下错误方法：

- `computeSemanticForPlan(...)`
- `computeSemanticForArchive(...)`

这两个方法把“plan / archive”身份判断直接下沉到了 `StationDerivedMap`。这是错误边界。

`StationDerivedMap` 必须对调用来源透明。它只能暴露功能型能力，不能暴露身份型能力。

因此，以下命名和职责都必须禁止出现在 map 层：

- `ForPlan`
- `ForArchive`
- `PlanSemantic`
- `ArchiveSemantic`
- 任何基于 blueprint / binding / live / archive 身份的 compute API

map 层只允许保留功能性接口，例如：

- `compute(...)` 或 `computeFlow(...)`
- `setSemantics(...)`
- `getCache(...)`
- `updateAggregation(...)`
- `remove(...)`
- `clear(...)`

### F2. plan 路径必须区分“flow+semantics 重算”和“flow-only 重算”

当前需求已经明确：

1. 初始化时：
   - 必须计算所有 plan 的 flow 和 semantics
   - 必须计算 archive 的 flow
   - archive 必须把自带 semantics 写入 map

2. module 变动时：
   - 必须同时更新 flow 和 semantics

3. setting 变动时：
   - 必须只更新 flow
   - 不得更新 semantics

因此，planning 路径上存在明确的 flow-only 重算场景。实现必须保证 flow-only 重算不会错误触发 semantic 重算，也不得要求调用方经过 `computeSemanticForPlan(...)` 这类身份型 API。

### F3. archive 语义不是“重算语义”，而是“写入 archive 自带语义并按规则补齐”

archive 路径的规则已确定：

1. archive flow 需要计算
2. archive semantics 需要从 archive 自带字段写入 map
3. 当 archive 自带字段不完整时，必须按 fallback 规则补齐
4. archive 不建立“module 变动触发 semantics 重算”的路径

因此，archive 侧不允许被建模为“与 plan 对称的一套 semantic 重算入口”。这也是 `computeSemanticForArchive(...)` 不应存在于 map 层的原因之一。

### F4. store/logic 层必须承担身份分流，map 层只负责功能写入

身份相关逻辑必须留在上层：

- blueprint / plan 初始化
- archive 初始化
- plan module 变动
- plan setting 变动

这些都属于 store/logic orchestration，不属于 `StationDerivedMap`。

## 强制性实现决定

### 1. 删除身份型 API

必须从 `StationDerivedMap` 删除：

- `computeSemanticForPlan(...)`
- `computeSemanticForArchive(...)`

不得保留兼容包装函数，不得保留 deprecated 入口。

### 2. map 层只保留功能型 API

`StationDerivedMap` 必须只保留功能型写口。

`StationDerivedMap` 必须收口为以下接口：

```ts
compute(...)
setSemantics(stationId, semantics)
```

如果需要 patch cache，只能使用以下功能型命名：

```ts
patchCache(stationId, { semantics })
```

不得引入任何来源身份词。

### 3. semantic builder 必须上移到 logic/store 层

必须新增或整理纯逻辑 helper，用于生成不同来源下的 semantics：

- `buildPlanStationSemantics(...)`
- `buildArchiveStationSemantics(...)`

这些函数可以感知 plan/archive 身份，因为它们属于 logic 层，不属于 map 层。

### 4. 上层必须显式收口为场景型重算入口

后续代码必须按场景提供固定入口，不得让调用方手工拼装“先 compute 再算 semantic”的随意流程。

必须至少存在以下几类上层入口：

1. plan 初始化
2. archive 初始化
3. plan module 变动
4. plan setting 变动

这些入口的行为必须固定如下，后续实现不得偏离。

## 场景行为矩阵

### plan 初始化

必须：

1. 计算 flow
2. 计算 semantics
3. 写入同一个 planning derived map

### archive 初始化

必须：

1. 计算 flow
2. 将 archive 自带 semantics 写入 map
3. 当 archive 字段不完整时补齐 semantics

不得：

1. 建立 archive module 变动触发 semantics 重算的路径

### plan module 变动

必须：

1. 更新 flow
2. 更新 semantics

### plan setting 变动

必须：

1. 只更新 flow

不得：

1. 更新 semantics

## 命名规则

### map 层命名

必须纯用功能命名，不得使用身份命名。

map 层接口命名必须使用以下功能名：

- `compute`
- `setSemantics`
- `patchCache`
- `getCache`
- `updateAggregation`
- `remove`
- `clear`

禁止：

- `computeSemanticForPlan`
- `computeSemanticForArchive`
- `computePlanSemantics`
- `computeArchiveSemantics`

### 上层命名

store / logic 层必须使用以下身份型入口名来承担来源分流：

- `initializePlanDerived`
- `initializeArchiveDerived`
- `recomputePlanStationDerived`
- `recomputePlanStationFlowOnly`
- `buildPlanStationSemantics`
- `buildArchiveStationSemantics`

## 执行要求

后续 agent 必须先按本文件清理边界，再继续实现任何新的 semantic/cache 行为。

不得先继续补功能，再回头修边界。
