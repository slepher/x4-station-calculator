# Logic Flow Energy Cells — Tasks

## T1: logicFlowStream.ts — isRawMaterialWare + computeExpandUpstream

1. 新增导出函数 `isRawMaterialWare(wareId: string, modulesByOutputMap: Record<string, X4Module[]>): boolean`
   - 实现：`!(modulesByOutputMap[wareId]?.length > 0)`
2. `computeExpandUpstream` 中：
   - `const isT0 = ware.tier === 0 || wareId === 'energycells'` → `const isRawMaterial = isRawMaterialWare(wareId, ctx.modulesByOutputMap || {})`
   - `if (isT0)` → `if (isRawMaterial)`

## T2: useGameDataStore.ts — isRawMaterialWare 实例方法

1. 新增 `isRawMaterialWare(wareId: string): boolean` 实例方法
   - 实现：调用导出的 `isRawMaterialWare(wareId, modulesByOutputMap)`
2. 导出供 UI 组件直接调用

## T3: useLogicFlowStore.ts — 核心逻辑改造

1. `startDragging`（~L121）: `ware.tier === 0` → `gameData.isRawMaterialWare(wareId)`
2. `traceUpstream`（~L299）: 保留 `if (inputWareId === 'energycells') return`（UI 连线跳过）
3. `highlightedConnectionIds`（~L371）: 保留 `if (inputWareId === 'energycells') return`（UI 连线跳过）
4. `calculateRequiredT0Wares` → `calculateRequiredRawMaterials`:
   - 重命名函数
   - L396: `if (id === 'energycells') return` → 移除
   - L403: `if (ware.tier === 0)` → `if (gameData.isRawMaterialWare(id))`
5. `getGroupT0Resources` → `getGroupRawMaterials`（重命名）
6. `getSortedGroupT0Resources` → `getSortedGroupRawMaterials`（重命名）
7. `getWareGroupStatus`（~L948）: `ware.tier === 0 || wareId === 'energycells'` → `gameData.isRawMaterialWare(wareId)`
8. 更新导出列表

## T4: LogicFlowPlanningZone.vue — tier===0 → isRawMaterialWare

1. L46: `ware.tier === 0` → `gameData.isRawMaterialWare(wareId)` (getDropStatus)
2. L67: `n.wareId !== 'energycells'` → `!gameData.isRawMaterialWare(n.wareId)` (getFormattedResources)
3. L92: `draggingWare.tier > 0` → `!gameData.isRawMaterialWare(logicFlow.draggingWareId)` (getFormattedResources)
4. L97: `if (wareId === 'energycells') return []` → 保留（UI 连线跳过，与 traceUpstream 一致）
5. L103: `ware.tier === 0` → `gameData.isRawMaterialWare(wareId)` (traceT0 终止条件)
6. L129: `wareId !== 'energycells'` → `!gameData.isRawMaterialWare(wareId)` (排除条件)
7. L157: `calculateRequiredT0Wares` → `calculateRequiredRawMaterials`
8. L159: `wareId !== 'energycells'` → `!gameData.isRawMaterialWare(wareId)`
9. L169: `ware.tier === 0` → `gameData.isRawMaterialWare(logicFlow.draggingWareId)` (getNewLineModuleName)
10. L189: `ware?.tier === 0` → `gameData.isRawMaterialWare(node.wareId)` (getCompactNodeDisplayName)
11. L220: `n.wareId !== 'energycells'` → `!gameData.isRawMaterialWare(n.wareId)` (getCompactGroupTitle)
12. L328: `ware.tier === 0` → `gameData.isRawMaterialWare(wareId)` (isDropAllowedForNewZone)
13. L345: `wareData.tier === 0` → `gameData.isRawMaterialWare(ware.id)` (handleAddFromDrop)

## T5: LogicFlowCandidateZone.vue — tier===0 → isRawMaterialWare

1. L61: `a.tier === 0` → `gameData.isRawMaterialWare(a.id)` (排序特殊逻辑)
2. L113: `ware.tier === 0` → `gameData.isRawMaterialWare(wareId)` (handleDragStart)
3. L387: `:disabled="tier === 0"` → `:disabled="isTierRawMaterial(tier)"` (draggable disabled)
   - 需辅助：`const isTierRawMaterial = (tier: number) => waresByTier.value[tier]?.every(w => gameData.isRawMaterialWare(w.id))`
4. L397: `:draggable="ware.tier > 0"` → `:draggable="!gameData.isRawMaterialWare(ware.id)"`
5. L400: `ware.tier === 0 ? 'is-locked-tier ...' : 'is-draggable-tier ...'` → `gameData.isRawMaterialWare(ware.id) ? 'is-locked-tier ...' : 'is-draggable-tier ...'`
6. L410: `ware.tier > 0 && ware.id !== 'energycells'` → `!gameData.isRawMaterialWare(ware.id)` (＋按钮背景层)
7. L420: `v-else-if="ware.tier === 0"` → `v-else-if="gameData.isRawMaterialWare(ware.id)"` (T0 背景层)
8. L443: `v-if="ware.tier > 0"` → `v-if="!gameData.isRawMaterialWare(ware.id)"` (资源预览)
9. L447: `calculateRequiredT0Wares` → `calculateRequiredRawMaterials`

## T6: useGameData.ts — precomputeCandidateWares trace 终止条件

1. L403: `if (ware && ware.tier === 0) return` → `if (ware && isRawMaterialWare(wareId, modulesByOutputMap)) return`
2. L434: 同上

## T7: build 验证

- 运行 `npm run build`，确保无编译错误
