# Empire Management Specification

## Purpose
扩展帝国管理能力，使 empire 可以通过独立的 `SaveBinding` 关系层与某个 `gameGuid` 建立稳定关联，并在不污染单个 `EmpirePlan` 本体的前提下保存 group / station 级 save 映射。

## ADDED Requirements

### Requirement: Independent Save Binding Layer
系统 MUST 使用独立关系层保存 save binding，而不是把关系字段写入单个 `EmpirePlan`。

#### Scenario: 保存独立 binding
- **前提** 用户为某个 empire 建立了 save binding
- **当** 系统执行保存
- **那么** 系统 SHALL 将 binding 数据写入独立的 save binding 结构
- **并且** 系统 SHALL NOT 将这些关系字段写入 `EmpirePlan` 或 `StationPlan` 本体

### Requirement: Archive Time as View Selection
系统 MUST 将 `archiveTime` 视为 binding 视角字段，而不是 binding 身份字段。

#### Scenario: 切换到同一 game 的新存档时间
- **前提** empire 已绑定某个 `gameGuid`
- **当** 用户切换 `selectedArchiveTime`
- **那么** 系统 SHALL 保持原 binding 关系不变
- **并且** 系统 SHALL 只更新当前 `selectedArchiveTime`
