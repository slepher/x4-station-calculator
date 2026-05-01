# Build Flow Specification

## Purpose

为 `logic-flow` 增加一套独立的建筑材料规划视图，基于现有产线自动推导建筑相关产线、目标材料与来源分配关系，并通过拖拽、菜单和有向连线可视化这些匹配结果。

## ADDED Requirements

### Requirement: Build Flow Derived Zone

#### Scenario: 从现有产线推导建筑产线区

**前提** `logic-flow` 页面已存在一个或多个 `ProductionLineGroup`
**当** 系统渲染建筑产线区
**那么** 系统必须以 `ProductionLineGroup` 为基础单位推导建筑产线区
**并且** 不得直接修改现有 group 或 node 数据

#### Scenario: 主要产品定义

**前提** 某条产线组内存在多个节点
**当** 系统计算该产线的主要产品
**那么** 仅统计 `source === 'manual' && !isIsolated` 的节点产物
**并且** `auto` 或 `isIsolated` 节点不得作为主要产品

#### Scenario: 需求原材料定义

**前提** 页面存在多条现有产线
**当** 系统计算全局需求原材料
**那么** 必须对现有产线自身模块的 `buildCost` 进行汇总
**并且** 参与统计的模块口径为：group 内所有 `!isIsolated && moduleId != null && tier > 0` 的节点
**并且** `isIsolated` 节点无模块，不得纳入 buildCost
**并且** `tier === 0` 的节点不是可建造模块（如能源电池），不得纳入 buildCost
**并且** 汇总结果作为建筑产线区的全局“需求原材料”

#### Scenario: 建筑产线筛选

**前提** 某条现有产线已计算出主要产品
**当** 其主要产品中存在任一 `wareId` 命中全局“需求原材料”
**那么** 该产线必须出现在建筑产线区
**并且** 未命中的产线不得出现在建筑产线区

### Requirement: Build Flow Layout And Visibility

#### Scenario: 固定布局位置

**前提** `logic-flow` 工作台已渲染
**当** 页面显示候选区、建筑产线区与规划区
**那么** 三者顺序必须为 `CandidateZone -> BuildFlowZone -> PlanningZone`
**并且** `BuildFlowZone` 位于中部独立区域

#### Scenario: 不提供折叠控制

**前提** `BuildFlowZone` 已渲染
**当** 用户查看该区域
**那么** 系统不得提供手动折叠/展开控制

#### Scenario: 规划拖拽期间自动隐藏

**前提** 用户进入规划区相关拖拽流程
**当** 当前拖拽上下文与 `build-flow` 无关
**那么** `BuildFlowZone` 必须自动隐藏
**并且** 不得影响当前规划拖拽的 hover、drop 与命中行为
**当** 规划拖拽结束
**那么** `BuildFlowZone` 必须自动恢复显示

### Requirement: Build Flow Card Content

#### Scenario: 产线原材料标签

**前提** 某条产线已进入建筑产线区
**当** 系统渲染该产线 card
**那么** card 内必须显示“产线原材料”标签组
**并且** 标签内容为该产线主要产品中命中“需求原材料”的产物

#### Scenario: 产线建材标签

**前提** 某条产线已进入建筑产线区
**当** 系统渲染该产线 card
**那么** card 内必须显示“产线建材”标签组
**并且** 标签内容为该产线自身模块（“!isIsolated && tier > 0”）“buildCost” 的材料集合与“现产原材料”的交集

#### Scenario: 产出区标签

**前提** 建筑产线区存在一条或多条入选产线
**当** 系统渲染“产出区” card
**那么** card 内必须显示“现产原材料”标签
**并且** 标签内容为全部入选产线“产线原材料”的去重并集

#### Scenario: Card 布局结构

**前提** 某条产线已进入建筑产线区
**当** 系统渲染该产线 card
**那么** card 顶部必须显示产线名称（与规划区产线名称一致）
**并且** “产线建材”标签必须在左侧竖向排列
**并且** “产线原材料”标签必须在右侧竖向排列且右对齐

#### Scenario: 产线原材料外伸按钮布局

**前提** 某条产线 card 已渲染“产线原材料”标签
**当** 用户查看标签布局
**那么** 标签文字必须左对齐
**并且** `+` 按钮必须常驻显示在标签右侧
**并且** 按钮必须从 card 右边外伸

#### Scenario: 产线建材外伸按钮布局

**前提** 某条产线 card 已渲染“产线建材”标签
**当** 用户查看标签布局
**那么** 标签文字必须右对齐
**并且** `+` 按钮必须常驻显示在标签左侧
**并且** 按钮必须从 card 左边外伸

#### Scenario: 产出区外伸按钮布局

**前提** 产出区 card 已渲染“现产原材料”标签
**当** 用户查看标签布局
**那么** 标签文字必须右对齐
**并且** `+` 按钮必须常驻显示在标签左侧
**并且** 按钮必须从 card 左边外伸

#### Scenario: 外伸按钮盖住 card 边框

**前提** 任一标签按钮向 card 外侧外伸
**当** 用户观察 tag 与 card 侧边的交界处
**那么** 外伸出去的按钮与柄部必须完全盖住对应侧的 card 边框
**并且** 不得出现边框从按钮后方穿出的视觉效果

### Requirement: Build Flow Matching Operation

#### Scenario: 仅允许同 wareId 目标

**前提** 用户从某个“产线原材料”标签发起绑定
**当** 系统计算可投放目标
**那么** 只允许匹配 `wareId` 相同的“产线建材”或“现产原材料”目标标签
**并且** 不得按本地化名称文本做模糊匹配

#### Scenario: 拖拽建立关系

**前提** 来源标签与目标标签 `wareId` 相同
**当** 用户完成拖拽投放
**那么** 系统必须创建一条独立的建筑流关系记录
**并且** 不得修改现有 `logicFlow.groups` 或节点字段

