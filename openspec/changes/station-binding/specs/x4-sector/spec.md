# X4 Sector Management Specification

## Purpose
扩展当前规划 `sector` 的业务语义，使其作为 `sectorGroup` 使用，并允许在某个 `SaveBindingPlan` 视角下通过 save `tradestation` 推导 group 的 `N` 跳管辖范围。

## ADDED Requirements

### Requirement: Sector Group Coverage by Save Binding Hub
系统 MUST 基于 `SaveBindingPlan` 中的 `GroupSaveBinding` 计算 coverage。

#### Scenario: 计算 N 跳 coverage
- **前提** 当前 `SaveBindingPlan` 中某个 `sectorGroup` 已绑定 save `tradestation`
- **并且** 该 binding 的 `jumpRange = N`
- **当** 系统执行 coverage 计算
- **那么** 系统 SHALL 从绑定 `tradestation` 的所在 sector 作为起点
- **并且** 系统 SHALL 使用与高级资源功能相同的 `N` 跳拓扑定义
- **并且** 系统 SHALL 计算 `distance <= N` 的全部 sector
- **并且** 结果 SHALL 写入该 `GroupSaveBinding.coverageSectorMacros`

### Requirement: Sector Group Coverage Is Save-View Jurisdiction
系统 MUST 将 coverage 视为某个 `SaveBindingPlan` 视角下的 `sectorGroup` 辖区。

#### Scenario: 不同 save 视角下读取 coverage
- **前提** 同一 empire 存在多个 `SaveBindingPlan`
- **当** 系统读取某个 `sectorGroup` 的 coverage
- **那么** 系统 SHALL 基于当前激活的 `SaveBindingPlan` 读取对应 coverage
- **并且** SHALL NOT 将不同 `gameGuid` 的 coverage 混用

### Requirement: Automatic Coverage Conflict Rejection
系统 SHOULD 默认拒绝同一 `SaveBindingPlan` 内多个 `sectorGroup` 对同一 save sector 的自动 coverage 争夺。

#### Scenario: coverage 冲突
- **前提** `sectorGroup` A 的 coverage 已包含某 save sector
- **当** `sectorGroup` B 绑定 hub 后自动 coverage 也试图包含该 save sector
- **那么** 系统 SHALL 给出冲突提示
- **并且** 系统 SHALL 不静默吞并既有归属
