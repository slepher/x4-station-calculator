# build-plan-fleet 需求

## 目标

在 build-plan 约束面板中引入 Fleet goal，允许用户基于已保存的飞船蓝图配方设定持续造船目标。Fleet goal 按船厂建造能力将飞船分组，将蓝图材料需求按有效建造时间展开为 production-rate 目标，进入现有 preview/compute 管线生成建造方案。

## 已确认方案（审核重点）

### Fleet Goal 数据模型

- 替换现有 `{ type: 'fleet'; shipId: string; quantity: number }` 为新结构：
  ```ts
  FleetEntry = { shipId: string; blueprintId: string; quantity: number }
  BuildGoal 新增: | { type: 'fleet'; buildTime: number; entries: FleetEntry[]; shipyardLCount: number; shipyardXLCount: number; wharfCount: number }
  ```
- 旧 fleet 类型从未实现，无持久化数据，直接替换无需迁移
- 始终只有一个 Fleet goal（单卡片）
- `buildTime` 默认 3600s，最小 600s，单位秒，整数输入
- `shipyardLCount` / `shipyardXLCount` / `wharfCount` 各默认 1，最小 1，整数输入
- blueprintId 引用 `useShipBuildStore.savedBlueprints` 中已保存的蓝图（不含 built-in preset）

### 船厂分组

- 飞船按 `ship.class` 分为三组，每组对应一种船厂：

| 分组标题 | 包含船级 | 存储字段 |
|---------|---------|---------|
| 大型船厂 (Shipyard L) | `ship_l` | `shipyardLCount` |
| 超大型船厂 (Shipyard XL) | `ship_xl` | `shipyardXLCount` |
| 船坞 (Wharf) | `ship_m` + `ship_s` | `wharfCount` |

- 每组标题显示船厂类型名称，右侧可编辑船厂数量
- 不同船厂可并行建造飞船，同类型船厂数量 N 表示可同时建造 N 艘同级别飞船
- 若某组无 entries，该组仍显示（船厂数量可编辑），但无条目

### Fleet 卡片 UI

- Fleet 标题栏：固定文案 "Fleet"，右侧可编辑 buildTime（如 `⏱ 7200s`）
- Fleet 标题栏不是展开/收起控件，始终可见
- Fleet 标题栏额外显示：实际建造总花费时间（各组最大值），以及有效建造时间（max(总花费, 设定buildTime)）
- 三组船厂分区显示，每组有独立标题栏（船厂类型 + 船厂数量输入）
- Blueprint 条目在各组内列出，默认收起，显示 `▸ 蓝图名 × quantity  总建造时间`
- 点击条目展开显示：单艘建造时间 + 材料明细（按 wareId 合并显示总量）
- 收起和展开状态都显示总建造时间
- Rate 汇总区：始终可见，在所有组下方，标题 "rate (merged)"
  - 品种列格式：`wareName × totalQty`（如 `Hull Parts × 4433`）
  - 右侧继续显示 ratePerHour
  - `effectiveBuildTime = max(各组最大总耗时, 设定buildTime)`
  - `rate = Math.ceil(所有 entry 的同 wareId 总量之和 / effectiveBuildTime × 3600)`
  - 按 ware tier 从高到低排序
  - 标记 `⌐target⌐` + 锁图标，不可编辑不可删除
  - energycells 正常显示和参与规划

### 建造时间计算

- 单艘建造时间：来自 `resolveBlueprintMaterialCost` 已携带的 `production.time`
- 每组总建造时间：`ceil(Σ(单艘buildTime × quantity) / shipyardCount)`
- 舰队实际总花费：`max(所有组总建造时间)`
- 有效建造时间（用于 rate 计算）：`max(实际总花费, 设定buildTime)`

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
- Fleet goal 不存在时自动创建（buildTime 默认 3600，三个 shipyardCount 默认 1）
- 已存在时追加到 entries
- 删除 entry：`removeFleetEntry(blueprintId)`
- 删除最后一个 entry → store 自动移除整个 Fleet goal，卡片消失
- Fleet 卡片始终在 Goals 区顶部，不受添加顺序影响

### Fleet entry 编辑

- quantity 可编辑（行内数字输入框 + 步进，与 WarePlanningItem 一致）
- buildTime 编辑后立即触发 preview 重算
- shipyardCount 编辑后立即触发 preview 重算

### 蓝图材料解析

