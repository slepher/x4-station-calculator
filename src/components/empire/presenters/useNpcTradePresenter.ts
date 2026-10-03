import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import i18n from '@/i18n'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useNpcTradeStore } from '@/store/useNpcTradeStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { createOverlayItem, useSaveStore } from '@/store/useSaveStore'
import { generateFilteredWaresGrouped } from '@/store/logic/searchWare'
import { isSectorMacroInBindingScope } from '@/store/logic/saveBindingSectorScope'
import { breadthFirstReachable, buildSectorGraph } from '@/store/logic/mapSectorGraph'
import {
  buildNpcTradeCandidates,
  calculateContainerWareMaxLoad,
  classifyNpcTradeEligibility,
  createNpcTradeStationComparator,
  groupNpcTradeStations,
  npcTradeSortNeedsTargets,
  type NpcTradeDemandSource,
  type NpcTradeRankMode,
  type NpcTradeSortMetric,
  type PlayerTradeDirection,
  type WareTarget
} from '@/store/logic/npcTradeOffers'
import { CURRENT_PARSER_VERSION } from '@/workers/saveParser.post'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getSectorZoneBoundingCenter } from '@/components/map/utils/coordinates'
import { getStationPoiLabel } from '@/components/map/savePoiLabel'
import { useX4I18n } from '@/utils/UseX4I18n'
import { formatDisplayRelation } from '@/utils/reputation'
import type { TradeRole } from '@/store/logic/tradeAutoFill'
import type { BindingSectorGroup, BindingStationPlan, TradeStationBinding } from '@/types/x4'

export type NpcTradePageState =
  | 'contextUnavailable'
  | 'stationNotSelected'
  | 'waresEmpty'
  | 'targetMissing'
  | 'noMatches'
  | 'results'

export interface NpcTradeStationOption {
  id: string
  entityId: string
  role: TradeRole
  label: string
  disabled: boolean
  disabledReason: string | null
  sectorMacro: string | null
  position: { x: number; y: number; z: number } | null
}

export interface NpcTradeStationOptionGroup {
  id: string
  label: string
  options: NpcTradeStationOption[]
}

export interface NpcTradeWareSearchGroup {
  id: string
  label: string
  items: Array<{
    id: string
    label: string
    color: string
    tag?: { label: string; active: boolean }
  }>
}

export interface NpcTradeWareTargetView extends WareTarget {
  sourceLabel: string | null
  label: string
}

export interface NpcTradeOfferView {
  tradeId: string
  source: NpcTradeDemandSource
  sourceLabel: string
  price: number
  amount: number
}

export interface NpcTradeStationCard {
  key: string
  stationName: string
  code: string
  ownerLabel: string | null
  distanceLabel: string | null
  wareOffers: Array<{
    wareId: string
    wareLabel: string
    offers: NpcTradeOfferView[]
  }>
}

export interface NpcTradeCandidateSection {
  key: string
  sectorLabel: string
  sectorOwnerLabel: string | null
  jumpLabel: string
  stations: NpcTradeStationCard[]
}

export interface NpcTradeIneligibleFactionGroup {
  key: string
  factionLabel: string
  reputationLabel: string
  expanded: boolean
  page: number
  pageCount: number
  sectors: NpcTradeCandidateSection[]
}

export interface NpcTradeShipType {
  macro: string
  shipName: string
  shipType: string
  size: 'L' | 'M'
  capacity: number
  loadLimits: Array<{ wareId: string; wareLabel: string; maxAmount: number }>
}

export interface NpcTradeShipGroup {
  sectorMacro: string
  sectorLabel: string
  bindingGroupNames: string[]
  ships: Array<{
    componentId: string
    shipName: string
    customName: string | null
    relativeLabel: string
    availability: 'immediatelyAvailable' | 'reclaimable'
    availabilityLabel: string
  }>
}

export interface NpcTradePresenterProps {
  direction: Ref<PlayerTradeDirection>
  selectedPlayerStationGroupId: Ref<string | null>
  selectedPlayerStationId: Ref<string | null>
  jumpLimit: Ref<number>
  searchQuery: Ref<string>
  rankMode: Ref<NpcTradeRankMode>
  sortMetric: Ref<NpcTradeSortMetric>
  primaryWareId: Ref<string | null>
  stationGroups: ComputedRef<NpcTradeStationOptionGroup[]>
  selectedStationOptions: ComputedRef<NpcTradeStationOption[]>
  searchGroups: ComputedRef<NpcTradeWareSearchGroup[]>
  wareTargets: ComputedRef<NpcTradeWareTargetView[]>
  candidateSections: ComputedRef<NpcTradeCandidateSection[]>
  candidatePage: Ref<number>
  candidatePageCount: ComputedRef<number>
  ineligibleFactionGroups: ComputedRef<NpcTradeIneligibleFactionGroup[]>
  shipTypes: ComputedRef<NpcTradeShipType[]>
  shipGroups: ComputedRef<NpcTradeShipGroup[]>
  shipPage: Ref<number>
  shipPageCount: ComputedRef<number>
  pageState: ComputedRef<NpcTradePageState>
  pageStateLabel: ComputedRef<string>
  autoFillEnabled: Ref<boolean>
  autoFillAvailable: ComputedRef<boolean>
  autoFillDisabledReason: ComputedRef<string | null>
  autoFillScope: ComputedRef<string>
  autoFillStatus: ComputedRef<string>
  autoFillSource: ComputedRef<string>
  autoFillCanUndo: ComputedRef<boolean>
  autoFillDetails: ComputedRef<Array<{
    wareId: string
    label: string
    summary: string
    currentLabel: string
    stations: Array<{ entityId: string; label: string; summary: string }>
  }>>
  canUseComposite: ComputedRef<boolean>
  canUseTargetMetric: ComputedRef<boolean>
}

