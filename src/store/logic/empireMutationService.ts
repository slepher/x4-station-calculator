import type { Ref } from 'vue'
import type {
  EmpirePlan,
  SectorPlan,
  StationPlan,
  StationType,
  StationSettings,
  SavedModule,
  EntityLocation
} from '@/types/x4'
import { stationStateMap, DEFAULT_STATION_SETTINGS, migrateStationSettings } from '@/store/state/StationStateMap'
import { createBindingPlanStationId, parseBindingStationId } from './productionSourceAdapter'

export interface EmpireMutationHandlers {
  onStationCreated: (stationId: string) => void
  onStationDeleted: (stationId: string) => void
  onStationUpdated: (stationId: string) => void
  onActiveStationChange: (stationId: string | null) => void
  onActiveTransitSectorChange: (sectorId: string | null) => void
  getDerivedBindingStation: (stationId: string) => StationPlan | null
  getStationById: (stationId: string) => StationPlan | null
}

export interface EmpireMutationDeps {
  productionSource: Ref<'empire' | 'save-binding'>
  activeEmpire: Ref<EmpirePlan | null>
  activeStationId: Ref<string | null>
  activeStation: Ref<StationPlan | null>
  sectors: Ref<SectorPlan[]>
  activeTransitSectorId: Ref<string | null>
  handlers: EmpireMutationHandlers
  empireDataStore: {
    createStationInEmpire: (empire: EmpirePlan | null, name: string, type: StationType) => StationPlan | null
    deleteStationFromEmpire: (empire: EmpirePlan | null, stationId: string) => boolean
    duplicateStationInEmpire: (empire: EmpirePlan | null, stationId: string) => StationPlan | null
    reorderStationsInEmpire: (empire: EmpirePlan | null, reorderedStations: StationPlan[]) => void
    renameStationInEmpire: (empire: EmpirePlan | null, stationId: string, newName: string) => boolean
    updateStationSettingsInEmpire: (empire: EmpirePlan | null, stationId: string, settings: Partial<StationSettings>) => boolean
    updateStationModulesInEmpire: (empire: EmpirePlan | null, stationId: string, modules: SavedModule[]) => boolean
    updateStationSectorInEmpire: (empire: EmpirePlan | null, stationId: string, sectorId: string | null) => boolean
    createSectorInEmpire: (empire: EmpirePlan | null, name: string) => SectorPlan | null
    renameSectorInEmpire: (empire: EmpirePlan | null, sectorId: string, name: string) => boolean
    reorderSectorsInEmpire: (empire: EmpirePlan | null, orderedSectorIds: string[]) => void
    deleteSectorFromEmpire: (empire: EmpirePlan | null, sectorId: string) => boolean
    createSectorLinkInEmpire: (empire: EmpirePlan | null, sourceSectorId: string, targetSectorId: string) => boolean
    removeSectorLinkInEmpire: (empire: EmpirePlan | null, a: string, b: string) => boolean
    moveStationToSectorInEmpire: (empire: EmpirePlan | null, stationId: string, sectorId: string | null) => boolean
    setStationLocationInEmpire: (empire: EmpirePlan | null, stationId: string, location: EntityLocation | null) => boolean
    setSectorLocationInEmpire: (empire: EmpirePlan | null, sectorId: string, location: EntityLocation | null) => boolean
    setSectorStationOrderInEmpire: (empire: EmpirePlan | null, sectorId: string | null, orderedStationIds: string[]) => boolean
    renameEmpireDraft: (empire: EmpirePlan | null, name: string) => void
  }
  saveBindingStore: {
    activeBinding: { gameGuid: string } | null
    createStationPlanInGroup: (gameGuid: string, groupId: string | null, name: string, type: StationType) => { id: string; name: string; type: StationType; groupId: string | null; modules: SavedModule[]; settings: StationSettings } | null
    deleteStationPlan: (gameGuid: string, planId: string) => boolean
    updateStationPlan: (gameGuid: string, planId: string, patch: Partial<{
      name: string
      type: StationType
      modules: SavedModule[]
      settings: StationSettings
      groupId: string | null
      lockedWares: string[]
      warePriority: Record<string, number>
    }>) => boolean
    upsertStationPlan: (input: {
      gameGuid: string
      saveStationCode: string
      groupId: string | null
      name: string
      type: StationType
      modules: SavedModule[]
      settings: StationSettings
      lockedWares?: string[]
      warePriority?: Record<string, number>
    }) => { id: string } | null
  }
}

