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
用户搜索 fleet → FleetGoalSearchBox（集成在 BuildGoalSearchBox 的下拉菜单中）
  → addFleetEntry(shipId, blueprintId)
  → useBuildPlanStore.buildGoals 新增/追加 fleet goal
  → syncGoalsToActivePlan → watcher 触发 preview 重算
  → computeBuildFlowPlanPreview()
    → expandFleetGoals() 解析蓝图材料
    → 展开为 production-rate 子目标
    → 合并到 buildGoal 数组后调用 createBuildFlowPlanPreview()
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

不在 `createBuildFlowPlanPreview()` 内部处理，而是在调用前的 `expandFleetGoals()` 中展开：

```ts
// useBuildPlanStore.ts
function expandFleetGoals(goals: BuildGoal[]): BuildGoal[] {
  const expanded: BuildGoal[] = []
  for (const goal of goals) {
    if (goal.type === 'fleet') {
      const rates = resolveFleetMergedRates(goal)
      for (const rate of rates) {
        expanded.push({
          type: 'production-rate',
          wareId: rate.wareId,
          ratePerHour: rate.ratePerHour,
        })
      }
    } else {
      expanded.push(goal)
    }
  }
  return expanded
}
```

`expandFleetGoals()` 在 `computeBuildFlowPlanPreview()` 和 `computePlan()` 中均被调用，确保预览和计算阶段都使用展开后的目标。

#### 4.2 与现有目标的共存

- Fleet 派生的 `production-rate` 与用户手动添加的同 wareId `production-rate` 各自独立
- Preview 中产生两条 `target-production` 责任，compute 求解时按现有规则合并速率
- energycells rate 正常参与，现有管线的 energycells 排除逻辑自然生效

#### 4.3 蓝图数据获取

`resolveFleetMergedRates()` 内嵌在 `useBuildPlanStore` 中，直接从 `useShipBuildStore()` 读取蓝图和装备数据：

```ts
function resolveFleetMergedRates(fleetGoal) {
  const shipBuildStore = useShipBuildStore()
  shipBuildStore.loadBlueprintsFromStorage()  // 防御性加载
  // ... 遍历 entries 调用 resolveBlueprintMaterialCost
}
```

注意：`useShipBuildStore` 初始化时 blueprints 可能未加载，需要在 `resolveFleetMergedRates()` 中防御性调用 `loadBlueprintsFromStorage()`。同时 `useShipBuildStore` 的 setup 中已添加自动调用 `loadBlueprintsFromStorage()`。

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
- 不单独暴露下拉菜单，而是集成在 `BuildGoalSearchBox` 的类别 `<select>` 中新增 `fleet` 选项
- 选中 fleet 时 `BuildGoalSearchBox` 内部渲染 `FleetGoalSearchBox`，emit `addFleetEntry`
- 右侧弹出搜索结果
- 搜索逻辑：从 shipBuildStore 获取所有有已保存蓝图的舰船（排除 built-in preset），按 i18n 名称搜索
- 结果分组：按舰船 class 排序（s/m/l/xl），同 class 内按名称排序，item 为已保存蓝图
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

## 实现记录

### Bug 修复：X4NumberInput 最小值的即时验证问题
- **问题**：`X4NumberInput.handleInput` 在输入过程中即时 clamp 到 `props.min`，导致 min=1 时无法输入"10"（输入"0"即被 clamp 为 1）
- **修复**：输入时只 emit raw value，blur 时 clamp 到最小值；使用 `rawValue` ref 保留输入过程中的字符串

### Bug 修复：useShipBuildStore 蓝图未加载导致 fleet 展开为空
- **问题**：`resolveFleetMergedRates()` 调用 `useShipBuildStore().findBlueprintById()` 时 blueprints 未从 localStorage 加载（`loadBlueprintsFromStorage()` 只在 `initialize()` 中调用），返回空数组，导致 fleet 展开为 0 个 production-rate 目标
- **修复**：
  1. `useShipBuildStore` setup 中自动调用 `loadBlueprintsFromStorage()`
  2. `resolveFleetMergedRates()` 中防御性调用 `shipBuildStore.loadBlueprintsFromStorage()`

### 设计变更：FleetGoalSearchBox 集成方式
- **原设计**：`BuildPlanConstraintsPanel` 中独立控制切换 FleetGoalSearchBox
- **实际实现**：在 `BuildGoalSearchBox` 的类别下拉菜单中新增 `fleet` 选项，选中时内部渲染 FleetGoalSearchBox，避免面板层布局变化
