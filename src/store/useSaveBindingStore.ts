import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useGameDataStore } from './useGameDataStore'
import { DEFAULT_STATION_SETTINGS } from './state/StationStateMap'
import type {
  BindingSectorGroup,
  CoverageSectorEntry,
  SavedModule,
  SavedSaveBindingsState,
  SaveBindingPlan,
  StationPlan,
  StationSettings,
  StationType,
  VirtualStationPlan
} from '@/types/x4'

const CURRENT_SAVE_BINDING_VERSION = 1

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
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

function normalizeVirtualStation(input: unknown, groupId: string): VirtualStationPlan | undefined {
  const value = input as Partial<VirtualStationPlan> | null | undefined
  if (!value || value.kind !== 'virtual-station') return undefined
  return {
    id: value.id || crypto.randomUUID(),
    kind: 'virtual-station',
    role: value.role,
    groupId,
    name: value.name || 'Virtual Station',
    type: value.type || 'industrial',
    modules: Array.isArray(value.modules) ? value.modules : [],
    settings: deepClone(value.settings || DEFAULT_STATION_SETTINGS),
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
            virtualStation: normalizeVirtualStation(group.virtualStation, group.id)
          })) : []

          const rawStationPlans = Array.isArray((item as any).stationPlans) ? (item as any).stationPlans as unknown[] : []

          rawStationPlans
            .filter((plan): plan is VirtualStationPlan =>
              typeof plan === 'object' && plan !== null && (plan as { kind?: string }).kind === 'virtual-station'
            )
            .forEach((plan) => {
              const group = groups.find((item) => item.id === plan.groupId)
              if (group && !group.virtualStation) group.virtualStation = normalizeVirtualStation(plan, group.id)
            })

          return {
            gameGuid: item.gameGuid,
            selectedArchiveTime: item.selectedArchiveTime ?? null,
            sourceEmpireId: item.sourceEmpireId,
            groups,
            stationPlans: rawStationPlans.filter(
              (plan): plan is SaveBindingPlan['stationPlans'][number] =>
                typeof plan === 'object' && plan !== null && (plan as { kind?: string }).kind === 'save-station'
            ),
            updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : Date.now()
          }
        })
    : []

  const unique = new Map<string, SaveBindingPlan>()
  list.forEach((item) => unique.set(item.gameGuid, item))
  const activeGameGuid = input?.activeGameGuid && unique.has(input.activeGameGuid) ? input.activeGameGuid : null

  return {
    version: CURRENT_SAVE_BINDING_VERSION,
    activeGameGuid,
    list: Array.from(unique.values())
  }
}

