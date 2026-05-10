# Logic Flow Energy Cells — Design

## 架构

### isRawMaterialWare 函数

位置：`src/store/logic/logicFlowStream.ts`

```typescript
export function isRawMaterialWare(
  wareId: string,
  modulesByOutputMap: Record<string, X4Module[]>
): boolean
```

实现：检查 `modulesByOutputMap[wareId]` 是否存在且长度 > 0。若不存在或为空，则该 ware 是 rawMaterial。

### isRawMaterialWare 在 UI 中的可用性

位置：`src/store/useGameDataStore.ts`

```typescript
function isRawMaterialWare(wareId: string): boolean
```

封装 gameData 自身的 `modulesByOutputMap`，供 Vue 组件直接调用，无需传参 modulesByOutputMap。

### computeExpandUpstream 改造

```typescript
// Before
const isT0 = ware.tier === 0 || wareId === 'energycells'

// After
const isRawMaterial = isRawMaterialWare(wareId, ctx.modulesByOutputMap || {})
```

isRawMaterial=true 时：创建无 moduleId 的叶子占位节点（与原 T0 行为一致）
isRawMaterial=false 时：走正常 findModuleForWare 路径

### ExpandContext 扩展

`ExpandContext` 已有 `modulesByOutputMap`，无需新增字段。

## 决策

### D1: isRawMaterial 判断依据

选择"无生产模块"而非"tier === 0"：
- tier=0 的 energycells 有生产模块，不应被当作不可自产资源
- 未来如果新增 tier=0 的可自产 ware，自动适配

### D2: EC 连线跳过方式

UI 层保留 `inputWareId === 'energycells'` 硬编码跳过，而非用 `ware.group === 'energy'`：
- 当前只有 energycells 一个 energy 组 ware 参与 logic-flow
- 过度抽象反而增加理解成本

### D3: 模块选取

复用 `findModuleForWare`，不写 if/else 硬编码 terran/default 规则：
- findModuleForWare 已正确处理 race → method → default 的 fallback 链
- 新增种族时自动适配

### D4: UI 层 tier===0 全部替换为 isRawMaterialWare

Vue 组件中大量 `tier === 0` 用于"禁止拖动/禁用"，需全部替换为 `isRawMaterialWare`：
- EC 可拖动、可添加到组（有＋菜单）
- ore/silicon 等仍不可拖动、无＋菜单

## 数据流

```
用户拖入产品
  → startDragging: isRawMaterialWare(wareId)? → 禁止拖动
  → expandUpstream(wareId)
    → computeExpandUpstream
      → isRawMaterialWare(wareId)?
        → true: 创建叶子占位节点（ore, silicon 等）
        → false: findModuleForWare(wareId, lineage)
          → 有模块: 创建带 moduleId 的节点，递归展开 inputs
          → 无模块: 不创建（兜底）
```

## 影响范围

| 文件 | 改动 |
|------|------|
| `src/store/logic/logicFlowStream.ts` | 新增 isRawMaterialWare（导出），修改 computeExpandUpstream |
| `src/store/useGameDataStore.ts` | 新增 isRawMaterialWare 实例方法（供 UI 调用） |
| `src/store/useLogicFlowStore.ts` | startDragging / traceUpstream / highlightedConnectionIds / calculateRequiredRawMaterials / getWareGroupStatus |
| `src/components/logic-flow/LogicFlowPlanningZone.vue` | tier===0 → isRawMaterialWare (6处) |
| `src/components/logic-flow/LogicFlowCandidateZone.vue` | tier===0 → isRawMaterialWare (6处) |
| 引用 `calculateRequiredT0Wares` 的文件 | 重命名更新 |
