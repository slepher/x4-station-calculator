# build-plan-fleet 需求

## 目标

在 build-plan 约束面板中引入 Fleet goal，允许用户基于已保存的飞船蓝图配方设定持续造船目标。Fleet goal 将蓝图材料需求按建造时间展开为 production-rate 目标，进入现有 preview/compute 管线生成建造方案。

## 已确认方案（审核重点）

### Fleet Goal 数据模型

- 替换现有 `{ type: 'fleet'; shipId: string; quantity: number }` 为新结构：
  ```ts
  FleetEntry = { shipId: string; blueprintId: string; quantity: number }
  BuildGoal 新增: | { type: 'fleet'; buildTime: number; entries: FleetEntry[] }
  ```
- 旧 fleet 类型从未实现，无持久化数据，直接替换无需迁移
- 始终只有一个 Fleet goal（单卡片）
- `buildTime` 默认 3600s，最小 600s，单位秒，整数输入
- blueprintId 引用 `useShipBuildStore.savedBlueprints` 中已保存的蓝图（不含 built-in preset）

### Fleet 卡片 UI

- Fleet 标题栏：固定文案 "Fleet"，右侧可编辑 buildTime（如 `⏱ 7200s`）
- Fleet 标题栏不是展开/收起控件，始终可见
- Blueprint 条目：默认收起，显示 `▸ 舰船名 / 蓝图名 × quantity [× 删除]`
- 点击条目展开显示材料明细：按 wareId 合并显示总量，如 `Computronics Substrate 84`
- Rate 汇总区：始终可见，在所有条目下方，标题 "rate (merged)"
  - `rate = Math.ceil(所有 entry 的同 wareId 总量之和 / buildTime × 3600)`
  - 按 ware tier 从高到低排序
  - 标记 `⌐target⌐` + 锁图标，不可编辑不可删除
  - energycells 正常显示和参与规划

### Fleet 搜索

- 搜索框类别下拉新增 `fleet`，位于 `product | module | fleet` 末尾
- 新建独立 `FleetGoalSearchBox` 组件，右侧弹出搜索结果（与 product/module 搜索一致）
- 搜索行为：根据 i18n 搜索舰船型号
- 搜索结果分组：group = 舰船型号（按 class 排序：ship_s → ship_m → ship_l → ship_xl，同 class 内按名称），item = 已保存蓝图
- 无已保存蓝图的舰船不显示
- 空状态提示："No saved blueprints. Save a blueprint in Ship Build first."
- 搜索输入为空时显示全部有蓝图的舰船

### Fleet 添加/删除行为

- 点击搜索结果 item → `addFleetEntry(shipId, blueprintId)`
- Fleet goal 不存在时自动创建（buildTime 默认 3600）
- 已存在时追加到 entries
- 删除 entry：`removeFleetEntry(blueprintId)`
- 删除最后一个 entry → store 自动移除整个 Fleet goal，卡片消失
- Fleet 卡片始终在 Goals 区顶部，不受添加顺序影响

### Fleet entry 编辑

- quantity 可编辑（行内数字输入框 + 步进，与 WarePlanningItem 一致）
- buildTime 编辑后立即触发 preview 重算

### 蓝图材料解析

- 新增纯函数 `resolveBlueprintMaterialCost(blueprint, ship, equipmentMap, consumablesMap, dronesMap, missilesMap)` → `Record<string, number>`
- 逻辑：按 blueprint.materialMethod 分别从 ship.production、equipment.cost、storage 物品 cost 取材料，合并
- 放置在 `src/store/logic/resolveBlueprintMaterialCost.ts`

### Fleet 与 preview/compute 管线

- Fleet 派生 rate 作为 `target-production` 责任进入 `createBuildFlowPlanPreview()`
- 与用户手动添加的同 wareId production-rate 各自独立，compute 求解时按现有规则合并速率
- energycells rate 正常参与 preview/compute，现有管线的 energycells 排除逻辑自然生效

### 蓝图被删除的降级

- Fleet entry 对应的蓝图被删除 → 该 entry 显示 warning 状态（红色标记），材料需求按 0 计算，rate 不包含该 entry
- 不自动降级到 default cost，不自动移除

### Presenter 映射

- Presenter 预解析 Fleet goal，暴露完整视图对象：
  ```ts
  FleetGoalView = {
    buildTime: number
    entries: FleetEntryView[]
    mergedRates: { wareId: string; wareName: string; ratePerHour: number }[]
  }
  FleetEntryView = {
    shipId: string; shipName: string
    blueprintId: string; blueprintName: string
    quantity: number
    materials: { wareId: string; wareName: string; totalQty: number }[]
    isBlueprintMissing: boolean
  }
  ```
- FleetGoalCard 只负责渲染，零查询

### Store 专用方法

- `addFleetEntry(shipId, blueprintId)` — 自动创建/追加
- `removeFleetEntry(blueprintId)` — 自动清理空 Fleet
- `updateFleetBuildTime(seconds)`
- `updateFleetEntryQuantity(blueprintId, qty)`
- 变更后自动触发 preview 重算

### 组件架构

- 新建 `FleetGoalCard` 组件 — 包含标题栏、条目列表、rate 汇总
- 新建 `FleetGoalSearchBox` 组件 — 独立搜索框
- Blueprint 条目展开/收起状态为组件内部 `ref<Record<string, boolean>>`，不持久化

### i18n

- 前缀：`build_plan.fleet_*`
- 舰船名称使用 i18n nameId 翻译（与 ship-build 一致）

## 边界

### In Scope

- Fleet goal 数据模型定义
- FleetGoalCard 组件（标题栏、条目列表、rate 汇总）
- FleetGoalSearchBox 组件（fleet 类别搜索）
- resolveBlueprintMaterialCost 纯函数
- Fleet 专用 store 方法
- Fleet 派生 rate 进入 preview/compute 管线
- Presenter Fleet 视图对象映射
- i18n key

### Out of Scope

- 多 Fleet 卡片
- built-in preset 蓝图作为 fleet entry
- 蓝图被删除的自动修复（自动降级/自动移除）
- Fleet goal 的导入/导出（跨游戏版本）
- 编写测试代码
- 运行测试

## 验收标准（DoD）

1. 用户可在搜索框选择 fleet 类别，搜索并添加已保存蓝图到 Fleet goal
2. Fleet 卡片在 Goals 区顶部显示，含可编辑 buildTime
3. Blueprint 条目默认收起，展开显示材料明细（按 wareId 合并显示总量）
4. Rate 汇总区始终可见，rate = Math.ceil(总需求 / buildTime × 3600)，不可编辑
5. Fleet 派生 rate 作为 target-production 进入 preview，产线分配结果在 preview 区展示
6. 蓝图被删除时 entry 显示 warning，材料按 0 计算
7. 删除最后一个 entry 后 Fleet 卡片自动消失
8. energycells rate 正常显示和参与规划
9. Fleet goal 变更（添加/删除/修改 quantity/修改 buildTime）后自动触发 preview 重算
10. 搜索结果不显示无已保存蓝图的舰船

## 未决项

无
