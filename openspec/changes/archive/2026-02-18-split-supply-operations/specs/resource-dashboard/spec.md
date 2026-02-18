## MODIFIED Requirements

### Requirement: 经济视图分组功能
系统Must在经济视图中将物品分为四组：产品收入组、运营支出组、补给支出组、资源支出组。

#### Scenario: 收入支出分组
- **WHEN** 用户切换到经济视图
- **THEN** 系统根据netValue的正负性将物品分为收入组（正值）和支出组（负值）

#### Scenario: 支出类型细分
- **WHEN** 物品属于支出组
- **THEN** 系统根据workforceConsumption和transportType进一步分为：
  - 补给支出组（workforceConsumption > 0）
  - 运营支出组（workforceConsumption === 0 && transportType === 'container'）
  - 资源支出组（workforceConsumption === 0 && transportType !== 'container'）

#### Scenario: 分组显示
- **WHEN** 经济视图下
- **THEN** 按照产品收入组、运营支出组、补给支出组、资源支出组的顺序垂直排列
- **AND** 每组标题栏显示该组内netValue的总和

### Requirement: 资源视图分组功能
系统Must在资源视图中将物品分为四组：产品组、运营组、补给组、资源组，与经济视图使用相同的分组逻辑。

#### Scenario: 四组分组显示
- **WHEN** 用户在数量视图下
- **THEN** 系统使用与经济视图相同的分组逻辑进行分组
- **AND** 按照产品组、运营组、补给组、资源组的顺序垂直排列

## ADDED Requirements

### Requirement: 工人消耗数据分离
系统Must在WareFlow数据结构中单独记录工人消耗量，以便区分补给缺口和运营缺口。

#### Scenario: 工人消耗字段
- **WHEN** 系统计算物资流向
- **THEN** 每个WareFlow对象必须包含workforceConsumption字段
- **AND** workforceConsumption表示该物资被工人消耗的小时数量

#### Scenario: 补给分组判断
- **WHEN** 物资的netRate <= 0且workforceConsumption > 0
- **THEN** 该物资归入补给分组（supply）
- **AND** 显示为补给缺口或补给支出
