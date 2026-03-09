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
