import { type Ref } from 'vue'
import type {
  EmpirePlan,
  SaveBindingPlan,
  GroupSaveBinding,
  StationSaveBinding,
  CoverageSectorEntry
} from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'

function createDefaultSaveBindingPlan(gameGuid: string): SaveBindingPlan {
  return {
    gameGuid,
    active: true,
    selectedArchiveTime: null,
    groupBindings: []
  }
}

function createDefaultGroupSaveBinding(sectorGroupId: string): GroupSaveBinding {
  return {
    sectorGroupId,
    jumpRange: 3,
    coverageSectorMacros: [],
    stationBindings: []
  }
}

export interface SaveBindingActions {
  getActiveBinding: () => SaveBindingPlan | null
  getBindingByGameGuid: (gameGuid: string) => SaveBindingPlan | null
  createBinding: (gameGuid: string) => SaveBindingPlan
  setActiveBinding: (gameGuid: string | null) => void
  setSelectedArchiveTime: (gameGuid: string, archiveTime: number | null) => void
  bindSectorGroup: (input: {
    gameGuid: string
    sectorGroupId: string
    sectorMacro?: string
    jumpRange: number
    coverageSectorMacros: CoverageSectorEntry[]
  }) => void
  updateSectorGroupJumpRange: (gameGuid: string, sectorGroupId: string, jumpRange: number) => void
  clearSectorGroupBinding: (gameGuid: string, sectorGroupId: string) => void
  getGroupBinding: (gameGuid: string, sectorGroupId: string) => GroupSaveBinding | null
  setTradestationBinding: (input: {
    gameGuid: string
    sectorGroupId: string
    saveStationCode?: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }) => void
  clearTradestationBinding: (gameGuid: string, sectorGroupId: string) => void
  bindTradestationToSaveStation: (input: {
    gameGuid: string
    sectorGroupId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }) => void
  clearTradestationCode: (gameGuid: string, sectorGroupId: string) => void
  bindStationToSaveStation: (input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }) => boolean
  clearStationBinding: (gameGuid: string, sectorGroupId: string, stationId: string) => void
  setStationBindingPosition: (gameGuid: string, sectorGroupId: string, stationId: string, position: { x: number; y: number; z: number } | null) => void
  isSaveStationAlreadyBound: (gameGuid: string, sectorGroupId: string, saveStationCode: string) => boolean
  importSaveStationAsBinding: (input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    saveStation: PlayerStationEntry
    sectorMacro: string
  }) => void
  deleteBinding: (gameGuid: string) => void
  setFreeSectorBinding: (input: {
    gameGuid: string
    sectorGroupId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
    jumpRange?: number
    coverageSectorMacros?: CoverageSectorEntry[]
  }) => void
  setFreeStationBinding: (input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
  }) => void
}

