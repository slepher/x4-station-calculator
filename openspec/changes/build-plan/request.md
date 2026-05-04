# build-plan 需求

## 核心目的

给定目标产线 C（通过目标模块或目标产量定义），构建一条完整的产线。如果用户有需求，则同时构建**建设该产线所需的建材产线**。建材产线的产量必须满足约束：

**建材消耗速率 = 目标全产线的建材总量 / 目标全产线的总建造时间**

如果建材产线存在自举需求（建材产线自身建造也消耗自身能产出的建材），则需要**同时**满足（使用 `&` 独立约束，不是 `+` 数值相加）：

1. 目标产线的建材消耗速率
2. 建材产线自身的建材消耗速率

建设需求可以是满足部分材料，也可以是满足全部材料。所有复杂的自举算法（联合自举、耦合迭代自举、嵌套联合自举、孤立特种自举）都是为了解决这一个自引用问题而设计的不同策略。

## 目标

在 Blueprint 的星区总览视图（overview）中新增产能爬坡建造规划功能。用户设定建造目标（目标产量/目标建筑）和通用自举模式（下拉框选择）后，系统根据当前帝国产能自动生成 1~3 个递进建造方案，用户点击方案卡片弹出浮动窗口查看详细建造步骤。移除时间/金钱约束，改为统计消耗。

## 目标类型 → 方案生成映射

| 目标类型 | 生成的方案 | 说明 |
|----------|-----------|------|
| **目标产量** (production-rate) | 方案3→2→1 递进 | 方案3=目标产线+autoFill，方案2=输入产线，方案1=自给自足 |
| **目标建筑** (build-module) | 方案3→2→1 递进 | 同上 |
| **自给自足** (self-sufficient) | 仅方案1 | 贪婪循环，从 hullparts 种子开始逐个加瓶颈生产者。作为独立 boolean 参数，可与上述目标共存 |

## 核心公式

**建材消耗速率** = `buildCost 总量 / buildTime 总量`

这就是 `computeBuildRates` 的核心逻辑：对一组模块，统计其 `buildCost` 中各建材的总量，除以所有模块的 `buildTime` 总量，得到每种建材的消耗速率（单位/h）。

## `&` 约束 vs `+` 约束

- **`&`（独立约束）**：每个约束源独立检查满足率 ≥ 100%。多个 source 不是把需求加在一起再检查，而是每个 source 各自必须满足。
- **`+`（数值相加）**：把多个 source 的需求合并后检查总满足率。**本系统不使用此方式**。

自举场景中，建材产线 A 必须同时满足 C 的建材需求 `&` B 的建材需求 `&` A 自身的建材需求。每个约束独立成立，不能因一个约束过剩而补偿另一个约束的不足。

## 五种自举模式 = 五种解自引用的策略

| 模式 | 策略 | 自举方式 |
|------|------|---------|
| None | 不建建材产线 | 直接建设 C |
| Joint | D=A+B 联合 | greedyFill 全自举（selfDemand = 产出 ∩ 消耗） |
| CoupledIterative | A↔B 迭代 | A 需同时满足 C 和 B 的建材需求，B 变了就重算 A |
| NestedJoint | A 先算 → D(A+B) 全自举 | A 一次性计算，D 从空开始 greedyFill |
| IsolatedSpecialized | B 孤岛 → A 自迭代 | B 外部供应孤立建设，A 自迭代满足 C+自身 |

## 算法流程

### 目标产量 / 目标建筑

```
Phase 1 — 方案3全量：
  1. expandGoalDependencies → 目标模块
  2. calculateAutoFillModules → allMods3（目标 + 运营 input 链）
  3. R3 = buildRates(allMods3)，识别建材模块（产出在 R3 中的非目标模块）
  4. 从 allMods3 剔除建材模块 → scheme3'
  5. R3' = buildRates(scheme3') — 当前产能 ≥ R3'？→ 只显示方案3

Phase 2 — 方案2：
  6. whichWares = R3'.keys, targetRates = R3
  7. planProductionForRates + autoFill → allMods2
  8. R2 = buildRates(allMods2)

Phase 3 — 方案1：
  9. r3Remaining = R3 - R3'（方案2不覆盖的建材）
  10. scheme1Target = max_merge(R2.rates, r3Remaining)（非叠加，取 max）
  11. greedyFill + autoFill → 自给自足产线
```

## 核心规则

