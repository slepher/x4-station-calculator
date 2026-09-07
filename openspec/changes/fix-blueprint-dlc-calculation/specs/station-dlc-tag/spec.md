# Blueprint 规划 DLC 计算

## MODIFIED Requirements

### Requirement: Inactive DLC Modules Are Excluded From Station Calculations
无 archive Blueprint 规划在启用限制后 SHALL 使用统一有效模块输入进行全部分析和自动模块选择。

#### Scenario: 开启限制
- **当** 唯一 Terran energy 生产者未激活且政策开启
- **那么** 原计划模块仍保留，其计算贡献为 0；成本、工人、体积和流量都不纳入该模块。

#### Scenario: 自动模块候选
- **当** 自动计算生产/居住/仓储/码头
- **那么** 未激活模块不作为候选。

#### Scenario: 政策与 DLC 改变
- **当** activeDlcs 内容或 enforce 变化
- **那么** 全站缓存与帝国聚合刷新；关闭政策或重新激活后原贡献恢复，不修改持久计划。
