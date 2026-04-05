# Empire Management Specification

## Purpose
扩展帝国管理能力，使 empire 可以通过独立 `SaveBinding` 关系层与某个 `gameGuid` 建立稳定关联，并在不污染 empire 本体的前提下保存 group / station 级 save 映射。

## ADDED Requirements

### Requirement: Independent Save Binding Layer
系统 MUST 使用独立于 `EmpirePlan` 本体的 `SaveBinding` 持久化层保存 save 关系。

#### Scenario: 保存独立 binding
- **前提** 用户为某个 empire 建立了 save binding
- **当** 系统执行保存
- **那么** 系统 SHALL 将 binding 数据写入独立的 `empireSavePlan` 持久化结构
- **并且** 系统 SHALL NOT 将这些关系字段写入 `EmpirePlan` 或 `StationPlan` 本体

### Requirement: Save Binding Unique Key
系统 MUST 以 `empireId + gameGuid` 作为单个 `SaveBindingPlan` 的唯一键。

#### Scenario: 同一 empire 绑定同一 game
- **前提** empire A 已存在 `gameGuid = G` 的 binding
- **当** 用户再次尝试为 empire A 创建同一 `gameGuid` 的 binding
- **那么** 系统 SHALL 复用或定位到既有 binding
- **并且** 系统 SHALL NOT 再创建第二个相同唯一键的 binding

### Requirement: Archive Time as View Selection
系统 MUST 将 `archiveTime` 视为当前 save 视角字段，而不是 binding 身份字段。

#### Scenario: 切换到同一 game 的新存档时间
- **前提** empire A 已绑定 `gameGuid = G`
- **并且** 用户上传了同一 `gameGuid` 的新存档时间 T2
- **当** 用户将当前视角从 T1 切换到 T2
- **那么** 系统 SHALL 保持原 binding 关系不变
- **并且** 系统 SHALL 只更新当前 `selectedArchiveTime`

### Requirement: Group and Station Bindings Within Save Binding
系统 MUST 在单个 `SaveBindingPlan` 内保存 group binding 与 station binding。

#### Scenario: 保存 group binding
- **前提** 用户为某个 `sectorGroup` 选择了 save `tradestation`
- **当** 用户确认绑定
- **那么** 系统 SHALL 在当前 `SaveBindingPlan` 下写入 `GroupSaveBinding`

#### Scenario: 保存 station binding
- **前提** 用户为某个 empire station 选择了 save 玩家空间站
- **当** 用户确认绑定
- **那么** 系统 SHALL 在当前 `SaveBindingPlan` 下写入 `StationSaveBinding`

### Requirement: Current-Time Invalidity Is Derived State
系统 MUST 将“当前 time 下绑定失效”视为运行态派生结果，而不是持久化真相。

#### Scenario: 当前 archive 中缺失已绑定对象
- **前提** 某 `SaveBindingPlan` 已存在既有 group binding 或 station binding
- **当** 当前 `selectedArchiveTime` 的 archive 中找不到对应 save 对象
- **那么** 系统 SHALL 返回“当前 time 下失效”的派生状态
- **并且** 系统 SHALL NOT 自动删除原 binding 关系
