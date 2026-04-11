<script setup lang="ts">
import { computed, ref, watch, watchEffect, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { stationStateMap } from '@/store/state/StationStateMap'
import type { SavedFlowGroup } from '@/types/x4'
import {
  ADVANCED_SUNLIGHT_TAG_ID,
  buildAdvancedCandidates,
  type AdvancedResourceSector,
  type AdvancedResourceTagGroup
} from '@/store/logic/mapAdvancedResourceFilter'
import { buildSectorGraph } from '@/store/logic/mapSectorGraph'
import {
  sortResourcesByPriority,
  buildFixedYieldEntries,
  buildYieldRanksByWare,
  getSharedMinYieldName,
  MIXED_YIELD_VALUE,
  YIELD_THRESHOLDS_NIVIDUM,
  YIELD_THRESHOLDS_NORMAL,
  type SectorResourceFill,
  type SectorResourceEntry
} from '@/store/logic/mapResourceFilter'

type SearchSectorLayout = {
  sectorId: string
  clusterId: string
  name: string
  displayName: string
  centerX: number
  centerY: number
  radius: number
  verticalExtent: number
}

type ResourceVisualChangePayload = {
  highlightedSectorIds: string[]
  sectorFills: Record<string, SectorResourceFill>
  sectorGroupBadges?: Record<string, string[]>
}

type AdvancedCandidateViewModel = {
  key: string
  resourceSectorIds: string[]
  hubCandidateSectorIds: string[]
  coveredGroupIds: string[]
  score: number
  resourceGroupBadges: Record<string, string[]>
}

type ResourceCatalogItem = {
  ware: string
  color: string
  yields: string[]
  kind: 'ware' | 'sunlight'
}

const props = defineProps<{
  sectorLayouts: SearchSectorLayout[]
  active?: boolean
}>()

const emit = defineEmits<{
  (e: 'highlight-change', sectorIds: string[]): void
  (e: 'select-sector', sectorId: string): void
  (e: 'fit-sectors', sectorIds: string[]): void
  (e: 'active-change', active: boolean): void
  (e: 'primary-color-change', color: string | null): void
  (e: 'resource-visual-change', payload: ResourceVisualChangePayload): void
}>()

const { t, locale } = useI18n()
const gameData = useGameDataStore()
const empireStore = useEmpireStore()
const logicFlowStore = useLogicFlowStore()

const formatYieldLabel = (yieldName: string, wareId?: string) => {
  const levelKey = `map.yield_levels.${yieldName}`
  const levelText = t(levelKey)
  const fallbackLevel = yieldName === 'low' ? 'Low' :
                      yieldName === 'midlow' ? 'Mid Low' :
                      yieldName === 'medium' ? 'Medium' :
                      yieldName === 'midhigh' ? 'Mid High' :
                      yieldName === 'high' ? 'High' : yieldName

  const displayLevel = levelKey !== levelText ? levelText : fallbackLevel

  if (!wareId) return displayLevel

  const isNividium = wareId.toLowerCase() === 'nividium'
  const thresholds = isNividium ? YIELD_THRESHOLDS_NIVIDUM : YIELD_THRESHOLDS_NORMAL
  const threshold = thresholds[yieldName]
  if (!threshold) return displayLevel

  const formatThresholdValue = (value: number) => {
    if (isNividium) return value.toString()
    return `${value / 1000}K`
  }

  if (threshold.max === null) {
    return `${displayLevel}(${formatThresholdValue(threshold.min)}+)`
  }
  return `${displayLevel}(${formatThresholdValue(threshold.min)}-${formatThresholdValue(threshold.max)})`
}
const availableResourceIds = computed(() =>
  ((gameData.res || []) as Array<{ id: string }>).map((entry) => entry.id).filter((id) => id !== 'energycells')
)
const sortedResourceIds = computed(() => sortResourcesByPriority(availableResourceIds.value))
const regionYields = computed(() => buildFixedYieldEntries(sortedResourceIds.value))
const resourceColorsFromRes = computed<Record<string, string>>(() =>
  Object.fromEntries(((gameData.res || []) as Array<{ id: string; color_rgb?: string }>).map((entry) => [entry.id, entry.color_rgb || '#fbbf24']))
)
const yieldRanksByWare = computed(() => buildYieldRanksByWare(regionYields.value))
const SUNLIGHT_COLOR = '#F7D24B'

const nextGroupId = (() => {
  let value = 1
  return () => `group_${value++}`
})()

const buildDefaultGroup = (): AdvancedResourceTagGroup => ({
  id: nextGroupId(),
  tagIds: [],
  minYieldByWare: {},
  sunlightMinimum: 100
})

const draftTagGroups = ref<AdvancedResourceTagGroup[]>([buildDefaultGroup()])
const appliedTagGroups = ref<AdvancedResourceTagGroup[]>([buildDefaultGroup()])
const jumpLimitDraft = ref(2)
const jumpLimitApplied = ref(2)
const allowTransitDraft = ref(true)
const allowTransitApplied = ref(true)
const expandedGroupId = ref<string | null>(draftTagGroups.value[0]?.id || null)
const hasPendingRefresh = ref(true)
const selectedCandidateKey = ref<string | null>(null)

const loaderMenuOpen = ref(false)
const loaderMenuRef = ref<HTMLElement | null>(null)
const loaderTriggerRef = ref<HTMLElement | null>(null)
const loaderMenuStyle = ref<Record<string, string>>({})
const loadedSourceId = ref<string | null>(null)
const loadedSourceType = ref<'sector' | 'logicflow' | null>(null)

const loaderCurrentLabel = computed(() => {
  if (!loadedSourceId.value) return t('map.resource_filter_loader_custom')
  if (loadedSourceType.value === 'sector') {
    const sector = empireStore.sectors.find(s => s.id === loadedSourceId.value)
    return sector?.name || t('map.resource_filter_loader_custom')
  }
  if (loadedSourceType.value === 'logicflow') {
    const plan = logicFlowStore.savedPlans.list.find(p => p.id === loadedSourceId.value)
    return plan?.name || t('map.resource_filter_loader_custom')
  }
  return t('map.resource_filter_loader_custom')
})

const loadableSectors = computed(() => {
  const sectors = empireStore.sectors
  const stations = empireStore.activeEmpire?.stations || []
  return sectors.filter(sector => {
    const sectorStations = stations.filter(s => s.sectorId === sector.id)
    return sectorStations.some(station => {
      const flows = stationStateMap.getGroupedFlows(station.id)
      return flows.rateGroups.resources.length > 0
    })
  }).map(sector => ({
    id: sector.id,
    name: sector.name
  }))
})

const updateLoaderMenuPosition = () => {
  const panel = document.querySelector('.resource-panel-shell')
  const trigger = loaderTriggerRef.value
  if (!panel || !trigger) return
  
  const panelRect = panel.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  
  loaderMenuStyle.value = {
    position: 'fixed',
    top: `${triggerRect.top}px`,
    left: `${panelRect.right + 8}px`,
    maxHeight: '300px'
  }
}

const toggleLoaderMenu = () => {
  loaderMenuOpen.value = !loaderMenuOpen.value
  if (loaderMenuOpen.value) updateLoaderMenuPosition()
}

const closeLoaderMenu = () => {
  loaderMenuOpen.value = false
}

const loadSectorStations = (sectorId: string) => {
  const stations = empireStore.activeEmpire?.stations || []
  const sectorStations = stations.filter(s => s.sectorId === sectorId)
  
  const newGroups: AdvancedResourceTagGroup[] = []
  for (const station of sectorStations) {
    const flows = stationStateMap.getGroupedFlows(station.id)
    const resourceWares = flows.rateGroups.resources.map(f => f.wareId)
    if (resourceWares.length === 0) continue
    
    const group = buildDefaultGroup()
    group.tagIds = resourceWares
    group.minYieldByWare = Object.fromEntries(
      resourceWares.map(wareId => [wareId, 'low'])
    )
    newGroups.push(group)
  }
  
  if (newGroups.length > 0) {
    draftTagGroups.value = newGroups
    loadedSourceId.value = sectorId
    loadedSourceType.value = 'sector'
    expandedGroupId.value = null
    refreshCandidates()
  }
  
  closeLoaderMenu()
}

const getTier0ResourcesForGroup = (savedGroup: SavedFlowGroup): string[] => {
  const isolatedWareIds = new Set<string>()
  const moduleOutputWareIds: string[] = []
  
  // Step 1: 从 SavedFlowNode 提取 isolated 和 module 信息
  for (const node of savedGroup.nodes) {
    if (node.isolated) {
      isolatedWareIds.add(node.isolated)
    } else if (node.module) {
      const module = gameData.modulesMap[node.module]
      if (module && module.outputs) {
        const outputWareId = Object.keys(module.outputs)[0]
        if (outputWareId) moduleOutputWareIds.push(outputWareId)
      }
    }
  }
  
  const t0WareIds = new Set<string>()
  const visited = new Set<string>()
  
  const effectiveLineage = savedGroup.isLocked 
    ? (savedGroup.lockedLineage || 'default') 
    : (savedGroup.subCategory || 'default')
  
  const trace = (wareId: string) => {
    if (wareId === 'energycells') return
    if (visited.has(wareId)) return
    visited.add(wareId)
    
    const ware = gameData.waresMap[wareId]
    if (!ware) return
    
    if (ware.tier === 0) {
      t0WareIds.add(wareId)
      return
    }
    
    if (isolatedWareIds.has(wareId)) return
    
    const module = gameData.findModuleForWare(wareId, effectiveLineage)
    if (module && module.inputs) {
      Object.keys(module.inputs).forEach(inputWareId => {
        trace(inputWareId)
      })
    }
  }
  
  for (const wareId of moduleOutputWareIds) {
    trace(wareId)
  }
  
  return [...t0WareIds]
}

const loadableLogicFlowPlans = computed(() => {
  const plans = logicFlowStore.savedPlans.list
  return plans.filter(plan => {
    return plan.groups.some(group => {
      const tier0Resources = getTier0ResourcesForGroup(group)
      return tier0Resources.length > 0
    })
  }).map(plan => ({
    id: plan.id,
    name: plan.name
  }))
})

const loadLogicFlowPlan = (planId: string) => {
  const plan = logicFlowStore.savedPlans.list.find(p => p.id === planId)
  if (!plan) return
  
  const newGroups: AdvancedResourceTagGroup[] = []
  for (const savedGroup of plan.groups) {
    const tier0Resources = getTier0ResourcesForGroup(savedGroup)
    if (tier0Resources.length === 0) continue
    
    const group = buildDefaultGroup()
    group.tagIds = tier0Resources
    group.minYieldByWare = Object.fromEntries(
      tier0Resources.map(wareId => [wareId, 'low'])
    )
    newGroups.push(group)
  }
  
  if (newGroups.length > 0) {
    draftTagGroups.value = newGroups
    loadedSourceId.value = planId
    loadedSourceType.value = 'logicflow'
    expandedGroupId.value = null
    refreshCandidates()
  }
  
  closeLoaderMenu()
}

const onLoaderGlobalPointerDown = (event: MouseEvent) => {
  if (!loaderMenuOpen.value) return
  const menuRoot = loaderMenuRef.value
  if (!menuRoot) return
  if (!(event.target instanceof Node)) return
  if (menuRoot.contains(event.target)) return
  closeLoaderMenu()
}

const onLoaderViewportChange = () => {
  if (!loaderMenuOpen.value) return
  updateLoaderMenuPosition()
}

watch(() => props.active, (active) => {
  if (!active) closeLoaderMenu()
})

onMounted(() => {
  document.addEventListener('mousedown', onLoaderGlobalPointerDown)
  window.addEventListener('resize', onLoaderViewportChange)
  window.addEventListener('scroll', onLoaderViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onLoaderGlobalPointerDown)
  window.removeEventListener('resize', onLoaderViewportChange)
  window.removeEventListener('scroll', onLoaderViewportChange, true)
})

const resourceCatalog = computed<ResourceCatalogItem[]>(() => [
  ...regionYields.value
    .map((entry) => ({
      ware: entry.ware,
      color: resourceColorsFromRes.value[entry.ware] || '#fbbf24',
      yields: entry.yields.map((item) => item.name),
      kind: 'ware' as const
    })),
  {
    ware: ADVANCED_SUNLIGHT_TAG_ID,
    color: SUNLIGHT_COLOR,
    yields: [],
    kind: 'sunlight' as const
  }
])

const sectorDataById = computed<Record<string, { resources: SectorResourceEntry[]; sunlight: number }>>(() => {
  const out: Record<string, { resources: SectorResourceEntry[]; sunlight: number }> = {}
  const maps = gameData.maps
  const clusters = maps?.clusters || {}
  const sectors = maps?.sectors || {}
  Object.values(clusters).forEach((cluster) => {
    // DLC filter: skip clusters from inactive DLC
    if (gameData.enforceDlcActivation && !gameData.isDlcActive(cluster.dlc_tag)) {
      return
    }
    ;(cluster.sectors || []).forEach((sectorId) => {
      const sector = sectors[sectorId] as any
      if (!sector) return
      out[sector.id] = {
        resources: Array.isArray(sector.resources) ? sector.resources : [],
        sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100)
      }
    })
  })
  return out
})

