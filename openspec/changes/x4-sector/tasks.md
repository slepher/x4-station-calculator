# x4-sector 实施任务（最终态）

- [x] 1. 星区数据模型与版本兼容
- [x] 1.1 新增 `SectorPlan`、`station.sectorId`、`sectors` 结构
- [x] 1.2 empire 版本升级到 v4
- [x] 1.3 保留旧数据迁移与导入导出兼容

- [x] 2. 星区管理面板落地
- [x] 2.1 接入 `SectorManagementPanel` 到总览左列
- [x] 2.2 支持星区新建、重命名、删除、拖拽排序
- [x] 2.3 支持空间站拖拽分配（含未分配区）

- [x] 3. Tab 顺序与补给站入口
- [x] 3.1 取消 Tab 拖拽排序
- [x] 3.2 Tab 顺序改为星区顺序驱动
- [x] 3.3 每个有站点的星区显示虚拟补给站 Tab

- [x] 4. 补给站整页视图
- [x] 4.1 点击补给站 Tab 切换到整页补给视图
- [x] 4.2 点击总览 Tab 返回总览
- [x] 4.3 三栏布局比例与主视图一致：`3/5/4` + `gap-8`
- [x] 4.4 左/右栏为占位区

- [x] 5. 资源视图复用与口径
- [x] 5.1 中间资源区复用 `EmpireWareFlowsDashboard`
- [x] 5.2 为该组件增加可注入 `groupedFlows` 入参
- [x] 5.3 补给站资源口径限定为“当前星区内空间站”

- [x] 6. EmpireStore 星区内部计算 Map
- [x] 6.1 在 store 内独立计算所有星区内部数据
- [x] 6.2 暴露 `sectorInternalDataMap` 与 `getSectorInternalData`
- [x] 6.3 补给站视图改为消费 store 的 Map 结果

- [x] 7. 连接功能收口（最终关闭）
- [x] 7.1 移除 UI 连接入口、连接区与连接拖拽
- [x] 7.2 移除 store 对外连接 API（`linkSectors` / `unlinkSectors`）
- [x] 7.3 明确连接功能为中途取消项，不纳入当前业务边界
