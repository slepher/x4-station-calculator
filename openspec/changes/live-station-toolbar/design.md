# LiveStationToolbar 设计文档

## Architecture

### 组件位置

`src/components/empire/context_toolbar/LiveStationToolbar.vue`

### 数据流

```
LiveProductionWorkbenchView.vue
  ↓ props
LiveStationToolbar.vue
  ↓ computed
模式状态 (local ref or from store)
  ↓ 条件渲染
三组控件
```

### Props 变更

新增 props：

| Prop | 类型 | 说明 |
|-----|------|------|
| `stationCode` | `string` | 存档 station 的 code |
| `sectorName` | `string` | 存档 sector 的 name |
| `sectorNameId` | `string \| undefined` | 存档 sector 的 nameId（用于 i18n） |
| `stationPosition` | `ArchiveStationPosition \| undefined` | 存档 station 的坐标 `{x, y, z}` |
| `sectorResources` | `string[]` | 存档 sector 的 resources 列表 |
| `sectorSunlight` | `number` | 存档 sector 的 sunlight 值 × 100 |
| `hasBindingStation` | `boolean` | 是否存在 bindingStation 规划 |
| `hasSaveStation` | `boolean` | 是否存在 saveStation 数据 |

移除 props：

| Prop | 说明 |
|-----|------|
| `station.type` | 站点类型 |
| `station.count` | 站点数量 |
| `settings.transportMinutes` | 运输时间 |

### Emits 变更

新增 emits：

| Emit | 说明 |
|-----|------|
| `toggleMode` | 模式切换事件 |

保留 emits（仅规划模式触发）：

| Emit | 说明 |
|-----|------|
| `updateRacePreference` | 更新偏好种族 |
| `updateWorkforce` | 更新工人运算 |
| `updateShowEmpireGaps` | 更新显示缺口 |

移除 emits：

| Emit | 说明 |
|-----|------|
| `updateStationType` | 站点类型 |
| `updateStationCount` | 站点数量 |
| `toggleMineral` | 星区资源选择 |
| `updateSunlight` | 光伏效率 |
| `updateTransportMinutes` | 运输时间 |

## ArchiveStationData 结构

**不直接暴露 PlayerStationEntry，转化为目标接口：**

```typescript
interface ArchiveStationData {
  // 站点标识
  code: string
  name?: string
  sectorMacro: string
  
  // 空间站坐标
  position?: {
    x: number
    y: number
    z: number
  }
  
  // 聚合星区数据（从 map sector 查询）
  sector: {
    name: string
    nameId?: string      // sector.nameId（用于 i18n）
    resources: string[]  // sector.resources
    sunlight: number     // sector.sunlight
  }
  
  // 已建成模块（存档 station.modules）
  modules: SavedModule[]
  
  // 在建信息（来自 buildstorage）
  building: {
    modules: SavedModule[]   // buildstorage.modules - station.modules（按 module_id 计算差集）
    cargo: WareAmount[]      // buildstorage.cargo（建造材料库存）
    reservation: WareAmount[] // buildstorage.reservation（在途建造材料）
  }
  
  // 站点库存
  cargo?: WareAmount[]        // station.cargo
  reservation?: WareAmount[]  // station.reservation（在途资源）
}
```

**building.modules 差集计算逻辑：**

```
buildstorage.modules: [module_id_A×2, module_id_B×1, module_id_C×3]
station.modules:      [module_id_A×2, module_id_B×1]

building.modules = 差集 = [module_id_C×3]  ← 在建中，尚未完成
```

**含义**: 建造缓存中有但站点中没有的模块 = 正在建造中的模块

## ArchiveModuleList 在建模块集成

### 当前 ArchiveModuleList 结构

```
ArchiveModuleList
  ├── 按模块分组显示已建模块
  │   └── Production 组
  │       ├── 模块A × 2
  │       └── 模块B × 1
  │   └── Storage 组
  │       └── 模块D × 1
```

### 需求：在建模块与已建模块同组显示

```
ArchiveModuleList（存档模式）
  ├── Production 组
  │   ├── 模块A × 2  ← 已建
  │   ├── 模块B × 1  ← 已建
  │   └── ╎ 模块C × 3  ← 在建（虚线 left-border）
  │   └── Storage 组
  │       └── 模块D × 1  ← 已建
```

### 实现方案

**方案 A: ArchiveModuleList 接收 buildingModules prop**

```typescript
// ArchiveModuleList.vue props
const props = defineProps<{
  modules: AggregatedStationModule[]       // 已建模块
  buildingModules?: SavedModule[]          // 在建模块（可选）
}>()
```

**分组逻辑**：
1. 已建模块按原有逻辑分组
2. 在建模块按 module_id 映射到对应分组
3. 在每个分组末尾，用虚线 left-border 区域显示该组的在建模块