const sectorGraphResult = computed(() => buildSectorGraph(gameData.maps?.clusters || {}, gameData.maps?.sectors || {}))
const sectorGraph = computed(() => sectorGraphResult.value.graph)
const sectorClusterMap = computed(() => sectorGraphResult.value.sectorClusterMap)

const sectors = computed<AdvancedResourceSector[]>(() =>
  props.sectorLayouts.map((layout) => ({
    sectorId: layout.sectorId,
    name: layout.name,
    displayName: layout.displayName,
    resources: sectorDataById.value[layout.sectorId]?.resources || [],
    sunlight: sectorDataById.value[layout.sectorId]?.sunlight || 0
  }))
)

const normalizedAppliedGroups = computed(() => appliedTagGroups.value.filter((group) => group.tagIds.length > 0))

const appliedResult = computed(() => buildAdvancedCandidates({
  sectors: sectors.value,
  tagGroups: normalizedAppliedGroups.value,
  jumpLimit: jumpLimitApplied.value,
  allowTransit: allowTransitApplied.value,
  yieldRanksByWare: yieldRanksByWare.value,
  resourceColors: resourceColorsFromRes.value,
  sectorGraph: sectorGraph.value,
  sectorClusterMap: sectorClusterMap.value
}))

const candidateKeyOf = (resourceSectorIds: string[]) => resourceSectorIds.slice().sort().join('|')

