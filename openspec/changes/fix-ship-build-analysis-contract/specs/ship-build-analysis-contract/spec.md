## ADDED Requirements

### Requirement: 船体配置独立累加
共享分析SHALL将当前合法blueprint.hull.materials与production、equipment、storage材料各计一次，汇总数量、卡片及总价一致；hull不添加建造时间。

#### Scenario: 同名能源电池
- **WHEN** production为2182，hull配置100，装备15
- **THEN** 总数为2297，且输入对象不被修改。

### Requirement: 性能指标含义
性能面板SHALL显示按已装炮塔数量加权的平均DPS，以及boost.recharge/100的回充率%/s；零安装与预演遵循同一计算。

#### Scenario: 当前保存船舶
- **WHEN** 加载已知Odachi/Osaka装备配置
- **THEN** 平均DPS分别为220与按当前精度显示301.1，回充率为1%/s；不能额外除6。
