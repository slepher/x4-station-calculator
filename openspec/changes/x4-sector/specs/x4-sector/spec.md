# X4 Sector Management Specification (Final)

## Purpose
在星区总览模式中提供稳定的星区管理与补给站视图能力，并保证 Tab 顺序与星区顺序一致。

## ADDED Requirements

### Requirement: Sector Management Panel in Overview
系统 MUST 在总览态显示星区管理面板，替换原左侧占位区。

#### Scenario: 显示面板
- **前提** 用户在生产视图且 `activeStationId = null`
- **当** 页面渲染
- **那么** 系统 SHALL 显示星区管理面板

### Requirement: Sector CRUD and Station Assignment
系统 MUST 支持星区创建、重命名、删除，以及空间站拖拽归属。

#### Scenario: 站点拖拽归属
- **前提** 存在空间站与目标星区
- **当** 用户拖拽站点到目标星区
- **那么** 系统 SHALL 更新 `station.sectorId`
- **并且** 刷新后归属 SHALL 保持

#### Scenario: 新建站点默认未分配
- **前提** 用户创建新空间站
- **当** 新站点写入 store
- **那么** `station.sectorId` SHALL 为 `null`

### Requirement: Sector Drag Reorder
系统 MUST 支持通过拖拽调整星区顺序，语义为移动（非复制）。

#### Scenario: 星区排序
- **前提** 至少存在两个星区
- **当** 用户拖拽星区手柄调整位置
- **那么** 系统 SHALL 更新星区顺序

### Requirement: Tab Order Driven by Sector
站点 Tab MUST 取消拖拽排序，按星区顺序平铺展示。

#### Scenario: Tab 顺序同步
- **前提** 用户调整星区顺序或站点归属
- **当** Tab 重新渲染
- **那么** 站点 Tab SHALL 按“星区顺序 + 星区内顺序 + 未分配尾部”展示

### Requirement: Virtual Supply Tab per Sector
每个有空间站的星区 MUST 在 Tab 区提供一个虚拟补给站入口。

#### Scenario: 补给站 Tab 标题与样式
- **前提** 某星区下存在空间站
- **当** Tab 区渲染补给站入口
- **那么** 标题 SHALL 显示该星区名称
- **并且** 文本颜色 SHALL 与普通站点 Tab 一致

#### Scenario: 打开补给站整页
- **前提** 用户点击某星区补给站 Tab
- **当** 系统切换视图
- **那么** 系统 SHALL 打开补给站整页视图
- **并且** 不再停留在总览三列布局

#### Scenario: 返回总览
- **前提** 用户位于补给站整页
- **当** 用户点击总览 Tab
- **那么** 系统 SHALL 返回总览页面

### Requirement: Supply View Resource Panel Reuses Empire Component
补给站中间资源区 MUST 复用帝国资源视图组件。

#### Scenario: 组件复用
- **前提** 补给站整页已打开
- **当** 资源区渲染
- **那么** 系统 SHALL 使用与总览相同的资源视图组件与交互（数量/经济切换）

### Requirement: Supply View Uses Local-Sector Aggregation
补给站资源统计口径 MUST 仅包含当前星区内空间站。

#### Scenario: 统计边界
- **前提** empire 下存在多个星区
- **当** 用户打开某星区补给站
- **那么** 资源视图 SHALL 仅统计该星区站点
- **并且** 不包含其他星区站点数据

### Requirement: Supply Storage View
补给站 MUST 提供“仓储视图”，并按 `netRate` 派生仓储体积需求。

#### Scenario: 单站静态值由 netRate 派生
- **前提** 已有某站点某资源 `netRate`
- **当** 系统计算仓储视图
- **那么** `静产出 = max(netRate, 0)`
- **并且** `静消耗 = max(-netRate, 0)`

#### Scenario: 单站仓储体积计算
- **前提** 已得到静产出/静消耗、`unitVolume`、站点缓冲参数
- **当** 系统计算单站仓储体积
- **那么** `产出仓储体积 = 静产出 × unitVolume × primaryProductBufferHours`
- **并且** `消耗仓储体积 = 静消耗 × unitVolume × resourceBufferHours`

#### Scenario: 资源总需求计算
- **前提** 某资源在多个站点存在仓储体积分项
- **当** 系统汇总资源总项
- **那么** 总需求 SHALL 为 `max(Σ产出仓储体积, Σ消耗仓储体积)`

#### Scenario: 仓储视图顺序与排版
- **前提** 用户切换到补给站仓储视图
- **当** 列表渲染
- **那么** 资源集合 SHALL 与资源/资金视图一致
- **并且** 列表 SHALL 不分组，顺序采用“其他视图分组顺序 + 组内顺序”拼接
- **并且** 排版 SHALL 对齐空间站仓储视图，但无操作按钮且总项无占位

### Requirement: Supply Build Zone Auto Storage Planning
补给站左侧建筑区 MUST 根据仓储需求自动生成仓储模块规划。