**UI 样式**：
- 参考 StationPlanningPanel 的 `tier-auto` 样式：`border-l-2 border-dashed border-slate-600 pl-2`
- 在建模块区域使用相同虚线样式，但放在分组内部末尾

### StationPlanningItem 适配

在建模块使用 StationPlanningItem 组件：
- `readonly: true` - 不可编辑
- `noClick: true` - 无点击交互
- 可选：添加 `building: true` prop 用于特殊样式（如不同背景色）

## Store 新增 Getter

### useLiveProductionStore 新增两个 getter

| Getter | 返回类型 | 说明 |
|-------|---------|------|
| `getBindingStation()` | `BindingStationPlan \| null` | 当前活动站点对应的规划数据 |
| `getArchiveStation()` | `PlayerStationEntry \| null` | 当前活动站点对应的存档数据 |

**实现逻辑**:

```typescript
function getBindingStation(): BindingStationPlan | null {
  const stationId = activeStationId.value
  if (!stationId) return null
  
  const parsed = parseBindingStationId(stationId)
  if (!parsed) return null
  
  const binding = activeBinding.value
  if (!binding) return null
  
  // 通过 plan.id 或 saveStationCode 查找
  return binding.stationPlans.find(plan => 
    plan.id === parsed.planId || plan.saveStationCode === parsed.saveStationCode
  ) || null
}

function getArchiveStation(): PlayerStationEntry | null {
  const stationId = activeStationId.value
  if (!stationId) return null
  
  const parsed = parseBindingStationId(stationId)
  if (!parsed || parsed.kind !== 'derived') return null
  
  const code = parsed.saveStationCode
  const record = playerStationRecords.value.find(r => r.code === code && r.type === 'station')
  return record?.data as PlayerStationEntry || null
}
```

**数据流**:

```
LiveProductionWorkbenchView.vue
  ↓ 调用 liveStore.getBindingStation()
  ↓ 调用 liveStore.getArchiveStation()
  ↓ 计算属性
props 数据传递给 LiveStationToolbar
```

### Getter 与 Props 映射

| Toolbar Prop | 数据来源 |
|-------------|---------|
| `hasBindingStation` | `getBindingStation() !== null` |
| `hasSaveStation` | `getArchiveStation() !== null` |
| `stationCode` | `getArchiveStation()?.code` |
| `sectorName` | `getArchiveStation()?.sector.name` |
| `sectorNameId` | `getArchiveStation()?.sector.nameId` |
| `stationPosition` | `getArchiveStation()?.position` |
| `sectorResources` | `getArchiveStation()?.sector.resources` |
| `sectorSunlight` | `Math.round(getArchiveStation()?.sector.sunlight * 100)` |

### Sector 数据查询

需要从 map 数据中查询 sector 的 resources 和 sunlight：

```typescript
// 在 LiveProductionWorkbenchView 或 helper 函数中
function getSectorResources(sectorMacro: string | undefined): string[] {
  if (!sectorMacro) return []
  const sector = gameData.sectorsMap[sectorMacro]
  return sector?.resources || []
}

function getSectorSunlight(sectorMacro: string | undefined): number {
  if (!sectorMacro) return 100
  const sector = gameData.sectorsMap[sectorMacro]
  return sector?.sunlight ?? 100
}
```

## Decisions

### 1. 模式状态管理

**决策**: 模式状态存储在组件内部 `ref`，不依赖 store。

**原因**:
- 模式切换仅影响 toolbar UI 显示，不影响 store 数据
- 切换后规划控件的编辑操作仍通过 emits 传递到 store
- 简化实现，避免引入额外的 store 状态

### 2. 初始模式计算

**决策**: 通过 `hasBindingStation` 和 `hasSaveStation` props 计算初始模式。

```typescript
const initialMode = computed(() => {
  if (props.hasBindingStation && props.hasSaveStation) return 'planning'
  if (props.hasBindingStation && !props.hasSaveStation) return 'planning'
  if (!props.hasBindingStation && props.hasSaveStation) return 'live'
  return 'planning' // fallback
})

const canToggle = computed(() => {
  return props.hasBindingStation && props.hasSaveStation
    || !props.hasBindingStation && props.hasSaveStation
})
```

### 3. 星区资源 Popover

**决策**: 使用只读 popover 展示资源列表，无 checkbox。

**原因**:
- 资源来源于存档 sector，不可修改
- 与 Blueprint toolbar 的可编辑 popover 区分
- 样式使用灰色背景表示只读状态

### 4. 光伏效率展示

**决策**: 使用静态数值展示，无输入控件。显示百分比格式（原始值 × 100）。

