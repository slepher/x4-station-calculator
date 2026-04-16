import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import { useActiveViewStore } from './useActiveViewStore'
import { useSaveStore } from './useSaveStore'
import { DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import { resolveMapSectorByMacro } from '@/components/map/utils/mapSectorMacro'
import { getSectorZoneBoundingCenter } from '@/components/map/utils/coordinates'
import type {
  BindingSectorGroup,
  BindingStationPlan,
  CoverageSectorEntry,
  SavedModule,
  SavedSaveBindingsState,
  SaveBindingPlan,
  StationPlan,
  StationSettings,
  StationType,
  TradeStationBinding,
  X4MapSector
} from '@/types/x4'

const CURRENT_SAVE_BINDING_VERSION = 1

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function getSectorCenterPosition(
  maps: { clusters: Record<string, { sectors?: string[] }>; sectors: Record<string, X4MapSector> } | null | undefined,
  sectorMacro: string | null | undefined
): { x: number; y: number; z: number } | undefined {
  if (!maps || !sectorMacro) return undefined
  
  const resolved = resolveMapSectorByMacro(maps, sectorMacro)
  if (!resolved) return undefined
  
  const center = getSectorZoneBoundingCenter(resolved.sector)
  return { x: center.x, y: 0, z: center.z }
}

function createDefaultBinding(gameGuid: string): SaveBindingPlan {
  return {
    gameGuid,
    selectedArchiveTime: null,
    groups: [],
    stationPlans: [],
    updatedAt: Date.now()
  }
}

function createDefaultGroup(name: string, order: number): BindingSectorGroup {
  return {
    id: crypto.randomUUID(),
    name: name || `Sector ${order + 1}`,
    order,
    jumpRange: 3,
    coverageSectorMacros: [],
    connectedGroupIds: []
  }
}

function normalizeTradeStation(input: unknown): TradeStationBinding | undefined {
  const value = input as Partial<TradeStationBinding> | null | undefined
  if (!value) return undefined
  return {
    id: value.id || crypto.randomUUID(),
    saveStationCode: value.saveStationCode,
    name: value.name || 'Trade Station',
    sectorMacro: value.sectorMacro,
    position: value.position
  }
}

function normalizeState(input: Partial<SavedSaveBindingsState> | null | undefined): SavedSaveBindingsState {
  const list = Array.isArray(input?.list)
    ? input.list
        .filter((item): item is SaveBindingPlan => !!item && typeof item.gameGuid === 'string' && item.gameGuid.length > 0)
        .map((item) => {
          const groups = Array.isArray(item.groups) ? item.groups.map((group, index) => ({
            id: group.id || crypto.randomUUID(),
            name: group.name || `Sector ${index + 1}`,
            order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
            sectorMacro: group.sectorMacro,
            jumpRange: Number.isFinite(Number(group.jumpRange)) ? Number(group.jumpRange) : 3,
            coverageSectorMacros: Array.isArray(group.coverageSectorMacros) ? group.coverageSectorMacros : [],
            connectedGroupIds: Array.isArray(group.connectedGroupIds) ? group.connectedGroupIds : [],
            tradeStation: normalizeTradeStation(group.tradeStation),
            settings: group.settings ? deepClone(group.settings as Partial<StationSettings>) : undefined
          })) : []

          const rawStationPlans = Array.isArray((item as any).stationPlans) ? (item as any).stationPlans as unknown[] : []
          const normalizedStationPlans: BindingStationPlan[] = rawStationPlans
            .filter((plan): plan is Record<string, unknown> => typeof plan === 'object' && plan !== null)
            .map((plan) => ({
              id: (plan.id as string) || crypto.randomUUID(),
              saveStationCode: plan.saveStationCode as string | undefined,
              groupId: plan.groupId as string | null | undefined,
              name: (plan.name as string) || (plan.saveStationCode ? String(plan.saveStationCode) : 'Virtual Station'),
              type: (plan.type as StationType) || 'industrial',
              modules: Array.isArray(plan.modules) ? plan.modules : [],
              settings: deepClone<StationSettings>((plan.settings as StationSettings) || DEFAULT_STATION_SETTINGS),
              lockedWares: Array.isArray(plan.lockedWares) ? deepClone(plan.lockedWares as string[]) : [],
              warePriority: (plan.warePriority && typeof plan.warePriority === 'object') ? deepClone(plan.warePriority as Record<string, number>) : {},
              sectorMacro: plan.sectorMacro as string | undefined,
              position: plan.position as { x: number; y: number; z: number } | undefined
            }))

          return {
            gameGuid: item.gameGuid,
            bindingName: item.bindingName,
            selectedArchiveTime: item.selectedArchiveTime ?? null,
            blueprintEmpireId: item.blueprintEmpireId,
            groups,
            stationPlans: normalizedStationPlans,
            updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : Date.now()
          }
        })
    : []

  const unique = new Map<string, SaveBindingPlan>()
  list.forEach((item) => unique.set(item.gameGuid, item))

  return {
    version: CURRENT_SAVE_BINDING_VERSION,
    list: Array.from(unique.values())
  }
}

export const useSaveBindingStore = defineStore('saveBinding', () => {
  const gameData = useGameDataStore()
  const activeViewStore = useActiveViewStore()
  const saveStore = useSaveStore()
  const savedBindings = ref<SavedSaveBindingsState>({
    version: CURRENT_SAVE_BINDING_VERSION,
    list: []
  })
  const draftBinding = ref<SaveBindingPlan | null>(null)
  const lastSavedDraftSnapshot = ref('')
  const isInitialized = ref(false)

  function getStorageKey(): string {
    const saveKey = gameData.getStorageKey('save_archives')
    if (saveKey.includes('save_archives')) return saveKey.replace('save_archives', 'save_bindings')
    return 'x4_save_bindings'
  }

  function serializeBinding(binding: SaveBindingPlan | null): string {
    return binding ? JSON.stringify(binding) : ''
  }

  function writeState() {
    localStorage.setItem(getStorageKey(), JSON.stringify(savedBindings.value))
  }

  function persistViewState() {
    writeState()
  }

  function loadDraft(gameGuid: string) {
    const existing = savedBindings.value.list.find((item) => item.gameGuid === gameGuid) || createDefaultBinding(gameGuid)
    draftBinding.value = deepClone(existing)
    lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
  }

  function initialize() {
    try {
      const raw = localStorage.getItem(getStorageKey())
      savedBindings.value = raw ? normalizeState(JSON.parse(raw)) : normalizeState(null)
    } catch (error) {
      console.warn('[SaveBindingStore] failed to load bindings:', error)
      savedBindings.value = normalizeState(null)
    }
    const storedGuid = activeViewStore.activeBinding
    if (storedGuid && savedBindings.value.list.some((b) => b.gameGuid === storedGuid)) {
      loadDraft(storedGuid)
    }
    isInitialized.value = true
  }

  const bindings = computed(() => savedBindings.value.list)
  const activeGameGuid = computed(() => activeViewStore.activeBinding)
  const activeBinding = computed(() => draftBinding.value)
  const activeBindingName = computed({
    get: () => draftBinding.value?.bindingName || '',
    set: (name: string) => {
      if (draftBinding.value) {
        draftBinding.value.bindingName = name
        draftBinding.value.updatedAt = Date.now()
      }
    }
  })
  const isDirty = computed(() => serializeBinding(draftBinding.value) !== lastSavedDraftSnapshot.value)

  function getBindingByGameGuid(gameGuid: string): SaveBindingPlan | null {
    return savedBindings.value.list.find((item) => item.gameGuid === gameGuid) || null
  }

  function getBindingDisplayName(gameGuid: string): string {
    const group = saveStore.archiveGroups.find(g => g.guid === gameGuid)
    return group?.playerName || gameGuid.slice(0, 8)
  }

  function createOrOpenBinding(gameGuid: string, archiveTime: number | null = null): SaveBindingPlan {
    let binding = getBindingByGameGuid(gameGuid)
    const isNewBinding = !binding
    if (!binding) {
      binding = createDefaultBinding(gameGuid)
      binding.bindingName = getBindingDisplayName(gameGuid)
      savedBindings.value.list.push(binding)
    }
    activeViewStore.setActiveId(gameGuid)
    loadDraft(gameGuid)
    if (draftBinding.value) {
      if (isNewBinding && !draftBinding.value.bindingName) {
        draftBinding.value.bindingName = getBindingDisplayName(gameGuid)
      }
      draftBinding.value.selectedArchiveTime = archiveTime
      lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
      binding.selectedArchiveTime = archiveTime
      binding.bindingName = draftBinding.value.bindingName
      binding.updatedAt = Date.now()
    }
    persistViewState()
    return draftBinding.value || binding
  }

  function setActiveBinding(gameGuid: string | null) {
    activeViewStore.setActiveId(gameGuid)
    if (gameGuid) loadDraft(gameGuid)
    else {
      draftBinding.value = null
      lastSavedDraftSnapshot.value = ''
    }
    persistViewState()
  }

  function setSelectedArchiveTime(gameGuid: string, archiveTime: number | null) {
    const binding = getBindingByGameGuid(gameGuid) || createDefaultBinding(gameGuid)
    if (!getBindingByGameGuid(gameGuid)) savedBindings.value.list.push(binding)
    binding.selectedArchiveTime = archiveTime
    binding.updatedAt = Date.now()
    activeViewStore.setActiveId(gameGuid)
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) loadDraft(gameGuid)
    if (draftBinding.value) {
      draftBinding.value.selectedArchiveTime = archiveTime
      lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
    }
    persistViewState()
  }

  function setBlueprintEmpire(gameGuid: string, empireId: string | undefined) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return
    draftBinding.value.blueprintEmpireId = empireId
    draftBinding.value.updatedAt = Date.now()
  }

  function saveBinding() {
    if (!draftBinding.value) return
    draftBinding.value.updatedAt = Date.now()
    const next = deepClone(draftBinding.value)
    const idx = savedBindings.value.list.findIndex((item) => item.gameGuid === next.gameGuid)
    if (idx >= 0) savedBindings.value.list[idx] = next
    else savedBindings.value.list.push(next)
    activeViewStore.setActiveId(next.gameGuid)
    writeState()
    lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
  }

  function discardChanges() {
    const guid = draftBinding.value?.gameGuid || activeViewStore.activeBinding
    if (!guid) return
    loadDraft(guid)
  }

  function createGroup(gameGuid: string, name = ''): BindingSectorGroup | null {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return null
    const group = createDefaultGroup(name, draftBinding.value.groups.length)
    draftBinding.value.groups.push(group)
    draftBinding.value.updatedAt = Date.now()
    return group
  }

  function updateGroup(gameGuid: string, groupId: string, patch: Partial<BindingSectorGroup>) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    const group = draftBinding.value?.groups.find((item) => item.id === groupId)
    if (!group) return false
    Object.assign(group, patch)
    draftBinding.value!.updatedAt = Date.now()
    return true
  }

  function deleteGroup(gameGuid: string, groupId: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const before = draftBinding.value.groups.length
    draftBinding.value.groups = draftBinding.value.groups.filter((item) => item.id !== groupId)
    draftBinding.value.groups.forEach((group, order) => { group.order = order })
    draftBinding.value.groups.forEach((group) => {
      group.connectedGroupIds = (group.connectedGroupIds || []).filter((id) => id !== groupId)
    })
    draftBinding.value.stationPlans.forEach((plan) => {
      if (plan.groupId === groupId) plan.groupId = null
    })
    draftBinding.value.updatedAt = Date.now()
    return draftBinding.value.groups.length !== before
  }

  function bindSectorGroup(input: {
    gameGuid: string
    sectorGroupId: string
    sectorMacro?: string
    jumpRange: number
    coverageSectorMacros: CoverageSectorEntry[]
  }) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return
    
    const group = draftBinding.value.groups.find((item) => item.id === input.sectorGroupId)
    if (!group) return
    
    const wasSectorMacroSet = Boolean(group.sectorMacro)
    const newSectorMacro = input.sectorMacro
    
    updateGroup(input.gameGuid, input.sectorGroupId, {
      sectorMacro: input.sectorMacro,
      jumpRange: input.jumpRange,
      coverageSectorMacros: deepClone(input.coverageSectorMacros)
    })
    
    // Auto-create tradestation when first binding to a sector
    if (!wasSectorMacroSet && newSectorMacro && !group.tradeStation) {
      const position = getSectorCenterPosition(gameData.maps, newSectorMacro)
      group.tradeStation = {
        id: crypto.randomUUID(),
        name: 'Trade Station',
        sectorMacro: newSectorMacro,
        position
      }
      draftBinding.value.updatedAt = Date.now()
    }
    
    // Update tradestation sectorMacro when anchor sector changes
    if (newSectorMacro && group.tradeStation && group.tradeStation.sectorMacro !== newSectorMacro) {
      group.tradeStation.sectorMacro = newSectorMacro
      const position = getSectorCenterPosition(gameData.maps, newSectorMacro)
      if (position && !group.tradeStation.saveStationCode) {
        group.tradeStation.position = position
      }
      draftBinding.value.updatedAt = Date.now()
    }
  }

  function setGroupConnection(gameGuid: string, sourceGroupId: string, targetGroupId: string, connected: boolean) {
    if (sourceGroupId === targetGroupId) return
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    const source = draftBinding.value?.groups.find((item) => item.id === sourceGroupId)
    const target = draftBinding.value?.groups.find((item) => item.id === targetGroupId)
    if (!source || !target) return
    const sourceSet = new Set(source.connectedGroupIds || [])
    const targetSet = new Set(target.connectedGroupIds || [])
    if (connected) {
      sourceSet.add(targetGroupId)
      targetSet.add(sourceGroupId)
    } else {
      sourceSet.delete(targetGroupId)
      targetSet.delete(sourceGroupId)
    }
    source.connectedGroupIds = Array.from(sourceSet)
    target.connectedGroupIds = Array.from(targetSet)
    draftBinding.value!.updatedAt = Date.now()
  }

  function upsertStationPlan(input: {
    gameGuid: string
    saveStationCode?: string
    groupId?: string | null
    name: string
    type?: StationType
    count?: number
    modules?: SavedModule[]
    settings?: StationSettings
    lockedWares?: string[]
    warePriority?: Record<string, number>
    minerals?: string[]
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): BindingStationPlan | null {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return null

    let plan = input.saveStationCode
      ? draftBinding.value.stationPlans.find((item) => item.saveStationCode === input.saveStationCode)
      : null

    if (!plan) {
      plan = {
        id: crypto.randomUUID(),
        saveStationCode: input.saveStationCode,
        groupId: input.groupId ?? null,
        name: input.name,
        type: input.type || 'industrial',
        count: input.count ?? 1,
        modules: [],
        settings: deepClone(DEFAULT_STATION_SETTINGS),
        lockedWares: [],
        warePriority: {},
        minerals: [],
        sectorMacro: input.sectorMacro,
        position: input.position
      }
      draftBinding.value.stationPlans.push(plan)
    }

    plan.groupId = input.groupId ?? plan.groupId ?? null
    plan.name = input.name ?? plan.name
    if (input.type !== undefined) plan.type = input.type
    if (input.count !== undefined) plan.count = input.count
    if (input.modules) plan.modules = deepClone(input.modules)
    if (input.settings) plan.settings = deepClone(input.settings)
    if (input.lockedWares) plan.lockedWares = deepClone(input.lockedWares)
    if (input.warePriority) plan.warePriority = deepClone(input.warePriority)
    if (input.minerals !== undefined) plan.minerals = deepClone(input.minerals)
    if (input.sectorMacro !== undefined) plan.sectorMacro = input.sectorMacro
    if (input.position !== undefined) plan.position = input.position
    draftBinding.value.updatedAt = Date.now()
    return plan
  }

  function clearStationPlan(gameGuid: string, identifier: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const before = draftBinding.value.stationPlans.length
    draftBinding.value.stationPlans = draftBinding.value.stationPlans.filter(
      (item) => !(item.saveStationCode === identifier || item.id === identifier)
    )
    draftBinding.value.updatedAt = Date.now()
    return draftBinding.value.stationPlans.length !== before
  }

  function deleteStationPlan(gameGuid: string, stationPlanId: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const before = draftBinding.value.stationPlans.length
    draftBinding.value.stationPlans = draftBinding.value.stationPlans.filter((item) => item.id !== stationPlanId)
    draftBinding.value.updatedAt = Date.now()
    return draftBinding.value.stationPlans.length !== before
  }

  function setStationPlanPosition(input: {
    gameGuid: string
    stationPlanId: string
    groupId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
  }) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return false
    const plan = draftBinding.value.stationPlans.find((item) => item.id === input.stationPlanId)
    if (!plan) return false
    plan.groupId = input.groupId
    plan.sectorMacro = input.sectorMacro
    plan.position = input.position
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function upsertTradeStation(input: {
    gameGuid: string
    groupId: string
    saveStationCode?: string
    name: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): TradeStationBinding | null {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return null
    const group = draftBinding.value.groups.find((item) => item.id === input.groupId)
    if (!group) return null

    let ts = group.tradeStation
    if (!ts) {
      ts = {
        id: crypto.randomUUID(),
        saveStationCode: input.saveStationCode,
        name: input.name,
        sectorMacro: input.sectorMacro,
        position: input.position
      }
      group.tradeStation = ts
    } else {
      ts.saveStationCode = input.saveStationCode ?? ts.saveStationCode
      ts.name = input.name ?? ts.name
      if (input.sectorMacro !== undefined) ts.sectorMacro = input.sectorMacro
      if (input.position !== undefined) ts.position = input.position
    }
    draftBinding.value.updatedAt = Date.now()
    return ts
  }

  function deleteTradeStation(gameGuid: string, groupId: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const group = draftBinding.value.groups.find((item) => item.id === groupId)
    if (!group?.tradeStation) return false
    group.tradeStation = undefined
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function setTradeStationPosition(input: {
    gameGuid: string
    groupId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
  }) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return false
    const group = draftBinding.value.groups.find((item) => item.id === input.groupId)
    if (!group?.tradeStation) return false
    group.tradeStation.sectorMacro = input.sectorMacro
    group.tradeStation.position = input.position
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function unbindTradeStation(gameGuid: string, groupId: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const group = draftBinding.value.groups.find((item) => item.id === groupId)
    if (!group?.tradeStation) return false
    
    // Clear saveStationCode and reset position to sector center
    group.tradeStation.saveStationCode = undefined
    const sectorMacro = group.sectorMacro || group.tradeStation.sectorMacro
    if (sectorMacro) {
      const position = getSectorCenterPosition(gameData.maps, sectorMacro)
      group.tradeStation.position = position
      group.tradeStation.sectorMacro = sectorMacro
    }
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function importEmpireStationToSaveStation(gameGuid: string, saveStationCode: string, station: StationPlan, groupId?: string | null) {
    return upsertStationPlan({
      gameGuid,
      saveStationCode,
      groupId,
      name: station.name,
      type: station.type,
      modules: station.modules,
      settings: station.settings
    })
  }

  function loadData(data: SavedSaveBindingsState) {
    savedBindings.value = normalizeState(data)
    writeState()
    const storedGuid = activeViewStore.activeBinding
    if (storedGuid && savedBindings.value.list.some((b) => b.gameGuid === storedGuid)) {
      loadDraft(storedGuid)
    }
  }

  

  function updateStationPlan(gameGuid: string, stationPlanId: string, patch: Partial<BindingStationPlan>) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const plan = draftBinding.value.stationPlans.find((item) => item.id === stationPlanId)
    if (!plan) return false
    if (patch.name !== undefined) plan.name = patch.name
    if (patch.type !== undefined) plan.type = patch.type
    if (patch.modules !== undefined) plan.modules = deepClone(patch.modules)
    if (patch.settings !== undefined) plan.settings = deepClone(patch.settings)
    if (patch.lockedWares !== undefined) plan.lockedWares = deepClone(patch.lockedWares)
    if (patch.warePriority !== undefined) plan.warePriority = deepClone(patch.warePriority)
    if (patch.groupId !== undefined) plan.groupId = patch.groupId
    if (patch.sectorMacro !== undefined) plan.sectorMacro = patch.sectorMacro
    if (patch.position !== undefined) plan.position = patch.position
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function createStationPlanInGroup(gameGuid: string, groupId: string | null, name: string, type: StationType = 'industrial'): BindingStationPlan | null {
    return upsertStationPlan({
      gameGuid,
      groupId,
      name,
      type,
      modules: [],
      settings: deepClone(DEFAULT_STATION_SETTINGS)
    })
  }

  return {
    savedBindings,
    bindings,
    activeGameGuid,
    activeBinding,
    activeBindingName,
    draftBinding,
    isDirty,
    isInitialized,
    initialize,
    getBindingByGameGuid,
    getBindingDisplayName,
    createOrOpenBinding,
    setActiveBinding,
    setSelectedArchiveTime,
    setBlueprintEmpire,
    saveBinding,
    discardChanges,
    createGroup,
    updateGroup,
    deleteGroup,
    bindSectorGroup,
    setGroupConnection,
    upsertStationPlan,
    clearStationPlan,
    deleteStationPlan,
    setStationPlanPosition,
    upsertTradeStation,
    deleteTradeStation,
    setTradeStationPosition,
    unbindTradeStation,
    importEmpireStationToSaveStation,
    updateStationPlan,
    createStationPlanInGroup,
    loadData,
    writeState
  }
})