- **建造顺序 1→2→3**：方案各自独立建造，前方案投产后的产出对后方案可用
- **建造开始消耗材料**：每步的 buildCost 在步开始时从库存扣除或购买
- **建造完成开始生产**：模块在步结束时投产，产出累入库存
- **builtSoFar 按步累加**：前步完工的模块在后步建造期间产出
- **能量电池不作为主要产物**：不出现在目的产物列表中，不作为贪婪瓶颈
- **一座一座建造**：`count > 1` 的模块展开为独立步骤，前步产出帮后步
- **算法内部跟踪库存**：库存不够时 `creditsNeeded > 0` 表示需购买

## 每步显示

```
#N  ModuleName ×count
    建造: X.XXh  累计: X.XXh  步骤费: XXX  累计费: XXX
    材料明细:
      WareName  ×qty  自产: rate/h  +produced  买: credits  (单价: price)
```

- **×qty** = 该步消耗的材料数量
- **自产** = 已有模块对该物资的净产出速率
- **+produced** = 本步建造期间的自产量（自产速率 × 本步建造时间）
- **买** = 算法库存不足时的购买金额。0 表示库存充足

## 涉及文件

| 文件 | 描述 |
|------|------|
| `src/types/build-plan.ts` | 类型定义：BuildScheme、BuildSchemeStep、BuildGroup |
| `src/store/logic/calculateBuildPlan.ts` | 核心算法：方案生成、greedyFill、autoFill 集成 |
| `src/store/useBlueprintProductionStore.ts` | Store 接口 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | Presenter 层 |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 左面板（搜索+目标卡片列表+计算按钮+self-sufficient checkbox） |
| `src/components/empire/BuildGoalSearchBox.vue` | 组合搜索框（左input+右类型下拉，Teleport弹层分组结果） |
| `src/components/empire/WarePlanningItem.vue` | 目标卡片（对标StationPlanningItem） |
| `src/store/logic/searchWare.ts` | 商品分组搜索函数 |
| `src/components/empire/BuildPlanPanel.vue` | 中面板（方案卡片列表） |
| `src/components/empire/BuildPlanStepsModal.vue` | 浮动窗口（方案步骤明细） |
| `src/components/empire/BlueprintProductionWorkbenchView.vue` | 工作台集成 |
| `analysis/scripts/findBuildPlanDefaults.ts` | 分析脚本，运行 `npx tsx analysis/scripts/findBuildPlanDefaults.ts` |

---

## Logic-Flow 导入菜单

在建造规划的标题栏（`BuildPlanConstraintsPanel` 的 `panel-header`）中添加一个导入菜单，用于在建造规划中直接载入已保存的 logic-flow 方案。

### 交互模式

参照船只配装面板（`ShipBuildPanelFit`）中的配装蓝图选择器模式：
- **按钮**显示当前激活的 logic-flow 方案名称（无方案时显示占位文案，如"无" / "None" → `t('build_plan.import_flow_placeholder')`）
- 点击按钮弹出浮动菜单，列出所有可载入的 logic-flow 方案
- 点击方案 → `logicFlowStore.loadPlan(index)` → 关闭菜单
- 点击菜单外部 → 关闭菜单

### 定位

| 方向 | 规则 |
|------|------|
| **Y 轴** | 菜单顶部边缘 = 按钮顶部边缘 |
| **X 轴** | 菜单左边缘 = 建造规划面板右边缘 + 固定间距 |
| **方式** | Teleport to body, `position: fixed`，通过 `getBoundingClientRect()` 获取按钮/面板位置 |

### 菜单弹出样式

类比船只配装中选择配装的逻辑——菜单在建造规划区之外弹出，作为浮层覆盖在页面上方。

### 涉及文件

| 文件 | 描述 |
|------|------|
| `src/components/empire/BuildPlanConstraintsPanel.vue` | `panel-header` 中添加按钮 + 浮动菜单 |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | Presenter 层新增 `currentFlowPlanName`、`loadableFlowPlans` 等 |
| `src/locales/{zh-CN,en}.json` | `build_plan.import_flow_placeholder` 等 i18n key |

---

## 产线自动分配

在建造规划面板中，根据 logic-flow 中当前激活的产线方案（`savedPlans.activePlan`），将用户添加的商品/模块目标自动分配到对应的产线。目标按产线分组展示，替代原有的单一目标卡片列表（`WarePlanningItem`）。

### 匹配规则

对每个 `BuildGoal`，按以下三级优先级分配产线：

**Layer 1: Build-flow 材料产出匹配（最高优先级）**

取 goal 对应的 `wareId`：
- `production-rate`: `goal.wareId`
- `build-module`: 找到模块的产出 ware（`module.outputs` 中第一个）
- `derived-rate`: `goal.wareId`

