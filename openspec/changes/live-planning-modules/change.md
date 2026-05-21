# live-planning-modules change 补充方案

## 需求

1. **推荐纳入规划区域默认不折叠**：`recommendedModules` 建议区默认展开（当前默认折叠）
2. **推荐纳入规划区域的产线待遇和 plannedModules 等同**：推荐区模块在 autoFill 计算时作为 planned 基线的一部分，在 flow 计算中产出 ware 获得与 plannedModules 相同的 warePriority（2，最高可见）
3. **规划区的产线数量不允许小于 archive_total**：autoFill 计算工业区模块时，若 `referenceModules` 中存在的模块 count 不足 `archive_total`，补足到 `archive_total`。补足后上游消耗增加，递归重跑 autoFill 填补上游缺口，直到收敛
4. **非 referenceModules 的模块 autoFill 行为不变**：不在 `referenceModules` 中的模块，走旧 `calculateAutoIndustryModules` 完整逻辑，不做修改
5. **支撑区域不受 floor 约束**：habitation、infrastructure 等计算不变，可以低于 archive_total
6. **warePriority**：推荐区模块产出的 ware 默认 warePriority 2（纳入 `plannedWareSet`），排序仅在 plannedModules 之后
7. **推荐区默认展开**：`recommendedModulesExpanded` 默认 `true`，刷新后恢复默认

## 概念

- **`archive_total`**：`archive.modules + archive.building.modules`，按 moduleId 逐项计数
- **`referenceModules`**：由 `archive_total` 得出，传入 `computePlanResult` 和 autoFill 作为参考/floor
- **`recommendedModules`**：presenter 层计算的 orphan 差额建议列表（UI 展示用）
- **`recommendedModulesExpanded`**：建议区折叠状态

## 修改点

### 1. 新增 `calculateAutoIndustryModulesWithFloor`（`src/store/logic/calculateProductionFlows.ts`）

签名：

```ts
interface CalculateAutoIndustryWithFloorInput {
  plannedModules: SavedModule[]
  settings: StationSettings
  modulesMap: Record<string, X4Module>
  waresMap: Record<string, X4Ware>
  lockedWares: string[]
  referenceModules: SavedModule[]   // archive_total，其中存在的模块作为 floor
}

interface CalculateAutoIndustryWithFloorOutput {
  autoIndustryModules: SavedModule[]   // 最终 auto 工业模块（ref 中的 ≥ archive_total）
  canonicalBaseModules: SavedModule[]  // planned + autoIndustry 合并去重
}
```

算法：

```
1. allPlanned = plannedModules（已含 orphan 推荐合并后的基线）
2. auto = calculateAutoIndustryModules({ plannedModules: allPlanned, referenceModules, ... })
3. merged = mergeSavedModules([allPlanned, auto])
4. loop:
   a. changed = false
   b. for ref in referenceModules:
        if merged[ref.id] < ref.count:
          merged[ref.id] = ref.count
          changed = true
   c. if !changed → break
   d. auto = calculateAutoIndustryModules({ plannedModules: merged, referenceModules, ... })
   e. merged = mergeSavedModules([merged, auto])
5. autoIndustry = merged 中不在原始 plannedModules 的部分
6. return { autoIndustryModules: autoIndustry, canonicalBaseModules: merged }
```

floor 仅对 `referenceModules` 中存在的模块生效。不在 ref 中的模块完全复用现有 `calculateAutoIndustryModules` 逻辑，不做额外约束。

### 2. 修改 `StationDerivedMap.computePlanResult`（`src/store/state/StationDerivedMap.ts:566`）

**变更前**：
```
autoIndustry = calculateAutoIndustryModules({ plannedModules: inputModules, ref=referenceModules })
canonicalBase = max([inputModules, autoIndustry], referenceModules)
habitation = calculateAutoHabitation({ plannedModules: canonicalBase, ... })
flows = calculateCore({ plannedModules: canonicalBase, ... })
infrastructure = calculateInfrastructure({ flows, ... })
```

**变更后**：
```
// step 1: 计算 orphan 推荐（在 store 层判定）
orphanIds = computeOrphanModuleIds(referenceModules, modulesMap)
orphanRecommend = referenceModules 中 orphanIds ∩ (inputModules[id].count < archive_total[id])

// step 2: planned + orphan 合并作为 autoFill 基线
allPlanned = mergeSavedModules([inputModules, orphanRecommend])

// step 3: 新 floor autoFill（内部保证工业模块 ≥ archive_total）
autoResult = calculateAutoIndustryModulesWithFloor({
  plannedModules: allPlanned,
  referenceModules,
  ...
})

// step 4: canonical 基准直接用结果（已 ≥ archive_total，无 max）
canonicalBase = autoResult.canonicalBaseModules
autoIndustry = autoResult.autoIndustryModules

// step 5: habitation / flow / infrastructure 不变
habitation = calculateAutoHabitation({ plannedModules: canonicalBase, referenceModules, ... })
flows = calculateCore({ plannedModules: canonicalBase, ... })
infrastructure = calculateInfrastructure({ flows, ... })
```

### 3. orphan 判定下沉到 store 层

在 `StationDerivedMap` 中新增：

```ts
function computeOrphanModuleIds(
  referenceModules: SavedModule[],
  modulesMap: Record<string, X4Module>
): Set<string>
```

判定逻辑与 presenter 现有 `orphanArchiveModuleIds` 一致：
- 输入：referenceModules（archive_total 计数）
- 遍历 archive 中的模块，取其产出 ware 集合
- 若某模块的**任一产出**在 archive **其他模块**的 `inputs` 中不存在 → orphan
- 只看模块本身消费关系，不看工人等非模块消耗

### 4. `warePriority` — 扩大 `plannedWareSet`

在 `StationDerivedMap.recompute()` 第 663 行：

**变更前**：
```ts
const warePriorityLevels = buildResolvedWarePriority({
  plannedModules: snapshot.inputModules,
  autoIndustryModules,
  ...
}, allWareIds)
```

**变更后**：
```ts
// orphanModules 为 step 1 算出的 orphanRecommend
const expandedPlanned = mergeSavedModules([snapshot.inputModules, orphanModules])
const warePriorityLevels = buildResolvedWarePriority({
  plannedModules: expandedPlanned,
  autoIndustryModules,
  ...
}, allWareIds)
```

效果：推荐区模块产出的 ware 被纳入 `plannedWareSet`，获得 priority 2（最高可见）。`buildResolvedWarePriority` 接口不变。

### 5. `recommendedModulesExpanded` 默认值

`useLiveProductionStore` 中：默认值 `false` → `true`

### 6. presenter / UI 组件

- `useProductionPlanningPresenter`：`recommendedModules` 计算逻辑不变，仍为 presenter 层 orphan + 差额
- `recommendedModulesExpanded` 从 store 获取，默认 `true`
- `StationPlanningPanel`：建议区默认展开
- 其余不变（planned/auto/archive 展示、`+/-N`、红色阈值等）

## 不变区域

| 区域 | 说明 |
|------|------|
| `calculateAutoIndustryModules` | 旧函数不修改 |
| `calculateAutoHabitationModules` | 不修改 |
| `calculateInfrastructureModules` | 不修改 |
| 支撑区域 (habitation/infrastructure) | 不受 floor 约束，可 < archive_total |
| `StationDashboard` | 不变 |
| 持久化结构 | 不变 |
| 搜索框默认数量 | 不变 |
| auto/planned 区 `+/-N` 显示 | 不变 |
| archive 区纯参考 | 不变 |
| `buildResolvedWarePriority` 接口 | 不变 |
