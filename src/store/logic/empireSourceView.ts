import { computed, type Ref, type ComputedRef } from 'vue'
import type { EmpirePlan, SectorPlan, StationPlan, SaveBindingPlan, X4MapSector } from '@/types/x4'
import type { BindingSectorGroup } from '@/types/x4'
import type { PlayerStationRecord } from '@/types/saveArchive'
import {
  deriveBindingStationsFromRecords,
  parseBindingStationId,
  createBindingPlanStationId,
  type ProductionSourceKind,
  type DerivedBindingStation,
  type ParsedBindingStationId
} from './productionSourceAdapter'
import { normalizeSectorLinkKey } from './sectorLinks'

export interface EmpireSourceViewDeps {
  productionSource: Ref<ProductionSourceKind>
  activeEmpire: Ref<EmpirePlan | null>
  activeBinding: Ref<SaveBindingPlan | null>
  playerStationRecords: Ref<PlayerStationRecord[]>
  sectorsMap?: Ref<Record<string, X4MapSector>>
}

export interface EmpireSourceView {
  sectors: ComputedRef<SectorPlan[]>
  sectorLinks: ComputedRef<string[]>
  orderedStationsBySector: ComputedRef<StationPlan[]>
  productionStations: ComputedRef<StationPlan[]>
  productionSectors: ComputedRef<SectorPlan[]>
  productionSectorLinks: ComputedRef<string[]>
  derivedBindingStations: ComputedRef<DerivedBindingStation[]>
  getStationById: (stationId: string) => StationPlan | null
  getDerivedBindingStation: (stationId: string) => StationPlan | null
  findBindingStationIndex: (stationId: string) => number
}

const TRANSIT_TAB_PREFIX = 'transit:'

function buildBindingSectorLinks(groups: BindingSectorGroup[]): string[] {
  const validGroupIds = new Set(groups.map((group) => group.id))
  const links = new Set<string>()
  groups.forEach((group) => {
    ;(group.connectedGroupIds || []).forEach((targetId) => {
      if (!validGroupIds.has(targetId)) return
      const key = normalizeSectorLinkKey(group.id, targetId)
      if (key) links.add(key)
    })
  })
  return Array.from(links)
}

export function createEmpireSourceView(deps: EmpireSourceViewDeps): EmpireSourceView {
  const {
    productionSource,
    activeEmpire,
    activeBinding,
    playerStationRecords,
    sectorsMap
  } = deps

  const derivedBindingStations = computed<DerivedBindingStation[]>(() => {
    if (productionSource.value !== 'save-binding') return []
    return deriveBindingStationsFromRecords(activeBinding.value, playerStationRecords.value, sectorsMap?.value)
  })

  const sectors = computed<SectorPlan[]>(() => {
    if (productionSource.value === 'save-binding') {
      const binding = activeBinding.value
      if (!binding) return []
      return binding.groups.map((group, index) => ({
        id: group.id,
        name: group.name,
        order: index
      }))
    }
    if (!activeEmpire.value) return []
    const list = activeEmpire.value.sectors || []
    return [...list].sort((a, b) => a.order - b.order)
  })

  const sectorLinks = computed<string[]>(() => {
    if (productionSource.value === 'save-binding') {
      return buildBindingSectorLinks(activeBinding.value?.groups || [])
    }
    return activeEmpire.value?.sectorLinks || []
  })

  const orderedStationsBySector = computed<StationPlan[]>(() => {
    if (productionSource.value === 'save-binding') {
      const derived = derivedBindingStations.value
      const sectorOrderMap = new Map<string, number>(sectors.value.map((sector, idx) => [sector.id, idx]))
      const withIndex = derived.map((item, index) => ({ station: item.station, index, groupId: item.groupId }))
      withIndex.sort((a, b) => {
        const aOrder = a.groupId ? (sectorOrderMap.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        const bOrder = b.groupId ? (sectorOrderMap.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.index - b.index
      })
      return withIndex.map((item) => item.station)
    }
    if (!activeEmpire.value) return []
    const stations = activeEmpire.value.stations || []
    const sectorOrderMap = new Map<string, number>(sectors.value.map((sector, idx) => [sector.id, idx]))
    const withIndex = stations.map((station, index) => ({ station, index }))
    withIndex.sort((a, b) => {
      const aOrder = a.station.sectorId ? (sectorOrderMap.get(a.station.sectorId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      const bOrder = b.station.sectorId ? (sectorOrderMap.get(b.station.sectorId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.index - b.index
    })
    return withIndex.map((item) => item.station)
  })

  const productionStations = computed<StationPlan[]>(() => orderedStationsBySector.value)
  const productionSectors = computed<SectorPlan[]>(() => sectors.value)
  const productionSectorLinks = computed<string[]>(() => sectorLinks.value)

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    if (productionSource.value !== 'save-binding') return null
    const derived = derivedBindingStations.value
    return derived.find((item) => item.station.id === stationId)?.station || null
  }

  function getStationById(stationId: string): StationPlan | null {
    if (productionSource.value === 'save-binding') {
      return getDerivedBindingStation(stationId)
    }
    if (activeEmpire.value) {
      const station = activeEmpire.value.stations.find(s => s.id === stationId)
      if (station) return station
    }
    return null
  }

  function findBindingStationIndex(stationId: string): number {
    if (productionSource.value !== 'save-binding') return -1
    return derivedBindingStations.value.findIndex((item) => item.station.id === stationId)
  }

  return {
    sectors,
    sectorLinks,
    orderedStationsBySector,
    productionStations,
    productionSectors,
    productionSectorLinks,
    derivedBindingStations,
    getStationById,
    getDerivedBindingStation,
    findBindingStationIndex
  }
}

export function computeActiveStation(
  productionSource: ProductionSourceKind,
  derivedStations: DerivedBindingStation[],
  activeEmpire: EmpirePlan | null,
  activeStationId: string | null
): StationPlan | null {
  if (productionSource === 'save-binding') {
    return derivedStations.find(item => item.station.id === activeStationId)?.station || null
  }
  if (!activeEmpire || !activeStationId) return null
  return activeEmpire.stations.find(s => s.id === activeStationId) || null
}

export function computeActiveTransitSectorId(
  activeStationId: string | null,
  sectors: SectorPlan[]
): string | null {
  const sectorId = fromTransitTabId(activeStationId)
  if (!sectorId) return null
  const exists = sectors.some((sector) => sector.id === sectorId)
  return exists ? sectorId : null
}

export function toTransitTabId(sectorId: string): string {
  return `${TRANSIT_TAB_PREFIX}${sectorId}`
}

export function fromTransitTabId(tabId: string | null | undefined): string | null {
  if (!tabId || !tabId.startsWith(TRANSIT_TAB_PREFIX)) return null
  const sectorId = tabId.slice(TRANSIT_TAB_PREFIX.length)
  return sectorId || null
}

export {
  parseBindingStationId,
  createBindingPlanStationId,
  type ParsedBindingStationId,
  type DerivedBindingStation
}