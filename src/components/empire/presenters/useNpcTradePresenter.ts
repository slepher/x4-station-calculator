import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import i18n from '@/i18n'
import { useActiveViewStore } from '@/store/useActiveViewStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { createOverlayItem, useSaveStore } from '@/store/useSaveStore'
import { generateFilteredWaresGrouped } from '@/store/logic/searchWare'
import { isSectorMacroInBindingScope } from '@/store/logic/saveBindingSectorScope'
import { breadthFirstReachable, buildSectorGraph } from '@/store/logic/mapSectorGraph'
import {
  buildNpcTradeCandidates,
  calculateContainerWareMaxLoad,
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
  items: Array<{ id: string; label: string }>
}

export interface NpcTradeWareTargetView extends WareTarget {
  label: string
}

export interface NpcTradeOfferView {
  tradeId: string
  source: NpcTradeDemandSource
  sourceLabel: string
  price: number
  amount: number
  desired?: number
}

export interface NpcTradeStationCard {
  key: string
  sectorMacro: string
  sectorLabel: string
  stationName: string
  code: string
  factionLabel: string
  relativeLabel: string
  wareOffers: Array<{
    wareId: string
    wareLabel: string
    offers: NpcTradeOfferView[]
  }>
}

export interface NpcTradeCandidateSection {
  key: string
  sectorLabel: string | null
  stations: NpcTradeStationCard[]
}

export interface NpcTradeShipGroup {
  sectorMacro: string
  sectorLabel: string
  bindingGroupNames: string[]
  ships: Array<{
    componentId: string
    shipName: string
    shipType: string
    size: 'L' | 'M'
    customName: string | null
    capacity: number
    loadLimits: Array<{ wareId: string; wareLabel: string; maxAmount: number }>
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
  groupBySector: Ref<boolean>
  stationGroups: ComputedRef<NpcTradeStationOptionGroup[]>
  selectedStationOptions: ComputedRef<NpcTradeStationOption[]>
  searchGroups: ComputedRef<NpcTradeWareSearchGroup[]>
  wareTargets: ComputedRef<NpcTradeWareTargetView[]>
  candidateSections: ComputedRef<NpcTradeCandidateSection[]>
  shipGroups: ComputedRef<NpcTradeShipGroup[]>
  pageState: ComputedRef<NpcTradePageState>
  pageStateLabel: ComputedRef<string>
  canUseComposite: ComputedRef<boolean>
  canUseTargetMetric: ComputedRef<boolean>
}

export interface NpcTradePresenterEmits {
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
  setGroupBySector: (enabled: boolean) => void
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
  const saveStore = useSaveStore()
  const gameDataStore = useGameDataStore()
  const { activeBinding } = storeToRefs(bindingStore)
  const { orderedStationsBySector, playerStationRecords } = storeToRefs(liveProductionStore)
  const { selectedArchive, selectedArchivePlayerShips, archives } = storeToRefs(saveStore)
  const { translateFaction, translateSector, translateShipType } = useX4I18n()