在 build-flow 的 `outputMaterialTags` 中匹配该 `wareId`：
- 命中 → 沿该 output tag 的连线（实线 `BuildFlowAssignment` 或虚线 `VirtualEdge`）获取 `sourceGroupId`
- 分配到 `sourceGroupId` 对应的 `ProductionLineGroup`

**Layer 2: Logic-flow 节点匹配（兜底）**

在 logic-flow 的 `ProductionLineGroup` 中按产线列表顺序扫描，**排除 isolated 节点**（isolated 节点仅作为占位符，不代表该产线实际生产该 ware）：
- **Manual 级**：
  - `production-rate` / `derived-rate`: `node.source === 'manual' && !node.isIsolated && node.wareId === goal.wareId`
  - `build-module`: `node.source === 'manual' && !node.isIsolated && node.moduleId === goal.moduleId`
- **Auto 级**（manual 未命中时）：同上但 `node.source === 'auto' && !node.isIsolated`

命中即停，分配到第一条匹配的产线。

**Layer 3: 待规划产线**

两层均未命中 → 分配到虚拟分组 "待规划产线"（纯 UI 标签，无实际 `ProductionLineGroup`）。表示这些产物无法归入已设计的产线，将统一由一条产线生产。

### 派生 goal 生成

当 goal 添加后，检测 logic-flow 中的 isolated 节点是否为其上游产品（全链路递归）。

```
for each user goal:
  module = getProductionModule(goal)
  walkUpstream(module, covered):
    for each inputWareId in module.inputs:
      if flow 中存在 isolated node (wareId == inputWareId) && !seenIsolatedWares.has(inputWareId):
        add derivedGoal { type: 'derived-rate', wareId: inputWareId, ratePerHour: 0 }
        seenIsolatedWares.add(inputWareId)
      if covered.has(inputWareId): continue
      nextModule = findModuleForWare(inputWareId)
      if nextModule: walkUpstream(nextModule, covered)
```

- 派生 goal 也走同样的三级匹配分配产线
- 派生 goal 类型为 `derived-rate`，初始数量 = 0，不可编辑数量、不可删除，实际需求量在 `computePlan()` 阶段计算
- `covered` 集合初始包含：user goal wareIds + 所有产线节点的 wareIds
- 实时重算：goals 或 logic-flow 变化时全量重算派生 goal，不再需要的自动移除

### UI 布局调整

```
.panel-card
  ├── .panel-header (标题 + flow-plan-import)
  └── .panel-content
        ├── BuildGoalSearchBox
        ├── [NEW] 产线分配区域 ← 替代原 WarePlanningItem 列表
        │     ├── 产线A (groupId: xxx)
        │     │   ├── [user] Missile Components × 500/h [可编辑] [×删除]
        │     │   └── [derived] Hull Parts [锁定]
        │     ├── 产线B
        │     └── 待规划产线
        │         ├── [user] Weapon Components × 200/h [可编辑] [×删除]
        │         └── [derived] Refined Metals [锁定]
        ├── 计算按钮
        ├── bootstrap mode selector
        └── warnings
```

- 仅展示有 goal 的产线，"待规划产线"始终在末尾（可同时包含 user goal 和 derived goal）
- 无 goal 时整个分配区域隐藏
- 无活跃 logic-flow plan 时全部归入"待规划产线"

### 数据模型

```typescript
// BuildGoal 新增派生类型
export type BuildGoal =
  | { type: 'production-rate'; wareId: string; ratePerHour: number }
  | { type: 'build-module'; moduleId: string; count: number }
  | { type: 'fleet'; shipId: string; quantity: number }
  | { type: 'derived-rate'; wareId: string; ratePerHour: number }  // NEW

// Presenter 输出
interface ProductionLineAllocation {
  groupId?: string
  groupName: string
  isUnmatched: boolean
  goals: BuildGoal[]
}
```

### 涉及文件

| 文件 | 描述 |
|------|------|
| `src/types/build-plan.ts` | 新增 `derived-rate` 类型、`ProductionLineAllocation` 接口 |
| `src/store/logic/computeProductionLineAllocation.ts` | **新增** — 产线分配核心算法（匹配 + 派生 goal 生成） |
| `src/components/empire/presenters/useBuildPlanPresenter.ts` | Presenter 层新增 `allocations: ProductionLineAllocation[]`、derived goal 管理 |
| `src/components/empire/BuildPlanConstraintsPanel.vue` | 搜索框下方新增产线分配区域，替代 WarePlanningItem 列表 |
| `src/store/useBlueprintProductionStore.ts` | `buildGoals` 支持 derived 类型 |
| `src/locales/{zh-CN,en}.json` | `build_plan.unmatched` 等 i18n key |
