<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import type { FitMode, FitConnectionRow, FitGroupRow, FitEquipmentOption } from '@/components/ship-build/fitTypes'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import type { EquipmentType, ShipEquipmentSize, X4Equipment, X4EquipmentType, X4Ship, X4SlotTag } from '@/types/x4'
import slotTagsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/slot_tags.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import equipmentTypesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipment_types.json'
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'
import ShipStoragePanel from '@/components/ship-build/ShipStoragePanel.vue'

type AggregatedGroup = {
  key: string
  size: string
  label: string
  slotTypeLabel: string
  totalCount: number
  tags: string[]
  connectionKeys: string[]
  options: FitEquipmentOption[]
  groupRows: FitGroupRow[]
}

type SlotTarget = {
  key: string
  label: string
  size: string
  slotTypeLabel: string
  count: number
  totalCount: number
  tags: string[]
  options: FitEquipmentOption[]
  connectionKeys: string[]
}

type GroupTabItem = {
  key: string
  label: string
  size: string
  count: number
}

type GroupTabRow = {
  key: string
  size: string
  testId: string
  tabs: GroupTabItem[]
}

type PickerCandidateItem = {
  id: string | null
  name: string
  mk: string | null
  race: string | null
  tags: string[]
}

const props = defineProps<{
  wide?: boolean
}>()

const emit = defineEmits<{
  'picker-open': [slotType: string, equipmentId: string | null, isShield: boolean]
  'picker-close': []
  'update:highlightedEquipmentId': [id: string | null]
  'update:pickerTarget': [target: SlotTarget | null]
  'update:pickerMode': [mode: FitMode]
}>()

const shipBuildStore = useShipBuildStore()
const { selectedShip, blueprint, mockTagPatch } = storeToRefs(shipBuildStore)
const { applyConnectionAssignment, setConnectionAssignmentCount, enterShipSelector } = shipBuildStore

// Equipment map for stats lookup
const equipmentMap = new Map<string, X4Equipment>()
;(equipmentsRaw as X4Equipment[]).forEach((eq) => {
  equipmentMap.set(eq.id, eq)
})

// Get first summary (Label Value Unit, right column, top row)
function getEquipmentSummary1(equipmentId: string): { labelKey: string; value: string; unit: string } {
  const equipment = equipmentMap.get(equipmentId)
  if (!equipment || !selectedShip.value) return { labelKey: '', value: '', unit: '' }

  const { summary } = useEquipmentStats(equipment, selectedShip.value as X4Ship)
  if (!summary.value) return { labelKey: '', value: '', unit: '' }

  const s = summary.value as any
  const type = equipment.type

  if (type === 'weapon') return { labelKey: 'ship_build.equipment_burst_dps', value: String(Math.round(s.burstDPS)), unit: 'MW' }
  if (type === 'turret') return { labelKey: 'ship_build.equipment_sustained_dps', value: String(Math.round(s.sustainedDPS)), unit: 'MW' }
  if (type === 'shield') return { labelKey: 'ship_build.equipment_shield_max', value: String(Math.round(s.shieldMax)), unit: 'MJ' }
  if (type === 'engine') return { labelKey: 'ship_build.equipment_speed', value: String(s.speed), unit: 'm/s' }
  if (type === 'thruster') return { labelKey: 'ship_build.equipment_strafe_speed', value: String(s.strafeSpeed), unit: 'm/s' }

  return { labelKey: '', value: '', unit: '' }
}

// Get second summary (Label Value Unit, right column, bottom row)
function getEquipmentSummary2(equipmentId: string): { labelKey: string; value: string; unit: string } {
  const equipment = equipmentMap.get(equipmentId)
  if (!equipment || !selectedShip.value) return { labelKey: '', value: '', unit: '' }

  const { summary } = useEquipmentStats(equipment, selectedShip.value as X4Ship)
  if (!summary.value) return { labelKey: '', value: '', unit: '' }

  const s = summary.value as any
  const type = equipment.type

  if (type === 'weapon') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'turret') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'shield') return { labelKey: 'ship_build.equipment_shield_delay', value: String(s.shieldDelay), unit: 's' }
  if (type === 'engine') return { labelKey: 'ship_build.equipment_travel_speed', value: String(s.travelSpeed), unit: 'm/s' }
  if (type === 'thruster') return { labelKey: 'ship_build.equipment_yaw_rate', value: s.yawRate.toFixed(2), unit: 'rad/s' }

  return { labelKey: '', value: '', unit: '' }
}

// 本地 connectionKeyMap：从 connectionRows 构建
const localConnectionKeyMap = computed(() => {
  const map = new Map<string, { slotType: string; groupName: string; isShield: boolean; count: number }>()
  connectionRows.value.forEach((row) => {
    map.set(row.connectionKey, {
      slotType: row.slotType,
      groupName: row.groupName,
      isShield: row.slotType === 'shield',
      count: row.count
    })
  })
  return map
})

const handlePickerOpenChange = (open: boolean) => {
  if (open) {
    // 打开时，获取当前槽位的 slotType, 已选装备ID, 是否为 shield
    const target = slotTargets.value.find(t => t.key === expandedSlotKey.value)
    const connectionKey = target?.connectionKeys?.[0] || ''
    const slotType = target
      ? localConnectionKeyMap.value.get(connectionKey)?.slotType || ''
      : expandedSlotKey.value?.split('::')[1] || ''  // 从 expandedSlotKey 解析 slotType
    const equipmentId = target ? selectedForConnectionKeys(target.connectionKeys) || null : null
    const isShield = target
      ? localConnectionKeyMap.value.get(connectionKey)?.isShield ?? false
      : expandedSlotKey.value?.includes('::shield') || false
    emit('picker-open', slotType, equipmentId, isShield)
  } else {
    emit('picker-close')
  }
}

const { t } = useI18n()
const { translateSlotTag, translateEquipment, translateEquipmentType, translateShip } = useX4I18n()
const slotTags = slotTagsRaw as X4SlotTag[]
const slotTagMap = new Map<string, X4SlotTag>(slotTags.map((tag) => [tag.id, tag]))
const equipments = equipmentsRaw as X4Equipment[]
const equipmentTypes = equipmentTypesRaw as X4EquipmentType[]
const equipmentTypeMap = new Map<EquipmentType, X4EquipmentType>()
equipmentTypes.forEach((type) => {
  equipmentTypeMap.set(type.id, type)
})

const normalizeTagList = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === 'string')
}

const resolveSize = (
  primary?: ShipEquipmentSize,
  fallback?: ShipEquipmentSize
): ShipEquipmentSize | null => primary ?? fallback ?? null

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
      const connectionSet = new Set(connectionTags)
      return equipmentTags.every((tag) => connectionSet.has(tag))
    })
    .map((equipment) => ({
      id: equipment.id,
      name: translateEquipment(equipment),
      mk: equipment.mk || null,
      race: equipment.race || null,
      tags: normalizeTagList(equipment.slotTags)
    }))
    .sort((a, b) => a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
}

