# Live Cargo Volume - Design

## Architecture

```
Rust save parser
  └─ playerStation.overrides
       ├─ max
       ├─ buy
       └─ sell
            │
            └─→ saveArchive types / postProcessRustSaveArchive
                  └─→ useLiveProductionStore.archiveStation
                        ├─ cargo
                        ├─ overrides.max
                        ├─ derivedProductionFlows
                        ├─ liveVolumeAllocationGroups
                        └─ liveCargoOnlyItems
                              │
                              └─→ useProductionWareflowPresenter
                                    └─→ StationWareFlowsDashboard
                                          └─→ LiveStationAllocationView
```

## 设计原则

1. `targetCount` 直接采用 save 中的真实仓储目标，不再使用过渡替代值。
2. `overrides.max` 是 live volume 目标分配的唯一目标来源。
3. `overrides.buy` 与 `overrides.sell` 本次必须被解析并透传，但不在第一版 UI 中额外渲染。
4. presenter 和 Vue 不做 fallback 链；缺失 target 时由 store 明确给 `0`。

## Parser Design

### Rust model

在 `PlayerStationEntry` 新增：

```rust
struct StationTradeOverrides {
  max: Vec<WareAmount>,
  buy: Vec<WareAmount>,
  sell: Vec<WareAmount>,
}
```

并在 `PlayerStationEntry` 中透传：

```rust
overrides: Option<StationTradeOverrides>
```

### XML 解析口径

仅解析 player station 下的：

```xml
<overrides>
  <max><ware ... /></max>
  <buy><ware ... /></buy>
  <sell><ware ... /></sell>
</overrides>
```

不从 `<trade>` 的报价单、`desired`、`amount` 推导目标分配。

### 聚合规则

1. 以 `ware` 为 key 聚合 `amount`
2. 输出为按 `ware` 升序排序的 `WareAmount[]`
3. 三个列表都为空时，`overrides` 字段省略

## Store Design

### 新增 archive target data

`ArchiveStationData` 新增：

```typescript
interface ArchiveStationData {
  overrides?: StationTradeOverrides
  targetCounts?: WareAmount[]
}
```

其中：

```typescript
targetCounts = overrides?.max
```

### live allocation 数据来源

#### currentCount

来源：

```typescript
archiveStation.cargo
```

`reservation` 不参与。

#### targetCount

来源：

```typescript
archiveStation.targetCounts
```

如果某个 ware 没有 override：

```typescript
targetCount = 0
```

#### recommendedCount

来源：

```typescript
DerivedProductionFlow.totalOccupiedCount
```

### cargo-only section

判定口径：

```typescript
isCargoOnly = currentCount > 0 && wareId not in current production/consumption list
```

显示口径：

```typescript
currentCount = cargoMap[wareId] ?? 0
targetCount = targetMap[wareId] ?? 0
```

不允许再写：

```typescript
targetCount = currentCount
```

## Presenter Design

`useProductionWareflowPresenter` 继续只透传 store 的最终 allocation view model：

- `liveVolumeAllocationGroups`
- `liveCargoOnlyItems`

Presenter 不参与：

- save override 解析
- target fallback
- cargo 和 flow 的手工 join

## Vue Design

### StationWareFlowsDashboard

在 `viewMode === 'volume'` 时：

- `visualMode === 'live'` → `LiveStationAllocationView`
- `visualMode === 'planning'` → 旧 volume 视图

### LiveStationAllocationView

职责：

1. 渲染 `container / solid / liquid` 三组
2. 渲染组头 `Cur / Tar / Rec`
3. 每行使用与现有 `StationWareFlow` 接近的壳样式
4. 进度条主体显示 `currentCount / targetCount`
5. `recommendedCount` 继续按原 volume 行接近的数字风格显示
6. 展开区按四张卡片显示：`填满-当前 / 填满-空 / 消耗 / 下游`
7. 填满卡片显示 `每小时量 / 设定 / 推荐`
8. 消耗与下游卡片显示 `每小时量 / 当前 / 设定 / 推荐`
9. `Downstream` 默认折叠
10. 渲染 cargo-only bottom section

### 比例尺

```typescript
scaleMaxCount = max(currentCount, targetCount, recommendedCount)
```

### 展开时间明细

Store 负责直接产出每个 ware 的明细行：

1. `Fill From Current`
   - 从当前库存开始净填满
   - 从当前库存开始总填满
2. `Fill From Empty`
   - 从空库存开始净填满
   - 从空库存开始总填满
3. `Drain`
   - 从当前库存开始净耗尽
   - 从当前库存开始总耗尽
   - 从设定库存开始净耗尽
   - 从设定库存开始总耗尽
   - 从推荐库存开始净耗尽
   - 从推荐库存开始总耗尽
4. `Downstream`
   - 各个下游模块纯消耗库存时间

明细行为：

- 填满卡片不显示 `当前` 列
- 消耗与下游卡片显示 `当前 / 设定 / 推荐` 三列时间
- 若某项两列都不存在，则整行省略
- 下游项按 consumption contribution 逐项展开
- `Downstream` 默认折叠

## Testing

1. Rust 单测验证 `player station overrides.max/buy/sell` 解析成功。
2. TS 单测验证 `postProcessRustSaveArchive` 后 `playerStations.overrides` 保持不丢失。
3. 后续 UI 落地时再补 `useLiveProductionStore` 和 `live + volume` 视图测试。
