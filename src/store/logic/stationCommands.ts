import type { StationPlan, SavedModule, StationSettings } from '@/types/x4'
import type { StationComputeDeps } from '@/store/state/StationStateMap'
import {
  syncPersistedToStateMap,
  recomputeStation,
  syncStateMapToPersisted,
  patchStationState,
  mutateStationState,
  ensureStationState,
  deepClone
} from './stationComputeService'
import { DEFAULT_STATION_SETTINGS, migrateStationSettings } from '@/store/state/StationStateMap'

export type ProductionSourceKind = 'empire' | 'save-binding'

export interface StationCommandContext {
  productionSource: ProductionSourceKind
  getStationById: (stationId: string) => StationPlan | null
  updateEmpireStationModules: (stationId: string, modules: SavedModule[]) => boolean
  updateEmpireStationSettings: (stationId: string, settings: Partial<StationSettings>) => boolean
  updateBindingStationPlan: (
    stationId: string,
    patch: Partial<Pick<StationPlan, 'modules' | 'settings' | 'lockedWares' | 'warePriority' | 'sectorId' | 'name' | 'type'>>
  ) => boolean
  getComputeDeps: () => StationComputeDeps | null
  getWaresMap: () => Record<string, { transport: string }> | null
}

export interface StationCommands {
  updateModules: (stationId: string, modules: SavedModule[]) => void
  updateSettings: (stationId: string, settings: Partial<StationSettings>) => void
  addModule: (stationId: string, moduleId: string, count: number) => void
  removeModule: (stationId: string, index: number) => void
  updateModuleId: (stationId: string, index: number, newId: string) => void
  updateModuleCount: (stationId: string, index: number, count: number) => void
  toggleWareLock: (stationId: string, wareId: string) => void
  updateWarePriority: (stationId: string, wareId: string, level: number | undefined) => void
  clearAll: (stationId: string) => void
  applyPlan: (stationId: string, plan: StationPlan) => void
}

function getWaresTransportType(
  waresMap: Record<string, { transport: string }> | null,
  wareId: string
): string | null {
  if (!waresMap) return null
  return waresMap[wareId]?.transport ?? null
}