const connectionRows = computed<FitConnectionRow[]>(() => {
  if (!selectedShip.value) return []

  const rows: FitConnectionRow[] = []
  selectedShip.value.slots.forEach((slot, slotIndex) => {
    slot.groups.forEach((group, groupIndex) => {
      const baseKey = `${selectedShip.value!.id}::${slot.type}::${slotIndex}::${groupIndex}`
      const patch = mockTagPatch.value
      const patchItem = patch?.targetShipId === selectedShip.value!.id ? patch.connections[baseKey] : null
      const connection = group.connection
      const connectionSize = resolveSize(patchItem?.size, connection?.size)
      if (!connectionSize) return
      const sourceTags = patchItem?.tags || connection?.tags || []
      const tags = normalizeTagList(sourceTags)
      const typeDef = equipmentTypeMap.get(slot.type)

      rows.push({
        connectionKey: baseKey,
        slotType: slot.type,
        parentSlotType: slot.type,
        parentConnectionSize: connectionSize,
        parentConnectionTags: [...tags],
        slotTypeLabel: typeDef ? translateEquipmentType(typeDef) : slot.type,
        groupName: patchItem?.groupName || group.group,
        size: connectionSize,
        tags,
        count: connection?.count || 0,
        options: getEquipmentCandidates(slot.type, connectionSize, tags)
      })

      const shieldConnection = connection?.shield
      const shieldKey = `${baseKey}::shield`
      const shieldPatchItem = patch?.targetShipId === selectedShip.value!.id ? patch.connections[shieldKey] : null
      const shieldDef = shieldConnection || group.connection?.shield
      const shieldTags = shieldPatchItem
        ? normalizeTagList(shieldPatchItem.tags)
        : (shieldDef ? normalizeTagList(shieldDef.tags) : [])
      const shieldSize = shieldPatchItem
        ? resolveSize(shieldPatchItem.size, shieldDef?.size)
        : resolveSize(undefined, shieldDef?.size)
      if (!shieldSize) return
      const shieldTypeDef = equipmentTypeMap.get('shield')
      const shieldTypeLabel = shieldTypeDef ? translateEquipmentType(shieldTypeDef) : 'shield'
      rows.push({
        connectionKey: shieldKey,
        slotType: 'shield',
        parentSlotType: slot.type,
        parentConnectionSize: connectionSize,
        parentConnectionTags: [...tags],
        slotTypeLabel: shieldTypeLabel,
        groupName: shieldPatchItem?.groupName || group.group,
        size: shieldSize,
        tags: shieldTags,
        count: shieldDef?.count || 0,
        options: getEquipmentCandidates('shield', shieldSize, shieldTags)
      })
    })
  })

  return rows
})

const selectedByConnection = computed<Record<string, string | null>>(() => {
  const result: Record<string, string | null> = {}
  if (!blueprint.value || !selectedShip.value) return result

  const ship = selectedShip.value
  ship.slots.forEach((slot, slotIndex) => {
    slot.groups.forEach((group, groupIndex) => {
      const groupData = blueprint.value!.connections
        .find(c => c.slot_type === slot.type)
        ?.group.find(g => g.group === group.group)
      const baseKey = `${ship.id}::${slot.type}::${slotIndex}::${groupIndex}`

      if (groupData) {
        result[baseKey] = groupData.equipment_id || null
        if (groupData.shield) {
          result[`${baseKey}::shield`] = groupData.shield.equipment_id || null
        }
      } else {
        result[baseKey] = null
        if (group.connection?.shield) {
          result[`${baseKey}::shield`] = null
        }
      }
    })
  })

  return result
})

const equippedCountByConnection = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {}
  if (!selectedShip.value) return result

  const ship = selectedShip.value
  ship.slots.forEach((slot, slotIndex) => {
    slot.groups.forEach((group, groupIndex) => {
      const groupData = blueprint.value?.connections
        .find(c => c.slot_type === slot.type)
        ?.group.find(g => g.group === group.group)
      const baseKey = `${ship.id}::${slot.type}::${slotIndex}::${groupIndex}`

      result[baseKey] = groupData?.equipment_id ? Math.max(0, groupData.count || 0) : 0
      if (group.connection?.shield) {
        const shieldKey = `${baseKey}::shield`
        result[shieldKey] = groupData?.shield?.equipment_id ? Math.max(0, groupData.shield.count || 0) : 0
      }
    })
  })

  return result
})

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
    const optionMap = new Map(existing.options.map((item) => [item.id, item]))
    row.options.forEach((item) => optionMap.set(item.id, item))
    existing.options = Array.from(optionMap.values()).sort((a, b) => a.id > b.id ? 1 : a.id < b.id ? -1 : 0)
  })

  return Array.from(grouped.values())
})

const fitMode = ref<FitMode>('connection')
const activeSlotType = ref<'engine' | 'shield' | 'weapon' | 'turret' | 'thruster' | 'consumables' | 'units' | ''>('')
const activeTabKey = ref('')
const expandedSlotKey = ref<string | null>(null)
const pendingExpandedConnectionKeys = ref<string[] | null>(null)
const selectedRaceIds = ref<string[]>([])
const selectedMkIds = ref<string[]>([])
const selectedTagIds = ref<string[]>([])
const currentPage = ref(1)
const highlightedEquipmentId = ref<string | null>(null)
const draftCountByTarget = ref<Record<string, number>>({})

const slotTypeDefs = [
  { id: 'engine', label: 'E', tooltip: 'ship_build.slot_engine' },
  { id: 'thruster', label: 'R', tooltip: 'ship_build.slot_thruster' },
  { id: 'shield', label: 'S', tooltip: 'ship_build.slot_shield' },
  { id: 'weapon', label: 'W', tooltip: 'ship_build.slot_weapon' },
  { id: 'turret', label: 'T', tooltip: 'ship_build.slot_turret' },
  { id: 'consumables', label: 'C', tooltip: 'ship_build.slot_consumables' },
  { id: 'units', label: 'U', tooltip: 'ship_build.slot_units' }
] as const

const sourceRows = computed(() => (fitMode.value === 'connection' ? connectionRows.value : groupRows.value))

const sizeRank = (size: string) => {
  if (size === 'extralarge') return 0
  if (size === 'large') return 1
  if (size === 'medium') return 2
  if (size === 'small') return 3
  return 4
}

const buildTagSignature = (tags: string[]) => [...tags].sort().join('&')

const sizeShort = (size: string) => {
  if (size === 'small') return 'S'
  if (size === 'medium') return 'M'
  if (size === 'large') return 'L'
  if (size === 'extralarge') return 'XL'
  return size.toUpperCase()
}

const mergeOptions = (rows: Array<{ options: FitEquipmentOption[] }>) => {
  const optionMap = new Map<string, FitEquipmentOption>()
  rows.forEach((row) => row.options.forEach((opt) => optionMap.set(opt.id, opt)))
  return Array.from(optionMap.values()).sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
}

const mergeTags = (rows: Array<{ tags: string[] }>) => {
  const set = new Set<string>()
  rows.forEach((row) => row.tags.forEach((tag) => set.add(tag)))
  return Array.from(set)
}

const getSlotBucket = (row: FitConnectionRow | FitGroupRow) => {
  if (row.slotType === 'shield') return row.parentSlotType
  return row.slotType
}

const setMode = (mode: FitMode) => {
  if (expandedSlotKey.value) {
    const current = slotTargets.value.find((item) => item.key === expandedSlotKey.value)
    pendingExpandedConnectionKeys.value = current ? [...current.connectionKeys] : null
  }
  fitMode.value = mode
}

