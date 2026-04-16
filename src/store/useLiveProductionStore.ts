import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  StationPlan,
  StationType,
  SavedModule,
  GroupedFlows,
  StationSettings,
  TransitHubViewModel,
  SupplyPlanningInput,
  SectorInternalData,
  X4Module,
  BindingStationPlan
} from '@/types/x4'
import type { ProductionSessionContext } from '@/types/production-context'
import type { PlayerStationRecord, ArchiveStationData, BuildStorageEntry, PlayerStationEntry } from '@/types/saveArchive'
import type {
  ProductionWorkbenchStoreContract,
  ProductionWorkbenchCapabilities,
  ProductionAddModuleOptions,
  ProductionRemoveModuleTarget,
  ImportPayload
} from '@/types/production-workbench-contract'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { SectorLinkCalcEntry } from './logic/empireFlowFacade'
import i18n from '@/i18n'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { DEFAULT_STATION_SETTINGS, migrateStationSettings, type StationComputeDeps } from './state/stationSettings'
import { stationProductionFlowMap } from './state/StationProductionFlowMap'
import { deepClone } from '@/utils/deepClone'
import { analyzeStation } from './logic/analyzeStation'
import {
  createEmpireSourceView,
  computeActiveTransitSectorId,
  toTransitTabId
} from './logic/empireSourceView'
import { createEmpireFlowFacade } from './logic/empireFlowFacade'
import { toProductionStation } from './logic/liveStationResolver'
import { loadPlayerStationsByArchiveId, createArchiveId } from '@/db/saveArchiveDB'

