# Build Plan Goal - Test Tasks

## 1 单元测试

- [ ] 1.1 测试 expandFleetGoals 将 Fleet 目标转换为 production-rate 目标
  - [ ] 1.1.1 在 useBuildPlanStore.ts 对 expandFleetGoals 编写单元测试
  - [ ] 1.1.2 给定 fleet goal 含 2 条 entry（shipId=ship_arg_l_destroyer_01_a, blueprintId=bp-1, quantity=2; shipId=ship_arg_s_fighter_01, blueprintId=bp-2, quantity=5），shipBuildStore.getBuildAnalysis 返回 totalBuildTime=3600, summaryItems=[{ wareId: energycells, totalQty: 10000 }, { wareId: hullparts, totalQty: 50000 }]
  - [ ] 1.1.3 执行 expandFleetGoals 并断言产出数组包含 target-production 类型元素 #期望: [元素数量>0]
  - [ ] 1.1.4 断言每条生产目标的 ratePerHour = ceil(totalQty / effectiveBuildTime × 3600) #期望: [ratePerHour 符合公式计算结果]

- [ ] 1.2 测试 resolveFleetMergedRates 的 effectiveBuildTime 计算
  - [ ] 1.2.1 在 useBuildPlanStore.ts 对 resolveFleetMergedRates 编写单元测试
  - [ ] 1.2.2 给定 fleet goal: buildTime=3600, buildTimeMode='actual', shipyardLCount=2, shipyardXLCount=1, wharfCount=1, entries 按船厂分组后 actualTotalBuildTime=4800
  - [ ] 1.2.3 执行 resolveFleetMergedRates 并断言 effectiveBuildTime = 4800 #期望: [4800]
  - [ ] 1.2.4 将 buildTimeMode 改为 'planned'，重新执行并断言 effectiveBuildTime = 3600 #期望: [3600]

- [ ] 1.3 测试方案 CRUD 操作
  - [ ] 1.3.1 在 useBuildPlanStore.ts 对 createNewPlan / switchPlan / deletePlan 编写单元测试
  - [ ] 1.3.2 创建方案 A，断言 savedPlans.list.length = 1 且 activeId = 方案A.id #期望: [length=1, activeId正确]
  - [ ] 1.3.3 创建方案 B，切换到方案 B，断言 activeId = 方案B.id 且 buildGoals 对应方案 B #期望: [activeId和buildGoals一致]
  - [ ] 1.3.4 删除 activeId 对应方案，断言自动切换到剩余方案 #期望: [activeId变为方案B.id]
  - [ ] 1.3.5 删除全部方案后通过 setBuildGoal 添加 goal，断言自动创建默认方案 #期望: [activeId不为null]

- [ ] 1.4 测试 resolveLogicFlowStateForBuildPlan 三分支
  - [ ] 1.4.1 在 buildPlanLogicFlowSource.ts 对 resolveLogicFlowStateForBuildPlan 编写单元测试
  - [ ] 1.4.2 给定 logicFlowPlanId === logicFlowStore.savedPlans.activeId，断言 source = 'active-store' #期望: [active-store]
  - [ ] 1.4.3 给定 logicFlowPlanId 为 list 中其他方案的 id，断言 source = 'rebuilt-plan' #期望: [rebuilt-plan]
  - [ ] 1.4.4 给定 logicFlowPlanId = null，断言 source = 'none' #期望: [none]

- [ ] 1.5 测试 computeProductionLineAllocation 三级匹配
  - [ ] 1.5.1 在 computeProductionLineAllocation.ts 对 computeProductionLineAllocation 编写单元测试
  - [ ] 1.5.2 给定 build-flow buildFlowGroups 包含 outputMaterialTag 匹配的产线组，断言目标分配到对应组且 isUnmatched=false #期望: [分配成功]
  - [ ] 1.5.3 给定无 outputMaterialTag 匹配但 logic-flow manual 节点匹配，断言分配到 manual 组 #期望: [isUnmatched=false]
  - [ ] 1.5.4 给定所有匹配都失败，断言进入 unmatched 组且 isUnmatched=true #期望: [isUnmatched=true]

