# 数据源切换迁移路径

## 当前架构

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Components                             │
│  StationTabBar / StationPlanningPanel / Dashboard            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   useStationStore                            │
│  - getActiveContext() → empireStore.activeStation            │
│  - applyAndRecompute() → StationStateMap                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│   empireStore       │        │  StationStateMap    │
│ - activeStationId   │        │  (计算缓存单例)      │
│ - activeStation     │        │  - by stationId     │
│ - stations          │        │  - recompute()      │
│ - localStorage      │        │                     │
└─────────────────────┘        └─────────────────────┘
```

## 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Components                             │
│  StationTabBar / StationPlanningPanel / Dashboard            │
│  (无需修改，继续使用 useEmpireStore)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   useEmpireStore                             │
│  - productionSource: 'empire' | 'save-binding'               │
│  - 根据source路由到对应数据层                                 │
│  - stations / sectors / activeStation (统一接口)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│ useEmpireDataStore  │        │ useSaveBindingStore │
│ - 纯数据持久化       │        │ - binding draft     │
│ - localStorage CRUD │        │ - 派生 station views │
│ - 无业务逻辑         │        │ - dirty 管理        │
└─────────────────────┘        └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ localStorage        │
│ x4_empire_data      │
└─────────────────────┘
```

## 核心设计原则

1. **useEmpireStore 保持为"工作上下文"入口** - 其他组件无需修改
2. **useEmpireDataStore 只做持久化** - 无业务逻辑
3. **useSaveBindingStore 已有独立存储** - 只需扩展接口
4. **StationStateMap 继续共享** - 通过唯一 stationId 区分

---

## 迁移阶段

### 阶段 1: 抽取 useEmpireDataStore

**目标**: 将 empire 数据持久化逻辑从 useEmpireStore 剥离

**新建文件**: `src/store/useEmpireDataStore.ts`

```typescript
// 纯数据存储，无业务逻辑
export const useEmpireDataStore = defineStore('empireData', () => {
  const savedEmpires = ref<SavedEmpiresState>({...})
  
  // 只提供 CRUD
  function loadData(): void
  function saveToStorage(): void
  function createEmpire(name: string): EmpirePlan
  function deleteEmpire(id: string): void
  function duplicateEmpire(id: string): EmpirePlan | null
  
  // 数据访问
  const empires = computed(() => savedEmpires.value.list)
  const activeId = computed(() => savedEmpires.value.activeId)
  
  return {
    savedEmpires,
    empires,
    activeId,
    loadData,
    saveToStorage,
    createEmpire,
    deleteEmpire,
    duplicateEmpire
  }
})
```

**任务**:
1. 创建 `useEmpireDataStore.ts`
2. 迁移 localStorage 读写逻辑
3. 迁移 empire CRUD 操作
4. 更新 `useEmpireStore` 调用 `useEmpireDataStore`

---

### 阶段 2: 扩展 useSaveBindingStore

**目标**: 添加 station 操作接口，与 empireDataStore 对齐

**需要添加的方法**:
```typescript
// useSaveBindingStore.ts
function updateStationPlan(stationId: string, updates: Partial<BindingStationPlan>): void
function createStationPlan(groupId: string, name: string, type: StationType): string
function deleteStationPlan(stationId: string): void
function selectStation(stationId: string | null): void
```

**派生数据**:
```typescript
// 从 binding + archive 派生完整 station 列表
const stations = computed(() => deriveStations(binding, archive, groups))
const activeStation = computed(() => stations.value.find(s => s.id === activeStationId.value))
```

**任务**:
1. 添加 station CRUD 方法
2. 添加派生 stations computed
3. 添加 activeStationId 管理

---

### 阶段 3: 重构 useEmpireStore 为路由层

**目标**: 添加 productionSource 状态，路由到对应 store

