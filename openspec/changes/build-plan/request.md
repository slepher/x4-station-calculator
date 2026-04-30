# build-plan 需求

## 目标

在 Blueprint 的星区总览视图（overview）中新增产能爬坡建造规划功能。用户设定建造目标（目标产量/目标建筑）和自给自足开关后，系统根据当前帝国产能自动生成 1~3 个递进建造方案（方案1→方案2→方案3），用户点击方案卡片弹出浮动窗口查看详细建造步骤。移除时间/金钱约束，改为统计消耗。

## 目标类型 → 方案生成映射

| 目标类型 | 生成的方案 | 说明 |
|----------|-----------|------|
| **目标产量** (production-rate) | 方案3→2→1 递进 | 方案3=目标产线+autoFill，方案2=输入产线，方案1=自给自足 |
| **目标建筑** (build-module) | 方案3→2→1 递进 | 同上 |
| **自给自足** (self-sufficient) | 仅方案1 | 贪婪循环，从 hullparts 种子开始逐个加瓶颈生产者。作为独立 boolean 参数，可与上述目标共存 |

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
