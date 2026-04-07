import { computed, type ComputedRef } from 'vue'
import { useEmpireStore } from '@/store/useEmpireStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import type {
  SaveBindingPlan,
  GroupSaveBinding,
  StationSaveBinding,
  ResolvedGroupSaveBinding,
  ResolvedStationSaveBinding,
  SectorPlan,
  StationPlan,
  CoverageSectorEntry
} from '@/types/x4'
import type { PlayerStationEntry, SaveArchive } from '@/types/saveArchive'
import {
  resolveGroupSaveBinding,
  resolveStationSaveBinding,
  getSaveSectorsWithPlayerStations,
  getCoverageSectors,
  buildSectorGraphFromMaps,
  type SectorCoverageResult,
  type FilteredSaveStationsResult,
  getFilteredSaveStations
} from '@/store/logic/saveBindingUtils'

export interface SaveSectorInfo {
  sectorMacro: string
  sectorName: string
  playerStationCount: number
  tradeStationCount: number
}

export interface CoverageSectorInfo {
  sectorMacro: string
  sectorName: string
  distance: number
}

export interface SaveStationCandidate {
  station: PlayerStationEntry
  sectorMacro: string
  sectorName: string
  distance: number
  isAlreadyBound: boolean
}

export interface EmpireStationBindingInfo {
  station: StationPlan
  binding: ResolvedStationSaveBinding | null
  isIdle: boolean
  hasPosition: boolean
}

export interface GroupBindingInfo {
  group: SectorPlan
  binding: ResolvedGroupSaveBinding | null
  coverageSectorMacros: CoverageSectorEntry[]
}

export interface MapBindingViewModel {
  activeBindingPlan: ComputedRef<SaveBindingPlan | null>
  bindingPlansForEmpire: ComputedRef<SaveBindingPlan[]>
  selectedArchiveTime: ComputedRef<number | null>
  saveSectors: ComputedRef<SaveSectorInfo[]>
  hasActiveBinding: ComputedRef<boolean>

  getCoverageSectorsForRange: (startSectorMacro: string, jumpRange: number) => SectorCoverageResult[]
  getFilteredStationsForCoverage: (coverageSectors: SectorCoverageResult[]) => FilteredSaveStationsResult
  getStationCandidates: (coverageSectors: SectorCoverageResult[]) => SaveStationCandidate[]
  getEmpireStationsForSector: (sectorGroupId: string) => EmpireStationBindingInfo[]
  getIdleEmpireStations: () => EmpireStationBindingInfo[]
  getGroupBindings: () => GroupBindingInfo[]
  isSaveStationBound: (sectorGroupId: string, saveStationCode: string) => boolean
  resolveStationBinding: (binding: StationSaveBinding) => ResolvedStationSaveBinding
  resolveGroupBinding: (binding: GroupSaveBinding) => ResolvedGroupSaveBinding
}

