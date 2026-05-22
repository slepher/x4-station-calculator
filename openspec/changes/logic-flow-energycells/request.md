# Logic Flow Energy Cells

## 目标

将能量电池（energycells）从 logic-flow 的"T0 资源排除"逻辑中移出，使其作为具体的生产模块节点参与 logic-flow 数据，而非被硬编码跳过。同时引入更精确的 `isRawMaterial` 判断替代 `tier === 0`。

## 已确认方案（审核重点）

### 核心概念替换

- **新判断函数** `isRawMaterialWare(wareId, ctx)` — 该 ware 在 `modulesByOutputMap` 中无玩家可建造的生产模块
- 替代原有的 `ware.tier === 0 || wareId === 'energycells'` 判断
- energycells: tier=0, 有生产模块 → `isRawMaterial=false` → 走正常 findModuleForWare 路径
- ore/silicon/hydrogen 等: tier=0, 无生产模块 → `isRawMaterial=true` → 叶子占位节点

### 模块选取

- 复用 `findModuleForWare`，不硬编码规则
- terran lineage → `module_ter_prod_energycells_01`
- 其他 lineage → `module_gen_prod_energycells_01`

### UI 交互规则

- EC 节点在图中展示（有具体 moduleId 和模块名）
- **不画连线**到消费 EC 的下游模块（所有模块都需要 EC，画线会导致图过于复杂）
- traceUpstream / highlightedConnectionIds 中保留 `inputWareId === 'energycells'` 的跳过逻辑
- **EC 可拖动、有＋菜单**：`isRawMaterial=false` 的 ware 允许拖入和添加
- **rawMaterial 不可拖动、无＋菜单**：`isRawMaterial=true` 的 ware 禁止拖入
- Vue 组件中所有 `tier === 0` 判断替换为 `isRawMaterialWare`

### calculateRequiredT0Wares → calculateRequiredRawMaterials

- 重命名：`calculateRequiredT0Wares` → `calculateRequiredRawMaterials`
- 内部判断从 `ware.tier === 0` 改为 `isRawMaterialWare`
- `if (id === 'energycells') return` 硬编码移除，由 `isRawMaterialWare` 自然排除

### getWareGroupStatus

- `ware.tier === 0 || wareId === 'energycells'` → `isRawMaterialWare(wareId, gameData)`
- EC 不再被视为 rawMaterial，进入正常状态判断流程

## 边界

### In Scope

- `logicFlowStream.ts` — isRawMaterialWare（导出）+ computeExpandUpstream 改造
- `useGameDataStore.ts` — isRawMaterialWare 实例方法（供 UI 调用）
- `useLogicFlowStore.ts` — startDragging / traceUpstream / highlightedConnectionIds / calculateRequiredRawMaterials / getWareGroupStatus
- `LogicFlowPlanningZone.vue` — tier===0 → isRawMaterialWare (6处)
- `LogicFlowCandidateZone.vue` — tier===0 → isRawMaterialWare (6处)
- 所有引用 `calculateRequiredT0Wares` 的地方更新

### Out of Scope

- build-plan 相关文件中的 energycells 处理（不在 logic-flow 范围）
- buildFlowDerivation / calculateBuildFlowPlan 等其他模块
- EC 节点的 UI 展示样式调整

## 验收标准（DoD）

1. logic-flow 中拖入需要 EC 的产品时，EC 以具体模块节点出现（terran→Terran EC, 其他→EC Production）
2. EC 节点无上游连线（因 EC 模块 inputs={}）
3. EC 节点无到下游模块的连线（UI 层跳过）
4. `isRawMaterialWare` 正确识别 ore/silicon/hydrogen 等为 rawMaterial，energycells 为非 rawMaterial
5. `calculateRequiredRawMaterials` 不再包含 energycells
6. `getWareGroupStatus` 对 EC 走正常状态判断，不再硬编码返回 'available'
7. EC 在候选区可拖动、有＋菜单；rawMaterial（ore/silicon 等）仍不可拖动、无＋菜单
8. 现有功能无回归：rawMaterial 仍为叶子节点，上游追踪/高亮逻辑正常

## 未决项

无