export interface NpcTradePresenterEmits {
  autoFill: () => void
  setAutoFillEnabled: (enabled: boolean) => void
  undoAutoFill: () => void
  setDirection: (direction: PlayerTradeDirection) => void
  selectPlayerStationGroup: (groupId: string | null) => void
  selectPlayerStation: (stationId: string | null) => void
  setJumpLimit: (value: number) => void
  setSearchQuery: (query: string) => void
  addWare: (wareId: string) => void
  updateTargetQty: (wareId: string, value: number | null) => void
  removeWare: (wareId: string) => void
  setRankMode: (mode: NpcTradeRankMode) => void
  setSortMetric: (metric: NpcTradeSortMetric) => void
  setPrimaryWare: (wareId: string) => void
  setCandidatePage: (page: number) => void
  setIneligibleFactionExpanded: (factionId: string, expanded: boolean) => void
  setIneligibleFactionPage: (factionId: string, page: number) => void
  setShipPage: (page: number) => void
}

const NPC_TRADE_SECTORS_PER_PAGE = 10

export function paginateNpcTradeSectorGroups<T>(groups: T[], page: number): T[] {
  const start = (Math.max(1, page) - 1) * NPC_TRADE_SECTORS_PER_PAGE
  return groups.slice(start, start + NPC_TRADE_SECTORS_PER_PAGE)
}

export function npcTradeSourceLabelKey(
  direction: PlayerTradeDirection,
  source: NpcTradeDemandSource
): string {
  if (direction === 'buy' && source === 'station') return 'npc_trade.source.stationSell'
  return `npc_trade.source.${source}`
}

export function normalizeNpcTradeSectorOwner(owner: string): string | null {
  const normalized = owner.trim()
  return normalized.length === 0 || normalized === 'ownerless' ? null : normalized
}

function resolveEntrySector(
  entry: BindingStationPlan | TradeStationBinding,
  group: BindingSectorGroup
): string | null {
  const ownSector = entry.sectorMacro?.trim()
  if (ownSector) return ownSector
  const anchorSector = group.sectorMacro?.trim()
  return anchorSector ? anchorSector : null
}