- 新增纯函数 `resolveBlueprintMaterialCost(blueprint, ship, equipmentMap, consumablesMap, dronesMap, missilesMap)` → `Record<string, number>`
- 逻辑：按 blueprint.materialMethod 分别从 ship.production、equipment.cost、storage 物品 cost 取材料，合并
- 放置在 `src/store/logic/resolveBlueprintMaterialCost.ts`
- 该函数已携带建造时间（`production.time`），Presenter 可直接使用

### Fleet 与 preview/compute 管线

- Fleet 派生 rate 基于 effectiveBuildTime 计算后作为 `target-production` 责任进入 `createBuildFlowPlanPreview()`
- 与用户手动添加的同 wareId production-rate 各自独立，compute 求解时按现有规则合并速率
- energycells rate 正常参与 preview/compute，现有管线的 energycells 排除逻辑自然生效

### 蓝图被删除的降级

- Fleet entry 对应的蓝图被删除 → 该 entry 显示 warning 状态（红色标记），材料需求按 0 计算，建造时间按 0 计算，rate 不包含该 entry
- 不自动降级到 default cost，不自动移除

### Presenter 映射

- Presenter 预解析 Fleet goal，暴露完整视图对象：
  ```ts
  FleetShipyardGroup = {
    type: 'shipyard_l' | 'shipyard_xl' | 'wharf'
    label: string
    shipyardCount: number
    entries: FleetEntryView[]
    groupTotalBuildTime: number  // ceil(Σ(buildTime × quantity) / shipyardCount)
  }
  FleetGoalView = {
    buildTime: number
    shipyardLCount: number
    shipyardXLCount: number
    wharfCount: number
    groups: FleetShipyardGroup[]
    actualTotalBuildTime: number  // max(各组 groupTotalBuildTime)
    effectiveBuildTime: number    // max(actualTotalBuildTime, buildTime)
    mergedRates: { wareId: string; wareName: string; totalQty: number; ratePerHour: number }[]
  }
  FleetEntryView = {
    shipId: string; shipName: string
    blueprintId: string; blueprintName: string
    quantity: number
    buildTime: number  // 单艘建造时间（来自 production.time）
    totalBuildTime: number  // buildTime × quantity
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
- `updateFleetShipyardCount(groupType: 'shipyard_l' | 'shipyard_xl' | 'wharf', count: number)` — 更新船厂数量，最小 1
- 变更后自动触发 preview 重算

### 组件架构

- 新建 `FleetGoalCard` 组件 — 包含标题栏、船厂分组区、条目列表、rate 汇总
- 新建 `FleetGoalSearchBox` 组件 — 独立搜索框
- Blueprint 条目展开/收起状态为组件内部 `ref<Record<string, boolean>>`，不持久化

### i18n

- 前缀：`build_plan.fleet_*`
- 舰船名称使用 i18n nameId 翻译（与 ship-build 一致）
- 船厂分组标题：大型船厂 / 超大型船厂 / 船坞

## 边界

### In Scope

- Fleet goal 数据模型定义（含船厂分组字段）
- FleetGoalCard 组件（标题栏、船厂分组、条目列表、rate 汇总）
- FleetGoalSearchBox 组件（fleet 类别搜索）
- resolveBlueprintMaterialCost 纯函数
- Fleet 专用 store 方法
- Fleet 派生 rate 进入 preview/compute 管线
- Presenter Fleet 视图对象映射（含分组、建造时间）
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
2. Fleet 卡片在 Goals 区顶部显示，含可编辑 buildTime，并显示实际总花费和有效建造时间
3. Fleet entries 按船厂类型分为三组（大型船厂/超大型船厂/船坞），每组标题可编辑船厂数量
4. Blueprint 条目默认收起，显示总建造时间；展开后额外显示单艘建造时间和材料明细
5. Rate 汇总区始终可见，品种格式为 `wareName × totalQty`，rate 基于 effectiveBuildTime 计算，不可编辑
6. Fleet 派生 rate 作为 target-production 进入 preview，产线分配结果在 preview 区展示
7. 蓝图被删除时 entry 显示 warning，材料和建造时间按 0 计算
8. 删除最后一个 entry 后 Fleet 卡片自动消失
9. energycells rate 正常显示和参与规划
10. Fleet goal 变更（添加/删除/修改 quantity/修改 buildTime/修改 shipyardCount）后自动触发 preview 重算
11. 搜索结果不显示无已保存蓝图的舰船

## 未决项

无
