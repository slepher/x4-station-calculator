# build-plan-steps 任务

## 1. 文档归属重构

- [x] 1.1 重写 `build-plan-steps` 的 `request.md`，使其成为 steps 方案的唯一完整需求来源
- [x] 1.2 重写 `build-plan-steps` 的 `design.md`，完整描述 steps 的边界、算法、视图和异常口径
- [x] 1.3 重写 `build-plan-steps` 的 `spec.md`，将新的 steps 行为固化为 requirement / scenario
- [x] 1.4 重写 `build-plan-steps` 的 `tasks.md`，使任务只围绕 steps 方案本身展开

## 2. 从 compute 文档迁出 steps 方案

- [x] 2.1 清理 `build-plan-compute` 中关于 steps 视图、steps 算法、steps 任务的详细描述
- [x] 2.2 在 `build-plan-compute` 中仅保留“compute 不生成 steps，steps 由独立文档定义”的边界说明
- [x] 2.3 确保 `build-plan-compute` 与 `build-plan-steps` 之间不存在重复承载完整 steps 方案的冲突

## 3. steps 适用范围与交互规则

- [x] 3.1 明确 steps mode 仅适用于建材产线方案
- [x] 3.2 明确生产产线方案不显示 steps 开关
- [x] 3.3 明确空模块或不满足前提的 scheme 不进入 steps mode
- [x] 3.4 明确默认模式与 steps mode 的状态栏字段差异

## 4. greedy steps 算法文档化

- [x] 4.1 明确 steps mode 从空 built 状态开始执行 greedy satisfaction 主循环
- [x] 4.2 明确每轮按“当前净产能 / 目标 rate”计算建材满足度
- [x] 4.3 明确每轮选择满足度最低的建材，并新增 1 个最佳主建筑
- [x] 4.4 明确旧 `greedyFill` 中 `hullparts` 种子、`Math.max`、`selfDemand` 混算等行为不能直接继承
- [x] 4.5 明确 greedy 主循环结束后，必须追加“最终方案补齐”阶段

## 5. steps 数据边界文档化

- [x] 5.1 明确 steps 只存在于 Vue / presenter 局部视图层
- [x] 5.2 明确 `BuildStepsScheme` 作为 steps 独立视图模型
- [x] 5.3 明确 steps 结果不得回写 store 真相层
- [x] 5.4 明确 `energycells` 纳入 steps 材料展示与成本统计

## 6. steps 运行时实现

- [x] 6.1 将 steps 入口限制为建材 scheme，生产 scheme 与空模块 scheme 隐藏 steps 开关
- [x] 6.2 将 `buildPlanStepsLogic` 从静态模块展开改为 greedy satisfaction 主循环 + tail-fill 补齐
- [x] 6.3 保留 steps 累计材料 / 库存 / 成本计算，并确保 `energycells` 纳入展示与统计
- [x] 6.4 为新的 steps 适用范围与 greedy/tail-fill 行为补充单测
- [x] 6.5 运行 `npm run build` 验证实现可编译