export function useNpcTradePresenter(): { props: NpcTradePresenterProps; emits: NpcTradePresenterEmits } {
  const activeViewStore = useActiveViewStore()
  const bindingStore = useSaveBindingStore()
  const liveProductionStore = useLiveProductionStore()
  const npcTradeStore = useNpcTradeStore()
  const saveStore = useSaveStore()
  const gameDataStore = useGameDataStore()
  const { activeBinding } = storeToRefs(bindingStore)
  const { confirmedTradeBinding } = storeToRefs(liveProductionStore)
  const {
    direction,
    selectedPlayerStationGroupId,
    selectedPlayerStationId,
    jumpLimit,
    targets,
    primaryWareId,
    rankMode,
    sortMetric,
    autoFillEnabled
  } = storeToRefs(npcTradeStore)
  const { selectedArchive, selectedArchivePlayerShips, archives } = storeToRefs(saveStore)
  const { translateFaction, translateSector, translateShipType } = useX4I18n()

  const searchQuery = ref('')
  const candidatePage = ref(1)
  const shipPage = ref(1)
  const expandedIneligibleFactionKeys = ref<Set<string>>(new Set())
  const ineligibleFactionPages = ref<Record<string, number>>({})

  watch(
    () => activeBinding.value === null ? null : activeBinding.value.gameGuid,
    (gameGuid) => { npcTradeStore.setBindingGameGuid(gameGuid) },
    { immediate: true }
  )

  const bindingArchive = computed(() => {
    const binding = activeBinding.value
    const archive = selectedArchive.value
    if (binding === null || archive === null) return null
    if (activeViewStore.activeBinding !== binding.gameGuid) return null
    if (archive.meta.guid !== binding.gameGuid) return null
    let expectedTime = binding.selectedArchiveTime
    if (expectedTime === null) {
      const group = archives.value.get(binding.gameGuid)
      const latest = group?.saves.find((item) => item.isValid && item.isCompatible)
      if (latest === undefined) return null
      expectedTime = latest.meta.time
    }
    if (archive.meta.time !== expectedTime) return null
    if (archive.meta.parser_version !== CURRENT_PARSER_VERSION) return null
    if (!archive.isCompatible || !archive.isValid) return null
    return archive
  })

  const contextAvailable = computed(() => bindingArchive.value !== null && gameDataStore.isReady)

  const sectorLabel = (sectorMacro: string): string => {
    const resolved = resolveMapSectorByMacro(gameDataStore.maps, sectorMacro)
    return resolved === null ? sectorMacro : translateSector(resolved.sector)
  }

  const stationOptionLabel = (stationName: string, sectorMacro: string | null): string => {
    if (sectorMacro === null) return `${stationName} — ${i18n.global.t('npc_trade.station_sector_missing')}`
    return i18n.global.t('npc_trade.station_option', { sector: sectorLabel(sectorMacro), station: stationName })
  }

  const resolveEntryPosition = (
    entry: BindingStationPlan | TradeStationBinding,
    sectorMacro: string | null
  ): { x: number; y: number; z: number } | null => {
    if (sectorMacro === null) return null
    if (entry.saveStationCode === undefined) {
      const resolved = resolveMapSectorByMacro(gameDataStore.maps, sectorMacro)
      if (resolved === null) return null
      const hasRawCenter = resolved.sector.raw_center_pos?.x !== undefined
        && resolved.sector.raw_center_pos?.z !== undefined
      const hasZoneCenter = Object.values(resolved.sector.zones || {}).some((zone) =>
        zone.raw_sector_pos?.x !== undefined && zone.raw_sector_pos?.z !== undefined
      )
      if (!hasRawCenter && !hasZoneCenter) return null
      const center = getSectorZoneBoundingCenter(resolved.sector)
      return { x: center.x, y: 0, z: center.z }
    }
    const archive = bindingArchive.value
    if (archive === null) return null
    const station = archive.sectors[sectorMacro]?.player_stations?.[entry.saveStationCode]
    return station === undefined ? null : station.position
  }

  const resolveArchiveStationPosition = (
    sectorMacro: string,
    stationCode: string
  ): { x: number; y: number; z: number } | null => {
    const archive = bindingArchive.value
    if (archive === null) return null
    const station = archive.sectors[sectorMacro]?.player_stations?.[stationCode]
    return station === undefined ? null : station.position
  }

  const stationGroups = computed<NpcTradeStationOptionGroup[]>(() => {
    const binding = confirmedTradeBinding.value
    if (binding === null) return []
    return [...binding.groups].sort((a, b) => a.order - b.order).map((group, groupIndex) => {
      const groupId = group.sectorMacro === undefined ? `group:${groupIndex}` : group.sectorMacro
      const membership = liveProductionStore.getTradeMembers(groupId)
      const options: NpcTradeStationOption[] = membership.status === 'unavailable' ? [] : membership.members.map(member => {
        let position: NpcTradeStationOption['position'] = null
        if (member.stationCode !== null && member.sectorMacro !== null) {
          position = resolveArchiveStationPosition(member.sectorMacro, member.stationCode)
        } else if (member.plan !== null) {
          position = resolveEntryPosition(member.plan, member.sectorMacro)
        } else if (group.tradeStation !== undefined) {
          position = resolveEntryPosition(group.tradeStation, resolveEntrySector(group.tradeStation, group))
        }
        return {
          id: member.referenceId, entityId: member.entityId, role: member.role,
          label: `${i18n.global.t(`npc_trade.auto_fill.role.${member.role}`)} · ${stationOptionLabel(member.name, member.sectorMacro)}`,
          disabled: member.sectorMacro === null,
          disabledReason: member.sectorMacro === null ? i18n.global.t('npc_trade.station_sector_missing') : null,
          sectorMacro: member.sectorMacro, position
        }
      })
      return { id: groupId, label: group.name, options }
    })
  })

  const selectedStationOptions = computed(() => {
    const group = stationGroups.value.find((item) => item.id === selectedPlayerStationGroupId.value)
    return group === undefined ? [] : group.options
  })

  const selectedPlayerStation = computed(() => selectedStationOptions.value
    .find((option) => option.id === selectedPlayerStationId.value && !option.disabled) ?? null)

  watch([stationGroups, () => liveProductionStore.loadedTradeArchiveKey], () => {
    const groupExists = stationGroups.value.some((group) => group.id === selectedPlayerStationGroupId.value)
    if (!groupExists) {
      selectedPlayerStationGroupId.value = null
      selectedPlayerStationId.value = null
      return
    }
    const archive = bindingArchive.value
    const recordsReady = archive !== null && liveProductionStore.loadedTradeArchiveKey === JSON.stringify([archive.meta.guid, archive.meta.time])
    if (recordsReady && selectedPlayerStationGroupId.value !== null) {
      const membership = liveProductionStore.getTradeMembers(selectedPlayerStationGroupId.value)
      if (membership.status === 'ready' && selectedPlayerStationId.value !== null && selectedPlayerStation.value === null) {
        selectedPlayerStationId.value = null
      }
    }
  }, { immediate: true })

  const autoFillContextKey = computed(() => {
    const binding = activeBinding.value
    let time = binding === null ? null : binding.selectedArchiveTime
    if (binding !== null && time === null) {
      const latest = archives.value.get(binding.gameGuid)?.saves.find(a => a.isValid && a.isCompatible)
      time = latest === undefined ? null : latest.meta.time
    }
    return JSON.stringify([binding === null ? null : binding.gameGuid, time,
      selectedPlayerStationGroupId.value, selectedPlayerStationId.value, direction.value])
  })

  const autoFillResult = computed(() => {
    const groupId = selectedPlayerStationGroupId.value
    const stationId = selectedPlayerStationId.value
    if (groupId === null || stationId === null || !contextAvailable.value) {
      return { status: 'unavailable' as const, reason: 'context' as const }
    }
    const selected = selectedPlayerStation.value
    const entityId = selected === null ? stationId : selected.entityId
    return liveProductionStore.getTradeAutoFill(groupId, entityId, direction.value)
  })

  watch(autoFillContextKey, key => { npcTradeStore.observeContext(key) }, { immediate: true, flush: 'sync' })
  watch([autoFillResult, () => npcTradeStore.pendingFill], ([result, request]) => {
    if (request === null || request.contextKey !== autoFillContextKey.value) return
    if (result.status === 'ready') npcTradeStore.applyFill(request.id, request.contextKey, result)
    else npcTradeStore.rejectFill(request.id, request.contextKey, result)
  }, { immediate: true, flush: 'sync' })

  const autoFillAvailable = computed(() => autoFillResult.value.status === 'ready')
  const autoFillDisabledReason = computed(() => {
    const result = autoFillResult.value
    if (result.status === 'ready') return null
    return i18n.global.t(`npc_trade.auto_fill.reason.${result.reason}`, { entity: result.entityId === undefined ? '' : result.entityId })
  })
  const autoFillScope = computed(() => {
    const selected = selectedPlayerStation.value
    if (selected === null) return i18n.global.t('npc_trade.auto_fill.reason.context')
    return i18n.global.t(`npc_trade.auto_fill.scope.${selected.role}_${direction.value}`)
  })
  const autoFillCanUndo = computed(() => npcTradeStore.fillUndo !== null && npcTradeStore.fillUndo.contextKey === autoFillContextKey.value)
  const autoFillStatus = computed(() => {
    const fill = npcTradeStore.lastFill
    const failure = npcTradeStore.fillFailure
    if (failure !== null && failure.contextKey === autoFillContextKey.value) {
      return i18n.global.t('npc_trade.auto_fill.unavailable', { reason: i18n.global.t(`npc_trade.auto_fill.reason.${failure.result.reason}`, { entity: failure.result.entityId === undefined ? '' : failure.result.entityId }) })
    }
    if (fill === null) return ''
    const current = autoFillResult.value
    if (current.status === 'unavailable') {
      return i18n.global.t('npc_trade.auto_fill.unavailable', { reason: autoFillDisabledReason.value })
    }
    if (fill.contextKey !== autoFillContextKey.value) return i18n.global.t('npc_trade.auto_fill.stale')
    if (fill.adjusted) return i18n.global.t(autoFillEnabled.value ? 'npc_trade.auto_fill.adjusted_auto' : 'npc_trade.auto_fill.adjusted')
    if (fill.result.targets.length === 0) return i18n.global.t(`npc_trade.auto_fill.empty_${direction.value}`)
    return i18n.global.t('npc_trade.auto_fill.updated')
  })
  const autoFillSource = computed(() => {
    const fill = npcTradeStore.lastFill
    if (fill === null) return ''
    const [, , groupId, optionId, fillDirection] = JSON.parse(fill.contextKey) as [string, number, string, string, PlayerTradeDirection]
    const group = stationGroups.value.find(g => g.id === groupId)
    const station = group === undefined ? undefined : group.options.find(o => o.id === optionId)
    return i18n.global.t('npc_trade.auto_fill.source', {
      station: station === undefined ? optionId : station.label,
      direction: i18n.global.t(`npc_trade.direction.${fillDirection}`)
    })
  })
  const accountLabel = (account: { requirement: number; buildingStock: number; buildingApplied: number; deficit: number; stock: number }): string =>
    i18n.global.t('npc_trade.auto_fill.account', account)
  const autoFillDetails = computed(() => {
    const fill = npcTradeStore.lastFill
    if (fill === null) return []
    return fill.result.accounts.map(account => {
      const ware = gameDataStore.localizedWaresMap[account.wareId]
      const target = targets.value.find(t => t.wareId === account.wareId)
      const currentLabel = target === undefined ? i18n.global.t('npc_trade.auto_fill.removed')
        : target.targetQty === null ? i18n.global.t('npc_trade.auto_fill.no_quantity') : String(target.targetQty)
      return {
        wareId: account.wareId, label: ware === undefined ? account.wareId : ware.localeName,
        summary: `${accountLabel(account)} · ${i18n.global.t('npc_trade.auto_fill.suggested', { quantity: account.suggested })}`,
        currentLabel: i18n.global.t('npc_trade.auto_fill.current', { quantity: currentLabel }),
        stations: fill.result.stations.map(station => {
          const member = stationGroups.value.flatMap(g => g.options).find(o => o.entityId === station.entityId)
          const ledger = station.accounts.find(a => a.wareId === account.wareId)!
          return { entityId: station.entityId, label: member === undefined ? station.entityId : member.label, summary: accountLabel(ledger) }
        })
      }
    })
  })

  const searchGroups = computed<NpcTradeWareSearchGroup[]>(() => {
    const selectedIds = new Set(targets.value.map((target) => target.wareId))
    return generateFilteredWaresGrouped(
      searchQuery.value,
      gameDataStore.currentLocale,
      gameDataStore.localizedWaresMap,
      gameDataStore.localizedModuleGroupsMap,
      (ware) => !selectedIds.has(ware.id)
    ).map((group) => ({
      id: group.group,
      label: group.group === 'others' ? i18n.global.t('common.others') : group.displayLabel,
      items: group.wares.map((ware) => {
        const groupColor = ware.moduleGroup?.color_rgb
        const color = typeof groupColor === 'string' && groupColor.length > 0 ? groupColor : '#0ea5e9'
        const tag = ware.dlc_tag === 'base'
          ? undefined
          : {
              label: gameDataStore.getDlcDisplayName(ware.dlc_tag),
              active: gameDataStore.isDlcActive(ware.dlc_tag)
            }
        return { id: ware.id, label: ware.displayLabel, color, tag }
      })
    }))
  })

  const wareTargets = computed<NpcTradeWareTargetView[]>(() => targets.value.map((target) => {
    const ware = gameDataStore.localizedWaresMap[target.wareId]
    const fill = npcTradeStore.lastFill
    const suggestion = fill === null ? undefined : fill.result.targets.find(t => t.wareId === target.wareId)
    const sourceLabel = suggestion === undefined ? null : i18n.global.t(
      suggestion.targetQty === target.targetQty ? 'npc_trade.auto_fill.auto' : 'npc_trade.auto_fill.adjusted_badge'
    )
    return {
      ...target,
      sourceLabel,
      label: ware === undefined ? target.wareId : ware.localeName
    }
  }))

  const canUseComposite = computed(() => targets.value.length > 0 && targets.value.every((target) =>
    target.targetQty !== null && target.targetQty > 0
  ))

  const canUseTargetMetric = computed(() => {
    const target = targets.value.find((item) => item.wareId === primaryWareId.value)
    return target !== undefined && target.targetQty !== null && target.targetQty > 0
  })

  const missingTargetWareLabels = computed(() => {
    const missing = rankMode.value === 'composite'
      ? targets.value.filter((target) => target.targetQty === null || target.targetQty <= 0)
      : targets.value.filter((target) => target.wareId === primaryWareId.value && (target.targetQty === null || target.targetQty <= 0))
    return missing.map((target) => {
      const ware = gameDataStore.localizedWaresMap[target.wareId]
      return ware === undefined ? target.wareId : ware.localeName
    })
  })

  const jumpDistances = computed<Record<string, number> | null>(() => {
    const station = selectedPlayerStation.value
    if (station === null || station.sectorMacro === null) return null
    const { graph, sectorClusterMap } = buildSectorGraph(
      gameDataStore.maps.clusters,
      gameDataStore.maps.sectors
    )
    if (graph[station.sectorMacro] === undefined) return null
    return breadthFirstReachable(
      graph,
      station.sectorMacro,
      Math.max(0, jumpLimit.value),
      sectorClusterMap
    )
  })

  const jumpDistanceTo = (sectorMacro: string): number | null => {
    const distances = jumpDistances.value
    if (distances === null) return null
    const distance = distances[sectorMacro]
    return typeof distance === 'number' ? distance : null
  }

  const passesJumpFilter = (sectorMacro: string): boolean => {
    if (selectedPlayerStation.value === null) return true
    const jumps = jumpDistanceTo(sectorMacro)
    return jumps !== null && jumps <= jumpLimit.value
  }

  const candidateBuckets = computed(() => {
    const archive = bindingArchive.value
    if (!contextAvailable.value || archive === null || targets.value.length === 0) {
      return { eligible: [], insufficientRelation: [] }
    }
    const candidates = buildNpcTradeCandidates(
      archive,
      direction.value,
      targets.value.map((target) => target.wareId)
    )
    const comparator = createNpcTradeStationComparator({
      direction: direction.value,
      rankMode: rankMode.value,
      metric: sortMetric.value,
      targets: targets.value,
      primaryWareId: primaryWareId.value
    })
    const eligible: typeof candidates = []
    const insufficientRelation: typeof candidates = []
    const classified = candidates.flatMap((candidate) => {
      if (!passesJumpFilter(candidate.sectorMacro)) return []
      const faction = gameDataStore.factions.find((item) => item.id === candidate.owner)
      const eligibility = classifyNpcTradeEligibility(
        faction?.tags,
        archive.playerRelations?.[candidate.owner]
      )
      return eligibility === 'excluded' ? [] : [{ candidate, eligibility }]
    }).sort((a, b) => comparator(a.candidate, b.candidate))
    for (const { candidate, eligibility } of classified) {
      if (eligibility === 'eligible') eligible.push(candidate)
      if (eligibility === 'insufficientRelation') insufficientRelation.push(candidate)
    }
    return { eligible, insufficientRelation }
  })

  const sourceLabel = (source: NpcTradeDemandSource): string => i18n.global.t(
    npcTradeSourceLabelKey(direction.value, source)
  )

  const relativeLabel = (
    sectorMacro: string,
    position: { x: number; y: number; z: number } | undefined
  ): string => {
    const station = selectedPlayerStation.value
    if (station === null || station.sectorMacro === null) return i18n.global.t('npc_trade.relative.unknown')
    if (station.sectorMacro !== sectorMacro) {
      const jumps = jumpDistanceTo(sectorMacro)
      return jumps !== null
        ? i18n.global.t('npc_trade.relative.jumps', { count: jumps })
        : i18n.global.t('npc_trade.relative.unknown')
    }
    if (station.position === null || position === undefined) return i18n.global.t('npc_trade.relative.unknown')
    const dx = station.position.x - position.x
    const dy = station.position.y - position.y
    const dz = station.position.z - position.z
    const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz) / 1000
    return i18n.global.t('npc_trade.relative.distance', { distance: distanceKm.toFixed(1) })
  }

  const jumpLabel = (sectorMacro: string): string => {
    const jumps = jumpDistanceTo(sectorMacro)
    return jumps === null
      ? i18n.global.t('npc_trade.relative.unknown')
      : i18n.global.t('npc_trade.relative.jumps', { count: jumps })
  }

  const factionLabel = (factionId: string): string => {
    const faction = gameDataStore.factions.find((item) => item.id === factionId)
    return faction === undefined ? i18n.global.t('npc_trade.unknown') : translateFaction(faction)
  }

  const sectorOwner = (sectorMacro: string): string | null => {
    const resolved = resolveMapSectorByMacro(gameDataStore.maps, sectorMacro)
    if (resolved === null) return null
    return normalizeNpcTradeSectorOwner(resolved.sector.owner)
  }

  const toStationCard = (
    candidate: ReturnType<typeof buildNpcTradeCandidates>[number],
    ownerLabel: string | null
  ): NpcTradeStationCard => {
    const stationName = getStationPoiLabel(
      createOverlayItem('npcStation', candidate.sectorMacro, sectorLabel(candidate.sectorMacro), candidate.station),
      {
        t: (key) => i18n.global.t(key),
        localizedModulesMap: gameDataStore.localizedModulesMap,
        localizedModuleGroupsMap: gameDataStore.localizedModuleGroupsMap
      }
    )
    return {
      key: candidate.key,
      stationName,
      code: candidate.code,
      ownerLabel,
      distanceLabel: selectedPlayerStation.value?.sectorMacro === candidate.sectorMacro
        ? relativeLabel(candidate.sectorMacro, candidate.station.position)
        : null,
      wareOffers: targets.value.flatMap((target) => {
        const offers = candidate.offersByWare[target.wareId]
        if (offers === undefined) return []
        const ware = gameDataStore.localizedWaresMap[target.wareId]
        return [{
          wareId: target.wareId,
          wareLabel: ware === undefined ? target.wareId : ware.localeName,
          offers: offers.map((offer) => ({
            tradeId: offer.tradeId,
            source: offer.source,
            sourceLabel: sourceLabel(offer.source),
            price: offer.price,
            amount: offer.amount
          }))
        }]
      })
    }
  }

  const eligibleSectorGroups = computed(() => {
    const comparator = createNpcTradeStationComparator({
      direction: direction.value,
      rankMode: rankMode.value,
      metric: sortMetric.value,
      targets: targets.value,
      primaryWareId: primaryWareId.value
    })
    return groupNpcTradeStations(candidateBuckets.value.eligible, comparator)
  })

  const candidatePageCount = computed(() => Math.max(
    1,
    Math.ceil(eligibleSectorGroups.value.length / NPC_TRADE_SECTORS_PER_PAGE)
  ))

  const candidateSections = computed<NpcTradeCandidateSection[]>(() => {
    const page = Math.min(candidatePage.value, candidatePageCount.value)
    return paginateNpcTradeSectorGroups(eligibleSectorGroups.value, page).map((group) => {
      const owner = sectorOwner(group.sectorMacro)
      return {
        key: group.sectorMacro,
        sectorLabel: sectorLabel(group.sectorMacro),
        sectorOwnerLabel: owner === null ? null : factionLabel(owner),
        jumpLabel: jumpLabel(group.sectorMacro),
        stations: group.stations.map((station) => toStationCard(
          station,
          station.owner === owner ? null : factionLabel(station.owner)
        ))
      }
    })
  })

  const ineligibleFactionGroups = computed<NpcTradeIneligibleFactionGroup[]>(() => {
    const archive = bindingArchive.value
    if (archive === null) return []
    const comparator = createNpcTradeStationComparator({
      direction: direction.value,
      rankMode: rankMode.value,
      metric: sortMetric.value,
      targets: targets.value,
      primaryWareId: primaryWareId.value
    })
    const byFaction = new Map<string, typeof candidateBuckets.value.insufficientRelation>()
    for (const candidate of candidateBuckets.value.insufficientRelation) {
      const existing = byFaction.get(candidate.owner)
      if (existing === undefined) byFaction.set(candidate.owner, [candidate])
      else existing.push(candidate)
    }
    return Array.from(byFaction, ([factionId, stations]) => {
      const sectorGroups = groupNpcTradeStations(stations, comparator)
      const pageCount = Math.max(1, Math.ceil(sectorGroups.length / NPC_TRADE_SECTORS_PER_PAGE))
      const storedPage = ineligibleFactionPages.value[factionId]
      const page = typeof storedPage === 'number' ? Math.min(storedPage, pageCount) : 1
      const expanded = expandedIneligibleFactionKeys.value.has(factionId)
      return {
        key: factionId,
        factionLabel: factionLabel(factionId),
        reputationLabel: formatDisplayRelation(archive.playerRelations?.[factionId]),
        expanded,
        page,
        pageCount,
        sectors: expanded
          ? paginateNpcTradeSectorGroups(sectorGroups, page).map((group) => ({
              key: `${factionId}:${group.sectorMacro}`,
              sectorLabel: sectorLabel(group.sectorMacro),
              sectorOwnerLabel: (() => {
                const owner = sectorOwner(group.sectorMacro)
                return owner === null ? null : factionLabel(owner)
              })(),
              jumpLabel: jumpLabel(group.sectorMacro),
              stations: group.stations.map((station) => toStationCard(station, null))
            }))
          : []
      }
    })
  })

  watch(candidateBuckets, () => {
    candidatePage.value = 1
    expandedIneligibleFactionKeys.value = new Set()
    ineligibleFactionPages.value = {}
  })

  const shipCatalog = computed<{ types: NpcTradeShipType[]; groups: NpcTradeShipGroup[] }>(() => {
    const binding = activeBinding.value
    if (!contextAvailable.value || binding === null) return { types: [], groups: [] }
    const types = new Map<string, NpcTradeShipType>()
    const grouped = new Map<string, NpcTradeShipGroup['ships']>()
    for (const ship of selectedArchivePlayerShips.value) {
      if (ship.availability !== 'immediatelyAvailable' && ship.availability !== 'reclaimable') continue
      if (!passesJumpFilter(ship.sectorMacro)) continue
      const staticShip = gameDataStore.ships.find((item) => item.macro === ship.macro)
      if (staticShip === undefined) continue
      if (staticShip.class !== 'ship_l' && staticShip.class !== 'ship_m') continue
      if (staticShip.class === 'ship_l' && staticShip.type !== 'freighter') continue
      if (staticShip.class === 'ship_m' && staticShip.type !== 'transporter') continue
      const shipType = gameDataStore.gameData?.shipTypes.find((item) => item.id === staticShip.type)
      if (shipType === undefined) continue
      const localizedShip = gameDataStore.localizedShipsMap[staticShip.id]
      if (localizedShip === undefined) continue
      const containerCargo = staticShip.cargo.find((cargo) => cargo.type === 'container')
      if (containerCargo === undefined) continue
      if (!types.has(ship.macro)) {
        types.set(ship.macro, {
          macro: ship.macro,
          shipName: localizedShip.localeName,
          shipType: translateShipType(shipType),
          size: staticShip.class === 'ship_l' ? 'L' : 'M',
          capacity: containerCargo.capacity,
          loadLimits: wareTargets.value.map((target) => {
            const ware = gameDataStore.localizedWaresMap[target.wareId]
            const maxAmount = ware === undefined ? 0 : calculateContainerWareMaxLoad(containerCargo.capacity, ware)
            return { wareId: target.wareId, wareLabel: target.label, maxAmount }
          })
        })
      }
      const customName = ship.name?.trim()
      const current = grouped.get(ship.sectorMacro)
      const item = {
        componentId: ship.componentId,
        shipName: localizedShip.localeName,
        customName: customName === undefined || customName.length === 0 || /^\{\d+,\d+\}$/.test(customName)
          ? null
          : customName,
        relativeLabel: relativeLabel(ship.sectorMacro, ship.position),
        availability: ship.availability,
        availabilityLabel: i18n.global.t(`npc_trade.ship.${ship.availability}`)
      }
      if (current === undefined) grouped.set(ship.sectorMacro, [item])
      else current.push(item)
    }
    const groups = Array.from(grouped, ([sectorMacro, ships]) => ({
      sectorMacro,
      sectorLabel: sectorLabel(sectorMacro),
      bindingGroupNames: binding.groups
        .filter((group) => isSectorMacroInBindingScope(group, sectorMacro))
        .map((group) => group.name),
      ships: ships.sort((a, b) => {
        if (a.availability !== b.availability) {
          return a.availability === 'immediatelyAvailable' ? -1 : 1
        }
        return a.shipName.localeCompare(b.shipName)
      })
    })).sort((a, b) => a.sectorLabel.localeCompare(b.sectorLabel))
    return {
      groups,
      types: Array.from(types.values()).sort((a, b) => {
        const nameOrder = a.shipName.localeCompare(b.shipName)
        return nameOrder === 0 ? a.macro.localeCompare(b.macro) : nameOrder
      })
    }
  })

  const allShipGroups = computed(() => shipCatalog.value.groups)
  const shipTypes = computed(() => shipCatalog.value.types)

  const shipPageCount = computed(() => Math.max(
    1,
    Math.ceil(allShipGroups.value.length / NPC_TRADE_SECTORS_PER_PAGE)
  ))

  const shipGroups = computed(() => paginateNpcTradeSectorGroups(
    allShipGroups.value,
    Math.min(shipPage.value, shipPageCount.value)
  ))

  watch(allShipGroups, () => { shipPage.value = 1 })

  const pageState = computed<NpcTradePageState>(() => {
    if (!contextAvailable.value) return 'contextUnavailable'
    if (selectedPlayerStationId.value === null) return 'stationNotSelected'
    if (targets.value.length === 0) return 'waresEmpty'
    if (npcTradeSortNeedsTargets(rankMode.value, sortMetric.value, targets.value, primaryWareId.value)) {
      return 'targetMissing'
    }
    if (candidateBuckets.value.eligible.length === 0 && candidateBuckets.value.insufficientRelation.length === 0) {
      return 'noMatches'
    }
    return 'results'
  })

  const pageStateLabel = computed(() => pageState.value === 'targetMissing'
    ? i18n.global.t('npc_trade.state.targetMissing', { wares: missingTargetWareLabels.value.join(', ') })
    : i18n.global.t(`npc_trade.state.${pageState.value}`))

  const emits: NpcTradePresenterEmits = {
    autoFill: () => { if (autoFillAvailable.value) npcTradeStore.requestFill(autoFillContextKey.value, 'button') },
    setAutoFillEnabled: (enabled) => { npcTradeStore.setAutoFillEnabled(enabled) },
    undoAutoFill: () => { npcTradeStore.undoFill(autoFillContextKey.value) },
    setDirection: (value) => { direction.value = value },
    selectPlayerStationGroup: (value) => {
      if (selectedPlayerStationGroupId.value === value) return
      selectedPlayerStationGroupId.value = value
      selectedPlayerStationId.value = null
    },
    selectPlayerStation: (value) => { selectedPlayerStationId.value = value },
    setJumpLimit: (value) => { jumpLimit.value = value },
    setSearchQuery: (value) => { searchQuery.value = value },
    addWare: (wareId) => {
      npcTradeStore.addWare(wareId)
      searchQuery.value = ''
    },
    updateTargetQty: (wareId, value) => { npcTradeStore.updateTargetQty(wareId, value) },
    removeWare: (wareId) => { npcTradeStore.removeWare(wareId) },
    setRankMode: (value) => { rankMode.value = value },
    setSortMetric: (value) => { sortMetric.value = value },
    setPrimaryWare: (wareId) => { primaryWareId.value = wareId },
    setCandidatePage: (page) => {
      candidatePage.value = Math.min(Math.max(1, Math.trunc(page)), candidatePageCount.value)
    },
    setIneligibleFactionExpanded: (factionId, expanded) => {
      const next = new Set(expandedIneligibleFactionKeys.value)
      if (expanded) next.add(factionId)
      else next.delete(factionId)
      expandedIneligibleFactionKeys.value = next
    },
    setIneligibleFactionPage: (factionId, page) => {
      const group = ineligibleFactionGroups.value.find((item) => item.key === factionId)
      if (group === undefined) return
      ineligibleFactionPages.value = {
        ...ineligibleFactionPages.value,
        [factionId]: Math.min(Math.max(1, Math.trunc(page)), group.pageCount)
      }
    },
    setShipPage: (page) => {
      shipPage.value = Math.min(Math.max(1, Math.trunc(page)), shipPageCount.value)
    }
  }

  return {
    props: {
      direction,
      selectedPlayerStationGroupId,
      selectedPlayerStationId,
      jumpLimit,
      searchQuery,
      rankMode,
      sortMetric,
      primaryWareId,
      stationGroups,
      selectedStationOptions,
      searchGroups,
      wareTargets,
      candidateSections,
      candidatePage,
      candidatePageCount,
      ineligibleFactionGroups,
      shipTypes,
      shipGroups,
      shipPage,
      shipPageCount,
      pageState,
      pageStateLabel,
      autoFillEnabled,
      autoFillAvailable,
      autoFillDisabledReason,
      autoFillScope,
      autoFillStatus,
      autoFillSource,
      autoFillCanUndo,
      autoFillDetails,
      canUseComposite,
      canUseTargetMetric
    },
    emits
  }
}
