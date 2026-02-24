<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import type {
  X4Ship,
  X4ShipRace,
  X4ShipType,
  X4Equipment,
  X4EquipmentType,
  EquipmentType,
  ShipEquipmentSize
} from '@/types/x4'
import ShipBuildFitCandidateArsenal from '@/components/ship-build/ShipBuildFitCandidateArsenal.vue'
import type { FitConnectionRow, FitGroupRow, FitMode } from '@/components/ship-build/fitTypes'

import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import shipTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_types.json'
import shipRacesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ship_races.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'

const { t } = useI18n()
const { translateShip, translateShipType, translateEquipmentType, translateEquipment } = useX4I18n()

const ships = shipsRaw as unknown as X4Ship[]
const shipTypes = shipTypesRaw as X4ShipType[]
const shipRaces = shipRacesRaw as X4ShipRace[]
const equipments = equipmentsRaw as X4Equipment[]
const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]

const classOptions = [
  { id: 'ship_s', label: 'S' },
  { id: 'ship_m', label: 'M' },
  { id: 'ship_l', label: 'L' },
  { id: 'ship_xl', label: 'XL' }
]

const selectedClass = ref<'ship_s' | 'ship_m' | 'ship_l' | 'ship_xl' | null>(null)
const selectedRaces = ref<string[]>([])
const selectedTypes = ref<string[]>([])
const selectedShipId = ref<string | null>(null)
const statsViewMode = ref<'summary' | 'detail'>('summary')
const fitMode = ref<FitMode>('connection')
const selectedByConnection = ref<Record<string, string | null>>({})

const raceOptions = computed(() => {
  return shipRaces.map(race => ({
    id: race.id,
    label: race.id
  }))
})

const availableTypes = computed(() => {
  if (!selectedClass.value) return []
  return shipTypes.filter(type => type.class.includes(selectedClass.value!))
})

const isTypeSingleRow = computed(() => availableTypes.value.length > 0 && availableTypes.value.length <= 5)

const typeLabelMap = computed(() => {
  const map = new Map<string, string>()
  shipTypes.forEach(type => {
    map.set(type.id, translateShipType(type))
  })
  return map
})

const equipmentTypeMap = computed(() => {
  const map = new Map<EquipmentType, X4EquipmentType>()
  equipmentTypes.forEach(type => {
    map.set(type.id, type)
  })
  return map
})

const equipmentSizeOrder: ShipEquipmentSize[] = ['extralarge', 'large', 'medium', 'small']
const equipmentSizeLabelMap: Partial<Record<ShipEquipmentSize, string>> = {
  extralarge: 'XL',
  large: 'L',
  medium: 'M',
  small: 'S',
  unknown: ''
}

const equipmentTypeShortMap: Record<EquipmentType, string> = {
  engine: 'E',
  shield: 'S',
  weapon: 'W',
  turret: 'T',
  thruster: ''
}

const getEquipmentSummary = (ship: X4Ship, mode: 'short' | 'full') => {
  if (!ship.slots || ship.slots.length === 0) return ''
  const typeCounts = new Map<EquipmentType, Record<ShipEquipmentSize, number>>()
  ship.slots.forEach(slot => {
    const entry = typeCounts.get(slot.type) || {
      extralarge: 0,
      large: 0,
      medium: 0,
      small: 0,
      unknown: 0
    }
    equipmentSizeOrder.forEach(size => {
      const value = slot.count?.[size]
      if (value) entry[size] += value
    })
    typeCounts.set(slot.type, entry)
  })

  const parts: string[] = []
  typeCounts.forEach((counts, type) => {
    if (type === 'thruster') return
    const sizeText = equipmentSizeOrder
      .map(size => counts[size] ? `${equipmentSizeLabelMap[size] || ''}${counts[size]}` : '')
      .filter(Boolean)
      .join('')
    if (!sizeText) return
    const typeDef = equipmentTypeMap.value.get(type)
    const fullName = typeDef ? translateEquipmentType(typeDef) : type
    const shortName = equipmentTypeShortMap[type] || type
    const typeName = mode === 'short' ? shortName : fullName
    parts.push(`${typeName}:${sizeText}`)
  })

  return parts.join(', ')
}

