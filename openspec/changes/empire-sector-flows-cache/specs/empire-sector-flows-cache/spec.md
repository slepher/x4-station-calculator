# Empire Sector Flows Cache Specification

## Purpose

Enable `StationDerivedMap.updateAggregation()` to produce count-weighted `WareProductionFlow[]` caches (3 tiers: empire / sector-local / sector-external), and make facade read these caches instead of recomputing `analyzeEmpireWareFlow`.

**Design constraints:**
- All cache levels use the same data type `WareProductionFlow[]`
- Classification into `EmpireGroupedFlows` (supply/operations + prices) is done by facade
- `StationDerivedMap` constructor accepts `hasSector` option to distinguish cache tiers

## ADDED Requirements

### Requirement: hasSector 选项

#### Scenario: hasSector=false

**Given** `StationDerivedMap` 构造时 `hasSector` 为 `false` 或不传
**When** `updateAggregation()` 执行
**Then** 只产出 `empireFlowsCache: WareProductionFlow[]`
**And** 不产出 `sectorFlowsCache` / `sectorExternalCache`
**And** solver 不运行

#### Scenario: hasSector=true

**Given** `StationDerivedMap` 构造时 `hasSector` 为 `true`
**When** `updateAggregation()` 执行
**Then** 产出 `empireFlowsCache` + `sectorFlowsCache` + `sectorExternalCache`
**And** solver 运行，结果写入 `sectorExternalCache`

### Requirement: StationDerivedSeed 增加 count

#### Scenario: count 可选默认 1

**Given** `StationDerivedSeed` 定义
**When** 创建 seed 时不传 `count`
**Then** `snapshot.count` 默认为 1

#### Scenario: count 影响 flow 聚合

**Given** station 的 `count > 1`
**When** `updateAggregation()` 构建缓存
**Then** 该 station 每条 flow 的 `production/consumption/netRate` 乘以 `count`
**And** `contributions[].amount` 也乘以 `count`

#### Scenario: count 仅 blueprint 侧传入

**Given** live 侧 upsertStation 调用
**When** 不传 `count`
**Then** `snapshot.count` = 1（计算结果不变）

### Requirement: 3 份缓存的构建规则

#### Scenario: empireFlowsCache

**Given** `updateAggregation()` 执行
**When** 无论 `hasSector` 为何值
**Then** `empireFlowsCache` 为全 empire 所有 station 的 count 加权 merge

#### Scenario: sectorFlowsCache（local only）

**Given** `hasSector = true` 时 `updateAggregation()` 执行
**When** 按 `sectorId` 分组合并
**Then** `sectorFlowsCache` 为 `Map<sectorId, WareProductionFlow[]>`
**And** 每条 flow 的 `contributions` 中的 `id` 均为实际 stationId（class='station'）

#### Scenario: sectorExternalCache（solver output）

**Given** `hasSector = true` 时 `updateAggregation()` 执行
**When** solver 运行后
**Then** `sectorExternalCache` 为 `Map<sectorId, WareProductionFlow[]>`
**And** 每条 flow 的 `contributions` 中的 `id` 为 `external:<peerSectorId>`（跨星区物流）
**And** 不存在的 sector 返回 `[]`

### Requirement: getter API

#### Scenario: 删除 getEmpireGroupedFlows

**Given** `StationDerivedMap` 实例
**When** 调用 `getEmpireGroupedFlows()`
**Then** 编译错误（方法已删除）

#### Scenario: 保留 getEmpireFlows

**Given** `updateAggregation()` 已执行
**When** 调用 `getEmpireFlows()`
**Then** 返回 `empireFlowsCache`（`WareProductionFlow[]`）

#### Scenario: 保留 getSectorFlows

**Given** `updateAggregation()` 已执行
**When** 调用 `getSectorFlows(sectorId)`
**Then** 返回该 sector 的 `WareProductionFlow[]`（不存在返回 `[]`）

#### Scenario: 新增 getSectorExternalFlows

