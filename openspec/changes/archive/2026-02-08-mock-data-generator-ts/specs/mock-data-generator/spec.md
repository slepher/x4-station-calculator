## ADDED Requirements

### Requirement: 模拟数据生成器核心功能
系统 SHALL 提供一个基于TypeScript的模拟数据生成器，复制UI组件的逻辑以创建逼真的测试数据。

#### Scenario: 生成工业模块
- **WHEN** 使用模块配置调用模拟数据生成器时
- **THEN** 它 SHALL 使用与StationModuleList组件相同的逻辑生成industryModules数据
- **AND** 数据 SHALL 包括计划和自动工业模块

#### Scenario: 生成供应模块
- **WHEN** 使用模块配置调用模拟数据生成器时
- **THEN** 它 SHALL 使用与StationModuleList组件相同的逻辑生成supplyModules数据
- **AND** 数据 SHALL 包括自动供应模块

#### Scenario: 生成货物流
- **WHEN** 使用模块配置调用模拟数据生成器时
- **THEN** 它 SHALL 使用与StationWareFlowDashboard组件相同的逻辑生成wareFlows数据
- **AND** 数据 SHALL 包括模块间的生产和消耗流

#### Scenario: 生成劳动力数据
- **WHEN** 使用模块配置调用模拟数据生成器时
- **THEN** 它 SHALL 使用与StationWorkforce组件相同的逻辑生成stationWorkforce数据
- **AND** 数据 SHALL 包括按模块类型划分的劳动力

#### Scenario: 生成建造数据
- **WHEN** 使用模块配置调用模拟数据生成器时
- **THEN** 它 SHALL 使用与StationConstruction组件相同的逻辑生成stationConstructions数据
- **AND** 数据 SHALL 包括模块建造成本和材料

### Requirement: 配置集成
系统 SHALL 从x4-station-calculator.config.json读取模拟模块配置以驱动数据生成过程。

#### Scenario: 读取模拟模块配置
- **WHEN** 模拟数据生成器启动时
- **THEN** 它 SHALL 从x4-station-calculator.config.json读取mock_modules数组
- **AND** 它 SHALL 处理配置中定义的每个模块组

#### Scenario: 处理多个模块组
- **WHEN** mock_modules数组包含多个组时
- **THEN** 系统 SHALL 为每个组生成单独的模拟数据集
- **AND** 每个组 SHALL 独立处理

### Requirement: 数据一致性
系统 SHALL 确保生成的模拟数据与实际UI组件逻辑一致。

#### Scenario: 一致的模块关系
- **WHEN** 生成模拟数据时
- **THEN** 模块间的关系 SHALL 与UI组件计算的关系匹配
- **AND** 数据结构 SHALL 与应用程序中定义的类型匹配

#### Scenario: 一致的计算逻辑
- **WHEN** 为模拟数据执行计算时
- **THEN** SHALL 使用与UI组件中相同的公式和业务规则
- **AND** 结果值 SHALL 与真实应用程序行为一致