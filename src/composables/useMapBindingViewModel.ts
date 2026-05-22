import { computed, type ComputedRef } from 'vue'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import { useSaveStore } from '@/store/useSaveStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import type {
  SaveBindingPlan,
  GroupSaveBinding,
  StationSaveBinding,
  ResolvedGroupSaveBinding,
  ResolvedStationSaveBinding,
  BindingSectorGroup,
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
  group: BindingSectorGroup
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
  const blueprintStore = useBlueprintProductionStore()
  const saveStore = useSaveStore()
  const gameDataStore = useGameDataStore()
  const saveBindingStore = useSaveBindingStore()

  const activeBindingPlan = computed<SaveBindingPlan | null>(() => {
    return saveBindingStore.activeBinding
  })

  const bindingPlansForEmpire = computed<SaveBindingPlan[]>(() => {
    return saveBindingStore.bindings
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
    const sectors = gameDataStore.maps?.sectors || {}
    return buildSectorGraphFromMaps(clusters, sectors)
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
      for (const plan of activeBindingPlan.value.stationPlans) {
        if (plan.saveStationCode) allBoundCodes.add(plan.saveStationCode)
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
    const empire = blueprintStore.activeEmpire
    if (!empire) return []

    const stations = empire.stations
    const bindingKey = activeBindingPlan.value?.gameGuid
    const archive = getActiveArchive()

    void bindingKey
    void sectorGroupId

    return stations.map((station) => {
      void archive
      const binding = null
      const isIdle = true
      const hasPosition = false

      return { station, binding, isIdle, hasPosition }
    })
  }

  function getIdleEmpireStations(): EmpireStationBindingInfo[] {
    const empire = blueprintStore.activeEmpire
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

    return empire.stations.map((station) => {
      return { station, binding: null, isIdle: true, hasPosition: false }
    })
  }

  function getGroupBindings(): GroupBindingInfo[] {
    const empire = blueprintStore.activeEmpire
    if (!empire) return []

    const sectors = activeBindingPlan.value?.groups || []
    const bindingKey = activeBindingPlan.value?.gameGuid
    const archive = getActiveArchive()

    return sectors.map((group) => {
      const rawBinding = bindingKey
        ? {
            sectorGroupId: group.id,
            sectorMacro: group.sectorMacro,
            jumpRange: group.jumpRange,
            coverageSectorMacros: group.coverageSectorMacros,
            connectedSectorGroupIds: group.connectedGroupIds,
            tradestationBinding: group.tradeStation
              ? {
                  stationId: group.tradeStation.id,
                  saveStationCode: group.tradeStation.saveStationCode,
                  sectorMacro: group.tradeStation.sectorMacro,
                  position: group.tradeStation.position
                }
              : undefined,
            stationBindings: [] as StationSaveBinding[]
          }
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
    void sectorGroupId
    return Boolean(activeBindingPlan.value?.stationPlans.some(
      (plan) => plan.saveStationCode === saveStationCode
    ))
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
