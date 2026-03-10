# x4-sector 设计说明（最终实现态）

## 设计目标
在不重命名核心模块的前提下，提供稳定的星区管理、补给站整页视图、以及可复用的资源视图口径。

## 页面结构

### 总览页（activeStationId = null，且未打开补给站）
- 左列 `3`: `SectorManagementPanel`
- 中列 `5`: `EmpireWareFlowsDashboard`（全 empire 口径）
- 右列 `4`: 补给站入口占位区域
- Grid `gap-8`

### 补给站整页（activeStationId = null，且 supplySectorId 有值）
- 仍为三列布局，比例与主视图一致 `3 / 5 / 4`，`gap-8`
- 左列：建筑区（自动仓储模块规划，排版对齐空间站自动工业区）
- 中列：资源区（复用 `EmpireWareFlowsDashboard`）
- 右列：建造材料区（复用 `StationDashboard`，隐藏工人视图）

## 状态与数据设计

### 数据模型
- `StationPlan.sectorId?: string | null`
- `EmpirePlan.sectors?: SectorPlan[]`
- `SectorPlan` 当前不承载连接业务语义。

### Store 计算层
在 `useEmpireStore` 内提供星区级预计算：
- `sectorInternalDataMap: Map<string, SectorInternalData>`
- `SectorInternalData` 包含：
  - `planning`（本地站点 ID 等）
  - `localGroupedFlows`（仅本星区站点）
  - `supplyStorageFlows`（仓储视图分项与汇总）

### 补给站资源口径
- 补给站中间资源区读取 `getSectorInternalData(sectorId).localGroupedFlows`
- 组件层不再二次筛选站点，不再自行聚合
- 资源视图组件通过 `groupedFlows` 入参复用 `EmpireWareFlowsDashboard`
- 补给站新增仓储视图，计算口径如下：
  - 单站静态值：`stationProduce = max(netRate, 0)`，`stationConsume = max(-netRate, 0)`
  - 单站产出仓储体积：`stationProduce * unitVolume * primaryProductBufferHours`
  - 单站消耗仓储体积：`stationConsume * unitVolume * resourceBufferHours`
  - 资源总需求：`max(Σ站点产出仓储体积, Σ站点消耗仓储体积)`
  - 资源集合与资源/资金视图一致
  - 列表不分组，顺序采用“资源/资金视图分组顺序+组内顺序”拼接
  - 排版复用空间站仓储视图样式（去按钮、总项无占位）

### 补给站建筑区与材料区
- 建筑区基于 `supplyStorageFlows` 汇总各运输类型需求体积。
- 仓储模块选型规则对齐空间站：
  - 优先同种族 L 级仓储；
  - 回退通用 L 级仓储；
  - 再回退该类型最大容量仓储。
- 建造材料区直接复用 `StationDashboard`，通过 `plannedModulesOverride` 注入建筑区自动模块。
- 补给站场景下传入 `hideWorkersView=true`，仅保留材料/体积/时间视图。

## 交互设计

### 星区管理
- 星区拖拽排序为移动语义
- 空间站拖拽分配到目标星区或未分配区
- 删除星区时，站点回收为未分配

### Tab 行为
- 站点 Tab 不支持拖拽排序
- 顺序由 `orderedStationsBySector` 驱动
- 有站点的星区显示补给站 Tab
- 补给站 Tab 标题显示星区名，样式与普通站点 Tab 一致
- 点击补给站 Tab 进入整页补给视图；点击总览 Tab 返回总览页

### Context 行为
- 补给站态 Context 工具条保留种族选择。
- 名称编辑在补给站态绑定当前星区名（`renameSector`）；非补给站态仍绑定 empire 名称。
- ContextBar 吞吐量指标使用“单泊位吞吐量”，计算式为 `transportShipCapacity * 15`，单位 `m³/h`。

## 泊位数据与自动补齐设计

### 数据来源
- 在 `scripts/x4_data_processor.py` 中，针对 `class="pier"` 模块：
  - 统计 `<connections>` 下 `<connection>` 节点数量；
  - 写入模块字段 `dockingCount`。
- 前端 `X4Module` 将 `dockingCount` 作为必填字段，fallback 模块统一补 `0`。

### 空间站泊位需求计算
- 输入：`analyzeWareFlow` 输出的运输需求流（`transportDemand` + `transportType`）。
- 单泊位吞吐量：`singleBerthThroughput = transportShipCapacity * 15`。
- 按类型分桶并分别取整：
  - `containerDemand = ceil(containerThroughput / singleBerthThroughput)`
  - `solidDemand = ceil(solidThroughput / singleBerthThroughput)`
  - `liquidDemand = ceil(liquidThroughput / singleBerthThroughput)`
- 总泊位需求：`requiredTotalBerths = containerDemand + solidDemand + liquidDemand`。

### 空间站泊位模块选型
- 选型优先级：
  1. `plannedModules` 中同种族泊位模块；
  2. `plannedModules` 中第一个泊位模块；
  3. 对应种族 E 泊位（`harbor_03`）。
- 已有泊位总量与新增补齐数量均按 `dockingCount` 计算，不再依赖硬编码形状规则。

## 连接功能状态
- 本设计不承载连接交互细节。
- 星区连接能力由独立变更 `sector-link` 定义与实现。

## 迁移与兼容
- Empire 版本维持 v4
- 旧版数据迁移、导入导出兼容逻辑保留
- 对缺失字段执行默认值补齐并输出 warning
