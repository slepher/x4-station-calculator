<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import {
  ADVANCED_SUNLIGHT_TAG_ID,
  buildAdvancedCandidates,
  buildSectorGraph,
  type AdvancedResourceSector,
  type AdvancedResourceTagGroup
} from '@/store/logic/mapAdvancedResourceFilter'
import {
  buildFixedYieldEntries,
  buildYieldRanksByWare,
  getSharedMinYieldName,
  MIXED_YIELD_VALUE,
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
const RESOURCE_ORDER = ['ore', 'silicon', 'methane', 'hydrogen', 'helium', 'ice', 'rawscrap', 'nividium'] as const

const formatYieldLabel = (yieldName: string) => {
  const levelKey = `map.yield_levels.${yieldName}`
  const levelText = t(levelKey)
  const fallbackLevel = yieldName === 'low' ? 'Low' :
                      yieldName === 'midlow' ? 'Mid Low' :
                      yieldName === 'medium' ? 'Medium' :
                      yieldName === 'midhigh' ? 'Mid High' :
                      yieldName === 'high' ? 'High' : yieldName

  const displayLevel = levelKey !== levelText ? levelText : fallbackLevel

  return displayLevel
}
const regionYields = computed(() => buildFixedYieldEntries([...RESOURCE_ORDER]))
// 使用 res.json 的 color_rgb 作为资源颜色（与 MapWorkbenchView.vue 保持一致）
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
  const clusters = gameData.maps?.clusters || {}
  Object.values(clusters).forEach((cluster) => {
    // DLC filter: skip clusters from inactive DLC
    if (gameData.enforceDlcActivation && !gameData.isDlcActive(cluster.dlc_tag)) {
      return
    }
    Object.values(cluster.sectors || {}).forEach((sector: any) => {
      out[sector.id] = {
        resources: Array.isArray(sector.resources) ? sector.resources : [],
        sunlight: Math.round(Number(sector.area?.sunlight || 0) * 100)
      }
    })
  })
  return out
})

const sectorGraphResult = computed(() => buildSectorGraph(gameData.maps?.clusters || {}))
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

        <button
          type="button"
          class="advanced-refresh-btn"
          data-testid="map-resource-advanced-refresh"
          @click="refreshCandidates"
        >
          {{ t('map.resource_filter_refresh') }}
        </button>
      </div>
    </div>

    <div v-if="hasPendingRefresh" class="advanced-pending">{{ t('map.resource_filter_pending_refresh') }}</div>

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
                  {{ formatYieldLabel(yieldName) }}
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

    <button type="button" class="advanced-add-btn" data-testid="map-resource-advanced-add-group" @click="addGroup">
      {{ t('map.resource_filter_add_group') }}
    </button>

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
  </div>
</template>
