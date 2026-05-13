# build-plan-steps 任务

## 1. 默认 compute 输出改造

- [x] 1.1 从默认 build-plan compute 链路移除 steps 生成职责，确保默认 `BuildScheme` 不再依赖 `makeSchemeSteps()`
- [x] 1.2 在默认 compute 阶段为 `BuildScheme` 新增并填充 `moduleSummaries`
- [x] 1.3 为 `moduleSummaries` 落实静态总耗时、静态总花费、材料总量、材料总花费、单价计算
- [x] 1.4 在 compute 中落实模块排序与材料排序规则
- [x] 1.5 确保静态 `totalDuration` 与静态 `totalCredits` 由默认 compute 明确产出

## 2. steps 逻辑边界重构

- [x] 2.1 将 `makeSchemeSteps()` 从默认 compute 核心模块迁出到仅供详情弹窗按需使用的局部 logic 模块
- [x] 2.2 保持 steps 模式继续复用同一套 `makeSchemeSteps()` 算法，不新增第二套算法
- [x] 2.3 在 Vue / presenter 范围新增 `BuildStepsScheme` 类型与组装逻辑
- [x] 2.4 确保 `BuildStepsScheme` 不进入 store 真相层类型定义，也不回写 store

## 3. 详情弹窗两态展示

- [x] 3.1 在详情弹窗状态栏增加 `steps` 开关，并设为每次打开默认关闭
- [x] 3.2 在默认模式下显示模块汇总手风琴，头部字段为模块名称 / 数量 / 总耗时 / 总花费
- [x] 3.3 在默认模式展开区显示材料名称 / 总数量 / 总花费 / 单价
- [x] 3.4 在 steps 模式下切换为纯 step 列表，并仅在该模式显示 `步骤数`
- [x] 3.5 增加弹窗局部 loading、局部缓存与基于 `scheme.modules` 的缓存失效逻辑
- [x] 3.6 为异常空模块场景提供空模板兜底，并隐藏开关

## 4. Energy Cells 口径修正

- [x] 4.1 修正默认模式材料明细与静态成本统计中对 `energycells` 的错误排除
- [x] 4.2 修正 steps 模式材料明细与 steps 成本统计中对 `energycells` 的错误排除
- [x] 4.3 确保 `energycells` 仅在"循环建材产线寻找"语义中保留特殊处理，不再影响材料展示与成本统计

## 5. 文档同步

- [x] 5.1 更新所有与 build-plan steps 相关的 OpenSpec 文档，移除"compute 默认生成 steps"的旧描述
- [x] 5.2 同步默认模式、steps 模式、`BuildScheme`、`BuildStepsScheme` 与 `energycells` 新边界
