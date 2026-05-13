# Build Plan Preview - Test Tasks

## 1 单元测试

- [ ] 1.1 测试 buildFlowPlanGraph BFS 扩散与 SCC 检测
  - [ ] 1.1.1 在 buildFlowPlanGraph.ts 对 buildFlowPlanGraph 编写单元测试
  - [ ] 1.1.2 给定 targetModules 含 hullparts 产线，buildFlowView 含 assignment（g1→g2, output-build-material, hullparts），断言图包含 g1→g2 边 #期望: [边存在]
  - [ ] 1.1.3 给定 buildFlowView 含循环依赖（g1→g2→g1），断言 sccGroups 包含 [g1, g2] #期望: [SCC识别正确]
  - [ ] 1.1.4 给定 buildFlowView=null，断言返回空图 structure #期望: [nodes 空, edges 空]

- [ ] 1.2 测试依赖图 isolated 扩展
  - [ ] 1.2.1 在 buildFlowPlanGraph.ts 对 isolated 扩展逻辑编写单元测试
  - [ ] 1.2.2 给定 targetGroup 含 isolated 节点（wareId=graphene），且存在产线 g3 的 manual 节点产出 graphene
  - [ ] 1.2.3 执行 buildFlowPlanGraph 并断言图包含 ROOT→g3 的 isolated 边 #期望: [isolated 边存在]
  - [ ] 1.2.4 给定 isolated 节点无任何产线产出，断言不产生 isolated 边 #期望: [无 isolated 边]

- [ ] 1.3 测试 createBuildFlowPlanPreview 衍生类型拆分
  - [ ] 1.3.1 在 buildPlanProductionLine.ts 对 createBuildFlowPlanPreview 编写单元测试
  - [ ] 1.3.2 给定 production-rate goal（wareId=energycells, rate=500），无 buildFlowView
  - [ ] 1.3.3 执行 createBuildFlowPlanPreview 并断言 lines 包含 derived 项 #期望: [kind=derived]
  - [ ] 1.3.4 给定 required-production goal，断言 lines 包含 required 项且不含 moduleId #期望: [kind=required, moduleId=undefined]

- [ ] 1.4 测试 preview 项合并规则
  - [ ] 1.4.1 对 mergePreviewItems 编写单元测试
  - [ ] 1.4.2 给定同 groupId+wareId+moduleId 的两条 derived 项（一条 derived=['target'], 一条 derived=['production']），断言合并为一条且 derived=['target','production'] #期望: [1条, 标签集合包含 target 和 production]
  - [ ] 1.4.3 给定同 groupId+wareId 的两条 required 项，断言合并为一条 #期望: [1条]
  - [ ] 1.4.4 给定同一产线同一 wareId 的 derived 与 required 项，断言不合并 #期望: [2条]

- [ ] 1.5 测试 lineage 生成与 module 选择
  - [ ] 1.5.1 对 lineage 推导逻辑编写单元测试
  - [ ] 1.5.2 给定 group.isLocked=true，lockedLineage='teladi'，断言 lineage='teladi' #期望: [teladi]
  - [ ] 1.5.3 给定 group.isLocked=false，subCategory='argon'，断言 lineage='argon' #期望: [argon]
  - [ ] 1.5.4 给定 lockedLineage 与 subCategory 均为空，断言 lineage='default' #期望: [default]
  - [ ] 1.5.5 给定 manual 节点匹配多个 module，先按 lineage 筛选，仍有多个取第一个 #期望: [moduleId 确定]

- [ ] 1.6 测试 computeProductionLineAllocation 全局两轮分配
  - [ ] 1.6.1 在 computeProductionLineAllocation.ts 对全局两轮分配编写单元测试
  - [ ] 1.6.2 给定 manual 节点匹配的目标，断言第一轮 manual 分配成功 #期望: [isUnmatched=false]
  - [ ] 1.6.3 给定 auto 节点匹配且已有 manual 分配的产线，断言目标分配到已有产线 #期望: [groupId 与 manual 产线一致]
  - [ ] 1.6.4 给定无任何匹配，断言 isUnmatched=true #期望: [isUnmatched=true]

