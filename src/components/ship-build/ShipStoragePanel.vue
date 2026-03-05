<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { X4Ship, ShipBlueprintStorage } from '@/types/x4'
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'
import consumablesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'
import dronesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/drones.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

const { t } = useI18n()
const { translate } = useX4I18n()
const store = useShipBuildStore()

const props = defineProps<{
  selectedShip: X4Ship | null
  slotType: 'consumables' | 'units'
}>()

// Get candidate items based on slot type
const deployableItems = computed(() => {
  return consumablesRaw.filter((item: any) => item.deployable === true)
})

const countermeasureItems = computed(() => {
  return consumablesRaw.filter((item: any) => item.class === 'countermeasure')
})

const droneItems = computed(() => {
  const shipDroneTags = props.selectedShip?.droneTags || []

  // Filter drones based on matching rules
  const matched = (dronesRaw as any[]).filter((drone) => {
    const droneNoBlueprint = drone.noplayerblueprint === true
    const droneTags = drone.tags || []

    // First filter: noplayerblueprint=false
    if (droneNoBlueprint) return false

    // If ship droneTags is empty, match all drones with empty tags
    if (shipDroneTags.length === 0) {
      return droneTags.length === 0
    }

    // If ship droneTags is non-empty, match drones with all tags included OR empty tags
    const hasMatchingTag = shipDroneTags.length > 0 && shipDroneTags.every((tag: string) => droneTags.includes(tag))
    return hasMatchingTag || droneTags.length === 0
  })

  // Return matched drones (max 10 to avoid too many options)
  return matched.slice(0, 10)
})

const missileItems = computed(() => {
  return missilesRaw.slice(0, 3)
})

// Storage limits from ship
const deployableLimit = computed(() => props.selectedShip?.storage?.deployable || 0)
const countermeasureLimit = computed(() => props.selectedShip?.storage?.countermeasure || 0)
const unitLimit = computed(() => props.selectedShip?.storage?.unit || 0)
const missileLimit = 20

// Current storage state from blueprint
const currentStorage = computed(() => {
  const bp = store.blueprint
  return bp?.storage || {
    deployables: [],
    countermeasure: null,
    drones: [],
    missiles: []
  }
})

// Local state for sliders
const localDeployables = ref<Record<string, number>>({})
const localCountermeasure = ref<number>(0)
const localDrones = ref<Record<string, number>>({})
const localMissiles = ref<Record<string, number>>({})

// Initialize from blueprint
const initFromBlueprint = () => {
  const storage = currentStorage.value

  // Initialize deployables
  localDeployables.value = {}
  deployableItems.value.forEach((item: any) => {
    const saved = storage.deployables.find(d => d.id === item.id)
    localDeployables.value[item.id] = saved?.count || 0
  })

  // Initialize countermeasure
  if (storage.countermeasure) {
    localCountermeasure.value = storage.countermeasure.count
  }

  // Initialize drones
  localDrones.value = {}
  droneItems.value.forEach((item: any) => {
    const saved = storage.drones.find(d => d.id === item.id)
    localDrones.value[item.id] = saved?.count || 0
  })

  // Initialize missiles
  localMissiles.value = {}
  missileItems.value.forEach((item: any) => {
    const saved = storage.missiles.find(m => m.id === item.id)
    localMissiles.value[item.id] = saved?.count || 0
  })
}

// Watch for blueprint changes
watch(() => store.blueprint, initFromBlueprint, { immediate: true })

// Calculate totals
const deployableTotal = computed(() => {
  return Object.values(localDeployables.value).reduce((sum, count) => sum + count, 0)
})

const droneTotal = computed(() => {
  return Object.values(localDrones.value).reduce((sum, count) => sum + count, 0)
})

// Get drag max (total limit minus other items)
const getDeployableDragMax = (excludeId?: string) => {
  const used = Object.entries(localDeployables.value)
    .filter(([id]) => id !== excludeId)
    .reduce((sum, [_, count]) => sum + count, 0)
  return Math.max(0, deployableLimit.value - used)
}

const getDroneDragMax = (excludeId?: string) => {
  const used = Object.entries(localDrones.value)
    .filter(([id]) => id !== excludeId)
    .reduce((sum, [_, count]) => sum + count, 0)
  return Math.max(0, unitLimit.value - used)
}

// Save to blueprint
const saveToBlueprint = () => {
  const storage: ShipBlueprintStorage = {
    deployables: Object.entries(localDeployables.value)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        name: '',
        count
      })),
    countermeasure: localCountermeasure.value > 0 ? {
      id: countermeasureItems.value[0]?.id || '',
      name: '',
      count: localCountermeasure.value
    } : null,
    drones: Object.entries(localDrones.value)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        name: '',
        count
      })),
    missiles: Object.entries(localMissiles.value)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        name: '',
        count
      }))
  }

  store.updateBlueprintStorage(storage)
}

// Handle deployable slider change
const handleDeployableChange = (id: string, value: number) => {
  localDeployables.value[id] = value
  saveToBlueprint()
}

// Handle countermeasure slider change
const handleCountermeasureChange = (value: number) => {
  localCountermeasure.value = value
  saveToBlueprint()
}

// Handle drone slider change
const handleDroneChange = (id: string, value: number) => {
  localDrones.value[id] = value
  saveToBlueprint()
}

// Handle missile slider change
const handleMissileChange = (id: string, value: number) => {
  localMissiles.value[id] = value
  saveToBlueprint()
}

// Get item name using translate
const getItemName = (item: any) => {
  return translate(item.id, item.nameId, 'ware')
}
</script>

