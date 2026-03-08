# 飞船蓝图预载入需求 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在飞船配装页面提供可直接载入的预制蓝图（空配/低配/中配/高配），统一蓝图状态显示与交互。

**Architecture:**
- 预制蓝图在 store 中动态生成，不持久化存储
- 新增 `presetType` 字段区分预制类型
- 新增 BlueprintDropdown 组件替代现有 LoadShipBlueprintModal 的部分功能

**Tech Stack:** Vue 3, TypeScript, Pinia, Tailwind CSS

---

## Task 1: 扩展 ShipBlueprint 类型定义

**Files:**
- Modify: `src/types/x4.ts`

**Step 1: 添加 presetType 字段到 ShipBlueprint 接口**

在 `ShipBlueprint` 接口中添加可选的 `presetType` 字段：

```typescript
// 在 ShipBlueprint 接口中添加（约第82行附近）
presetType?: 'empty' | 'low' | 'medium' | 'high'
```

**Step 2: 提交**

```bash
git add src/types/x4.ts
git commit -m "feat(ship-build): add presetType field to ShipBlueprint"
```

---

## Task 2: 创建预制蓝图生成逻辑

**Files:**
- Create: `src/store/logic/blueprintPresets.ts`

**Step 1: 创建预制生成逻辑文件**

