# build-plan-fleet 设计

## 目标

为 build-plan 约束面板引入 Fleet goal，允许用户基于已保存的飞船蓝图配方设定持续造船目标，将材料需求展开为 production-rate 进入现有 preview/compute 管线。

## 领域术语

| 术语 | 含义 |
|------|------|
| Fleet goal | buildGoals 中 type=fleet 的目标，包含多个蓝图条目和共用建造时间 |
| FleetEntry | Fleet goal 中的单条蓝图配方引用 |
| buildTime | 整个 Fleet 的总建造时间（秒），用于计算派生 rate |
| 派生 rate | `Math.ceil(同 wareId 总需求 / buildTime × 3600)`，作为 target-production 进入 preview |
| resolveBlueprintMaterialCost | 从蓝图解析完整材料需求的纯函数 |

## 问题

当前 build-plan 系统只支持 `production-rate`（目标产量）和 `build-module`（目标建筑）两类目标。用户无法表达"持续造船"的规划需求——飞船建造需要多种材料按特定比例供给，手动添加多个 production-rate 既繁琐又无法保证比例正确。

现有 `fleet` BuildGoal 类型已声明但完全未实现，且结构与实际需求不符（旧结构为单个 shipId+quantity，新需求为多蓝图条目+共用建造时间）。

## 方案

### 1. 总体数据流

```
用户搜索 fleet → FleetGoalSearchBox
  → addFleetEntry(shipId, blueprintId)
  → useBuildPlanStore.buildGoals 新增/追加 fleet goal
  → watcher 触发 preview 重算
  → createBuildFlowPlanPreview()
    → 解析 fleet goal 的蓝图材料
    → 展开为 production-rate 子目标
    → 合并到 preview 责任分配
  → previewResult 更新
  → presenter 映射 FleetGoalView
  → FleetGoalCard 渲染
```

### 2. 数据模型

#### 2.1 BuildGoal 扩展

替换旧 fleet 分支：

```ts
// 删除
| { type: 'fleet'; shipId: string; quantity: number }

// 新增
interface FleetEntry {
  shipId: string
  blueprintId: string
  quantity: number
}

| { type: 'fleet'; buildTime: number; entries: FleetEntry[] }
```

#### 2.2 Presenter 视图对象

```ts
interface FleetGoalView {
  buildTime: number
  entries: FleetEntryView[]
  mergedRates: FleetMergedRate[]
}

interface FleetEntryView {
  shipId: string
  shipName: string
  blueprintId: string
  blueprintName: string
  quantity: number
  materials: FleetMaterialItem[]
  isBlueprintMissing: boolean
}

interface FleetMaterialItem {
  wareId: string
  wareName: string
  totalQty: number
}

interface FleetMergedRate {
  wareId: string
  wareName: string
  ratePerHour: number
}
```

### 3. 蓝图材料解析

#### 3.1 resolveBlueprintMaterialCost

放置在 `src/store/logic/resolveBlueprintMaterialCost.ts`，纯函数：

```ts
function resolveBlueprintMaterialCost(
  blueprint: ShipBlueprint,
  ship: X4Ship,
  equipmentMap: Map<string, X4Equipment>,
  consumablesMap: Map<string, X4Consumable>,
  dronesMap: Map<string, X4Drone>,
  missilesMap: Map<string, X4Missile>,
): Record<string, number>
```

解析逻辑：
1. 船体：`ship.production.find(p => p.method === blueprint.materialMethod)?.cost || {}`
2. 装备：遍历 `blueprint.connections[].group[]`，`equipment.cost[method] × count`
3. 护盾：`group.shield` 同上
4. Storage：consumables / drones / missiles 各自 `cost[method] × count`
5. 合并：`result[wareId] += qty`

#### 3.2 Fleet entry 材料计算

对每个 entry：
- 正常：`resolveBlueprintMaterialCost(blueprint, ship, ...) × quantity`
- 蓝图缺失：材料按 0 计算，`isBlueprintMissing = true`

#### 3.3 Rate 合并

```ts
// 按 wareId 汇总所有 entry 的材料
const totalByWare: Record<string, number> = {}
for (const entry of entries) {
  for (const [wareId, qty] of Object.entries(entry.materials)) {
    totalByWare[wareId] = (totalByWare[wareId] || 0) + qty
  }
}

// 计算 rate
const mergedRates = Object.entries(totalByWare)
  .map(([wareId, totalQty]) => ({
    wareId,
    wareName: translateWare(wareId),
    ratePerHour: Math.ceil(totalQty / buildTime * 3600)
  }))
  .sort((a, b) => getWareTier(b.wareId) - getWareTier(a.wareId))
```

### 4. Fleet 与 preview/compute 管线

#### 4.1 Fleet 展开为 production-rate

在 `createBuildFlowPlanPreview()` 入口处，对 fleet goal 展开为多个 `production-rate` 子目标：

