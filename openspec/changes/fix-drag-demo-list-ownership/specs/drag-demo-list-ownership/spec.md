## ADDED Requirements

### Requirement: 拖放缓存归属
拖放库SHALL不直接污染store按zone派生的数组；成功move后DOM和领域zone一致，auto/isolate转换不产生同zone重复条目。

#### Scenario: 普通移动
- **WHEN** item从A真实拖入B
- **THEN** A中移除、B中恰一项且zone为B，记录当前drop事务，无DOM消失。

#### Scenario: 转换及拒绝
- **WHEN** 操作目标已有auto/isolate或目标因重复/lineage拒绝
- **THEN** 按原状态政策转换或拒绝，不产生重复项或损坏DOM。