**原因**:
- 光伏效率来源于存档 sector.sunlight（0-1 范围）
- 存档中的光照是固定值，不可修改
- 百分比格式更直观（如 13% 而非 0.13）
- 样式使用 count-pill 样式（静态文本容器）

### 5. 星区名称与坐标展示

**决策**: 新增星区字段，点击弹出坐标 popover。

**原因**:
- 星区名称支持 i18n（通过 sector.nameId）
- 坐标来源于 station.relative_position
- popover 展示 `(x, y, z)` 格式坐标

**改进（2026-04-16）**: 坐标改为 X/Y/Z 分行显示，单位从 m 转为 km。

**坐标格式规则**:
- 整数 km 取整（如 `0` km）
- 浮点 km 取1位小数（如 `67.5` km, `81.3` km）
- 示例：`{ x: 67524, y: 0, z: 81288 }` m → `X: 67.5 km, Y: 0 km, Z: 81.3 km`

### 5b. bindingStation 数据源补充（2026-04-16）

**问题**: `LiveStationToolbar` 只从 `archiveStation` 获取数据，bindingStation（无对应 save archive）的 sector/sunlight/resources/position 显示为空。

**决策**: 添加 `bindingSectorData` computed 作为备选数据源。

**数据流**:
```
archiveStation?.sector     ←── 优先（有 save archive）
        ↓ (fallback)
bindingSectorData          ←── 备选（仅 bindingStation）
    ↑
gameData.maps.sectors[plan.sectorMacro]
```

**computed 双源逻辑**:
| Prop | archiveStation 优先 | bindingSectorData 备选 |
|-----|---------------------|----------------------|
| `sectorSunlight` | `Math.round(sector.sunlight * 100)` | `Math.round(bindingSectorData.sunlight * 100)` |
| `sectorName` | `sector.name` | `bindingSectorData.name` |
| `sectorNameId` | `sector.nameId` | `bindingSectorData.nameId` |
| `stationPosition` | `archiveStation.position` | `bindingStation.position` |
| `sectorResources` | `sector.resources` (检查 `.length`) | `bindingSectorData.resources` |

**关键点**: `sectorResources` 需检查 `.length`，因为空数组 `[]` 也是 truthy。

### 5c. 资源 popover 改进（2026-04-16）

**决策**: 资源 popover 移除高度限制，资源名称支持 i18n 翻译。

**原因**:
- 原有 `max-h-48` 高度限制会截断长列表
- 资源 ID 如 `helium` 需翻译为中文 `氦`

**实现**:
- CSS: `.popover-content.resources-list { max-h-none; overflow-visible; }`
- JS: 添加 `getResourceName(wareId)` 函数，从 `waresMap[wareId]` 获取 ware 对象，调用 `translateWare(ware)`

### 6. 规划控件条件渲染

**决策**: 使用 `v-if="mode === 'planning'"` 控制显示。

**原因**:
- 实时模式下隐藏规划控件，避免用户误操作
- 规划模式下正常显示和编辑
- 减少界面复杂度

## File Changes

### 新增文件

无

### 修改文件

| 文件 | 变更 |
|-----|------|
| `src/components/empire/context_toolbar/LiveStationToolbar.vue` | 重构 props/emits、UI 结构、模式切换逻辑 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | 传递新 props（stationCode, sectorResources, sectorSunlight, hasBindingStation, hasSaveStation） |

### 删除代码

- 移除站点类型、站点数量、运输时间相关代码
- 移除星区资源 checkbox popover
- 移除光伏效率输入控件
- 移除 liveData popover 相关代码（后续功能）

## Phase 11: Toolbar Presenter 统一化（Station + Transit）

### 背景

TransitToolbar 需要显示扇区信息（星区名称、资源、光伏效率），但之前没有统一的数据获取路径。StationToolbar 通过 `stationContext` computed 获取，TransitToolbar 缺少对应机制。

### 决策：Contract 扩展而非独立 Context

**问题**: TransitToolbar 是否应该有独立的 `transitHubContext` computed？

**决策**: 扩展 `ProductionWorkbenchContract` 和 `useProductionToolbarPresenter`，提供统一的 context 方法，内部根据 `getWorkbenchMode()` 自动返回 station/transit 对应数据。

**原因**:
- 避免为每个 context 类型（station/transit/overview）创建独立 computed
- Presenter 层统一接口，View 层简化调用
- 符合 DRY 原则

### Contract 新增方法

