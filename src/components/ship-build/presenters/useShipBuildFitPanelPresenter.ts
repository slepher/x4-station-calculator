import { useShipBuildWorkspacePresenter } from './useShipBuildWorkspacePresenter'
import type { ShipBuildSide } from '@/store/useShipBuildStore'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FitMode, FitConnectionRow, FitGroupRow } from '@/components/ship-build/fitTypes'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { ShipEquipmentSize, X4SlotTag } from '@/types/x4'
import { useShipBuildFitPresenter } from './useShipBuildFitPresenter'

type AggregatedGroup = {
  key: string
  size: string
  label: string
  slotTypeLabel: string
  totalCount: number
  tags: string[]
  connectionKeys: string[]
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

export type ShipFitProps = {
  side?: ShipBuildSide
  wide?: boolean
  externalHighlightedEquipmentId?: string | null
  pickerOpenExternal?: boolean
}

export type ShipFitEvents = {
  'picker-open': [slotType: string, equipmentId: string | null, isShield: boolean]
  'picker-close': []
  'update:highlightedEquipmentId': [id: string | null]
  'update:pickerTarget': [target: SlotTarget | null]
  'update:pickerMode': [mode: FitMode]
}

export type ShipFitEmit = {
  (event: 'picker-open', slot: string, id: string | null, shield: boolean): void
  (event: 'picker-close'): void
  (event: 'update:highlightedEquipmentId', id: string | null): void
  (event: 'update:pickerTarget', target: SlotTarget | null): void
  (event: 'update:pickerMode', mode: FitMode): void
}

export function useShipBuildFitPanelPresenter(props: ShipFitProps, emit: ShipFitEmit) {
const shipBuildStore = useShipBuildStore()
const gameData = useGameDataStore()
const workspace = useShipBuildWorkspacePresenter()
const side = computed(() => props.side === undefined ? 'A' : props.side)
const plan = computed(() => shipBuildStore.getPlan(side.value))
const blueprint = computed(() => plan.value === null ? null : plan.value.blueprint)
const selectedShip = computed(() => blueprint.value === null ? null : shipBuildStore.findShip(blueprint.value.shipId))
const mockTagPatch = computed(() => shipBuildStore.mockTagPatch)
const isDirty = computed(() => shipBuildStore.isPlanDirty(side.value))
const currentPresetId = computed(() => shipBuildStore.getPlanPresetId(side.value))
const isBuiltInPresetUnchanged = computed(() => currentPresetId.value !== null)
const activeBlueprintStatusLabel = computed(() => shipBuildStore.getPlanStatusLabel(side.value))
const mirrored = computed(() => workspace.compare.value && side.value === 'B')
const compare = workspace.compare
const locked = workspace.locked
const activate = () => workspace.activate(side.value)
const expandComparison = workspace.openComparison
const enterShipSelector = () => workspace.openShipSelection(side.value)
const { toggleFavoriteBlueprint } = shipBuildStore

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
const slotTags = shipBuildStore.slotTags as X4SlotTag[]
const slotTagMap = new Map<string, X4SlotTag>(slotTags.map((tag) => [tag.id, tag]))

const normalizeTagList = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === 'string')
}

const resolveSize = (
  primary?: ShipEquipmentSize,
  fallback?: ShipEquipmentSize
): ShipEquipmentSize | null => primary ?? fallback ?? null

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
      const typeDef = shipBuildStore.findEquipmentType(slot.type)

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
        count: connection?.count || 0
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
      const shieldTypeDef = shipBuildStore.findEquipmentType('shield')
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
        count: shieldDef?.count || 0
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
        connectionKeys: [row.connectionKey]
      })
      return
    }

    existing.totalCount += row.count
    existing.connectionKeys.push(row.connectionKey)
    const tagSet = new Set([...existing.tags, ...row.tags])
    existing.tags = Array.from(tagSet)
  })

  return Array.from(grouped.values())
})

const fitMode = ref<FitMode>('connection')
const activeSlotType = ref<'engine' | 'shield' | 'weapon' | 'turret' | 'thruster' | 'consumables' | 'units' | ''>('')
const activeTabKey = ref('')
const expandedSlotKey = ref<string | null>(null)
const pendingExpandedConnectionKeys = ref<string[] | null>(null)
const highlightedEquipmentId = ref<string | null>(null)
const blueprintMenuOpen = ref(false)
const blueprintMenuRef = ref<HTMLElement | null>(null)
const fitPanelRef = ref<HTMLElement | null>(null)
const blueprintTriggerRef = ref<HTMLElement | null>(null)
const blueprintMenuStyle = ref<Record<string, string>>({})

const currentBlueprintLabel = computed(() => {
  const label = activeBlueprintStatusLabel.value || ''
  return label || t('shipBuild.built_in_empty')
})

