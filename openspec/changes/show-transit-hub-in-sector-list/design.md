# show-transit-hub-in-sector-list Design

## 背景

`liveStationResolver.ts` 中的 `deriveBindingStationsFromRecords()` 函数在构建 `derivedBindingStations` 列表时，会收集所有 group 的 `tradeStation.saveStationCode` 到一个 `tradestationCodes` Set，然后遍历 `coveredCodes` 时跳过匹配的 station。

该排除逻辑导致 transit hub station 无法出现在：
- `orderedStationsBySector` → 侧边栏星区 station 列表
- `empireFlowFacade` → 产量流分析中的 station 列表
- 所有消费 `derivedBindingStations` 的地方

本变更移除该排除逻辑，让 transit hub station 照常出现在星区列表中。

## 改动点

### `src/store/logic/liveStationResolver.ts`

删除两个代码块：

1. L126-131: `tradestationCodes` 集合构建逻辑
2. L140: `if (tradestationCodes.has(code)) return` 跳过逻辑

### 不改动的文件

- `src/components/empire/presenters/useTransitTransportPresenter.ts`: 运输栏 `Station` 分类保留 transit hub 排除逻辑。

## 影响分析

改动后 transit hub station 会：

- 出现在 `derivedBindingStations` 中
- 在 sidebar 中同时有 `transit` tab 和 `station` tab（不同 ID，不冲突）
- 参与产量流分析