```typescript
// src/store/logic/blueprintPresets.ts
import type { X4Ship, X4Equipment, ShipBlueprint, ShipBlueprintConnection, ShipBlueprintGroup, ShipBlueprintStorage } from '@/types/x4'

export type PresetType = 'empty' | 'low' | 'medium' | 'high'

// 引擎优先级映射
const ENGINE_PRIORITY: Record<string, string[]> = {
  fight: ['combat', 'thruster', 'cruise'],
  default: ['cruise', 'thruster', 'combat']
}

// 预制槽位装配
export function generatePresetBlueprint(
  ship: X4Ship,
  presetType: PresetType,
  equipmentMap: Map<string, X4Equipment>
): ShipBlueprint {
  const blueprint: ShipBlueprint = {
    id: '',
    name: '',
    shipId: ship.id,
    connections: [],
    storage: { deployables: [], countermeasure: null, drones: [], missiles: [] },
    lastUpdated: Date.now(),
    presetType
  }

  if (presetType === 'empty') {
    return blueprint
  }

  // 按 ship.purposePrimary 确定引擎优先级
  const purposePrimary = (ship as any).purposePrimary || ''
  const enginePriority = purposePrimary === 'fight' ? ENGINE_PRIORITY.fight : ENGINE_PRIORITY.default

  // 处理每个槽位
  ship.slots.forEach((slot) => {
    const connection: ShipBlueprintConnection = {
      slot_type: slot.type,
      group: []
    }

    slot.groups.forEach((group) => {
      if (!group.connection) return

      const equipmentId = selectEquipmentForSlot(
        slot.type,
        group.connection.size || 'medium',
        group.connection.tags || [],
        ship.race,
        presetType,
        equipmentMap,
        enginePriority,
        purposePrimary === 'mine'
      )

      if (equipmentId) {
        connection.group.push({
          group: group.group,
          equipment_id: equipmentId,
          count: group.connection.count || 1
        })
      }
    })

    if (connection.group.length > 0) {
      blueprint.connections.push(connection)
    }
  })

  // 处理 U 槽无人机
  blueprint.storage = generateStoragePreset(ship, equipmentMap)

  return blueprint
}

function selectEquipmentForSlot(
  slotType: string,
  size: string,
  tags: string[],
  shipRace: string,
  presetType: PresetType,
  equipmentMap: Map<string, X4Equipment>,
  enginePriority: string[],
  isMiningShip: boolean
): string | null {
  // 筛选可用装备
  const candidates = Array.from(equipmentMap.values()).filter(eq => {
    if (eq.noplayerblueprint) return false
    if (eq.type !== slotType) return false
    if (eq.size !== size) return false
    return true
  })

  if (candidates.length === 0) return null

  // 采矿炮塔：优先带 mine/mining 标签
  if (slotType === 'turret' && isMiningShip) {
    const miningCandidates = candidates.filter(eq => {
      const eqTags = (eq.slotTags as string[]) || []
      return eqTags.some(t => t === 'mine' || t === 'mining')
    })
    if (miningCandidates.length > 0) {
      return selectByMk(miningCandidates, presetType)
    }
  }

  // 引擎：按优先级选择
  if (slotType === 'engine') {
    const sorted = [...candidates].sort((a, b) => {
      const aIdx = enginePriority.indexOf(a.id.includes('combat') ? 'combat' : a.id.includes('cruise') ? 'cruise' : 'thruster')
      const bIdx = enginePriority.indexOf(b.id.includes('combat') ? 'combat' : b.id.includes('cruise') ? 'cruise' : 'thruster')
      return aIdx - bIdx
    })
    return sorted[0]?.id || null
  }

  // 按种族筛选
  const raceMatch = candidates.filter(eq => !eq.race || eq.race === shipRace)
  const fallback = candidates.filter(eq => !eq.race)
  const pool = raceMatch.length > 0 ? raceMatch : fallback

  return selectByMk(pool, presetType)
}

function selectByMk(equipment: X4Equipment[], presetType: PresetType): string | null {
  if (equipment.length === 0) return null

  const sorted = [...equipment].sort((a, b) => {
    const aMk = a.mk || 0
    const bMk = b.mk || 0
    if (presetType === 'low') return bMk - aMk  // MK1 优先 -> 降序
    if (presetType === 'medium') {
      // MK2 优先，缺失时回退 MK1
      if (aMk === 2 && bMk !== 2) return -1
      if (bMk === 2 && aMk !== 2) return 1
      return bMk - aMk
    }
    if (presetType === 'high') return bMk - aMk  // 最高 MK
    return 0
  })

  return sorted[0]?.id || null
}

function generateStoragePreset(ship: X4Ship, equipmentMap: Map<string, X4Equipment>): ShipBlueprintStorage {
  const storage: ShipBlueprintStorage = {
    deployables: [],
    countermeasure: null,
    drones: [],
    missiles: []
  }

  const purposePrimary = (ship as any).purposePrimary || ''
  const isXL = ship.class === 'ship_xl'
  const isL = ship.class === 'ship_l'

  // 查找可用无人机
  const transportDrone = Array.from(equipmentMap.values()).find(eq =>
    eq.type === 'drone' && eq.id.includes('transport')
  )
  const miningDrone = Array.from(equipmentMap.values()).find(eq =>
    eq.type === 'drone' && (eq.id.includes('mining') || eq.slotTags?.includes('mine'))
  )
  const buildDrone = Array.from(equipmentMap.values()).find(eq =>
    eq.type === 'drone' && eq.id.includes('build')
  )
  const combatDrone = Array.from(equipmentMap.values()).find(eq =>
    eq.type === 'drone' && eq.id.includes('combat')
  )

  if ((isXL || isL) && purposePrimary === 'mine') {
    // L/XL 采矿船：1 运输 + 9 采矿
    if (transportDrone) storage.drones.push({ id: transportDrone.id, count: 1 })
    if (miningDrone) storage.drones.push({ id: miningDrone.id, count: 9 })
  } else if (purposePrimary === 'trade') {
    // 运输向
    if (transportDrone) storage.drones.push({ id: transportDrone.id, count: 10 })
  } else if (purposePrimary === 'build') {
    // 建造向
    if (buildDrone) storage.drones.push({ id: buildDrone.id, count: 10 })
  } else {
    // 其他：防御无人机
    if (combatDrone) storage.drones.push({ id: combatDrone.id, count: 10 })
  }

  return storage
}

export function generateAllPresets(
  ship: X4Ship,
  equipmentMap: Map<string, X4Equipment>
): Array<{ presetType: PresetType; blueprint: ShipBlueprint }> {
  const presets: Array<{ presetType: PresetType; blueprint: ShipBlueprint }> = []

  for (const type of (['empty', 'low', 'medium', 'high'] as PresetType[])) {
    presets.push({
      presetType: type,
      blueprint: generatePresetBlueprint(ship, type, equipmentMap)
    })
  }

  return presets
}
```