export function createSaveBindingActions(
  activeEmpire: Ref<EmpirePlan | null>,
  onDirty: () => void,
  updateStationSector: (stationId: string, sectorId: string | null) => void
): SaveBindingActions {
  function getBindings(): SaveBindingPlan[] {
    return activeEmpire.value?.saveBindings || []
  }

  function getActiveBinding(): SaveBindingPlan | null {
    return getBindings().find((b) => b.active) || null
  }

  function getBindingByGameGuid(gameGuid: string): SaveBindingPlan | null {
    return getBindings().find((b) => b.gameGuid === gameGuid) || null
  }

  function createBinding(gameGuid: string): SaveBindingPlan {
    if (!activeEmpire.value) {
      throw new Error('No active empire')
    }

    const existing = getBindingByGameGuid(gameGuid)
    if (existing) {
      if (!existing.active) {
        getBindings().forEach((b) => { b.active = false })
        existing.active = true
        onDirty()
      }
      return existing
    }

    const newPlan = createDefaultSaveBindingPlan(gameGuid)
    if (!activeEmpire.value.saveBindings) {
      activeEmpire.value.saveBindings = []
    }
    getBindings().forEach((b) => { b.active = false })
    activeEmpire.value.saveBindings.push(newPlan)
    onDirty()
    return newPlan
  }

  function setActiveBinding(gameGuid: string | null): void {
    getBindings().forEach((b) => {
      b.active = b.gameGuid === gameGuid
    })
    onDirty()
  }

  function setSelectedArchiveTime(gameGuid: string, archiveTime: number | null): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return
    plan.selectedArchiveTime = archiveTime
    onDirty()
  }

  function bindSectorGroup(input: {
    gameGuid: string
    sectorGroupId: string
    sectorMacro?: string
    jumpRange: number
    coverageSectorMacros: CoverageSectorEntry[]
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    const existingIndex = plan.groupBindings.findIndex(
      (binding) => binding.sectorGroupId === input.sectorGroupId
    )

    const newBinding: GroupSaveBinding = {
      sectorGroupId: input.sectorGroupId,
      sectorMacro: input.sectorMacro,
      jumpRange: input.jumpRange,
      coverageSectorMacros: input.coverageSectorMacros,
      stationBindings: []
    }

    if (existingIndex >= 0) {
      const existing = plan.groupBindings[existingIndex]
      if (existing) {
        newBinding.tradestationCode = existing.tradestationCode
        newBinding.tradestationBinding = existing.tradestationBinding
        newBinding.stationBindings = existing.stationBindings
        plan.groupBindings[existingIndex] = newBinding
      }
    } else {
      plan.groupBindings.push(newBinding)
    }
    onDirty()
  }

  function updateSectorGroupJumpRange(gameGuid: string, sectorGroupId: string, jumpRange: number): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    const binding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!binding) return

    binding.jumpRange = jumpRange
    onDirty()
  }

  function clearSectorGroupBinding(gameGuid: string, sectorGroupId: string): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    plan.groupBindings = plan.groupBindings.filter((b) => b.sectorGroupId !== sectorGroupId)
    onDirty()
  }

  function getGroupBinding(gameGuid: string, sectorGroupId: string): GroupSaveBinding | null {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return null
    return plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId) || null
  }

  function setTradestationBinding(input: {
    gameGuid: string
    sectorGroupId: string
    saveStationCode?: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    if (input.saveStationCode !== undefined) {
      groupBinding.tradestationCode = input.saveStationCode
    }
    if (input.sectorMacro !== undefined) {
      if (!groupBinding.tradestationBinding) {
        groupBinding.tradestationBinding = { stationId: `tradestation_${input.sectorGroupId}` }
      }
      groupBinding.tradestationBinding.sectorMacro = input.sectorMacro
    }
    if (input.position) {
      if (!groupBinding.tradestationBinding) {
        groupBinding.tradestationBinding = { stationId: `tradestation_${input.sectorGroupId}` }
      }
      groupBinding.tradestationBinding.position = input.position
    }
    onDirty()
  }

  function clearTradestationBinding(gameGuid: string, sectorGroupId: string): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    const groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!groupBinding) return

    delete groupBinding.tradestationCode
    delete groupBinding.tradestationBinding
    onDirty()
  }

  function bindTradestationToSaveStation(input: {
    gameGuid: string
    sectorGroupId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    // Create or update tradestationBinding
    if (!groupBinding.tradestationBinding) {
      groupBinding.tradestationBinding = { stationId: `tradestation_${input.sectorGroupId}` }
    }

    groupBinding.tradestationCode = input.saveStationCode
    
    if (input.sectorMacro) {
      groupBinding.tradestationBinding.sectorMacro = input.sectorMacro
    }
    if (input.position) {
      groupBinding.tradestationBinding.position = input.position
    }

    onDirty()
  }

  function clearTradestationCode(gameGuid: string, sectorGroupId: string): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    const groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!groupBinding) return

    delete groupBinding.tradestationCode
    // Keep position, only clear the binding
    onDirty()
  }

  function bindStationToSaveStation(input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    saveStationCode: string
    sectorMacro?: string
    position?: { x: number; y: number; z: number }
  }): boolean {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return false

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    const alreadyBoundStationIndex = groupBinding.stationBindings.findIndex(
      (b) => b.saveStationCode === input.saveStationCode && b.stationId !== input.stationId
    )
    if (alreadyBoundStationIndex >= 0) {
      groupBinding.stationBindings.splice(alreadyBoundStationIndex, 1)
    }

    const existingIndex = groupBinding.stationBindings.findIndex(
      (binding) => binding.stationId === input.stationId
    )

    const newBinding: StationSaveBinding = {
      stationId: input.stationId,
      saveStationCode: input.saveStationCode,
      sectorMacro: input.sectorMacro,
      position: input.position
    }

    if (existingIndex >= 0) {
      groupBinding.stationBindings[existingIndex] = newBinding
    } else {
      groupBinding.stationBindings.push(newBinding)
    }

    // Update station.sectorId for compatibility
    updateStationSector(input.stationId, input.sectorGroupId)

    onDirty()
    return true
  }

  function clearStationBinding(gameGuid: string, sectorGroupId: string, stationId: string): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    const groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!groupBinding) return

    groupBinding.stationBindings = groupBinding.stationBindings.filter((b) => b.stationId !== stationId)
    
    // Clear station.sectorId
    updateStationSector(stationId, null)
    
    onDirty()
  }

  function setStationBindingPosition(gameGuid: string, sectorGroupId: string, stationId: string, position: { x: number; y: number; z: number } | null): void {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!groupBinding) {
      if (position) {
        groupBinding = createDefaultGroupSaveBinding(sectorGroupId)
        plan.groupBindings.push(groupBinding)
      } else {
        return
      }
    }

    const binding = groupBinding.stationBindings.find((b) => b.stationId === stationId)
    if (!binding) {
      if (position) {
        groupBinding.stationBindings.push({
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

  function isSaveStationAlreadyBound(gameGuid: string, sectorGroupId: string, saveStationCode: string): boolean {
    const plan = getBindingByGameGuid(gameGuid)
    if (!plan) return false

    const groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === sectorGroupId)
    if (!groupBinding) return false

    return groupBinding.stationBindings.some((b) => b.saveStationCode === saveStationCode)
  }

  function importSaveStationAsBinding(input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    saveStation: PlayerStationEntry
    sectorMacro: string
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    const existing = groupBinding.stationBindings.find((b) => b.stationId === input.stationId)
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

    groupBinding.stationBindings.push(newBinding)
    onDirty()
  }

  function deleteBinding(gameGuid: string): void {
    if (!activeEmpire.value?.saveBindings) return
    activeEmpire.value.saveBindings = activeEmpire.value.saveBindings.filter(
      (b) => b.gameGuid !== gameGuid
    )
    onDirty()
  }

  function setFreeSectorBinding(input: {
    gameGuid: string
    sectorGroupId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
    jumpRange?: number
    coverageSectorMacros?: CoverageSectorEntry[]
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    groupBinding.sectorMacro = input.sectorMacro
    groupBinding.jumpRange = input.jumpRange ?? 3
    groupBinding.coverageSectorMacros = input.coverageSectorMacros ?? []
    groupBinding.free = true

    if (!groupBinding.tradestationBinding) {
      groupBinding.tradestationBinding = { stationId: `tradestation_${input.sectorGroupId}` }
    }
    groupBinding.tradestationBinding.position = input.position
    onDirty()
  }

  function setFreeStationBinding(input: {
    gameGuid: string
    sectorGroupId: string
    stationId: string
    sectorMacro: string
    position: { x: number; y: number; z: number }
  }): void {
    const plan = getBindingByGameGuid(input.gameGuid)
    if (!plan) return

    let groupBinding = plan.groupBindings.find((b) => b.sectorGroupId === input.sectorGroupId)
    if (!groupBinding) {
      groupBinding = createDefaultGroupSaveBinding(input.sectorGroupId)
      plan.groupBindings.push(groupBinding)
    }

    const existingIndex = groupBinding.stationBindings.findIndex(
      (b) => b.stationId === input.stationId
    )
    const existingBinding = existingIndex >= 0 ? groupBinding.stationBindings[existingIndex] : undefined

    const newBinding: StationSaveBinding = {
      stationId: input.stationId,
      saveStationCode: existingBinding?.saveStationCode,
      sectorMacro: input.sectorMacro,
      position: input.position,
      free: existingBinding?.free ?? true
    }

    if (existingIndex >= 0) {
      groupBinding.stationBindings[existingIndex] = newBinding
    } else {
      groupBinding.stationBindings.push(newBinding)
    }
    updateStationSector(input.stationId, input.sectorGroupId)
    onDirty()
  }

  return {
    getActiveBinding,
    getBindingByGameGuid,
    createBinding,
    setActiveBinding,
    setSelectedArchiveTime,
    bindSectorGroup,
    updateSectorGroupJumpRange,
    clearSectorGroupBinding,
    getGroupBinding,
    setTradestationBinding,
    clearTradestationBinding,
    bindTradestationToSaveStation,
    clearTradestationCode,
    bindStationToSaveStation,
    clearStationBinding,
    setStationBindingPosition,
    isSaveStationAlreadyBound,
    importSaveStationAsBinding,
    deleteBinding,
    setFreeSectorBinding,
    setFreeStationBinding
  }
}
