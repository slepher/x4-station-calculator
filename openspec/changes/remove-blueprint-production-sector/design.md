# design.md

## Architecture

### 组件层次

```
src/components/empire/
├── StationTabBar.vue              # 新建（简化版，无星区）
├── SectorStationTabBar.vue        # 重命名自 StationTabBar.vue
├── composables/
│   ├── useStationTabBarModel.ts   # 新建（简化版）
│   └── useSectorStationTabBarModel.ts  # 重命名自 useStationTabBarModel.ts
```

### Store 层次

```
src/store/
├── useBlueprintProductionStore.ts  # 剥离星区属性/方法
├── useLiveProductionStore.ts       # 保留星区功能（不变）
```

### 视图层次

```
src/components/empire/
├── BlueprintProductionWorkbenchView.vue  # 简化：移除 Transit/Overview
├── LiveProductionWorkbenchView.vue       # 使用 SectorStationTabBar（不变）
```

## Decisions

### D1: 组件命名策略

- `SectorStationTabBar` 明确表达"带星区功能的 StationTabBar"
- `StationTabBar` 作为默认简化版本，适合无星区场景

### D2: Store 属性映射

| BlueprintProduction（移除后） | LiveProduction（保留） |
|-------------------------------|------------------------|
| `orderedStations` | `orderedStationsBySector` |
| 无 `sectors` | `sectors` |
| 无 `activeTransitSectorId` | `activeTransitSectorId` |
| 无 Transit Hub 方法 | `getTransitHubViewModel` |

### D3: 视图简化策略

BlueprintProductionWorkbenchView 简化后的布局：

```
┌─────────────────────────────────────────────────────┐
│ StationTabBar（站点列表，无星区）                      │
├─────────────────────────────────────────────────────┤
│ ContextToolbar                                       │
├─────────────────────────────────────────────────────┤
│ ┌─────────┬─────────────────┬─────────────┐         │
│ │ Planning│ WareFlows       │ Dashboard   │         │
│ │ Panel   │                 │             │         │
│ └─────────┴─────────────────┴─────────────┘         │
└─────────────────────────────────────────────────────┘
```

移除：
- Transit Hub 三栏视图（`activeTransitSectorId` 分支）
- Overview 视图（`isOverview` 分支）

### D4: empireSourceView 适配

`createEmpireSourceView` 已支持两种模式：
- `productionSource: 'empire'` → Blueprint（有 `sectors` 但不使用）
- `productionSource: 'save-binding'` → Live（`sectors` 来自 Binding）

BlueprintProduction 需在 Store 层主动忽略 `sectors` 相关输出，不修改 `createEmpireSourceView`。

### D5: empireFlowFacade 适配

BlueprintProduction 移除 `flowFacade` 的星区相关输出：
- 移除 `empireGroupedFlows`
- 移除 `sectorInternalDataMap`、`sectorLinkCalcMap`
- 保留 `stationFlowCache`（站点级计算）

## File Changes

### Files to Rename

| Original | New |
|----------|-----|
| `src/components/empire/StationTabBar.vue` | `src/components/empire/SectorStationTabBar.vue` |
| `src/components/empire/composables/useStationTabBarModel.ts` | `src/components/empire/composables/useSectorStationTabBarModel.ts` |

### Files to Create

| Path | Purpose |
|------|---------|
| `src/components/empire/StationTabBar.vue` | 简化版，无星区分组 |
| `src/components/empire/composables/useStationTabBarModel.ts` | 简化版，仅站点列表 |

### Files to Modify

| Path | Changes |
|------|---------|
| `src/store/useBlueprintProductionStore.ts` | 移除星区属性/方法 |
| `src/components/empire/BlueprintProductionWorkbenchView.vue` | 使用新 StationTabBar，移除 Transit/Overview |
| `src/components/empire/LiveProductionWorkbenchView.vue` | import 改为 SectorStationTabBar |

## Risks

### R1: 现有测试依赖

- E2E 测试可能使用 `StationTabBar` 选择器
- 需更新测试文件中的 import 和选择器（Out of Scope，后续处理）

### R2: 类型兼容性

- `ProductionTabItem` 的 `sectorId` 字段在 Blueprint 场景下未使用
- 简化版 `useStationTabBarModel` 的 props 类型需兼容