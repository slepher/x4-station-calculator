# build-plan-fleet 设计

## 目标

为 build-plan 约束面板引入 Fleet goal，允许用户基于已保存的飞船蓝图配方设定持续造船目标，按船厂建造能力分组，将材料需求按有效建造时间展开为 production-rate 进入现有 preview/compute 管线。

## 领域术语

| 术语 | 含义 |
|------|------|
| Fleet goal | buildGoals 中 type=fleet 的目标，包含多个蓝图条目、共用建造时间和船厂配置 |
| FleetEntry | Fleet goal 中的单条蓝图配方引用 |
| buildTime | 用户设定的 Fleet 建造时间（秒），最小 600s，默认 3600s |
| shipyardCount | 各类型船厂数量（shipyardLCount / shipyardXLCount / wharfCount），默认 1，最小 1 |
| 船厂分组 | 按 ship.class 将 entries 分为大型船厂(ship_l)、超大型船厂(ship_xl)、船坞(ship_m+ship_s) |
| 组总建造时间 | ceil(单艘buildTime x quantity 之和 / shipyardCount)，同类型船厂并行 |
| 实际总花费 | max(所有组总建造时间)，即瓶颈组的建造时间 |
| effectiveBuildTime | max(实际总花费, 设定buildTime)，用于派生 rate 计算 |
| 派生 rate | Math.ceil(同 wareId 总需求 / effectiveBuildTime x 3600)，作为 target-production 进入 preview |
| resolveBlueprintMaterialCost | 从蓝图解析完整材料需求的纯函数，同时携带建造时间 |

## 问题

当前 build-plan 系统只支持 production-rate 和 build-module 两类目标。用户无法表达持续造船的规划需求。现有 fleet BuildGoal 类型已声明但完全未实现，且结构与实际需求不符。

此外，不同级别的飞船需要不同船厂（L 型需大型船厂，XL 型需超大型船厂，M/S 型需船坞），多种船厂可并行建造，用户需要控制船厂数量来影响实际建造速率和产能需求。

## 方案

### 1. 总体数据流

用户搜索 fleet -> FleetGoalSearchBox -> addFleetEntry(shipId, blueprintId) -> useBuildPlanStore.buildGoals -> syncGoalsToActivePlan -> watcher -> computeBuildFlowPlanPreview() -> expandFleetGoals() 解析蓝图材料和建造时间 -> 计算各船厂分组总建造时间 -> effectiveBuildTime -> 展开为 production-rate 子目标 -> createBuildFlowPlanPreview() -> previewResult 更新 -> presenter 映射 FleetGoalView（含分组、建造时间） -> FleetGoalCard 渲染

### 2. 数据模型

#### 2.1 BuildGoal 扩展

替换旧 fleet 分支，新增 shipyardCount 字段：

FleetEntry = { shipId, blueprintId, quantity }
BuildGoal fleet 分支 = { type: 'fleet'; buildTime; entries: FleetEntry[]; shipyardLCount; shipyardXLCount; wharfCount }
三个 count 字段默认 1，最小 1。

#### 2.2 Presenter 视图对象

FleetShipyardGroup = { type: 'shipyard_l'|'shipyard_xl'|'wharf'; label; shipyardCount; entries: FleetEntryView[]; groupTotalBuildTime }

FleetGoalView = { buildTime; shipyardLCount; shipyardXLCount; wharfCount; groups: FleetShipyardGroup[]; actualTotalBuildTime; effectiveBuildTime; mergedRates: FleetMergedRate[] }

FleetEntryView = { shipId; shipName; blueprintId; blueprintName; quantity; buildTime(单艘); totalBuildTime(buildTime x quantity); materials; isBlueprintMissing }

FleetMergedRate = { wareId; wareName; totalQty; ratePerHour }

### 3. 蓝图材料解析与建造时间

#### 3.1 resolveBlueprintMaterialCost

需要扩展返回值：从 Record<string, number> 改为 { materials: Record<string, number>; buildTime: number }。

buildTime 来源：ship.production.find(p => p.method === blueprint.materialMethod)?.time || 0

#### 3.2 Fleet entry 材料和建造时间计算

正常：resolveBlueprintMaterialCost -> materials x quantity, buildTime, totalBuildTime = buildTime x quantity
蓝图缺失：材料按 0，buildTime = 0，isBlueprintMissing = true

#### 3.3 船厂分组与有效建造时间