- [ ] 1.6 测试 addFleetEntry / removeFleetEntry 操作
  - [ ] 1.6.1 在 useBuildPlanStore.ts 对 addFleetEntry 编写单元测试
  - [ ] 1.6.2 首次调用 addFleetEntry('ship_arg_l_destroyer_01_a', 'bp-1')，断言 buildGoals 包含 type=fleet 的目标且 entries.length=1 #期望: [1条entry]
  - [ ] 1.6.3 再次调用 addFleetEntry('ship_arg_l_destroyer_01_a', 'bp-1')，断言同类条目 quantity 增至 2 #期望: [quantity=2]
  - [ ] 1.6.4 调用 removeFleetEntry('bp-1') 移除唯一 entry，断言 fleet goal 从 buildGoals 中移除 #期望: [buildGoals 不含 fleet 类型]

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: 建造目标面板已加载
  - [ ] 2.1.1 在帝国工作台页面定位 `.panel-card` 元素
  - [ ] 2.1.2 在 panel-card 内定位 `[data-testid="build-plan-plan-menu-trigger"]`
  - [ ] 2.1.3 在 panel-card 内定位 `[data-testid="goal-search-input"]`
  - [ ] 2.1.4 断言三个元素均可见 #期望: [元素可见]
  - [ ] 2.1.5 断言面板标题显示方案名称文本 #期望: [标题文本非空]

- [ ] 2.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 2.2.1 在 `[data-testid="goal-search-input"]` 中输入 "energycells"
  - [ ] 2.2.2 在 `[data-testid="goal-search-popover"]` 中点击 `[data-testid="goal-result-energycells"]` 项
  - [ ] 2.2.3 断言 `[data-testid="goal-item-energycells"]` 出现在目标列表中 #期望: [目标项存在]
  - [ ] 2.2.4 断言方案触发器文本更新为方案名称 #期望: [文本非默认空值]

- [ ] 2.3 切换: 无目标 -> 有 Fleet 目标
  - [ ] 2.3.1 在 `[data-testid="goal-category-select"]` 中选择 fleet 类别
  - [ ] 2.3.2 在 `[data-testid="fleet-search-input"]` 中输入蓝图名称
  - [ ] 2.3.3 在 `[data-testid="fleet-search-popover"]` 中点击 `[data-testid^="fleet-result-"]` 项
  - [ ] 2.3.4 断言 `[data-testid="fleet-goal-card"]` 出现 #期望: [卡片可见]
  - [ ] 2.3.5 断言 `[data-testid="fleet-goal-card"]` 内包含 `.fleet-group` 元素 #期望: [分组存在]

- [ ] 2.4 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 2.4.1 点击 `[data-testid="build-plan-plan-menu-trigger"]` 展开方案菜单
  - [ ] 2.4.2 在 `[data-testid="build-plan-plan-menu"]` 中点击目标方案的 `.plan-menu-item` 按钮
  - [ ] 2.4.3 断言面板标题更新为目标方案名称 #期望: [标题文本匹配]
  - [ ] 2.4.4 断言 `[data-testid="build-plan-plan-menu"]` 不可见 #期望: [菜单关闭]

- [ ] 2.5 切换: 有目标 -> 删除当前方案
  - [ ] 2.5.1 点击 `[data-testid="build-plan-plan-menu-trigger"]` 展开方案菜单
  - [ ] 2.5.2 在 `[data-testid="build-plan-plan-menu"]` 中点击当前方案对应的 `.plan-delete-btn`
  - [ ] 2.5.3 断言面板标题变更为其他方案的名称 #期望: [面板标题更新]
  - [ ] 2.5.4 点击 `[data-testid="build-plan-plan-menu-trigger"]` 重新展开菜单
  - [ ] 2.5.5 断言已删除方案的名称文本不在菜单中 #期望: [菜单不包含已删除方案名]

- [ ] 2.6 切换: 有 Fleet 目标 -> 切换建造时间模式
  - [ ] 2.6.1 定位 `.fleet-mode-select` 原生 select 元素
  - [ ] 2.6.2 通过 `page.evaluate` 记录当前 select 值和 fleet-rates 文本作为切换前快照
  - [ ] 2.6.3 切换 select 值至另一种模式（actual ↔ planned）
  - [ ] 2.6.4 断言 `[data-testid="fleet-rates"]` 内各物料小时速率数值与切换前快照不同 #期望: [速率数值变化]

- [ ] 2.7 切换: 有目标 -> 绑定逻辑产线方案
  - [ ] 2.7.1 点击 `[data-testid="build-plan-flow-menu-trigger"]` 展开产线方案菜单
  - [ ] 2.7.2 在 `[data-testid="build-plan-flow-menu"]` 中点击目标产线的 `.flow-plan-menu-item` 按钮
  - [ ] 2.7.3 断言产线方案名称显示在触发器按钮上 #期望: [按钮文本匹配选中方案名]