export interface EmpireMutationResult {
  createStation: (name: string, type: StationType, selectAfterCreate: boolean) => StationPlan | null
  deleteStation: (stationId: string) => void
  duplicateStation: (stationId: string) => StationPlan | null
  reorderStations: (reorderedStations: StationPlan[]) => void
  renameStation: (stationId: string, newName: string) => boolean
  updateStationSettings: (stationId: string, settings: Partial<StationSettings>) => void
  updateStationModules: (stationId: string, modules: SavedModule[]) => void
  updateStationSector: (stationId: string, sectorId: string | null) => void
  applyImportedStationPayload: (
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ) => boolean
  updateBindingStationPlan: (
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority'>>
  ) => boolean
  createSector: (name: string) => SectorPlan | null
  renameSector: (sectorId: string, name: string) => boolean
  reorderSectors: (orderedSectorIds: string[]) => void
  deleteSector: (sectorId: string) => boolean
  createSectorLink: (sourceSectorId: string, targetSectorId: string) => boolean
  removeSectorLink: (a: string, b: string) => boolean
  moveStationToSector: (stationId: string, sectorId: string | null) => boolean
  setStationLocation: (stationId: string, location: EntityLocation | null) => boolean
  setSectorLocation: (sectorId: string, location: EntityLocation | null) => boolean
  setSectorStationOrder: (sectorId: string | null, orderedStationIds: string[]) => boolean
  updateEmpireName: (name: string) => void
}

