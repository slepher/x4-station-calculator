import { defineStore, storeToRefs } from 'pinia'
import { ref, computed, watch, shallowRef } from 'vue'
import type {
  ProductionWorkbenchCapabilities,
  ProductionSessionState,
  ProductionContextState,
  ProductionStationState
} from '@/types/production-workbench-contract'
import type { SectorInternalData } from '@/types/x4'
import type { PlayerStationRecord, ArchiveStationData, BuildStorageEntry, PlayerStationEntry } from '@/types/saveArchive'
import type { WareFlowViewMode, EmpireGapItem } from '@/types/production-ui'
import type { StationComponentGapFlows } from './logic/stationGapViewModel'
import type { SavedModule, StationSettings, StationPlan, StationType, BindingStationPlan, TradeStationBinding, GroupedFlows, SupplyPlanningInput } from '@/types/x4'
import i18n from '@/i18n'
import { useGameDataStore } from './useGameDataStore'
import { useSaveBindingStore } from './useSaveBindingStore'
import { useSaveStore } from './useSaveStore'
import { useActiveViewStore } from './useActiveViewStore'
import { DEFAULT_STATION_SETTINGS, type StationComputeDeps } from './state/stationSettings'
import { StationDerivedMap, type StationDerivedStaticDeps } from './state/StationDerivedMap'
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
  type DirtyBindingState = 'all' | Set<string> | null

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

  const planningDerivedMap = shallowRef<StationDerivedMap | null>(null)
  const liveFlowMap = shallowRef<StationDerivedMap | null>(null)
  const dirtyBindingStationIds = ref<DirtyBindingState>(null)
  const gapRefreshKey = ref(0)

  function computeDirtyStation(stationId: string) {
    const dirty = dirtyBindingStationIds.value
    if (dirty === null) return
    if (dirty === 'all' || dirty.has(stationId)) {
      const deps = getDerivedStaticDeps()
      if (deps) syncLiveFlowMapForStation(stationId, deps)
      if (dirty !== 'all') {
        dirty.delete(stationId)
        if (dirty.size === 0) {
          dirtyBindingStationIds.value = null
          gapRefreshKey.value++
        }
      }
    }
  }

  function flushAllDirtyStations() {
    const dirty = dirtyBindingStationIds.value
    if (dirty === null) return
    if (dirty === 'all') {
      syncLiveFlowMap()
    } else {
      const deps = getDerivedStaticDeps()
      dirty.forEach((stationId) => {
        if (deps) syncLiveFlowMapForStation(stationId, deps)
      })
    }
    dirtyBindingStationIds.value = null
    gapRefreshKey.value++
  }

  function markAllDirty() {
    dirtyBindingStationIds.value = 'all'
  }

  function markStationDirty(stationId: string) {
    const dirty = dirtyBindingStationIds.value
    if (dirty === 'all') return
    if (dirty === null) {
      dirtyBindingStationIds.value = new Set([stationId])
    } else {
      dirty.add(stationId)
    }
  }

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

  function createDerivedMap(): StationDerivedMap | null {
    const deps = getDerivedStaticDeps()
    if (!deps) return null
    const sourceView = planningSourceView
    const sectorLinks = sourceView?.productionSectorLinks?.value ?? []
    return new StationDerivedMap(deps, {
      hasSector: true,
      sectorLinks
    })
  }

  function ensurePlanningDerivedMap(): StationDerivedMap | null {
    if (planningDerivedMap.value) return planningDerivedMap.value
    const map = createDerivedMap()
    if (!map) return null
    planningDerivedMap.value = map
    return map
  }

  function ensureLiveDerivedMap(): StationDerivedMap | null {
    if (liveFlowMap.value) return liveFlowMap.value
    const map = createDerivedMap()
    if (!map) return null
    liveFlowMap.value = map
    return map
  }

  function resetPlanningDerivedMap(): StationDerivedMap | null {
    const map = createDerivedMap()
    planningDerivedMap.value = map
    return map
  }

  function resetLiveDerivedMap(): StationDerivedMap | null {
    const map = createDerivedMap()
    liveFlowMap.value = map
    return map
  }

  function syncLiveFlowMap() {
    const deps = getComputeDeps()
    const map = resetLiveDerivedMap()
    if (!deps || !map) return

    derivedBindingStations.value.forEach((item) => {
      const station = item.station
      syncLiveFlowMapForStation(station.id, deps)
    })
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
    for (const mod of Object.values(stationEntry.modules)) {
      const matchedModule = mod.module_id
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

    const map = ensureLiveDerivedMap()
    if (!map) return
    map.upsertStation(stationId, {
      modulesMode: 'full',
      sectorId: station?.sectorId,
      modules,
      settings: liveSettings,
      lockedWares: [],
      warePriority: {},
      workforces: hasWorkforce ? workforces : undefined,
      archiveSemanticsSource: {
        tag: stationEntry.tag,
        factoryGroup: stationEntry.factoryGroup,
        productionProfile: stationEntry.productionProfile,
        profileName: stationEntry.profileName
      }
    })
  }

  function syncAfterStationFlowChange(stationId: string, _deps: StationComputeDeps): void {
    markStationDirty(stationId)
  }

  async function loadPlayerStationRecords() {
    const archive = selectedArchive.value
    const binding = activeBinding.value
    if (!archive || !archive.isValid || !binding || archive.meta.guid !== binding.gameGuid) {
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
    const archive = selectedArchive.value
    const binding = activeBinding.value
    if (!archive || !binding || archive.meta.guid !== binding.gameGuid) return
    if (binding.selectedArchiveTime) return
    await loadPlayerStationRecords()
    syncLiveFlowMap()
  })

  watch(
    () => saveStore.savedArchivesState.list.length,
    async (newLen, oldLen) => {
      if (newLen >= oldLen) return
      const binding = activeBinding.value
      if (!binding) return

      const archiveGroup = saveStore.archives.get(binding.gameGuid)
      const hasValidArchive = archiveGroup?.saves.some(s => s.isValid) ?? false

      if (!hasValidArchive) {
        activeViewStore.activeBinding = null
        activeViewStore.activeBindingStation = null
        saveBindingStore.clearDraft()
        playerStationRecords.value = []
        planningDerivedMap.value?.clear()
        liveFlowMap.value?.clear()
        dirtyBindingStationIds.value = null
      } else {
        const bindingRecord = saveBindingStore.getBindingByGameGuid(binding.gameGuid)
        if (bindingRecord) {
          const currentTime = bindingRecord.selectedArchiveTime
          const archiveStillValid = currentTime !== null
            ? archiveGroup!.saves.some(s => s.meta.time === currentTime && s.isValid)
            : false
          if (!archiveStillValid && currentTime !== null) {
            const latest = [...archiveGroup!.saves].sort((a, b) => b.meta.time - a.meta.time).find(s => s.isValid)
            if (latest) {
              saveBindingStore.setSelectedArchiveTime(binding.gameGuid, latest.meta.time)
            }
          }
        }
        await activateBinding(binding.gameGuid)
      }
    }
  )

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
    waresMap: computed(() => gameData.waresMap),
    flowMap: computed(() => planningDerivedMap.value)
  })

  const liveFlowFacade = createEmpireFlowFacade({
    productionSource,
    activeEmpire: ref(null),
    activeBinding,
    sourceView: liveSourceView,
    modulesMap: computed(() => gameData.modulesMap),
    waresMap: computed(() => gameData.waresMap),
    flowMap: computed(() => liveFlowMap.value)
  })

  const flowFacade = planningFlowFacade

  const stationFlowCache = computed(() => {
    if (dirtyBindingStationIds.value !== null) flushAllDirtyStations()
    return flowFacade.stationFlowCache.value
  })
  const empireGroupedFlows = computed(() => {
    if (dirtyBindingStationIds.value !== null) flushAllDirtyStations()
    return flowFacade.empireGroupedFlows.value
  })
  const sectorInternalDataMap = computed(() => {
    if (dirtyBindingStationIds.value !== null) flushAllDirtyStations()
    return flowFacade.sectorInternalDataMap.value
  })
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

  const activeBindingStationId = computed(() => activeTransitSectorId.value ? null : activeStationId.value)

  const bindingStationPlan = computed<BindingStationPlan | null>(() => {
    const stationId = activeBindingStationId.value
    if (!stationId) return null
    const binding = activeBinding.value
    if (!binding) return null
    return binding.stationPlans.find(plan => plan.id === stationId) || null
  })

  const bindingTransitGroup = computed(() => {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) return null
    const binding = activeBinding.value
    if (!binding) return null
    return binding.groups.find(g => g.id === sectorId) || null
  })

  const bindingStation = computed<BindingStationPlan | TradeStationBinding | null>(() => {
    return bindingStationPlan.value || bindingTransitGroup.value?.tradeStation || null
  })

  const planningStationDraft = computed<StationPlan | null>(() => {
    const stationId = activeBindingStationId.value
    if (!stationId) return null
    const plan = bindingStationPlan.value
    if (plan) {
      return toProductionStation(plan, gameData.maps.sectors)
    }
    const derived = planningSourceView.getDerivedBindingStation(stationId)
    const archive = archiveStation.value
    if (!derived && !archive) return null
    return {
      id: stationId,
      name: derived?.name || archive?.name || stationId,
      sectorId: derived?.sectorId,
      type: derived?.type || 'industrial',
      count: derived?.count,
      location: derived?.location,
      modules: [],
      settings: {
        ...DEFAULT_STATION_SETTINGS,
        ...derived?.settings
      },
      lastUpdated: derived?.lastUpdated || 0,
      lockedWares: [],
      warePriority: {},
      minerals: derived?.minerals || []
    }
  })

  const editableStationPlan = computed<StationPlan | null>(() => {
    if (workbenchMode.value !== 'station') return null
    return planningStationDraft.value
  })

  const archiveStationCode = computed<string | null>(() => {
    const binding = bindingStation.value
    if (binding?.saveStationCode) return binding.saveStationCode
    const stationId = activeBindingStationId.value
    return stationId || null
  })

  const archiveStation = computed<ArchiveStationData | null>(() => {
    const code = archiveStationCode.value
    if (!code || !activeBinding.value) return null

    const archive = selectedArchive.value
    if (!archive || archive.meta.guid !== activeBinding.value.gameGuid) return null

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
      for (const mod of Object.values(stationEntry.modules)) {
        const matchedModule = mod.module_id
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
          for (const mod of Object.values(buildstorageEntry.modules)) {
            const matchedModule = mod.module_id
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
          workforces: stationEntry.workforces,
          tag: stationEntry.tag,
          factoryGroup: stationEntry.factoryGroup,
          productionProfile: stationEntry.productionProfile,
          profileName: stationEntry.profileName,
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
      workforces: stationEntry.workforces,
      tag: stationEntry.tag,
      factoryGroup: stationEntry.factoryGroup,
      productionProfile: stationEntry.productionProfile,
      profileName: stationEntry.profileName,
      building: {
        modules: buildingModules,
        cargo: [],
        reservation: []
      },
      cargo: stationEntry.cargo,
      reservation: stationEntry.reservation
    }
  })

  const context = computed<ProductionContextState>(() => {
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
    
    return {
      stationCode,
      sectorId: activeTransitSectorId.value || activeStation.value?.sectorId || null,
      sectorName,
      sectorNameId,
      position,
      sectorResources,
      sectorSunlight,
      hasBinding,
      hasArchive
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
    return archiveStation.value !== null ? 'live' : 'planning'
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
    if (workbenchMode.value === 'station' && planningStationDraft.value) {
      return planningStationDraft.value
    }

    const binding = bindingStation.value
    if (binding) {
      if ('modules' in binding) {
        return toProductionStation(binding, gameData.maps.sectors)
      }
      return {
        id: binding.id,
        name: binding.name || binding.saveStationCode || 'Transit Hub',
        type: 'transit',
        modules: [],
        settings: { ...DEFAULT_STATION_SETTINGS, ...binding.settings || {} },
        lastUpdated: 0,
        lockedWares: [],
        warePriority: {}
      }
    }

    const archive = archiveStation.value
    if (!archive) return null

    return {
      id: archive.code,
      name: archive.name || archive.code,
      type: workbenchMode.value === 'transit' ? 'transit' : 'industrial',
      modules: [],
      settings: { ...DEFAULT_STATION_SETTINGS, sunlight: archive.sector?.sunlight ?? 100 },
      lastUpdated: 0,
      lockedWares: [],
      warePriority: {}
    }
  })

  function getComputeDeps(): StationComputeDeps | null {
    const { modulesMap, waresMap, medicalConsumptionMap, enforceDlcActivation } = gameData
    if (!gameData.isReady || !modulesMap || !waresMap || !medicalConsumptionMap) return null
    return {
      modulesMap,
      waresMap,
      medicalConsumptionMap,
      enforceDlcActivation,
      isModuleDlcActive: (moduleId: string) => gameData.isDlcActive(modulesMap[moduleId]?.dlc_tag)
    }
  }

  function getDerivedStaticDeps(): StationDerivedStaticDeps | null {
    const deps = getComputeDeps()
    if (!deps) return null
    return {
      modulesMap: deps.modulesMap,
      waresMap: deps.waresMap,
      medicalConsumptionMap: deps.medicalConsumptionMap
    }
  }

  function hasBindingPlan(stationId: string): boolean {
    const binding = activeBinding.value
    if (!binding) return false
    return binding.stationPlans.some((plan) => plan.id === stationId)
  }

  function getArchiveSectorSunlight(stationId: string): number | null {
    const record = playerStationRecords.value.find((item) => item.code === stationId && item.type === 'station')
    if (!record) return null
    const sector = gameData.maps?.sectors?.[record.sectorMacro]
    if (!sector?.area?.sunlight && sector?.area?.sunlight !== 0) return null
    return Math.round(sector.area.sunlight * 100)
  }

  function buildPlanningSeed(station: StationPlan) {
    const usesBindingPlan = hasBindingPlan(station.id)
    const archiveSunlight = usesBindingPlan ? null : getArchiveSectorSunlight(station.id)
    const settings = {
      ...DEFAULT_STATION_SETTINGS,
      ...station.settings,
      sunlight: archiveSunlight ?? station.settings?.sunlight ?? DEFAULT_STATION_SETTINGS.sunlight
    }
    return {
      modulesMode: 'plan' as const,
      sectorId: station.sectorId,
      modules: usesBindingPlan ? (station.modules || []) : [],
      settings,
      lockedWares: usesBindingPlan ? (station.lockedWares || []) : [],
      warePriority: usesBindingPlan ? (station.warePriority || {}) : {}
    }
  }

  function syncAllBindingStationsToStateMap(): void {
    const stations = derivedBindingStations.value
    const map = resetPlanningDerivedMap()
    if (!map) return
    stations.forEach((item) => {
      const station = item.station
      map.upsertStation(station.id, buildPlanningSeed(station))
    })
  }

  const plannedModules = computed<SavedModule[]>({
    get: () => editableStationPlan.value?.modules || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.modules = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateModules(station.id, station.modules)
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
    get: () => editableStationPlan.value?.lockedWares || [],
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.lockedWares = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateLockedWares(station.id, station.lockedWares)
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
    get: () => editableStationPlan.value?.warePriority || {},
    set: (value) => {
      const station = editableStationPlan.value
      if (!station) return
      station.warePriority = deepClone(value)
      station.lastUpdated = Date.now()
      const map = ensurePlanningDerivedMap()
      const deps = getDerivedStaticDeps()
      if (deps && map) {
        map.updateWarePriority(station.id, station.warePriority)
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
    get: () => editableStationPlan.value?.settings || activeStation.value?.settings || { ...DEFAULT_STATION_SETTINGS },
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
      const station = editableStationPlan.value
      if (!station) return
      const previousSettings = { ...DEFAULT_STATION_SETTINGS, ...station.settings }
      station.settings = ({ ...DEFAULT_STATION_SETTINGS, ...value })
      station.lastUpdated = Date.now()
      const deps = getComputeDeps()
      const map = ensurePlanningDerivedMap()
      if (deps && map) {
        const changedSettings = diffStationSettings(previousSettings, station.settings)
        updateBindingStationPlan(station.id, {
          modules: station.modules,
          lockedWares: station.lockedWares,
          warePriority: station.warePriority,
          settings: station.settings
        })
        if (doesStationSettingsAffectFlowMap(changedSettings)) {
          map.updateSettings(station.id, station.settings)
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
        resolvedModules: [],
        modules: [],
        buildingModules: []
      }
    }

    const currentMode = mode.value
    const flowMapToUse = currentMode === 'live' ? liveFlowMap.value : planningDerivedMap.value
    const cache = flowMapToUse?.getCache(stationId) || null

    if (currentMode === 'live') {
      const archiveModules: SavedModule[] = archiveStation.value?.modules || []
      return {
        actualWorkforce: cache?.actualWorkforce || 0,
        currentEfficiency: cache?.currentEfficiency || 0,
        warePriorityLevels: {},
        productionFlows: flowMapToUse?.getProductionFlows(stationId) || [],
        plannedModules: archiveModules,
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        resolvedModules: archiveModules,
        modules: archiveModules,
        buildingModules: archiveStation.value?.building?.modules || []
      }
    }

    const planned = plannedModules.value
    const planState = buildDerivedActiveStationState({
      stationId,
      plannedModules: planned,
      settings: settings.value,
      cache,
      deps: getComputeDeps()
    })
    return {
      ...planState,
      modules: planState.resolvedModules,
      buildingModules: []
    }
  })

  const activeTransitState = computed(() => {
    const sectorId = activeTransitSectorId.value
    if (!sectorId) {
      return {
        plannedModules: [] as SavedModule[],
        resolvedModules: [] as SavedModule[],
        modules: [] as SavedModule[],
        buildingModules: [] as SavedModule[],
        autoIndustryModules: [] as SavedModule[],
        autoHabitationModules: [] as SavedModule[],
        autoInfrastructureModules: [] as SavedModule[],
        productionFlows: [] as any[],
        warePriorityLevels: {} as Record<string, number>,
        actualWorkforce: 0,
        currentEfficiency: 0
      }
    }
    const planningFlows = planningFlowFacade.getSectorFinalProductionFlows(sectorId)
    const flows = mode.value === 'live'
      ? liveFlowFacade.getSectorFinalProductionFlows(sectorId)
      : planningFlows
    const derived = buildDerivedTransitState({
      productionFlows: planningFlows,
      settings: settings.value,
      deps: getComputeDeps()
    })
    return {
      plannedModules: [] as SavedModule[],
      resolvedModules: derived.resolvedModules,
      modules: derived.resolvedModules,
      buildingModules: [] as SavedModule[],
      autoIndustryModules: [] as SavedModule[],
      autoHabitationModules: [] as SavedModule[],
      autoInfrastructureModules: derived.autoInfrastructureModules,
      productionFlows: flows,
      warePriorityLevels: {} as Record<string, number>,
      actualWorkforce: 0,
      currentEfficiency: 0
    }
  })

  const enforceDlcActivation = computed(() => gameData.enforceDlcActivation)

  function isModuleDlcActive(moduleId: string): boolean {
    return gameData.isDlcActive(gameData.modulesMap[moduleId]?.dlc_tag)
  }

  function isModuleCountEditable(moduleId: string): boolean {
    return !enforceDlcActivation.value || isModuleDlcActive(moduleId)
  }

  const moduleActions = createProductionModuleActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
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
      const map = ensurePlanningDerivedMap()
      if (!map) return
      map.updateModules(station.id, station.modules || [])
    },
    afterCommit: (station, deps) => {
      syncAfterStationFlowChange(station.id, deps)
    }
  })

  const wareRuleActions = createProductionWareRuleActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value,
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
    recompute: (station, _deps) => {
      const map = ensurePlanningDerivedMap()
      if (!map) return
      map.updateLockedWares(station.id, station.lockedWares || [])
      map.updateWarePriority(station.id, station.warePriority || {})
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
      const map = resetPlanningDerivedMap()
      if (!map) return
      derivedBindingStations.value.forEach(item => {
        const station = item.station
        map.upsertStation(station.id, buildPlanningSeed(station))
      })
    }
  )

  function syncBindingStationDerivedSnapshot(stationId: string) {
    markStationDirty(stationId)
  }

  function getStationFlowCache(stationId: string): GroupedFlows | null {
    computeDirtyStation(stationId)
    const flowMapToUse = mode.value === 'live' ? liveFlowMap.value : planningDerivedMap.value
    if (!flowMapToUse) return null
    const cache = flowMapToUse?.getCache(stationId) || null
    if (!cache) return null
    return flowMapToUse.getFilteredGrouped(stationId, cache.warePriorityLevels)
  }

  function clearStationCaches() {
    planningDerivedMap.value?.clear()
    liveFlowMap.value?.clear()
  }

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    return flowFacade.getSupplyPlanningInput(sectorId)
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    return flowFacade.getSectorInternalData(sectorId)
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
    syncBindingStationDerivedSnapshot(stationId)
    return station
  }

  function deleteStation(stationId: string) {
    const binding = activeBinding.value
    if (!binding) return
    const existingPlan = binding.stationPlans.find(plan => plan.id === stationId)
    if (existingPlan) {
      saveBindingStore.deleteStationPlan(binding.gameGuid, stationId)
      planningDerivedMap.value?.remove(stationId)
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
    syncBindingStationDerivedSnapshot(stationId)
  }

  function updateStationType(stationId: string, type: StationType) {
    updateBindingStationPlan(stationId, { type })
    syncBindingStationDerivedSnapshot(stationId)
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
    syncBindingStationDerivedSnapshot(stationId)
    return true
  }

  function renameBindingSector(sectorId: string, name: string): boolean {
    const binding = activeBinding.value
    if (!binding) return false
    return saveBindingStore.updateGroup(binding.gameGuid, sectorId, { name })
  }

  const isDirty = computed(() => saveBindingStore.isDirty)

  function saveBinding() {
    const binding = activeBinding.value
    if (!binding) {
      saveBindingStore.saveBinding()
      return
    }
    const beforePlans = binding.stationPlans
    const beforeById = new Map(beforePlans.map(p => [p.id, p]))
    saveBindingStore.saveBinding()
    const afterIds = new Set(binding.stationPlans.map(p => p.id))
    for (const [id, plan] of beforeById) {
      if (!afterIds.has(id)) {
        planningDerivedMap.value?.remove(id)
        if (activeStationId.value === id && plan.saveStationCode) {
          activeStationId.value = plan.saveStationCode
        }
      }
    }
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
    if (!currentStationId) {
      activeStationId.value = null
      expandedSectorId.value = null
      return
    }

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
      expandedSectorId.value = null
    }
  }

  let _activating = false
  async function activateBinding(gameGuid: string): Promise<boolean> {
    if (_activating) return false
    _activating = true
    try {
      const binding = saveBindingStore.getBindingByGameGuid(gameGuid)
      if (!binding) return false

      const archiveGroup = saveStore.archives.get(gameGuid)
      const hasValidArchive = archiveGroup?.saves.some(s => s.isValid) ?? false
      if (!hasValidArchive) return false

      activeViewStore.activeBinding = gameGuid
      saveBindingStore.syncFromActiveView()

    const draft = activeBinding.value
    if (draft?.selectedArchiveTime) {
      await saveStore.selectArchive(gameGuid, draft.selectedArchiveTime)
    } else {
      await saveStore.selectArchiveGroup(gameGuid)
    }

    await loadPlayerStationRecords()
    syncAllBindingStationsToStateMap()
    markAllDirty()
    validateActiveStationId()
    if (activeStationId.value) {
      mode.value = initialMode.value
    }

    return true
    } finally {
      _activating = false
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
        const activated = await activateBinding(storedGuid)
        if (activated) {
          isReady.value = true
          console.log('[LiveProductionStore] Loaded saved binding')
          return
        }
        console.log('[LiveProductionStore] Saved binding invalid, trying fallback')
      }

      const validBinding = saveBindingStore.savedBindings.list.find((b) => {
        const archiveGroup = saveStore.archives.get(b.gameGuid)
        return archiveGroup?.saves.some(s => s.isValid) ?? false
      })

      if (validBinding) {
        await activateBinding(validBinding.gameGuid)
        isReady.value = true
        console.log('[LiveProductionStore] Fallback to first valid binding:', validBinding.gameGuid)
        return
      }

      activeViewStore.activeBinding = null
      activeViewStore.activeBindingStation = null
      console.log('[LiveProductionStore] No valid bindings found, cleared')
      isReady.value = true

    } catch (e) {
      console.error('[LiveProductionStore] Initialization failed:', e)
    }
  }

  async function openBinding(gameGuid: string) {
    const currentDraft = activeBinding.value
    if (currentDraft?.gameGuid === gameGuid && saveBindingStore.activeGameGuid === gameGuid) {
      return
    }
    await activateBinding(gameGuid)
  }

  const wareflowViewMode = ref<WareFlowViewMode>('quantity')
  const expandedSectorId = ref<string | null>(null)
  const titleValue = computed(() => activeBinding.value?.bindingName || activeBindingName.value || '')
  const titlePlaceholder = computed(() => i18n.global.t('binding.new_binding_name'))

  const capabilities: ProductionWorkbenchCapabilities = {
    uniqueWorkbench: true,
    uniqueStation: true,
    hasSectors: true
  }

  const empireGapsComputed = computed<{ operations: EmpireGapItem[]; supply: EmpireGapItem[] }>(() => {
    void gapRefreshKey.value
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
    canToggle: workbenchMode.value === 'transit' ? true : canToggle.value,
    wareflowViewMode: wareflowViewMode.value
  }))

  const stationState = computed<ProductionStationState | null>(() => {
    const wm = workbenchMode.value
    if (wm === 'overview') return null

    const isTransit = wm === 'transit'
    const state = isTransit ? activeTransitState.value : activeStationState.value

    if (isTransit && !activeTransitSectorId.value) return null
    if (!isTransit && !activeStation.value) return null

    const entityType = isTransit ? 'transit' as const : 'station' as const
    const entityId = isTransit ? activeTransitSectorId.value! : activeStation.value!.id
    const entityName = isTransit
      ? (sectors.value.find(s => s.id === activeTransitSectorId.value)?.name || activeTransitSectorId.value!)
      : activeStation.value!.name
    const stationType = 'industrial' as const
    const stationCount = 1
    const stationMinerals: string[] = []

    return {
      entityType,
      id: entityId,
      name: entityName,
      stationType,
      count: stationCount,
      minerals: stationMinerals,
      plannedModules: state.plannedModules,
      resolvedModules: state.resolvedModules,
      modules: state.modules,
      buildingModules: state.buildingModules,
      autoIndustryModules: state.autoIndustryModules,
      autoHabitationModules: state.autoHabitationModules,
      autoInfrastructureModules: state.autoInfrastructureModules,
      productionFlows: state.productionFlows,
      derivedProductionFlows: planningFlowFacade.deriveFlows(state.productionFlows, settings.value, state.warePriorityLevels),
      warePriorityLevels: state.warePriorityLevels,
      settings: {
        ...settings.value,
        enforceDlcActivation: enforceDlcActivation.value
      },
      enforceDlcActivation: enforceDlcActivation.value,
      empireGaps: empireGapsComputed.value,
      currentEfficiency: state.currentEfficiency,
      actualWorkforce: state.actualWorkforce,
      buildPriceMultiplier: buildPriceMultiplier.value
    }
  })

  const tabSemanticsById = computed<Record<string, { tag?: string; factoryGroup?: string }>>(() => {
    const stationPlansByCode = new Map<string, BindingStationPlan>()
    const stationPlansById = new Map<string, BindingStationPlan>()
    activeBinding.value?.stationPlans.forEach((plan) => {
      if (plan.saveStationCode) {
        stationPlansByCode.set(plan.saveStationCode, plan)
      }
      stationPlansById.set(plan.id, plan)
    })

    const entries = orderedStationsBySector.value.map((station) => {
      const matchingPlan = stationPlansByCode.get(station.id) || stationPlansById.get(station.id)
      const semantics = matchingPlan
        ? planningDerivedMap.value?.getCache(station.id)?.semantics
        : liveFlowMap.value?.getCache(station.id)?.semantics
      return [
        station.id,
        {
          tag: semantics?.tag ?? (matchingPlan ? undefined : 'constructionsite'),
          factoryGroup: semantics?.factoryGroup
        }
      ] as const
    })

    return Object.fromEntries(entries)
  })
  const updateTitle = (value: string) => { activeBindingName.value = value }
  const updateStationNameFromActive = (value: string) => {
    if (editableStationPlan.value) renameStation(editableStationPlan.value.id, value)
  }
  const updateStationTypeFromActive = (value: StationType) => {
    if (editableStationPlan.value) updateStationType(editableStationPlan.value.id, value)
  }
  const settingActions = createProductionSettingActions<StationPlan>({
    getActiveStation: () => editableStationPlan.value || activeStation.value,
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
    recompute: (station, _deps) => {
      const sectorId = activeTransitSectorId.value
      const tradeStationId = activeBinding.value?.groups.find(g => g.id === sectorId)?.tradeStation?.id
      
      if (station.id === tradeStationId) {
        return
      }
      const map = ensurePlanningDerivedMap()
      if (!map) return
      map.upsertStation(station.id, {
        modulesMode: 'plan',
        sectorId: station.sectorId,
        modules: station.modules || [],
        settings: station.settings || {},
        lockedWares: station.lockedWares || [],
        warePriority: station.warePriority || {}
      })
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
    editableStationPlan,
    activeStationId,
    activeTransitSectorId,
    sectors,
    orderedStationsBySector,
    tabSemanticsById,
    expandedSectorId,
    titleValue,
    titlePlaceholder,
    derivedBindingStations,
    stationFlowCache,
    getStationFlowCache,
    syncBindingStationDerivedSnapshot,
    clearStationCaches,
    syncAllBindingStationsToStateMap,
    empireGroupedFlows,
    sectorInternalDataMap,
    saveBinding,
    discardChanges,
    createStation,
    deleteStation,
    renameStation,
    selectTransitSector,
    setExpandedSector: (sectorId: string | null) => { expandedSectorId.value = sectorId },
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
    activateBinding,
    openBinding,
    validateActiveStationId,
    getSupplyPlanningInput,
    getSectorInternalData,
    getStationComponentGapFlows,
    archiveStation,
    bindingStation,
    playerStationRecords,
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
    updateTitle,
    updateStationName: updateStationNameFromActive,
    updateStationType: updateStationTypeFromActive,
    updateWareflowViewMode: (value: WareFlowViewMode) => { wareflowViewMode.value = value },
    updateBuildPriceMultiplier: (value: number) => { buildPriceMultiplier.value = value },
    duplicateStation: () => null,
    selectStation
  }
})