const canShowList = computed(() => {
  return Boolean(selectedClass.value) && (selectedRaces.value.length > 0 || selectedTypes.value.length > 0)
})

const shipsByClass = computed(() => {
  if (!selectedClass.value) return []
  return ships.filter(ship => ship.class === selectedClass.value)
})

const raceCountMap = computed(() => {
  const counts = new Map<string, number>()
  const base = shipsByClass.value
  const filtered = selectedTypes.value.length > 0
    ? base.filter(ship => selectedTypes.value.includes(ship.type))
    : base
  filtered.forEach(ship => {
    counts.set(ship.race, (counts.get(ship.race) || 0) + 1)
  })
  return counts
})

const typeCountMap = computed(() => {
  const counts = new Map<string, number>()
  const base = shipsByClass.value
  const filtered = selectedRaces.value.length > 0
    ? base.filter(ship => selectedRaces.value.includes(ship.race))
    : base
  filtered.forEach(ship => {
    counts.set(ship.type, (counts.get(ship.type) || 0) + 1)
  })
  return counts
})

const filteredShips = computed(() => {
  if (!canShowList.value || !selectedClass.value) return []

  let result = shipsByClass.value
  if (selectedRaces.value.length > 0) {
    result = result.filter(ship => selectedRaces.value.includes(ship.race))
  }
  if (selectedTypes.value.length > 0) {
    result = result.filter(ship => selectedTypes.value.includes(ship.type))
  }

  return result
    .slice()
    .sort((a, b) => translateShip(a).localeCompare(translateShip(b)))
})

watch(selectedClass, () => {
  const allowed = new Set(availableTypes.value.map(type => type.id))
  selectedTypes.value = selectedTypes.value.filter(typeId => allowed.has(typeId))
})

const selectedShip = computed(() => {
  if (!selectedShipId.value) return null
  return ships.find(ship => ship.id === selectedShipId.value) || null
})

watch(filteredShips, (next) => {
  if (!selectedShipId.value) return
  if (!next.some(ship => ship.id === selectedShipId.value)) {
    selectedShipId.value = null
  }
})

watch(selectedShipId, () => {
  selectedByConnection.value = {}
  fitMode.value = 'connection'
})

const toggleRace = (raceId: string) => {
  if (selectedRaces.value.includes(raceId)) {
    selectedRaces.value = selectedRaces.value.filter(id => id !== raceId)
  } else {
    selectedRaces.value = [...selectedRaces.value, raceId]
  }
}

const toggleType = (typeId: string) => {
  if (selectedTypes.value.includes(typeId)) {
    selectedTypes.value = selectedTypes.value.filter(id => id !== typeId)
  } else {
    selectedTypes.value = [...selectedTypes.value, typeId]
  }
}

const normalizeTagList = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === 'string')
}

