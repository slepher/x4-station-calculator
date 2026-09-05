# Build Plan Compute - Test Tasks

## 1 单元测试

- [ ] 1.1 测试 computeBuildFlowPlan 读取 preview 并计算主要模块
  - [ ] 1.1.1 在 buildPlanProductionLine.ts 对 computeBuildFlowPlan 编写单元测试
  - [ ] 1.1.2 给定 previewResult 含 1 条生产目标 line（hullparts, rate=100），模块映射含 prod_gen_hullparts_macro
  - [ ] 1.1.3 执行 computeBuildFlowPlan 并断言 ComputeResult.lines 长度 > 0 #期望: [lines非空]
  - [ ] 1.1.4 断言 line 包含 primaryModules 且 primaryModules[0].id 为 hullparts 产线模块 #期望: [primaryModules正确]

- [ ] 1.2 测试 SCC 迭代收敛
  - [ ] 1.2.1 对 computeBuildFlowPlan 的 SCC 循环编写单元测试
  - [ ] 1.2.2 给定 preview 含 SCC 组（g1↔g2），迭代应逐渐收敛
  - [ ] 1.2.3 断言迭代结束后各组 primaryModules 稳定（makePrimarySnapshot 不变） #期望: [稳定]
  - [ ] 1.2.4 断言迭代次数不超过最大限制 #期望: [≤60次]

- [ ] 1.3 测试 mergeIntoExistingPlan 保留手动覆盖
  - [ ] 1.3.1 在 mergeIntoExistingPlan.ts 对 mergeIntoExistingPlan 编写单元测试
  - [ ] 1.3.2 给定 incoming 方案和含 manualModules 的 existing 方案
  - [ ] 1.3.3 执行 mergeIntoExistingPlan 并断言结果包含 manualModules #期望: [manualModules保留]

- [ ] 1.4 测试 compute 与 preview 边界隔离
  - [ ] 1.4.1 对 computeBuildFlowPlan 只读使用 preview 编写单元测试
  - [ ] 1.4.2 给定 previewResult，compute 后断言 previewResult 未被修改 #期望: [previewResult不变]
  - [ ] 1.4.3 断言 compute 不重新分配产线 #期望: [不调用 computeProductionLineAllocation]

- [ ] 1.5 测试 PrimaryModuleSnapshot 比较逻辑
  - [ ] 1.5.1 对 makePrimarySnapshot 编写单元测试
  - [ ] 1.5.2 给定两组相同模块列表（顺序不同），断言快照相同 #期望: [快照相等]
  - [ ] 1.5.3 给定不同模块列表，断言快照不同 #期望: [快照不等]

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: 固定 Energy Cells 目标完成显式计算
  - [ ] 2.1.1 通过 `candidate-search-input` 搜索并添加 `energycells` production-rate 目标
  - [ ] 2.1.2 点击计算建造方案按钮并等待 computing 消失
  - [ ] 2.1.3 断言方案卡片含 Energy Cell Production ×1、Energy Cells ×520、12m

- [ ] 2.2 切换: 修改目标数量 -> 重算方案
  - [ ] 2.2.1 在 `goal-item-energycells` 输入 2000000 并 blur
  - [ ] 2.2.2 点击计算建造方案按钮
  - [ ] 2.2.3 断言方案卡片文本发生变化

## 3 E2E 测试场景

- [ ] 3.1 Case: 基础建造方案计算
  - [ ] 3.1.1 状态: 建造方案计算完成
  - [ ] 3.1.2 断言计算按钮可用、方案卡片存在且显示耗时

- [ ] 3.2 Case: 方案卡片展示模块汇总与材料去重
  - [ ] 3.2.1 添加 `hullparts` 与 `energycells` 两个目标并计算
  - [ ] 3.2.2 断言船体部件产线、模块数量和 Energy Cells 建材可见
  - [ ] 3.2.3 断言 Energy Cells 建材行只出现一次

- [ ] 3.3 Case: 方案详情弹窗两态展示
  - [ ] 3.3.1 开启建材产线后计算并点击 build-material 方案卡片
  - [ ] 3.3.2 断言默认模块汇总可见
  - [ ] 3.3.3 切换 `role=switch`，断言 step `#1` 可见
  - [ ] 3.3.4 再次切换，断言恢复模块汇总

## 4 Bug 测试

- [ ] 4.1 Case: 无规划仍执行计算
  - [ ] 4.1.1 添加 Energy Cells 目标并通过 flow 菜单选择 `unplanned`
  - [ ] 4.1.2 点击计算按钮
  - [ ] 4.1.3 断言方案卡片存在
- [ ] 4.2 Case: SCC 增量限制
  - [ ] 4.2.1 保留 SCC 迭代单调增量与最大次数限制作为产品候选
  - [ ] 4.2.2 E2E 不断言全局最小解，Unit 负责稳定性与 `≤60` 次限制