const candidateViewModels = computed<AdvancedCandidateViewModel[]>(() =>
  appliedResult.value.candidates.map((candidate) => {
    const groupOrder = Object.fromEntries(
      normalizedAppliedGroups.value.map((group, index) => [group.id, String(index + 1)])
    ) as Record<string, string>

    const resourceGroupBadges = candidate.resourceSectorIds.reduce<Record<string, string[]>>((acc, sectorId) => {
      const badges = (appliedResult.value.matchedGroupsBySector[sectorId] || [])
        .map((groupId) => groupOrder[groupId])
        .filter((value): value is string => Boolean(value))
      if (badges.length) acc[sectorId] = badges
      return acc
    }, {})

    return {
      ...candidate,
      key: candidateKeyOf(candidate.resourceSectorIds),
      resourceGroupBadges
    }
  })
)

const selectedCandidate = computed(() => {
  const current = candidateViewModels.value.find((candidate) => candidate.key === selectedCandidateKey.value)
  return current || candidateViewModels.value[0] || null
})

watchEffect(() => {
  const firstKey = candidateViewModels.value[0]?.key || null
  if (!selectedCandidateKey.value || !candidateViewModels.value.some((candidate) => candidate.key === selectedCandidateKey.value)) {
    selectedCandidateKey.value = firstKey
  }
})