const availableSlotTypes = computed(() => {
  const set = new Set(sourceRows.value.map((row) => getSlotBucket(row as FitConnectionRow | FitGroupRow)))
  // Always include consumables (C) and units (U) slot types for storage panel
  const storageSlotTypes = ['consumables', 'units']
  return slotTypeDefs.filter((item) => set.has(item.id) || storageSlotTypes.includes(item.id))
})

watch(
  [availableSlotTypes, () => fitMode.value],
  ([types]) => {
    const firstType = types[0]?.id || ''
    if (!types.some((item) => item.id === activeSlotType.value)) {
      activeSlotType.value = firstType
    }
  },
  { immediate: true }
)

const slotScopedRows = computed(() => {
  return sourceRows.value.filter((row) => !activeSlotType.value || getSlotBucket(row as FitConnectionRow | FitGroupRow) === activeSlotType.value)
})

const primaryConnectionRows = computed(() => {
  if (fitMode.value !== 'connection') return [] as FitConnectionRow[]
  return (slotScopedRows.value as FitConnectionRow[]).filter((row) => row.slotType === activeSlotType.value)
})

const primaryGroupRows = computed(() => {
  if (fitMode.value !== 'group') return [] as FitGroupRow[]
  return (slotScopedRows.value as FitGroupRow[]).filter((row) => row.slotType === activeSlotType.value)
})

const aggregatedPrimaryGroups = computed<AggregatedGroup[]>(() => {
  const bySemanticKey = new Map<string, FitGroupRow[]>()
  primaryGroupRows.value.forEach((row) => {
    const tagSignature = buildTagSignature(row.tags || [])
    const semanticKey = `${row.size}|${tagSignature}`
    const list = bySemanticKey.get(semanticKey) || []
    list.push(row)
    bySemanticKey.set(semanticKey, list)
  })

  const baseGroups = Array.from(bySemanticKey.entries())
    .sort((a, b) => {
      const aSize = a[1][0]?.size || 'unknown'
      const bSize = b[1][0]?.size || 'unknown'
      if (sizeRank(aSize) !== sizeRank(bSize)) return sizeRank(aSize) - sizeRank(bSize)
      return a[0].localeCompare(b[0])
    })
    .map(([semanticKey, rows]) => ({
      key: `agg-primary-${semanticKey}`,
      size: rows[0]?.size || 'unknown',
      label: '',
      slotTypeLabel: rows[0]?.slotTypeLabel || '',
      totalCount: rows.reduce((sum, row) => sum + row.totalCount, 0),
      tags: mergeTags(rows),
      connectionKeys: rows.flatMap((row) => row.connectionKeys),
      options: mergeOptions(rows),
      groupRows: rows
    }))

  const countBySize = new Map<string, number>()
  baseGroups.forEach((group) => countBySize.set(group.size, (countBySize.get(group.size) || 0) + 1))
  const seenBySize = new Map<string, number>()

  return baseGroups.map((group) => {
    const seen = (seenBySize.get(group.size) || 0) + 1
    seenBySize.set(group.size, seen)
    const total = countBySize.get(group.size) || 0
    const suffix = total > 1 ? String(seen) : ''
    return {
      ...group,
      label: `${sizeShort(group.size)}${suffix}`
    }
  })
})

const groupTabs = computed<GroupTabItem[]>(() => {
  if (fitMode.value === 'group') {
    return aggregatedPrimaryGroups.value.map((group) => ({
      key: group.key,
      label: group.label,
      size: group.size,
      count: group.totalCount
    }))
  }

  const rows = [...primaryConnectionRows.value]
    .sort((a, b) => {
      const rankDiff = sizeRank(a.size) - sizeRank(b.size)
      if (rankDiff !== 0) return rankDiff
      return a.connectionKey.localeCompare(b.connectionKey)
    })
  const totalBySize = new Map<string, number>()
  rows.forEach((row) => totalBySize.set(row.size, (totalBySize.get(row.size) || 0) + 1))

  const seenBySize = new Map<string, number>()
  return rows.map((row) => {
    const seen = (seenBySize.get(row.size) || 0) + 1
    seenBySize.set(row.size, seen)
    const total = totalBySize.get(row.size) || 0
    const suffix = total > 1 ? String(seen) : ''
    return {
      key: row.connectionKey,
      label: `${sizeShort(row.size)}${suffix}`,
      size: row.size,
      count: row.count
    }
  })
})

const groupedConnectionTabRows = computed<GroupTabRow[]>(() => {
  if (fitMode.value !== 'connection') return []
  const totalPositions = primaryConnectionRows.value.reduce((sum, row) => sum + row.count, 0)
  if (totalPositions <= 8) {
    return [{
      key: 'size-mixed',
      size: 'mixed',
      testId: 'group-tab-row-mixed',
      tabs: groupTabs.value
    }]
  }

  const sizeOrder = ['extralarge', 'large', 'medium', 'small']
  const grouped: GroupTabRow[] = []
  sizeOrder.forEach((size) => {
    const tabs = groupTabs.value.filter((tab) => tab.size === size)
    if (tabs.length === 0) return
    if (tabs.length > 8) {
      // 同一 size 超过 8 个时分两行，按平均值分配（不是前8后剩余）
      const firstRowCount = Math.ceil(tabs.length / 2)
      grouped.push({
        key: `size-${size}-1`,
        size,
        testId: `group-tab-row-${size}-1`,
        tabs: tabs.slice(0, firstRowCount)
      })
      grouped.push({
        key: `size-${size}-2`,
        size,
        testId: `group-tab-row-${size}-2`,
        tabs: tabs.slice(firstRowCount)
      })
      return
    }
    grouped.push({
      key: `size-${size}`,
      size,
      testId: `group-tab-row-${size}`,
      tabs
    })
  })
  return grouped
})

const renderGroupTabRows = computed<GroupTabRow[]>(() => {
  if (fitMode.value === 'connection') return groupedConnectionTabRows.value
  return [{
    key: 'size-all',
    size: 'all',
    testId: 'group-tab-row-all',
    tabs: groupTabs.value
  }]
})

watch(
  [groupTabs, () => fitMode.value],
  ([tabs]) => {
    if (!tabs.some((tab) => tab.key === activeTabKey.value)) {
      activeTabKey.value = tabs[0]?.key || ''
    }
  },
  { immediate: true }
)

const activeConnectionRow = computed<FitConnectionRow | null>(() => {
  if (fitMode.value !== 'connection') return null
  return primaryConnectionRows.value.find((row) => row.connectionKey === activeTabKey.value) || null
})

const activePrimaryAggregate = computed<AggregatedGroup | null>(() => {
  if (fitMode.value !== 'group') return null
  return aggregatedPrimaryGroups.value.find((group) => group.key === activeTabKey.value) || null
})

const selectedForConnectionKeys = (keys: string[]) => {
  const selected = keys
    .map((key) => selectedByConnection.value[key])
    .filter((item): item is string => Boolean(item))
  if (selected.length === 0) return ''
  const first = selected[0]
  if (!first) return ''
  return selected.every((item) => item === first) ? first : '__mixed__'
}

const connectionCountMap = computed(() => {
  const map = new Map<string, number>()
  connectionRows.value.forEach((row) => map.set(row.connectionKey, row.count))
  return map
})

