# build-plan-storage 设计

## 架构概览

```
localStorage
  └─ getStorageKey('build_plan_goals') → SavedBuildPlanGoalsState
       └─ list: BuildPlanGoalSnapshot[]

useBuildPlanStore (Pinia)
  ├─ savedPlans: Ref<SavedBuildPlanGoalsState>   ← 新增
  ├─ buildGoals: Ref<BuildGoal[]>                ← 现有，与 activePlan 双向同步
  ├─ buildFlowMode: Ref<boolean>                 ← 现有，不持久化
  ├─ savePlansToStorage()                        ← 新增
  ├─ loadPlansFromStorage()                      ← 新增
  ├─ createNewPlan()                             ← 新增
  ├─ switchPlan(planId)                          ← 新增
  ├─ deletePlan(planId)                          ← 新增
  ├─ ensureActivePlan()                          ← 新增（首次添加目标时调用）
  ├─ updateLogicFlowPlanId()                     ← 新增
  ├─ activePlanName (getter/setter)              ← 新增
  └─ ...现有方法

useBuildPlanPresenter
  ├─ planName, activePlanId, loadablePlanItems   ← 新增
  ├─ logicFlow 相关 props                        ← 调整来源
  └─ 方案 CRUD emits                             ← 新增

BuildPlanConstraintsPanel.vue
  ├─ Panel-header: 标题编辑(useTitleEditor) + 方案菜单
  ├─ Panel-content: ...目标列表 → [checkbox + logic-flow菜单] → [计算按钮]
  └─ 方案菜单浮动下拉 (复用 flow-plan-menu 样式)
```

## 数据模型

### SavedBuildPlanGoalsState

```typescript
interface SavedBuildPlanGoalsState {
  version: number            // CURRENT_BUILD_PLAN_GOALS_VERSION = 1
  activeId: string | null
  list: BuildPlanGoalSnapshot[]
}

interface BuildPlanGoalSnapshot {
  id: string
  name: string
  buildGoals: BuildGoal[]
  logicFlowPlanId: string | null
  lastUpdated: number
}
```

### 类型位置

- `SavedBuildPlanGoalsState` / `BuildPlanGoalSnapshot` 定义在 `src/types/build-plan.ts`
- `CURRENT_BUILD_PLAN_GOALS_VERSION` 定义在 `src/store/logic/storageVersions.ts`

## Store 变更

### useBuildPlanStore 新增字段

```typescript
const savedPlans = ref<SavedBuildPlanGoalsState>({
  version: CURRENT_BUILD_PLAN_GOALS_VERSION,
  activeId: null,
  list: []
})
```

### 新增方法

#### `loadPlansFromStorage()`

- 从 `localStorage.getItem(gameData.getStorageKey('build_plan_goals'))` 读取
- 解析 JSON，检查 version，赋值给 `savedPlans`
- 若 `activeId` 存在，找到对应方案，将其 `buildGoals` 赋值给 `buildGoals`
- 在 store 初始化时调用（与 logicFlowStore 的 `loadPlansFromStorage` 类似）

#### `savePlansToStorage()`

- `localStorage.setItem(gameData.getStorageKey('build_plan_goals'), JSON.stringify(savedPlans.value))`
- 所有变更保存时调用

#### `ensureActivePlan()`

- 若 `savedPlans.value.activeId` 不为 `null`，直接返回
- 创建新方案：`id` = `crypto.randomUUID()`，`name` = "建造规划 N"，`buildGoals` = 当前 `buildGoals.value`，`logicFlowPlanId` = `logicFlowStore.savedPlans.activeId`
- 推入 `savedPlans.value.list`，设置 `activeId` = 新方案 id
- 调用 `savePlansToStorage()`

#### `createNewPlan()`

- 创建空方案：`buildGoals` = `[]`，其余同 `ensureActivePlan` 逻辑
- 设置 `savedPlans.value.activeId` = 新方案 id
- 设置 `buildGoals.value` = `[]`
- 调用 `savePlansToStorage()`

#### `switchPlan(planId: string)`

- 在 `list` 中找到目标方案
- 设置 `buildGoals.value` = 目标方案的 `buildGoals`
- 设置 `savedPlans.value.activeId` = planId
- 尝试还原 `logicFlowPlanId`：若 `logicFlowPlanId` 不为 `null` 且在 `logicFlowStore.savedPlans.list` 中存在对应 id，则调用 `logicFlowStore.loadPlan(index)`
- 调用 `savePlansToStorage()`

#### `deletePlan(planId: string)`

- 从 `list` 中移除该方案
- 若删除的是当前激活方案：
  - 若 `list` 仍有方案，设置 `activeId` = `list[0].id`，加载其 `buildGoals`
  - 否则 `activeId` = `null`，`buildGoals` = `[]`
- 调用 `savePlansToStorage()`

#### `updateLogicFlowPlanId()`

- 若 `savedPlans.value.activeId` 为 `null`，直接返回
- 找到当前方案，更新 `logicFlowPlanId` = `logicFlowStore.savedPlans.activeId`
- 更新 `lastUpdated`
- 调用 `savePlansToStorage()`