**Step 2: 提交**

```bash
git add src/store/logic/blueprintPresets.ts
git commit -m "feat(ship-build): add blueprint preset generation logic"
```

---

## Task 3: 扩展 useShipBuildStore

**Files:**
- Modify: `src/store/useShipBuildStore.ts`

**Step 1: 添加预制蓝图相关状态和方法**

在 store 中添加：

```typescript
// 在文件顶部导入
import { generateAllPresets, type PresetType } from './logic/blueprintPresets'

// 在 ref 定义后添加
const currentPresetType = ref<PresetType | null>(null)

// 添加 computed
const presetBlueprints = computed(() => {
  const shipId = resolveCurrentShipId()
  if (!shipId) return []
  const ship = findShip(shipId)
  if (!ship) return []
  return generateAllPresets(ship, equipmentMap)
})

const currentBlueprintDisplayName = computed(() => {
  const bp = blueprint.value
  if (!bp) return ''

  // 有预制类型：显示预制名
  if (bp.presetType) {
    return bp.presetType
  }

  // 无预制类型且名称为空：显示"自定义"
  if (!bp.name) {
    return 'custom'
  }

  return bp.name
})

// 添加 loadPreset 方法
const loadPreset = (presetType: PresetType) => {
  const shipId = resolveCurrentShipId()
  if (!shipId) return

  const presets = presetBlueprints.value
  const preset = presets.find(p => p.presetType === presetType)
  if (!preset) return

  const loadedBlueprint = JSON.parse(JSON.stringify(preset.blueprint)) as ShipBlueprint
  blueprint.value = loadedBlueprint
  currentPresetType.value = presetType
  savedBlueprints.value.activeShipId = shipId
  savedBlueprints.value.activeBlueprintId = null

  // 刚载入预制时，takeSnapshot 使 isDirty 为 true 但不显示红点
  takeSnapshot()
}

// 添加修改追踪
// 需要修改 isDirty 的计算逻辑

// 在 return 中添加新状态和方法
return {
  // ... existing
  currentPresetType,
  presetBlueprints,
  currentBlueprintDisplayName,
  loadPreset
}
```

**Step 2: 修改 isDirty 逻辑以支持红点规则**

现有 isDirty 计算属性需要增加"是否显示红点"的区分：

```typescript
// 新增 computed
const showDirtyDot = computed(() => {
  if (!isDirty.value) return false

  const bp = blueprint.value
  if (!bp) return false

  // 刚载入预制时不显示红点
  if (bp.presetType) {
    // 检查是否发生过装备变更（通过对比 snapshot）
    const shipId = resolveCurrentShipId()
    const snapshot = lastSavedSnapshot.value
    if (!snapshot) return false

    const parsed = JSON.parse(snapshot)
    const snapshotBlueprint = parsed.blueprint as ShipBlueprint

    // 比较 connections 和 storage
    const currentConnections = JSON.stringify(bp.connections)
    const snapshotConnections = JSON.stringify(snapshotBlueprint?.connections || [])
    const currentStorage = JSON.stringify(bp.storage)
    const snapshotStorage = JSON.stringify(snapshotBlueprint?.storage || EMPTY_SHIP_STORAGE)

    // 如果完全相同，说明只是刚载入，未修改
    return currentConnections !== snapshotConnections || currentStorage !== snapshotStorage
  }

  // 已保存蓝图修改后显示红点
  return true
})
```

**Step 3: 提交**

