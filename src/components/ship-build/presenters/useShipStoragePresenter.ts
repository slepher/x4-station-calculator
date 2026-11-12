
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { X4Ship, ShipBlueprintStorage } from '@/types/x4'
import type { ShipBuildSide } from '@/store/useShipBuildStore'

export type ShipStorageProps = { selectedShip: X4Ship | null; slotType: 'consumables' | 'units'; side?: ShipBuildSide }
export function useShipStoragePresenter(props: ShipStorageProps) {
const { t } = useI18n()
const { translate } = useX4I18n()
const store = useShipBuildStore()
const gameData = useGameDataStore()
const side = computed(() => props.side === undefined ? 'A' : props.side)
const blueprint = computed(() => { const plan = store.getPlan(side.value); return plan === null ? null : plan.blueprint })
// Get candidate items based on slot type
const deployableItems = computed(() => {
  const consumables = gameData.consumables
  if (!consumables) return []
  return consumables.filter((item: any) => item.deployable === true)
})

const countermeasureItems = computed(() => {
  const consumables = gameData.consumables
  if (!consumables) return []
  return consumables.filter((item: any) => item.class === 'countermeasure')
})

const droneItems = computed(() => {
  const drones = gameData.drones
  if (!drones) return []

  const shipDroneTags = props.selectedShip?.droneTags || []

  // Filter drones based on matching rules
  const matched = drones.filter((drone) => {
    const droneNoBlueprint = drone.noplayerblueprint === true
    const droneDeployable = drone.deployable === true
    const droneTags = drone.droneTags || []

    // First filter: noplayerblueprint=false and deployable=false
    if (droneNoBlueprint) return false
    if (droneDeployable) return false

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

// Storage limits from ship
const deployableLimit = computed(() => props.selectedShip?.storage?.deployable || 0)
const countermeasureLimit = computed(() => props.selectedShip?.storage?.countermeasure || 0)
const unitLimit = computed(() => props.selectedShip?.storage?.unit || 0)
const missileLimit = computed(() => props.selectedShip?.storage?.missile || 0)

// Get all ammunitionTags from ship blueprint's weapons and turrets
const shipAmmunitionTags = computed(() => {
  const bp = props.selectedShip ? blueprint.value : null
  const equipments = store.equipments
  if (!bp || !equipments) return []

  const tagSet = new Set<string>()

  bp.connections.forEach((conn) => {
    // Skip non-weapon slot types
    if (conn.slot_type !== 'weapon' && conn.slot_type !== 'turret') return

    conn.group.forEach((g) => {
      if (!g.equipment_id) return

      const equipment = equipments.find((e: any) => e.id === g.equipment_id)
      if (!equipment) return

      const ammoTags: string[] = equipment.ammunitionTags || []
      ammoTags.forEach((tag: string) => tagSet.add(tag))
    })
  })

  return Array.from(tagSet)
})

// Missile matching based on ship's ammunitionTags
const missileItems = computed(() => {
  const missiles = gameData.missiles
  if (!missiles) return []

  const ammoTags: string[] = shipAmmunitionTags.value

  // If no ammunitionTags, return empty
  if (ammoTags.length === 0) {
    return []
  }

  // Match missiles that have all ammunitionTags
  const matched = missiles.filter((missile) => {
    const missileTags = missile.missileTags || []
    // Match if missile has all the ship's ammunitionTags
    return ammoTags.some((tag: string) => missileTags.includes(tag))
  })

  return matched
})

// Current storage state from blueprint
const currentStorage = computed(() => {
  const bp = blueprint.value
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
  localCountermeasure.value = storage.countermeasure === null ? 0 : storage.countermeasure.count

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

// Watch deeply so weapon/turret nested mutations re-initialize local slider state.
watch([() => blueprint.value, () => props.selectedShip], () => {
  initFromBlueprint()
}, { immediate: true, deep: true })

// Ensure missile candidates refresh immediately when weapon/turret ammo tags change.
watch(shipAmmunitionTags, () => {
  const bp = blueprint.value
  const missiles = gameData.missiles
  if (props.slotType === 'units' && bp?.storage?.missiles?.length && missiles) {
    const ammoTags = shipAmmunitionTags.value
    const currentMissiles = bp.storage.missiles
    const filteredMissiles = ammoTags.length === 0
      ? []
      : currentMissiles.filter((item) => {
        const missile = missiles.find((m) => m.id === item.id)
        if (!missile) return false
        const missileTags: string[] = missile.missileTags || []
        return ammoTags.some((tag: string) => missileTags.includes(tag))
      })

    const changed = filteredMissiles.length !== currentMissiles.length
      || filteredMissiles.some((item, index) => {
        const original = currentMissiles[index]
        return !original || original.id !== item.id || original.count !== item.count
      })

    if (changed) {
      store.updatePlanStorage(side.value, {
        deployables: bp.storage.deployables || [],
        countermeasure: bp.storage.countermeasure || null,
        drones: bp.storage.drones || [],
        missiles: filteredMissiles
      })
    }
  }
  initFromBlueprint()
})

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

const getMissileDragMax = (excludeId?: string) => {
  const used = Object.entries(localMissiles.value)
    .filter(([id]) => id !== excludeId)
    .reduce((sum, [_, count]) => sum + count, 0)
  return Math.max(0, missileLimit.value - used)
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

  store.updatePlanStorage(side.value, storage)
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

return { store, gameData, side, blueprint, deployableItems, countermeasureItems, droneItems, deployableLimit, countermeasureLimit, unitLimit, missileLimit, shipAmmunitionTags, missileItems, currentStorage, localDeployables, localCountermeasure, localDrones, localMissiles, initFromBlueprint, deployableTotal, droneTotal, getDeployableDragMax, getDroneDragMax, getMissileDragMax, saveToBlueprint, handleDeployableChange, handleCountermeasureChange, handleDroneChange, handleMissileChange, getItemName, t, translate }
}