const selectedCountForConnectionKeys = (keys: string[]) => {
  return keys.reduce((sum, key) => sum + (equippedCountByConnection.value[key] || 0), 0)
}

const totalCountForConnectionKeys = (keys: string[]) => {
  return keys.reduce((sum, key) => sum + (connectionCountMap.value.get(key) || 0), 0)
}

const relatedShieldConnectionRows = computed<FitConnectionRow[]>(() => {
  if (fitMode.value !== 'connection' || !activeConnectionRow.value) return []
  const targetShieldKey = `${activeConnectionRow.value.connectionKey}::shield`
  return connectionRows.value.filter((row) => row.connectionKey === targetShieldKey)
})

const relatedShieldAggregates = computed<AggregatedGroup[]>(() => {
  if (fitMode.value !== 'group' || !activePrimaryAggregate.value) return []

  const shieldRows = activePrimaryAggregate.value.connectionKeys
    .map((key) => connectionRows.value.find((row) => row.connectionKey === `${key}::shield`))
    .filter((row): row is FitConnectionRow => Boolean(row))

  const bySemanticKey = new Map<string, FitConnectionRow[]>()
  shieldRows.forEach((row) => {
    const parentTagSignature = buildTagSignature(row.parentConnectionTags || [])
    const shieldTagSignature = buildTagSignature(row.tags || [])
    const semanticKey = `${row.parentConnectionSize}|${parentTagSignature}|${row.size}|${shieldTagSignature}`
    const list = bySemanticKey.get(semanticKey) || []
    list.push(row)
    bySemanticKey.set(semanticKey, list)
  })

  return Array.from(bySemanticKey.entries())
    .sort((a, b) => {
      const aSize = a[1][0]?.size || 'unknown'
      const bSize = b[1][0]?.size || 'unknown'
      return sizeRank(aSize) - sizeRank(bSize)
    })
    .map(([semanticKey, rows]) => ({
      key: `agg-shield-${semanticKey}`,
      size: rows[0]?.size || 'unknown',
      label: sizeShort(rows[0]?.size || 'unknown'),
      slotTypeLabel: rows[0]?.slotTypeLabel || '',
      totalCount: rows.reduce((sum, row) => sum + row.count, 0),
      tags: mergeTags(rows),
      connectionKeys: rows.map((row) => row.connectionKey),
      options: mergeOptions(rows),
      groupRows: []
    }))
})

const slotTargets = computed<SlotTarget[]>(() => {
  if (fitMode.value === 'connection') {
    const targets: SlotTarget[] = []
    if (activeConnectionRow.value) {
      targets.push({
        key: activeConnectionRow.value.connectionKey,
        label: `${sizeShort(activeConnectionRow.value.size)} ${activeConnectionRow.value.slotTypeLabel}`,
        size: activeConnectionRow.value.size,
        slotTypeLabel: activeConnectionRow.value.slotTypeLabel,
        count: selectedCountForConnectionKeys([activeConnectionRow.value.connectionKey]),
        totalCount: activeConnectionRow.value.count,
        tags: activeConnectionRow.value.tags,
        options: activeConnectionRow.value.options,
        connectionKeys: [activeConnectionRow.value.connectionKey]
      })
    }

    relatedShieldConnectionRows.value.forEach((row) => {
      targets.push({
        key: row.connectionKey,
        label: `${sizeShort(row.size)} ${row.slotTypeLabel}`,
        size: row.size,
        slotTypeLabel: row.slotTypeLabel,
        count: selectedCountForConnectionKeys([row.connectionKey]),
        totalCount: row.count,
        tags: row.tags,
        options: row.options,
        connectionKeys: [row.connectionKey]
      })
    })

    return targets
  }

  const targets: SlotTarget[] = []
  if (activePrimaryAggregate.value) {
    targets.push({
      key: activePrimaryAggregate.value.key,
      label: `${sizeShort(activePrimaryAggregate.value.size)} ${activePrimaryAggregate.value.slotTypeLabel}`,
      size: activePrimaryAggregate.value.size,
      slotTypeLabel: activePrimaryAggregate.value.slotTypeLabel,
      count: selectedCountForConnectionKeys(activePrimaryAggregate.value.connectionKeys),
      totalCount: totalCountForConnectionKeys(activePrimaryAggregate.value.connectionKeys),
      tags: activePrimaryAggregate.value.tags,
      options: activePrimaryAggregate.value.options,
      connectionKeys: activePrimaryAggregate.value.connectionKeys
    })
  }

  relatedShieldAggregates.value.forEach((group) => {
    targets.push({
      key: group.key,
      label: `${sizeShort(group.size)} ${group.slotTypeLabel}`,
      size: group.size,
      slotTypeLabel: group.slotTypeLabel,
      count: selectedCountForConnectionKeys(group.connectionKeys),
      totalCount: totalCountForConnectionKeys(group.connectionKeys),
      tags: group.tags,
      options: group.options,
      connectionKeys: group.connectionKeys
    })
  })

  return targets
})

const activeTarget = computed(() => slotTargets.value[0] || null)
const visibleCompatibilityTags = computed<X4SlotTag[]>(() => {
  const tags = activeTarget.value?.tags || []
  const unique = new Set<string>()
  const visible: X4SlotTag[] = []
  tags.forEach((tag) => {
    if (unique.has(tag)) return
    const def = slotTagMap.get(tag)
    if (!def) return
    unique.add(tag)
    visible.push(def)
  })
  return visible
})
const visibleCompatibilityTagLabels = computed(() => visibleCompatibilityTags.value.map((tag) => translateSlotTag(tag)))
const compatibilitySlotLines = computed(() => slotTargets.value.map((item) => `${item.label} x${item.totalCount}`))

const pickerTarget = computed(() => slotTargets.value.find((item) => item.key === expandedSlotKey.value) || null)
const pickerInitialEquipmentId = computed<string | null>(() => {
  if (!pickerTarget.value) return null
  const selected = selectedForConnectionKeys(pickerTarget.value.connectionKeys)
  if (!selected || selected === '__mixed__') return null
  return selected
})
const pickerOptions = computed(() => pickerTarget.value?.options || [])
const isPickerLayout = computed(() => Boolean(pickerTarget.value))

const normalizeRace = (option: FitEquipmentOption) => option.race || 'gen'
const normalizeMk = (option: FitEquipmentOption) => option.mk || ''
const normalizeTags = (option: FitEquipmentOption) => option.tags || []
const tagDefs = ['standard', 'advanced', 'xenon', 'mining', 'missile', 'highpower']

const filterByRace = (candidates: FitEquipmentOption[], raceIds: string[]) => {
  if (raceIds.length === 0) return candidates
  return candidates.filter((item) => raceIds.includes(normalizeRace(item)))
}
const filterByMk = (candidates: FitEquipmentOption[], mkIds: string[]) => {
  if (mkIds.length === 0) return candidates
  return candidates.filter((item) => mkIds.includes(normalizeMk(item)))
}
const filterByTags = (candidates: FitEquipmentOption[], tagIds: string[]) => {
  if (tagIds.length === 0) return candidates
  // Tag 多选使用并集语义：命中任一已选 Tag 即保留
  return candidates.filter((item) => tagIds.some((tagId) => normalizeTags(item).includes(tagId)))
}