#### Scenario: 菜单建立关系

**前提** 用户点击来源标签上的常驻 `+`
**当** 系统弹出目标菜单
**那么** 菜单必须从标签右侧弹出（空间不足时向左），与候选区弹出策略一致
**并且** 菜单项必须显示目标产线名称或“产出区”，后跟 ware 名称作为辅助说明
**当** 用户从菜单中选择一个目标
**那么** 系统必须写入与拖拽相同的关系记录
**并且** 菜单绑定与拖拽绑定必须复用同一套关系语义

#### Scenario: 关系属于单条方案

**前提** 当前 logic-flow 已保存为某条 `LogicFlowPlan`
**当** 系统持久化或加载建筑流关系
**那么** 关系数据必须作为该 `LogicFlowPlan` 的内容一起保存和加载
**并且** 不得与其他 plan 共用或串联

#### Scenario: 目标唯一绑定

**前提** 某个目标标签已绑定来源产线
**当** 用户再次把另一个来源绑定到同一个目标标签
**那么** 新绑定必须覆盖旧绑定
**并且** 同一目标标签任意时刻只能保留一个来源产线

#### Scenario: 解绑目标

**前提** 某个目标标签当前已存在绑定关系
**当** 用户执行解绑操作
**那么** 系统必须删除该目标标签对应的关系记录
**并且** 来源产线与现有产线数据保持不变

### Requirement: Build Flow Directed Edge

#### Scenario: 绑定后显示有向线

**前提** 用户已成功建立一条建筑流关系
**当** 关系写入完成
**那么** 系统必须立即绘制一条有向连接线
**并且** 方向必须从来源“产线原材料”标签指向目标标签

#### Scenario: 覆盖后更新连线

**前提** 某个目标标签已存在入线
**当** 用户用新的来源覆盖该目标标签
**那么** 旧连线必须移除
**并且** 新连线必须指向新的来源标签

#### Scenario: 解绑后移除连线

**前提** 某个目标标签当前存在绑定关系与有向线
**当** 用户执行解绑
**那么** 对应连线必须同步移除
**并且** 其他无关关系与连线不得受影响

### Requirement: Build Flow Assignments Cleanup

#### Scenario: 来源产线被删除时清理 assignments

**前提** 某个 assignment 的 `sourceGroupId` 对应的产线已从 groups 中删除
**当** 系统执行失效清理
**那么** 该 assignment 必须被删除
**并且** 对应连线必须同步移除

#### Scenario: 来源产线不再入选时清理 assignments

**前提** 某个 assignment 的 `sourceGroupId` 对应的产线主要产品不再命中全局“需求原材料”
**当** 系统执行失效清理
**那么** 该 assignment 必须被删除
**并且** 对应连线必须同步移除

#### Scenario: 来源标签失效时清理 assignments

**前提** 某个 assignment 的来源产线“产线原材料”中不再包含该 `wareId`
**当** 系统执行失效清理
**那么** 该 assignment 必须被删除
**并且** 对应连线必须同步移除

#### Scenario: 目标产线不存在时清理 assignments

**前提** 某个 `targetType === 'line-build-material'` 的 assignment 的 `targetGroupId` 在 groups 中不存在
**当** 系统执行失效清理
**那么** 该 assignment 必须被删除
**并且** 对应连线必须同步移除

#### Scenario: 目标产线不再入选时清理 assignments

**前提** 某个 `targetType === 'line-build-material'` 的 assignment 的 `targetGroupId` 对应的产线不再属于建筑产线区
**当** 系统执行失效清理
**那么** 该 assignment 必须被删除
**并且** 对应连线必须同步移除

#### Scenario: 目标标签失效时清理 assignments

**前提** 某个 assignment 的目标标签不再存在
**当** 系统执行失效清理
**那么** 若 `targetType === 'line-build-material'` 且目标产线的产线建材中不再包含该 `wareId`，该 assignment 必须被删除
**并且** 若 `targetType === 'output-material'` 且产出区的现产原材料中不再包含该 `wareId`，该 assignment 必须被删除
**并且** 被删除 assignment 的对应连线必须同步移除

#### Scenario: 清理时机

**前提** groups 运行时数据发生变更导致派生视图重新计算
**当** 派生视图计算完成
**那么** 系统必须立即执行一轮失效清理
**并且** 清理后的 assignments 写回当前方案
**并且** 清理不得影响未被波及的 assignments

### Requirement: Build Flow Persistence And Migration

#### Scenario: 保存方案时写入建筑流关系

**前提** 当前方案存在非空的建筑流 assignments
**当** 用户保存或另存为方案
**那么** assignments 必须写入 `LogicFlowPlan.buildFlow`
**并且** 空 assignments 时 `buildFlow` 字段不得写入（存储 `undefined`）

#### Scenario: 加载方案时恢复建筑流关系

**前提** 用户加载一个已保存的 `LogicFlowPlan`
**当** 该 plan 包含 `buildFlow.assignments`
**那么** 系统必须将 assignments 恢复到运行时状态
**并且** 加载后必须立即执行一轮失效清理

#### Scenario: 旧版方案无 buildFlow 字段

**前提** 用户加载一个不含 `buildFlow` 字段的旧版 `LogicFlowPlan`
**当** 系统读取该 plan
**那么** 运行时 assignments 必须初始化为空数组
**并且** 不得因缺少 `buildFlow` 字段而报错

#### Scenario: 另存为时复制建筑流关系

**前提** 当前方案存在建筑流 assignments
**当** 用户执行“另存为”
**那么** `buildFlow` 必须随 `LogicFlowPlan` 一起复制到新方案
**并且** 新方案的 assignments 与原方案独立，互不影响
