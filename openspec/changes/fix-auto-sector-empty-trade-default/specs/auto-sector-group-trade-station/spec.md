# 空候选默认

## MODIFIED Requirements

### Requirement: 无玩家hub默认虚拟交易站

#### Scenario: 手动添加无玩家星区
- **当** 用户添加无玩家交易站候选的星区为hub
- **那么** selectedTradeStation为type virtual、stationCode __virtual__，UI选中虚拟候选。
- **并且** 不创建生产stationPlan，不改archive事实。

#### Scenario: 保留明确选择
- **当** 默认处理已有选择或有效retained玩家选择
- **那么** 既有选择语义不被空候选修复意外覆盖。
