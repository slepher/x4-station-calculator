## 1. Change 初始化与约束固化

- [x] 1.1 创建 `openspec/changes/refactory-ship-map/`
- [x] 1.2 完成 `request.md` 并固化 In/Out Scope 与 DoD
- [x] 1.3 完成 `specs/refactory-ship-map/spec.md`
- [x] 1.4 完成 `design.md`

## 2. P0（已完成）Ship 查询入口收敛

- [x] 2.1 `useShipBuildStore` 新增 `findShip(shipId)`
- [x] 2.2 store 内 ship id 查找路径切换到 `findShip`
- [x] 2.3 `ShipBuildSelector` 改为直接读取 store `shipMap`
- [x] 2.4 `ShipBuildSelectorView` 移除 `shipMap` 透传

## 3. P1（已完成）Equipment 查询入口收敛

- [x] 3.1 新增 `findEquipment(equipmentId)`
- [x] 3.2 新增 `findEquipmentType(typeId)`
- [x] 3.3 替换 `LoadShipBlueprintModal` 中 `equipmentTypes.find/equipments.find`
- [x] 3.4 替换 `ShipBuildPanelFit` 中重复 equipment 查找路径

## 4. P2（已完成）Wares 查询入口收敛

- [x] 4.1 store 导出 `wareMap` 与 `findWare(wareId)`
- [x] 4.2 替换 `ShipBuildPanelMaterials` 本地 `wareMap` 构建

## 5. P3（已完成）数组保留策略验证

- [x] 5.1 盘点 `shipTypes/shipRaces/equipmentTypes` 的纯列表用途
- [x] 5.2 明确保留数组直出，不做无收益 map 化
- [x] 5.3 在文档中记录“列表 vs 查找”边界（shipTypes/shipRaces 保留列表入口，id 查找走 find/map）

## 6. P4（已完成）后续收敛与单链路

- [x] 6.1 `buildShipBuildDatas` 统一 ship-build map 数据构建入口
- [x] 6.2 新增 `buildConsumableDatas`，在 store 初始化并导出 consumables/drones/missiles 的 list+map
- [x] 6.3 `ShipBuildPanelStats` 与 `ShipBuildPanelMaterials` 迁移到 store `findXxx`/map
- [x] 6.4 `ShipBuildPanelFit` 删除 `slotTargets[].options`，候选收敛到 `extractEquipmentSlotCandidatesWithFacets(...)`
- [x] 6.5 删除候选数量 UI 与单候选自动填充废弃分支

## 7. 验证与收尾

- [x] 7.1 运行 `pnpm run build` 验证当前阶段通过
- [x] 7.2 完成 P1/P2 后再次构建验证
- [x] 7.3 更新 `guide/functions.md` 对应引用关系