watchEffect(() => {
  if (!props.active) return
  if (!normalizedAppliedGroups.value.length) {
    emit('highlight-change', [])
    emit('active-change', false)
    emit('resource-visual-change', { highlightedSectorIds: [], sectorFills: {}, sectorGroupBadges: {} })
    emit('primary-color-change', null)
    return
  }

  const candidate = selectedCandidate.value
  const highlightedSectorIds = candidate
    ? Array.from(new Set([...candidate.resourceSectorIds, ...candidate.hubCandidateSectorIds]))
    : []
  const sectorFills = candidate
    ? appliedResult.value.sectorFillSetsByCandidateKey[candidate.key] || {}
    : {}

  emit('highlight-change', highlightedSectorIds)
  emit('active-change', true)
  emit('resource-visual-change', { highlightedSectorIds, sectorFills, sectorGroupBadges: candidate?.resourceGroupBadges || {} })
  emit('primary-color-change', null)
})

const markDirty = () => {
  hasPendingRefresh.value = true
}

const addGroup = () => {
  draftTagGroups.value = [...draftTagGroups.value, buildDefaultGroup()]
  const lastGroup = draftTagGroups.value[draftTagGroups.value.length - 1]
  expandedGroupId.value = lastGroup?.id || null
  markDirty()
}

const removeGroup = (groupId: string) => {
  draftTagGroups.value = draftTagGroups.value.filter((group) => group.id !== groupId)
  if (!draftTagGroups.value.length) draftTagGroups.value = [buildDefaultGroup()]
  if (expandedGroupId.value === groupId) expandedGroupId.value = null
  markDirty()
}

const toggleGroupTag = (groupId: string, tagId: string) => {
  draftTagGroups.value = draftTagGroups.value.map((group) => {
    if (group.id !== groupId) return group
    const nextTagIds = group.tagIds.includes(tagId)
      ? group.tagIds.filter((current) => current !== tagId)
      : [...group.tagIds, tagId]
    const nextMinYieldByWare = { ...group.minYieldByWare }
    if (!nextTagIds.includes(tagId)) delete nextMinYieldByWare[tagId]
    if (tagId !== ADVANCED_SUNLIGHT_TAG_ID && nextTagIds.includes(tagId) && !nextMinYieldByWare[tagId]) {
      nextMinYieldByWare[tagId] = resourceCatalog.value.find((entry) => entry.ware === tagId)?.yields[0] || 'low'
    }
    return {
      ...group,
      tagIds: nextTagIds,
      minYieldByWare: nextMinYieldByWare
    }
  })
  markDirty()
}

const updateGroupYield = (groupId: string, wareId: string, yieldName: string) => {
  draftTagGroups.value = draftTagGroups.value.map((group) => (
    group.id !== groupId
      ? group
      : {
          ...group,
          minYieldByWare: {
            ...group.minYieldByWare,
            [wareId]: yieldName
          }
        }
  ))
  markDirty()
}

const updateGroupSunlightMinimum = (groupId: string, nextValue: number) => {
  const safeValue = Math.max(0, Math.round(nextValue))
  draftTagGroups.value = draftTagGroups.value.map((group) => (
    group.id !== groupId
      ? group
      : {
          ...group,
          sunlightMinimum: safeValue
        }
  ))
  markDirty()
}

const stepGroupSunlightMinimum = (groupId: string, delta: number) => {
  const group = draftTagGroups.value.find((item) => item.id === groupId)
  updateGroupSunlightMinimum(groupId, (group?.sunlightMinimum || 0) + delta)
}

const clampJumpLimit = (value: number) => Math.min(5, Math.max(1, Math.round(value)))

const updateJumpLimit = (nextValue: number) => {
  jumpLimitDraft.value = clampJumpLimit(nextValue)
  markDirty()
}

const stepJumpLimit = (delta: number) => {
  updateJumpLimit(jumpLimitDraft.value + delta)
}

