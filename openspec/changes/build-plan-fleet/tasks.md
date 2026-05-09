# build-plan-fleet 任务

## Phase 1: 数据模型与纯函数

- [x] T1: 在 `src/types/build-plan.ts` 中替换旧 fleet BuildGoal 为新结构，新增 FleetEntry 接口
- [x] T2: 新增 `src/store/logic/resolveBlueprintMaterialCost.ts`，实现蓝图材料解析纯函数

## Phase 2: Store 方法

- [x] T3: 在 `src/store/useBuildPlanStore.ts` 中新增 `addFleetEntry(shipId, blueprintId)`
- [x] T4: 新增 `removeFleetEntry(blueprintId)`，entries 为空时自动移除 Fleet goal
- [x] T5: 新增 `updateFleetBuildTime(seconds)`，最小值 600
- [x] T6: 新增 `updateFleetEntryQuantity(blueprintId, qty)`
- [x] T7: 确保所有 Fleet 方法变更后触发 preview 重算
- [x] T8: 在 `createBuildFlowPlanPreview()` 入口处展开 fleet goal 为 production-rate 子目标

## Phase 3: Presenter 映射

- [x] T9: 在 `src/components/empire/presenters/useBuildPlanPresenter.ts` 中新增 `fleetGoalView` computed
- [x] T10: fleetGoalView 从 shipBuildStore 查询蓝图和舰船数据，调用 resolveBlueprintMaterialCost
- [x] T11: 处理蓝图缺失场景（isBlueprintMissing、材料按 0 计算）

## Phase 4: 搜索组件

- [x] T12: 新增 `src/components/empire/FleetGoalSearchBox.vue`
- [x] T13: 搜索逻辑：从 shipBuildStore 获取有已保存蓝图的舰船，按 i18n 搜索
- [x] T14: 搜索结果分组：按 class 排序，同 class 内按名称排序，item 为已保存蓝图（不含 preset）
- [x] T15: 空状态提示
- [x] T16: 点击 item emit addFleetEntry

## Phase 5: Fleet 卡片组件

- [x] T17: 新增 `src/components/empire/FleetGoalCard.vue`
- [x] T18: 标题栏：固定 "Fleet" 文案 + 可编辑 buildTime
- [x] T19: 条目列表：默认收起，点击展开显示材料明细
- [x] T20: Rate 汇总区：始终可见，按 ware tier 降序，不可编辑
- [x] T21: 蓝图缺失 warning 标记
- [x] T22: 展开/收起状态组件内部管理

## Phase 6: 约束面板集成

- [x] T23: `src/components/empire/BuildPlanConstraintsPanel.vue` 搜索框类别新增 fleet
- [x] T24: 选择 fleet 时渲染 FleetGoalSearchBox，否则渲染 BuildGoalSearchBox
- [x] T25: Goals 区顶部渲染 FleetGoalCard（fleet goal 存在时）
- [x] T26: editableGoals 过滤排除 fleet type

## Phase 7: i18n

- [x] T27: `src/locales/en.json` 新增 build_plan.fleet_* key
- [x] T28: `src/locales/zh-CN.json` 新增 build_plan.fleet_* key

## Phase 8: 构建验证

- [x] T29: 执行 `npm run build` 确认无编译错误

## 验证方案摘要

### Fleet 数据模型
- FleetEntry 包含 shipId、blueprintId、quantity
- buildTime 默认 3600，最小 600
- 始终只有一个 fleet goal

### 蓝图材料解析
- resolveBlueprintMaterialCost 按 blueprint.materialMethod 分别从 ship.production、equipment.cost、storage 物品 cost 取材料
- 合并为 Record<wareId, totalQty>
- 注意：wareId 使用游戏数据原始 ID（如 `advancedelectronics` 而非 `electronicmatrix`）

### 已知问题
- `useShipBuildStore` 的 `loadBlueprintsFromStorage()` 已在 store setup 中自动调用 + `resolveFleetMergedRates()` 防御性二次加载，避免 fleet 展开时蓝图为空

### Rate 计算
- rate = Math.ceil(所有 entry 同 wareId 总量之和 / buildTime × 3600)
- 按 ware tier 降序
- energycells 正常参与

### Fleet 与 preview
- Fleet 派生 rate 展开为 production-rate 子目标
- 作为 target-production 责任进入 preview
- 与手动 production-rate 各自独立，compute 合并速率

### 蓝图降级
- 蓝图缺失 → isBlueprintMissing = true，材料按 0
- 不自动降级，不自动移除