```typescript
// useEmpireStore.ts
export const useEmpireStore = defineStore('empire', () => {
  const empireDataStore = useEmpireDataStore()
  const saveBindingStore = useSaveBindingStore()
  
  const productionSource = ref<'empire' | 'save-binding'>('empire')
  
  // 路由 computed
  const stations = computed(() => {
    if (productionSource.value === 'save-binding') {
      return saveBindingStore.derivedStations
    }
    return empireDataStore.activeEmpire?.stations || []
  })
  
  const activeStationId = computed(() => {
    if (productionSource.value === 'save-binding') {
      return saveBindingStore.activeStationId
    }
    return empireDataStore.activeStationId
  })
  
  // 路由操作
  function selectStation(id: string | null) {
    if (productionSource.value === 'save-binding') {
      saveBindingStore.selectStation(id)
    } else {
      empireDataStore.selectStation(id)
    }
  }
  
  function updateStationModules(stationId: string, modules: SavedModule[]) {
    if (productionSource.value === 'save-binding') {
      saveBindingStore.updateStationPlan(stationId, { modules })
      // 不自动保存，进入 dirty 状态
    } else {
      empireDataStore.updateStation(stationId, { modules })
      empireDataStore.saveToStorage()
    }
  }
  
  // 切换 source
  function switchToBinding(gameGuid: string) {
    if (productionSource.value === 'empire' && isDirty.value) {
      // 返回需要确认
      return { needsConfirm: true }
    }
    productionSource.value = 'save-binding'
    saveBindingStore.createOrOpenBinding(gameGuid)
    return { needsConfirm: false }
  }
  
  // ...
})
```

**任务**:
1. 添加 `productionSource` ref
2. 重构所有 computed 为路由模式
3. 重构所有操作方法为路由模式
4. 添加 `switchToBinding()` 方法
5. 处理 dirty 状态合并

---

### 阶段 4: 更新 useStationStore

**目标**: 适配 useEmpireStore 的新接口

**当前**:
```typescript
function getActiveContext() {
  const station = empireStore.activeStation
  // ...
}
```

**无需修改** - empireStore 接口不变，只是内部路由变了

**唯一需要处理的**:
- binding station 的 ID 需要能被 StationStateMap 识别
- 已在 productionSourceAdapter 中使用 `__save_binding__xxx` 前缀

---

### 阶段 5: 更新 binding 入口

**目标**: 使用新的切换方法

**MapSavePanel.vue**:
```typescript
async function proceedToBinding(payload: { guid: string; time: number | null }) {
  const result = empireStore.switchToBinding(payload.guid)
  if (result.needsConfirm) {
    // 显示确认对话框
    return
  }
  // 继续打开 binding panel
}
```

**任务**:
1. 更新 `MapSavePanel.vue` 使用 `switchToBinding()`
2. 移除 `ProductionWorkbenchView.vue` 中的手动 productionSource 切换

---

### 阶段 6: 测试与清理

**任务**:
1. 更新单元测试
2. 添加 E2E 测试验证完整切换流程
3. 移除冗余代码
4. 更新文档

---

## 关键决策

### Q1: StationStateMap 共享策略

**决策**: 共享同一个 StationStateMap 实例

**理由**:
- 已通过唯一 stationId 区分
- 计算逻辑相同
- binding station ID 前缀: `__save_binding__xxx`
- empire station ID: 原 UUID

### Q2: Binding Station 编辑持久化

**决策**: 编辑更新到 binding draft，需要显式保存

**实现**:
- `updateStationModules()` 只修改 draft
- 设置 `saveBindingStore.isDirty = true`
- 用户点击"保存绑定"才持久化

### Q3: sectors 在 binding 下的映射

**决策**: BindingSectorGroup 映射为 SectorLike

**实现**:
```typescript
const sectors = computed(() => {
  if (productionSource.value === 'save-binding') {
    return saveBindingStore.activeBinding?.groups.map(g => ({
      id: g.id,
      name: g.name,
      order: g.order
    })) || []
  }
  return empireDataStore.activeEmpire?.sectors || []
})
```

---

## 文件变更清单

### 新增文件
- `src/store/useEmpireDataStore.ts` - 纯数据持久化

### 修改文件
- `src/store/useEmpireStore.ts` - 添加 source 路由
- `src/store/useSaveBindingStore.ts` - 添加 station 操作
- `src/components/map/MapSavePanel.vue` - 使用 switchToBinding()
- `src/components/empire/ProductionWorkbenchView.vue` - 移除手动切换

### 无需修改
- `src/store/useStationStore.ts` - 接口不变
- `src/components/empire/StationTabBar.vue` - 接口不变
- `src/components/empire/StationPlanningPanel.vue` - 接口不变
- `src/store/state/StationStateMap.ts` - 共享使用

---

## 执行顺序建议

1. **阶段 1** - 先抽取数据层，不影响业务
2. **阶段 2** - 扩展 saveBindingStore，独立可测
3. **阶段 3** - 重构 useEmpireStore，最核心改动
4. **阶段 4-5** - 适配入口，验证流程
5. **阶段 6** - 测试清理