const availableRaceIds = computed(() => new Set(pickerOptions.value.map((item) => normalizeRace(item))))
const availableMkIds = computed(() => new Set(pickerOptions.value.map((item) => normalizeMk(item)).filter(Boolean)))
const availableTagIds = computed(() => new Set(pickerOptions.value.flatMap((item) => normalizeTags(item))))

const raceCountMap = computed(() => {
  const pool = filterByMk(filterByTags(pickerOptions.value, selectedTagIds.value), selectedMkIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    const raceId = normalizeRace(item)
    counts.set(raceId, (counts.get(raceId) || 0) + 1)
  })
  return counts
})
const mkCountMap = computed(() => {
  const pool = filterByRace(filterByTags(pickerOptions.value, selectedTagIds.value), selectedRaceIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    const mkId = normalizeMk(item)
    if (!mkId) return
    counts.set(mkId, (counts.get(mkId) || 0) + 1)
  })
  return counts
})
const tagCountMap = computed(() => {
  const pool = filterByRace(filterByMk(pickerOptions.value, selectedMkIds.value), selectedRaceIds.value)
  const counts = new Map<string, number>()
  pool.forEach((item) => {
    normalizeTags(item).forEach((tagId) => counts.set(tagId, (counts.get(tagId) || 0) + 1))
  })
  return counts
})

const raceTags = computed(() => Array.from(availableRaceIds.value)
  .sort((a, b) => a.localeCompare(b))
  .map((id) => ({ id, label: id.toUpperCase(), count: raceCountMap.value.get(id) || 0 })))
const mkTags = computed(() => Array.from(availableMkIds.value)
  .sort((a, b) => Number(a) - Number(b))
  .map((id) => ({ id, label: `MK${id}`, count: mkCountMap.value.get(id) || 0 })))
const featureTags = computed(() => tagDefs
  .filter((id) => availableTagIds.value.has(id))
  .map((id) => {
    const def = slotTagMap.get(id)
    return {
      id,
      label: def ? translateSlotTag(def) : id.toUpperCase(),
      count: tagCountMap.value.get(id) || 0
    }
  }))

const filteredCandidates = computed(() => {
  const byRace = filterByRace(pickerOptions.value, selectedRaceIds.value)
  const byMk = filterByMk(byRace, selectedMkIds.value)
  return filterByTags(byMk, selectedTagIds.value)
})
const pageSize = 10
const listWithEmptyOption = computed<PickerCandidateItem[]>(() => [
  { id: null, name: t('ship_build.fit_empty_slot'), mk: null, race: null, tags: [] },
  ...filteredCandidates.value
])
const totalPages = computed(() => {
  const total = Math.ceil(listWithEmptyOption.value.length / pageSize)
  return total > 0 ? total : 1
})
const pagedCandidates = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return listWithEmptyOption.value.slice(start, start + pageSize)
})

const toggleTag = (items: string[], setItems: (next: string[]) => void, id: string) => {
  if (items.includes(id)) return setItems(items.filter((item) => item !== id))
  return setItems([...items, id])
}
const toggleRace = (id: string) => {
  toggleTag(selectedRaceIds.value, (next) => { selectedRaceIds.value = next }, id)
  currentPage.value = 1
}
const toggleMk = (id: string) => {
  toggleTag(selectedMkIds.value, (next) => { selectedMkIds.value = next }, id)
  currentPage.value = 1
}
const toggleFeatureTag = (id: string) => {
  toggleTag(selectedTagIds.value, (next) => { selectedTagIds.value = next }, id)
  currentPage.value = 1
}

const selectedNameForTarget = (target: SlotTarget) => {
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  if (!selectedId) {
    if (isSingleCandidate(target) && target.options[0]) return target.options[0].name
    return t('ship_build.fit_empty_slot')
  }
  if (selectedId === '__mixed__') return t('ship_build.fit_mixed_selection')
  return target.options.find((item) => item.id === selectedId)?.name || selectedId
}
const isMixedSelectionInGroup = (target: SlotTarget) => fitMode.value === 'group' && selectedForConnectionKeys(target.connectionKeys) === '__mixed__'

const getCandidateCount = (target: SlotTarget) => target.options.length
const isSingleCandidate = (target: SlotTarget) => getCandidateCount(target) === 0
const isSingleCandidateSelected = (target: SlotTarget) => {
  if (!isSingleCandidate(target)) return false
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  return selectedId !== '' && selectedId === target.options[0]?.id
}

const openPicker = (slotKey: string) => {
  expandedSlotKey.value = slotKey
  handlePickerOpenChange(true)
}

const closePicker = () => {
  expandedSlotKey.value = null
  handlePickerOpenChange(false)
}

const handleSlotClick = (target: SlotTarget) => {
  if (isSingleCandidate(target)) {
    const candidateId = target.options[0]?.id || null
    const selectedId = selectedForConnectionKeys(target.connectionKeys)
    const shouldFillToFullInGroup = fitMode.value === 'group' && selectedId === candidateId && target.count < target.totalCount
    const nextId = shouldFillToFullInGroup
      ? candidateId
      : selectedId === candidateId ? null : candidateId
    target.connectionKeys.forEach((connectionKey) => {
      applyConnectionAssignment({ connectionKey, equipmentId: nextId })
    })
    return
  }
  openPicker(target.key)
}

const handleSlotTypeClick = (slotType: typeof activeSlotType.value) => {
  activeSlotType.value = slotType
  if (expandedSlotKey.value) closePicker()
}

const jumpToTab = (tabKey: string) => {
  if (expandedSlotKey.value) {
    const current = slotTargets.value.find((item) => item.key === expandedSlotKey.value)
    pendingExpandedConnectionKeys.value = current ? [...current.connectionKeys] : null
  }
  activeTabKey.value = tabKey
}

const handlePickerConfirm = (equipmentId: string | null) => {
  if (!pickerTarget.value) return
  pickerTarget.value.connectionKeys.forEach((connectionKey) => {
    applyConnectionAssignment({ connectionKey, equipmentId })
  })
  closePicker()
}

const clampToTargetCount = (target: SlotTarget, raw: number) => {
  const safe = Number.isFinite(raw) ? raw : 0
  return Math.max(0, Math.min(target.totalCount, Math.round(safe)))
}

const sliderStepForTarget = (target: SlotTarget) => {
  if (fitMode.value === 'group') return Math.max(1, target.totalCount)
  return 1
}

const isCountSliderDisabled = (target: SlotTarget) => {
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  if (selectedId === '' || selectedId === '__mixed__') return true
  return target.totalCount <= 0
}

const getDisplayedCount = (target: SlotTarget) => {
  return draftCountByTarget.value[target.key] ?? target.count
}

