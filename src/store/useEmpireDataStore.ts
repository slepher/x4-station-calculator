import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { EntityLocation, SavedEmpiresState, EmpirePlan, SavedModule, SectorPlan, StationPlan, StationSettings, StationType } from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { CURRENT_EMPIRE_VERSION } from './logic/storageVersions'
import { DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import { getLinkedSectorIdsFor, normalizeSectorLinkKey } from './logic/sectorLinks'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function createDefaultEmpire(name: string = ''): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    sectors: [],
    sectorLinks: [],
    stations: []
  }
}

function createDefaultStation(name: string, type: StationType = 'industrial'): StationPlan {
  return {
    id: crypto.randomUUID(),
    name,
    type,
    count: 1,
    modules: [],
    settings: { ...DEFAULT_STATION_SETTINGS },
    lastUpdated: Date.now(),
    lockedWares: [],
    warePriority: {},
    location: undefined
  }
}

export const useEmpireDataStore = defineStore('empireData', () => {
  const gameData = useGameDataStore()

  function getStorageKey(): string {
    return gameData.getStorageKey('empire')
  }

  const savedEmpires = ref<SavedEmpiresState>({
    version: CURRENT_EMPIRE_VERSION,
    activeId: null,
    list: []
  })

  const version = computed(() => savedEmpires.value.version)
  const empires = computed(() => savedEmpires.value.list)
  const activeId = computed({
    get: () => savedEmpires.value.activeId,
    set: (id: string | null) => { savedEmpires.value.activeId = id }
  })

  function saveToStorage(): void {
    localStorage.setItem(getStorageKey(), JSON.stringify(savedEmpires.value))
  }

  function loadFromStorage(): SavedEmpiresState | null {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return null
    try {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.list)) {
        return data as SavedEmpiresState
      }
      return null
    } catch {
      return null
    }
  }

  function setData(data: SavedEmpiresState): void {
    savedEmpires.value = data
  }

  function getData(): SavedEmpiresState {
    return JSON.parse(JSON.stringify(savedEmpires.value))
  }

  function createEmpire(name: string = ''): EmpirePlan {
    const empire = createDefaultEmpire(name)
    savedEmpires.value.list.push(empire)
    return empire
  }

  function deleteEmpire(id: string): boolean {
    const idx = savedEmpires.value.list.findIndex(e => e.id === id)
    if (idx === -1) return false
    savedEmpires.value.list.splice(idx, 1)
    if (savedEmpires.value.activeId === id) {
      savedEmpires.value.activeId = savedEmpires.value.list[0]?.id || null
    }
    return true
  }

  function duplicateEmpire(id: string): EmpirePlan | null {
    const source = savedEmpires.value.list.find(e => e.id === id)
    if (!source) return null
    const copy: EmpirePlan = {
      ...JSON.parse(JSON.stringify(source)),
      id: crypto.randomUUID(),
      name: `${source.name} (Copy)`
    }
    copy.stations.forEach(s => { s.id = crypto.randomUUID() })
    savedEmpires.value.list.push(copy)
    return copy
  }

  function getEmpireById(id: string): EmpirePlan | null {
    return savedEmpires.value.list.find(e => e.id === id) || null
  }

  function updateEmpire(empire: EmpirePlan): void {
    const idx = savedEmpires.value.list.findIndex(e => e.id === empire.id)
    if (idx !== -1) {
      savedEmpires.value.list[idx] = JSON.parse(JSON.stringify(empire))
    } else {
      savedEmpires.value.list.push(JSON.parse(JSON.stringify(empire)))
    }
  }

  function setActiveEmpire(id: string | null): void {
    savedEmpires.value.activeId = id
  }

  function createStationInEmpire(empire: EmpirePlan | null, name: string, type: StationType = 'industrial'): StationPlan | null {
    if (!empire) return null
    const station = createDefaultStation(name, type)
    station.sectorId = null
    empire.stations.push(station)
    return station
  }

  function deleteStationFromEmpire(empire: EmpirePlan | null, stationId: string): boolean {
    if (!empire) return false
    const index = empire.stations.findIndex((station) => station.id === stationId)
    if (index === -1) return false
    empire.stations.splice(index, 1)
    return true
  }

  function duplicateStationInEmpire(empire: EmpirePlan | null, stationId: string): StationPlan | null {
    if (!empire) return null
    const sourceStation = empire.stations.find((station) => station.id === stationId)
    if (!sourceStation) return null
    const newStation: StationPlan = {
      ...deepClone(sourceStation),
      id: crypto.randomUUID(),
      name: `${sourceStation.name} (Copy)`,
      sectorId: sourceStation.sectorId || null,
      lastUpdated: Date.now()
    }
    empire.stations.push(newStation)
    return newStation
  }

  function reorderStationsInEmpire(empire: EmpirePlan | null, reorderedStations: StationPlan[]): boolean {
    if (!empire) return false
    const currentStations = empire.stations
    if (reorderedStations.length !== currentStations.length) return false
    const reorderedIdSet = new Set(reorderedStations.map((station) => station.id))
    if (reorderedIdSet.size !== currentStations.length) return false
    if (currentStations.some((station) => !reorderedIdSet.has(station.id))) return false
    empire.stations = [...reorderedStations]
    return true
  }

  function renameStationInEmpire(empire: EmpirePlan | null, stationId: string, name: string): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.name = name
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationSettingsInEmpire(empire: EmpirePlan | null, stationId: string, settings: Partial<StationSettings>): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.settings = { ...station.settings, ...settings }
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationModulesInEmpire(empire: EmpirePlan | null, stationId: string, modules: SavedModule[]): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.modules = modules
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationSectorInEmpire(empire: EmpirePlan | null, stationId: string, sectorId: string | null): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.sectorId = sectorId || undefined
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationTypeInEmpire(empire: EmpirePlan | null, stationId: string, type: StationType): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.type = type
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationCountInEmpire(empire: EmpirePlan | null, stationId: string, count: number): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.count = count
    station.lastUpdated = Date.now()
    return true
  }

  function updateStationMineralsInEmpire(empire: EmpirePlan | null, stationId: string, minerals: string[]): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.minerals = minerals
    station.lastUpdated = Date.now()
    return true
  }

  function renameEmpireDraft(empire: EmpirePlan | null, name: string): boolean {
    if (!empire) return false
    empire.name = name
    return true
  }

  function moveStationToSectorInEmpire(empire: EmpirePlan | null, stationId: string, sectorId: string | null): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    if (sectorId) {
      const exists = (empire.sectors || []).some((sector) => sector.id === sectorId)
      if (!exists) return false
    }
    station.sectorId = sectorId
    return true
  }

  function setStationLocationInEmpire(empire: EmpirePlan | null, stationId: string, location: EntityLocation | null): boolean {
    if (!empire) return false
    const station = empire.stations.find((item) => item.id === stationId)
    if (!station) return false
    station.location = location ? deepClone(location) : undefined
    station.lastUpdated = Date.now()
    return true
  }

  function createSectorInEmpire(empire: EmpirePlan | null, name: string = ''): SectorPlan | null {
    if (!empire) return null
    const nextOrder = (empire.sectors || []).length
    const sector: SectorPlan = {
      id: crypto.randomUUID(),
      name: name || `Sector ${nextOrder + 1}`,
      order: nextOrder
    }
    if (!empire.sectors) empire.sectors = []
    empire.sectors.push(sector)
    if (!Array.isArray(empire.sectorLinks)) empire.sectorLinks = []
    return sector
  }

  function renameSectorInEmpire(empire: EmpirePlan | null, sectorId: string, name: string): boolean {
    if (!empire) return false
    const sector = (empire.sectors || []).find((item) => item.id === sectorId)
    if (!sector) return false
    sector.name = name
    return true
  }

  function reorderSectorsInEmpire(empire: EmpirePlan | null, orderedSectorIds: string[]): boolean {
    if (!empire) return false
    const current = empire.sectors || []
    if (orderedSectorIds.length !== current.length) return false
    const set = new Set(orderedSectorIds)
    if (set.size !== current.length) return false
    if (current.some((sector) => !set.has(sector.id))) return false
    const sectorMap = new Map(current.map((sector) => [sector.id, sector]))
    empire.sectors = orderedSectorIds.map((id, index) => ({
      ...(sectorMap.get(id) as SectorPlan),
      order: index
    }))
    return true
  }

  function setSectorLocationInEmpire(empire: EmpirePlan | null, sectorId: string, location: EntityLocation | null): boolean {
    if (!empire) return false
    const sector = (empire.sectors || []).find((item) => item.id === sectorId)
    if (!sector) return false
    sector.location = location ? deepClone(location) : undefined
    return true
  }

  function setSectorStationOrderInEmpire(empire: EmpirePlan | null, sectorId: string | null, orderedStationIds: string[]): boolean {
    if (!empire) return false
    const matchSector = (station: StationPlan) => (station.sectorId || null) === sectorId
    const bucket = empire.stations.filter(matchSector)
    if (bucket.length !== orderedStationIds.length) return false
    const idSet = new Set(orderedStationIds)
    if (idSet.size !== bucket.length) return false
    if (bucket.some((station) => !idSet.has(station.id))) return false

    const stationMap = new Map(bucket.map((station) => [station.id, station]))
    const orderedBucket = orderedStationIds.map((id) => stationMap.get(id)!).filter(Boolean)
    const nextStations: StationPlan[] = []
    let bucketIndex = 0
    for (const station of empire.stations) {
      if (matchSector(station)) {
        const next = orderedBucket[bucketIndex++]
        if (next) nextStations.push(next)
      } else {
        nextStations.push(station)
      }
    }
    empire.stations = nextStations
    return true
  }

  function deleteSectorFromEmpire(empire: EmpirePlan | null, sectorId: string): boolean {
    if (!empire) return false
    const sectorList = empire.sectors || []
    const idx = sectorList.findIndex((item) => item.id === sectorId)
    if (idx === -1) return false
    sectorList.splice(idx, 1)
    sectorList.forEach((sector, order) => {
      sector.order = order
    })
    empire.stations.forEach((station) => {
      if (station.sectorId === sectorId) station.sectorId = null
    })
    empire.sectorLinks = (empire.sectorLinks || []).filter((key) => {
      const linkedIds = getLinkedSectorIdsFor(sectorId, [key])
      return linkedIds.length === 0
    })
    ;((empire as any).saveBindings || []).forEach((plan: any) => {
      if (!Array.isArray(plan.groupBindings)) return
      plan.groupBindings = plan.groupBindings.filter((binding: any) => binding.sectorGroupId !== sectorId)
      plan.groupBindings.forEach((binding: any) => {
        if (Array.isArray(binding.connectedSectorGroupIds)) {
          binding.connectedSectorGroupIds = binding.connectedSectorGroupIds.filter((id: string) => id !== sectorId)
        }
      })
    })
    return true
  }

  function createSectorLinkInEmpire(empire: EmpirePlan | null, sourceSectorId: string, targetSectorId: string) {
    if (!empire) return { ok: false as const, reason: 'no-active-empire' as const }
    const sourceExists = (empire.sectors || []).some((sector) => sector.id === sourceSectorId)
    const targetExists = (empire.sectors || []).some((sector) => sector.id === targetSectorId)
    if (!sourceExists || !targetExists) return { ok: false as const, reason: 'invalid-target' as const }

    const key = normalizeSectorLinkKey(sourceSectorId, targetSectorId)
    if (!key) return { ok: false as const, reason: 'self-link' as const }

    if (!Array.isArray(empire.sectorLinks)) empire.sectorLinks = []
    if (empire.sectorLinks.includes(key)) {
      return { ok: false as const, reason: 'duplicate-link' as const }
    }

    empire.sectorLinks.push(key)
    return { ok: true as const }
  }

  function removeSectorLinkInEmpire(empire: EmpirePlan | null, a: string, b: string): boolean {
    if (!empire || !Array.isArray(empire.sectorLinks)) return false
    const key = normalizeSectorLinkKey(a, b)
    if (!key) return false
    const prev = empire.sectorLinks.length
    empire.sectorLinks = empire.sectorLinks.filter((item) => item !== key)
    return empire.sectorLinks.length !== prev
  }

  return {
    savedEmpires,
    version,
    empires,
    activeId,
    getStorageKey,
    saveToStorage,
    loadFromStorage,
    setData,
    getData,
    createEmpire,
    deleteEmpire,
    duplicateEmpire,
    getEmpireById,
    updateEmpire,
    setActiveEmpire,
    createStationInEmpire,
    deleteStationFromEmpire,
    duplicateStationInEmpire,
    reorderStationsInEmpire,
    renameStationInEmpire,
    updateStationSettingsInEmpire,
    updateStationModulesInEmpire,
    updateStationSectorInEmpire,
    updateStationTypeInEmpire,
    updateStationCountInEmpire,
    updateStationMineralsInEmpire,
    renameEmpireDraft,
    moveStationToSectorInEmpire,
    setStationLocationInEmpire,
    createSectorInEmpire,
    renameSectorInEmpire,
    reorderSectorsInEmpire,
    setSectorLocationInEmpire,
    setSectorStationOrderInEmpire,
    deleteSectorFromEmpire,
    createSectorLinkInEmpire,
    removeSectorLinkInEmpire
  }
})
