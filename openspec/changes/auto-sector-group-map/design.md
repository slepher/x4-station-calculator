# 自动星区划分接入 Map — 设计方案

## 架构概览

本 change 不引入新的自动分组算法，所有算法复用 `auto-sector-group-merged` 中已实现的 `src/store/logic/autoGroup.ts`。核心改动是架构层重组：将 `SectorOverviewPanel.vue` 的核心逻辑提升为 presenter，将自动计算触发检查下沉到 `liveProductionStore`，并创建 map 上层 wrapper 替换 Map 的 Step 2。

```
Before:
  MapSavePanel    → MapBindingSectorGroup (1424行, 手动编辑, 无自动分组)
  MapBindingPanel → MapBindingSectorGroup (遗留无生产入口)
  SectorOverviewPanel (962行, 直接访问 store, 无复用)

After:
  MapSavePanel    → AutoSectorGroupMapPanel (map wrapper)
  MapBindingPanel 删除（无生产入口遗留组件）
  SectorOverviewPanel → useAutoSectorGroupPresenter → live 三列布局

Shared UI combinations:
  Col 2 = SectorConfirmBar + SectorGroupList + Hub menu
  Col 3 = SectorAllocationList + AllocationConfirmBar
```

不新增 Col 2 / Col 3 unit wrapper。Col 2 和 Col 3 保持为现有组件组合，上层 Vue 负责不同容器形态：live 是三列布局，map 是 tab 布局。

## Presenter 抽取设计

### useAutoSectorGroupPresenter.ts

文件位置：`src/components/empire/presenters/useAutoSectorGroupPresenter.ts`

```ts
export function useAutoSectorGroupPresenter() {
  // === 响应式状态 ===
  const prefJumpRange = ref(DEFAULT_JUMP_RANGE)
  const bridgeSearchJumpRange = ref(DEFAULT_BRIDGE_SEARCH_JUMP_RANGE)
  const prefThreshold = ref(DEFAULT_HUB_CONFIG.containerThreshold)
  const nodeEnabled = ref(true)
  const bridgeRetainEnabled = ref(true)
  const coverageRetainEnabled = ref(true)
  const showHubAddMenu = ref(false)
  const autoGroupResult = ref<AutoGroupResult | null>(null)
  const postBridgeBaseline = ref<AutoGroupResult | null>(null)
  const autoGroupConfirmed = ref(false)
  const calculationMode = ref<'result' | 'edit'>('result')
  const editSnapshot = ref<EditSnapshot | null>(null)
  const calcBaselinePillState = ref<CalcBaselinePillState | null>(null)

  // === 计算属性 ===
  const canDisableNode: ComputedRef<boolean>
  const playerSectorMacros: ComputedRef<string[]>
  const sectorGraphInfo: ComputedRef<SectorGraphInfo>
  const activeBindingPlan: ComputedRef<SaveBindingPlan | null>
  const hubAddMenuFilteredSectorMacros: ComputedRef<string[]>

  // === 方法 ===
  function runAutoGroup()
  function enterEditMode()
  function cancelEdit()
  function runCalculationFromEditInput()
  function addHubDraft(sectorMacro: string)
  function removeHubDraft(groupId: string)
  function togglePin(groupId: string)
  function updateGroupJumpRange(groupId: string, range: number)
  function selectAssignmentOption(sectorMacro: string, optionIndex: number)
  function selectBridgePlan(planId: string)
  function confirmAndWrite()
  function clearAutoGroupCheckFlagAfterRun()

  return { /* 所有状态、computed、方法 */ }
}
```

### 抽取范围

| 从 SectorOverviewPanel | 迁移到 Presenter | 保留在组件 |
|------------------------|-----------------|-----------|
| 所有 `ref()` 声明 | yes | no |
| 所有 `computed()` 派生 | yes | no |
| `runAutoGroup()` 及其调用的子逻辑 | yes | no |
| `enterEditMode()`, `cancelEdit()` | yes | no |
| `runCalculationFromEditInput()` | yes | no |
| `confirmAndWrite()` | yes | no |
| add/remove/toggle group 方法 | yes | no |
| coverage/connection 修改方法 | yes | no |
| assignment option / bridge plan 选择 | yes | no |
| `getSectorDisplayName()` | yes | no |
| hubAddMenu 打开/关闭控制 | yes | 菜单组件本身 |
| 自动分组 flag 消费与清除 | yes | no |
| DOM 操作 / 模板绑定 | no | yes |
| CSS class / 布局 | no | yes |

## 自动计算触发检查

### liveProductionStore 职责

`useLiveProductionStore` 负责判断当前 binding 是否需要自动分组计算。检查逻辑不执行自动分组算法，只设置 flag。

检查条件：
- 当前 binding 存在
- 当前 archive 中存在玩家资产 sector
- 至少一个有玩家资产的 sector 未被当前 binding 的任意 group anchor 或 coverage 覆盖

