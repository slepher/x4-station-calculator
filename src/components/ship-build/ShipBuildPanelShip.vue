<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import type { MetricSchema, MetricValueMap } from '@/components/common/metricsPanelTypes'
import type { X4Ship } from '@/types/x4'
import defaultMaxesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/default_maxes.json'
import shipSlotsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_slots.json'

const props = defineProps<{
  targetShip: X4Ship | null
  currentShip: X4Ship | null
}>()

const { t } = useI18n()

type ShipClass = X4Ship['class']
type PropertyKey =
  | 'hull'
  | 'radar_range'
  | 'crew'
  | 'storage_container'
  | 'storage_solid'
  | 'storage_liquid'
  | 'storage_condensed'
  | 'storage_unit'
  | 'missile'
  | 'deployable'
  | 'countermeasure'
  | 'dock_m_count'
  | 'dock_m_capacity'
  | 'dock_s_count'
  | 'dock_s_capacity'

type PropertyMeta = {
  key: PropertyKey
  labelKey: string
  unit: string
  maxField: string
}

type SlotItem = {
  slot: 'engine' | 'shield' | 'thruster' | 'turret' | 'weapon'
  size: 'small' | 'medium' | 'large' | 'extralarge'
  count: number
}

const defaultMaxes = defaultMaxesRaw as Record<ShipClass, Record<string, number>>
const shipSlotsByClass = shipSlotsRaw as Record<ShipClass, SlotItem[]>