  const direction = ref<PlayerTradeDirection>('sell')
  const selectedPlayerStationGroupId = ref<string | null>(null)
  const selectedPlayerStationId = ref<string | null>(null)
  const jumpLimit = ref(5)
  const searchQuery = ref('')
  const targets = ref<WareTarget[]>([])
  const primaryWareId = ref<string | null>(null)
  const rankMode = ref<NpcTradeRankMode>('primary')
  const sortMetric = ref<NpcTradeSortMetric>('quantity')
  const groupBySector = ref(false)

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
    const binding = activeBinding.value
    if (binding === null) return []
    const groups = [...binding.groups].sort((a, b) => a.order - b.order)
    return groups.map((group, groupIndex) => {
      const groupId = group.sectorMacro
      const options: NpcTradeStationOption[] = []
      const includedSaveStationCodes = new Set<string>()
      const stations = orderedStationsBySector.value.filter((station) => station.sectorId === groupId)
      for (const station of stations) {
        const plan = binding.stationPlans.find((item) => item.id === station.id)
        if (plan !== undefined) {
          const sectorMacro = resolveEntrySector(plan, group)
          const disabledReason = sectorMacro === null ? i18n.global.t('npc_trade.station_sector_missing') : null
          if (plan.saveStationCode !== undefined) includedSaveStationCodes.add(plan.saveStationCode)
          options.push({
            id: `station:${plan.id}`,
            label: stationOptionLabel(station.name, sectorMacro),
            disabled: sectorMacro === null,
            disabledReason,
            sectorMacro,
            position: resolveEntryPosition(plan, sectorMacro)
          })
          continue
        }

        const record = playerStationRecords.value.find((item) =>
          item.type === 'station' && item.code === station.id
        )
        if (record === undefined) continue
        includedSaveStationCodes.add(record.code)
        options.push({
          id: `archive:${record.code}`,
          label: stationOptionLabel(station.name, record.sectorMacro),
          disabled: false,
          disabledReason: null,
          sectorMacro: record.sectorMacro,
          position: resolveArchiveStationPosition(record.sectorMacro, record.code)
        })
      }
      const tradeStation = group.tradeStation
      if (tradeStation !== undefined && (
        tradeStation.saveStationCode === undefined || !includedSaveStationCodes.has(tradeStation.saveStationCode)
      )) {
        const sectorMacro = resolveEntrySector(tradeStation, group)
        const disabledReason = sectorMacro === null ? i18n.global.t('npc_trade.station_sector_missing') : null
        options.push({
          id: `trade:${groupIndex}:${tradeStation.id}`,
          label: stationOptionLabel(tradeStation.name, sectorMacro),
          disabled: sectorMacro === null,
          disabledReason,
          sectorMacro,
          position: resolveEntryPosition(tradeStation, sectorMacro)
        })
      }
      return {
        id: groupId === undefined ? `group:${groupIndex}` : groupId,
        label: group.name,
        options
      }
    })
  })

  const selectedStationOptions = computed(() => {
    const group = stationGroups.value.find((item) => item.id === selectedPlayerStationGroupId.value)
    return group === undefined ? [] : group.options
  })

  const selectedPlayerStation = computed(() => selectedStationOptions.value
    .find((option) => option.id === selectedPlayerStationId.value && !option.disabled) ?? null)

  watch(stationGroups, () => {
    const groupExists = stationGroups.value.some((group) => group.id === selectedPlayerStationGroupId.value)
    if (!groupExists) {
      selectedPlayerStationGroupId.value = null
      selectedPlayerStationId.value = null
      return
    }
    if (selectedPlayerStationId.value !== null && selectedPlayerStation.value === null) {
      selectedPlayerStationId.value = null
    }
  }, { immediate: true })

  const searchGroups = computed<NpcTradeWareSearchGroup[]>(() => {
    if (searchQuery.value.trim().length === 0) return []
    const selectedIds = new Set(targets.value.map((target) => target.wareId))
    return generateFilteredWaresGrouped(
      searchQuery.value,
      gameDataStore.currentLocale,
      gameDataStore.localizedWaresMap,
      gameDataStore.localizedModuleGroupsMap,
      (ware) => !selectedIds.has(ware.id)
    ).map((group) => ({
      id: group.group,
      label: group.displayLabel,
      items: group.wares.map((ware) => ({ id: ware.id, label: ware.displayLabel }))
    }))
  })

  const wareTargets = computed<NpcTradeWareTargetView[]>(() => targets.value.map((target) => {
    const ware = gameDataStore.localizedWaresMap[target.wareId]
    return {
      ...target,
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

  const sortedCandidates = computed(() => {
    const archive = bindingArchive.value
    if (!contextAvailable.value || archive === null || targets.value.length === 0) return []
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
    return candidates.filter((candidate) => passesJumpFilter(candidate.sectorMacro)).sort(comparator)
  })

  const sourceLabel = (source: NpcTradeDemandSource): string => i18n.global.t(`npc_trade.source.${source}`)

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

  const toStationCard = (candidate: ReturnType<typeof buildNpcTradeCandidates>[number]): NpcTradeStationCard => {
    const faction = gameDataStore.factions.find((item) => item.id === candidate.owner)
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
      sectorMacro: candidate.sectorMacro,
      sectorLabel: sectorLabel(candidate.sectorMacro),
      stationName,
      code: candidate.code,
      factionLabel: faction === undefined ? i18n.global.t('npc_trade.unknown') : translateFaction(faction),
      relativeLabel: relativeLabel(candidate.sectorMacro, candidate.station.position),
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
            amount: offer.amount,
            desired: offer.desired
          }))
        }]
      })
    }
  }

  const candidateSections = computed<NpcTradeCandidateSection[]>(() => {
    const candidates = sortedCandidates.value
    if (!groupBySector.value) {
      return candidates.length === 0
        ? []
        : [{ key: 'all', sectorLabel: null, stations: candidates.map(toStationCard) }]
    }
    const comparator = createNpcTradeStationComparator({
      direction: direction.value,
      rankMode: rankMode.value,
      metric: sortMetric.value,
      targets: targets.value,
      primaryWareId: primaryWareId.value
    })
    return groupNpcTradeStations(candidates, comparator).map((group) => ({
      key: group.sectorMacro,
      sectorLabel: sectorLabel(group.sectorMacro),
      stations: group.stations.map(toStationCard)
    }))
  })

  const shipGroups = computed<NpcTradeShipGroup[]>(() => {
    const binding = activeBinding.value
    if (!contextAvailable.value || binding === null) return []
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
      const customName = ship.name?.trim()
      const current = grouped.get(ship.sectorMacro)
      const item = {
        componentId: ship.componentId,
        shipName: localizedShip.localeName,
        shipType: translateShipType(shipType),
        size: staticShip.class === 'ship_l' ? 'L' as const : 'M' as const,
        customName: customName === undefined || customName.length === 0 || /^\{\d+,\d+\}$/.test(customName)
          ? null
          : customName,
        capacity: containerCargo.capacity,
        loadLimits: wareTargets.value.map((target) => {
          const ware = gameDataStore.localizedWaresMap[target.wareId]
          const maxAmount = ware === undefined ? 0 : calculateContainerWareMaxLoad(containerCargo.capacity, ware)
          return {
            wareId: target.wareId,
            wareLabel: target.label,
            maxAmount
          }
        }),
        relativeLabel: relativeLabel(ship.sectorMacro, ship.position),
        availability: ship.availability,
        availabilityLabel: i18n.global.t(`npc_trade.ship.${ship.availability}`)
      }
      if (current === undefined) grouped.set(ship.sectorMacro, [item])
      else current.push(item)
    }
    return Array.from(grouped, ([sectorMacro, ships]) => ({
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
  })

  const pageState = computed<NpcTradePageState>(() => {
    if (!contextAvailable.value) return 'contextUnavailable'
    if (selectedPlayerStationId.value === null) return 'stationNotSelected'
    if (targets.value.length === 0) return 'waresEmpty'
    if (npcTradeSortNeedsTargets(rankMode.value, sortMetric.value, targets.value, primaryWareId.value)) {
      return 'targetMissing'
    }
    if (sortedCandidates.value.length === 0) return 'noMatches'
    return 'results'
  })

  const pageStateLabel = computed(() => pageState.value === 'targetMissing'
    ? i18n.global.t('npc_trade.state.targetMissing', { wares: missingTargetWareLabels.value.join(', ') })
    : i18n.global.t(`npc_trade.state.${pageState.value}`))

  const emits: NpcTradePresenterEmits = {
    setDirection: (value) => { direction.value = value },
    selectPlayerStationGroup: (value) => {
      selectedPlayerStationGroupId.value = value
      selectedPlayerStationId.value = null
    },
    selectPlayerStation: (value) => { selectedPlayerStationId.value = value },
    setJumpLimit: (value) => { jumpLimit.value = value },
    setSearchQuery: (value) => { searchQuery.value = value },
    addWare: (wareId) => {
      if (targets.value.some((target) => target.wareId === wareId)) return
      targets.value.push({ wareId, targetQty: null })
      if (primaryWareId.value === null) primaryWareId.value = wareId
      searchQuery.value = ''
    },
    updateTargetQty: (wareId, value) => {
      const target = targets.value.find((item) => item.wareId === wareId)
      if (target !== undefined) target.targetQty = value
    },
    removeWare: (wareId) => {
      targets.value = targets.value.filter((target) => target.wareId !== wareId)
      if (primaryWareId.value === wareId) {
        primaryWareId.value = targets.value.length === 0 ? null : targets.value[0]!.wareId
      }
    },
    setRankMode: (value) => { rankMode.value = value },
    setSortMetric: (value) => { sortMetric.value = value },
    setPrimaryWare: (wareId) => { primaryWareId.value = wareId },
    setGroupBySector: (value) => { groupBySector.value = value }
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
      groupBySector,
      stationGroups,
      selectedStationOptions,
      searchGroups,
      wareTargets,
      candidateSections,
      shipGroups,
      pageState,
      pageStateLabel,
      canUseComposite,
      canUseTargetMetric
    },
    emits
  }
}
