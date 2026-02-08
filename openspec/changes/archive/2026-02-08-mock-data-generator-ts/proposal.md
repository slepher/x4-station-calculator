## 原因

目前，X4 Station Calculator缺少一个有效的模拟数据生成器，无法基于现有UI逻辑生成逼真的测试数据。我们需要一个基于TypeScript的模拟数据生成器，利用与实际UI组件相同的逻辑来为开发和测试目的创建一致且逼真的测试数据。

## 变更内容

- 创建一个基于TypeScript的模拟数据生成器，复制来自现有UI组件的逻辑
- 使用与StationModuleList、StationWareFlowDashboard、StationWorkforce和StationConstruction组件相同的算法生成industryModules、supplyModules、wareFlows、stationWorkforce和stationConstructions
- 与x4-station-calculator.config.json中的现有mock_modules配置集成
- 为配置中定义的每组模块生成模拟数据

## 功能

### 新功能
- `mock-data-generator`: 一个基于TypeScript的模拟数据生成器，使用与UI组件相同的业务逻辑来创建逼真测试数据

### 修改的功能
- 无

## 影响

- 项目中新增模拟数据生成功能
- 通过逼真的数据集增强测试能力
- 通过一致的模拟数据改进开发工作流程
- 利用与实际UI组件相同的逻辑以确保一致性