| 方法 | 返回类型 | Station 数据源 | Transit 数据源 |
|------|---------|---------------|---------------|
| `getToolbarStationCode()` | `string` | `stationContext.stationCode` | `transitHubContext.tradeStationCode` |
| `getToolbarSectorName()` | `string` | `stationContext.sectorName` | `transitHubContext.sectorName` |
| `getToolbarSectorNameId()` | `string \| undefined` | `stationContext.sectorNameId` | `transitHubContext.sectorNameId` |
| `getToolbarStationPosition()` | `{x,y,z} \| undefined` | `stationContext.position` | `transitHubContext.position` |
| `getToolbarSectorResources()` | `string[]` | `stationContext.sectorResources` | `transitHubContext.sectorResources` |
| `getToolbarSectorSunlight()` | `number` | `stationContext.sectorSunlight` | `transitHubContext.sectorSunlight` |

### Presenter Props 映射

```typescript
// useProductionToolbarPresenter.ts
const props = {
  stationCode: computed(() => store.getToolbarStationCode()),
  sectorName: computed(() => store.getToolbarSectorName()),
  sectorNameId: computed(() => store.getToolbarSectorNameId()),
  stationPosition: computed(() => store.getToolbarStationPosition()),
  sectorResources: computed(() => store.getToolbarSectorResources()),
  sectorSunlight: computed(() => store.getToolbarSectorSunlight()),
}
```

### TransitToolbar 对齐 StationToolbar

**结构对齐**:

| Section | Station | Transit |
|---------|---------|---------|
| Section 1 | 名称 + 代码 + 模式 | 名称 + trade station 代码 + 模式 |
| Sep 1 | ✓ | ✓ |
| Section 2 | 星区 + popover + 资源 + popover + 光伏 + 吞吐 | 星区 + popover + 资源 + popover + 光伏 + 吞吐 |
| Sep 2 | ✓ (仅 planning) | ✓ (仅 planning) |
| 种族偏好 | ✓ (仅 planning) | ✓ (仅 planning) |

**移除元素**: TransitToolbar 移除导入按钮（transit hub 不需要导入功能）

**样式对齐**:
- toggle-chip + emoji（📝 规划 / 📡 实时）
- 颜色：visualMode 决定（planning=amber, live=sky）

### transitHubContext 扩展

**新增字段**:

```typescript
interface TransitHubContext {
  // 已有字段
  sectorId: string
  hasArchiveTradeStation: boolean
  tradeStationCode: string
  archiveModules: SavedModule[]
  buildingModules: SavedModule[]
  modeBehavior: 'full-switch' | 'wareflow-only'
  
  // 新增扇区字段
  sectorName: string
  sectorNameId?: string
  sectorResources: string[]
  sectorSunlight: number
  position?: { x, y, z }
}
```

**数据获取**:

```
transitHubContext
    ↓
group.sectorMacro  ←── 从 BindingSectorGroup 获取
    ↓
gameData.maps.sectors[sectorMacro]
    ↓
sectorData.area.sunlight → sectorSunlight (×100)
sectorData.resources → sectorResources
sectorData.name → sectorName
sectorData.nameId → sectorNameId
```

**关键修复**: 使用 `group.sectorMacro` 而非 `sectorId`（binding group ID ≠ sector macro）

### Station 数据获取对比

| 项目 | 之前 | 现在 |
|------|------|------|
| Station 数据 | `stationContext` computed → View props | `toolbarPresenter.props.stationCode` |
| Transit 数据 | 无 | `toolbarPresenter.props.stationCode` (同一接口) |
| View 层 computed | 多个独立 computed | 移除，使用 presenter |

**本质**: Station 只是换了路径，Transit 是新增功能。

### E2E 测试验证

新增测试验证 transit hub 扇区信息：

| 测试 | 验证内容 | 期望值 |
|------|----------|--------|
| 日照效率 | 阿尔忒弥斯的朦胧 sunlight | 141%（`sunlight=1.41`） |
| 资源数量 | 该星区资源 | > 0（hydrogen 等） |
| 星区 popover | 点击显示名称 | 正确名称，非 "-" |

### File Changes (Phase 11)

| 文件 | 变更 |
|-----|------|
| `src/types/production-workbench-contract.ts` | 新增 6 个 toolbar 方法定义 |
| `src/components/empire/presenters/useProductionToolbarPresenter.ts` | 新增 6 个 props |
| `src/store/useLiveProductionStore.ts` | 实现 6 个 toolbar 方法 + transitHubContext 扩展 |
| `src/store/useBlueprintProductionStore.ts` | 同步实现 6 个 toolbar 方法 |
| `src/components/empire/LiveProductionWorkbenchView.vue` | 移除重复 computed，统一使用 toolbarPresenter |
| `src/components/empire/context_toolbar/LiveTransitToolbar.vue` | 结构对齐 StationToolbar |
| `tests/e2e/live-flow-map/live-flow-map.spec.ts` | 新增扇区信息验证测试 |