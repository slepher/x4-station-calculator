# Refactor Calculator Logic 核对清单

## 功能点 (Features)
- [x] 将 `calculateModuleDiff` 重命名并改造为 `calculateAutoFill`
- [x] 实现三阶段单向流水线架构
- [x] 分离补给区与工业区的逻辑隔离
- [x] 添加 `supplyWorkforceBonus` 独立控制参数
- [x] 提取 `calculateNetProduction` 和 `calculateTotalWorkforce` 辅助函数
- [x] 更新 Store 层使用新的计算引擎
- [x] 修复 import 语句引用

## 约束条件 (Constraints)
- [x] 确保入参没有被包裹在 Context 对象中
- [x] 确保补给区居住舱计算与 plannedModules 完全解耦
- [x] 确保 lockedWares 仅影响工业区，不影响补给区内部递归
- [x] 确保补给区人口加成由 supplyWorkforceBonus 独立控制
- [x] 保持与现有代码的兼容性

## 重构验证

### 核心计算逻辑 (`moduleDiffCalculator.ts`)
- [x] 函数签名正确更新
- [x] 三阶段流水线架构实现
- [x] 辅助函数提取完成
- [x] 返回结构符合规范

### Store 层 (`useStationStore.ts`)
- [x] import 语句正确更新
- [x] calculationResult 计算属性实现
- [x] autoIndustryModules 和 autoSupplyModules 自动同步
- [x] 保持向后兼容性

## 技术细节
- **Phase 1 (工业硬补完)**: 使用 `globalWorkforceBonus` 控制效率
- **Phase 2 (客户人口普查)**: 统计所有生产者的工人需求
- **Phase 3 (补给区独立构建)**: 使用 `supplyWorkforceBonus` 独立控制补给区效率
- **完全解耦**: 补给区居住舱选择不参考 plannedModules 中的居住舱类型
- **锁定资源**: lockedWares 仅影响 Phase 1，不影响补给区内部递归计算