const getEquipmentCandidates = (
  slotType: EquipmentType,
  size: ShipEquipmentSize,
  connectionTags: string[]
) => {
  return equipments
    .filter((equipment) => !equipment.noplayerblueprint)
    .filter((equipment) => equipment.type === slotType && equipment.size === size)
    .filter((equipment) => {
      if (connectionTags.length === 0) return true
      const equipmentTags = normalizeTagList(equipment.slotTags)
      if (equipmentTags.length === 0) return false
      const connectionSet = new Set(connectionTags)
      const sharedTags = equipmentTags.filter(tag => connectionSet.has(tag))
      if (sharedTags.length === 0) return false

      const hasHittableConstraint = connectionSet.has('hittable') || connectionSet.has('unhittable')
      if (!hasHittableConstraint) return true

      const matchedHitTag = connectionSet.has('hittable') ? 'hittable' : 'unhittable'
      if (!equipmentTags.includes(matchedHitTag)) return false

      return sharedTags.some(tag => tag !== 'hittable' && tag !== 'unhittable')
    })
    .map((equipment) => ({
      id: equipment.id,
      name: translateEquipment(equipment),
      mk: equipment.mk || null,
      race: equipment.race || null,
      tags: normalizeTagList(equipment.slotTags)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const connectionRows = computed<FitConnectionRow[]>(() => {
  if (!selectedShip.value) return []

  const rows: FitConnectionRow[] = []
  selectedShip.value.slots.forEach((slot, slotIndex) => {
    slot.groups.forEach((group, groupIndex) => {
      const connection = group.connection
      const tags = normalizeTagList(connection?.tags)
      const typeDef = equipmentTypeMap.value.get(slot.type)
      const baseKey = `${selectedShip.value!.id}::${slot.type}::${slotIndex}::${groupIndex}`

      rows.push({
        connectionKey: `${selectedShip.value!.id}::${slot.type}::${slotIndex}::${groupIndex}`,
        slotType: slot.type,
        parentSlotType: slot.type,
        parentConnectionSize: connection?.size || 'unknown',
        parentConnectionTags: [...tags],
        slotTypeLabel: typeDef ? translateEquipmentType(typeDef) : slot.type,
        groupName: group.group,
        size: connection?.size || 'unknown',
        tags,
        count: connection?.count || 0,
        options: getEquipmentCandidates(
          slot.type,
          connection?.size || 'unknown',
          tags
        )
      })

      if (connection?.shield) {
        const shieldTags = normalizeTagList(connection.shield.tags)
        const shieldTypeDef = equipmentTypeMap.value.get('shield')
        const shieldTypeLabel = shieldTypeDef ? translateEquipmentType(shieldTypeDef) : 'shield'
        rows.push({
          connectionKey: `${baseKey}::shield`,
          slotType: 'shield',
          parentSlotType: slot.type,
          parentConnectionSize: connection?.size || 'unknown',
          parentConnectionTags: [...tags],
          slotTypeLabel: shieldTypeLabel,
          groupName: group.group,
          size: connection.shield.size || 'unknown',
          tags: shieldTags,
          count: connection.shield.count || 0,
          options: getEquipmentCandidates('shield', connection.shield.size || 'unknown', shieldTags)
        })
      }
    })
  })

  return rows
})

const buildTagSignature = (tags: string[]) => [...tags].sort().join('&')

const groupRows = computed<FitGroupRow[]>(() => {
  const grouped = new Map<string, FitGroupRow>()
  connectionRows.value.forEach((row) => {
    const tagSignature = buildTagSignature(row.tags)
    const parentTagSignature = buildTagSignature(row.parentConnectionTags || [])
    const groupKey = row.slotType === 'shield'
      ? `${row.parentSlotType}|shield|${row.parentConnectionSize}|${parentTagSignature}|${row.size}|${tagSignature}`
      : `${row.parentSlotType}|${row.slotType}|${row.size}|${tagSignature}`
    const existing = grouped.get(groupKey)
    if (!existing) {
      grouped.set(groupKey, {
        groupKey,
        slotType: row.slotType,
        parentSlotType: row.parentSlotType,
        parentConnectionSize: row.parentConnectionSize,
        parentConnectionTags: [...row.parentConnectionTags],
        slotTypeLabel: row.slotTypeLabel,
        groupName: tagSignature || 'default-tags',
        size: row.size,
        totalCount: row.count,
        tags: [...row.tags],
        options: [...row.options],
        connectionKeys: [row.connectionKey]
      })
      return
    }

    existing.totalCount += row.count
    existing.connectionKeys.push(row.connectionKey)
    const tagSet = new Set([...existing.tags, ...row.tags])
    existing.tags = Array.from(tagSet)

    const optionMap = new Map(existing.options.map(item => [item.id, item]))
    row.options.forEach((item) => optionMap.set(item.id, item))
    existing.options = Array.from(optionMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  })

  return Array.from(grouped.values())
})

const hasFitModeConflict = computed(() => {
  const map = new Map<string, Set<string>>()
  connectionRows.value.forEach((row) => {
    const selected = selectedByConnection.value[row.connectionKey]
    if (!selected) return
    const conflictKey = row.slotType === 'shield'
      ? `shield@${row.parentSlotType}`
      : row.slotType
    const set = map.get(conflictKey) || new Set<string>()
    set.add(selected)
    map.set(conflictKey, set)
  })
  return Array.from(map.values()).some(set => set.size > 1)
})

const canSwitchToGroupMode = computed(() => !hasFitModeConflict.value)
const fitModeConflictReason = computed(() => hasFitModeConflict.value ? t('ship_build.fit_mode_disabled_reason') : '')

const setFitMode = (mode: FitMode) => {
  if (mode === 'group' && !canSwitchToGroupMode.value) return
  fitMode.value = mode
}

const applyConnectionAssignment = (payload: { connectionKey: string; equipmentId: string | null }) => {
  selectedByConnection.value = {
    ...selectedByConnection.value,
    [payload.connectionKey]: payload.equipmentId
  }
}

const applyGroupAssignment = (payload: { groupKey: string; equipmentId: string | null }) => {
  const target = groupRows.value.find(item => item.groupKey === payload.groupKey)
  if (!target) return
  const nextState = { ...selectedByConnection.value }
  target.connectionKeys.forEach((connectionKey) => {
    nextState[connectionKey] = payload.equipmentId
  })
  selectedByConnection.value = nextState
}

type ShipStatMetric = {
  key: string;
  labelKey: string;
  unit: string;
  value: number;
  ratio: number;
}

const getSlotCountByType = (ship: X4Ship, type: EquipmentType) => {
  const slot = ship.slots.find(item => item.type === type)
  if (!slot?.count) return 0
  return Object.values(slot.count).reduce((sum, count) => sum + (count || 0), 0)
}

const buildShipStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => [
  {
    key: 'hull',
    labelKey: 'ship_build.stats_hull',
    unit: 'MJ',
    value: ship.hull || 0
  },
  {
    key: 'storage_unit',
    labelKey: 'ship_build.stats_storage_unit',
    unit: 'm3',
    value: ship.storage?.unit || 0
  },
  {
    key: 'crew',
    labelKey: 'ship_build.stats_crew',
    unit: '',
    value: ship.crew?.capacity || 0
  },
  {
    key: 'missile',
    labelKey: 'ship_build.stats_missile',
    unit: '',
    value: ship.storage?.missile || 0
  },
  {
    key: 'weapon_slots',
    labelKey: 'ship_build.stats_weapon_slots',
    unit: '',
    value: getSlotCountByType(ship, 'weapon')
  },
  {
    key: 'turret_slots',
    labelKey: 'ship_build.stats_turret_slots',
    unit: '',
    value: getSlotCountByType(ship, 'turret')
  },
  {
    key: 'shield_slots',
    labelKey: 'ship_build.stats_shield_slots',
    unit: '',
    value: getSlotCountByType(ship, 'shield')
  },
  {
    key: 'engine_slots',
    labelKey: 'ship_build.stats_engine_slots',
    unit: '',
    value: getSlotCountByType(ship, 'engine')
  }
]

const shipStats = computed<ShipStatMetric[]>(() => {
  if (!selectedShip.value) return []
  const classShips = ships.filter(ship => ship.class === selectedShip.value!.class)
  const selectedMetrics = buildShipStats(selectedShip.value)

  return selectedMetrics.map(metric => {
    const maxValue = Math.max(
      ...classShips.map(ship => buildShipStats(ship).find(item => item.key === metric.key)?.value || 0),
      1
    )
    return {
      ...metric,
      ratio: Math.max(0.03, Math.min(1, metric.value / maxValue))
    }
  })
})

const formatStatValue = (value: number) => value.toLocaleString()

type ShipStatDisplay = {
  key: string;
  labelKey: string;
  unit: string;
  valueText: string;
  ratio: number | null;
  placeholder?: boolean;
}

const detailPlaceholderMetrics: Array<{ key: string; labelKey: string; unit: string }> = [
  { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s' },
  { key: 'acceleration', labelKey: 'ship_build.stats_acceleration', unit: 'm/s2' },
  { key: 'boost_speed', labelKey: 'ship_build.stats_boost_speed', unit: 'm/s' },
  { key: 'boost_acceleration', labelKey: 'ship_build.stats_boost_acceleration', unit: 'm/s2' },
  { key: 'boost_duration', labelKey: 'ship_build.stats_boost_duration', unit: 's' },
  { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s' },
  { key: 'travel_charge_time', labelKey: 'ship_build.stats_travel_charge_time', unit: 's' },
  { key: 'strafe_speed', labelKey: 'ship_build.stats_strafe_speed', unit: 'm/s' },
  { key: 'pitch', labelKey: 'ship_build.stats_pitch', unit: 'deg/s' },
  { key: 'yaw', labelKey: 'ship_build.stats_yaw', unit: 'deg/s' },
  { key: 'roll', labelKey: 'ship_build.stats_roll', unit: 'deg/s' },
  { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3' },
  { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3' },
  { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3' }
]

const summaryShipStats = computed<ShipStatDisplay[]>(() => {
  return shipStats.value.map(metric => ({
    key: metric.key,
    labelKey: metric.labelKey,
    unit: metric.unit,
    valueText: formatStatValue(metric.value),
    ratio: metric.ratio
  }))
})

const detailedShipStats = computed<ShipStatDisplay[]>(() => {
  return [
    ...summaryShipStats.value,
    ...detailPlaceholderMetrics.map(metric => ({
      key: metric.key,
      labelKey: metric.labelKey,
      unit: metric.unit,
      valueText: '--',
      ratio: null,
      placeholder: true
    }))
  ]
})

const visibleShipStats = computed<ShipStatDisplay[]>(() => {
  return statsViewMode.value === 'summary' ? summaryShipStats.value : detailedShipStats.value
})
</script>

<template>
  <div class="ship-build-view flex flex-col gap-6">
    <div class="panel-card" data-testid="ship-build-filters">
      <div class="panel-header">
        <div class="flex items-center gap-2">
          <span class="text-emerald-300 text-xs font-semibold">{{ t('ship_build.title') }}</span>
          <span class="text-slate-400 text-xs">{{ t('ship_build.select_ship') }}</span>
        </div>
        <div class="text-xs text-slate-500">{{ t('ship_build.filters') }}</div>
      </div>

      <div v-if="!selectedShip" class="panel-body grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
        <div class="flex flex-col gap-5">
          <div class="filter-card" data-testid="ship-build-filter-class">
            <div class="filter-card-header">
              <span>{{ t('ship_build.filter_class') }}</span>
              <span class="filter-required">{{ t('ship_build.required') }}</span>
            </div>
            <div class="filter-card-body">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in classOptions"
                  :key="option.id"
                  class="filter-chip"
                  :class="selectedClass === option.id ? 'filter-chip-active' : 'filter-chip-idle'"
                  @click="selectedClass = option.id as any"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="filter-card" data-testid="ship-build-filter-race">
            <div class="filter-card-header">{{ t('ship_build.filter_race') }}</div>
            <div class="filter-card-body">
              <div class="race-grid">
                <button
                  v-for="option in raceOptions"
                  :key="option.id"
                  class="filter-chip"
                  :class="selectedRaces.includes(option.id) ? 'filter-chip-active' : 'filter-chip-idle'"
                  @click="toggleRace(option.id)"
                >
                  <span>{{ option.label }}</span>
                  <span class="filter-count" data-testid="ship-build-race-count">({{ raceCountMap.get(option.id) || 0 }})</span>
                </button>
              </div>
            </div>
          </div>

          <div class="filter-card" data-testid="ship-build-filter-type">
            <div class="filter-card-header">{{ t('ship_build.filter_type') }}</div>
            <div class="filter-card-body">
              <div v-if="!selectedClass" class="text-xs text-slate-500">
                {{ t('ship_build.type_hint') }}
              </div>
              <div v-else :class="['type-grid', isTypeSingleRow ? 'type-grid-single' : '']">
                <button
                  v-for="type in availableTypes"
                  :key="type.id"
                  class="filter-chip"
                  :class="selectedTypes.includes(type.id) ? 'filter-chip-active' : 'filter-chip-idle'"
                  @click="toggleType(type.id)"
                >
                  <span>{{ typeLabelMap.get(type.id) || type.id }}</span>
                  <span class="filter-count" data-testid="ship-build-type-count">({{ typeCountMap.get(type.id) || 0 }})</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <div data-testid="ship-build-list">
          <div class="list-card">
            <div class="list-header">
              <span>{{ t('ship_build.list_title') }}</span>
              <span v-if="canShowList" class="text-xs text-slate-500">{{ filteredShips.length }}</span>
            </div>
            <div v-if="!canShowList" class="list-empty" data-testid="ship-build-list-empty">
              {{ t('ship_build.list_hint') }}
            </div>
            <div v-else-if="filteredShips.length === 0" class="list-empty" data-testid="ship-build-list-empty">
              {{ t('ship_build.empty_list') }}
            </div>
            <ul v-else class="list-body list-grid custom-scrollbar">
              <li
                v-for="ship in filteredShips"
                :key="ship.id"
                class="list-item"
                :class="selectedShipId === ship.id ? 'list-item-active' : ''"
                @click="selectedShipId = ship.id"
              >
                <div class="font-semibold text-slate-100 truncate" data-testid="ship-build-ship-name">{{ translateShip(ship) }}</div>
                <div class="text-xs text-slate-300/90 equipment-line">
                  {{ getEquipmentSummary(ship, 'short') }}
                </div>
                <div class="text-xs text-slate-400">
                  {{ typeLabelMap.get(ship.type) || ship.type }} · {{ ship.race }}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-else class="panel-body">
        <div
          class="selection-expanded"
          data-testid="ship-build-selection"
        >
          <div class="selection-expanded-header">
            <div class="selection-title">
              <span class="selection-title-label">{{ t('ship_build.selected_ship') }}</span>
              <span class="selection-title-name">{{ translateShip(selectedShip) }}</span>
            </div>
            <button class="selection-change-btn" @click="selectedShipId = null">
              {{ t('ship_build.change_ship') }}
            </button>
          </div>
          <div class="selection-expanded-body">
            <div class="selection-expanded-line equipment-line">
              {{ getEquipmentSummary(selectedShip, 'full') }}
            </div>
            <div class="selection-expanded-line text-xs text-slate-400">
              {{ typeLabelMap.get(selectedShip.type) || selectedShip.type }} · {{ selectedShip.race }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedShip" class="grid grid-cols-12 gap-8" data-testid="ship-build-panels">
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-fit">
        <div class="panel-header">
          <span>{{ t('ship_build.panel_fit') }}</span>
        </div>
        <div class="fit-panel-content" data-testid="ship-build-fit-panel">
          <ShipBuildFitCandidateArsenal
            :mode="fitMode"
            :can-switch-to-group="canSwitchToGroupMode"
            :conflict-reason="fitModeConflictReason"
            :connection-rows="connectionRows"
            :group-rows="groupRows"
            :selected-by-connection="selectedByConnection"
            @update:mode="setFitMode"
            @assign-connection="applyConnectionAssignment"
            @assign-group="applyGroupAssignment"
          />
        </div>
      </div>
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-stats">
        <div class="panel-header">{{ t('ship_build.panel_stats') }}</div>
        <div class="stats-panel" data-testid="ship-build-stats-panel">
          <div class="stats-toolbar">
            <div class="stats-caption">{{ t('ship_build.stats_preview') }}</div>
            <div class="stats-mode-switch">
              <button
                data-testid="ship-build-stats-mode-summary"
                class="stats-mode-btn"
                :class="statsViewMode === 'summary' ? 'stats-mode-btn-active' : 'stats-mode-btn-idle'"
                @click="statsViewMode = 'summary'"
              >
                {{ t('ship_build.stats_mode_summary') }}
              </button>
              <button
                data-testid="ship-build-stats-mode-detail"
                class="stats-mode-btn"
                :class="statsViewMode === 'detail' ? 'stats-mode-btn-active' : 'stats-mode-btn-idle'"
                @click="statsViewMode = 'detail'"
              >
                {{ t('ship_build.stats_mode_detail') }}
              </button>
            </div>
          </div>
          <div v-if="statsViewMode === 'detail'" class="stats-pending">
            {{ t('ship_build.stats_detail_pending') }}
          </div>
          <div class="stats-list">
            <div
              v-for="metric in visibleShipStats"
              :key="metric.key"
              class="stats-row"
              :class="{ 'stats-row-placeholder': metric.placeholder }"
            >
              <span class="stats-label">{{ t(metric.labelKey) }}</span>
              <span class="stats-value">
                {{ metric.valueText }}
                <span v-if="metric.unit" class="stats-unit">{{ metric.unit }}</span>
              </span>
              <div v-if="metric.ratio !== null" class="stats-bar">
                <div class="stats-bar-fill" :style="{ width: `${Math.round(metric.ratio * 100)}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-materials">
        <div class="panel-header">{{ t('ship_build.panel_materials') }}</div>
        <div class="panel-placeholder"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.panel-body {
  @apply p-4;
}

.filter-block {
  @apply flex flex-col gap-2;
}

.filter-label {
  @apply text-xs uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-2;
}

.filter-required {
  @apply text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30;
}

.filter-chip {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold transition-all border;
}

.filter-count {
  @apply text-[11px] text-slate-300 ml-1;
}

.race-grid {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 0.5rem;
}

.filter-chip-idle {
  @apply bg-slate-800/70 text-slate-300 border-slate-700 hover:border-emerald-400/60 hover:text-emerald-200;
}

.filter-chip-active {
  @apply bg-emerald-600/80 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)];
}

.list-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg h-full flex flex-col min-h-[320px];
}

.list-header {
  @apply px-3 py-2 text-xs uppercase tracking-wide text-slate-300 border-b border-slate-800 flex items-center justify-between;
}

.list-body {
  @apply flex-1 overflow-y-auto px-3 py-3;
  align-content: start;
}

.list-grid {
  @apply grid gap-2;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: min-content;
  align-content: start;
}

.list-item {
  @apply bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2 cursor-pointer transition-all;
  min-height: 72px;
}

.list-item-active {
  @apply border-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.35)] bg-emerald-500/10;
}

.list-empty {
  @apply text-xs text-slate-500 px-3 py-6 text-center;
}

.panel-placeholder {
  @apply h-48 bg-slate-900/30 border border-dashed border-slate-700 rounded-lg m-4;
}

.fit-panel-content {
  @apply p-4;
}

.stats-panel {
  @apply p-4 bg-slate-900/30 border border-slate-800/80 rounded-lg m-4;
}

.stats-toolbar {
  @apply flex items-center justify-between gap-3 mb-3;
}

.stats-caption {
  @apply text-[11px] uppercase tracking-wide text-emerald-300/80;
}

.stats-mode-switch {
  @apply flex items-center gap-2;
}

.stats-mode-btn {
  @apply px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors;
}

.stats-mode-btn-idle {
  @apply text-slate-300 border-slate-700 bg-slate-800/60 hover:text-emerald-200 hover:border-emerald-400/60;
}

.stats-mode-btn-active {
  @apply text-white border-emerald-400 bg-emerald-600/70;
}

.stats-pending {
  @apply text-[11px] text-amber-300/80 mb-3;
}

.stats-list {
  @apply flex flex-col gap-2;
}

.stats-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.5rem;
  row-gap: 0.25rem;
}

.stats-label {
  @apply text-xs text-slate-300 truncate;
}

.stats-value {
  @apply text-xs text-emerald-300 tabular-nums;
}

.stats-row-placeholder .stats-label {
  @apply text-slate-400;
}

.stats-row-placeholder .stats-value {
  @apply text-slate-500;
}

.stats-unit {
  @apply text-[10px] text-slate-400 ml-1;
}

.stats-bar {
  grid-column: 1 / -1;
  height: 6px;
  @apply bg-slate-800 rounded-sm overflow-hidden border border-slate-700/70;
}

.stats-bar-fill {
  height: 100%;
  @apply bg-emerald-500/80;
}

.type-grid {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: 0.5rem;
}

.type-grid-single {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
}

.selection-card {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg p-3;
}

.selection-label {
  @apply text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1;
}

.selection-value {
  @apply flex flex-col gap-1;
}

.selection-empty {
  @apply text-xs text-slate-500;
}

.selection-expanded {
  @apply bg-slate-900/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 flex flex-col gap-1.5;
}

.selection-expanded-header {
  @apply flex items-center justify-between gap-4;
}

.selection-title {
  @apply flex flex-col gap-1;
}

.selection-title-label {
  @apply text-xs uppercase tracking-wide text-emerald-300 font-semibold;
}

.selection-title-name {
  @apply text-sm font-semibold text-slate-100;
}

.selection-change-btn {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10 transition-colors;
}

.selection-expanded-body {
  @apply flex flex-col gap-1 text-xs text-slate-200;
}

.selection-expanded-line {
  @apply text-slate-200;
}

.equipment-line {
  min-height: 18px;
}

@media (max-width: 1024px) {
  .list-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .list-grid {
    grid-template-columns: 1fr;
  }
  .list-item {
    min-height: 64px;
  }
}
</style>