按 ship.class 分组：ship_l -> shipyard_l, ship_xl -> shipyard_xl, ship_m+ship_s -> wharf

每组总建造时间 = ceil(sum(buildTime x quantity) / shipyardCount)
actualTotalBuildTime = max(各组 groupTotalBuildTime)
effectiveBuildTime = max(actualTotalBuildTime, buildTime)

#### 3.4 Rate 合并

基于 effectiveBuildTime 计算 rate = Math.ceil(totalQty / effectiveBuildTime x 3600)
FleetMergedRate 新增 totalQty 字段
按 ware tier 降序

### 4. Fleet 与 preview/compute 管线

expandFleetGoals() 中 resolveFleetMergedRates() 使用 effectiveBuildTime 替代 buildTime。其余管线逻辑不变。

### 5. Store 专用方法

新增 updateFleetShipyardCount(groupType, count) - 更新对应船厂 count，最小 1，触发 preview 重算。
addFleetEntry 创建 fleet 时初始化 shipyardLCount: 1, shipyardXLCount: 1, wharfCount: 1。

### 6. 组件架构

FleetGoalCard 标题栏新增显示 actualTotalBuildTime / effectiveBuildTime。
三个船厂分组区：每组标题含船厂类型 + 可编辑 shipyardCount。
Blueprint 条目收起时显示总建造时间，展开时额外显示单艘建造时间 + 材料明细。
Rate 汇总区品种格式：wareName x totalQty，右侧 ratePerHour。

### 7. Presenter 变更

fleetGoalView 增加分组逻辑：按 ship.class 分组、计算 groupTotalBuildTime、actualTotalBuildTime、effectiveBuildTime。
FleetEntryView 新增 buildTime、totalBuildTime。
FleetMergedRate 新增 totalQty。

### 8. 涉及文件

- src/types/build-plan.ts - 扩展 FleetGoalView/FleetEntryView/FleetMergedRate，新增 FleetShipyardGroup，fleet BuildGoal 新增船厂计数字段
- src/store/logic/resolveBlueprintMaterialCost.ts - 返回值扩展为 { materials, buildTime }
- src/store/logic/buildPlanProductionLine.ts - expandFleetGoals 使用 effectiveBuildTime
- src/store/useBuildPlanStore.ts - 新增 updateFleetShipyardCount，创建 fleet 时初始化船厂计数字段
- src/components/empire/FleetGoalSearchBox.vue - 已存在，无需修改
- src/components/empire/FleetGoalCard.vue - 船厂分组布局、建造时间显示、ware x totalQty 格式
- src/components/empire/BuildPlanConstraintsPanel.vue - 新增 shipyardCount 相关 emit
- src/components/empire/presenters/useBuildPlanPresenter.ts - fleetGoalView 增加分组、建造时间、effectiveBuildTime
- src/locales/{en,zh-CN}.json - 新增船厂分组标题 i18n key

## 实现约束

1. Fleet 派生 rate 使用 Math.ceil 取整
2. buildTime 最小 600s，默认 3600s
3. shipyardCount 最小 1，默认 1
4. 蓝图被删除时 entry 显示 warning，材料和建造时间按 0 计算
5. 始终只有一个 Fleet goal
6. Fleet 卡片始终在 Goals 区顶部
7. 有效建造时间 = max(实际总花费, 设定buildTime)
8. 组总建造时间 = ceil(Σ(buildTime x quantity) / shipyardCount)

## 实现记录

### Bug 修复：X4NumberInput 最小值的即时验证问题
- 问题：X4NumberInput.handleInput 在输入过程中即时 clamp 到 props.min，导致 min=1 时无法输入10
- 修复：输入时只 emit raw value，blur 时 clamp 到最小值；使用 rawValue ref 保留输入过程中的字符串

### Bug 修复：useShipBuildStore 蓝图未加载导致 fleet 展开为空
- 问题：resolveFleetMergedRates() 调用时 blueprints 未从 localStorage 加载
- 修复：useShipBuildStore setup 中自动调用 loadBlueprintsFromStorage() + resolveFleetMergedRates() 防御性二次加载

### 设计变更：FleetGoalSearchBox 集成方式
- 原设计：BuildPlanConstraintsPanel 中独立控制切换 FleetGoalSearchBox
- 实际实现：在 BuildGoalSearchBox 的类别下拉菜单中新增 fleet 选项，选中时内部渲染 FleetGoalSearchBox，避免面板层布局变化
