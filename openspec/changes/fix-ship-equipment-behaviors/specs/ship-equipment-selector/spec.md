# Fit有效交互

## MODIFIED Requirements

### Requirement: 唯一候选点击与数量

#### Scenario: 补满与清空
- **当** 合法未过滤候选只有一个，当前group未满
- **那么** 点击slot补满实际容量且不开picker；满容量再次点击清空装备。

#### Scenario: 分组数量
- **当** group总容量为2（即使只有1个connection）
- **那么** step为2；connection模式step为1。

#### Scenario: 数量预演和提交
- **当** 滑块变化
- **那么** preview不修改真实blueprint；commit使用同一容量分配且不越界。数值0保留装备ID，统计与材料不计数量0。
