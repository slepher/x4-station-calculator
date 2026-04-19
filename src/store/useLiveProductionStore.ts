import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  ProductionWorkbenchCapabilities,
  ProductionSessionState,
  ProductionContextState,
  ProductionStationState
} from '@/types/production-workbench-contract'
import type { SectorInternalData } from '@/types/x4'
import type { PlayerStationRecord, ArchiveStationData, BuildStorageEntry, PlayerStationEntry } from '@/types/saveArchive'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { SectorLinkCalcEntry } from './logic/empireFlowFacade'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import type { SavedModule, StationSettings, StationPlan, StationType, BindingStationPlan, TradeStationBinding, GroupedFlows, SupplyPlanningInput } from '@/types/x4'
import type { ProductionTabItem } from '@/types/production-ui'
import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { DEFAULT_STATION_SETTINGS, type StationComputeDeps } from './state/stationSettings'
import { planningDerivedMap, StationDerivedMap } from './state/StationDerivedMap'
import { buildStationSemantics, buildArchiveSemantics } from './logic/stationDerivedSemantics'
import { deepClone } from '@/utils/deepClone'
import {
  createEmpireSourceView,
  computeActiveTransitSectorId,
  toTransitTabId
} from './logic/empireSourceView'
import { createEmpireFlowFacade } from './logic/empireFlowFacade'
import { buildDerivedActiveStationState, buildDerivedTransitState } from './logic/productionStationShared'
import { toProductionStation } from './logic/liveStationResolver'
import { loadPlayerStationsFlatByArchiveId, createArchiveId } from '@/db/saveArchiveDB'
import { createProductionModuleActions } from './actions/productionModuleActions'
import { createProductionWareRuleActions } from './actions/productionWareRuleActions'
import { createProductionSettingActions, doesStationSettingsAffectFlowMap } from './actions/productionSettingActions'

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

  const liveFlowMap = new StationDerivedMap()

  function diffStationSettings(
    previous: StationSettings,
    next: StationSettings
  ): Partial<StationSettings> {
    const patch: Partial<StationSettings> = {}
    const keys = new Set<keyof StationSettings>([
      ...Object.keys(previous) as Array<keyof StationSettings>,
      ...Object.keys(next) as Array<keyof StationSettings>
    ])

    keys.forEach((key) => {
      if (previous[key] !== next[key]) {
        Object.assign(patch, { [key]: next[key] })
      }
    })

    return patch
  }

  function syncLiveFlowMap() {
    const deps = getComputeDeps()
    if (!deps) return

    derivedBindingStations.value.forEach((item) => {
      const station = item.station
      syncLiveFlowMapForStation(station.id, deps)
    })

    const stationPlans = derivedBindingStations.value
      .filter((item) => playerStationRecords.value.some((r) => r.code === item.station.id && r.type === 'station'))
      .map((item) => item.station)
    liveFlowMap.updateAggregation(stationPlans)
  }

  function syncLiveFlowMapForStation(stationId: string, deps?: StationComputeDeps): void {
    const computeDeps = deps || getComputeDeps()
    if (!computeDeps) return

    const archiveStationRecord = playerStationRecords.value.find(
      (r) => r.code === stationId && r.type === 'station'
    )
    if (!archiveStationRecord) return

    const stationEntry = archiveStationRecord.data as PlayerStationEntry
    if (!stationEntry.modules) return

    const modules: SavedModule[] = []
    const modulesByMacroId = gameData.modulesByMacroId
    for (const mod of Object.values(stationEntry.modules)) {
      const matchedModule = mod.module_id || modulesByMacroId[mod.ref]?.id
      if (matchedModule) {
        const existing = modules.find((m) => m.id === matchedModule)
        if (existing) {
          existing.count += mod.amount
        } else {
          modules.push({ id: matchedModule, count: mod.amount })
        }
      }
    }

    const station = derivedBindingStations.value.find(item => item.station.id === stationId)?.station
    const liveSettings: StationSettings = station?.settings || DEFAULT_STATION_SETTINGS

    const workforces = stationEntry.workforces
    const hasWorkforce = workforces && workforces.length > 0
    const actualWorkforceOverride = hasWorkforce
      ? workforces.reduce((sum, w) => sum + w.amount, 0)
      : 0

    liveFlowMap.compute(stationId, {
      plannedModules: modules,
      settings: liveSettings,
      lockedWares: [],
      warePriority: {},
      skipAutoFill: true,
      workforceOverride: hasWorkforce ? workforces : undefined,
      actualWorkforceOverride
    }, computeDeps)
    const semantics = buildArchiveSemantics(stationEntry, {
      modulesMap: computeDeps.modulesMap,
      modulesByMacroId: gameData.modulesByMacroId
    })
    liveFlowMap.setSemantics(stationId, semantics)
  }

  function syncAfterStationFlowChange(stationId: string, deps: StationComputeDeps): void {
    syncLiveFlowMapForStation(stationId, deps)
  }

  async function loadPlayerStationRecords() {
    const archive = selectedArchive.value
    if (!archive || !archive.isValid) {
      playerStationRecords.value = []
      return
    }
    const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
    try {
      const records = await loadPlayerStationsFlatByArchiveId(gameData, archiveId)
      playerStationRecords.value = records
    } catch (e) {
      console.error('[LiveProductionStore] Failed to load player stations:', e)
      playerStationRecords.value = []
    }
  }

  watch(selectedArchive, async () => {
    await loadPlayerStationRecords()
    syncLiveFlowMap()
  })

  const activeStationId = computed({
    get: () => activeViewStore.activeBindingStation,
    set: (id: string | null) => activeViewStore.activeBindingStation = id
  })

  const activeBindingName = computed({
    get: () => saveBindingStore.activeBindingName,
    set: (name: string) => { saveBindingStore.activeBindingName = name }
  })

  const archiveCoveredStationIds = computed<Set<string>>(() => {
    const coveredIds = new Set<string>()
    const stationCodes = new Set(
      playerStationRecords.value
        .filter((record) => record.type === 'station')
        .map((record) => record.code)
    )

    const binding = activeBinding.value
    if (!binding) {
      stationCodes.forEach((code) => coveredIds.add(code))
      return coveredIds
    }

    const matchedCodes = new Set<string>()

    binding.stationPlans.forEach((plan) => {
      const archiveCode = plan.saveStationCode || plan.id
      if (stationCodes.has(archiveCode)) {
        coveredIds.add(plan.id)
        matchedCodes.add(archiveCode)
      }
    })

    stationCodes.forEach((code) => {
      if (!matchedCodes.has(code)) {
        coveredIds.add(code)
      }
    })

    return coveredIds
  })

  const planningSourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sectorsMap: computed(() => gameData.maps.sectors),
    visibleStationIds: ref(null)
  })

  const liveSourceView = createEmpireSourceView({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    playerStationRecords,
    sectorsMap: computed(() => gameData.maps.sectors),
    visibleStationIds: archiveCoveredStationIds
  })

  const sectors = planningSourceView.sectors
  const orderedStationsBySector = planningSourceView.orderedStationsBySector
  const derivedBindingStations = planningSourceView.derivedBindingStations

  const planningFlowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    sourceView: planningSourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap)
  })

  const liveFlowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    sourceView: liveSourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    flowMap: liveFlowMap
  })

  const flowFacade = planningFlowFacade

  const stationFlowCache = flowFacade.stationFlowCache
  const empireGroupedFlows = flowFacade.empireGroupedFlows
  const sectorInternalDataMap = flowFacade.sectorInternalDataMap
  const sectorLinkCalcMap = flowFacade.sectorLinkCalcMap

  const activeTransitSectorId = computed(() => computeActiveTransitSectorId(
    activeStationId.value,
    sectors.value
  ))

  function getDerivedBindingStation(stationId: string): StationPlan | null {
    return planningSourceView.getDerivedBindingStation(stationId)
  }

  function getStationById(stationId: string): StationPlan | null {
    return planningSourceView.getStationById(stationId)
  }

  function getLinkedSectors(sectorId: string): string[] {
    const group = activeBinding.value?.groups.find(g => g.id === sectorId)
    if (!group) return []
    return group.connectedGroupIds || []
  }

  const workbenchMode = computed<'station' | 'transit' | 'overview'>(() => {
    return activeTransitSectorId.value ? 'transit' : (activeStationId.value ? 'station' : 'overview')
  })

  const bindingStation = computed<BindingStationPlan | TradeStationBinding | null>(() => {
    const mode = workbenchMode.value
    
    if (mode === 'station') {
      const stationId = activeStationId.value
      if (!stationId) return null
      
      const binding = activeBinding.value
      if (!binding) return null
      
      return binding.stationPlans.find(plan => plan.id === stationId) || null
    }
    
    if (mode === 'transit') {
      const sectorId = activeTransitSectorId.value
      if (!sectorId) return null
      
      const binding = activeBinding.value
      if (!binding) return null
      
      const group = binding.groups.find(g => g.id === sectorId)
      return group?.tradeStation || null
    }
    
    return null
  })

  const archiveStation = computed<ArchiveStationData | null>(() => {
    const mode = workbenchMode.value
    const binding = activeBinding.value
    if (!binding) return null
    
    let code: string | undefined
    
    if (mode === 'station') {
      const stationId = activeStationId.value
      if (!stationId) return null
      
      const plan = binding.stationPlans.find(plan => plan.id === stationId)
      code = plan?.saveStationCode || stationId
    }
    
    if (mode === 'transit') {
      const sectorId = activeTransitSectorId.value
      if (!sectorId) return null
      
      const group = binding.groups.find(g => g.id === sectorId)
      code = group?.tradeStation?.saveStationCode
    }
    
    if (!code) return null
    
    const record = playerStationRecords.value.find(r => r.code === code && r.type === 'station')
    if (!record) return null
    
    const stationEntry = record.data as PlayerStationEntry
    const sectorMacro = record.sectorMacro
    
    const sector = gameData.maps?.sectors?.[sectorMacro]
    const sectorData = {
      name: sector?.name || sectorMacro,
      nameId: sector?.nameId,
      resources: (sector?.resources || []).map(r => r.ware),
      sunlight: Math.round((sector?.area?.sunlight ?? 1) * 100)
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
          for (const mod of Object.values(buildstorageEntry.modules)) {
            const matchedModule = mod.module_id || modulesByMacroId[mod.ref]?.id
            if (matchedModule) {
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

  const stationContext = computed(() => {
    const binding = bindingStation.value
    const archive = archiveStation.value
    
    const hasBinding = binding !== null
    const hasArchive = archive !== null
    const stationCode = archive?.code || ''
    
    let sectorName = ''
    let sectorNameId: string | undefined
    let sectorResources: string[] = []
    let sectorSunlight = 100
    let position: { x: number; y: number; z: number } | undefined
    
    if (archive) {
      sectorName = archive.sector?.name || ''
      sectorNameId = archive.sector?.nameId
      sectorResources = archive.sector?.resources || []
      sectorSunlight = archive.sector?.sunlight ?? 100
      position = archive.position
    } else if (binding) {
      const sectorMacro = binding.sectorMacro
      if (sectorMacro) {
        const sectorData = gameData.maps.sectors[sectorMacro]
        if (sectorData) {
          sectorName = sectorData.name || ''
          sectorNameId = sectorData.nameId
          sectorResources = (sectorData.resources || []).map(r => r.ware)
          sectorSunlight = Math.round((sectorData.area?.sunlight ?? 1) * 100)
        }
      }
      position = binding.position
    }
    
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

  const mode = ref<'live' | 'planning'>('planning')

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

  const visualMode = computed<'planning' | 'live'>(() => {
    if (mode.value === 'planning') return 'planning'
    return stationContext.value?.hasArchive ? 'live' : 'planning'
  })

  function toggleMode() {
    mode.value = mode.value === 'live' ? 'planning' : 'live'
  }

  watch(activeStationId, () => {
    if (activeStationId.value) {
      mode.value = initialMode.value
    }
  })

  const activeStation = computed<StationPlan | null>(() => {
    const mode = workbenchMode.value
    
    if (mode === 'transit') {
      const sectorId = activeTransitSectorId.value
      if (!sectorId) return null
      const group = activeBinding.value?.groups.find(g => g.id === sectorId)
      const tradeStation = group?.tradeStation
      if (!tradeStation) return null
      return {
        id: tradeStation.id,
        name: tradeStation.name || tradeStation.saveStationCode || 'Transit Hub',
        type: 'transit',
        modules: [],
        settings: ({ ...DEFAULT_STATION_SETTINGS, ...tradeStation.settings || {} }),
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
    }
    
    if (mode === 'station') {
      const binding = bindingStation.value
      if (binding && 'modules' in binding) {
        return toProductionStation(binding as BindingStationPlan, gameData.maps.sectors)
      }
      const archive = archiveStation.value
      if (archive) {
        return {
          id: archive.code,
          name: archive.code,
          type: 'industrial',
          modules: [],
          settings: { ...DEFAULT_STATION_SETTINGS, sunlight: archive.sector?.sunlight ?? 100 },
          lastUpdated: 0,
          lockedWares: [],
          warePriority: {}
        }
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
      station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...station.settings })
      planningDerivedMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: station.settings,
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
      const semantics = buildStationSemantics(station, {
        modulesMap: deps.modulesMap,
        modulesByMacroId: gameData.modulesByMacroId
      })
      planningDerivedMap.setSemantics(station.id, semantics)
    })

    const stationPlans = stations.map(item => item.station)
    planningDerivedMap.updateAggregation(stationPlans)
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
        planningDerivedMap.compute(station.id, {
          plannedModules: station.modules,
          settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority || {}
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        syncAfterStationFlowChange(station.id, deps)
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
        planningDerivedMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
          lockedWares: station.lockedWares,
          warePriority: station.warePriority || {}
        }, deps)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        syncAfterStationFlowChange(station.id, deps)
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
        planningDerivedMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
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
      if (workbenchMode.value === 'transit') {
        const sectorId = activeTransitSectorId.value
        if (!sectorId) return
        const group = activeBinding.value?.groups.find(g => g.id === sectorId)
        if (!group?.tradeStation) return
        group.tradeStation.settings = { ...DEFAULT_STATION_SETTINGS, ...value }
        saveBindingStore.updateGroup(activeBinding.value?.gameGuid || '', sectorId, { tradeStation: group.tradeStation })
        return
      }
      const station = activeStation.value
      if (!station) return
      const previousSettings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
      station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...value })
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      if (deps) {
        const changedSettings = diffStationSettings(previousSettings, station.settings)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        if (doesStationSettingsAffectFlowMap(changedSettings)) {
          planningDerivedMap.compute(station.id, {
            plannedModules: station.modules || [],
            settings: station.settings,
            lockedWares: station.lockedWares || [],
            warePriority: station.warePriority || {}
          }, deps)
          syncAfterStationFlowChange(station.id, deps)
        }
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

    const currentMode = mode.value
    const flowMapToUse = currentMode === 'live' ? liveFlowMap : planningDerivedMap
    const cache = flowMapToUse.getCache(stationId)

    if (currentMode === 'live') {
      const archiveModules: SavedModule[] = archiveStation.value?.modules || []
      return {
        actualWorkforce: cache?.actualWorkforce || 0,
        currentEfficiency: cache?.currentEfficiency || 0,
        warePriorityLevels: {},
        productionFlows: flowMapToUse.getProductionFlows(stationId),
        plannedModules: archiveModules,
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: archiveModules
      }
    }

    const planned = plannedModules.value
    return buildDerivedActiveStationState({
      stationId,
      plannedModules: planned,
      settings: settings.value,
      cache,
      deps: getComputeDeps()
    })
  })

  const actualWorkforce = computed(() => activeStationState.value.actualWorkforce)
  const currentEfficiency = computed(() => activeStationState.value.currentEfficiency)

  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  const moduleActions = createProductionModuleActions<StationPlan>({
    getActiveStation: () => activeStation.value,
    getComputeDeps,
    findModuleForWare: (wareId, racePreference) => gameData.findModuleForWare(wareId, racePreference),
    getRacePreference: () => settings.value.racePreference,
    getModulesMap: () => gameData.modulesMap,
    isModuleCountEditable,
    getPlannedModules: () => plannedModules.value,
    getAutoIndustryModules: () => activeStationState.value.autoIndustryModules,
    cloneModules: (modules) => deepClone(modules),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recomputeDerived: (station, _deps) => {
      const semantics = buildStationSemantics(station, {
        modulesMap: gameData.modulesMap,
        modulesByMacroId: gameData.modulesByMacroId
      })
      planningDerivedMap.setSemantics(station.id, semantics)
    },
    afterCommit: (station, deps) => {
      syncAfterStationFlowChange(station.id, deps)
    }
  })

  const wareRuleActions = createProductionWareRuleActions<StationPlan>({
    getActiveStation: () => activeStation.value,
    getComputeDeps,
    getPlannedModules: () => plannedModules.value,
    getAutoIndustryModules: () => activeStationState.value.autoIndustryModules,
    getModulesMap: () => gameData.modulesMap,
    getWaresMap: () => gameData.waresMap,
    getLockedWares: () => lockedWares.value,
    getWarePriority: () => warePriority.value,
    cloneStringList: (values) => deepClone(values),
    clonePriorityMap: (values) => deepClone(values),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recompute: (station, deps) => {
      planningDerivedMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
    },
    afterCommit: (station, deps) => {
      syncAfterStationFlowChange(station.id, deps)
    }
  })

  watch(
    () => gameData.isReady,
    (newReady, oldReady) => {
      if (newReady && !oldReady && activeBinding.value) {
        syncAllBindingStationsToStateMap()
      }
    }
  )

  watch(
    () => gameData.enforceDlcActivation,
    () => {
      if (!activeBinding.value) return
      const deps = getComputeDeps()
      if (!deps) return
      derivedBindingStations.value.forEach(item => {
        const station = item.station
        planningDerivedMap.compute(station.id, {
          plannedModules: station.modules || [],
          settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
          lockedWares: station.lockedWares || [],
          warePriority: station.warePriority || {}
        }, deps)
        const semantics = buildStationSemantics(station, {
          modulesMap: deps.modulesMap,
          modulesByMacroId: gameData.modulesByMacroId
        })
        planningDerivedMap.setSemantics(station.id, semantics)
      })
      const stationPlans = derivedBindingStations.value.map(item => item.station)
      planningDerivedMap.updateAggregation(stationPlans)
    }
  )

  function refreshStationFlowCache(stationId: string) {
    const station = getStationById(stationId)
    if (!station) return
    const deps = getComputeDeps()
    if (!deps) return
    planningDerivedMap.compute(stationId, {
      plannedModules: station.modules || [],
      settings: ({ ...DEFAULT_STATION_SETTINGS, ...station.settings }),
      lockedWares: station.lockedWares || [],
      warePriority: station.warePriority || {}
    }, deps)
    syncAfterStationFlowChange(stationId, deps)
  }

  function getStationFlowCache(stationId: string): GroupedFlows | null {
    const flowMapToUse = mode.value === 'live' ? liveFlowMap : planningDerivedMap
    const cache = flowMapToUse.getCache(stationId)
    if (!cache) return null
    return flowMapToUse.getFilteredGrouped(stationId, cache.warePriorityLevels)
  }

  function clearStationCaches() {
    planningDerivedMap.clear()
    liveFlowMap.clear()
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

  function updateBindingStationPlan(
    stationId: string,
    patch: Partial<Pick<StationPlan, 'name' | 'type' | 'modules' | 'settings' | 'sectorId' | 'lockedWares' | 'warePriority'>>
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
      planningDerivedMap.remove(stationId)
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

  function updateStationModules(stationId: string, modules: SavedModule[]) {
    updateBindingStationPlan(stationId, { modules })
    refreshStationFlowCache(stationId)
  }

  function updateStationType(stationId: string, type: StationType) {
    updateBindingStationPlan(stationId, { type })
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
      await saveStore.initialize()
      await loadPlayerStationRecords()

      saveBindingStore.initialize()

      const storedGuid = activeViewStore.activeBinding
      if (storedGuid) {
        const bindingExists = saveBindingStore.savedBindings.list.some((b) => b.gameGuid === storedGuid)
        const archiveGroup = saveStore.archives.get(storedGuid)
        const hasValidArchive = archiveGroup?.saves.some(s => s.isValid) ?? false
        
        if (bindingExists && hasValidArchive) {
          openBinding(storedGuid)
          syncAllBindingStationsToStateMap()
          syncLiveFlowMap()
          validateActiveStationId()
          isReady.value = true
          console.log('[LiveProductionStore] Loaded saved binding')
          return
        }
        
        console.log('[LiveProductionStore] Saved binding invalid, trying fallback')
      }

      // Fallback to first valid binding
      const validBinding = saveBindingStore.savedBindings.list.find((b) => {
        const archiveGroup = saveStore.archives.get(b.gameGuid)
        return archiveGroup?.saves.some(s => s.isValid) ?? false
      })
      
      if (validBinding) {
        activeViewStore.activeBinding = validBinding.gameGuid
        openBinding(validBinding.gameGuid)
        syncAllBindingStationsToStateMap()
        syncLiveFlowMap()
        validateActiveStationId()
        isReady.value = true
        console.log('[LiveProductionStore] Fallback to first valid binding:', validBinding.gameGuid)
        return
      }

      // No valid binding found
      activeViewStore.activeBinding = null
      activeViewStore.activeBindingStation = null
      console.log('[LiveProductionStore] No valid bindings found, cleared')
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
        .filter((flow: any) => flow.netRate < 0 || wareRuleActions.getResolvedLevel(flow.wareId) > 0)
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

  const session = computed<ProductionSessionState>(() => ({
    workbenchMode: workbenchMode.value,
    entityType: workbenchMode.value,
    mode: mode.value,
    visualMode: visualMode.value,
    activeStationId: activeStationId.value,
    activeTransitSectorId: activeTransitSectorId.value,
    activeBinding: activeBinding.value?.gameGuid || null,
    canToggle: workbenchMode.value === 'transit' ? true : canToggle.value
  }))

  const context = computed<ProductionContextState>(() => {
    const ctx = stationContext.value
    return {
      stationCode: ctx?.stationCode || '',
      sectorId: activeTransitSectorId.value || activeStation.value?.sectorId || null,
      sectorName: ctx?.sectorName || '',
      sectorNameId: ctx?.sectorNameId,
      position: ctx?.position,
      sectorResources: ctx?.sectorResources || [],
      sectorSunlight: ctx?.sectorSunlight ?? 100,
      hasBinding: ctx?.hasBinding ?? false,
      hasArchive: ctx?.hasArchive ?? false,
      archiveModules: ctx?.archiveModules || [],
      buildingModules: ctx?.buildingModules || []
    }
  })

  const stationState = computed<ProductionStationState | null>(() => {
    const wm = workbenchMode.value
    if (wm === 'overview') return null
    
    if (wm === 'transit') {
      const sectorId = activeTransitSectorId.value
      if (!sectorId) return null
      const planningFlows = planningFlowFacade.getSectorFinalProductionFlows(sectorId)
      const flows = mode.value === 'live' 
        ? liveFlowFacade.getSectorFinalProductionFlows(sectorId)
        : planningFlows
      const derivedTransitState = buildDerivedTransitState({
        productionFlows: planningFlows,
        settings: settings.value,
        deps: getComputeDeps()
      })
      return {
        entityType: 'transit',
        id: sectorId,
        name: sectors.value.find(s => s.id === sectorId)?.name || sectorId,
        plannedModules: [],
        resolvedModules: derivedTransitState.resolvedModules,
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: derivedTransitState.autoInfrastructureModules,
        productionFlows: flows,
warePriorityLevels: {},
      settings: settings.value
    }
  }
    
    const station = activeStation.value
    if (!station) return null
    const state = activeStationState.value
    return {
      entityType: 'station',
      id: station.id,
      name: station.name,
      plannedModules: state.plannedModules,
      resolvedModules: state.resolvedModules,
      autoIndustryModules: state.autoIndustryModules,
      autoHabitationModules: state.autoHabitationModules,
      autoInfrastructureModules: state.autoInfrastructureModules,
      productionFlows: state.productionFlows,
      warePriorityLevels: state.warePriorityLevels,
      settings: settings.value
    }
  })

  const getTabs = () => {
    const result: ProductionTabItem[] = []
    result.push({ id: 'overview', type: 'overview', name: i18n.global.t('sector.overview') })
    
    const stationPlansByCode = new Map<string, BindingStationPlan>()
    const stationPlansById = new Map<string, BindingStationPlan>()
    activeBinding.value?.stationPlans.forEach(plan => {
      if (plan.saveStationCode) {
        stationPlansByCode.set(plan.saveStationCode, plan)
      }
      stationPlansById.set(plan.id, plan)
    })
    
    sectors.value.forEach(sector => {
      result.push({ id: `transit:${sector.id}`, type: 'transit', name: sector.name, sectorId: sector.id })
      if (expandedSectorId.value === sector.id) {
        orderedStationsBySector.value
          .filter(s => s.sectorId === sector.id)
          .forEach(s => {
            const matchingPlan = stationPlansByCode.get(s.id) || stationPlansById.get(s.id)
            const hasPlan = Boolean(matchingPlan)
            
            if (hasPlan) {
              const cache = planningDerivedMap.getCache(s.id)
              const semantics = cache?.semantics
              const name = matchingPlan?.name || s.name || s.id
              result.push({
                id: s.id,
                type: 'station',
                name,
                sectorId: s.sectorId ?? undefined,
                stationType: s.type,
                tag: semantics?.tag,
                factoryGroup: semantics?.factoryGroup
              })
            } else {
              const cache = liveFlowMap.getCache(s.id)
              const semantics = cache?.semantics
              const name = s.name || s.id
              result.push({
                id: s.id,
                type: 'station',
                name,
                sectorId: s.sectorId ?? undefined,
                stationType: s.type,
                tag: semantics?.tag || 'constructionsite',
                factoryGroup: semantics?.factoryGroup
              })
            }
          })
      }
    })
    orderedStationsBySector.value
      .filter(s => !s.sectorId)
      .forEach(s => {
        const matchingPlan = stationPlansByCode.get(s.id) || stationPlansById.get(s.id)
        const hasPlan = Boolean(matchingPlan)
        
        if (hasPlan) {
          const cache = planningDerivedMap.getCache(s.id)
          const semantics = cache?.semantics
          const name = matchingPlan?.name || s.name || s.id
          result.push({
            id: s.id,
            type: 'station',
            name,
            sectorId: undefined,
            stationType: s.type,
            tag: semantics?.tag,
            factoryGroup: semantics?.factoryGroup
          })
        } else {
          const cache = liveFlowMap.getCache(s.id)
          const semantics = cache?.semantics
          const name = s.name || s.id
          result.push({ id: s.id, type: 'station', name, sectorId: undefined, stationType: s.type, tag: semantics?.tag || 'constructionsite', factoryGroup: semantics?.factoryGroup })
        }
      })
    return result
  }

  const getActiveTabId = () => activeTransitSectorId.value ? `transit:${activeTransitSectorId.value}` : activeStationId.value || 'overview'
  const getExpandedSectorId = () => expandedSectorId.value
  const getTitleModel = () => ({
    value: activeBinding.value?.bindingName || activeBindingName.value || '',
    placeholder: i18n.global.t('binding.new_binding_name')
  })
  const getToolbarStation = () => activeStation.value ? {
    id: activeStation.value.id,
    name: activeStation.value.name,
    type: activeStation.value.type || 'industrial',
    count: activeStation.value.count ?? 1,
    minerals: activeStation.value.minerals || []
  } : null
  const getToolbarRaces = () => [
    { value: 'argon', label: i18n.global.t('toolbar.races.argon') },
    { value: 'terran', label: i18n.global.t('toolbar.races.terran') },
    { value: 'teladi', label: i18n.global.t('toolbar.races.teladi') },
    { value: 'paranid', label: i18n.global.t('toolbar.races.paranid') },
    { value: 'split', label: i18n.global.t('toolbar.races.split') }
  ]
  const getToolbarStationTypes = () => [
    { value: 'industrial' as StationType, label: i18n.global.t('toolbar.station_types.industrial') },
    { value: 'supply' as StationType, label: i18n.global.t('toolbar.station_types.supply') },
    { value: 'transit' as StationType, label: i18n.global.t('toolbar.station_types.transit') },
    { value: 'shipyard' as StationType, label: i18n.global.t('toolbar.station_types.shipyard') }
  ]
  const getAvailableMinerals = () => ['Ore', 'Silicon', 'Ice', 'Hydrogen', 'Helium', 'Methane']
  const getSingleBerthThroughput = () => Math.max(1, settings.value.transportShipCapacity || 1) * 15
  const getEnforceDlcActivation = () => enforceDlcActivation.value
  const getWareflowViewMode = () => wareflowViewMode.value
  const getEmpireGaps = () => empireGapsComputed.value
  const getCurrentEfficiency = () => workbenchMode.value === 'transit' ? 0 : currentEfficiency.value
  const getActualWorkforce = () => workbenchMode.value === 'transit' ? 0 : actualWorkforce.value
  const getBuildPriceMultiplier = () => buildPriceMultiplier.value
  const selectOverviewAction = () => selectStation(null)
  const selectTransit = (sectorId: string) => selectTransitSector(sectorId)
  const expandSector = (sectorId: string | null) => { expandedSectorId.value = sectorId }
  const updateTitle = (value: string) => { activeBindingName.value = value }
  const updateStationNameFromActive = (value: string) => {
    if (activeStation.value) renameStation(activeStation.value.id, value)
  }
  const updateStationTypeFromActive = (value: StationType) => {
    if (activeStation.value) updateStationType(activeStation.value.id, value)
  }
  const settingActions = createProductionSettingActions<StationPlan>({
    getActiveStation: () => activeStation.value,
    getComputeDeps,
    mergeSettings: (base, patch) => ({ ...DEFAULT_STATION_SETTINGS, ...{ ...base, ...patch } }),
    now: () => Date.now(),
    commitStationMutation: (station) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) {
        const sectorId = activeTransitSectorId.value
        if (!sectorId) return
        const group = activeBinding.value?.groups.find(g => g.id === sectorId)
        if (!group?.tradeStation) return
        group.tradeStation.settings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
        saveBindingStore.updateGroup(activeBinding.value?.gameGuid || '', sectorId, { tradeStation: group.tradeStation })
        return
      }
      updateBindingStationPlan(station.id, {
        modules: station.modules,
        lockedWares: station.lockedWares,
        warePriority: station.warePriority,
        settings: station.settings
      })
    },
    recompute: (station, deps) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) {
        return
      }
      planningDerivedMap.compute(station.id, {
        plannedModules: station.modules || [],
        settings: station.settings,
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      }, deps)
    },
    shouldRecompute: (station, patch) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      if (station.id === tradeStationId) return true
      return doesStationSettingsAffectFlowMap(patch)
    },
    afterRecompute: (station, deps) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) return
      syncAfterStationFlowChange(station.id, deps)
    },
    afterCommit: (station, _deps, patch) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id

      if (station.id === tradeStationId) return
      if (!doesStationSettingsAffectFlowMap(patch)) {
        return
      }
    }
  })

  return {
    isReady,
    isDirty,
    isEmptyForSave,
    activeBinding,
    activeBindingName,
    activeStation,
    activeStationId,
    activeTransitSectorId,
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
    getStationById,
    getDerivedBindingStation,
    mode,
    initialMode,
    canToggle,
    toggleMode,
    updateStationModules,
    applyImportedStationPayload,
    renameBindingSector,
    initialize,
    openBinding,
    validateActiveStationId,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorLinkCalc,
    getStationComponentGapFlows,
    playerStationRecords,
    importModalOpen,
    planningFlowFacade,
    liveFlowFacade,
    planningSourceView,
    liveSourceView,

    session,
    context,
    stationState,
    capabilities,
    settingActions,
    wareRuleActions,
    moduleActions,
    getTabs,
    getActiveTabId,
    getExpandedSectorId,
    getTitleModel,
    getToolbarStation,
    getToolbarRaces,
    getToolbarStationTypes,
    getAvailableMinerals,
    getSingleBerthThroughput,
    getEnforceDlcActivation,
    getWareflowViewMode,
    getEmpireGaps,
    getCurrentEfficiency,
    getActualWorkforce,
    getBuildPriceMultiplier,
    updateTitle,
    updateStationName: updateStationNameFromActive,
    updateStationType: updateStationTypeFromActive,
    openImport: () => { importModalOpen.value = true },
    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    expandSector,
    duplicateStation: () => null,
    selectOverview: selectOverviewAction,
    selectTransit,
    selectStation
  }
})