const distributeCountByCapacity = (connectionKeys: string[], total: number) => {
  const maxByKey = connectionKeys.map((key) => ({
    key,
    max: Math.max(0, connectionCountMap.value.get(key) || 0)
  }))
  const sumMax = maxByKey.reduce((sum, item) => sum + item.max, 0)
  const clampedTotal = Math.max(0, Math.min(total, sumMax))

  if (sumMax === 0 || clampedTotal === 0) {
    return Object.fromEntries(connectionKeys.map((key) => [key, 0]))
  }
  if (clampedTotal === sumMax) {
    return Object.fromEntries(maxByKey.map((item) => [item.key, item.max]))
  }

  const allocations = maxByKey.map((item) => {
    const exact = (clampedTotal * item.max) / sumMax
    const base = Math.min(item.max, Math.floor(exact))
    return { ...item, exact, base, frac: exact - Math.floor(exact) }
  })

  let remaining = clampedTotal - allocations.reduce((sum, item) => sum + item.base, 0)
  allocations
    .sort((a, b) => b.frac - a.frac)
    .forEach((item) => {
      if (remaining <= 0) return
      if (item.base >= item.max) return
      item.base += 1
      remaining -= 1
    })

  return Object.fromEntries(allocations.map((item) => [item.key, item.base]))
}

const handleCountSliderRealtime = (target: SlotTarget, value: number) => {
  draftCountByTarget.value = {
    ...draftCountByTarget.value,
    [target.key]: clampToTargetCount(target, value)
  }
}

const handleCountSliderCommit = (target: SlotTarget, value: number) => {
  if (isCountSliderDisabled(target)) return
  const committed = clampToTargetCount(target, value)
  draftCountByTarget.value = {
    ...draftCountByTarget.value,
    [target.key]: committed
  }

  if (fitMode.value === 'group') {
    const distributed = distributeCountByCapacity(target.connectionKeys, committed)
    target.connectionKeys.forEach((connectionKey) => {
      setConnectionAssignmentCount({ connectionKey, count: distributed[connectionKey] || 0 })
    })
  } else {
    target.connectionKeys.forEach((connectionKey) => {
      setConnectionAssignmentCount({ connectionKey, count: committed })
    })
  }
}

watch(pickerTarget, (newTarget) => {
  selectedRaceIds.value = []
  selectedMkIds.value = []
  selectedTagIds.value = []
  currentPage.value = 1
  highlightedEquipmentId.value = pickerInitialEquipmentId.value
  emit('update:pickerTarget', newTarget)
})

watch(highlightedEquipmentId, (newId) => {
  emit('update:highlightedEquipmentId', newId)
})

watch(fitMode, (mode) => {
  emit('update:pickerMode', mode)
}, { immediate: true })

watch(filteredCandidates, () => {
  if (currentPage.value > totalPages.value) currentPage.value = 1
})

watch(slotTargets, () => {
  const validTargetKeys = new Set(slotTargets.value.map((target) => target.key))
  const cleanedDrafts: Record<string, number> = {}
  Object.entries(draftCountByTarget.value).forEach(([key, val]) => {
    if (!validTargetKeys.has(key)) return
    const target = slotTargets.value.find((item) => item.key === key)
    if (!target) return
    if (val === target.count) return
    cleanedDrafts[key] = val
  })
  draftCountByTarget.value = cleanedDrafts

  if (pendingExpandedConnectionKeys.value && pendingExpandedConnectionKeys.value.length > 0) {
    const anchor = new Set(pendingExpandedConnectionKeys.value)
    const mapped = slotTargets.value.find((target) => target.connectionKeys.some((key) => anchor.has(key)))
    expandedSlotKey.value = mapped?.key || slotTargets.value[0]?.key || null
    pendingExpandedConnectionKeys.value = null
  }

  if (expandedSlotKey.value && !slotTargets.value.some((target) => target.key === expandedSlotKey.value)) {
    expandedSlotKey.value = slotTargets.value[0]?.key || null
    if (!expandedSlotKey.value) handlePickerOpenChange(false)
  }
})
</script>

