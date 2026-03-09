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
- 左列：建筑区占位
- 中列：资源区（复用 `EmpireWareFlowsDashboard`）
- 右列：建造材料区占位

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
  - `linkedGroupedFlows`（当前固定为空，连接功能关闭）

### 补给站资源口径
- 补给站中间资源区读取 `getSectorInternalData(sectorId).localGroupedFlows`
- 组件层不再二次筛选站点，不再自行聚合
- 资源视图组件通过 `groupedFlows` 入参复用 `EmpireWareFlowsDashboard`

## 交互设计

### 星区管理
- 星区拖拽排序为移动语义
- 空间站拖拽分配到目标星区或未分配区
- 删除星区时，站点回收为未分配

### Tab 行为
- 站点 Tab 不支持拖拽排序
- 顺序由 `orderedStationsBySector` 驱动
- 有站点的星区显示补给站 Tab
- 点击补给站 Tab 进入整页补给视图；点击总览 Tab 返回总览页

## 连接功能状态
- UI：无连接入口、无连接区、无连接拖拽
- Store：无 `linkSectors` / `unlinkSectors` 对外能力
- 连接功能为开发中途取消项，不在当前功能边界内

## 迁移与兼容
- Empire 版本维持 v4
- 旧版数据迁移、导入导出兼容逻辑保留
- 对缺失字段执行默认值补齐并输出 warning
