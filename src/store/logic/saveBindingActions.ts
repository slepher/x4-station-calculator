import type { Ref } from 'vue'
import type {
  SavedEmpiresState,
  SaveBindingPlanState,
  SaveBindingPlan,
  GroupSaveBinding,
  StationSaveBinding
} from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'

function createSaveBindingKey(empireId: string, gameGuid: string): string {
  return `${empireId}:${gameGuid}`
}

function createDefaultSaveBindingPlan(empireId: string, gameGuid: string): SaveBindingPlan {
  return {
    key: createSaveBindingKey(empireId, gameGuid),
    empireId,
    gameGuid,
    selectedArchiveTime: null,
    groupBindings: [],
    stationBindings: []
  }
}

function createDefaultSaveBindingPlanState(): SaveBindingPlanState {
  return {
    version: 1,
    activeBindingKeyByEmpire: {},
    list: []
  }
}

export interface SaveBindingActions {
  savePlans: Readonly<Ref<SaveBindingPlanState>>
  bindingPlans: Readonly<Ref<SaveBindingPlan[]>>
  getBindingPlanByKey: (bindingKey: string) => SaveBindingPlan | null
  getActiveBindingKeyForEmpire: (empireId: string) => string | null
  getActiveBindingPlanForEmpire: (empireId: string) => SaveBindingPlan | null
  getBindingPlansForEmpire: (empireId: string) => SaveBindingPlan[]
  createSaveBindingPlan: (empireId: string, gameGuid: string) => SaveBindingPlan
  selectSaveBindingPlan: (empireId: string, bindingKey: string | null) => void
  setSelectedArchiveTime: (bindingKey: string, archiveTime: number | null) => void
  bindSectorGroupHub: (input: {
    bindingKey: string
    sectorGroupId: string
    tradestationCode: string
    sectorMacro: string
    jumpRange: number
    coverageSectorMacros: string[]
  }) => void
  updateSectorGroupJumpRange: (bindingKey: string, sectorGroupId: string, jumpRange: number) => void
  clearSectorGroupHubBinding: (bindingKey: string, sectorGroupId: string) => void
  bindStationToSaveStation: (input: {
    bindingKey: string
    stationId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }) => boolean
  clearStationBinding: (bindingKey: string, stationId: string) => void
  setStationBindingPosition: (bindingKey: string, stationId: string, position: { x: number; y: number; z: number } | null) => void
  isSaveStationAlreadyBound: (bindingKey: string, saveStationCode: string) => boolean
  importSaveStationAsBinding: (input: {
    bindingKey: string
    stationId: string
    saveStation: PlayerStationEntry
    sectorMacro: string
  }) => void
  deleteBindingPlan: (bindingKey: string) => void
  deleteBindingPlansForEmpire: (empireId: string) => void
}

