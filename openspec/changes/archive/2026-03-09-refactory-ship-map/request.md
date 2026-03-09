# Request: refactory-ship-map

## 目标

将 ship-build 相关“按 id 查找”和“候选筛选”入口收敛为统一的 map/find/query 函数，减少组件侧重复构建 map 和重复 `array.find/forEach`，并保持当前行为结果不变。

## 已确认方案（审核重点）

### 1. Store 查找入口

- 在 `useShipBuildStore` 增加 `findShip(shipId)`，作为飞船按 id 查找的统一入口。
- store 内部已有 `ships.find(...)` 的位置优先改为 `findShip(...)`。

### 2. Ship 选择器数据入口统一

- `ShipBuildSelector` 不再通过 props 接收 `shipMap`。
- `ShipBuildSelector` 直接 `useShipBuildStore()` 读取 store 导出的 `shipMap`。
- `ShipBuildSelectorView` 移除 `:ship-map` 透传。

### 3. 参数来源集中

- ship-build 原始数据统一由 `getShipBuildRawData()` 提供。
- `buildShipBuildDatas` 作为 ship/race/type/equipment 四类 map 构建入口。

### 4. 后续重构方向（本次只定方向，不强制一次性完成）

- 对 `equipments/equipmentTypes/shipTypes/shipRaces/wares` 先做“真实使用点盘点”，再决定是否转为 map/find。
- 只在“按 id 查找”场景推进 find/map；列表渲染类数据保留数组入口。

## 边界

### In Scope

- ship-build 模块内 map/find/query 入口一致性。
- 组件内与 ship/equipment 查找相关的重复 map 构建优化。
- 文档化“哪些参数需要数组、哪些应使用 map/find”。

### Out of Scope

- station/empire/logic-flow 模块的状态结构调整。
- i18n 文案策略和 UI 视觉改版。
- 测试体系重构（仅允许增量补充，不做框架级调整）。

## 验收标准（DoD）

1. `useShipBuildStore` 暴露 `findShip(shipId)`，并被真实业务路径使用。
2. `ShipBuildSelectorView/ShipBuildSelector` 不再通过 props 传递 `shipMap`。
3. `ship-build` 相关构建通过（`pnpm run build`）。
4. 对 `equipments/equipmentTypes/shipTypes/shipRaces/wares` 的真实使用点有可追溯清单。
5. 输出逐项重构方案，包含优先级与每项改动范围。

## 当前状态

- `findShip/findEquipment/findEquipmentType/findWare` 已统一落地并在主要 ship-build 面板接入。
- `ShipBuildPanelFit` 候选来源已收敛到 `extractEquipmentSlotCandidatesWithFacets(...)` 单链路。
- 除移除候选数量显示与单候选自动填充交互外，未引入额外 UI 结构变更。
