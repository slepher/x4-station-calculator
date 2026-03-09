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

- [x] 6.4 补给站仓储视图实现
- [x] 6.4.1 新增仓储视图 tab（补给站资源面板）
- [x] 6.4.2 按 `netRate` 计算单站静产出/静消耗
- [x] 6.4.3 计算单站产出/消耗仓储体积并生成站点分项
- [x] 6.4.4 资源总需求采用 `max(Σ产出仓储体积, Σ消耗仓储体积)`
- [x] 6.4.5 列表不分组，顺序对齐资源/资金视图分组+组内顺序
- [x] 6.4.6 排版复用空间站仓储视图（去按钮、总项无占位）

- [x] 7. 连接功能收口（最终关闭）
- [x] 7.1 移除 UI 连接入口、连接区与连接拖拽
- [x] 7.2 移除 store 对外连接 API（`linkSectors` / `unlinkSectors`）
- [x] 7.3 明确连接功能为中途取消项，不纳入当前业务边界

- [x] 8. 补给站入口与上下文细化
- [x] 8.1 补给站 Tab 标题显示星区名
- [x] 8.2 补给站 Tab 标题颜色与普通站点 Tab 对齐（取消绿色强调）
- [x] 8.3 补给站态 Context 保留种族选择
- [x] 8.4 补给站态 Context 名称编辑绑定星区名（`renameSector`）

- [x] 9. 补给站建筑区与建材区实装
- [x] 9.1 建筑区根据仓储需求自动反推仓储模块清单
- [x] 9.2 建筑区排版对齐空间站自动工业区
- [x] 9.3 右侧建材区复用 `StationDashboard` 并注入补给站自动模块
- [x] 9.4 建材区隐藏工人视图，仅保留材料/体积/时间视图

- [x] 10. 泊位数据契约与吞吐量展示
- [x] 10.1 `x4_data_processor.py` 为 `class="pier"` 模块写入 `dockingCount`
- [x] 10.2 `X4Module` 增加必填 `dockingCount`，fallback 模块补 `0`
- [x] 10.3 ContextBar 吞吐量改为“单泊位吞吐量 = transportShipCapacity * 15”

- [x] 11. 空间站泊位需求与选型规则
- [x] 11.1 泊位需求改为 `container/solid/liquid` 分类型分别取整再求和
- [x] 11.2 已有泊位与补齐数量统一按 `dockingCount` 计算
- [x] 11.3 泊位选型优先级：planned 同种族 > planned 第一个 > 同种族 E 泊位