export function createSaveBindingActions(
  savedEmpires: Ref<SavedEmpiresState>,
  onDirty: () => void
): SaveBindingActions {
  const savePlans = computed<SaveBindingPlanState>(() => {
    return savedEmpires.value.savePlans || createDefaultSaveBindingPlanState()
  })

  const bindingPlans = computed<SaveBindingPlan[]>(() => savePlans.value.list)

  function getBindingPlanByKey(bindingKey: string): SaveBindingPlan | null {
    return savePlans.value.list.find((plan) => plan.key === bindingKey) || null
  }

  function getActiveBindingKeyForEmpire(empireId: string): string | null {
    return savePlans.value.activeBindingKeyByEmpire[empireId] || null
  }

  function getActiveBindingPlanForEmpire(empireId: string): SaveBindingPlan | null {
    const bindingKey = getActiveBindingKeyForEmpire(empireId)
    if (!bindingKey) return null
    return getBindingPlanByKey(bindingKey)
  }

  function getBindingPlansForEmpire(empireId: string): SaveBindingPlan[] {
    return savePlans.value.list.filter((plan) => plan.empireId === empireId)
  }

  function createSaveBindingPlan(empireId: string, gameGuid: string): SaveBindingPlan {
    const existing = savePlans.value.list.find(
      (plan) => plan.empireId === empireId && plan.gameGuid === gameGuid
    )
    if (existing) return existing

    const newPlan = createDefaultSaveBindingPlan(empireId, gameGuid)
    if (!savedEmpires.value.savePlans) {
      savedEmpires.value.savePlans = createDefaultSaveBindingPlanState()
    }
    savedEmpires.value.savePlans.list.push(newPlan)
    savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId] = newPlan.key
    onDirty()
    return newPlan
  }

  function selectSaveBindingPlan(empireId: string, bindingKey: string | null): void {
    if (!savedEmpires.value.savePlans) {
      savedEmpires.value.savePlans = createDefaultSaveBindingPlanState()
    }
    if (bindingKey === null) {
      savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId] = null
      onDirty()
      return
    }

    const plan = getBindingPlanByKey(bindingKey)
    if (!plan || plan.empireId !== empireId) return

    savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId] = bindingKey
    onDirty()
  }

  function setSelectedArchiveTime(bindingKey: string, archiveTime: number | null): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return
    plan.selectedArchiveTime = archiveTime
    onDirty()
  }

  function bindSectorGroupHub(input: {
    bindingKey: string
    sectorGroupId: string
    tradestationCode: string
    sectorMacro: string
    jumpRange: number
    coverageSectorMacros: string[]
  }): void {
    const plan = getBindingPlanByKey(input.bindingKey)
    if (!plan) return

    const existingIndex = plan.groupBindings.findIndex(
      (binding) => binding.sectorGroupId === input.sectorGroupId
    )

    const newBinding: GroupSaveBinding = {
      sectorGroupId: input.sectorGroupId,
      tradestationCode: input.tradestationCode,
      sectorMacro: input.sectorMacro,
      jumpRange: input.jumpRange,
      coverageSectorMacros: input.coverageSectorMacros
    }

    if (existingIndex >= 0) {
      plan.groupBindings[existingIndex] = newBinding
    } else {
      plan.groupBindings.push(newBinding)
    }
    onDirty()
  }

  function updateSectorGroupJumpRange(bindingKey: string, sectorGroupId: string, jumpRange: number): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return

    const binding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!binding) return

    binding.jumpRange = jumpRange
    onDirty()
  }

  function clearSectorGroupHubBinding(bindingKey: string, sectorGroupId: string): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return

    plan.groupBindings = plan.groupBindings.filter((b) => b.sectorGroupId !== sectorGroupId)
    onDirty()
  }

  function bindStationToSaveStation(input: {
    bindingKey: string
    stationId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): boolean {
    const plan = getBindingPlanByKey(input.bindingKey)
    if (!plan) return false

    const alreadyBoundStation = plan.stationBindings.find(
      (b) => b.saveStationCode === input.saveStationCode && b.stationId !== input.stationId
    )
    if (alreadyBoundStation) {
      return false
    }

    const existingIndex = plan.stationBindings.findIndex(
      (binding) => binding.stationId === input.stationId
    )

    const newBinding: StationSaveBinding = {
      stationId: input.stationId,
      saveStationCode: input.saveStationCode,
      sectorMacro: input.sectorMacro,
      position: input.position
    }

    if (existingIndex >= 0) {
      plan.stationBindings[existingIndex] = newBinding
    } else {
      plan.stationBindings.push(newBinding)
    }

    onDirty()
    return true
  }

  function clearStationBinding(bindingKey: string, stationId: string): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return

    plan.stationBindings = plan.stationBindings.filter((b) => b.stationId !== stationId)
    onDirty()
  }

  function setStationBindingPosition(bindingKey: string, stationId: string, position: { x: number; y: number; z: number } | null): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return

    const binding = plan.stationBindings.find((b) => b.stationId === stationId)
    if (!binding) {
      if (position) {
        plan.stationBindings.push({
          stationId,
          position
        })
      }
    } else {
      if (position) {
        binding.position = position
      } else {
        delete binding.position
      }
    }
    onDirty()
  }

  function isSaveStationAlreadyBound(bindingKey: string, saveStationCode: string): boolean {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return false

    return plan.stationBindings.some((b) => b.saveStationCode === saveStationCode)
  }

  function importSaveStationAsBinding(input: {
    bindingKey: string
    stationId: string
    saveStation: PlayerStationEntry
    sectorMacro: string
  }): void {
    const plan = getBindingPlanByKey(input.bindingKey)
    if (!plan) return

    const existing = plan.stationBindings.find((b) => b.stationId === input.stationId)
    if (existing) return

    const newBinding: StationSaveBinding = {
      stationId: input.stationId,
      saveStationCode: input.saveStation.code,
      sectorMacro: input.sectorMacro,
      position: {
        x: input.saveStation.position.x,
        y: input.saveStation.position.y,
        z: input.saveStation.position.z
      }
    }

    plan.stationBindings.push(newBinding)
    onDirty()
  }

  function deleteBindingPlan(bindingKey: string): void {
    const plan = getBindingPlanByKey(bindingKey)
    if (!plan) return

    if (savedEmpires.value.savePlans) {
      savedEmpires.value.savePlans.list = savedEmpires.value.savePlans.list.filter((p) => p.key !== bindingKey)

      const empireId = plan.empireId
      if (savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId] === bindingKey) {
        savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId] = null
      }
    }
    onDirty()
  }

  function deleteBindingPlansForEmpire(empireId: string): void {
    if (savedEmpires.value.savePlans) {
      savedEmpires.value.savePlans.list = savedEmpires.value.savePlans.list.filter((p) => p.empireId !== empireId)
      delete savedEmpires.value.savePlans.activeBindingKeyByEmpire[empireId]
    }
  }

  return {
    savePlans: savePlans as Readonly<Ref<SaveBindingPlanState>>,
    bindingPlans: bindingPlans as Readonly<Ref<SaveBindingPlan[]>>,
    getBindingPlanByKey,
    getActiveBindingKeyForEmpire,
    getActiveBindingPlanForEmpire,
    getBindingPlansForEmpire,
    createSaveBindingPlan,
    selectSaveBindingPlan,
    setSelectedArchiveTime,
    bindSectorGroupHub,
    updateSectorGroupJumpRange,
    clearSectorGroupHubBinding,
    bindStationToSaveStation,
    clearStationBinding,
    setStationBindingPosition,
    isSaveStationAlreadyBound,
    importSaveStationAsBinding,
    deleteBindingPlan,
    deleteBindingPlansForEmpire
  }
}

import { computed } from 'vue'