<template>
  <div class="ship-storage-panel" data-testid="ship-storage-panel">
    <!-- C 槽: Consumables -->
    <template v-if="slotType === 'consumables'">
      <div v-if="deployableLimit > 0" class="storage-section">
        <div class="storage-section-header">
          <span class="storage-section-title">{{ t('ship_build.storage_deployable') }}</span>
          <span class="storage-section-info">{{ deployableTotal }} / {{ deployableLimit }}</span>
        </div>
        <div class="storage-items">
          <div v-for="item in deployableItems" :key="item.id" class="storage-item">
            <div class="storage-item-row">
              <div class="storage-item-name">{{ getItemName(item) }}</div>
              <div class="storage-item-count">{{ localDeployables[item.id] || 0 }} / {{ deployableLimit }}</div>
            </div>
            <X4DualPhaseRangeSlider
              :model-value="localDeployables[item.id] || 0"
              :min="0"
              :max="deployableLimit"
              :drag-max="getDeployableDragMax(item.id)"
              :step="1"
              track-bg-color="rgb(30 41 59 / 1)"
              track-border-color="rgb(51 65 85 / 0.7)"
              fill-color="rgb(59 130 246 / 0.8)"
              @update:model-value="handleDeployableChange(item.id, $event)"
              @commit="handleDeployableChange(item.id, $event)"
            />
          </div>
        </div>
      </div>

      <div v-if="countermeasureLimit > 0" class="storage-section">
        <div class="storage-section-header">
          <span class="storage-section-title">{{ t('ship_build.storage_countermeasure') }}</span>
          <span class="storage-section-info">{{ localCountermeasure }} / {{ countermeasureLimit }}</span>
        </div>
        <div class="storage-items">
          <div v-for="item in countermeasureItems" :key="item.id" class="storage-item">
            <div class="storage-item-row">
              <div class="storage-item-name">{{ getItemName(item) }}</div>
              <div class="storage-item-count">{{ localCountermeasure }} / {{ countermeasureLimit }}</div>
            </div>
            <X4DualPhaseRangeSlider
              v-model="localCountermeasure"
              :min="0"
              :max="countermeasureLimit"
              :step="1"
              track-bg-color="rgb(30 41 59 / 1)"
              track-border-color="rgb(51 65 85 / 0.7)"
              fill-color="rgb(59 130 246 / 0.8)"
              @update:model-value="handleCountermeasureChange($event)"
              @commit="handleCountermeasureChange($event)"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- U 槽: Units -->
    <template v-if="slotType === 'units'">
      <div v-if="unitLimit > 0" class="storage-section">
        <div class="storage-section-header">
          <span class="storage-section-title">{{ t('ship_build.storage_drone') }}</span>
          <span class="storage-section-info">{{ droneTotal }} / {{ unitLimit }}</span>
        </div>
        <div class="storage-items">
          <div v-for="item in droneItems" :key="item.id" class="storage-item">
            <div class="storage-item-row">
              <div class="storage-item-name">{{ getItemName(item) }}</div>
              <div class="storage-item-count">{{ localDrones[item.id] || 0 }} / {{ unitLimit }}</div>
            </div>
            <X4DualPhaseRangeSlider
              :model-value="localDrones[item.id] || 0"
              :min="0"
              :max="unitLimit"
              :drag-max="getDroneDragMax(item.id)"
              :step="1"
              track-bg-color="rgb(30 41 59 / 1)"
              track-border-color="rgb(51 65 85 / 0.7)"
              fill-color="rgb(59 130 246 / 0.8)"
              @update:model-value="handleDroneChange(item.id, $event)"
              @commit="handleDroneChange(item.id, $event)"
            />
          </div>
        </div>
      </div>

      <div v-if="missileLimit > 0" class="storage-section">
        <div class="storage-section-header">
          <span class="storage-section-title">{{ t('ship_build.storage_missile') }}</span>
          <span class="storage-section-info">{{ Object.values(localMissiles).reduce((s, v) => s + v, 0) }} / {{ missileLimit }}</span>
        </div>
        <div class="storage-items">
          <div v-for="item in missileItems" :key="item.id" class="storage-item">
            <div class="storage-item-row">
              <div class="storage-item-name">{{ getItemName(item) }}</div>
              <div class="storage-item-count">{{ localMissiles[item.id] || 0 }} / {{ missileLimit }}</div>
            </div>
            <X4DualPhaseRangeSlider
              :model-value="localMissiles[item.id] || 0"
              :min="0"
              :max="missileLimit"
              :step="1"
              track-bg-color="rgb(30 41 59 / 1)"
              track-border-color="rgb(51 65 85 / 0.7)"
              @update:model-value="handleMissileChange(item.id, $event)"
              @commit="handleMissileChange(item.id, $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ship-storage-panel {
  @apply p-4 space-y-4;
}

.storage-section {
  @apply rounded-lg;
}

.storage-section-header {
  @apply flex justify-between items-center mb-3;
}

.storage-section-title {
  @apply text-sm font-medium text-slate-200;
}

.storage-section-info {
  @apply text-xs text-slate-400 font-mono;
}

.storage-items {
  @apply space-y-3;
}

.storage-item {
  @apply w-full space-y-1;
}

.storage-item-row {
  @apply flex justify-between items-center mt-0.5;
}

.storage-item-name {
  @apply text-[11px] text-slate-300 truncate;
}

.storage-item-count {
  @apply text-[11px] text-slate-400 font-mono;
}
</style>