const shouldShowBlueprintDirtyDot = computed(() => {
  return isDirty.value && !isBuiltInPresetUnchanged.value
})

const currentBlueprintId = computed(() => blueprint.value?.id || '')

const currentBlueprintFavorited = computed(() => {
  return blueprint.value?.favorite ?? false
})

const toggleFavoriteCurrent = () => {
  const id = currentBlueprintId.value
  if (!id) return
  toggleFavoriteBlueprint(id)
}

const toggleFavoriteItem = (itemId: string) => {
  toggleFavoriteBlueprint(itemId)
  if (itemId !== currentBlueprintId.value) {
    shipBuildStore.saveBlueprintsToStorage()
  }
}

const loadableBlueprintItems = computed(() => {
  if (!selectedShip.value) return []
  return shipBuildStore.getLoadableBlueprintsForShip(selectedShip.value.id).map((bp) => ({
    id: bp.id,
    label: bp.name,
    favorite: bp.favorite ?? false,
    lastUpdated: bp.lastUpdated ?? 0,
    createdAt: bp.createdAt ?? 0,
    isBuiltIn: shipBuildStore.isBuiltInBlueprintId(bp.id),
    disabled: shipBuildStore.getPlan(side.value === 'A' ? 'B' : 'A')?.saveTargetId === bp.id,
    isCurrentSaved: currentPresetId.value === null ? plan.value?.saveTargetId === bp.id : currentPresetId.value === bp.id
  }))
})

const groupedLoadableBlueprintItems = computed(() => {
  const builtInItems = loadableBlueprintItems.value.filter((item) => item.isBuiltIn)
  const userItems = loadableBlueprintItems.value.filter((item) => !item.isBuiltIn)
  userItems.sort((a, b) => {
    const ca = a.createdAt ?? 0
    const cb = b.createdAt ?? 0
    if (cb !== ca) return cb - ca
    return (a.label ?? '').localeCompare(b.label ?? '')
  })
  return [
    { key: 'preset', title: t('shipBuild.blueprint_group_preset'), items: builtInItems },
    { key: 'user', title: t('shipBuild.blueprint_group_user'), items: userItems }
  ].filter((group) => group.items.length > 0)
})

const closeBlueprintMenu = () => {
  blueprintMenuOpen.value = false
}

const updateBlueprintMenuPosition = () => {
  const panel = fitPanelRef.value
  const trigger = blueprintTriggerRef.value
  const rect = panel?.getBoundingClientRect() || trigger?.getBoundingClientRect()
  if (!rect) return
  blueprintMenuStyle.value = {
    top: `${rect.top}px`,
    ...(mirrored.value ? { left: 'auto', right: `${Math.max(8, window.innerWidth - rect.left + 8)}px` } : { left: `${rect.right + 8}px`, right: 'auto' }),
    maxHeight: '400px'
  }
}

const toggleBlueprintMenu = () => {
  if (locked.value) return
  blueprintMenuOpen.value = !blueprintMenuOpen.value
  if (blueprintMenuOpen.value) updateBlueprintMenuPosition()
}

const saveCurrentBlueprint = (saveAs = false) => {
  if (locked.value) return
  closeBlueprintMenu()
  workspace.save(side.value, saveAs)
}

const handleBlueprintSelect = (id: string) => {
  workspace.loadPlan(id, side.value)
  closeBlueprintMenu()
}

const handleBlueprintDelete = (id: string) => {
  if (shipBuildStore.isBuiltInBlueprintId(id)) return
  const otherSide = side.value === 'A' ? 'B' : 'A'
  if (!shipBuildStore.planRequiresSaveAs(otherSide) && shipBuildStore.getPlan(otherSide)?.saveTargetId === id) return
  if (!workspace.requestDelete(side.value, id)) return
  closeBlueprintMenu()
}

const onGlobalPointerDown = (event: MouseEvent) => {
  if (!blueprintMenuOpen.value) return
  const menuRoot = blueprintMenuRef.value
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  closeBlueprintMenu()
}

const onViewportChange = () => {
  if (!blueprintMenuOpen.value) return
  updateBlueprintMenuPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onGlobalPointerDown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onGlobalPointerDown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})

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
  if (!selected) return null
  if (selected === '__mixed__') return selected
  if (gameData.enforceDlcActivation && !shipBuildStore.isEquipmentDlcUsable(selected)) return null
  return selected
})
const selectedNameForTarget = (target: SlotTarget) => {
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  if (!selectedId) return t('ship_build.fit_empty_slot')
  if (selectedId === '__mixed__') return t('ship_build.fit_mixed_selection')
  const equipment = shipBuildStore.findEquipment(selectedId)
  return equipment ? translateEquipment(equipment) : selectedId
}

