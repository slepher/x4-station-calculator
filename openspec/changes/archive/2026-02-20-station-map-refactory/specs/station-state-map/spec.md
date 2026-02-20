# Station State Map Specification

## Purpose
定义分站运行态映射能力，确保每个分站的输入状态、派生模块与资源流计算结果拥有单一真源，并可被单站视图与帝国聚合复用。

## ADDED Requirements

### Requirement: 分站运行态单一真源 (Station Runtime Single Source of Truth)
系统 SHALL 为每个 `stationId` 维护独立 `StationState`，并通过统一映射容器读写以下核心数据：
- `plannedModules`
- `lockedWares`
- `warePriority`
- `settings`
- `settings.showEmpireGaps`
- `autoIndustryModules`
- 资源产出/消耗计算结果（例如 `groupedFlows`、`netProduction`）

#### Scenario: 初始化分站运行态
- **前提** 分站首次被创建或首次被访问
- **当** 系统调用 `ensure(stationId)`
- **那么** 系统 SHALL 创建该分站默认运行态
- **并且** 该运行态 SHALL 与其他分站互相隔离

#### Scenario: 查询分站运行态
- **前提** 分站运行态已存在
- **当** 系统调用 `get(stationId)`
- **那么** 系统 SHALL 返回该分站运行态对象
- **并且** 返回对象 SHALL 对应唯一 `stationId`

### Requirement: 分站派生与计算一致性 (Derived and Computed Consistency)
系统 SHALL 在同一分站上下文内，以同一输入集生成派生模块和计算结果，避免同一时刻出现多套不一致结果。

#### Scenario: 规划模块变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改该分站 `plannedModules`
- **那么** 系统 SHALL 基于该分站输入重新计算 `autoIndustryModules`
- **并且** 系统 SHALL 同步更新该分站资源产出/消耗结果

#### Scenario: 设置变更触发重算
- **前提** 某分站已有运行态
- **当** 用户修改 `settings`（如工人运算、缓冲时间）
- **那么** 系统 SHALL 重新计算该分站派生模块与资源流
- **并且** 旧计算结果 SHALL 被新结果替换

### Requirement: 生命周期操作一致性 (Lifecycle Consistency)
系统 SHALL 为分站创建、复制、删除提供一致的运行态生命周期管理。

#### Scenario: 复制分站运行态
- **前提** 源分站运行态存在
- **当** 系统执行 `clone(fromId, toId)`
- **那么** 新分站 SHALL 获得源分站的深拷贝运行态
- **并且** 后续对任一分站修改 SHALL 不影响另一分站

#### Scenario: 删除分站运行态
- **前提** 分站被用户删除
- **当** 系统执行 `remove(stationId)`
- **那么** 系统 SHALL 移除对应运行态
- **并且** 后续查询该 `stationId` SHALL 返回不存在状态

### Requirement: 持久化边界控制 (Persistence Boundary Control)
系统 MUST 区分“可编辑输入”与“可重算结果”，仅持久化可编辑输入字段。

#### Scenario: 存档保存
- **前提** 用户执行保存帝国/分站操作
- **当** 系统导出持久化数据
- **那么** 系统 MUST 仅保存 `modules/settings/lockedWares/warePriority` 等输入
- **并且** `settings.showEmpireGaps` SHALL 作为 `settings` 子字段被持久化
- **并且** 派生模块与资源流结果 SHALL 不作为持久化真源

#### Scenario: 载入恢复后重算
- **前提** 系统从持久化数据恢复分站输入
- **当** 分站运行态被激活
- **那么** 系统 SHALL 基于恢复输入重新计算派生模块与资源流
- **并且** 计算结果 SHALL 与当前游戏数据版本一致

### Requirement: 设置迁移判定精确性 (Settings Migration Precision)
系统 MUST 仅在字段缺失时补默认值，不得因 falsy 值误覆盖用户输入。

#### Scenario: resourceBufferHours 为 0
- **前提** 旧数据中的 `resourceBufferHours` 为 `0`
- **当** 系统执行设置迁移
- **那么** 系统 MUST 保留 `0`
- **并且** 系统 MUST NOT 将其替换为 `2`

#### Scenario: resourceBufferHours 缺失
- **前提** 旧数据中 `resourceBufferHours` 为 `undefined`
- **当** 系统执行设置迁移
- **那么** 系统 SHALL 使用默认值 `2`
- **并且** 迁移逻辑 SHALL 等价于 `s.resourceBufferHours !== undefined ? s.resourceBufferHours : 2`