<template>
  <div class="col-span-12 panel-card" :class="wide ? 'lg:col-span-8' : 'lg:col-span-4'" data-testid="ship-build-panel-fit">
    <div class="panel-header">
      <span>{{ selectedShip ? translateShip(selectedShip) : $t('ship_build.panel_fit') }}</span>
      <button
        v-if="selectedShip"
        class="selection-change-btn"
        data-testid="ship-build-change-ship-fit-header"
        @click="enterShipSelector"
      >
        {{ t('ship_build.change_ship') }}
      </button>
    </div>
    <div class="arsenal-shell" data-testid="ship-build-fit-panel">
        <aside class="left-rail">
          <tippy
            v-for="slotType in availableSlotTypes"
            :key="slotType.id"
            theme="x4"
            :content="t(slotType.tooltip)"
            placement="right"
            :delay="[200, 0]"
          >
            <button
              class="slot-type-btn"
              :class="activeSlotType === slotType.id ? 'slot-type-btn-active' : ''"
              :data-testid="`slot-type-${slotType.id}`"
              @click="handleSlotTypeClick(slotType.id)"
            >
              {{ slotType.label }}
            </button>
          </tippy>
        </aside>

        <div class="arsenal-content">
          <main class="arsenal-main">
            <template v-if="isPickerLayout">
              <section class="picker-grid-row picker-grid-row-compact">
                <div class="picker-cell">
                  <div class="mode-tabs">
                    <button class="mode-tab mode-tab-tall" :class="fitMode === 'connection' ? 'active' : ''" @click="setMode('connection')">{{ t('ship_build.fit_mode_connection') }}</button>
                    <button class="mode-tab mode-tab-tall" :class="fitMode === 'group' ? 'active' : ''" @click="setMode('group')">{{ t('ship_build.fit_mode_group') }}</button>
                  </div>
                </div>
                <div class="picker-cell picker-right">
                  <div class="picker-actions-inline">
                    <button class="mode-tab mode-tab-tall picker-action-btn mr-1" data-testid="picker-cancel" @click="closePicker">{{ t('ui.cancel') }}</button>
                    <button class="mode-tab mode-tab-tall picker-action-btn" data-testid="picker-confirm" @click="handlePickerConfirm(highlightedEquipmentId)">{{ t('ship_build.fit_picker_confirm') }}</button>
                  </div>
                </div>
              </section>

              <section class="picker-grid-row picker-grid-row-tabs">
                <div class="picker-cell">
                  <div class="group-tabs picker-row-slot-tabs">
                    <div
                      v-for="row in renderGroupTabRows"
                      :key="row.key"
                      class="group-tab-row"
                      :data-testid="row.testId"
                    >
                      <button
                        v-for="tab in row.tabs"
                        :key="tab.key"
                        class="group-tab"
                        :class="activeTabKey === tab.key ? 'group-tab-active' : ''"
                        @click="jumpToTab(tab.key)"
                      >
                        {{ tab.label }}
                      </button>
                    </div>
                  </div>
                </div>
                <div class="picker-cell picker-right picker-right-tabs">
                  <div v-if="totalPages > 1" class="pager">
                    <button class="pager-btn" :disabled="currentPage === 1" @click="currentPage = currentPage - 1">&lt;</button>
                    <button
                      v-for="page in totalPages"
                      :key="page"
                      class="pager-btn"
                      :class="currentPage === page ? 'pager-btn-active' : ''"
                      :data-testid="`page-${page}`"
                      @click="currentPage = page"
                    >
                      {{ page }}
                    </button>
                    <button class="pager-btn" :disabled="currentPage === totalPages" @click="currentPage = currentPage + 1">&gt;</button>
                  </div>
                </div>
              </section>

              <section class="picker-grid-row">
                <div class="picker-cell">
                  <div class="picker-row3-left">
                    <section class="compatibility-box picker-compat-box">
                      <div class="filter-block">
                        <div class="filter-line">
                          <span class="filter-group">RACE</span>
                          <div class="filter-items-race" :class="raceTags.length > 3 ? 'filter-items-race-two-rows' : ''">
                            <button v-for="tag in raceTags" :key="`race-${tag.id}`" class="filter-chip" :class="selectedRaceIds.includes(tag.id) ? 'filter-chip-active' : ''" :data-testid="`race-${tag.id}`" @click="toggleRace(tag.id)">
                              {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
                            </button>
                          </div>
                        </div>
                        <div class="filter-line">
                          <span class="filter-group">MK</span>
                          <button v-for="tag in mkTags" :key="`mk-${tag.id}`" class="filter-chip" :class="selectedMkIds.includes(tag.id) ? 'filter-chip-active' : ''" :data-testid="`mk-${tag.id}`" @click="toggleMk(tag.id)">
                            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
                          </button>
                        </div>
                        <div class="filter-line">
                          <span class="filter-group">TAG</span>
                          <button v-for="tag in featureTags" :key="`tag-${tag.id}`" class="filter-chip" :class="selectedTagIds.includes(tag.id) ? 'filter-chip-active' : ''" :data-testid="`tag-${tag.id}`" @click="toggleFeatureTag(tag.id)">
                            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
                          </button>
                        </div>
                      </div>
                    </section>
                    <section class="slot-wall picker-row3-slot-wall">
                      <div v-for="target in slotTargets" :key="target.key" class="slot-stack">
                        <X4DualPhaseRangeSlider
                          class="slot-count-slider"
                          :model-value="getDisplayedCount(target)"
                          :min="0"
                          :max="target.totalCount"
                          :step="sliderStepForTarget(target)"
                          track-bg-color="rgb(30 41 59 / 1)"
                          track-border-color="rgb(51 65 85 / 0.7)"
                          fill-color="rgb(16 185 129 / 0.8)"
                          :disabled="isCountSliderDisabled(target)"
                          @update:model-value="handleCountSliderRealtime(target, $event)"
                          @commit="handleCountSliderCommit(target, $event)"
                        />
                        <button
                          class="slot-row"
                          :class="[
                            isSingleCandidateSelected(target) ? 'slot-row-highlight' : '',
                            expandedSlotKey === target.key ? 'slot-row-expanded' : ''
                          ]"
                          :data-testid="`slot-${target.key}`"
                          @click="handleSlotClick(target)"
                        >
                          <div class="slot-row-main">
                            <div class="slot-row-title">{{ target.label }}</div>
                            <div class="slot-row-value" :class="isMixedSelectionInGroup(target) ? 'slot-row-value-mixed' : ''">{{ selectedNameForTarget(target) }}</div>
                          </div>
                          <div class="slot-row-side">
                            <span class="slot-row-count">{{ getDisplayedCount(target) }}/{{ target.totalCount }}</span>
                            <span class="slot-row-candidate">{{ getCandidateCount(target) }}</span>
                          </div>
                        </button>
                      </div>
                      <div v-if="slotTargets.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
                    </section>
                  </div>
                </div>
                <div class="picker-cell picker-right">
                  <div class="candidate-list picker-candidate-list" data-testid="equipment-picker">
                    <button
                      v-for="item in pagedCandidates"
                      :key="item.id || '__empty__'"
                      class="candidate-item"
                      :class="highlightedEquipmentId === item.id ? 'candidate-item-active' : ''"
                      :data-testid="`candidate-${item.id || 'empty'}`"
                      @click="highlightedEquipmentId = item.id"
                    >
                      <div class="candidate-left">
                        <div class="candidate-name">{{ item.name }}</div>
                        <div class="candidate-meta">{{ item.race || 'GEN' }} · {{ item.mk ? `MK${item.mk}` : '-' }}</div>
                      </div>
                      <div v-if="item.id" class="candidate-right">
                        <div class="candidate-summary-1">
                          <span class="summary-label">{{ t(getEquipmentSummary1(item.id).labelKey) }}</span>
                          <span class="summary-value">{{ getEquipmentSummary1(item.id).value }}</span>
                          <span class="summary-unit">{{ getEquipmentSummary1(item.id).unit }}</span>
                        </div>
                        <div class="candidate-summary-2">
                          <span class="summary-label">{{ t(getEquipmentSummary2(item.id).labelKey) }}</span>
                          <span class="summary-value">{{ getEquipmentSummary2(item.id).value }}</span>
                          <span class="summary-unit">{{ getEquipmentSummary2(item.id).unit }}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </section>
            </template>

            <template v-else>
              <!-- C 槽 and U 槽: Storage Panel -->
              <ShipStoragePanel
                v-if="activeSlotType === 'consumables' || activeSlotType === 'units'"
                :selected-ship="selectedShip"
                :slot-type="activeSlotType as 'consumables' | 'units'"
              />

              <div v-else class="toolbar-row">
                <div class="mode-tabs">
                  <button class="mode-tab" :class="fitMode === 'connection' ? 'active' : ''" @click="setMode('connection')">{{ t('ship_build.fit_mode_connection') }}</button>
                  <button class="mode-tab" :class="fitMode === 'group' ? 'active' : ''" @click="setMode('group')">{{ t('ship_build.fit_mode_group') }}</button>
                </div>
              </div>

              <div class="group-tabs" v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'">
                <div
                  v-for="row in renderGroupTabRows"
                  :key="row.key"
                  class="group-tab-row"
                  :data-testid="row.testId"
                >
                  <button
                    v-for="tab in row.tabs"
                    :key="tab.key"
                    class="group-tab"
                    :class="activeTabKey === tab.key ? 'group-tab-active' : ''"
                    @click="jumpToTab(tab.key)"
                  >
                    {{ tab.label }}
                  </button>
                </div>
              </div>

              <section v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units' && visibleCompatibilityTags.length > 0" class="compatibility-box">
                <div class="compatibility-title">{{ t('ship_build.fit_compatibility') }}:</div>
                <div class="compatibility-line tags">{{ visibleCompatibilityTagLabels.join(' / ') }}</div>
                <div v-for="line in compatibilitySlotLines" :key="line" class="compatibility-line">{{ line }}</div>
              </section>

              <section v-if="activeSlotType !== 'consumables' && activeSlotType !== 'units'" class="slot-wall">
                <div v-for="target in slotTargets" :key="target.key" class="slot-stack">
                  <X4DualPhaseRangeSlider
                    class="slot-count-slider"
                    :model-value="getDisplayedCount(target)"
                    :min="0"
                    :max="target.totalCount"
                    :step="sliderStepForTarget(target)"
                    track-bg-color="rgb(30 41 59 / 1)"
                    track-border-color="rgb(51 65 85 / 0.7)"
                    fill-color="rgb(16 185 129 / 0.8)"
                    :disabled="isCountSliderDisabled(target)"
                    @update:model-value="handleCountSliderRealtime(target, $event)"
                    @commit="handleCountSliderCommit(target, $event)"
                  />
                  <button
                    class="slot-row"
                    :class="[
                      isSingleCandidateSelected(target) ? 'slot-row-highlight' : '',
                      expandedSlotKey === target.key ? 'slot-row-expanded' : ''
                    ]"
                    :data-testid="`slot-${target.key}`"
                    @click="handleSlotClick(target)"
                  >
                    <div class="slot-row-main">
                      <div class="slot-row-title">{{ target.label }}</div>
                      <div class="slot-row-value" :class="isMixedSelectionInGroup(target) ? 'slot-row-value-mixed' : ''">{{ selectedNameForTarget(target) }}</div>
                    </div>
                    <div class="slot-row-side">
                      <span class="slot-row-count">{{ getDisplayedCount(target) }}/{{ target.totalCount }}</span>
                      <span class="slot-row-candidate">{{ getCandidateCount(target) }}</span>
                    </div>
                  </button>
                </div>

                <div v-if="slotTargets.length === 0" class="empty-card">{{ t('ship_build.fit_no_equipment') }}</div>
              </section>
            </template>
          </main>
        </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 py-0 text-slate-200 text-sm font-semibold border-b border-slate-800/70;
}

