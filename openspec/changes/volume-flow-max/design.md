# volume-flow-max 设计文档

## 架构概览

本次变更继续遵循 `store -> presenter -> vue` 三层结构。

- `store/logic` 提供唯一的 buffer 占用共享计算逻辑
- `deriveProductionFlows` 复用该逻辑，产出 wareflow / transit-hub volume 视图所需字段
- `calculateInfrastructureModules` 复用同一逻辑，产出 storage module 需求
- `presenter` 继续透传，不新增中间层
- `vue` 继续消费既有字段，不在组件内补做 `sum/max` 判定

## 设计原则

1. volume 占用口径是领域计算，不是 UI 策略，不应由调用方切换。
2. 去重应落在基础 logic 层，而不是让 infrastructure 依赖展示派生结构。
3. 单一公式必须覆盖 station wareflow、transit-hub volume 与 infrastructure storage 三条链路。
4. transport demand 与其他非 volume 公式保持不变，避免变更范围外扩。

## 共享计算设计

建议引入一处共享 helper，例如：

```ts
computeBufferOccupancy({
  flow,
  settings,
  warePriorityLevels
}) => {
  consumptionBufferCount,
  productionBufferCount,
  totalOccupiedCount,
  totalOccupiedVolume
}
```

其职责仅包括：

- 根据 `flow.consumption` 与 `resourceBufferHours` 计算 `consumptionBufferCount`
- 根据 `flow.netRate`、priority 与 product buffer hours 计算 `productionBufferCount`
- 使用 `Math.max` 计算 `totalOccupiedCount`
- 根据 `unitVolume` 计算 `totalOccupiedVolume`

其职责明确不包括：

- name 补全
- price / netValue 计算
- contribution 展示字段组装
- transport demand 计算

## 接入点

### 1. deriveProductionFlows

`deriveProductionFlows` 继续负责展示派生，但不再自己维护 buffer 占用公式。

它应：

1. 调共享 helper 取得 `consumptionBufferCount / productionBufferCount / totalOccupiedCount / totalOccupiedVolume`
2. 将结果写回 `DerivedProductionFlow`
3. 移除 `volumeContributionMethod` 及其默认值、分支判断与透传需求

### 2. calculateInfrastructureModules

`calculateInfrastructureModules` 继续基于基础 `WareProductionFlow[]` 工作。

它应：

1. 调共享 helper 获取每个 ware 的 `totalOccupiedVolume`
2. 按 `transportType` 聚合 storageNeeds
3. 保持后续 berth / pier 计算逻辑不变

这样可以避免：

- infrastructure 反向依赖 `DerivedProductionFlow`
- 为了去重把展示 DTO 变成基础计算输入
- transit / station / infrastructure 三处再度分叉

## 影响面说明

### 1. Station Wareflow

station wareflow volume 相关字段会改为统一 `max` 口径，因此中间面板中的 volume 展示会变化。

### 2. Transit Hub

transit-hub 的 volume 视图同样经由 `deriveProductionFlows` 读取占用信息，因此也会切到统一 `max` 口径。

### 3. Infrastructure Modules

auto infrastructure modules 中的 storage module 需求计算同样会切到统一 `max` 口径。

## 不采用的方案

### 1. 保留 `sum/max` 可切换

不采用。原因：

- volume 占用应是单一业务真相，不应由不同页面选不同口径
- 切换能力会把一致性问题长期保留下来

### 2. 让 infrastructure 直接消费 `DerivedProductionFlow`

不采用。原因：

- 这会让基础计算依赖展示派生 DTO
- `DerivedProductionFlow` 附带 name / value / UI 细节，不适合作为 infrastructure 的核心输入
- 与项目要求的层次边界不一致