## 2 E2E 标准状态与状态迁移

- [ ] 2.1 状态: Preview 面板已加载且有预览结果
  - [ ] 2.1.1 在面板 `[data-testid="goal-search-input"]` 输入 ware 名称
  - [ ] 2.1.2 点击搜索结果项添加 production-rate 目标
  - [ ] 2.1.3 定位 preview 区 `[data-testid="allocation-section"]` 元素
  - [ ] 2.1.4 断言预览区显示分组列表且首组 `.allocation-group-name` 文本非空 #期望: [分组名可见]
  - [ ] 2.1.5 断言每个分组显示名称和 moduleId 计数 #期望: [名称和计数均可见]

- [ ] 2.2 切换: 勾选建材产线 checkbox -> Preview 重算
  - [ ] 2.2.1 在建造目标面板定位 `input[type=checkbox]` 元素
  - [ ] 2.2.2 切换 checkbox 勾选状态
  - [ ] 2.2.3 记录切换前的 `.allocation-group` 数量，切换后断言数量不同或组名文本变更 #期望: [分组数量/名称变更]

## 3 E2E 测试场景

- [ ] 3.1 Case: Preview 区渲染 derived 与 required 项
  - [ ] 3.1.1 状态: Preview 面板已加载且有预览结果
  - [ ] 3.1.2 在预览区定位 `.goal-row` 元素
  - [ ] 3.1.3 断言 derived 项显示绿色 `.preview-tag--derived` 标签 #期望: [标签颜色正确]
  - [ ] 3.1.4 断言 required 项显示红色 `.preview-tag--required` 标签 #期望: [标签颜色正确]
  - [ ] 3.1.5 断言每个 preview 项带有锁定图标 `.derived-badge` #期望: [锁定图标存在]

- [ ] 3.2 Case: 分组 card 显示 moduleId 去重计数
  - [ ] 3.2.1 状态: Preview 面板已加载且有预览结果
  - [ ] 3.2.2 在分组 header 内定位 `.allocation-group-count` 元素
  - [ ] 3.2.3 断言计数值等于该组 derived 项 moduleId 去重数 #期望: [计数匹配]

- [ ] 3.3 Case: checkbox 切换影响预览
  - [ ] 3.3.1 状态: Preview 面板已加载且有预览结果
  - [ ] 3.3.2 切换: 勾选建材产线 checkbox -> Preview 重算
  - [ ] 3.3.3 断言建材产线区可见 #期望: [建材产线分组存在]
  - [ ] 3.3.4 切换: 勾选建材产线 checkbox -> Preview 重算
  - [ ] 3.3.5 断言建材产线区隐藏（或内容无建材系项）#期望: [建材产线分组不存在]

- [ ] 3.4 Case: 无规划模式 preview 生成
  - [ ] 3.4.1 在建造目标面板添加 production-rate 目标
  - [ ] 3.4.2 在逻辑产线方案菜单中选择"无规划"
  - [ ] 3.4.3 断言 preview 区包含 `.allocation-group--unmatched` 元素 #期望: [未匹配分组存在]
  - [ ] 3.4.4 断言预览结果不含依赖图 / SCC #期望: [graph=null, sccGroups=[]]

- [ ] 3.5 Case: Preview 项名称显示规则
  - [ ] 3.5.1 状态: Preview 面板已加载且有预览结果
  - [ ] 3.5.2 在预览区定位 `.goal-name` 元素
  - [ ] 3.5.3 断言 derived 项显示 module 名称（非 ware 名称） #期望: [名称对应 module]
  - [ ] 3.5.4 断言 required 项显示 ware 名称 #期望: [名称对应 ware]

- [ ] 3.6 Case: 用户目标区与 preview 区分离
  - [ ] 3.6.1 状态: Preview 面板已加载且有预览结果
  - [ ] 3.6.2 在 preview 区定位任意 `.goal-row` 元素
  - [ ] 3.6.3 断言 preview 区不含数量输入框 #期望: [无 X4NumberInput]
  - [ ] 3.6.4 断言 preview 区不含删除按钮 #期望: [无 remove-btn]

## 4 Bug 测试
