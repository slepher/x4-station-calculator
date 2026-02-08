## 1. 设置和配置

- [x] 1.1 创建模拟数据生成器TypeScript文件
- [x] 1.2 设置从x4-station-calculator.config.json读取配置
- [x] 1.3 定义与应用程序类型匹配的TypeScript接口

## 2. 核心逻辑提取

- [x] 2.1 从StationModuleList提取工业模块生成逻辑
- [x] 2.2 从StationModuleList提取供应模块生成逻辑
- [x] 2.3 从StationWareFlowDashboard提取货物流生成逻辑
- [x] 2.4 从StationWorkforce提取劳动力计算逻辑
- [x] 2.5 从StationConstruction提取建造计算逻辑

## 3. 模拟数据生成

- [x] 3.1 实现基于配置生成industryModules的函数
- [x] 3.2 实现基于配置生成supplyModules的函数
- [x] 3.3 实现基于模块连接生成wareFlows的函数
- [x] 3.4 实现基于模块生成stationWorkforce的函数
- [x] 3.5 实现基于模块生成stationConstructions的函数

## 4. 集成和测试

- [x] 4.1 创建协调所有数据生成的主函数
- [x] 4.2 为生成器实现命令行界面
- [x] 4.3 使用示例配置测试生成器
- [x] 4.4 验证生成的数据与UI组件逻辑匹配