const selectedEquipmentForTarget = (target: SlotTarget) => {
  const selectedId = selectedForConnectionKeys(target.connectionKeys)
  if (!selectedId || selectedId === '__mixed__') return null
  return shipBuildStore.findEquipment(selectedId)
}

const shouldShowSelectedDlcTag = (target: SlotTarget) => {
  const equipment = selectedEquipmentForTarget(target)
  return Boolean(equipment && equipment.dlc_tag !== 'base')
}
const isMixedSelectionInGroup = (target: SlotTarget) => fitMode.value === 'group' && selectedForConnectionKeys(target.connectionKeys) === '__mixed__'

const openPicker = (slotKey: string) => {
  if (workspace.locked.value && workspace.pickerSide.value !== side.value) return
  activate()
  expandedSlotKey.value = slotKey
  handlePickerOpenChange(true)
}

const closePicker = () => {
  expandedSlotKey.value = null
  handlePickerOpenChange(false)
}

const { draftCountByTarget, handleSlotClick, sliderStepForTarget, isCountSliderDisabled,
  getDisplayedCount, handleCountSliderRealtime, handleCountSliderCommit } = useShipBuildFitPresenter(fitMode, openPicker, side)

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

watch(pickerTarget, (newTarget) => {
  highlightedEquipmentId.value = pickerInitialEquipmentId.value
  emit('update:pickerTarget', newTarget)
  if (newTarget !== null && props.pickerOpenExternal) handlePickerOpenChange(true)
}, { flush: 'post' })

watch(highlightedEquipmentId, (newId) => {
  emit('update:highlightedEquipmentId', newId)
})

watch(
  () => props.externalHighlightedEquipmentId,
  (newId) => {
    if (newId === undefined) return
    if (highlightedEquipmentId.value === newId) return
    highlightedEquipmentId.value = newId
  }
)

watch(
  () => props.pickerOpenExternal,
  (open) => {
    if (open === false && expandedSlotKey.value) {
      closePicker()
    }
  }
)

watch(fitMode, (mode) => {
  emit('update:pickerMode', mode)
}, { immediate: true })

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

const isDlcActive = (tag: string | null | undefined) => gameData.isDlcActive(tag)
const getDlcDisplayName = (tag: string | null | undefined) => gameData.getDlcDisplayName(tag)
return { isDlcActive, getDlcDisplayName, workspace, side, plan, blueprint, selectedShip, mockTagPatch, isDirty, isBuiltInPresetUnchanged, activeBlueprintStatusLabel, mirrored, compare, locked, activate, expandComparison, enterShipSelector, localConnectionKeyMap, handlePickerOpenChange, slotTags, slotTagMap, normalizeTagList, resolveSize, connectionRows, selectedByConnection, equippedCountByConnection, groupRows, fitMode, activeSlotType, activeTabKey, expandedSlotKey, pendingExpandedConnectionKeys, highlightedEquipmentId, blueprintMenuOpen, blueprintMenuRef, fitPanelRef, blueprintTriggerRef, blueprintMenuStyle, currentBlueprintLabel, saveCurrentBlueprint, shouldShowBlueprintDirtyDot, currentBlueprintId, currentBlueprintFavorited, toggleFavoriteCurrent, toggleFavoriteItem, loadableBlueprintItems, groupedLoadableBlueprintItems, closeBlueprintMenu, updateBlueprintMenuPosition, toggleBlueprintMenu, handleBlueprintSelect, handleBlueprintDelete, onGlobalPointerDown, onViewportChange, slotTypeDefs, sourceRows, sizeRank, buildTagSignature, sizeShort, mergeTags, getSlotBucket, setMode, availableSlotTypes, slotScopedRows, primaryConnectionRows, primaryGroupRows, aggregatedPrimaryGroups, groupTabs, groupedConnectionTabRows, renderGroupTabRows, activeConnectionRow, activePrimaryAggregate, selectedForConnectionKeys, connectionCountMap, selectedCountForConnectionKeys, totalCountForConnectionKeys, relatedShieldConnectionRows, relatedShieldAggregates, slotTargets, activeTarget, visibleCompatibilityTags, visibleCompatibilityTagLabels, compatibilitySlotLines, pickerTarget, pickerInitialEquipmentId, selectedNameForTarget, selectedEquipmentForTarget, shouldShowSelectedDlcTag, isMixedSelectionInGroup, openPicker, closePicker, handleSlotTypeClick, jumpToTab, t, translateShip, draftCountByTarget, handleSlotClick, sliderStepForTarget, isCountSliderDisabled, getDisplayedCount, handleCountSliderRealtime, handleCountSliderCommit }
}
