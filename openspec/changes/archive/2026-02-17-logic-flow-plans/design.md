## Context

### 当前状态
- 逻辑组网功能 (`useLogicFlowStore`) 仅支持单一工作区，数据通过 `x4_logic_flow_data` 持久化
- 空间站设计方案 (`useStationStore`) 已有完整的方案管理系统，包括 `savedPlans`、`currentPlanName`、`isDirty` 等
- 标题栏 (`StationToolbar.vue`) 仅针对空间站方案设计，使用蓝色系主题

### 约束
- 必须与空间站方案管理体验保持一致
- 不能影响现有空间站方案功能
- 方案数据需要精简存储（仅保存 manual/isolated 节点）

## Goals / Non-Goals

**Goals:**
- 为逻辑组网添加完整的方案管理功能（新建、保存、另存为、加载、删除）
- 标题栏支持根据视图类型动态切换主题色
- 方案数据精简存储，载入时自动重建 auto 节点
- 复用现有组件（SmartSaveDialog），减少代码重复

**Non-Goals:**
- 不实现导入功能（仅保留按钮）
- 不实现分享功能（仅保留按钮）
- 不实现从逻辑组网选择产线载入到空间站的功能（后续 change）
- 不修改现有的 `x4_logic_flow_data` 存储结构

## Decisions

### 1. 存储策略
**决策**: 使用单一的 localStorage key
- `x4_logic_flow_plans`: 方案列表（包含 settings 和 activeId）

**理由**: 
- 与空间站方案存储结构保持一致
- 废弃旧的 `x4_logic_flow_data`，避免数据冗余
- 初始化时根据 `activeId` 自动加载当前方案

**数据结构**:
```typescript
interface SavedFlowPlansState {
  version: 1
  activeId: string | null  // 当前活动方案 ID
  list: LogicFlowPlan[]    // 方案列表
}
```

**初始化流程**:
```
init()
  → loadPlansFromStorage()
  → if (activeId) → applyPlan(activePlan)
```

**备选方案**: 保留 `x4_logic_flow_data`
- 优点：保留工作区自动保存功能
- 缺点：数据冗余，需要同步两份数据

### 2. 方案数据格式
**决策**: 仅保存 manual 和 isolated 节点

**理由**:
- auto 节点可以通过 `expandUpstream` 重建
- 减少存储空间
- 避免数据冗余和不一致

**重建逻辑**:
```
loadPlan(index)
  → applyPlan(plan)
  → 遍历每个 SavedFlowGroup
  → 第一轮：先添加所有 isolated 节点（确保 expandUpstream 能检测到它们）
  → 第二轮：添加 manual 节点并调用 expandUpstream() 重建上游 auto 节点
```

**重要**: 必须分两轮处理节点，因为 `expandUpstream` 需要检测已存在的 isolated 节点并跳过它们。如果 manual 节点在 isolated 节点之前处理，isolated 节点还未添加到组中，导致无法被检测到。

### 3. 组件复用策略
**决策**: SmartSaveDialog 通过 props 区分 Store 类型

**理由**:
- 保存逻辑高度相似
- 减少代码重复
- 便于统一维护

**实现方式**:
```typescript
// SmartSaveDialog.vue
const props = defineProps<{
  storeType: 'station' | 'logicFlow'
}>()

const store = computed(() => 
  props.storeType === 'station' 
    ? useStationStore() 
    : useLogicFlowStore()
)
```

### 4. 加载对话框
**决策**: 创建独立的 `LoadFlowPlanModal.vue`

**理由**:
- 逻辑组网方案的展示内容与空间站方案不同
- 需要显示产线组信息而非模块列表
- 避免过度复杂化现有组件

### 5. 主题色映射
**决策**: 使用计算属性动态生成主题类

| 元素 | 生产视图 | 逻辑组网视图 |
|------|---------|-------------|
| 标题文字 | `text-sky-400` | `text-purple-400` |
| 新建按钮 | `btn-cyan` | `btn-fuchsia` |
| 保存按钮 | `btn-blue` | `btn-purple` |
| 加载按钮 | `btn-cyan` | `btn-fuchsia` |

### 6. 产线组名称字段设计
**决策**: 合并 `name` 和 `customName` 为单一的 `name` 字段

**理由**:
- 简化数据结构，减少冗余
- `name` 为空时，UI 动态计算并显示默认名称
- 默认名称根据产线状态自动变更

**默认名称计算规则**:
1. 找到最高 tier（column 值最大）的 **manual** 节点
2. 按 isolation 状态排序（isolated 节点置底）
3. 返回第一个节点的商品名称

**UI 行为**:
- 显示：如果 `name` 为空，显示动态计算的默认名称；否则显示 `name`
- 编辑：点击编辑时，输入框显示当前显示的名称
- 保存：如果用户输入与默认名称相同，保存为空字符串（`name = ''`）；否则保存用户输入

### 7. 创建新产区入口
**决策**: 非紧凑模式下，"创建新产区"区域始终显示

**理由**:
- 原设计仅在 `groups.length === 0` 时显示，用户创建产线后入口消失
- 始终显示可让用户随时创建新产区，提升用户体验

## Risks / Trade-offs

### 风险 1: auto 节点重建可能不完整
- **风险**: 如果游戏数据发生变化（模块配方改变），重建的 auto 节点可能与原始状态不一致
- **缓解**: 在方案元数据中保存游戏版本信息，加载时检查版本兼容性

### 风险 2: 存储空间增长
- **风险**: 用户创建大量方案可能导致 localStorage 空间不足
- **缓解**: 方案数据已精简，单个方案通常小于 10KB，可支持数百个方案

### 风险 3: 视图切换时的数据一致性
- **风险**: 用户在两个视图间频繁切换，可能产生混淆
- **缓解**: 两个 Store 完全独立，数据不会互相影响

## Migration Plan

### 阶段 1: 数据结构准备
1. 在 `src/types/x4.ts` 中添加新类型定义
2. 在 `useLogicFlowStore.ts` 中添加新状态和方法

### 阶段 2: UI 实现
1. 修改 `StationToolbar.vue` 支持主题切换
2. 修改 `SmartSaveDialog.vue` 支持 Store 类型切换
3. 创建 `LoadFlowPlanModal.vue`

### 阶段 3: 测试与验证
1. 单元测试：Store 方法
2. E2E 测试：方案管理流程

### 回滚策略
- 新功能不影响现有数据结构
- 可通过移除新组件和 Store 方法回滚
- 用户数据（`x4_logic_flow_data`）不受影响