export const useSaveBindingStore = defineStore('saveBinding', () => {
  const gameData = useGameDataStore()
  const savedBindings = ref<SavedSaveBindingsState>({
    version: CURRENT_SAVE_BINDING_VERSION,
    activeGameGuid: null,
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
    if (savedBindings.value.activeGameGuid) {
      loadDraft(savedBindings.value.activeGameGuid)
    }
    isInitialized.value = true
  }

  const bindings = computed(() => savedBindings.value.list)
  const activeGameGuid = computed(() => savedBindings.value.activeGameGuid)
  const activeBinding = computed(() => draftBinding.value)
  const isDirty = computed(() => serializeBinding(draftBinding.value) !== lastSavedDraftSnapshot.value)

  function getBindingByGameGuid(gameGuid: string): SaveBindingPlan | null {
    return savedBindings.value.list.find((item) => item.gameGuid === gameGuid) || null
  }

  function createOrOpenBinding(gameGuid: string, archiveTime: number | null = null): SaveBindingPlan {
    let binding = getBindingByGameGuid(gameGuid)
    if (!binding) {
      binding = createDefaultBinding(gameGuid)
      savedBindings.value.list.push(binding)
    }
    savedBindings.value.activeGameGuid = gameGuid
    loadDraft(gameGuid)
    if (draftBinding.value) {
      draftBinding.value.selectedArchiveTime = archiveTime
      lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
      binding.selectedArchiveTime = archiveTime
      binding.updatedAt = Date.now()
    }
    persistViewState()
    return draftBinding.value || binding
  }

  function setActiveBinding(gameGuid: string | null) {
    savedBindings.value.activeGameGuid = gameGuid
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
    savedBindings.value.activeGameGuid = gameGuid
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) loadDraft(gameGuid)
    if (draftBinding.value) {
      draftBinding.value.selectedArchiveTime = archiveTime
      lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
    }
    persistViewState()
  }

  function setSourceEmpire(gameGuid: string, empireId: string | undefined) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return
    draftBinding.value.sourceEmpireId = empireId
    draftBinding.value.updatedAt = Date.now()
  }

  function saveBinding() {
    if (!draftBinding.value) return
    draftBinding.value.updatedAt = Date.now()
    const next = deepClone(draftBinding.value)
    const idx = savedBindings.value.list.findIndex((item) => item.gameGuid === next.gameGuid)
    if (idx >= 0) savedBindings.value.list[idx] = next
    else savedBindings.value.list.push(next)
    savedBindings.value.activeGameGuid = next.gameGuid
    writeState()
    lastSavedDraftSnapshot.value = serializeBinding(draftBinding.value)
  }

  function discardChanges() {
    const guid = draftBinding.value?.gameGuid || savedBindings.value.activeGameGuid
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
    updateGroup(input.gameGuid, input.sectorGroupId, {
      sectorMacro: input.sectorMacro,
      jumpRange: input.jumpRange,
      coverageSectorMacros: deepClone(input.coverageSectorMacros)
    })
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

  function upsertSaveStationPlan(input: {
    gameGuid: string
    saveStationCode: string
    groupId?: string | null
    modules?: SavedModule[]
    settings?: StationSettings
    name?: string
  }) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return null
    let plan = draftBinding.value.stationPlans.find(
      (item) => item.kind === 'save-station' && item.saveStationCode === input.saveStationCode
    )
    if (!plan) {
      plan = {
        id: crypto.randomUUID(),
        kind: 'save-station',
        saveStationCode: input.saveStationCode,
        groupId: input.groupId ?? null,
        modules: [],
        settings: deepClone(DEFAULT_STATION_SETTINGS),
        name: input.name
      }
      draftBinding.value.stationPlans.push(plan)
    }
    plan.groupId = input.groupId ?? plan.groupId ?? null
    if (input.modules) plan.modules = deepClone(input.modules)
    if (input.settings) plan.settings = deepClone(input.settings)
    if (input.name !== undefined) plan.name = input.name
    draftBinding.value.updatedAt = Date.now()
    return plan
  }

  function clearSaveStationPlan(gameGuid: string, saveStationCode: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const before = draftBinding.value.stationPlans.length
    draftBinding.value.stationPlans = draftBinding.value.stationPlans.filter(
      (item) => !(item.kind === 'save-station' && item.saveStationCode === saveStationCode)
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

  function setVirtualStationPosition(input: {
    gameGuid: string
    stationPlanId: string
    groupId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
  }) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return false
    const group = draftBinding.value.groups.find((item) => item.id === input.groupId)
    const plan = group?.virtualStation?.id === input.stationPlanId ? group.virtualStation : null
    if (!plan) return false
    plan.groupId = input.groupId
    plan.sectorMacro = input.sectorMacro
    plan.position = input.position
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function createVirtualStation(input: {
    gameGuid: string
    groupId?: string | null
    name: string
    type?: StationType
    role?: 'tradestation'
    modules?: SavedModule[]
    settings?: StationSettings
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): VirtualStationPlan | null {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return null
    const group = input.groupId
      ? draftBinding.value.groups.find((item) => item.id === input.groupId)
      : null
    if (!group) return null
    const plan: VirtualStationPlan = {
      id: crypto.randomUUID(),
      kind: 'virtual-station',
      role: input.role,
      groupId: group.id,
      name: input.name,
      type: input.type || 'industrial',
      modules: deepClone(input.modules || []),
      settings: deepClone(input.settings || DEFAULT_STATION_SETTINGS),
      sectorMacro: input.sectorMacro,
      position: input.position
    }
    group.virtualStation = plan
    draftBinding.value.updatedAt = Date.now()
    return plan
  }

  function upsertVirtualTradestation(input: {
    gameGuid: string
    groupId: string
    name: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): VirtualStationPlan | null {
    if (!draftBinding.value || draftBinding.value.gameGuid !== input.gameGuid) createOrOpenBinding(input.gameGuid)
    if (!draftBinding.value) return null
    const group = draftBinding.value.groups.find((item) => item.id === input.groupId)
    if (!group) return null
    let plan = group.virtualStation
    if (!plan) {
      plan = {
        id: crypto.randomUUID(),
        kind: 'virtual-station',
        role: 'tradestation',
        groupId: input.groupId,
        name: input.name,
        type: 'transit',
        modules: [],
        settings: deepClone(DEFAULT_STATION_SETTINGS),
        sectorMacro: input.sectorMacro,
        position: input.position
      }
      group.virtualStation = plan
    } else {
      plan.role = 'tradestation'
      plan.name = input.name
      plan.type = 'transit'
      plan.groupId = input.groupId
      if (input.sectorMacro !== undefined) plan.sectorMacro = input.sectorMacro
      if (input.position !== undefined) plan.position = input.position
    }
    draftBinding.value.updatedAt = Date.now()
    return plan
  }

  function deleteVirtualStation(gameGuid: string, groupId: string, stationPlanId?: string) {
    if (!draftBinding.value || draftBinding.value.gameGuid !== gameGuid) createOrOpenBinding(gameGuid)
    if (!draftBinding.value) return false
    const group = draftBinding.value.groups.find((item) => item.id === groupId)
    if (!group?.virtualStation) return false
    if (stationPlanId && group.virtualStation.id !== stationPlanId) return false
    group.virtualStation = undefined
    draftBinding.value.updatedAt = Date.now()
    return true
  }

  function importEmpireStationToSaveStation(gameGuid: string, saveStationCode: string, station: StationPlan, groupId?: string | null) {
    return upsertSaveStationPlan({
      gameGuid,
      saveStationCode,
      groupId,
      name: station.name,
      modules: station.modules,
      settings: station.settings
    })
  }

  function loadData(data: SavedSaveBindingsState) {
    savedBindings.value = normalizeState(data)
    writeState()
    if (savedBindings.value.activeGameGuid) loadDraft(savedBindings.value.activeGameGuid)
  }

  return {
    savedBindings,
    bindings,
    activeGameGuid,
    activeBinding,
    draftBinding,
    isDirty,
    isInitialized,
    initialize,
    getBindingByGameGuid,
    createOrOpenBinding,
    setActiveBinding,
    setSelectedArchiveTime,
    setSourceEmpire,
    saveBinding,
    discardChanges,
    createGroup,
    updateGroup,
    deleteGroup,
    bindSectorGroup,
    setGroupConnection,
    upsertSaveStationPlan,
    clearSaveStationPlan,
    deleteStationPlan,
    setVirtualStationPosition,
    createVirtualStation,
    upsertVirtualTradestation,
    deleteVirtualStation,
    importEmpireStationToSaveStation,
    loadData,
    writeState
  }
})
