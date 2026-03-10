# sector-link 设计说明

## 设计目标
将星区管理 UI 与星区物流纯函数统一到同一 change 下，确保：
- UI 交互清晰、拖拽冲突可控、命名与删除行为可预测。
- 物流计算稳定、可测试、可复现（纯函数 + 确定性输出）。

## 1. UI 设计（SectorManagementPanel / StationTabBar）

### 1.1 头部与创建交互
- 星区管理头部使用单行布局：标题 + 输入 + `+`。
- 未分配区头部同样为单行布局：标题 + 输入 + `+`。
- 两处创建均采用“重名后缀编号”策略，编号从 `2` 起。
- 两处创建后均保留输入值，不自动清空。

### 1.2 空间站操作
- 星区内空间站 chip 提供 `x` 按钮，动作是 `moveStationToSector(stationId, null)`。
- 未分配空间站 chip 提供删除按钮：
  - `modules.some(count>0)` 为真 -> 打开确认弹窗。
  - 否则直接 `deleteStation(stationId)`。

### 1.3 拖拽态可视化
- `draggingType === 'station'`：隐藏 `.sector-links`。
- `draggingType === 'link'`：隐藏 `.sector-stations`。
- `isDraggingSector === true`：同时隐藏 `.sector-stations` 和 `.sector-links`。
- 采用状态类驱动 CSS 隐藏，不卸载组件，避免拖拽中断。

### 1.4 样式统一
- 拖拽把手与连接把手使用同一线性图标风格与按钮样式。
- 空间站区与连接区使用一致最小高度，避免空态高度不一致。

### 1.5 StationTabBar
- `sectorGroups` 渲染前过滤无站点分组。
- 空星区不渲染星区 tab，也不渲染对应分割线。

## 2. Store 设计

### 2.1 createStation 选择行为
- `createStation(name, type, selectAfterCreate = true)` 增加可选参数。
- 仅 SectorManagementPanel 的未分配创建使用 `false`，其它入口保持默认行为。

### 2.2 isEmptyForSave
- 判空改为：`!hasStations && !hasSectors`。

## 3. 物流纯函数设计（src/store/logic/sectorLinkFlow.ts）

### 3.1 输入输出模型（sector 口径）
- 单货物：`solveSingleWareDistancePull`。
- 多货物：`solveMultiWareByLink`。
- 增强输出：
  - `allocatedDemandBySector`（满足量）
  - `deficitSummary`（总缺口、按sector缺口、同子网可产出sector映射）

### 3.2 算法流程
1. 构图（无向加权图）。
2. 切分连通分量（`splitSectorNetwork`）。
3. 需求侧最短路分层（最小距离优先）。
4. 同距离层按缺口比例分配。
5. 分配沿路径累加到边流量。
6. 计算缺口摘要与满足量摘要。

### 3.3 确定性与稳定性
- 并列最短路使用稳定 tie-break。
- 统一 `epsilon` 处理浮点误差。

## 4. 风险与对策
- 风险：拖拽状态切换导致交互闪断。
  - 对策：用 class 控制 display，不通过 `v-if` 卸载拖拽容器。
- 风险：重名规则与用户手输后缀冲突。
  - 对策：仅追加 ` base + " " + index `，按已有名称集合递增。
- 风险：删除误操作。
  - 对策：有模块才弹确认，降低无模块流程摩擦。
