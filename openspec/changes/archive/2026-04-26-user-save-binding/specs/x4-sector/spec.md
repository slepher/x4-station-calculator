# X4 Sector Management Specification

## Purpose
扩展当前规划 `sector` 的业务语义，使其作为 `sectorGroup` 使用，并允许在某个 `SaveBindingPlan` 视角下通过 save `tradestation` 推导 group 的 `N` 跳管辖范围与双向连接关系。

## ADDED Requirements

### Requirement: Sector Group Coverage by Save Binding Hub
系统 MUST 基于 `GroupSaveBinding` 计算 coverage。

#### Scenario: 计算 N 跳 coverage
- **前提** 当前 `SaveBindingPlan` 中某个 `sectorGroup` 已绑定 save `tradestation`
- **并且** 该 binding 的 `jumpRange = N`
- **当** 系统执行 coverage 计算
- **那么** 系统 SHALL 从绑定 `tradestation` 所在 sector 作为起点计算 `distance <= N` 的全部 sector

### Requirement: Connected Sector Groups in Binding View
系统 MUST 在 binding 视角下维护 empire sector 间的双向连接。

#### Scenario: 用户建立或取消连接
- **前提** 用户在 Step 2 编辑某个 empire sector
- **当** 用户建立或取消与另一 empire sector 的连接
- **那么** 系统 SHALL 同步更新双方的连接关系