- [ ] 2.8 切换: 有目标 -> 绑定无规划产线
  - [ ] 2.8.1 点击 `[data-testid="build-plan-flow-menu-trigger"]` 展开产线方案菜单
  - [ ] 2.8.2 在 `[data-testid="build-plan-flow-menu"]` 中点击 `[data-testid="flow-plan-menu-item-unplanned"]` 项
  - [ ] 2.8.3 断言 `[data-testid="build-plan-flow-menu-trigger-label"]` 文本为空字符串 #期望: [触发器按钮文本为空]

- [ ] 2.9 切换: 有 Fleet 目标 -> 删除 Fleet 条目
  - [ ] 2.9.1 在 FleetGoalCard 内定位 `[data-testid^="fleet-entry-remove-"]` 按钮
  - [ ] 2.9.2 点击删除按钮移除指定条目
  - [ ] 2.9.3 断言 `[data-testid^="fleet-entry-remove-"]` 不可见 #期望: [条目元素不存在]

## 3 E2E 测试场景

- [ ] 3.1 Case: 首次添加目标自动创建方案
  - [ ] 3.1.1 状态: 建造目标面板已加载
  - [ ] 3.1.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.1.3 断言面板标题显示默认方案名称 #期望: [方案名格式匹配 Build Plan 1]
  - [ ] 3.1.4 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.1.5 再次通过搜索框添加 hullparts，断言 `[data-testid="goal-item-energycells"]` 和 `[data-testid="goal-item-hullparts"]` 均存在 #期望: [两个目标项可见]

- [ ] 3.2 Case: 方案菜单切换与目标恢复
  - [ ] 3.2.1 状态: 建造目标面板已加载
  - [ ] 3.2.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.2.3 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 3.2.4 断言目标列表不包含 `[data-testid="goal-item-energycells"]` #期望: [energycells目标不存在]
  - [ ] 3.2.5 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 3.2.6 断言 `[data-testid="goal-item-energycells"]` 恢复可见 #期望: [energycells目标存在]

- [ ] 3.3 Case: 方案删除与自动切换
  - [ ] 3.3.1 状态: 建造目标面板已加载
  - [ ] 3.3.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.3.3 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 3.3.4 切换: 有目标 -> 删除当前方案
  - [ ] 3.3.5 断言面板标题切换回原方案 #期望: [标题文本为方案A名称]
  - [ ] 3.3.6 切换: 有目标 -> 删除当前方案
  - [ ] 3.3.7 断言面板显示无方案状态 #期望: [标题文本显示空值或占位文本]

- [ ] 3.4 Case: Fleet 条目添加与分组展示
  - [ ] 3.4.1 状态: 建造目标面板已加载
  - [ ] 3.4.2 切换: 无目标 -> 有 Fleet 目标
  - [ ] 3.4.3 断言 `[data-testid="fleet-goal-card"]` 内 `.fleet-group` 的标题文本匹配录入条目的 ship.class #期望: [分组标题对应ship_l/ship_xl/wharf]
  - [ ] 3.4.4 断言 `[data-testid^="fleet-entry-qty-"]` 显示值为 1 #期望: [quantity=1]

- [ ] 3.5 Case: Fleet 建造时间模式切换
  - [ ] 3.5.1 状态: 建造目标面板已加载
  - [ ] 3.5.2 切换: 无目标 -> 有 Fleet 目标
  - [ ] 3.5.3 切换: 有 Fleet 目标 -> 切换建造时间模式
  - [ ] 3.5.4 断言 `[data-testid="fleet-build-time-input"]` 可见 #期望: [输入框可见]
  - [ ] 3.5.5 切换: 有 Fleet 目标 -> 切换建造时间模式
  - [ ] 3.5.6 断言 `[data-testid="fleet-build-time-input"]` 不可见 #期望: [输入框隐藏]