export function useMapBindingViewModel(): MapBindingViewModel {
  const empireStore = useEmpireStore()
  const saveStore = useSaveStore()
  const gameDataStore = useGameDataStore()

  const activeBindingPlan = computed<SaveBindingPlan | null>(() => {
    return empireStore.getActiveBinding()
  })

  const bindingPlansForEmpire = computed<SaveBindingPlan[]>(() => {
    return empireStore.activeEmpire?.saveBindings || []
  })

  const selectedArchiveTime = computed<number | null>(() => {
    return activeBindingPlan.value?.selectedArchiveTime ?? null
  })

  const hasActiveBinding = computed<boolean>(() => {
    return activeBindingPlan.value !== null
  })

  const saveSectors = computed<SaveSectorInfo[]>(() => {
    const archive = getActiveArchive()
    if (!archive) return []

    const sectorsWithStations = getSaveSectorsWithPlayerStations(archive)
    return sectorsWithStations.map((sector) => ({
      sectorMacro: sector.sectorMacro,
      sectorName: sector.sectorName,
      playerStationCount: sector.playerStationCount,
      tradeStationCount: sector.tradeStationCount
    }))
  })

  function getActiveArchive(): SaveArchive | null {
    const binding = activeBindingPlan.value
    if (!binding) return saveStore.selectedArchive

    const time = binding.selectedArchiveTime
    if (time === null) return saveStore.selectedArchive

    const guid = binding.gameGuid
    const group = saveStore.archives.get(guid)
    if (!group) return saveStore.selectedArchive

    const archive = group.saves.find((s) => s.meta.time === time)
    return archive ?? saveStore.selectedArchive
  }

  function getSectorGraphAndClusterMap(): {
    sectorGraph: Record<string, string[]>
    sectorClusterMap: Record<string, string>
  } {
    const clusters = gameDataStore.maps?.clusters || {}
    return buildSectorGraphFromMaps(clusters)
  }

  function getCoverageSectorsForRange(startSectorMacro: string, jumpRange: number): SectorCoverageResult[] {
    const { sectorGraph, sectorClusterMap } = getSectorGraphAndClusterMap()
    return getCoverageSectors(startSectorMacro, jumpRange, sectorGraph, sectorClusterMap)
  }

  function getFilteredStationsForCoverage(coverageSectors: SectorCoverageResult[]): FilteredSaveStationsResult {
    const archive = getActiveArchive()
    return getFilteredSaveStations(archive, coverageSectors)
  }

  function getStationCandidates(coverageSectors: SectorCoverageResult[]): SaveStationCandidate[] {
    const { playerStations } = getFilteredStationsForCoverage(coverageSectors)
    const bindingKey = activeBindingPlan.value?.gameGuid

    const allBoundCodes = new Set<string>()
    if (bindingKey && activeBindingPlan.value) {
      for (const group of activeBindingPlan.value.groupBindings) {
        for (const binding of group.stationBindings) {
          if (binding.saveStationCode) {
            allBoundCodes.add(binding.saveStationCode)
          }
        }
      }
    }

    return playerStations.map((item) => ({
      station: item.station,
      sectorMacro: item.sectorMacro,
      sectorName: item.sectorName,
      distance: item.distance,
      isAlreadyBound: allBoundCodes.has(item.station.code)
    }))
  }

  function getEmpireStationsForSector(sectorGroupId: string): EmpireStationBindingInfo[] {
    const empire = empireStore.activeEmpire
    if (!empire) return []

    const stations = empire.stations.filter((s) => s.sectorId === sectorGroupId)
    const bindingKey = activeBindingPlan.value?.gameGuid
    const archive = getActiveArchive()

    const groupBinding = bindingKey
      ? (activeBindingPlan.value?.groupBindings || []).find((b) => b.sectorGroupId === sectorGroupId) || null
      : null

    return stations.map((station) => {
      const rawBinding = groupBinding
        ? (groupBinding.stationBindings || []).find((b: StationSaveBinding) => b.stationId === station.id) || null
        : null

      const binding = rawBinding ? resolveStationSaveBinding(rawBinding, archive) : null
      const isIdle = !rawBinding?.saveStationCode
      const hasPosition = Boolean(rawBinding?.position)

      return { station, binding, isIdle, hasPosition }
    })
  }

  function getIdleEmpireStations(): EmpireStationBindingInfo[] {
    const empire = empireStore.activeEmpire
    if (!empire) return []

    const bindingKey = activeBindingPlan.value?.gameGuid
    if (!bindingKey) {
      return empire.stations.map((station) => ({
        station,
        binding: null,
        isIdle: true,
        hasPosition: false
      }))
    }

    const allStationBindings: StationSaveBinding[] = []
    for (const group of activeBindingPlan.value?.groupBindings || []) {
      allStationBindings.push(...group.stationBindings)
    }

    const archive = getActiveArchive()

    return empire.stations.map((station) => {
      const rawBinding = allStationBindings.find((b: StationSaveBinding) => b.stationId === station.id) || null
      const binding = rawBinding ? resolveStationSaveBinding(rawBinding, archive) : null
      const isIdle = !rawBinding?.saveStationCode
      const hasPosition = Boolean(rawBinding?.position)

      return { station, binding, isIdle, hasPosition }
    }).filter((info) => info.isIdle || info.hasPosition)
  }

  function getGroupBindings(): GroupBindingInfo[] {
    const empire = empireStore.activeEmpire
    if (!empire) return []

    const sectors = empire.sectors || []
    const bindingKey = activeBindingPlan.value?.gameGuid
    const archive = getActiveArchive()

    return sectors.map((group) => {
      const rawBinding = bindingKey
        ? (activeBindingPlan.value?.groupBindings || []).find((b) => b.sectorGroupId === group.id) || null
        : null

      const binding = rawBinding ? resolveGroupSaveBinding(rawBinding, archive) : null
      // Use stored coverage entries directly instead of recalculating
      const coverageSectorMacros = rawBinding?.coverageSectorMacros || []

      return { group, binding, coverageSectorMacros }
    })
  }

  function isSaveStationBound(sectorGroupId: string, saveStationCode: string): boolean {
    const bindingKey = activeBindingPlan.value?.gameGuid
    if (!bindingKey) return false
    return empireStore.isSaveStationAlreadyBound(bindingKey, sectorGroupId, saveStationCode)
  }

  function resolveStationBinding(binding: StationSaveBinding): ResolvedStationSaveBinding {
    const archive = getActiveArchive()
    return resolveStationSaveBinding(binding, archive)
  }

  function resolveGroupBinding(binding: GroupSaveBinding): ResolvedGroupSaveBinding {
    const archive = getActiveArchive()
    return resolveGroupSaveBinding(binding, archive)
  }

  return {
    activeBindingPlan,
    bindingPlansForEmpire,
    selectedArchiveTime,
    saveSectors,
    hasActiveBinding,
    getCoverageSectorsForRange,
    getFilteredStationsForCoverage,
    getStationCandidates,
    getEmpireStationsForSector,
    getIdleEmpireStations,
    getGroupBindings,
    isSaveStationBound,
    resolveStationBinding,
    resolveGroupBinding
  }
}