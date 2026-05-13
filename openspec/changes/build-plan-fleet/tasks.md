# build-plan-fleet 任务

## Phase 1: 数据模型与纯函数

- [x] T1: 在 src/types/build-plan.ts 中替换旧 fleet BuildGoal 为新结构，新增 FleetEntry 接口
- [x] T1b: 扩展 fleet BuildGoal 新增 shipyardLCount / shipyardXLCount / wharfCount 字段（默认 1）
- [x] T1c: 新增 FleetShipyardGroup 接口，扩展 FleetGoalView（groups / actualTotalBuildTime / effectiveBuildTime / shipyardCount 字段）
- [x] T1d: 扩展 FleetEntryView 新增 buildTime / totalBuildTime 字段
- [x] T1e: 扩展 FleetMergedRate 新增 totalQty 字段
- [x] T2: 新增 src/store/logic/resolveBlueprintMaterialCost.ts，实现蓝图材料解析纯函数
- [x] T2b: 扩展 resolveBlueprintMaterialCost 返回值为 { materials, buildTime }，buildTime 来自 production.time

## Phase 2: Store 方法

- [x] T3: 在 src/store/useBuildPlanStore.ts 中新增 addFleetEntry(shipId, blueprintId)
- [x] T3b: addFleetEntry 创建 fleet 时初始化 shipyardLCount: 1, shipyardXLCount: 1, wharfCount: 1
- [x] T4: 新增 removeFleetEntry(blueprintId)，entries 为空时自动移除 Fleet goal
- [x] T5: 新增 updateFleetBuildTime(seconds)，最小值 600
- [x] T6: 新增 updateFleetEntryQuantity(blueprintId, qty)
- [x] T7: 确保所有 Fleet 方法变更后触发 preview 重算
- [x] T7b: 新增 updateFleetShipyardCount(groupType, count)，最小值 1，触发 preview 重算
- [x] T8: 在 createBuildFlowPlanPreview() 入口处展开 fleet goal 为 production-rate 子目标
- [x] T8b: resolveFleetMergedRates 使用 effectiveBuildTime 替代 buildTime 计算 rate

## Phase 3: Presenter 映射

- [x] T9: 在 src/components/empire/presenters/useBuildPlanPresenter.ts 中新增 fleetGoalView computed
- [x] T10: fleetGoalView 从 shipBuildStore 查询蓝图和舰船数据，调用 resolveBlueprintMaterialCost
- [x] T11: 处理蓝图缺失场景（isBlueprintMissing、材料按 0 计算）
- [x] T11b: fleetGoalView 按 ship.class 分组为三个 FleetShipyardGroup
- [x] T11c: 计算各组的 groupTotalBuildTime = ceil(sum(buildTime x quantity) / shipyardCount)
- [x] T11d: 计算 actualTotalBuildTime = max(各组 groupTotalBuildTime) 和 effectiveBuildTime = max(actualTotalBuildTime, buildTime)
- [x] T11e: rate 计算使用 effectiveBuildTime，FleetMergedRate 包含 totalQty

## Phase 4: 搜索组件

- [x] T12: 新增 src/components/empire/FleetGoalSearchBox.vue
- [x] T13: 搜索逻辑：从 shipBuildStore 获取有已保存蓝图的舰船，按 i18n 搜索
- [x] T14: 搜索结果分组：按 class 排序，同 class 内按名称排序，item 为已保存蓝图（不含 preset）
- [x] T15: 空状态提示
- [x] T16: 点击 item emit addFleetEntry

## Phase 5: Fleet 卡片组件

- [x] T17: 新增 src/components/empire/FleetGoalCard.vue
- [x] T18: 标题栏：固定 "Fleet" 文案 + 可编辑 buildTime
- [x] T18b: 标题栏额外显示 actualTotalBuildTime 和 effectiveBuildTime
- [x] T19: 条目列表：默认收起，点击展开显示材料明细
- [x] T19b: 收起/展开状态都显示总建造时间
- [x] T19c: 展开时额外显示单艘建造时间
- [x] T20: Rate 汇总区：始终可见，按 ware tier 降序，不可编辑
- [x] T20b: Rate 品种格式改为 wareName x totalQty，右侧 ratePerHour
- [x] T20c: Rate 计算基于 effectiveBuildTime
- [x] T21: 蓝图缺失 warning 标记
- [x] T22: 展开/收起状态组件内部管理

## Phase 6: 船厂分组 UI

- [x] T23: FleetGoalCard 按 FleetShipyardGroup 分三组渲染，每组标题含船厂类型名称
- [x] T24: 每组标题栏可编辑 shipyardCount（X4NumberInput，最小 1）
- [x] T25: 空组（无 entries）仍显示标题和 shipyardCount
- [x] T26: emit updateFleetShipyardCount 传递 groupType 和 count

## Phase 7: 约束面板集成

- [x] T27: src/components/empire/BuildPlanConstraintsPanel.vue 搜索框类别新增 fleet
- [x] T28: 选择 fleet 时渲染 FleetGoalSearchBox，否则渲染 BuildGoalSearchBox
- [x] T29: Goals 区顶部渲染 FleetGoalCard（fleet goal 存在时）
- [x] T30: editableGoals 过滤排除 fleet type

## Phase 8: i18n

- [x] T31: src/locales/en.json 新增 build_plan.fleet_* key
- [x] T32: src/locales/zh-CN.json 新增 build_plan.fleet_* key
- [x] T33: 新增船厂分组标题 i18n key（大型船厂 / 超大型船厂 / 船坞）

## Phase 9: 构建验证

- [x] T34: 执行 npm run build 确认无编译错误