.selection-change-btn {
  @apply px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10 transition-colors;
}

.arsenal-shell { @apply p-2 flex gap-2; }
.left-rail { @apply w-9 rounded border border-slate-700/70 flex flex-col items-center gap-2 py-2; }
.left-rail.locked { @apply opacity-60; }
.slot-type-btn { @apply w-6 h-6 rounded-full border border-slate-500/70 text-[10px] font-bold text-slate-200; }
.slot-type-btn-active { @apply border-emerald-300 text-emerald-100; }
.arsenal-content { @apply flex-1 min-w-0; }
.arsenal-main { @apply min-w-0; }
.toolbar-row { @apply flex items-center justify-between gap-2; }
.mode-tabs { @apply inline-flex items-center gap-1; }
.mode-tab { @apply px-2.5 py-1 text-xs font-semibold text-slate-200 border border-slate-700/60 rounded; }
.mode-tab.active { @apply border-emerald-300 text-emerald-100; }
.mode-tab:disabled { @apply opacity-40 cursor-not-allowed; }
.mode-tab-tall { @apply h-[25.6px] px-2 flex items-center; }
.picker-action-btn { @apply border-emerald-300 text-emerald-100; }
.group-tabs { @apply flex flex-col gap-1 mt-2; }
.group-tab-row { @apply flex flex-wrap items-center gap-1; }
.group-tab { @apply px-2.5 py-0.5 text-[11px] border border-slate-700/60 rounded text-slate-200; }
.group-tab-active { @apply border-emerald-300 text-emerald-100; }
.compatibility-box { @apply mt-2 rounded border border-slate-700/60 px-2 py-1.5; }
.compatibility-title { @apply text-xs text-slate-100 font-semibold mb-0.5; }
.compatibility-line { @apply text-[11px] text-slate-200; }
.compatibility-line.tags { @apply text-sky-200; }
.slot-wall { @apply min-w-0 mt-2 grid gap-2; }
.slot-stack { @apply grid gap-1; }
.slot-count-slider { @apply w-full; }
.slot-row { @apply rounded border border-slate-700 px-2 py-2 flex items-center justify-between text-left; }
.slot-row-highlight { @apply border-lime-300 ring-1 ring-lime-400; }
.slot-row-expanded { @apply border-emerald-200 ring-1 ring-emerald-300; }
.slot-row-main { @apply min-w-0; }
.slot-row-title { @apply text-xs text-slate-100 font-semibold; }
.slot-row-value { @apply text-[11px] text-slate-300 mt-0.5 truncate; }
.slot-row-value-mixed { @apply text-amber-300 font-semibold; }
.slot-row-side { @apply flex items-center gap-2 ml-2; }
.slot-row-count { @apply text-[10px] text-emerald-300; }
.slot-row-candidate { @apply rounded border border-slate-600/70 px-1.5 py-0.5 text-[10px] text-slate-200; }
.empty-card { @apply rounded border border-dashed border-slate-700 p-3 text-xs text-slate-300 text-center; }

.picker-grid-row { @apply grid gap-2 mt-2; grid-template-columns: minmax(0, calc(50% - 4rem)) minmax(0, 1fr); }
.picker-cell { @apply min-h-20 min-w-0; }
.picker-right { @apply flex items-start justify-end; }
.picker-row3-left { @apply flex flex-col gap-2; }
.picker-grid-row-compact { @apply h-[25.6px] items-center; }
.picker-grid-row-compact .picker-cell { @apply min-h-0 h-[25.6px] flex items-center; }
.picker-grid-row-tabs { @apply items-start; }
.picker-grid-row-tabs .picker-cell { @apply min-h-0; }
.picker-actions-inline { @apply inline-flex items-center gap-1.5 justify-end; }
.picker-row-slot-tabs { @apply mt-0 h-auto items-start; }
.picker-right-tabs { @apply h-full items-end; }
.picker-right-tabs .pager { @apply self-end; }
.pager { @apply inline-flex items-center gap-1; }
.pager-btn { @apply h-[25.6px] rounded border border-slate-600 px-1.5 py-0 text-[10px] text-slate-200 inline-flex items-center; }
.pager-btn-active { @apply border-emerald-300 text-emerald-100; }
.pager-btn:disabled { @apply opacity-40 cursor-not-allowed; }
.picker-compat-box { @apply mt-0; }
.picker-row3-slot-wall { @apply mt-0; }
.filter-block { @apply mt-2 flex flex-col gap-2; }
.filter-line { @apply flex flex-wrap items-center gap-1.5; }
.filter-group { @apply text-[10px] uppercase text-slate-300 font-semibold min-w-8; }
.filter-items-race { @apply flex flex-wrap items-center gap-1.5; }
.filter-items-race-two-rows { display: grid; grid-template-rows: repeat(2, minmax(0, auto)); grid-auto-flow: column; align-items: center; gap: 0.375rem; }
.filter-chip { @apply rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200; }
.filter-chip-active { @apply border-emerald-300 text-emerald-100; }
.chip-count { @apply text-[10px] text-slate-300 ml-1; }
.picker-candidate-list { @apply mt-0 w-full; }
.candidate-list { @apply grid grid-cols-1 gap-1.5; }
.candidate-item { @apply rounded border border-slate-700 px-2 py-1.5 text-left; }
.candidate-item-active { @apply border-emerald-200 ring-1 ring-emerald-300; }
.candidate-item:focus-visible { @apply outline-none border-emerald-200 ring-1 ring-emerald-300; }
.candidate-name { @apply text-xs text-slate-100; }
.candidate-meta { @apply text-[10px] text-slate-300 mt-0.5; }
.candidate-item { display: flex; justify-content: space-between; align-items: flex-start; }
.candidate-left { flex: 1; min-width: 0; }
.candidate-right { text-align: right; flex-shrink: 0; margin-left: 0.5rem; display: flex; flex-direction: column; justify-content: center; }
.candidate-summary-1 { @apply flex gap-1 justify-end items-center; }
.candidate-summary-2 { @apply flex gap-1 justify-end items-center; }
.summary-label { @apply text-xs text-slate-300; }
.summary-value { @apply text-xs text-emerald-300 tabular-nums; }
.summary-unit { @apply text-[10px] text-slate-400; }

@media (max-width: 1023px) {
  .picker-grid-row { @apply grid-cols-1; }
  .picker-right { @apply justify-start; }
  .picker-row3-left { @apply h-auto; }
}
</style>
