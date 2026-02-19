## Context

### 当前状态

- `StationWareFlowsDashboard.vue` 显示空间站级别的资源流分组（产品、运营、补给、资源）
- `EmpireWareFlowsDashboard.vue` 显示帝国级别的资源流分组（产品、运营、补给）
- `EmpireWareFlowGroup.vue` 和 `EmpireWareFlow.vue` 已存在，用于帝国总览
- `ContextToolbar.vue` 的第三组已包含"工人运算"和"站内补给"开关
- `useEmpireStore.ts` 提供 `empireGroupedFlows` computed 属性

### 约束

- 分组仅在资源视图显示，经济视图与体积视图不显示
- 缺口项不显示收藏按钮，该位置留空
- 复用现有的 `EmpireWareFlowGroup` 和 `EmpireWareFlow` 组件
- 开关状态持久化到 localStorage

## Goals / Non-Goals

**Goals:**
- 在 ContextToolbar 添加"显示缺口"开关
- 开启后在空间站视图顶部显示帝国运营与帝国补给
- 每个缺口项提供 + 按钮，点击直接添加默认产线模块
- 分组数据与帝国总览保持一致（优先级逻辑一致）

**Non-Goals:**
- 不修改帝国总览的显示逻辑
- 不实现缺口数据的额外计算（直接使用现有 `empireGroupedFlows`）

## Decisions

### Decision 1: 开关字段位置

**选择**: 在 `useStationStore.ts` 的 `settings` 中添加 `showEmpireGaps: boolean` 字段

**理由**:
- 与现有的 `considerWorkforceForAutoFill`、`internalSupply` 开关保持一致
- 自动持久化到 localStorage
- 空间站级别控制，符合用户预期

**替代方案**:
- 在 EmpireStore 中存储：不符合"空间站级别"的语义
- 独立的 UI 状态：不持久化，用户体验差

### Decision 2: 帝国运营/补给数据来源

**选择**: 直接使用 `useEmpireStore.empireGroupedFlows`

**理由**:
- 数据已经计算好，无需重复计算
- 与帝国总览数据一致
- 性能开销小
- priority 使用空间站内 `buildResolvedWarePriority` 的修正结果

**实现**:
```typescript
// 在 StationWareFlowsDashboard.vue 中
const empireStore = useEmpireStore()

const empireGaps = computed(() => {
  const flows = empireStore.empireGroupedFlows
  const operations = [...flows.operations, ...flows.products].filter(f => {
    const priorityLevel = warePriorityLevels[f.wareId] ?? 0
    return f.netRate < 0 || priorityLevel > 0
  })
  return {
    operations,
    supply: flows.supply
  }
})
```

### Decision 3: 缺口分组组件（复用现有组件）

**选择**: 复用现有的 `EmpireWareFlowGroup.vue` 和 `EmpireWareFlow.vue`，扩展支持 + 按钮

**理由**:
- 避免重复代码，减少维护成本
- 帝国运营/补给项与帝国总览项样式一致
- 通过 props 控制差异（`showAddButton`）

**实现**:

1. **EmpireWareFlow.vue 扩展**：
```typescript
// 新增 props
defineProps<{
  // ... 现有 props
  showAddButton?: boolean  // 是否显示 + 按钮
}>()

// 新增 emit
const emit = defineEmits<{
  add: [wareId: string]
}>()
```

```vue
<!-- 在 flow-wrapper 中添加 + 按钮 -->
<div class="flow-wrapper" :data-resource-id="resourceId">
  <div class="flow-content">...</div>
  <button 
    v-if="showAddButton"
    class="add-btn"
    @click="emit('add', resourceId)"
  >
    +
  </button>
</div>
```

2. **EmpireWareFlowGroup.vue 扩展**：
```typescript
// 新增 props
defineProps<{
  // ... 现有 props
  showAddButton?: boolean
}>()

// 透传 emit
defineEmits<{
  add: [wareId: string]
}>()
```

```vue
<EmpireWareFlow
  v-for="item in items"
  :key="item.id"
  :showAddButton="showAddButton"
  @add="$emit('add', $event)"
  ...
/>
```

**替代方案**:
- 创建独立的 `EmpireGapGroup.vue`：增加代码重复
- 内联在 `StationWareFlowsDashboard`：代码臃肿

### Decision 4: + 按钮行为

**选择**: 复用现有的快速添加模块逻辑

**理由**:
- 与候选区的快速添加行为一致
- 已有 `addModuleToStation` 函数可复用
- 用户体验统一

**实现**:
```typescript
// 点击 + 按钮时
const handleAddModule = (wareId: string) => {
  const ware = store.wares[wareId]
  const defaultMethod = ware.defaultMethod
  if (defaultMethod) {
    store.addModule(defaultMethod.moduleId)
  }
}
```

### Decision 5: 显示位置与排序

**选择**: 在 `StationWareFlowsDashboard.vue` 的 `list-body` 顶部显示

**理由**:
- 符合用户期望的"缺口优先"阅读顺序
- 不影响现有的分组布局
- 仅在资源视图显示
- 帝国运营组内排序：tier 高的在前，同 tier 按字母序

**实现**:
```vue
<div v-if="viewMode !== 'volume' && store.settings.showEmpireGaps">
  <EmpireWareFlowGroup 
    v-if="empireGaps.operations.length > 0"
    :title="t('wareflow.empire_operations')"
    :items="empireGaps.operations"
    :viewMode="viewMode"
    :showAddButton="true"
    @add="handleAddModule"
  />
  <EmpireWareFlowGroup 
    v-if="empireGaps.supply.length > 0"
    :title="t('wareflow.empire_supply')"
    :items="empireGaps.supply"
    :viewMode="viewMode"
    :showAddButton="true"
    @add="handleAddModule"
  />
</div>
```

## Risks / Trade-offs

### Risk 1: 缺口数据更新延迟

**风险**: 空间站添加模块后，缺口数据可能不会立即更新。

**缓解**: 
- `empireGroupedFlows` 是 computed 属性，会自动响应依赖变化
- 确保模块添加后触发 `lastUpdated` 更新

### Risk 2: 缺口分组过多

**风险**: 如果缺口项很多，可能占用过多屏幕空间。

**缓解**: 
- 缺口分组支持折叠（继承自 `CollapsibleDetailList`）
- 用户可以关闭开关隐藏缺口分组
