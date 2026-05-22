# Empire Sector Flows Cache

## 目标

让 `StationDerivedMap.updateAggregation()` 对 `empireFlowsCache` 和 `sectorFlowsCache` 做 count 乘法，并使 facade 层从此读缓存获取聚合数据，消除 `analyzeEmpireWareFlow` 的重复计算。

**核心原则：所有级别（station / sector / empire）的缓存类型一致，都是 `WareProductionFlow[]`。** `EmpireGroupedFlows`（含分类 / 价格）由 facade 层在读缓存后构建，不进入 `StationDerivedMap`。

## 方案

### 0. 构造函数扩展 `hasSector`

```typescript
constructor(staticDeps, options?: { hasSector?: boolean })
```

- `hasSector = false`（blueprint 侧）：只维护 `empireFlowsCache`
- `hasSector = true`（live 侧）：维护全部 3 份缓存 + 运行 solver
- 能力区分而非 store 类型区分

### 1. `StationDerivedSeed` 增加 `count`

- `StationDerivedSeed` 新增可选 `count?: number`，默认 1。
- `StationDerivedSnapshot` 已有 `count` 字段（当前硬编码 1），改为从 seed 读取。
- `upsertStation()` 从 seed 读取 `count` 并存入 snapshot。
- `count` 影响 `updateAggregation()` 中 flow 的乘法计算（`flow * count`）。
- Blueprint 侧传入（`useBlueprintProductionStore` 3 处 + `productionStationShared` 1 处），live 侧不传（默认 1）。

### 2. `updateAggregation()` 产出 3 份 `WareProductionFlow[]` 缓存

| 缓存 | 类型 | hasSector=false | hasSector=true | 说明 |
|---|---|---|---|---|
| `empireFlowsCache` | `WareProductionFlow[]` | ✓ count 加权 | ✓ count 加权 | empire 概览 |
| `sectorFlowsCache` | `Map<sectorId, WareProductionFlow[]>` | — | ✓ count 加权 | local 贡献 |
| `sectorExternalCache` | `Map<sectorId, WareProductionFlow[]>` | — | ✓ | solver 物流输出 |

构建顺序（`hasSector=true`）：
1. 遍历 snapshotMap，count 加权 merge → `empireFlowsCache` + `sectorFlowsCache`
2. 从 `sectorFlowsCache` 提取 container netByWare → `solveMultiWareByLink()`
3. solver 输出 → `WareProductionFlow[]` → `sectorExternalCache`

3 份缓存类型一致，均为 `WareProductionFlow[]`，不包含价格。

### 3. `getEmpireGroupedFlows()` 从 StationDerivedMap 删除

- `analyzeEmpireWareFlow` 的 import 删除
- 保留/新增 getter：

| getter | 来源 |
|---|---|
| `getEmpireFlows()` | 保留 |
| `getSectorFlows(sectorId)` | 保留（内容不变，但已包含 count 加权） |
| `getSectorExternalFlows(sectorId)` | 新增 |

### 4. Facade 层读缓存 + 分类 + 价格补全

Empire 分支（共用）：
```
flowMap.getEmpireFlows() → classifyAndEnrich() → empireGroupedFlows
```

Sector local 分支（live 侧）：
```
flowMap.getSectorFlows(sectorId) → classifyAndEnrich() → rawSectorGroupedFlowsMap
  └── sectorInternalDataMap 从此读（gap 分析）
```

Sector 含物流（live 侧）：
```
mergeFlows([getSectorFlows(sectorId), getSectorExternalFlows(sectorId)]) → getSectorFinalProductionFlows
  └── TransitHubCenterDashboard 从此读
```

`modulesMap` guard 移除，`waresMap` guard 保留（价格补全需要）。
**不再需要 facade 层** `sectorLinkCalcMap` computed 和 `mergeSectorLinkIntoEmpireGroupedFlows`。

### 5. `filterFn` 的去向

当前 facade 传入的 `filterFn` 与 `filterProductionFlowsByPriority` 逻辑一致。该过滤已在 `updateAggregation()` 中处理，调用侧不再需要。

### 6. 缓存失效与刷新

- `updateAggregation()` 在每次 `computeInternal` 后调用（`skipAggregation=false`），保持现有刷新策略
- `refreshAll()` / `clear()` 等生命周期方法同步更新新缓存
- `removeStation()` 后不自动更新，由上层触发下一次 `computeInternal` 时重建（与当前一致）

## 边界

### In Scope

- `StationDerivedSeed` 增加 `count` 字段（blueprint 侧 4 处传入）
- `StationDerivedMap` 构造函数扩展 `hasSector` 选项
- `staticDeps` 扩展 `sectorLinks` + solver 相关依赖（`hasSector=true` 时需要）
- `updateAggregation()` 按 `hasSector` 分支产出：`empireFlowsCache` / `sectorFlowsCache` / `sectorExternalCache`
- 删除 `getEmpireGroupedFlows()` 方法
- 保留 `getEmpireFlows()` / `getSectorFlows()`，新增 `getSectorExternalFlows()`
- `analyzeEmpireWareFlow` 从 StationDerivedMap 的 import 中移除
- facade `empireGroupedFlows` computed 改读 `getEmpireFlows()` + 分类 + 价格补全
- facade `rawSectorGroupedFlowsMap` computed 改读 `getSectorFlows()` + 分类 + 价格补全
- facade `getSectorFinalProductionFlows` 改读 `sectorFlowsCache` + `sectorExternalCache` merge
- facade `sectorLinkCalcMap` computed 删除（solver 不在 facade）
- facade `mergeSectorLinkIntoEmpireGroupedFlows` 删除
- `clear()` / `refreshAll()` 生命周期适配

### Out of Scope

- `FlowContribution` 类型变更（属于 `one-flow-contribution`）
- `workforceConsumption` 字段消除
- 测试代码编写与执行
- save-binding 路径的缓存改造
- `useEmpireWareFlowDerived.ts` 中独立的 `analyzeEmpireWareFlow` 调用

## 验收标准（DoD）

1. `StationDerivedMap` 构造函数支持 `hasSector` 选项
2. `StationDerivedSnapshot.count` 从 seed 读取而非硬编码 1
3. Blueprint 侧 upsertStation 传入 `count`（P1/P2/P3/P8），live 侧默认 1
4. `updateAggregation()` 按 `hasSector` 分支产出对应缓存
5. `getEmpireGroupedFlows()` 从 StationDerivedMap 删除
6. `getEmpireFlows()` / `getSectorFlows()` 保留，`getSectorExternalFlows()` 新增
7. facade 3 个入口改读缓存：empire（共用）、sector local（live）、sector 含物流（live）
8. facade 删除 `sectorLinkCalcMap` 和 `mergeSectorLinkIntoEmpireGroupedFlows`
9. `sectorInternalDataMap` 等下游消费者正常工作
10. `clear()` / `refreshAll()` 正确管理生命周期
11. `npm run build` 通过

## 依赖

- 前置依赖：`one-flow-contribution`（`FlowContribution` 类型变更先行）
