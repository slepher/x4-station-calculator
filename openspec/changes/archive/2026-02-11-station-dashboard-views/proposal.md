# Proposal: Station Dashboard Views Expansion

## 1. 目标 (Goals)
本提案旨在通过启用和实现 `StationDashboard` 中的“时间视图”和“工人视图”，提升空间站规划的深度。

核心目标包括：
- **功能补完**: 实现仪表盘中原本预留但禁用的视图模式。
- **数据透明**: 让用户清楚了解空间站建设的时间跨度和运营所需的劳动力平衡。
- **一致性**: 保持与“材料视图”一致的交互和视觉风格。

## 2. 核心变更 (Core Changes)

### 2.1 数据模型扩展
- 在 `StationAnalysis` 接口中增加 `timeItems` 和 `workerItems` 等相关字段，或者在现有的 `items` 结构中支持多类型数据。
- 更新 `analyzeStation` 函数，使其能根据当前视图模式（或一次性）计算时间、材料和工人数据。

### 2.2 UI 交互增强
- 移除 `StationDashboard.vue` 中“时间视图”和“工人视图”按钮的 `disabled` 状态。
- 根据 `viewMode` 动态切换 `StationModuleDetail` 中显示的内容。
- 为时间数据提供格式化显示逻辑。