const propertyMetaList: PropertyMeta[] = [
  { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', maxField: 'hull' },
  { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', maxField: 'radar_range' },
  { key: 'crew', labelKey: 'ship_build.stats_crew', unit: '', maxField: 'capacity_crew' },
  { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3', maxField: 'capacity_container' },
  { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', maxField: 'capacity_solid' },
  { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', maxField: 'capacity_liquid' },
  { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', maxField: 'capacity_condensate' },
  { key: 'storage_unit', labelKey: 'ship_build.stats_storage_unit', unit: '', maxField: 'capacity_unit' },
  { key: 'missile', labelKey: 'ship_build.stats_missile', unit: '', maxField: 'capacity_missile' },
  { key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', maxField: 'capacity_deployable' },
  { key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', maxField: 'capacity_countermeasure' },
  { key: 'dock_m_count', labelKey: 'ship_build.stats_dock_m_count', unit: '', maxField: 'dock_ship_m' },
  { key: 'dock_m_capacity', labelKey: 'ship_build.stats_dock_m_capacity', unit: '', maxField: 'capacity_ship_m' },
  { key: 'dock_s_count', labelKey: 'ship_build.stats_dock_s_count', unit: '', maxField: 'dock_ship_s' },
  { key: 'dock_s_capacity', labelKey: 'ship_build.stats_dock_s_capacity', unit: '', maxField: 'capacity_ship_s' }
]

const leftBasePropertyKeys: PropertyKey[] = ['hull', 'radar_range', 'crew']

const slotTypeLabelKeyMap: Record<SlotItem['slot'], string> = {
  engine: 'ship_build.stats_engine_slots',
  shield: 'ship_build.stats_shield_slots',
  thruster: 'ship_build.stats_thruster_slots',
  turret: 'ship_build.stats_turret_slots',
  weapon: 'ship_build.stats_weapon_slots'
}

const sizeLabelMap: Record<SlotItem['size'], string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  extralarge: 'XL'
}

const keyForSlot = (item: SlotItem) => `slot_${item.slot}_${item.size}`

const getCargoCapacity = (ship: X4Ship, type: 'container' | 'solid' | 'liquid' | 'condensate') => {
  const cargo = ship.cargo.find((c) => c.type === type)
  return cargo?.capacity || 0
}

const getDockCount = (ship: X4Ship, size: 'dock_m' | 'dock_s') => {
  const dock = ship.dockarea.find((d) => d.size === size)
  return dock?.capacity || 0
}

const getShipStorageCapacity = (ship: X4Ship, size: 'dock_m' | 'dock_s') => {
  const storage = ship.shipstorage.find((s) => s.size === size)
  return storage?.capacity || 0
}

const getPropertyValue = (ship: X4Ship, key: PropertyKey) => {
  if (key === 'hull') return ship.hull || 0
  if (key === 'radar_range') return Math.round((ship.radarRange || 0) / 1000)
  if (key === 'crew') return ship.crew?.capacity || 0
  if (key === 'storage_container') return getCargoCapacity(ship, 'container')
  if (key === 'storage_solid') return getCargoCapacity(ship, 'solid')
  if (key === 'storage_liquid') return getCargoCapacity(ship, 'liquid')
  if (key === 'storage_condensed') return getCargoCapacity(ship, 'condensate')
  if (key === 'storage_unit') return ship.storage?.unit || 0
  if (key === 'missile') return ship.storage?.missile || 0
  if (key === 'deployable') return ship.storage?.deployable || 0
  if (key === 'countermeasure') return ship.storage?.countermeasure || 0
  if (key === 'dock_m_count') return getDockCount(ship, 'dock_m')
  if (key === 'dock_m_capacity') return getShipStorageCapacity(ship, 'dock_m')
  if (key === 'dock_s_count') return getDockCount(ship, 'dock_s')
  if (key === 'dock_s_capacity') return getShipStorageCapacity(ship, 'dock_s')
  return 0
}

const getSlotValue = (ship: X4Ship, item: SlotItem) => {
  const slot = ship.slots.find((s) => s.type === item.slot)
  return Number(slot?.count?.[item.size] || 0)
}

const targetShipResolved = computed(() => props.targetShip || props.currentShip)

const compareEnabled = computed(() => {
  if (!props.currentShip || !targetShipResolved.value) return false
  return props.currentShip.class === targetShipResolved.value.class
})

const activeClass = computed<ShipClass | null>(() => {
  if (targetShipResolved.value) return targetShipResolved.value.class
  if (props.currentShip) return props.currentShip.class
  return null
})

const activePropertyMetaList = computed<PropertyMeta[]>(() => {
  if (!activeClass.value) return []
  const classMaxes = defaultMaxes[activeClass.value] || {}
  return propertyMetaList.filter((item) => Number(classMaxes[item.maxField] || 0) > 0)
})

const leftPropertyKeys = computed<PropertyKey[]>(() => {
  const exists = new Set(activePropertyMetaList.value.map((item) => item.key))
  return leftBasePropertyKeys.filter((key) => exists.has(key))
})

const rightPropertyKeys = computed<PropertyKey[]>(() => {
  const excluded = new Set(leftPropertyKeys.value)
  return activePropertyMetaList.value.map((item) => item.key).filter((key) => !excluded.has(key))
})

const activeSlots = computed<SlotItem[]>(() => {
  if (!activeClass.value) return []
  return (shipSlotsByClass[activeClass.value] || []).filter((item) => Number(item.count || 0) > 0)
})

const leftKeys = computed<string[]>(() => {
  return [...leftPropertyKeys.value, ...activeSlots.value.map((item) => keyForSlot(item))]
})

const rightKeys = computed<string[]>(() => {
  return [...rightPropertyKeys.value]
})

const metadataMap = computed(() => {
  const map = new Map<string, { label: string; unit: string; max: number }>()
  if (!activeClass.value) return map

  const classMaxes = defaultMaxes[activeClass.value] || {}
  activePropertyMetaList.value.forEach((item) => {
    const rawMax = Number(classMaxes[item.maxField] || 0)
    const max = item.key === 'radar_range' ? Math.round(rawMax / 1000) : rawMax
    map.set(item.key, {
      label: t(item.labelKey),
      unit: item.unit,
      max
    })
  })

  activeSlots.value.forEach((item) => {
    map.set(keyForSlot(item), {
      label: `${t(slotTypeLabelKeyMap[item.slot])} (${sizeLabelMap[item.size]})`,
      unit: '',
      max: Number(item.count || 0)
    })
  })

  return map
})

const schema = computed<MetricSchema>(() => {
  const rows: MetricSchema = []
  const totalRows = Math.max(leftKeys.value.length, rightKeys.value.length)
  for (let i = 0; i < totalRows; i += 1) {
    const row: MetricSchema[number] = []
    const leftKey = leftKeys.value[i]
    const rightKey = rightKeys.value[i]

    if (leftKey) {
      const leftMeta = metadataMap.value.get(leftKey)
      if (leftMeta) {
        row.push({ key: leftKey, labelKey: leftMeta.label, unit: leftMeta.unit, max: leftMeta.max })
      }
    }

    if (rightKey) {
      const rightMeta = metadataMap.value.get(rightKey)
      if (rightMeta) {
        row.push({ key: rightKey, labelKey: rightMeta.label, unit: rightMeta.unit, max: rightMeta.max })
      }
    }

    if (row.length > 0) rows.push(row)
  }
  return rows
})

const buildValueMap = (ship: X4Ship | null): MetricValueMap | null => {
  if (!ship) return null
  const map: MetricValueMap = {}

  leftPropertyKeys.value.forEach((key) => {
    map[key] = getPropertyValue(ship, key)
  })
  rightPropertyKeys.value.forEach((key) => {
    map[key] = getPropertyValue(ship, key)
  })
  activeSlots.value.forEach((item) => {
    map[keyForSlot(item)] = getSlotValue(ship, item)
  })

  return map
}

const targetValues = computed(() => buildValueMap(targetShipResolved.value))
const currentValues = computed(() => (compareEnabled.value ? buildValueMap(props.currentShip) : null))
</script>

<template>
  <div class="panel-ship" data-testid="ship-build-panel-ship">
    <MetricsPanel
      panel-id="ship-build-panel-ship"
      :title="t('ship_build.panel_ship')"
      :obj-current="currentValues"
      :obj-target="targetValues"
      :schema="schema"
      order="row"
      :rounded-keys="[]"
    />
  </div>
</template>

<style scoped>
.panel-ship {
  @apply min-w-0;
}
</style>
