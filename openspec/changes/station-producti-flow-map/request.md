# Station Production Flow Map

## 目标

将 ProductionFlow 计算逻辑从 `StationStateMap` 中拆分，创建独立的 `StationProductionFlowMap` 专门处理 flow 计算，支持 sector/empire 级别聚合查询。

## 已确认方案（审核重点）

### 数据架构

1. **新建独立对象**：`StationProductionFlowMap` 作为独立响应式对象（类似 `StationStateMap`）
2. **存储结构**：`Map<stationId, WareProductionFlow[]>`
3. **聚合缓存**：内置预计算聚合数据
   - `empireFlowsCache: WareProductionFlow[]` - empire 级别合并 flows
   - `sectorFlowsCache: Map<string, WareProductionFlow[]>` - sector 级别合并 flows

### 计算逻辑

1. **数据来源**：直接读取 `StationPlan`（modules/settings），独立调用 `calculateProductionFlows`
2. **触发时机**：
   - modules 变更时重新计算
   - settings 变更时重新计算
   - 配合 `StationStateMap.recompute()` 执行
3. **载入时行为**：调用 `computeAll(empire, deps)` 一次性计算所有 station flows，并预计算聚合数据

### 查询接口

| 方法 | 返回值 | 用途 |
|------|--------|------|
| `getStationFlows(stationId)` | `WareProductionFlow[]` | 单站 flow 数据 |
| `getSectorFlows(sectorId)` | `WareProductionFlow[]` | sector 所有 station 合并 flows |
| `getEmpireFlows()` | `WareProductionFlow[]` | empire 所有 station 合并 flows |
| `getGrouped(stationId)` | `GroupedFlows` | 单站 grouped flows（含 rateGroups/volumeGroups） |

### StationStateMap 改动

**直接移除**以下内容：
- `productionFlows` 字段
- `getProductionFlows()` / `getFilteredProductionFlows()`
- `getGroupedFlows()` / `getFilteredGroupedFlows()`
- Helper 函数：`groupProductionFlows` / `filterProductionFlowsByPriority` / `convertProductionFlowToWareFlow`

**保留**以下内容：
- 状态管理字段：`plannedModules`, `lockedWares`, `warePriority`, `settings`
- `autoIndustryModules`, `actualWorkforce`, `currentEfficiency`
- `stationAnalysis` 计算
- `warePriorityLevels` 计算
- `recompute()` 核心逻辑（调用 `calculateProductionFlows` 获取结果，但不存储 flows）

### 聚合计算方式

合并多个 station 的 `productionFlows`：
- 按 `wareId` 合并，累加 `production/consumption/netRate`
- 保持 `contributions` 来源追溯（moduleId + stationId 标记）
- 按 `tier` 降序 + `netRate` 绝对值排序

## 边界

### In Scope

- `StationProductionFlowMap` 创建和实现
- `StationStateMap` flow 相关逻辑移除
- `useStationStore` 调用方更新
- empire 载入时的 `computeAll()` 集成
- sector/empire 聚合计算

### Out of Scope

- `activeStation` 改动（保持现有职责）
- `stationAnalysis` 计算（保留在 StationStateMap）
- LogicFlowStore 改动
- UI 组件改动（除数据获取路径变更外）

## 验收标准（DoD）

1. `StationProductionFlowMap.compute(stationId, deps)` 可独立计算单站 flows
2. `getStationFlows(stationId)` 返回正确的单站 flows
3. `getSectorFlows(sectorId)` 返回 sector 所有 station 合并 flows
4. `getEmpireFlows()` 返回 empire 所有 station 合并 flows
5. `getGrouped(stationId)` 返回正确的 `GroupedFlows`
6. `StationStateMap` 无 `productionFlows` 字段和相关 getter 方法
7. `StationStateMap.recompute()` 仍能正确计算 autoIndustryModules/stationAnalysis
8. empire 载入时自动调用 `computeAll()` 预计算所有数据
9. UI 流量面板（dashboard/toolbar）正常显示 flow 数据
10. `npm run build` 通过，无 TypeScript 错误

## 未决项

无