```bash
git add src/store/useShipBuildStore.ts
git commit -m "feat(ship-build): add preset blueprint support to store"
```

---

## Task 4: 创建 BlueprintDropdown 组件

**Files:**
- Create: `src/components/ship-build/BlueprintDropdown.vue`

**Step 1: 创建蓝图下拉组件**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { PresetType } from '@/store/logic/blueprintPresets'

const { t } = useI18n()
const store = useShipBuildStore()

const isOpen = ref(false)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const close = () => {
  isOpen.value = false
}

const displayName = computed(() => store.currentBlueprintDisplayName)
const showDirtyDot = computed(() => (store as any).showDirtyDot)
const savedBlueprints = computed(() => store.getBlueprintsForShip(store.resolveCurrentShipId()))
const activeBlueprintId = computed(() => store.savedBlueprints.activeBlueprintId)

const handleSelectPreset = (presetType: PresetType) => {
  store.loadPreset(presetType)
  close()
}

const handleSelectSaved = (id: string) => {
  store.loadBlueprint(id)
  close()
}

const handleDelete = (id: string, e: Event) => {
  e.stopPropagation()
  if (confirm(t('shipBuild.confirm_delete_blueprint'))) {
    store.deleteBlueprint(id)
    // 如果删除的是当前正在使用的，关闭下拉
    if (activeBlueprintId.value === id) {
      close()
    }
  }
}

const getPresetLabel = (type: PresetType): string => {
  return t(`ship_build.preset.${type}`)
}
</script>

<template>
  <div class="relative">
    <button
      class="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
      @click="toggle"
    >
      <span class="text-white">{{ displayName || t('ship_build.preset.empty') }}</span>
      <svg v-if="showDirtyDot" class="w-2 h-2 rounded-full bg-red-500" />
      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50"
    >
      <!-- 预制蓝图 -->
      <div class="border-b border-slate-700">
        <div class="px-3 py-2 text-xs text-slate-500 uppercase">
          {{ t('ship_build.preset_title') }}
        </div>
        <button
          v-for="preset in store.presetBlueprints"
          :key="preset.presetType"
          class="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center justify-between"
          @click="handleSelectPreset(preset.presetType)"
        >
          <span>{{ getPresetLabel(preset.presetType) }}</span>
        </button>
      </div>

      <!-- 已保存蓝图 -->
      <div v-if="savedBlueprints.length > 0">
        <div class="px-3 py-2 text-xs text-slate-500 uppercase">
          {{ t('ship_build.saved_blueprints') }}
        </div>
        <div
          v-for="bp in savedBlueprints"
          :key="bp.id"
          class="group px-3 py-2 hover:bg-slate-700 flex items-center justify-between cursor-pointer"
          :class="{ 'bg-green-900/30': bp.id === activeBlueprintId }"
          @click="handleSelectSaved(bp.id)"
        >
          <span>{{ bp.name || t('ship_build.blueprint_custom') }}</span>
          <button
            class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
            @click="handleDelete(bp.id, $event)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 点击外部关闭 -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="close" />
  </div>
</template>
```

**Step 2: 提交**

```bash
git add src/components/ship-build/BlueprintDropdown.vue
git commit -m "feat(ship-build): add BlueprintDropdown component"
```

---

## Task 5: 修改 ShipBuildWorkspaceView 添加顶部栏

**Files:**
- Modify: `src/components/ship-build/ShipBuildWorkspaceView.vue`

**Step 1: 添加顶部栏**

在模板开头添加顶部栏控件：

```vue
<script setup>
// 现有代码...
import BlueprintDropdown from './BlueprintDropdown.vue'

// 新增
const shipBuildStore = useShipBuildStore()
const { selectedShip, blueprint } = storeToRefs(shipBuildStore)
const { enterShipSelector } = shipBuildStore
</script>