export const useLiveProductionStore = defineStore('liveProduction', () => {
  const gameData = useGameDataStore()
  const saveBindingStore = useSaveBindingStore()
  const saveStore = useSaveStore()
  const activeViewStore = useActiveViewStore()
  const { activeBinding } = storeToRefs(saveBindingStore)
  const { selectedArchive } = storeToRefs(saveStore)

  const isReady = ref(false)
  const buildPriceMultiplier = ref(0.5)
  const playerStationRecords = ref<PlayerStationRecord[]>([])

  const productionSource = computed<'save-binding'>(() => 'save-binding')

  async function loadPlayerStationRecords() {
    const archive = selectedArchive.value
    if (!archive) {
      playerStationRecords.value = []
      return
    }
    const scopeKey = gameData.getStorageKey('save_archives')
    const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
    try {
      const records = await loadPlayerStationsByArchiveId(scopeKey, archiveId)
      playerStationRecords.value = records
    } catch (e) {
      console.error('[LiveProductionStore] Failed to load player stations:', e)
      playerStationRecords.value = []
    }
  }

  watch(selectedArchive, async () => {
    await loadPlayerStationRecords()
  })

  const activeStationId = computed({
    get: () => activeViewStore.activeBindingStation,
    set: (id: string | null) => activeViewStore.activeBindingStation = id
  })

  const activeBindingName = computed({
    get: () => saveBindingStore.activeBindingName,
    set: (name: string) => { saveBindingStore.activeBindingName = name }
  })

  const sourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sectorsMap: computed(() => gameData.maps.sectors)
  })

  const sectors = sourceView.sectors
  const orderedStationsBySector = sourceView.orderedStationsBySector
  const derivedBindingStations = sourceView.derivedBindingStations

  const flowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    medicalConsumptionMap: computed(() => gameData.medicalConsumptionMap),
    enforceDlcActivation: computed(() => gameData.enforceDlcActivation),
    isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  })

  const stationFlowCache = flowFacade.stationFlowCache
  const empireGroupedFlows = flowFacade.empireGroupedFlows
  const sectorInternalDataMap = flowFacade.sectorInternalDataMap
  const sectorLinkCalcMap = flowFacade.sectorLinkCalcMap

  const activeTransitSectorId = computed(() => computeActiveTransitSectorId(
    activeStationId.value,
    sectors.value
  ))

  const transitHubSettings = computed<Partial<StationSettings>>(() => {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) return {}
    const group = activeBinding.value?.groups.find(g => g.id === sectorId)
    return group?.settings || {}
  })

  function updateTransitHubSettings(patch: Partial<StationSettings>) {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) return
    const gameGuid = activeBinding.value?.gameGuid
    if (!gameGuid) return
    const current = transitHubSettings.value
    saveBindingStore.updateGroup(gameGuid, sectorId, {
      settings: { ...current, ...patch }
    })
  }

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    return sourceView.getDerivedBindingStation(stationId)
  }

  function getStationById(stationId: string): StationPlan | null {
    return sourceView.getStationById(stationId)
  }

  function getLinkedSectors(sectorId: string): string[] {
    const group = activeBinding.value?.groups.find(g => g.id === sectorId)
    if (!group) return []
    return group.connectedGroupIds || []
  }

  const bindingStation = computed<BindingStationPlan | null>(() => {
    const stationId = activeStationId.value
    if (!stationId) return null
    
    const binding = activeBinding.value
    if (!binding) return null
    
    return binding.stationPlans.find(plan => plan.id === stationId) || null
  })

  const archiveStation = computed<ArchiveStationData | null>(() => {
    const stationId = activeStationId.value
    if (!stationId) return null
    
    const binding = activeBinding.value
    if (!binding) return null
    
    const plan = binding.stationPlans.find(plan => plan.id === stationId)
    const code = plan?.saveStationCode || stationId
    
    const record = playerStationRecords.value.find(r => r.code === code && r.type === 'station')
    if (!record) return null
    
    const stationEntry = record.data as PlayerStationEntry
    const sectorMacro = record.sectorMacro
    
    const sector = gameData.maps?.sectors?.[sectorMacro]
    const sectorData = {
      name: sector?.name || sectorMacro,
      nameId: sector?.nameId,
      resources: (sector?.resources || []).map(r => r.ware),
      sunlight: sector?.area?.sunlight ?? 100
    }
    
    const position = stationEntry.relative_position ? {
      x: stationEntry.relative_position.x,
      y: stationEntry.relative_position.y,
      z: stationEntry.relative_position.z
    } : undefined
    
    const modules: SavedModule[] = []
    if (stationEntry.modules) {
      const modulesByMacroId = gameData.modulesByMacroId
      for (const mod of Object.values(stationEntry.modules)) {
        const matchedModule = mod.module_id || modulesByMacroId[mod.ref]?.id
        if (matchedModule) {
          const existing = modules.find(m => m.id === matchedModule)
          if (existing) {
            existing.count += mod.amount
          } else {
            modules.push({ id: matchedModule, count: mod.amount })
          }
        }
      }
    }
    
    const buildingModules: SavedModule[] = []
    if (stationEntry.buildstorage_code) {
      const buildstorageRecord = playerStationRecords.value.find(
        r => r.code === stationEntry.buildstorage_code && r.type === 'buildstorage'
      )
      if (buildstorageRecord) {
        const buildstorageEntry = buildstorageRecord.data as BuildStorageEntry
        if (buildstorageEntry.modules) {
          const modulesByMacroId = gameData.modulesByMacroId
          const stationModuleIds = new Set(modules.map(m => m.id))
          for (const mod of Object.values(buildstorageEntry.modules)) {
            const matchedModule = mod.module_id || modulesByMacroId[mod.ref]?.id
            if (matchedModule && !stationModuleIds.has(matchedModule)) {
              const existing = buildingModules.find(m => m.id === matchedModule)
              if (existing) {
                existing.count += mod.amount
              } else {
                buildingModules.push({ id: matchedModule, count: mod.amount })
              }
            }
          }
        }
        
        return {
          code: record.code,
          name: stationEntry.macro,
          sectorMacro,
          sector: sectorData,
          position,
          modules,
          building: {
            modules: buildingModules,
            cargo: buildstorageEntry.cargo || [],
            reservation: buildstorageEntry.reservation || []
          },
          cargo: stationEntry.cargo,
          reservation: stationEntry.reservation
        }
      }
    }
    
    return {
      code: record.code,
      name: stationEntry.macro,
      sectorMacro,
      sector: sectorData,
      position,
      modules,
      building: {
        modules: buildingModules,
        cargo: [],
        reservation: []
      },
      cargo: stationEntry.cargo,
      reservation: stationEntry.reservation
    }
  })

  const mode = ref<'live' | 'planning'>('planning')

  const stationContext = computed(() => {
    const binding = bindingStation.value
    const archive = archiveStation.value
    const station = activeStation.value
    
    if (!station) return null
    
    const hasBinding = binding !== null
    const hasArchive = archive !== null
    const stationCode = archive?.code || ''
    
    const sectorName = archive?.sector?.name || ''
    const sectorNameId = archive?.sector?.nameId
    const sectorResources = archive?.sector?.resources || []
    const sectorSunlight = archive?.sector?.sunlight ?? 100
    const position = archive?.position
    
    const archiveModules: SavedModule[] = archive?.modules || []
    const buildingModules: SavedModule[] = archive?.building?.modules || []
    
    return {
      hasBinding,
      hasArchive,
      stationCode,
      sectorName,
      sectorNameId,
      sectorResources,
      sectorSunlight,
      position,
      archiveModules,
      buildingModules
    }
  })

  const initialMode = computed<'live' | 'planning'>(() => {
    const hasBinding = bindingStation.value !== null
    const hasSave = archiveStation.value !== null
    if (hasBinding && hasSave) return 'planning'
    if (hasBinding && !hasSave) return 'planning'
    if (!hasBinding && hasSave) return 'live'
    return 'planning'
  })

  const canToggle = computed(() => {
    const hasBinding = bindingStation.value !== null
    const hasSave = archiveStation.value !== null
    return (hasBinding && hasSave) || (!hasBinding && hasSave)
  })

  function toggleMode() {
    if (!canToggle.value) return
    mode.value = mode.value === 'live' ? 'planning' : 'live'
  }

  watch(activeStationId, () => {
    if (activeStationId.value) {
      mode.value = initialMode.value
    }
  })

  const activeStation = computed<StationPlan | null>(() => {
    if (bindingStation.value) {
      return toProductionStation(bindingStation.value, gameData.maps.sectors)
    }
    if (archiveStation.value) {
      const archive = archiveStation.value
      return {
        id: archive.code,
        name: archive.code,
        type: 'industrial',
        modules: [],
        settings: { ...DEFAULT_STATION_SETTINGS, sunlight: Math.round((archive.sector?.sunlight ?? 1) * 100) },
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
    }
    return null
  })

  function getComputeDeps(): StationComputeDeps | null {
    const { modulesMap, waresMap, medicalConsumptionMap, enforceDlcActivation } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !medicalConsumptionMap) return null
    return {
      modulesMap,
      waresMap,
      medicalConsumptionMap,
      buildPriceMultiplier: buildPriceMultiplier.value,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag)
    }
  }

  function syncAllBindingStationsToStateMap(): void {
    const stations = derivedBindingStations.value
    const deps = getComputeDeps()
    if (!deps) return

    stations.forEach((item) => {
      const station = item.station
      station.settings = migrateStationSettings(station.settings)
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: station.settings,
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
    })

    const stationPlans = stations.map(item => item.station)
    stationProductionFlowMap.updateAggregation(stationPlans)
  }

  const plannedModules = computed<SavedModule[]>({
    get: () => activeStation.value?.modules || [],
    set: (value) => {
      const station = activeStation.value
      if (!station) return
      station.modules = deepClone(value)
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      if (deps) {
        stationProductionFlowMap.compute(station.id, {
          plannedModules: station.modules,
          settings: migrateStationSettings(station.settings),
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority || {}
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
      }
    }
  })

  const lockedWares = computed<string[]>({
    get: () => activeStation.value?.lockedWares || [],
    set: (value) => {
      const station = activeStation.value
      if (!station) return
      station.lockedWares = deepClone(value)
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      if (deps) {
        stationProductionFlowMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: migrateStationSettings(station.settings),
          lockedWares: station.lockedWares,
          warePriority: station.warePriority || {}
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
      }
}
  })

  const warePriority = computed<Record<string, number>>({
    get: () => activeStation.value?.warePriority || {},
    set: (value) => {
      const station = activeStation.value
      if (!station) return
      station.warePriority = deepClone(value)
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      if (deps) {
        stationProductionFlowMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: migrateStationSettings(station.settings),
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
      }
    }
  })

  const settings = computed<StationSettings>({
    get: () => activeStation.value?.settings || { ...DEFAULT_STATION_SETTINGS },
    set: (value) => {
      const station = activeStation.value
      if (!station) return
      station.settings = migrateStationSettings(value)
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      if (deps) {
        stationProductionFlowMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: station.settings,
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority || {}
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
      }
    }
  })

  const activeStationState = computed(() => {
    const stationId = activeStation.value?.id
    if (!stationId) {
      return {
        actualWorkforce: 0,
        currentEfficiency: 0,
        warePriorityLevels: {},
        productionFlows: [],
        plannedModules: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: []
      }
    }
    const cache = stationProductionFlowMap.getCache(stationId)
    const planned = plannedModules.value
    const autoIndustry = cache?.autoIndustryModules || []
    const autoHabitation = cache?.autoHabitationModules || []
    const autoInfrastructure = cache?.autoInfrastructureModules || []
    const resolved = [...planned, ...autoIndustry, ...autoHabitation, ...autoInfrastructure]
    
    return {
      actualWorkforce: cache?.actualWorkforce || 0,
      currentEfficiency: cache?.currentEfficiency || 0,
      warePriorityLevels: cache?.warePriorityLevels || {},
      productionFlows: stationProductionFlowMap.getProductionFlows(stationId),
      plannedModules: planned,
      autoIndustryModules: autoIndustry,
      autoHabitationModules: autoHabitation,
      autoInfrastructureModules: autoInfrastructure,
      resolvedModules: resolved
    }
  })

  const productionFlows = computed(() => activeStationState.value.productionFlows)
  const warePriorityLevels = computed(() => activeStationState.value.warePriorityLevels)
  const actualWorkforce = computed(() => activeStationState.value.actualWorkforce)
  const currentEfficiency = computed(() => activeStationState.value.currentEfficiency)

  const wares = computed(() => gameData.waresMap)

  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function updatePlannedModules(modules: SavedModule[]): void {
    if (activeStation.value) {
      updateStationModules(activeStation.value.id, modules)
    }
  }

  function updateStationSettingsDirect(key: keyof StationSettings, value: StationSettings[keyof StationSettings]): void {
    const station = activeStation.value
    if (!station) return
    station.settings = migrateStationSettings({ ...station.settings, [key]: value })
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: station.settings,
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function isWareOperable(wareId: string): boolean {
    const ware = gameData.waresMap[wareId]
    return ware?.transport === 'container'
  }

  function isWareLocked(wareId: string): boolean {
    if (!isWareOperable(wareId)) return true
    return lockedWares.value.includes(wareId)
  }

  function toggleWareLock(wareId: string): void {
    console.log('[LiveStore] toggleWareLock called', { wareId, operable: isWareOperable(wareId) })
    if (!isWareOperable(wareId)) {
      console.log('[LiveStore] toggleWareLock skipped - not operable')
      return
    }
    const station = activeStation.value
    if (!station) return
    const current = station.lockedWares || []
    console.log('[LiveStore] toggleWareLock writing', { wareId, current, willLock: !current.includes(wareId) })
    station.lockedWares = current.includes(wareId)
      ? current.filter((id: string) => id !== wareId)
      : [...current, wareId]
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares,
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function isPlannedWare(wareId: string): boolean {
    return plannedModules.value.some(module => {
      const moduleInfo = gameData.modulesMap[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function isAutoWare(wareId: string): boolean {
    if (isPlannedWare(wareId)) return false
    return activeStationState.value.autoIndustryModules.some(module => {
      const moduleInfo = gameData.modulesMap[module.id]
      if (!moduleInfo) return false
      return Object.keys(moduleInfo.outputs || {}).includes(wareId)
    })
  }

  function getResolvedLevel(wareId: string): number {
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)
    const override = warePriority.value[wareId]

    if (planned && override === 0) return 1
    if (auto && override === 2) return 1
    if (override !== undefined) return override
    if (planned) return 2
    if (auto) return 0
    return 0
  }

  function toggleWarePriority(wareId: string): void {
    const currentLevel = getResolvedLevel(wareId)
    const planned = isPlannedWare(wareId)
    const auto = isAutoWare(wareId)

    const station = activeStation.value
    if (!station) return
    const nextPriority = deepClone(station.warePriority || {})

    if (planned) {
      if (currentLevel === 2) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    } else if (auto) {
      if (currentLevel === 0) nextPriority[wareId] = 1
      else delete nextPriority[wareId]
    }

    station.warePriority = nextPriority
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  function getModuleInfo(id: string): X4Module {
    return gameData.modulesMap[id] || {
      id, macroId: '', wareId: '', nameId: id, type: 'unknown', group: 'others', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      dockingCount: 0,
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  function addModule(id: string = '', count = 1): void {
    if (id !== '' && !gameData.modulesMap[id]) return
    const station = activeStation.value
    if (!station) return
    const current = station.modules || []
    const existingIndex = current.findIndex(m => m.id === id)
    if (existingIndex !== -1) {
      const next = deepClone(current)
      const existing = next[existingIndex]
      if (existing) existing.count += count
      station.modules = next
    } else {
      station.modules = [...current, { id, count }]
    }
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules,
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function removeModule(index: number): void {
    const station = activeStation.value
    if (!station) return
    const current = station.modules || []
    station.modules = current.filter((_, i) => i !== index)
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules,
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function updateModuleCount(index: number, count: number): void {
    const module = plannedModules.value[index]
    if (!module || !isModuleCountEditable(module.id)) return
    const station = activeStation.value
    if (!station) return
    const next = deepClone(station.modules || [])
    const target = next[index]
    if (target) target.count = count
    station.modules = next
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: station.modules,
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  function removeModuleById(id: string): void {
    const index = plannedModules.value.findIndex(m => m.id === id)
    if (index !== -1) removeModule(index)
  }

  function transferModuleFromAutoIndustry(module: SavedModule): void {
    const inIndustry = activeStationState.value.autoIndustryModules.some(m => m.id === module.id)
    if (!inIndustry) return
    addModule(module.id, module.count)
  }

  function clearAllModules(): void {
    const station = activeStation.value
    if (!station) return
    station.modules = []
    station.lastUpdated = Date.now()
    const deps = getComputeDeps()
    if (deps) {
      stationProductionFlowMap.compute(station.id, {
        plannedModules: [],
        settings: migrateStationSettings(station.settings),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      updateBindingStationPlan(station.id, {
        modules: [],
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    }
  }

  watch(
    () => ({
      stationId: activeStation.value?.id,
      gameReady: gameData.isReady,
      buildPrice: buildPriceMultiplier.value,
      enforceDlcActivation: gameData.enforceDlcActivation
    }),
    () => {
      const station = activeStation.value
      const deps = getComputeDeps()
      if (station && deps) {
        stationProductionFlowMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: migrateStationSettings(station.settings),
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority || {}
        }, deps)
      }
    },
    { immediate: true }
  )

  function refreshStationFlowCache(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    const deps = getComputeDeps()
    if (!deps) return
    stationProductionFlowMap.compute(stationId, {
      plannedModules: station.modules || [],
      settings: migrateStationSettings(station.settings),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
  }

  function getStationFlowCache(stationId: string): GroupedFlows | null {
    const cache = stationProductionFlowMap.getCache(stationId)
    if (!cache) return null
    return stationProductionFlowMap.getFilteredGrouped(stationId, cache.warePriorityLevels)
  }

  function clearStationCaches() {
    stationProductionFlowMap.clear()
  }

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    return flowFacade.getSupplyPlanningInput(sectorId)
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    return flowFacade.getSectorInternalData(sectorId)
  }

  function getSectorLinkCalc(sectorId: string): SectorLinkCalcEntry | null {
    return flowFacade.getSectorLinkCalc(sectorId)
  }

  function getStationComponentGapFlows(stationId: string | null): StationComponentGapFlows {
    return flowFacade.getStationComponentGapFlows(stationId, activeStationId.value)
  }

  function getTransitHubViewModel(input: {
    sectorId: string | null
    racePreference: string
    transportShipCapacity: number
    storageBufferHours?: number
    buyMultiplier?: number
    sellMultiplier?: number
  }): TransitHubViewModel {
    return flowFacade.getTransitHubViewModel(input)
  }

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority' | 'count' | 'minerals'>>
  ): boolean {
    const binding = activeBinding.value
    if (!binding) return false

    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)
    
    if (existingPlan) {
      return saveBindingStore.updateStationPlan(binding.gameGuid, stationId, {
        name: patch.name,
        type: patch.type,
        modules: patch.modules,
        settings: patch.settings,
        groupId: patch.sectorId,
        count: patch.count,
        minerals: patch.minerals,
        lockedWares: patch.lockedWares,
        warePriority: patch.warePriority
      })
    }

    const station = getDerivedBindingStation(stationId)
    const plan = saveBindingStore.upsertStationPlan({
      gameGuid: binding.gameGuid,
      saveStationCode: stationId,
      groupId: patch.sectorId ?? station?.sectorId ?? null,
      name: patch.name ?? station?.name ?? stationId,
      type: patch.type ?? station?.type ?? 'industrial',
      modules: patch.modules ?? station?.modules ?? [],
      settings: patch.settings ?? station?.settings ?? DEFAULT_STATION_SETTINGS,
      count: patch.count ?? station?.count ?? 1,
      minerals: patch.minerals ?? station?.minerals ?? [],
      lockedWares: patch.lockedWares ?? [],
      warePriority: patch.warePriority ?? {}
    })
    if (!plan) return false
    const nextId = plan.id
    if (activeStationId.value === stationId) {
      activeStationId.value = nextId
    }
    return true
  }

  function createStation(name: string, type: StationType = 'industrial', selectAfterCreate: boolean = true) {
    const binding = activeBinding.value
    if (!binding) return null
    const groupId = activeStation.value?.sectorId || sectors.value[0]?.id || null
    const plan = saveBindingStore.createStationPlanInGroup(binding.gameGuid, groupId, name, type)
    if (!plan) return null
    const stationId = plan.id
    if (plan && selectAfterCreate) {
      activeStationId.value = stationId
    }
    const station = toProductionStation(plan)
    station.sectorId = plan.groupId || null
    refreshStationFlowCache(stationId)
    return station
  }

  function deleteStation(stationId: string) {
    const binding = activeBinding.value
    if (!binding) return
    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)
    if (existingPlan) {
      saveBindingStore.deleteStationPlan(binding.gameGuid, stationId)
      stationProductionFlowMap.remove(stationId)
    }
    if (activeStationId.value === stationId) {
      activeStationId.value = null
    }
  }

  function renameStation(stationId: string, newName: string) {
    return updateBindingStationPlan(stationId, { name: newName })
  }

  function selectStation(stationId: string | null) {
    activeStationId.value = stationId
  }

  function selectTransitSector(sectorId: string | null) {
    if (!sectorId) {
      activeStationId.value = null
      return
    }
    const exists = sectors.value.some((sector) => sector.id === sectorId)
    if (!exists) return
    const transitTabId = toTransitTabId(sectorId)
    activeStationId.value = transitTabId
  }

  function selectOverview() {
    activeStationId.value = null
  }

  function updateStationSettings(stationId: string, settings: Partial<StationSettings>) {
    const station = getDerivedBindingStation(stationId)
    const current = station?.settings || DEFAULT_STATION_SETTINGS
    updateBindingStationPlan(stationId, { settings: { ...current, ...settings } })
    refreshStationFlowCache(stationId)
  }

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    updateBindingStationPlan(stationId, { modules })
    refreshStationFlowCache(stationId)
  }

  function updateStationType(stationId: string, type: StationType) {
    updateBindingStationPlan(stationId, { type })
    refreshStationFlowCache(stationId)
  }

  function updateStationCount(stationId: string, count: number) {
    updateBindingStationPlan(stationId, { count })
    refreshStationFlowCache(stationId)
  }

  function updateStationMinerals(stationId: string, minerals: string[]) {
    updateBindingStationPlan(stationId, { minerals })
    refreshStationFlowCache(stationId)
  }

  function applyImportedStationPayload(
    stationId: string,
    payload: { modules: SavedModule[]; lockedWares: string[]; warePriority: Record<string, number> }
  ): boolean {
    const binding = activeBinding.value
    if (!binding) return false

    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)

    if (existingPlan) {
      saveBindingStore.updateStationPlan(binding.gameGuid, stationId, {
        modules: payload.modules,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    } else {
      const station = getDerivedBindingStation(stationId)
      saveBindingStore.upsertStationPlan({
        gameGuid: binding.gameGuid,
        saveStationCode: stationId,
        groupId: station?.sectorId || null,
        name: station?.name || stationId,
        type: station?.type || 'industrial',
        modules: payload.modules,
        settings: station?.settings || DEFAULT_STATION_SETTINGS,
        lockedWares: payload.lockedWares,
        warePriority: payload.warePriority
      })
    }
    refreshStationFlowCache(stationId)
    return true
  }

  function renameBindingSector(sectorId: string, name: string): boolean {
    const binding = activeBinding.value
    if (!binding) return false
    return saveBindingStore.updateGroup(binding.gameGuid, sectorId, { name })
  }

  const isDirty = computed(() => saveBindingStore.isDirty)

  function saveBinding() {
    saveBindingStore.saveBinding()
  }

  function discardChanges() {
    saveBindingStore.discardChanges()
    const guid = activeBinding.value?.gameGuid || activeViewStore.activeBinding
    if (guid) {
      validateActiveStationId()
    }
  }

  function isEmptyForSave() {
    return !activeBinding.value
  }

  const session: ProductionSessionContext = {
    isDirty: computed(() => isDirty.value).value,
    save: saveBinding,
    discard: discardChanges,
    canSave: computed(() => !isEmptyForSave()).value,
    canDiscard: computed(() => isDirty.value).value
  }

  function validateActiveStationId() {
    const currentStationId = activeViewStore.activeBindingStation
    if (!currentStationId) return

    const transitMatch = currentStationId.match(/^transit:(.+)$/)
    if (transitMatch) {
      const sectorId = transitMatch[1]!
      const validSectorIds = new Set(sectors.value.map(s => s.id))
      if (validSectorIds.has(sectorId)) {
        activeStationId.value = currentStationId
        expandedSectorId.value = sectorId
      } else {
        activeStationId.value = null
        expandedSectorId.value = null
      }
      return
    }

    const validIds = new Set(derivedBindingStations.value.map(item => item.station.id))
    if (validIds.has(currentStationId)) {
      activeStationId.value = currentStationId
      const station = orderedStationsBySector.value.find(s => s.id === currentStationId)
      if (station?.sectorId) {
        expandedSectorId.value = station.sectorId
      }
    } else {
      activeStationId.value = null
    }
  }

  async function initialize() {
    console.log('[LiveProductionStore] Initializing...')
    isReady.value = false

    try {
      await gameData.initialize()
      await loadPlayerStationRecords()

      saveBindingStore.initialize()

      const storedGuid = activeViewStore.activeBinding
      if (storedGuid && saveBindingStore.savedBindings.list.some((b) => b.gameGuid === storedGuid)) {
        openBinding(storedGuid)
        syncAllBindingStationsToStateMap()
        validateActiveStationId()
        isReady.value = true
        console.log('[LiveProductionStore] Loaded saved binding')
        return
      }

      const firstBinding = saveBindingStore.savedBindings.list[0]
      if (firstBinding) {
        activeViewStore.activeBinding = firstBinding.gameGuid
        openBinding(firstBinding.gameGuid)
        syncAllBindingStationsToStateMap()
        validateActiveStationId()
        isReady.value = true
        console.log('[LiveProductionStore] Loaded first binding')
        return
      }

      console.log('[LiveProductionStore] No bindings found')
      isReady.value = true

    } catch (e) {
      console.error('[LiveProductionStore] Initialization failed:', e)
    }
  }

  function openBinding(gameGuid: string) {
    const currentDraft = activeBinding.value
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    saveBindingStore.createOrOpenBinding(gameGuid)
    activeViewStore.activeBinding = gameGuid
  }

  const importModalOpen = ref(false)
  const wareflowViewMode = ref<WareFlowViewMode>('quantity')
  const expandedSectorId = ref<string | null>(null)

  const capabilities: ProductionWorkbenchCapabilities = {
    uniqueWorkbench: true,
    uniqueStation: true,
    hasSectors: true
  }

  const empireGapsComputed = computed<{ operations: EmpireGapItem[]; supply: EmpireGapItem[] }>(() => {
    const flows = getStationComponentGapFlows(activeStation.value?.id || null)
    const { waresMap } = gameData
    const racePref = settings.value.racePreference

    interface ItemWithName {
      id: string
      name: string
      wareId: string
      netRate: number
      netValue: number
      tier: number
      contributions?: any[]
      disableAdd: boolean
      disableRemove: boolean
    }

    const byTierThenName = (a: ItemWithName, b: ItemWithName) => {
      const tierA = Number(a.tier ?? 0)
      const tierB = Number(b.tier ?? 0)
      if (tierA !== tierB) return tierB - tierA
      const nameA = String(a.name || '')
      const nameB = String(b.name || '')
      return nameA.localeCompare(nameB, 'en')
    }

    const toItem = (flow: any): ItemWithName => {
      const module = gameData.findModuleForWare(flow.wareId, racePref)
      const plannedIndex = module ? plannedModules.value.findIndex(m => m.id === module.id) : -1
      const wareInfo = waresMap[flow.wareId]
      return {
        id: flow.wareId,
        name: wareInfo?.name || flow.wareId,
        wareId: flow.wareId,
        netRate: flow.netRate,
        netValue: flow.netValue || 0,
        tier: flow.tier ?? 0,
        contributions: flow.contributions,
        disableAdd: !module || flow.netRate > 0,
        disableRemove: !module || plannedIndex === -1
      }
    }

    const stripName = (item: ItemWithName): EmpireGapItem => ({
      id: item.id,
      wareId: item.wareId,
      netRate: item.netRate,
      netValue: item.netValue,
      tier: item.tier,
      contributions: item.contributions,
      disableAdd: item.disableAdd,
      disableRemove: item.disableRemove
    })

    return {
      operations: flows.operations
        .filter((flow: any) => flow.netRate < 0 || getResolvedLevel(flow.wareId) > 0)
        .map(toItem)
        .sort(byTierThenName)
        .map(stripName),
      supply: flows.supply
        .map(toItem)
        .filter((item: ItemWithName) => item.netRate <= 0 || !item.disableRemove)
        .sort(byTierThenName)
        .map(stripName)
    }
  })

  const workbench: ProductionWorkbenchStoreContract = {
    mode: 'live',
    capabilities,

    getTabs: () => {
      const result: any[] = []
      result.push({ id: 'overview', type: 'overview', name: '' })
      sectors.value.forEach(sector => {
        result.push({ id: `transit:${sector.id}`, type: 'transit', name: sector.name, sectorId: sector.id })
        if (expandedSectorId.value === sector.id) {
          orderedStationsBySector.value
            .filter(s => s.sectorId === sector.id)
            .forEach(s => result.push({ id: s.id, type: 'station', name: s.name, sectorId: s.sectorId ?? undefined, stationType: s.type }))
        }
      })
      orderedStationsBySector.value
        .filter(s => !s.sectorId)
        .forEach(s => result.push({ id: s.id, type: 'station', name: s.name, sectorId: undefined, stationType: s.type }))
      return result
    },
    getActiveTabId: () => activeTransitSectorId.value ? `transit:${activeTransitSectorId.value}` : activeStationId.value || 'overview',
    getExpandedSectorId: () => expandedSectorId.value,
    getWorkbenchMode: () => activeTransitSectorId.value ? 'transit' : (activeStation.value ? 'station' : 'overview'),
    getActiveStationId: () => activeStationId.value,
    getActiveTransitSectorId: () => activeTransitSectorId.value,

    getTitleModel: () => ({
      value: activeBinding.value?.bindingName || activeBindingName.value || '',
      placeholder: i18n.global.t('binding.new_binding_name')
    }),
    getToolbarStation: () => activeStation.value ? {
      id: activeStation.value.id,
      name: activeStation.value.name,
      type: activeStation.value.type || 'industrial',
      count: activeStation.value.count ?? 1,
      minerals: activeStation.value.minerals || []
    } : null,
    getToolbarSettings: () => activeStation.value ? settings.value : null,
    getToolbarRaces: () => [
      { value: 'argon', label: i18n.global.t('toolbar.races.argon') },
      { value: 'terran', label: i18n.global.t('toolbar.races.terran') },
      { value: 'teladi', label: i18n.global.t('toolbar.races.teladi') },
      { value: 'paranid', label: i18n.global.t('toolbar.races.paranid') },
      { value: 'split', label: i18n.global.t('toolbar.races.split') }
    ],
    getToolbarStationTypes: () => [
      { value: 'industrial' as StationType, label: i18n.global.t('toolbar.station_types.industrial') },
      { value: 'supply' as StationType, label: i18n.global.t('toolbar.station_types.supply') },
      { value: 'transit' as StationType, label: i18n.global.t('toolbar.station_types.transit') },
      { value: 'shipyard' as StationType, label: i18n.global.t('toolbar.station_types.shipyard') }
    ],
    getAvailableMinerals: () => ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane'],
    getSingleBerthThroughput: () => Math.max(1, settings.value.transportShipCapacity || 1) * 15,

    getPlannedModules: () => plannedModules.value,
    getAutoModules: () => activeStationState.value.autoIndustryModules,
    getAutoHabitationModules: () => activeStationState.value.autoHabitationModules,
    getAutoInfrastructureModules: () => activeStationState.value.autoInfrastructureModules,
    getEnforceDlcActivation: () => enforceDlcActivation.value,

    getWareflowViewMode: () => wareflowViewMode.value,
    getProductionFlows: () => productionFlows.value,
    getWarePriorityLevels: () => warePriorityLevels.value,
    getWareflowSettings: () => ({
      resourceBufferHours: settings.value.resourceBufferHours,
      primaryProductBufferHours: settings.value.primaryProductBufferHours,
      secondaryProductBufferHours: settings.value.secondaryProductBufferHours,
      buyMultiplier: settings.value.buyMultiplier,
      sellMultiplier: settings.value.sellMultiplier,
      racePreference: settings.value.racePreference,
      showEmpireGaps: settings.value.showEmpireGaps ?? false,
      transportMinutes: settings.value.transportMinutes
    }),
    getEmpireGaps: () => empireGapsComputed.value,

    getStationAnalysis: () => {
      const planned = plannedModules.value
      const auto = activeStationState.value.autoIndustryModules
      const allModules = [...planned, ...auto]
      if (allModules.length === 0) {
        return {
          totalCost: 0,
          totalVolume: 0,
          totalTime: 0,
          totalCapacity: 0,
          totalNeeded: 0,
          playerHQNeeded: 0,
          totalWorkerDiff: 0,
          summaryItems: [],
          moduleGroups: []
        }
      }
      return analyzeStation(
        allModules,
        gameData.modulesMap,
        gameData.waresMap,
        buildPriceMultiplier.value,
        settings.value.useHQ
      )
    },
    getDashboardSettings: () => ({
      transportShipCapacity: settings.value.transportShipCapacity,
      workforceAuto: settings.value.workforceAuto,
      manualWorkforce: settings.value.manualWorkforce,
      useHQ: settings.value.useHQ
    }),
    getCurrentEfficiency: () => currentEfficiency.value,
    getActualWorkforce: () => actualWorkforce.value,
    getBuildPriceMultiplier: () => buildPriceMultiplier.value,

    isOverview: () => !activeStation.value && !activeTransitSectorId.value,
    getProductionSource: () => 'save-binding',
    getImportActiveStationId: () => activeStationId.value,
    getImportActiveStation: () => activeStation.value ? { id: activeStation.value.id, modules: activeStation.value.modules } : null,

    selectOverview: () => selectStation(null),
    selectTransit: (sectorId: string) => selectTransitSector(sectorId),
    selectStation: (stationId: string) => selectStation(stationId),
    expandSector: (sectorId: string | null) => { expandedSectorId.value = sectorId },

    createStation: (name?: string, type?: StationType) => {
      const station = createStation(name || i18n.global.t('sector.new_station_name'), type || 'industrial')
      return station?.id || null
    },
    renameStation: (stationId: string, name: string) => renameStation(stationId, name),
    duplicateStation: () => null,
    deleteStation: (stationId: string) => deleteStation(stationId),

    updateTitle: (value: string) => { activeBindingName.value = value },
    updateStationName: (value: string) => {
      if (activeStation.value) renameStation(activeStation.value.id, value)
    },
    updateStationType: (value: StationType) => {
      if (activeStation.value) updateStationType(activeStation.value.id, value)
    },
    updateStationCount: (value: number) => {
      if (activeStation.value) updateStationCount(activeStation.value.id, value)
    },
    toggleMineral: (mineral: string) => {
      if (!activeStation.value) return
      const current = activeStation.value.minerals || []
      const newMinerals = current.includes(mineral)
        ? current.filter((m: string) => m !== mineral)
        : [...current, mineral]
      updateStationMinerals(activeStation.value.id, newMinerals)
    },
    updateSunlight: (value: number) => updateStationSettingsDirect('sunlight', value),
    updateTransportMinutes: (value: number) => updateStationSettingsDirect('transportMinutes', value),
    updateRacePreference: (value: string) => updateStationSettingsDirect('racePreference', value),
    updateWorkforce: (value: boolean) => updateStationSettingsDirect('considerWorkforceForAutoFill', value),
    updateShowEmpireGaps: (value: boolean) => updateStationSettingsDirect('showEmpireGaps', value),

    updatePlannedModules: (modules: SavedModule[]) => {
      if (activeStation.value) updateStationModules(activeStation.value.id, modules)
    },
    addModule: (moduleId: string, options?: ProductionAddModuleOptions) => {
      if (options?.source === 'gap' && options.wareId) {
        const module = gameData.findModuleForWare(options.wareId, settings.value.racePreference)
        if (module) addModule(module.id, 1)
      } else {
        addModule(moduleId, 1)
      }
    },
    removeModule: (target: ProductionRemoveModuleTarget) => {
      if ('moduleId' in target && target.source === 'gap') {
        const module = gameData.findModuleForWare(target.wareId || '', settings.value.racePreference)
        if (!module) return
        const plannedIndex = plannedModules.value.findIndex(m => m.id === module.id)
        if (plannedIndex === -1) return
        const current = plannedModules.value[plannedIndex]?.count ?? 0
        if (current <= 1) removeModule(plannedIndex)
        else updateModuleCount(plannedIndex, current - 1)
      } else {
        removeModule(target.index)
      }
    },
    updateModuleCount: (index: number, count: number) => updateModuleCount(index, count),

    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateResourceBufferHours: (value: number) => updateStationSettingsDirect('resourceBufferHours', value),
    updatePrimaryProductBufferHours: (value: number) => updateStationSettingsDirect('primaryProductBufferHours', value),
    updateSecondaryProductBufferHours: (value: number) => updateStationSettingsDirect('secondaryProductBufferHours', value),
    updateBuyMultiplier: (value: number) => updateStationSettingsDirect('buyMultiplier', value),
    updateSellMultiplier: (value: number) => updateStationSettingsDirect('sellMultiplier', value),
    toggleWareLock: (wareId: string) => toggleWareLock(wareId),
    toggleWarePriority: (wareId: string) => toggleWarePriority(wareId),

    updateTransportShipCapacity: (value: number) => updateStationSettingsDirect('transportShipCapacity', value),
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    updateManualWorkforce: (value: number) => updateStationSettingsDirect('manualWorkforce', value),
    updateWorkforceAuto: (value: boolean) => updateStationSettingsDirect('workforceAuto', value),
    updateUseHQ: (value: boolean) => updateStationSettingsDirect('useHQ', value),

    openImport: () => { importModalOpen.value = true },
    applyImportedStationPayload: (stationId: string, payload: ImportPayload) => {
      applyImportedStationPayload(stationId, payload)
    },
    updateStationModules: (stationId: string, modules: SavedModule[]) => updateStationModules(stationId, modules),
    getStationById: (stationId: string) => {
      const station = getStationById(stationId)
      return station ? { id: station.id, modules: station.modules } : null
    },

    isWareLocked: (wareId: string) => isWareLocked(wareId),
    getResolvedLevel: (wareId: string) => getResolvedLevel(wareId),
    isWareOperable: (wareId: string) => isWareOperable(wareId),
    isPlannedWare: (wareId: string) => isPlannedWare(wareId)
  }

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    session,
    activeBinding,
    activeBindingName,
    activeStation,
    activeStationId,
    activeTransitSectorId,
    transitHubSettings,
    updateTransitHubSettings,
    sectors,
    orderedStationsBySector,
    derivedBindingStations,
    stationFlowCache,
    getStationFlowCache,
    refreshStationFlowCache,
    clearStationCaches,
    syncAllBindingStationsToStateMap,
    empireGroupedFlows,
    sectorInternalDataMap,
    sectorLinkCalcMap,
    saveBinding,
    discardChanges,
    createStation,
    deleteStation,
    renameStation,
    getLinkedSectors,
    selectStation,
    selectTransitSector,
    selectOverview,
    getStationById,
    getDerivedBindingStation,
    stationContext,
    mode,
    initialMode,
    canToggle,
    toggleMode,
    updateStationSettings,
    updateStationModules,
    updateStationType,
    updateStationCount,
    updateStationMinerals,
    applyImportedStationPayload,
    renameBindingSector,
    initialize,
    openBinding,
    validateActiveStationId,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    getTransitHubViewModel,
    buildPriceMultiplier,
    playerStationRecords,
    plannedModules,
    settings,
    lockedWares,
    warePriority,
    activeStationState,
    productionFlows,
    warePriorityLevels,
    actualWorkforce,
    currentEfficiency,
    wares,
    enforceDlcActivation,
    updatePlannedModules,
    updateSetting: updateStationSettingsDirect,
    toggleWareLock,
    toggleWarePriority,
    getResolvedLevel,
    isWareLocked,
    isWareOperable,
    isPlannedWare,
    isAutoWare,
    isModuleDlcActive,
    isModuleCountEditable,
    getModuleInfo,
    addModule,
    removeModule,
    updateModuleCount,
    removeModuleById,
    transferModuleFromAutoIndustry,
    clearAll: clearAllModules,
    workbench,
    importModalOpen
  }
})
