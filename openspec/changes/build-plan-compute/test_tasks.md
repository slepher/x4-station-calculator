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

- [ ] 2.1 状态: 建造方案计算完成
  - [ ] 2.1.1 在 `[data-testid="goal-search-input"]` 中输入 ware 名称并添加 production-rate 目标
  - [ ] 2.1.2 点击文本匹配"计算建造方案"的按钮
  - [ ] 2.1.3 等待计算完成，定位 scheme groups 容器
  - [ ] 2.1.4 断言至少一个方案分组可见 #期望: [分组存在]
  - [ ] 2.1.5 断言分组内卡片显示名称和耗时文本 #期望: [卡片信息可见]

- [ ] 2.2 切换: 修改目标 -> 重算方案
  - [ ] 2.2.1 在已计算状态修改目标数量
  - [ ] 2.2.2 点击"计算建造方案"按钮
  - [ ] 2.2.3 断言方案结果更新 #期望: [方案内容变化]

## 3 E2E 测试场景

- [ ] 3.1 Case: 基础建造方案计算
  - [ ] 3.1.1 状态: 建造方案计算完成
  - [ ] 3.1.2 切换: 修改目标 -> 重算方案
  - [ ] 3.1.3 断言计算按钮可点击 #期望: [按钮可用]
  - [ ] 3.1.4 断言方案分组列表存在 #期望: [方案分组存在]

- [ ] 3.2 Case: 方案卡片展示模块汇总
  - [ ] 3.2.1 状态: 建造方案计算完成
  - [ ] 3.2.2 切换: 修改目标 -> 重算方案
  - [ ] 3.2.3 在方案卡片内定位主要模块信息区
  - [ ] 3.2.4 断言主要模块名称和数量可见 #期望: [模块信息显示]

- [ ] 3.3 Case: 方案详情弹窗两态展示
  - [ ] 3.3.1 状态: 建造方案计算完成
  - [ ] 3.3.2 点击方案卡片进入详情弹窗
  - [ ] 3.3.3 断言默认显示模块汇总手风琴 #期望: [模块汇总可见]
  - [ ] 3.3.4 切换 steps 开关，断言显示 step 列表 #期望: [steps列表可见]
  - [ ] 3.3.5 关闭 steps 开关，断言恢复模块汇总 #期望: [模块汇总恢复]

## 4 Bug 测试