<template>
  <!-- 新增顶部栏 -->
  <div class="flex items-center justify-between mb-6">
    <!-- 左侧：飞船名称 + 更换按钮 -->
    <div
      class="group flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors"
      @click="enterShipSelector"
    >
      <span class="text-lg font-medium text-white">
        {{ selectedShip ? translateShip(selectedShip) : '' }}
      </span>
      <span class="text-slate-400">|</span>
      <button class="text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {{ t('ship_build.change_ship') }}
      </button>
    </div>

    <!-- 右侧：蓝图选择下拉 -->
    <BlueprintDropdown />
  </div>

  <!-- 现有配装面板 -->
  <div v-if="selectedShip" ...>
```

**Step 2: 提交**

```bash
git add src/components/ship-build/ShipBuildWorkspaceView.vue
git commit -m "feat(ship-build): add top bar with ship name and blueprint dropdown"
```

---

## Task 6: 更新 i18n 文案

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh-CN.json`

**Step 1: 添加预制相关文案**

在 `ship_build` 下添加：

```json
{
  "preset": {
    "empty": "Empty",
    "low": "Low",
    "medium": "Medium",
    "high": "High"
  },
  "preset_title": "Presets",
  "saved_blueprints": "Saved",
  "blueprint_custom": "Custom"
}
```

中文：

```json
{
  "preset": {
    "empty": "空配",
    "low": "低配",
    "medium": "中配",
    "high": "高配"
  },
  "preset_title": "预制",
  "saved_blueprints": "已保存",
  "blueprint_custom": "自定义"
}
```

**Step 2: 提交**

```bash
git add src/locales/en.json src/locales/zh-CN.json
git commit -m "feat(i18n): add preset blueprint translations"
```

---

## Task 7: 隐藏 Ship 界面的加载按钮

**Files:**
- Modify: `src/components/StationToolbar.vue`

**Step 1: 隐藏 ship-build 视图的加载按钮**

在模板中找到加载按钮，添加条件：

```vue
<button
  v-if="!isShipBuildView"
  :class="['btn-tool', themeColors.secondary]"
  :disabled="isShipActionDisabled"
  @click="handleLoad"
>
```

**Step 2: 提交**

```bash
git add src/components/StationToolbar.vue
git commit -m "feat(ship-build): hide load button in ship-build view"
```

---

## Task 8: 修改 LoadShipBlueprintModal 支持预制显示

**Files:**
- Modify: `src/components/LoadShipBlueprintModal.vue`

**Step 1: 添加预制卡片显示**

在模态框中添加预制项显示（紧凑三行结构）：

```typescript
// 添加预制数据
import { generateAllPresets } from '@/store/logic/blueprintPresets'

const presets = computed(() => {
  const shipId = currentShipId.value
  if (!shipId) return []
  const ship = store.findShip(shipId)
  if (!ship) return []
  return generateAllPresets(ship, store.equipmentMap)
})

const handleLoadPreset = (presetType: string) => {
  if (store.isDirty && store.blueprint) {
    if (!confirm(t('shipBuild.confirm_load_with_unsaved'))) {
      return
    }
  }
  store.loadPreset(presetType as any)
  emit('close')
}
```

**Step 2: 提交**

```bash
git add src/components/LoadShipBlueprintModal.vue
git commit -m "feat(ship-build): add preset display to LoadShipBlueprintModal"
```

---

## Task 9: 测试与验证

**Step 1: 运行开发服务器**

```bash
pnpm run dev
```

**Step 2: 验证功能**
- 进入 Ship Build 界面
- 选择一艘飞船
- 验证预制蓝图下拉显示 4 个选项
- 验证点击预制可以正确加载装备
- 验证修改装备后显示红点
- 验证保存后红点消失
- 验证可以保存和删除已保存蓝图

**Step 3: 运行单元测试**

```bash
pnpm run test:unit
```

**Step 4: 运行 E2E 测试**

```bash
pnpm run test:e2e
```

---

## 计划完成

**Plan complete and saved to `docs/plans/2026-03-08-blueprint-preset-design.md`.**

### Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