#### `activePlanName` (getter/setter)

- getter：若 `activeId` 为 `null` 返回空字符串；否则从 `list` 中找对应方案返回 `name`
- setter：若 `activeId` 为 `null` 直接返回；否则更新对应方案的 `name` 和 `lastUpdated`，调用 `savePlansToStorage()`

### 现有方法修改

#### `setBuildGoal()`

```typescript
function setBuildGoal(goal: BuildGoal) {
  ensureActivePlan()
  buildGoals.value = [...buildGoals.value, goal]
  syncGoalsToActivePlan()  // 新增：同步并保存
}
```

#### `removeBuildGoal()`

```typescript
function removeBuildGoal(index: number) {
  buildGoals.value = buildGoals.value.filter((_, i) => i !== index)
  syncGoalsToActivePlan()  // 新增：同步并保存
}
```

#### 新增 `syncGoalsToActivePlan()`

- 若 `activeId` 为 `null`，直接返回
- 找到当前方案，更新 `buildGoals` = `buildGoals.value` 和 `lastUpdated`
- 调用 `savePlansToStorage()`

### Watch 变更

#### 新增 watch：logicFlowStore.savedPlans.activeId 变化时

```typescript
watch(
  () => logicFlowStore.savedPlans.activeId,
  () => {
    updateLogicFlowPlanId()
  }
)
```

### `buildGoals` 赋值（updateGoal 场景）

Presenter 的 `updateGoal` emit 当前直接赋值 `buildPlanStore.buildGoals = updated`。需在此赋值后也触发 `syncGoalsToActivePlan()`。

方案：在 store 中拦截 `buildGoals` 的 setter，或让 presenter 显式调用 `syncGoalsToActivePlan()`。推荐后者，保持显式调用：

```typescript
// presenter emits
updateGoal: (index, value) => {
  // ...现有逻辑...
  buildPlanStore.buildGoals = updated
  buildPlanStore.syncGoalsToActivePlan()
}
```

### store 初始化

```typescript
// 在 useBuildPlanStore 内部，gameData ready 后调用
loadPlansFromStorage()
```

### store return 新增

```typescript
return {
  // 现有...
  savedPlans,
  createNewPlan,
  switchPlan,
  deletePlan,
  ensureActivePlan,
  syncGoalsToActivePlan,
  activePlanName,  // 作为 getter/setter 对
  loadPlansFromStorage,
  savePlansToStorage,
}
```

## getStorageKey 变更

`useGameDataStore.getStorageKey` 的参数类型需扩展：

```typescript
function getStorageKey(
  module: 'empire' | 'logic_flow' | 'ship_blueprints' | 'setting' | 'save_archives' | 'build_plan_goals'
): string {
  const config = currentVersionConfig.value
  if (!config) {
    return module === 'empire' ? 'x4_empire_data' :
           module === 'logic_flow' ? 'x4_logic_flow_plans' :
           module === 'ship_blueprints' ? 'x4_ship_blueprints' :
           module === 'save_archives' ? 'x4_save_archives' :
           module === 'build_plan_goals' ? 'x4_build_plan_goals' :
           'x4-setting'
  }
  return config.storage_keys[module]
}
```

- fallback key = `x4_build_plan_goals`
- 需同步更新 `currentVersionConfig` 的 `storage_keys` 类型定义，确保 `build_plan_goals` 被支持

## Presenter 变更

### useBuildPlanPresenter 新增 props

```typescript
// 方案相关
planName: ComputedRef<string>               // activePlanName 或空
activePlanId: ComputedRef<string | null>    // savedPlans.activeId
loadablePlanItems: ComputedRef<PlanItem[]>  // savedPlans.list 映射
```

```typescript
interface PlanItem {
  id: string
  name: string
  index: number
}
```

### useBuildPlanPresenter 新增 emits

```typescript
createNewPlan: () => void
switchPlan: (planId: string) => void
deletePlan: (planId: string) => void
setPlanName: (name: string) => void
```

### emits 实现

```typescript
createNewPlan: () => buildPlanStore.createNewPlan(),
switchPlan: (planId) => buildPlanStore.switchPlan(planId),
deletePlan: (planId) => buildPlanStore.deletePlan(planId),
setPlanName: (name) => { buildPlanStore.activePlanName = name },
```

### BuildPlanPresenterBuildPlanStore 接口更新

新增 `savedPlans`、`createNewPlan`、`switchPlan`、`deletePlan`、`activePlanName`（getter/setter）、`syncGoalsToActivePlan` 等签名。

### logicFlow 相关 props 移除

从 `BuildPlanPresenterProps` 中移除 `flowPlanName`、`activeFlowPlanId`、`loadableFlowPlans`。这些改为直接在 `BuildPlanConstraintsPanel` 内通过 `logicFlowStore` 获取，或通过新的 props 从 WorkbenchView 传入。

## Vue 组件变更

### BuildPlanConstraintsPanel.vue

#### Props 变更

