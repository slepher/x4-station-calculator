# 完整属性展示

## MODIFIED Requirements

### Requirement: Equipment Type Specific Details

#### Scenario: Turret完整字段
- **当** 展示turret属性
- **那么** 包含canonical equipment-panel要求的burstDPS及全部热字段，使用已有真实stats输出。

#### Scenario: Engine完整字段和摘要
- **当** 展示engine属性及候选摘要
- **那么** 包含thrustForward、boostMultiplier、travelThrust等完整字段；travel显示travelSpeed:travelCharge。

#### Scenario: 保留比较语义
- **当** 当前/候选为空、相同或不同
- **那么** 维持现有隐藏、单方数值和diff/max语义，其他shield/thruster字段不丢失。