const updateAllGroupYields = (groupId: string, yieldName: string) => {
  draftTagGroups.value = draftTagGroups.value.map((group) => {
    if (group.id !== groupId) return group
    const nextMinYieldByWare = { ...group.minYieldByWare }
    ordinaryTagsOfGroup(group).forEach((wareId) => {
      nextMinYieldByWare[wareId] = yieldName
    })
    return {
      ...group,
      minYieldByWare: nextMinYieldByWare
    }
  })
  markDirty()
}

const refreshCandidates = () => {
  appliedTagGroups.value = draftTagGroups.value.map((group) => ({
    ...group,
    tagIds: [...group.tagIds],
    minYieldByWare: { ...group.minYieldByWare },
    sunlightMinimum: group.sunlightMinimum
  }))
  jumpLimitApplied.value = clampJumpLimit(jumpLimitDraft.value)
  allowTransitApplied.value = allowTransitDraft.value
  hasPendingRefresh.value = false
}

const groupTagItems = (group: AdvancedResourceTagGroup) =>
  group.tagIds.map((tagId) => {
    const label = tagId === ADVANCED_SUNLIGHT_TAG_ID
      ? t('map.resource_filter_sunlight')
      : (() => {
          const translated = t(`res.${tagId}`)
          return translated !== `res.${tagId}` ? translated : tagId
        })()

    return {
      tagId,
      label,
      color: resourceColorsFromRes.value[tagId] || '#fbbf24'
    }
  })

const ordinaryTagsOfGroup = (group: AdvancedResourceTagGroup) => group.tagIds.filter((tagId) => tagId !== ADVANCED_SUNLIGHT_TAG_ID)

const getSectorLabel = (sectorId: string) => {
  const sector = props.sectorLayouts.find((entry) => entry.sectorId === sectorId)
  if (!sector) return sectorId
  return locale.value === 'en' ? sector.name : sector.displayName
}

const openGroupEditor = (groupId: string) => {
  expandedGroupId.value = expandedGroupId.value === groupId ? null : groupId
}

const onCandidateSelect = (candidate: AdvancedCandidateViewModel) => {
  selectedCandidateKey.value = candidate.key
  emit('fit-sectors', Array.from(new Set([...candidate.resourceSectorIds, ...candidate.hubCandidateSectorIds])))
}

const onCandidateSectorTagClick = (candidate: AdvancedCandidateViewModel, sectorId: string) => {
  if (selectedCandidateKey.value !== candidate.key) {
    selectedCandidateKey.value = candidate.key
  }
  emit('select-sector', sectorId)
}

const getGroupSharedMinYieldName = (group: AdvancedResourceTagGroup) =>
  getSharedMinYieldName(
    ordinaryTagsOfGroup(group),
    Object.fromEntries(
      ordinaryTagsOfGroup(group).map((wareId) => [wareId, { selected: true, minYieldName: group.minYieldByWare[wareId] || 'low' }])
    )
  )
</script>