#### Scenario: 基于种族偏好自动选仓储模块
- **前提** 用户在补给站态设置了 `racePreference`
- **当** 系统计算建筑区模块清单
- **那么** 系统 SHALL 复用空间站仓储选型逻辑（优先种族 L 仓储，回退通用/最大容量）
- **并且** 模块数量 SHALL 按 `ceil(需求体积 / 模块容量)` 计算

### Requirement: Supply Material Zone Reuses Station Dashboard
补给站右侧建造材料区 MUST 复用空间站右侧仪表盘组件。

#### Scenario: 复用组件并隐藏工人视图
- **前提** 补给站整页已打开且左侧建筑区已生成模块清单
- **当** 右侧面板渲染
- **那么** 系统 SHALL 复用空间站建造仪表盘组件
- **并且** 输入 SHALL 使用建筑区自动模块清单
- **并且** 工人视图 SHALL 被隐藏

### Requirement: Supply Context Name Edit Targets Sector
补给站态 Context 名称编辑 MUST 作用于当前星区名。

#### Scenario: 在补给站态编辑名称
- **前提** 当前为补给站整页且有 `supplySectorId`
- **当** 用户在 Context 名称输入框修改并确认
- **那么** 系统 SHALL 调用星区重命名逻辑更新 `sector.name`

### Requirement: Sector Internal Data Map in Empire Store
`useEmpireStore` MUST 提供按星区预计算的内部数据 `Map`。

#### Scenario: 读取星区内部数据
- **前提** empire 与 station 缓存已初始化
- **当** 业务读取某星区内部数据
- **那么** 系统 SHALL 从 `Map<sectorId, SectorInternalData>` 返回结果

### Requirement: Empire Storage Version and Compatibility
系统 MUST 维持 empire v4 结构与导入导出兼容。

#### Scenario: 旧数据迁移
- **前提** 存在低版本 empire 数据
- **当** 初始化或导入执行
- **那么** 系统 SHALL 迁移到 v4 并补齐默认字段

### Requirement: ContextBar Shows Single-Berth Throughput
ContextBar MUST 显示单泊位吞吐量，不显示总吞吐量。

#### Scenario: 单泊位吞吐量计算
- **前提** 存在 `transportShipCapacity`
- **当** ContextBar 渲染吞吐量指标
- **那么** 指标 SHALL 为 `transportShipCapacity * 15`
- **并且** 单位 SHALL 为 `m³/h`

### Requirement: Pier Docking Count Data Contract
系统 MUST 为 pier 模块提供非空 `dockingCount` 字段。

#### Scenario: 数据处理阶段写入 dockingCount
- **前提** 模块宏 `class="pier"` 且存在 `<connections>`
- **当** 数据处理脚本解析模块
- **那么** `dockingCount` SHALL 等于 `<connections>/<connection>` 节点数量

#### Scenario: 类型契约非空
- **前提** 前端加载 `modules.json`
- **当** 类型系统校验 `X4Module`
- **那么** `dockingCount` SHALL 为必填 `number`
- **并且** 兜底构造模块时 SHALL 填充为 `0`

### Requirement: Station Berth Demand by Transport Type
空间站泊位需求 MUST 按运输类型分别取整后再求和。

#### Scenario: 分类型泊位需求
- **前提** 已得到空间站运输需求流（含 `transportType`）
- **当** 系统计算泊位需求
- **那么** SHALL 分别计算：
  - `containerDemand = ceil(containerThroughput / singleBerthThroughput)`
  - `solidDemand = ceil(solidThroughput / singleBerthThroughput)`
  - `liquidDemand = ceil(liquidThroughput / singleBerthThroughput)`
- **并且** `requiredTotalBerths = containerDemand + solidDemand + liquidDemand`

### Requirement: Station Pier Auto-Selection Priority
空间站自动补泊位模块 MUST 使用固定优先级选型，并按 `dockingCount` 计算补齐数量。

#### Scenario: 泊位模块选型优先级
- **前提** 系统检测到泊位缺口
- **当** 系统选择补齐泊位模块
- **那么** SHALL 优先选择 `plannedModules` 中同种族泊位模块
- **并且** 若无同种族命中，SHALL 选择 `plannedModules` 中第一个泊位模块
- **并且** 若仍未命中，SHALL 选择对应种族 E 泊位（`harbor_03`）

#### Scenario: 按 dockingCount 补齐
- **前提** 已选中目标泊位模块且存在 `dockingCount > 0`
- **当** 系统计算补齐数量
- **那么** `requiredModuleCount = ceil(berthDeficit / dockingCount)`

## REMOVED Requirements

### Requirement: Sector Link Feature
系统 SHALL NOT 提供星区连接（link）交互与 store 操作。

#### Scenario: 无连接入口
- **前提** 用户在星区管理面板
- **当** 用户尝试查找连接操作
- **那么** UI SHALL 不显示连接入口、连接区、连接拖拽

#### Scenario: 无连接 store API
- **前提** 业务代码引用 empire store
- **当** 检查公开 API
- **那么** SHALL 不包含 `linkSectors` / `unlinkSectors`

#### Scenario: 中途取消约束
- **前提** 连接功能曾进入开发过程
- **当** 以最终版本范围评估
- **那么** 该功能 SHALL 视为中途取消项，不纳入交付能力
