# Tasks: abandon-selected-ship

## 1. Store 上下文模型收敛
- [x] 1.1 识别并收敛 ship-build store 中“当前飞船”判定入口，统一以当前 blueprint 为主。
- [x] 1.2 调整 `clearLoadoutForCurrentShip`：新建后保留 `shipId`，仅重置配装内容。
- [x] 1.3 调整 `setSelectedShipId` 相关路径：确认选船后创建/切换到目标 ship 的蓝图上下文。
- [x] 1.4 降级 `selectedShipId` 的业务主语义：本轮不做全量读取点替换，但避免新逻辑继续依赖其可空含义。

## 2. 面板取数口径统一
- [x] 2.1 统一 Stats/Materials 的当前飞船行为口径与 blueprint 一致（允许兼容期读取 `selectedShipId`）。
- [x] 2.2 统一 Selector/Workspace 的上下文桥接逻辑，避免面板间 ship identity 分裂。
- [x] 2.3 新建后材料面板保留船体材料分组，装备/存储按空蓝图显示。

## 3. 入口可达性与保存语义校准
- [x] 3.1 保持未选 ship 时 `New/Save/Save As/Load` 不可达（按钮禁用或流程拦截）。
- [x] 3.2 在非空 blueprint 模型下校准 `isDirty` 快照基线建立时机。
- [x] 3.3 校准 `isEmptyForSave` 与 `requiresSaveAsOnSave` 的行为分支。
- [x] 3.4 确保已选 ship 时 `New/Save/Save As/Load` 在收敛模型下无不可达分支。

## 4. 持久化与迁移联动
- [x] 4.1 校对 ship blueprint 持久化读写路径，保持 `blueprint.shipId` 归属语义。
- [x] 4.2 校对 migration 后初始化流程，保证可进入“非空蓝图工作态”。
- [x] 4.3 校对导入导出调用链，避免遗留对双轨状态的隐式依赖。

## 5. 构建验证
- [x] 5.1 完成实现后执行 `npm run build`。
- [x] 5.2 若构建失败，修复后重复执行 `npm run build`，直至通过或出现明确阻塞。
