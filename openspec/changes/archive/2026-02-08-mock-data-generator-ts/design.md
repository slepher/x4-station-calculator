## 上下文

X4 Station Calculator目前缺少一个遵循与实际UI组件相同业务逻辑的强大模拟数据生成器。我们需要创建一个基于TypeScript的模拟数据生成器，能够基于现有UI组件逻辑生成逼真的测试数据。此生成器应使用与StationModuleList、StationWareFlowDashboard、StationWorkforce和StationConstruction组件相同的算法，以确保模拟数据与真实应用程序行为之间的一致性。

生成器将从x4-station-calculator.config.json中的mock_modules配置中提取数据，并创建相应的industryModules、supplyModules、wareFlows、stationWorkforce和stationConstructions数据。

## 目标/非目标

**目标:**
- 创建一个基于TypeScript的模拟数据生成器，镜像UI组件逻辑
- 为开发和测试目的生成逼真的测试数据
- 确保模拟数据与真实应用程序行为之间的一致性
- 支持UI组件所需的所有数据类型
- 与现有的mock_modules配置集成

**非目标:**
- 修改现有UI组件逻辑
- 创建新UI组件
- 为生产用途实现运行时数据生成
- 处理真实游戏数据

## 决策

1. **技术选择**: 使用TypeScript以保持与现有代码库的一致性
2. **逻辑重用**: 从现有组件中提取和重用相同的业务逻辑，而不是复制算法
3. **配置源**: 使用x4-station-calculator.config.json中的mock_modules数组作为模拟数据生成的真实来源
4. **模块化方法**: 为生成每种类型的数据创建单独的函数（industryModules、supplyModules等），以允许灵活性
5. **集成方法**: 导出既可通过编程方式也可通过命令行界面使用的函数

## 风险/权衡

[风险: 逻辑重复] → 缓解措施: 将业务逻辑从现有组件中仔细提取到可重用的实用函数中
[风险: 维护开销] → 缓解措施: 通过清晰的文档使模拟数据生成器与UI组件更改保持同步
[风险: 性能影响] → 缓解措施: 优化生成速度，因为模拟数据主要用于开发/测试