```typescript
// 新增
planName: string
activePlanId: string | null
loadablePlanItems: PlanItem[]

// 移除（logicFlow 相关移到组件内部或新位置）
flowPlanName: string       // → 不再需要，logicFlow 菜单自行获取
activeFlowPlanId: string | null
loadableFlowPlans: FlowPlanItem[]
```

#### Emits 变更

```typescript
// 新增
createNewPlan: []
switchPlan: [planId: string]
deletePlan: [planId: string]
setPlanName: [name: string]

// 移除
loadFlowPlan: [planId: string]  // → 移到 logicFlow 菜单的新位置内部处理
```

#### Panel-header 模板

```vue
<div class="panel-header flex items-center justify-between">
  <!-- 左侧：可编辑标题 -->
  <div v-if="titleEditor.isEditing.value" class="flex items-center gap-2">
    <input ref="titleEditor.inputRef" v-model="titleEditor.editingValue.value"
      @keyup.enter="titleEditor.confirmEditing" @keyup.escape="titleEditor.cancelEditing"
      @blur="titleEditor.confirmEditing"
      class="..." />
  </div>
  <span v-else @dblclick="titleEditor.startEditing" class="cursor-pointer">
    {{ titleEditor.displayTitle.value }}
  </span>

  <!-- 右侧：方案菜单 -->
  <div class="plan-picker" ref="planMenuRef">
    <button class="plan-trigger" @click="togglePlanMenu" ref="planTriggerRef">
      <span class="plan-label">{{ planName || t('build_plan.no_plan') }}</span>
      <svg ...><!-- chevron --></svg>
    </button>
    <div v-if="planMenuOpen" class="plan-menu" :style="planMenuStyle">
      <button class="plan-menu-item plan-menu-item-new" @click="emit('createNewPlan')">
        {{ t('build_plan.new_plan') }}
      </button>
      <div v-if="loadablePlanItems.length === 0" class="plan-menu-empty">
        {{ t('build_plan.no_plans') }}
      </div>
      <div v-for="item in loadablePlanItems" :key="item.id"
        class="plan-menu-item-wrapper"
        :class="item.id === activePlanId ? 'plan-menu-item-active' : ''">
        <button class="plan-menu-item" @click="emit('switchPlan', item.id)">
          {{ item.name }}
        </button>
        <button class="plan-delete-btn" @click.stop="emit('deletePlan', item.id)">✕</button>
      </div>
    </div>
  </div>
</div>
```

#### Panel-content 内计算按钮上方新行

```vue
<!-- 计算按钮上方：建材产线 checkbox + logic-flow 菜单 -->
<div class="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded border border-slate-700/50">
  <label class="flex items-center gap-2 cursor-pointer">
    <input type="checkbox" :checked="buildFlowMode"
      @change="emit('setBuildFlowMode', ($event.target as HTMLInputElement).checked)"
      class="..." />
    <span class="text-xs text-slate-300 whitespace-nowrap">{{ t('build_plan.build_flow_mode') }}</span>
  </label>
  <div class="ml-auto">
    <!-- logic-flow 菜单（从 Panel-header 移到这里） -->
    <div class="flow-plan-picker" ref="flowMenuRef">
      <button class="flow-plan-trigger" @click="toggleFlowMenu" ref="flowTriggerRef">
        <span class="flow-plan-label">{{ flowButtonLabel }}</span>
        <svg ...><!-- chevron --></svg>
      </button>
      <div v-if="flowMenuOpen" class="flow-plan-menu" :style="flowMenuStyle">
        <!-- logic-flow 方案列表，复用现有逻辑 -->
      </div>
    </div>
  </div>
</div>

<!-- 计算按钮 -->
<button class="w-full ..." :disabled="loading" @click="onCompute">
  ...
</button>
```

#### useTitleEditor 集成

```typescript
const titleConfig = computed(() => ({
  getName: () => props.planName,
  setName: (name: string) => emit('setPlanName', name),
  getDefaultName: () => t('build_plan.title')
}))
const titleEditor = useTitleEditor(titleConfig)
```

### BlueprintProductionWorkbenchView.vue

- 调整 `useBuildPlanPresenter` 返回的 props 传递给 `BuildPlanConstraintsPanel`
- 新增方案相关 props/emits 的绑定

## i18n Key

| Key | zh-CN | en |
|-----|-------|----|
| `build_plan.new_plan` | 新建 | New |
| `build_plan.no_plan` | 无 | None |
| `build_plan.no_plans` | 暂无已保存的方案 | No saved plans |
| `build_plan.default_plan_name` | 建造规划 | Build Plan |

## 默认命名

- `getDefaultPlanName()` 返回 "建造规划 N"，N = `savedPlans.value.list.length + 1`
- 在 `createNewPlan()` 和 `ensureActivePlan()` 中使用

## 迁移与兼容

- `CURRENT_BUILD_PLAN_GOALS_VERSION = 1`，无需迁移逻辑
- 现有 localStorage 中不存在 `build_plan_goals` key，`loadPlansFromStorage()` 遇到 `null` 时初始化为空状态