触发时机：
- 页面刷新后 store / archive 恢复完成
- 手动切换 active binding
- 上传新存档或 archive timing 变化导致 active binding / selected archive 切换

建议状态：

```ts
const autoSectorGroupCheck = ref<{
  needed: boolean
  reason: 'refresh' | 'binding-switch' | 'archive-timing-switch'
  gameGuid: string
} | null>(null)

function checkAutoSectorGroupCoverageForActiveBinding(reason: AutoSectorGroupCheckReason): void
function clearAutoSectorGroupCheck(): void
```

Presenter 监听 `autoSectorGroupCheck`。当 flag 表示当前 active binding 需要计算时，presenter 调用 `runAutoGroup()`；执行完成后调用 `clearAutoSectorGroupCheck()` 清除 flag。

## Map Wrapper 设计

### 文件位置

`src/components/map/AutoSectorGroupMapPanel.vue`

该组件只负责 map 容器形态，不作为 Col 2 / Col 3 的 unit wrapper。

### Props & Emits

```ts
const props = defineProps<{
  gameGuid: string
}>()

const emit = defineEmits<{
  (e: 'select-group', sectorGroupId: string): void
  (e: 'focus-sector', sectorMacro: string): void
  (e: 'fit-sectors', sectorMacros: string[]): void
}>()
```

### Map Context 模板结构

```
<div class="auto-sector-group-map-panel">
  <!-- 完成态：不显示 tab / allocation，仅显示 Col 2 完成态 -->
  <template v-if="autoGroupConfirmed">
    <SectorConfirmBar mode="result" view="map" ... />
    <SectorGroupList
      view="map"
      :show-select-group-button="true"
      @select-group="emit('select-group', $event)"
      @focus-sector="emit('focus-sector', $event)"
      ...
    />
  </template>

  <template v-else>
    <div class="tab-bar">
      <button :class="{ active: activeTab === 'hub' }" @click="activeTab = 'hub'">
        {{ t('auto_sector.hub_tab') }}
      </button>
      <button
        :class="{ active: activeTab === 'allocation' }"
        :disabled="calculationMode === 'edit'"
        @click="activeTab = 'allocation'"
      >
        {{ t('auto_sector.allocation_tab') }}
      </button>
    </div>

    <div v-show="activeTab === 'hub'">
      <SectorConfirmBar mode="result|edit" view="map" ... />
      <SectorGroupList view="map" @focus-sector="..." ... />
    </div>

    <div v-show="activeTab === 'allocation'">
      <SectorAllocationList view="map" @focus-sector="..." ... />
      <AllocationConfirmBar ... />
    </div>
  </template>
</div>
```

### Live Context

Live 不使用 map wrapper。`SectorOverviewPanel` 保持三列布局，但通过 presenter 获取状态和动作：

```
<div class="grid grid-cols-12 gap-8">
  <div class="col-span-3"><SaveUploadPanel /> <SaveList /></div>
  <div class="col-span-5"><SectorConfirmBar mode="result|edit" view="live" /> <SectorGroupList view="live" /></div>
  <div class="col-span-4">
    <template v-if="autoGroupConfirmed">
      <EmpireWareFlowsDashboard />
    </template>
    <template v-else>
      <SectorAllocationList view="live" />
      <AllocationConfirmBar />
      <div v-if="calculationMode === 'edit'" class="allocation-overlay" />
    </template>
  </div>
</div>
```

## Tab 与完成态机制

- Tab 切换仅改变 `v-show` 显示状态，不触发数据重新计算
- `activeTab` 是 map wrapper 内部 ref，不持久化
- Map 编辑态规则：Hub tab 为编辑态时，分配方案 tab disabled，不能切换到 `SectorAllocationList`
- Live 编辑态规则：Col 3 保留 `SectorAllocationList` 内容但加遮罩层 + 禁用操作
- 完成态规则：live 与 map 都不显示 `SectorAllocationList`；map 同时不显示 tab
- 完成态下 map 在每个 group 上显示进入 station binding 的按钮，按钮图标保持原 `MapBindingSectorGroup` 图标
- 完成态下 map 不再提供旧的单 group 编辑按钮
- 分配方案 tab 中的 assignment card 选择会即时反映到 Hub tab 的 draft 中（共享 presenter 状态）

## Context 适配策略

### 子组件 view prop

所有相关子组件新增 `view: 'map' | 'live'` prop。`SectorConfirmBar` 保留现有 `mode: 'result' | 'edit'` 表示计算状态。

| 组件 | view='map' 行为 | view='live' 行为 |
|------|----------------|-----------------|
| `SectorConfirmBar` | 隐藏阈值/覆盖控件行的冗余标签，紧凑排列 | 当前样式不变 |
| `SectorGroupList` | pill 缩小 2px，行间距缩小 4px，@focus-sector emit，可显示进入 station binding 按钮 | 当前样式不变，无 focus-sector |
| `SectorAllocationList` | card 宽度自适应侧边栏，sector 名可点击聚焦 | 当前样式不变 |
| `SectorHubAddMenu` | 使用 MapBindSectorMenu（teleported popup + 定位按钮） | 当前 SectorHubAddMenu（fixed overlay） |