<template>
  <div class="advanced-panel">
    <div class="advanced-top-row">
      <button type="button" class="advanced-add-btn" data-testid="map-resource-advanced-add-group" @click="addGroup">
        {{ t('map.resource_filter_add_group') }}
      </button>

      <button
        type="button"
        class="resource-group-loader-trigger"
        data-testid="map-resource-advanced-loader-trigger"
        ref="loaderTriggerRef"
        @click="toggleLoaderMenu"
      >
        <span class="loader-trigger-label">{{ loaderCurrentLabel }}</span>
        <svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>

    <div class="advanced-group-list">
      <div
        v-for="group in draftTagGroups"
        :key="group.id"
        class="advanced-group-card"
        :class="{ expanded: expandedGroupId === group.id }"
      >
        <template v-if="expandedGroupId === group.id">
          <div class="advanced-group-line">
            <div class="advanced-group-tags">
              <button
                v-for="resource in resourceCatalog"
                :key="resource.ware"
                type="button"
                class="resource-tag"
                :class="{ selected: group.tagIds.includes(resource.ware) }"
                :style="{ borderColor: resource.color, color: group.tagIds.includes(resource.ware) ? '#111827' : '#f8fafc', backgroundColor: group.tagIds.includes(resource.ware) ? resource.color : 'transparent' }"
                :data-testid="`map-resource-advanced-tag-${group.id}-${resource.ware}`"
                @click="toggleGroupTag(group.id, resource.ware)"
              >
                {{ resource.ware === ADVANCED_SUNLIGHT_TAG_ID ? t('map.resource_filter_sunlight') : t(`res.${resource.ware}`) }}
              </button>
            </div>
            <div class="advanced-group-actions">
              <button type="button" class="group-action" @click="openGroupEditor(group.id)">{{ t('map.resource_filter_done') }}</button>
              <button type="button" class="group-action danger" @click="removeGroup(group.id)">{{ t('map.resource_filter_remove_group') }}</button>
            </div>
          </div>

          <div v-if="ordinaryTagsOfGroup(group).length || group.tagIds.includes(ADVANCED_SUNLIGHT_TAG_ID)" class="advanced-group-yields">
            <label v-if="ordinaryTagsOfGroup(group).length >= 2" class="advanced-yield-row">
              <span>{{ t('map.resource_filter_all') }}</span>
              <select
                class="yield-select"
                :value="getGroupSharedMinYieldName(group)"
                @change="updateAllGroupYields(group.id, ($event.target as HTMLSelectElement).value)"
              >
                <option v-if="getGroupSharedMinYieldName(group) === MIXED_YIELD_VALUE" :value="MIXED_YIELD_VALUE" disabled>
                  {{ t('map.resource_filter_mixed') }}
                </option>
                <option
                  v-for="yieldName in resourceCatalog.find((entry) => entry.ware === ordinaryTagsOfGroup(group)[0])?.yields || []"
                  :key="yieldName"
                  :value="yieldName"
                >
                  {{ formatYieldLabel(yieldName) }}
                </option>
              </select>
            </label>

            <label v-for="wareId in ordinaryTagsOfGroup(group)" :key="wareId" class="advanced-yield-row">
              <span>{{ t(`res.${wareId}`) }}</span>
              <select
                class="yield-select"
                :value="group.minYieldByWare[wareId]"
                @change="updateGroupYield(group.id, wareId, ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="yieldName in resourceCatalog.find((entry) => entry.ware === wareId)?.yields || []"
                  :key="yieldName"
                  :value="yieldName"
                >
                  {{ formatYieldLabel(yieldName, wareId) }}
                </option>
              </select>
            </label>

            <label v-if="group.tagIds.includes(ADVANCED_SUNLIGHT_TAG_ID)" class="advanced-yield-row">
              <span>{{ t('map.resource_filter_sunlight') }}</span>
              <div class="sunlight-input-wrap">
                <input
                  class="sunlight-input"
                  type="number"
                  min="0"
                  step="1"
                  :name="`sunlight-${group.id}`"
                  :value="group.sunlightMinimum"
                  :data-testid="`map-resource-advanced-sunlight-${group.id}`"
                  @input="updateGroupSunlightMinimum(group.id, Number(($event.target as HTMLInputElement).value || 0))"
                />
                <span class="sunlight-suffix">{{ t('map.resource_filter_sunlight_suffix') }}</span>
                <div class="sunlight-stepper">
                  <button type="button" class="sunlight-step-btn" @click="stepGroupSunlightMinimum(group.id, 1)">▲</button>
                  <button type="button" class="sunlight-step-btn" @click="stepGroupSunlightMinimum(group.id, -1)">▼</button>
                </div>
              </div>
            </label>
          </div>
        </template>

        <template v-else>
          <div class="advanced-group-line">
            <div class="advanced-group-summary">
              <span
                v-for="item in groupTagItems(group)"
                :key="item.tagId"
                class="summary-tag"
                :data-testid="`map-resource-advanced-summary-tag-${group.id}-${item.tagId}`"
                :style="{ backgroundColor: item.color, borderColor: item.color, color: '#111827' }"
              >
                {{ item.label }}
              </span>
              <span v-if="!group.tagIds.length" class="summary-empty">{{ t('map.resource_filter_empty_group') }}</span>
            </div>
            <div class="advanced-group-actions">
              <button type="button" class="group-action" @click="openGroupEditor(group.id)">{{ t('map.resource_filter_edit') }}</button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="advanced-toolbar">
      <div class="advanced-inline-settings">
        <div class="advanced-control jump-control">
          <span>{{ t('map.resource_filter_jump_limit') }}</span>
          <div class="sunlight-input-wrap jump-input-wrap">
            <input
              class="sunlight-input"
              type="number"
              min="1"
              max="5"
              step="1"
              name="jump-limit"
              :value="jumpLimitDraft"
              data-testid="map-resource-advanced-jump-limit"
              @input="updateJumpLimit(Number(($event.target as HTMLInputElement).value || 1))"
            />
            <span class="sunlight-suffix">{{ t('map.resource_filter_jump_suffix') }}</span>
            <div class="sunlight-stepper">
              <button type="button" class="sunlight-step-btn" @click="stepJumpLimit(1)">▲</button>
              <button type="button" class="sunlight-step-btn" @click="stepJumpLimit(-1)">▼</button>
            </div>
          </div>
        </div>

        <label class="advanced-control checkbox">
          <input
            v-model="allowTransitDraft"
            class="advanced-checkbox"
            type="checkbox"
            data-testid="map-resource-advanced-allow-transit"
            @change="markDirty"
          />
          <span>{{ t('map.resource_filter_allow_transit') }}</span>
        </label>
      </div>
    </div>

    <div v-if="hasPendingRefresh" class="advanced-refresh-row">
      <span class="advanced-pending">{{ t('map.resource_filter_pending_refresh') }}</span>
      <button
        type="button"
        class="advanced-refresh-btn"
        data-testid="map-resource-advanced-refresh"
        @click="refreshCandidates"
      >
        {{ t('map.resource_filter_refresh') }}
      </button>
    </div>

    <div class="resource-candidate-box advanced-candidates">
      <div class="candidate-header">
        <span>{{ t('map.resource_filter_candidates') }}</span>
        <span class="candidate-count">{{ candidateViewModels.length }}</span>
      </div>
      <div v-if="candidateViewModels.length" class="candidate-list custom-scrollbar" data-testid="map-resource-advanced-candidate-list">
        <button
          v-for="candidate in candidateViewModels"
          :key="candidate.key"
          type="button"
          class="advanced-candidate-item"
          :class="{ selected: selectedCandidateKey === candidate.key }"
          :data-testid="`map-resource-advanced-candidate-${candidate.key}`"
          @click="onCandidateSelect(candidate)"
        >
          <div class="advanced-candidate-main">
            <div class="advanced-candidate-row">
              <span class="candidate-type-pill" data-testid="map-resource-advanced-resource-pill">
                <svg data-testid="map-resource-advanced-resource-pill-icon" class="candidate-type-pill-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 1.5 13.5 4.75v6.5L8 14.5 2.5 11.25v-6.5L8 1.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                  <path d="M5.2 6.1h5.6M6 8h4M6.8 9.9h2.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                {{ t('map.resource_filter_resource_pill') }}
              </span>
              <div class="advanced-candidate-chip-list">
              <button
                v-for="sectorId in candidate.resourceSectorIds"
                :key="sectorId"
                type="button"
                class="candidate-chip candidate-chip-button"
                :data-testid="`map-resource-advanced-resource-chip-${sectorId}`"
                @click.stop="onCandidateSectorTagClick(candidate, sectorId)"
              >
                {{ getSectorLabel(sectorId) }}
                <span
                  v-for="badge in candidate.resourceGroupBadges[sectorId] || []"
                  :key="`${sectorId}-${badge}`"
                  class="candidate-chip-badge"
                  :data-testid="`map-resource-advanced-group-badge-${sectorId}-${badge}`"
                >
                  {{ badge }}
                </span>
              </button>
              </div>
            </div>
            <div class="advanced-candidate-meta">
              <span class="candidate-type-pill" data-testid="map-resource-advanced-hub-pill">
                <svg data-testid="map-resource-advanced-hub-pill-icon" class="candidate-type-pill-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3.5" cy="8" r="1.6" fill="currentColor" />
                  <circle cx="12.5" cy="4" r="1.6" fill="currentColor" />
                  <circle cx="12.5" cy="12" r="1.6" fill="currentColor" />
                  <path d="M5 8h2.6M9.3 6l1.7-1M9.3 10l1.7 1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                {{ t('map.resource_filter_hub_pill') }}
              </span>
              <span class="advanced-candidate-hubs advanced-candidate-chip-list">
                <button
                  v-for="hubSectorId in candidate.hubCandidateSectorIds"
                  :key="hubSectorId"
                  type="button"
                  class="candidate-chip candidate-chip-button"
                  :data-testid="`map-resource-advanced-hub-chip-${hubSectorId}`"
                  @click.stop="onCandidateSectorTagClick(candidate, hubSectorId)"
                >
                  {{ getSectorLabel(hubSectorId) }}
                </button>
              </span>
            </div>
          </div>
          <span class="candidate-score">{{ Math.round(candidate.score) }}</span>
        </button>
      </div>
      <div v-else class="resource-empty">{{ t('map.resource_filter_no_match') }}</div>
    </div>

    <Teleport to="body">
      <div
        v-if="loaderMenuOpen"
        class="resource-group-loader-menu"
        ref="loaderMenuRef"
        :style="loaderMenuStyle"
        data-testid="map-resource-advanced-loader-menu"
      >
        <div class="loader-menu-group">
          <div class="loader-menu-group-title">{{ t('map.resource_filter_loader_group_sectors') }}</div>
          <button
            v-for="sector in loadableSectors"
            :key="sector.id"
            type="button"
            class="loader-menu-item"
            :class="{ active: loadedSourceType === 'sector' && loadedSourceId === sector.id }"
            :data-testid="`map-resource-advanced-loader-sector-${sector.id}`"
            @click="loadSectorStations(sector.id)"
          >
            {{ sector.name }}
          </button>
          <div v-if="loadableSectors.length === 0" class="loader-menu-empty">
            {{ t('map.resource_filter_loader_no_sectors') }}
          </div>
        </div>

        <div class="loader-menu-group">
          <div class="loader-menu-group-title">{{ t('map.resource_filter_loader_group_logicflow') }}</div>
          <button
            v-for="plan in loadableLogicFlowPlans"
            :key="plan.id"
            type="button"
            class="loader-menu-item"
            :class="{ active: loadedSourceType === 'logicflow' && loadedSourceId === plan.id }"
            :data-testid="`map-resource-advanced-loader-logicflow-${plan.id}`"
            @click="loadLogicFlowPlan(plan.id)"
          >
            {{ plan.name }}
          </button>
          <div v-if="loadableLogicFlowPlans.length === 0" class="loader-menu-empty">
            {{ t('map.resource_filter_loader_no_logicflow') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.advanced-panel {
  @apply flex flex-col gap-3 px-1.5;
}

.advanced-top-row {
  @apply flex items-center justify-between gap-2;
}

.resource-group-loader-trigger {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-400/40 text-amber-200/90 text-xs font-semibold bg-amber-200/5 hover:bg-amber-500/10 transition-colors;
}

.loader-trigger-label {
  @apply whitespace-nowrap;
}

.resource-group-loader-menu {
  @apply fixed z-[120] w-max min-w-40 max-h-64 overflow-y-auto rounded-md border border-amber-400/30 bg-slate-900/95 p-1 shadow-2xl;
  scrollbar-width: thin;
  scrollbar-color: rgba(251, 191, 36, 0.55) rgba(15, 23, 42, 0.25);
}

.loader-menu-group {
  @apply py-1;
}

.loader-menu-group-title {
  @apply px-2 py-1 text-xs font-semibold text-amber-200/70 uppercase tracking-wide;
}

.loader-menu-item {
  @apply w-full text-left px-3 py-1.5 text-sm text-amber-50 rounded hover:bg-amber-500/15 transition-colors;
}

.loader-menu-item.active {
  @apply bg-amber-500/20 text-amber-200;
}

.loader-menu-empty {
  @apply px-3 py-2 text-xs text-amber-100/50 italic;
}

.advanced-toolbar {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.advanced-inline-settings {
  @apply flex w-full flex-wrap items-center gap-3 rounded-md border border-amber-300/15 bg-black/30 px-2 py-1;
}

.advanced-control {
  @apply inline-flex items-center gap-2 text-xs text-amber-50;
}

.advanced-control.checkbox {
  @apply pr-1;
}

.advanced-control.jump-control {
  @apply pr-0;
}

.advanced-checkbox {
  @apply h-3.5 w-3.5 rounded border-amber-300/35 bg-black/70 text-amber-300 focus:ring-0;
}

.advanced-refresh-btn,
.advanced-add-btn,
.group-action {
  @apply rounded-md border border-amber-300/25 bg-amber-200/10 px-3 py-1.5 text-xs font-semibold text-amber-50 transition-colors duration-150 hover:bg-amber-200/20;
}

.advanced-refresh-btn {
  @apply ml-auto shrink-0 whitespace-nowrap;
}

.group-action.danger {
  @apply border-rose-300/25 text-rose-100 hover:bg-rose-300/15;
}

.advanced-refresh-row {
  @apply flex items-center justify-between gap-2;
}

.advanced-pending {
  @apply rounded-md border border-amber-300/20 bg-amber-200/10 px-3 py-2 text-xs text-amber-100/85;
}

.advanced-refresh-btn {
  @apply shrink-0 whitespace-nowrap;
}

.advanced-group-list {
  @apply space-y-2;
}

.advanced-add-btn {
  @apply self-start;
}

.advanced-group-card {
  @apply rounded-md border border-amber-300/15 bg-black/30 p-2;
}

.advanced-group-card.expanded {
  @apply border-amber-200/45 bg-black/45;
}

.advanced-group-line {
  @apply flex flex-wrap items-center justify-between gap-2;
}

.advanced-group-summary,
.advanced-group-tags {
  @apply flex min-w-0 flex-1 flex-wrap gap-2;
}

.advanced-group-actions {
  @apply flex shrink-0 items-center gap-2;
}

.summary-tag,
.candidate-chip {
  @apply rounded-md border border-amber-300/20 bg-amber-200/10 px-2 py-1 text-xs text-amber-50;
}

.summary-empty {
  @apply text-xs text-amber-100/45;
}

.advanced-group-yields {
  @apply mt-3 space-y-2;
}

.advanced-yield-row {
  @apply flex items-center justify-between gap-3 text-sm text-amber-50;
}

.advanced-candidate-item {
  @apply flex w-full items-start justify-between gap-3 border-b border-amber-300/10 px-3 py-2 text-left transition-colors duration-150 hover:bg-amber-300/10;
}

.advanced-candidate-item.selected {
  @apply bg-amber-200/10;
}

.advanced-candidate-main {
  @apply min-w-0 flex-1;
}

.advanced-candidate-row {
  @apply flex items-start gap-2;
}

.advanced-candidate-meta {
  @apply mt-1 flex items-start gap-2 text-[11px] text-amber-100/65;
}

.advanced-candidate-hubs {
  @apply flex flex-wrap gap-2;
}

.candidate-chip-button {
  @apply inline-flex items-center gap-1.5 cursor-pointer transition-colors duration-150 hover:bg-amber-200/20;
}

.advanced-candidate-chip-list {
  @apply flex min-w-0 flex-1 flex-wrap gap-2;
}

.candidate-type-pill {
  @apply inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-200/10 px-2 py-1 text-xs text-amber-50;
  min-width: 3.75rem;
}

.candidate-type-pill-icon {
  @apply h-3.5 w-3.5 shrink-0 opacity-80;
}

.candidate-chip-badge {
  @apply inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-amber-200/30 bg-black/35 px-1 text-[10px] font-bold leading-none text-amber-50;
}
</style>