export function createStationCommands(ctx: StationCommandContext): StationCommands {
  function writeToStateMapAndRecompute(
    stationId: string,
    stateMapWriter: () => void
  ): void {
    const deps = ctx.getComputeDeps()
    if (!deps) return

    stateMapWriter()
    recomputeStation(stationId, deps)

    syncBackToPersisted(stationId)
  }

  function syncBackToPersisted(stationId: string): void {
    if (stationId === '__local__') return
    if (ctx.productionSource === 'save-binding') {
      const persisted = syncStateMapToPersisted(stationId)
      if (persisted) {
        ctx.updateBindingStationPlan(stationId, {
          modules: persisted.modules,
          settings: persisted.settings,
          lockedWares: persisted.lockedWares,
          warePriority: persisted.warePriority
        })
      }
      return
    }
    const persisted = syncStateMapToPersisted(stationId)
    const station = ctx.getStationById(stationId)
    if (persisted && station) {
      station.modules = deepClone(persisted.modules)
      station.lockedWares = deepClone(persisted.lockedWares)
      station.warePriority = deepClone(persisted.warePriority)
      station.settings = migrateStationSettings(persisted.settings)
    }
  }

  function updateModules(stationId: string, modules: SavedModule[]): void {
    if (ctx.productionSource === 'save-binding') {
      ctx.updateBindingStationPlan(stationId, { modules })
      const deps = ctx.getComputeDeps()
      if (deps) {
        const station = ctx.getStationById(stationId)
        if (station) {
          syncPersistedToStateMap(stationId, station)
          recomputeStation(stationId, deps)
        }
      }
      return
    }

    if (ctx.updateEmpireStationModules(stationId, modules)) {
      const deps = ctx.getComputeDeps()
      if (deps) {
        const station = ctx.getStationById(stationId)
        if (station) {
          syncPersistedToStateMap(stationId, station)
          recomputeStation(stationId, deps)
        }
      }
    }
  }

  function updateSettings(stationId: string, settings: Partial<StationSettings>): void {
    if (ctx.productionSource === 'save-binding') {
      const station = ctx.getStationById(stationId)
      const current = migrateStationSettings(station?.settings || DEFAULT_STATION_SETTINGS)
      ctx.updateBindingStationPlan(stationId, { settings: { ...current, ...settings } })
      const deps = ctx.getComputeDeps()
      if (deps) {
        const updatedStation = ctx.getStationById(stationId)
        if (updatedStation) {
          syncPersistedToStateMap(stationId, updatedStation)
          recomputeStation(stationId, deps)
        }
      }
      return
    }

    if (ctx.updateEmpireStationSettings(stationId, settings)) {
      const deps = ctx.getComputeDeps()
      if (deps) {
        const station = ctx.getStationById(stationId)
        if (station) {
          syncPersistedToStateMap(stationId, station)
          recomputeStation(stationId, deps)
        }
      }
    }
  }

  function addModule(stationId: string, moduleId: string, count: number): void {
    writeToStateMapAndRecompute(stationId, () => {
      ensureStationState(stationId)
      mutateStationState(stationId, (state) => {
        if (!state) return
        if (moduleId !== '') {
          const existing = state.plannedModules.find(m => m.id === moduleId)
          if (existing) existing.count += count
          else state.plannedModules.push({ id: moduleId, count })
        } else {
          state.plannedModules.push({ id: moduleId, count })
        }
      })
    })
  }

  function removeModule(stationId: string, index: number): void {
    writeToStateMapAndRecompute(stationId, () => {
      mutateStationState(stationId, (state) => {
        if (!state) return
        if (index >= 0 && index < state.plannedModules.length) {
          state.plannedModules.splice(index, 1)
        }
      })
    })
  }

  function updateModuleId(stationId: string, index: number, newId: string): void {
    writeToStateMapAndRecompute(stationId, () => {
      mutateStationState(stationId, (state) => {
        if (!state) return
        if (index >= 0 && index < state.plannedModules.length) {
          const module = state.plannedModules[index]
          if (module) module.id = newId
        }
      })
    })
  }

  function updateModuleCount(stationId: string, index: number, count: number): void {
    writeToStateMapAndRecompute(stationId, () => {
      mutateStationState(stationId, (state) => {
        if (!state) return
        if (index >= 0 && index < state.plannedModules.length) {
          const module = state.plannedModules[index]
          if (module) module.count = count
        }
      })
    })
  }

  function toggleWareLock(stationId: string, wareId: string): void {
    const waresMap = ctx.getWaresMap()
    const transport = getWaresTransportType(waresMap, wareId)
    if (transport !== 'container') return

    writeToStateMapAndRecompute(stationId, () => {
      mutateStationState(stationId, (state) => {
        if (!state) return
        const idx = state.lockedWares.indexOf(wareId)
        if (idx > -1) state.lockedWares.splice(idx, 1)
        else state.lockedWares.push(wareId)
      })
    })
  }

  function updateWarePriority(stationId: string, wareId: string, level: number | undefined): void {
    writeToStateMapAndRecompute(stationId, () => {
      mutateStationState(stationId, (state) => {
        if (!state) return
        if (level !== undefined) {
          state.warePriority[wareId] = level
        } else {
          delete state.warePriority[wareId]
        }
      })
    })
  }

  function clearAll(stationId: string): void {
    writeToStateMapAndRecompute(stationId, () => {
      patchStationState(stationId, {
        plannedModules: [],
        lockedWares: [],
        warePriority: {}
      })
    })
  }

  function applyPlan(stationId: string, plan: StationPlan): void {
    writeToStateMapAndRecompute(stationId, () => {
      patchStationState(stationId, {
        plannedModules: deepClone(plan.modules),
        lockedWares: deepClone(plan.lockedWares || []),
        warePriority: deepClone(plan.warePriority || {}),
        settings: migrateStationSettings(plan.settings)
      })
    })
  }

  return {
    updateModules,
    updateSettings,
    addModule,
    removeModule,
    updateModuleId,
    updateModuleCount,
    toggleWareLock,
    updateWarePriority,
    clearAll,
    applyPlan
  }
}