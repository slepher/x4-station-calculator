## Why

当前 `useStationStore` 与 `useEmpireStore` 之间采用“双向同步 + 双份计算”的模式，导致状态一致性和可维护性风险持续上升。随着多分站功能扩展，继续叠加 watch 同步会让切站、缓存刷新和聚合统计更难保证正确性，因此需要尽快收敛为单一真源。

## What Changes

- 引入 `StationStateMap` 运行态容器（按 `stationId` 管理每站状态）并统一承载：`plannedModules`、`autoIndustryModules`、资源产出/消耗计算结果等。
- 将 `useStationStore` 改为基于 `currentStationId` 的代理 Store，保留现有对 UI 的主要 API 名称，避免组件大规模重写。
- 重构 `useEmpireStore` 的站点缓存路径，改为读取 `StationStateMap` 的分站计算结果进行帝国聚合，移除重复计算实现。
- 明确分站生命周期与状态容器生命周期的同步策略（create/duplicate/delete/select）。
- 统一持久化边界：仅持久化可编辑数据，派生与计算结果按需重算。

## Capabilities

### New Capabilities
- `station-state-map`: 引入分站级统一运行态映射，提供单一真源与可复用计算入口

### Modified Capabilities
- `station-workbench`: 分站视图数据绑定调整为通过 `currentStationId` 代理访问，保持切站隔离与渲染一致性
- `empire-management`: 帝国层的分站流缓存与聚合来源调整为 `StationStateMap`，避免重复计算漂移

## Impact

- **Store**: `src/store/useStationStore.ts`, `src/store/useEmpireStore.ts`
- **State Runtime**: 新增 `src/store/state/StationStateMap.ts`（及相关类型）
- **Logic**: 复用现有 `calculateAutoFill`, `analyzeWareFlow`, `production/workforce` 计算链；聚合层改为消费统一结果
- **Components**: 主要保持 API 兼容；重点验证 `StationPlanningPanel` 对 `plannedModules` 的可写绑定
- **Tests**: 需要新增/更新分站隔离、切站一致性、帝国聚合一致性与持久化回归用例