```ts
if (goal.type === 'fleet') {
  for (const rate of resolveFleetMergedRates(goal)) {
    expandedGoals.push({
      type: 'production-rate',
      wareId: rate.wareId,
      ratePerHour: rate.ratePerHour
    })
  }
}
```

#### 4.2 与现有目标的共存

- Fleet 派生的 `production-rate` 与用户手动添加的同 wareId `production-rate` 各自独立
- Preview 中产生两条 `target-production` 责任，compute 求解时按现有规则合并速率
- energycells rate 正常参与，现有管线的 energycells 排除逻辑自然生效

#### 4.3 蓝图数据获取

`createBuildFlowPlanPreview()` 是纯函数，需要从外部注入蓝图解析结果：

- 方案：在 `createBuildFlowPlanPreview()` 的调用处（`useBuildPlanStore` 的 watcher 中），从 `useShipBuildStore` 查询蓝图并解析材料，将解析结果作为额外参数传入
- preview 入口保留原始 fleet goal 结构，内部处理展开

### 5. Store 专用方法

```ts
// useBuildPlanStore 新增
addFleetEntry(shipId: string, blueprintId: string)
  // 1. 查找 buildGoals 中的 fleet goal
  // 2. 不存在 → 创建 { type: 'fleet', buildTime: 3600, entries: [{ shipId, blueprintId, quantity: 1 }] }
  // 3. 已存在 → 追加 { shipId, blueprintId, quantity: 1 }（若 blueprintId 已存在则 quantity++）
  // 4. 触发 preview 重算

removeFleetEntry(blueprintId: string)
  // 1. 从 fleet goal 的 entries 中移除该 blueprintId
  // 2. entries 为空 → 从 buildGoals 中移除 fleet goal
  // 3. 触发 preview 重算

updateFleetBuildTime(seconds: number)
  // 1. 更新 fleet goal.buildTime = Math.max(600, seconds)
  // 2. 触发 preview 重算

updateFleetEntryQuantity(blueprintId: string, qty: number)
  // 1. 更新对应 entry 的 quantity
  // 2. 触发 preview 重算
```

### 6. 组件架构

#### 6.1 FleetGoalSearchBox

独立组件，位于 `src/components/empire/FleetGoalSearchBox.vue`：
- 类别下拉显示 fleet 时渲染
- 右侧弹出搜索结果
- 搜索逻辑：从 shipBuildStore 获取所有有已保存蓝图的舰船，按 i18n 名称搜索
- 结果分组：按舰船 class 排序，同 class 内按名称排序，item 为已保存蓝图
- 点击 item → emit `addFleetEntry(shipId, blueprintId)`

#### 6.2 FleetGoalCard

独立组件，位于 `src/components/empire/FleetGoalCard.vue`：
- Props: `fleetView: FleetGoalView`
- 标题栏：固定文案 "Fleet" + 可编辑 buildTime
- 条目列表：v-for entries，默认收起，点击展开材料明细
- Rate 汇总区：始终可见，v-for mergedRates
- 展开状态：组件内部 `ref<Record<string, boolean>>`

#### 6.3 约束面板集成

`BuildPlanConstraintsPanel.vue` 修改：
- 搜索框类别新增 fleet
- 当类别为 fleet 时渲染 `FleetGoalSearchBox`，否则渲染 `BuildGoalSearchBox`
- Goals 区顶部渲染 `FleetGoalCard`（fleet goal 存在时）
- editableGoals 过滤排除 fleet type

### 7. Presenter 变更

`useBuildPlanPresenter.ts` 新增：
- `fleetGoalView: ComputedRef<FleetGoalView | null>` — 从 buildPlanStore.buildGoals 中提取 fleet goal，组合 shipBuildStore 解析完整视图
- 解析逻辑：遍历 entries，从 shipBuildStore 查询蓝图和舰船，调用 resolveBlueprintMaterialCost 计算材料，合并 rate

### 8. 涉及文件

| 文件 | 变更类型 |
|------|---------|
| `src/types/build-plan.ts` | 修改：替换旧 fleet BuildGoal，新增 FleetEntry |
| `src/store/logic/resolveBlueprintMaterialCost.ts` | 新增 |
| `src/store/logic/buildPlanProductionLine.ts` | 修改：createBuildFlowPlanPreview 中展开 fleet goal |
| `src/store/useBuildPlanStore.ts` | 修改：新增 Fleet 专用方法，watcher 注入蓝图数据 |
| `src/components/empire/FleetGoalSearchBox.vue` | 新增 |
| `src/components/empire/FleetGoalCard.vue` | 新增 |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 修改：集成 Fleet 搜索和卡片 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | 修改：新增 fleetGoalView |
| `src/locales/{en,zh-CN}.json` | 修改：新增 build_plan.fleet_* i18n key |

## 实现约束

1. Fleet 派生 rate 使用 `Math.ceil` 取整
2. buildTime 最小 600s，默认 3600s
3. 蓝图被删除时 entry 显示 warning，材料按 0 计算
4. 始终只有一个 Fleet goal
5. Fleet 卡片始终在 Goals 区顶部