export function createEmpireMutationService(deps: EmpireMutationDeps): EmpireMutationResult {
  const {
    productionSource,
    activeEmpire,
    activeStationId,
    activeStation,
    sectors,
    activeTransitSectorId,
    handlers,
    empireDataStore,
    saveBindingStore
  } = deps

  const {
    onStationCreated,
    onStationDeleted,
    onStationUpdated,
    onActiveStationChange,
    onActiveTransitSectorChange,
    getDerivedBindingStation,
    getStationById
  } = handlers

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority'>>
  ): boolean {
    const binding = saveBindingStore.activeBinding
    const parsed = parseBindingStationId(stationId)
    if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return false

    if (parsed.kind === 'plan') {
      return saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, {
        name: patch.name,
        type: patch.type,
        modules: patch.modules,
        settings: patch.settings,
        groupId: patch.sectorId
      })
    }

    const station = getDerivedBindingStation(stationId)
    const plan = saveBindingStore.upsertStationPlan({
      gameGuid: binding.gameGuid,
      saveStationCode: parsed.saveStationCode,
      groupId: patch.sectorId ?? station?.sectorId ?? null,
      name: patch.name ?? station?.name ?? parsed.saveStationCode,
      type: patch.type ?? station?.type ?? 'industrial',
      modules: patch.modules ?? station?.modules ?? [],
      settings: patch.settings ?? station?.settings ?? DEFAULT_STATION_SETTINGS
    })
    if (!plan) return false
    const nextId = createBindingPlanStationId(binding.gameGuid, plan.id)
    if (activeStationId.value === stationId) {
      onActiveStationChange(nextId)
    }
    return true
  }

  function createStation(name: string, type: StationType = 'industrial', selectAfterCreate: boolean = true): StationPlan | null {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      if (!binding) return null
      const groupId = activeStation.value?.sectorId || sectors.value[0]?.id || null
      const plan = saveBindingStore.createStationPlanInGroup(binding.gameGuid, groupId, name, type)
      if (!plan) return null
      const stationId = createBindingPlanStationId(binding.gameGuid, plan.id)
      if (plan && selectAfterCreate) {
        onActiveStationChange(stationId)
      }
      return {
        id: stationId,
        name: plan.name,
        type: plan.type,
        sectorId: plan.groupId || null,
        modules: plan.modules,
        settings: plan.settings,
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
    }

    const station = empireDataStore.createStationInEmpire(activeEmpire.value, name, type)
    if (!station) return null
    if (selectAfterCreate) {
      onActiveStationChange(station.id)
    }
    onStationCreated(station.id)
    return station
  }

  function deleteStation(stationId: string): void {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      if (!binding) return
      const parsed = parseBindingStationId(stationId)
      if (parsed?.kind === 'plan' && parsed.gameGuid === binding.gameGuid) {
        saveBindingStore.deleteStationPlan(binding.gameGuid, parsed.planId)
        stationStateMap.remove(stationId)
      }
      if (activeStationId.value === stationId) {
        onActiveStationChange(null)
      }
      return
    }

    const deleted = empireDataStore.deleteStationFromEmpire(activeEmpire.value, stationId)
    if (deleted) {
      stationStateMap.remove(stationId)
      onStationDeleted(stationId)
      if (activeStationId.value === stationId) {
        onActiveStationChange(activeEmpire.value?.stations[0]?.id || null)
      }
    }
  }

  function duplicateStation(stationId: string): StationPlan | null {
    const newStation = empireDataStore.duplicateStationInEmpire(activeEmpire.value, stationId)
    if (!newStation) return null
    onActiveStationChange(newStation.id)
    onStationCreated(newStation.id)
    return newStation
  }

  function reorderStations(reorderedStations: StationPlan[]): void {
    empireDataStore.reorderStationsInEmpire(activeEmpire.value, reorderedStations)
  }

  function renameStation(stationId: string, newName: string): boolean {
    if (productionSource.value === 'save-binding') {
      const result = updateBindingStationPlan(stationId, { name: newName })
      if (result) onStationUpdated(stationId)
      return result
    }
    const result = empireDataStore.renameStationInEmpire(activeEmpire.value, stationId, newName)
    if (result) onStationUpdated(stationId)
    return result
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>): void {
    if (productionSource.value === 'save-binding') {
      const station = getDerivedBindingStation(stationId)
      const current = migrateStationSettings(station?.settings || DEFAULT_STATION_SETTINGS)
      updateBindingStationPlan(stationId, { settings: { ...current, ...settings } })
      onStationUpdated(stationId)
      return
    }
    if (empireDataStore.updateStationSettingsInEmpire(activeEmpire.value, stationId, settings)) {
      onStationUpdated(stationId)
    }
  }

  function updateStationModules(stationId: string, modules: SavedModule[]): void {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { modules })
      onStationUpdated(stationId)
      return
    }
    if (empireDataStore.updateStationModulesInEmpire(activeEmpire.value, stationId, modules)) {
      onStationUpdated(stationId)
    }
  }

  function updateStationSector(stationId: string, sectorId: string | null): void {
    if (productionSource.value === 'save-binding') {
      updateBindingStationPlan(stationId, { sectorId })
      return
    }
    empireDataStore.updateStationSectorInEmpire(activeEmpire.value, stationId, sectorId)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    if (productionSource.value === 'save-binding') {
      const binding = saveBindingStore.activeBinding
      const parsed = parseBindingStationId(stationId)
      if (!binding || !parsed || parsed.gameGuid !== binding.gameGuid) return false
      
      if (parsed.kind === 'plan') {
        saveBindingStore.updateStationPlan(binding.gameGuid, parsed.planId, {
          modules: payload.modules,
          lockedWares: payload.lockedWares,
          warePriority: payload.warePriority
        })
      } else {
        const station = getDerivedBindingStation(stationId)
        saveBindingStore.upsertStationPlan({
          gameGuid: binding.gameGuid,
          saveStationCode: parsed.saveStationCode,
          groupId: station?.sectorId || null,
          name: station?.name || parsed.saveStationCode,
          type: station?.type || 'industrial',
          modules: payload.modules,
          settings: station?.settings || DEFAULT_STATION_SETTINGS,
          lockedWares: payload.lockedWares,
          warePriority: payload.warePriority
        })
      }
      onStationUpdated(stationId)
      return true
    }
    const station = getStationById(stationId)
    if (!station) return false
    station.modules = payload.modules.map(m => ({ ...m }))
    station.lockedWares = [...payload.lockedWares]
    station.warePriority = { ...payload.warePriority }
    station.lastUpdated = Date.now()
    onStationUpdated(stationId)
    return true
  }

  function createSector(name: string = ''): SectorPlan | null {
    return empireDataStore.createSectorInEmpire(activeEmpire.value, name)
  }

  function renameSector(sectorId: string, name: string): boolean {
    return empireDataStore.renameSectorInEmpire(activeEmpire.value, sectorId, name)
  }

  function reorderSectors(orderedSectorIds: string[]): void {
    empireDataStore.reorderSectorsInEmpire(activeEmpire.value, orderedSectorIds)
  }

  function deleteSector(sectorId: string): boolean {
    const deleted = empireDataStore.deleteSectorFromEmpire(activeEmpire.value, sectorId)
    if (!deleted) return false
    if (activeTransitSectorId.value === sectorId) {
      onActiveTransitSectorChange(null)
    }
    return true
  }

  function createSectorLink(sourceSectorId: string, targetSectorId: string): boolean {
    return empireDataStore.createSectorLinkInEmpire(activeEmpire.value, sourceSectorId, targetSectorId)
  }

  function removeSectorLink(a: string, b: string): boolean {
    return empireDataStore.removeSectorLinkInEmpire(activeEmpire.value, a, b)
  }

  function moveStationToSector(stationId: string, sectorId: string | null): boolean {
    if (productionSource.value === 'save-binding') {
      return updateBindingStationPlan(stationId, { sectorId })
    }
    return empireDataStore.moveStationToSectorInEmpire(activeEmpire.value, stationId, sectorId)
  }

  function setStationLocation(stationId: string, location: EntityLocation | null): boolean {
    return empireDataStore.setStationLocationInEmpire(activeEmpire.value, stationId, location)
  }

  function setSectorLocation(sectorId: string, location: EntityLocation | null): boolean {
    return empireDataStore.setSectorLocationInEmpire(activeEmpire.value, sectorId, location)
  }

  function setSectorStationOrder(sectorId: string | null, orderedStationIds: string[]): boolean {
    return empireDataStore.setSectorStationOrderInEmpire(activeEmpire.value, sectorId, orderedStationIds)
  }

  function updateEmpireName(name: string): void {
    empireDataStore.renameEmpireDraft(activeEmpire.value, name)
  }

  return {
    createStation,
    deleteStation,
    duplicateStation,
    reorderStations,
    renameStation,
    updateStationSettings,
    updateStationModules,
    updateStationSector,
    applyImportedStationPayload,
    updateBindingStationPlan,
    createSector,
    renameSector,
    reorderSectors,
    deleteSector,
    createSectorLink,
    removeSectorLink,
    moveStationToSector,
    setStationLocation,
    setSectorLocation,
    setSectorStationOrder,
    updateEmpireName
  }
}