- [ ] 3.6 Case: Fleet 蓝图缺失降级处理
  - [ ] 3.6.1 状态: 建造目标面板已加载
  - [ ] 3.6.2 切换: 无目标 -> 有 Fleet 目标
  - [ ] 3.6.3 通过 `page.evaluate(() => window.shipBuildStore.removeBlueprint(bpId))` 使蓝图不可用
  - [ ] 3.6.4 断言 `[data-testid^="fleet-entry-warning-"]` 可见 #期望: [警告标记存在]
  - [ ] 3.6.5 断言对应条目的 `.fleet-entry-detail` 内无物料行 #期望: [物料列表为空]
  - [ ] 3.6.6 切换: 有 Fleet 目标 -> 切换建造时间模式
  - [ ] 3.6.7 断言 `[data-testid="fleet-rates"]` 内分组标题仍可见 #期望: [速率区标题正常]
  - [ ] 3.6.8 切换: 有 Fleet 目标 -> 删除 Fleet 条目
  - [ ] 3.6.9 断言 `[data-testid="fleet-goal-card"]` 不存在 #期望: [卡片消失]

- [ ] 3.7 Case: 删除最后一条 Fleet 条目自动移除
  - [ ] 3.7.1 状态: 建造目标面板已加载
  - [ ] 3.7.2 切换: 无目标 -> 有 Fleet 目标
  - [ ] 3.7.3 切换: 有 Fleet 目标 -> 删除 Fleet 条目
  - [ ] 3.7.4 断言 `[data-testid="fleet-goal-card"]` 不存在 #期望: [卡片消失]

- [ ] 3.8 Case: 同 active 逻辑产线绑定
  - [ ] 3.8.1 状态: 建造目标面板已加载
  - [ ] 3.8.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.8.3 切换: 有目标 -> 绑定逻辑产线方案
  - [ ] 3.8.4 断言 `[data-testid="production-line-allocation-section"]` 显示产线分组 #期望: [分配区非空]
  - [ ] 3.8.5 导航到 logic-flow 页面，在产线组的 modules 数组中添加一个新模块节点，导航回建造目标面板
  - [ ] 3.8.6 断言 `[data-testid="production-line-allocation-section"]` 内分组数与绑定前不同 #期望: [分配结果更新]

- [ ] 3.9 Case: 非 active 逻辑产线绑定
  - [ ] 3.9.1 状态: 建造目标面板已加载
  - [ ] 3.9.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.9.3 切换: 有目标 -> 绑定逻辑产线方案
  - [ ] 3.9.4 断言 `[data-testid="production-line-allocation-section"]` 非空 #期望: [分配区有内容]
  - [ ] 3.9.5 通过 `page.evaluate` 向 logicFlowStore.groups 添加新节点
  - [ ] 3.9.6 断言 `[data-testid="production-line-allocation-section"]` 内分组内容与修改前一致 #期望: [分配结果不变]

- [ ] 3.10 Case: 无规划产线模式
  - [ ] 3.10.1 状态: 建造目标面板已加载
  - [ ] 3.10.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.10.3 切换: 有目标 -> 绑定无规划产线
  - [ ] 3.10.4 断言 `[data-testid="build-plan-flow-menu-trigger-label"]` 为空 #期望: [触发器文本为空]
  - [ ] 3.10.5 断言 `[data-testid="production-line-allocation-section"]` 显示待规划产线组 #期望: [分配列表包含未分配标识]

- [ ] 3.11 Case: 产线自动分配展示
  - [ ] 3.11.1 状态: 建造目标面板已加载
  - [ ] 3.11.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.11.3 切换: 有目标 -> 绑定逻辑产线方案
  - [ ] 3.11.4 断言 `[data-testid="production-line-allocation-section"]` 内第一个分配组不包含 `.allocation-unmatched` 类 #期望: [已匹配组正常样式]

- [ ] 3.12 Case: 页面刷新持久化恢复
  - [ ] 3.12.1 状态: 建造目标面板已加载
  - [ ] 3.12.2 切换: 无目标 -> 有 production-rate 目标
  - [ ] 3.12.3 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 3.12.4 通过 `page.evaluate` 记录当前 savedPlans 快照，执行 `page.reload()`
  - [ ] 3.12.5 设置语言并等待页面完全加载后断言面板标题显示后创建方案的名称 #期望: [标题文本匹配方案B名称]
  - [ ] 3.12.6 断言目标列表不包含 `[data-testid="goal-item-energycells"]` #期望: [空目标列表]
  - [ ] 3.12.7 切换: 有 production-rate 目标 -> 切换到其他方案
  - [ ] 3.12.8 断言 `[data-testid="goal-item-energycells"]` 可见 #期望: [energycells目标存在]
  - [ ] 3.12.9 切换: 有目标 -> 绑定无规划产线
  - [ ] 3.12.10 断言 `[data-testid="build-plan-flow-menu-trigger-label"]` 为空 #期望: [触发器文本为空]

## 4 Bug 测试
