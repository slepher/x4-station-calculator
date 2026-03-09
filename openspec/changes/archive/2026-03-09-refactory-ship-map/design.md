# Design: refactory-ship-map

## 架构目标

将 ship-build 的查询边界分成三层并保持单一职责：

1. `useGameData.ts`：原始数据加载与 map 构建。
2. `useShipBuildStore.ts`：状态与实体查询入口（find）。
3. `shipEquipmentPicker.ts` / `domain-data/ship-build-queries.ts`：纯筛选与候选提取函数（query）。

## 关键决策

### 1. 查找统一走 find

- 约束：凡是 `id -> entity` 的读取，优先走 store `findXxx`。
- 目的：避免组件层重复 `array.find` 与重复局部 map 构建。

### 2. 列表遍历保留数组

- 约束：用于渲染 options/list 的路径，保留数组作为入口。
- 目的：避免为了遍历引入额外 map->array 转换。

### 3. map 作为高频查找缓存

- `shipMap/raceMap/typeMap/equipmentMap` 由 store 初始化时一次构建。
- `wareMap/equipmentTypeMap` 同步由 store 暴露 `findXxx` 与 map，组件层不再重复构建本地 map。

## 当前使用现状（用于指导重构）

### 按 id 查找高频

- `LoadShipBlueprintModal`：已替换为 `findEquipmentType/findEquipment`。
- `ShipBuildPanelFit`：已替换为 `findEquipment/findEquipmentType`，已选名称不再依赖本地候选缓存。

### 重复 map 构建

- `ShipBuildPanelMaterials`：已迁移到 store `findWare/findShip/findEquipment` 与 consumables maps。
- `ShipBuildPanelStats`：已迁移到 store `findShip/findEquipment`。

### 列表渲染入口

- `ShipBuildSelector`：直接从 store 读取 `shipTypes/shipRaces`；`ShipBuildSelectorView` 仅透传筛选状态。

## 分步重构方案（逐项）

1. P0 已完成：`findShip` + `ShipBuildSelector` 直接读 store `shipMap`。
2. P1：在 store 增加 `findEquipment/findEquipmentType`，替换 modal 与 fit 的 `find`。
3. P2：在 store 导出 `wareMap`（或 `findWare`），替换 materials 内本地 `wareMap` 构建。
4. P3：评估 `shipTypes/shipRaces/equipmentTypes` 是否仍需数组直出；若仅列表用途则保留数组，不强行 map 化。
5. P4：`ShipBuildPanelFit` 删除 `slotTargets[].options`，候选数据收敛到 `extractEquipmentSlotCandidatesWithFacets(...)`。
6. P5：统一文档与函数引用（guide/functions.md + change tasks 勾选同步）。

## 风险与回滚

- 风险：组件改为 store 直读后，隐式耦合增强。
- 缓解：只在 `id 查找` 场景直读 store；筛选纯函数保持参数化。
- 回滚：每个阶段独立提交，可按文件回退，不影响数据结构。