### 紧凑样式 Tokens

```css
/* map 模式下的紧凑变量覆盖 */
.auto-sector-group-map-panel {
  --binding-pill-height: 22px;        /* live: 26px */
  --binding-pill-gap: 4px;            /* live: 6px */
  --group-card-padding: 8px;          /* live: 12px */
  --confirm-bar-gap: 4px;             /* live: 8px */
}
```

## Focus-Sector 事件链

```
SectorGroupList pill @click.stop="emit('focus-sector', macro)"
  ↓ (仅在 view='map' 时绑定)
AutoSectorGroupMapPanel relay: emit('focus-sector', macro)
  ↓ (MapSavePanel 已有 relay)
MapWorkbenchView.onBindingFocusSector(sectorMacro)
  ↓
resolveMapSectorByMacro() + mapStore.resolveSectorByMacro()
  ↓
focusSector(sectorId)  // 平移 + 缩放动画
```

`SectorGroupList.vue` 内部已有点击 pill 的逻辑（`buildUnifiedPills()` 返回的 entries），需要新增：pill 的 `@click` handler 在 `view='map'` 时额外调用 `emit('focus-sector', entry.macro)`。

## 拖拽排序设计

### 集成方式

在 `SectorGroupList.vue`（`view='map'` 时）中包裹 group 列表：

```vue
<draggable
  v-model="presenter.autoGroupResult.groups"
  item-key="id"
  handle=".drag-handle"
  :animation="200"
>
  <template #item="{ element: group }">
    <div class="group-card">
      <div class="drag-handle">::</div>
      <!-- group pill rows -->
    </div>
  </template>
</draggable>
```

- 使用 `vuedraggable@4`（项目已有依赖，`MapBindingSectorGroup` 当前使用）
- `handle` 限制拖拽触发区域（拖拽手柄），避免与 pill 点击冲突
- `v-model` 直接绑定 `autoGroupResult.groups` 数组
- 排序仅改变数组顺序，不触发重算
- 排序权威状态是数组顺序；确认写入时按 drafts 数组顺序保存
- `order` 不作为排序依据；如保存时仍需填充兼容旧 schema，则机械写入数组 index

## Hub 添加菜单上下文切换

```ts
const hubAddMenuComponent = computed(() => {
  return view === 'map' ? MapBindSectorMenu : SectorHubAddMenu
})

const hubAddMenuProps = computed(() => {
  if (view === 'map') {
    return {
      open: showHubAddMenu.value,
      triggerEl: addHubBtnRef.value,
      filteredSaveSectors: ...,
      // MapBindSectorMenu 特有 props
    }
  }
  return {
    open: showHubAddMenu.value,
    playerSectorMacros: ...,
    // SectorHubAddMenu 特有 props
  }
})
```

两个菜单组件共享的核心逻辑（扇区过滤、已 anchor 排除、hub draft 创建）均在 presenter 中，菜单组件只负责 UI 展示和事件 emit。

## 文件影响地图

```
src/
├── components/
│   ├── empire/
│   │   ├── presenters/
│   │   │   └── useAutoSectorGroupPresenter.ts    [新增] Presenter 层
│   │   ├── sector-overview/
│   │   │   ├── SectorOverviewPanel.vue           [重构] 使用 presenter
│   │   │   ├── SectorGroupList.vue               [修改] +view prop, +draggable, +focus-sector, +select-group button
│   │   │   ├── SectorAllocationList.vue          [修改] +view prop, +focus-sector
│   │   │   ├── SectorConfirmBar.vue              [修改] +view prop
│   │   │   ├── SectorHubAddMenu.vue              [修改] +view prop 或保留不变
│   │   │   └── AllocationConfirmBar.vue          [不变]
│   │   └── LiveProductionWorkbenchView.vue       [不变或仅保持 overview mode 引用 SectorOverviewPanel]
│   ├── store/
│   │   └── useLiveProductionStore.ts             [修改] 自动分组检查 flag
│   └── map/
│       ├── AutoSectorGroupMapPanel.vue           [新增] map wrapper
│       ├── MapSavePanel.vue                      [修改] 替换 binding-sector
│       ├── MapBindingPanel.vue                   [删除] 无生产入口遗留组件
│       └── MapBindingSectorGroup.vue             [删除]
└── locales/
    ├── en.json                                   [修改] +auto_sector.hub_tab/allocation_tab
    └── zh-CN.json                                [修改] +auto_sector.hub_tab/allocation_tab
```

## 测试影响

- 新增 presenter 层后，现有 `tests/unit/auto-sector-group/autoGroup.spec.ts` 应继续通过（只测算法，不依赖 presenter）
- Map 侧后续测试文档需要覆盖：自动检查 flag、tab 状态、完成态 group 按钮、pill focus、拖拽数组顺序
- 本 change 的 implementation tasks 不包含测试编写任务
