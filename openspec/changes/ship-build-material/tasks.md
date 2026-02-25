# Tasks: ship-build-material

## 1. Store 数据与计算

- [ ] 1.1 在 ship-build store 增加材料 method 状态与更新动作。
- [ ] 1.2 实现 method 选项聚合（飞船 `production.method` + 装备 `cost.method` 去重）。
- [ ] 1.3 实现飞船材料计算，并应用“选中 method 缺失时 fallback `default`”规则。
- [ ] 1.4 实现装备材料计算（按已选装备统计数量），并应用同一 fallback 规则。
- [ ] 1.5 实现按 ware 汇总的总材料计算（飞船 + 装备合并）。
- [ ] 1.6 实现按装备 ID 聚合的装备分项结构（分项金额与展开材料明细）。
- [ ] 1.7 接入价格倍率估值并确保仅影响金额字段。

## 2. 材料面板 UI

- [ ] 2.1 在 `ShipBuildView` 材料面板接入 method 下拉框。
- [ ] 2.2 渲染“总材料 xxxCr”折叠总览，展开显示 `N x 材料A: xxxCr` 结构。
- [ ] 2.3 渲染“装备A x N xxxCr”折叠分项，展开显示装备材料明细。
- [ ] 2.4 在面板底部接入独立材料价格滑条并与金额联动。
- [ ] 2.5 对齐 `StationDashboard` 风格并保持滚动/折叠交互一致性。

## 3. 文案与可测试性

- [ ] 3.1 新增 ship-build 材料面板独立 i18n 键（中英）。
- [ ] 3.2 为 method 下拉、总览行、分项行、价格滑条补充稳定测试定位标识。
- [ ] 3.3 确认测试状态命名与 `ship-build-equipment` 基线保持兼容。

## 4. 构建校验（实现阶段执行）

- [ ] 4.1 完成实现后执行 `npm run build`。
- [ ] 4.2 若构建失败，修复后重复执行直至通过或形成阻塞说明。
