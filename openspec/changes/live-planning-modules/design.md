# live-planning-modules 设计文档

## 架构概览

本次变更严格遵循 `store → presenter → vue` 三层结构，所有显示层逻辑在 presenter 完成，store 保持领域数据完整不变。

```
archiveStation (store)
     │
     ▼
useProductionPlanningPresenter  ─── compute archiveTotalMap
     │                              compute effectiveAuto* (相减)
     │
     ▼
StationPlanningPanelWrapper ─── planning/live 互斥开关不变
     │                          planning 模式下向 StationPlanningPanel 传入 archive 数据
     │                          live 模式下继续渲染 ArchiveModuleList（不变）
     │
     ▼
StationPlanningPanel ─── planning 模式下接收 archiveModules, buildingModules, archiveTotalMap
     │                   新增 tier_built / tier_building 两个 section
     │                   搜索框默认数量联动
     │                   StationPlanningItem 传入 threshold
     │
     ▼
StationPlanningItem ─── 新增 threshold prop，count < threshold 时红色渲染
```

## 数据流

### 1. archiveTotalMap

在 presenter 中计算，key=moduleId, value=存档总量（built + building）。

```ts
const archiveTotalMap = computed(() => {
  const map: Record<string, number> = {}
  for (const m of liveModules.value) map[m.id] = (map[m.id] || 0) + m.count
  for (const m of liveBuildingModules.value) map[m.id] = (map[m.id] || 0) + m.count
  return map
})
```

### 2. effectiveAuto* 模块

在 presenter 中计算，从 store 的原始 auto 中扣除存档总量。

```ts
function deductArchive(modules: SavedModule[], totalMap: Record<string, number>): SavedModule[] {
  if (Object.keys(totalMap).length === 0) return modules
  return modules
    .map(m => ({ ...m, count: Math.max(0, m.count - (totalMap[m.id] || 0)) }))
    .filter(m => m.count > 0)
}
```

### 3. 存档模块区显示

存档模块区按 `X4Module.group` 分组，每组一个 tier header。组内已建模块在前、在建模块在后，在建以琥珀色虚线区分（完全与 ArchiveModuleList 一致）。规划区与存档区之间以 `<hr>` 分隔。

### 4. autoFill 参考模块优先级

`calculateAutoFillModules` 新增 `referenceModules: SavedModule[]` 参数。live 模式下 = `archive.modules + archive.building.modules`。

模块选择优先级（P1–P7）：

| 优先级 | 条件 | 配额 |
|--------|------|------|
| P1 | race 匹配 且 在参考模块池中 | 按参考产能上限（消耗后扣减） |
| P2 | 在参考模块池中（除去 P1 已消耗） | 按剩余参考产能上限 |
| P3 | race 匹配 且 在 plannedModules 中 | 无上限 |
| P4 | 在 plannedModules 中 | 无上限 |
| P5 | race 匹配 且 在参考模块池中 | 无上限 |
| P6 | 在参考模块池中 | 无上限 |
| P7 | race 匹配 | 无上限 |
| P8 | 任意模块 | 无上限 |

配额按**产能**计算：`ref_count × 该模块目标 ware 的单周期产量`。P1+P2 共享同一份配额，消耗后不再恢复。P5/P6 不再受配额约束。

实现方式：修改 `selectBestModule` / `findBestProducer`，增加 `referenceModules` 参数和配额跟踪。

## 组件变更

### StationPlanningPanelWrapper

- planning/live 互斥开关**保持不变**：planning 渲染 `StationPlanningPanel`，live 渲染 `ArchiveModuleList`
- **唯一改动**：planning 模式下，向 `StationPlanningPanel` 额外传入 `archiveModules`、`buildingModules`、`archiveTotalMap` 三个 prop
- live 模式下 `ArchiveModuleList` 完全不变

### StationPlanningPanel

- 新增 props：`archiveModules: SavedModule[]`, `buildingModules: SavedModule[]`, `archiveTotalMap: Record<string, number>`
- 存档模块区（已建+在建混合，group 分组，与 ArchiveModuleList 一致），规划区与存档区之间以 `<hr>` 分隔
- 修改 `handleAddModule`：新模块默认 count 从 `archiveTotalMap` 取，fallback 为 1
- 修改 `handleTransferArchiveModule`：实现"低于默认→提升，多于默认→不重复"逻辑
- `StationPlanningItem` 传入 `threshold` prop = `archiveTotalMap[module.id]`
- 仅当存档数据非空时渲染存档区

### StationPlanningItem

- 新增 props：`threshold?: number`
- 当 `!readonly && threshold !== undefined && item.count < threshold` 时，count 数字以红色渲染（`text-red-400`）
- 不影响已建/在建区 item 的渲染（它们始终是默认颜色）

## 不变区域

以下逻辑保持完全不变：
- `StationDerivedMap.deriveFullModules()` — 自动填充算法
- `calculateAutoFillModules()` — 自动模块生成
- `calculateProductionFlows()` — 生产流计算
- `StationDerivedCache` — 缓存结构
- `ArchiveModuleList` — live 模式存档展示
- `StationDashboard` — 仪表盘
- `StationWareFlowsDashboard` — 货物流仪表盘

## Locale 新增

| key | zh-CN | en |
|-----|-------|----|
| `planning.tier_built` | 已建模块区 | Built Modules |
| `planning.tier_building` | 在建模块区 | Building Modules |