**Given** `updateAggregation()` 已执行
**When** 调用 `getSectorExternalFlows(sectorId)`
**Then** 返回该 sector 的 external `WareProductionFlow[]`（不存在返回 `[]`）

#### Scenario: 新增 getSectorCombinedFlows

**Given** `updateAggregation()` 已执行
**When** 调用 `getSectorCombinedFlows(sectorId)`
**Then** 返回 `mergeFlows([getSectorFlows(sectorId), getSectorExternalFlows(sectorId)])`

### Requirement: Facade 层读缓存

#### Scenario: empireGroupedFlows（共用）

**Given** facade `empireGroupedFlows` computed
**When** `flowMap.getEmpireFlows()` + `classifyAndEnrichFlows()`
**Then** 返回 `EmpireGroupedFlows`（含分类 + 价格补全）
**And** 不再调 `analyzeEmpireWareFlow` 或 `flowMap.getEmpireGroupedFlows`

#### Scenario: rawSectorGroupedFlowsMap（live 侧）

**Given** facade `rawSectorGroupedFlowsMap` computed
**When** `flowMap.getSectorFlows(sectorId)` + `classifyAndEnrichFlows()`
**Then** 返回 `EmpireGroupedFlows`（仅 local station 贡献）
**And** `sectorInternalDataMap` 从此读，不影响 gap 分析

#### Scenario: getSectorFinalProductionFlows（live 侧）

**Given** `getSectorFinalProductionFlows(sectorId)` 调用
**When** `flowMap.getSectorCombinedFlows(sectorId)`
**Then** 返回 `WareProductionFlow[]`（含 local + external 贡献）
**And** merge 逻辑由 StationDerivedMap 内置的 `mergeFlows` 处理

### Requirement: 删除 facade 旧的 sector link 计算

#### Scenario: sectorLinkCalcMap 删除

**Given** facade 层
**When** 不再需要 `sectorLinkCalcMap` computed
**Then** 删除（solver 移至 StationDerivedMap）

#### Scenario: mergeSectorLinkIntoEmpireGroupedFlows 删除

**Given** facade 层
**When** 不再需要该函数
**Then** 删除（merge 逻辑由 facade 的 `getSectorFinalProductionFlows` 替代）

### Requirement: 生命周期

#### Scenario: clear()

**Given** `clear()` 调用
**When** `hasSector = false`
**Then** `empireFlowsCache` 清空为 `[]`
**When** `hasSector = true`
**Then** 3 份缓存全部清空

#### Scenario: removeStation()

**Given** `removeStation(stationId)` 调用
**Then** `cacheMap` / `snapshotMap` 移除该 station
**But** 3 份缓存不变（stale）
**And** 下次 `computeInternal` + `updateAggregation()` 重建

## REMOVED Requirements

| 删除项 | 原因 |
|---|---|
| `getEmpireGroupedFlows()` 方法 | 移到 facade 层读缓存 |
| `analyzeEmpireWareFlow` 的 import | 不再需要 |
| facade `sectorLinkCalcMap` computed | solver 移至 StationDerivedMap |
| facade `mergeSectorLinkIntoEmpireGroupedFlows` | 由 facade merge 替代 |

## KEPT Requirements

| 保留项 | 变化 |
|---|---|
| `getEmpireFlows()` / `getSectorFlows()` | 含 count 加权 |
| `empireFlowsCache` / `sectorFlowsCache` 字段 | 现在被实际读取 |

## EDGE CASES

#### sectorId 为 null/undefined

**Given** station snapshot 无 `sectorId`
**When** `hasSector = true` 时聚合
**Then** 归类到 `'__no_sector__'` 分组

#### solver 无输出

**Given** 所有 sector 的 container netRate 均为 0
**When** solver 运行
**Then** `sectorExternalCache` 所有值为 `[]`

#### sector 存在但无 station

**Given** 某 sector 无 station 且无物流流入
**When** 读取 `getSectorFlows(sectorId)`
**Then** 返回 `[]`
