import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SavedEmpiresState, EmpirePlan, StationType } from '@/types/x4'
import { useGameDataStore } from './useGameDataStore'
import { CURRENT_EMPIRE_VERSION } from './logic/storageVersions'

function createDefaultEmpire(name: string = ''): EmpirePlan {
  return {
    id: crypto.randomUUID(),
    name,
    sectors: [],
    sectorLinks: [],
    stations: []
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
    activeStationId: null,
    list: []
  })

  const version = computed(() => savedEmpires.value.version)
  const empires = computed(() => savedEmpires.value.list)
  const activeId = computed({
    get: () => savedEmpires.value.activeId,
    set: (id: string | null) => { savedEmpires.value.activeId = id }
  })
  const persistedActiveStationId = computed({
    get: () => savedEmpires.value.activeStationId,
    set: (id: string | null) => { savedEmpires.value.activeStationId = id }
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

  function setPersistedActiveStationId(id: string | null): void {
    savedEmpires.value.activeStationId = id
  }

  return {
    savedEmpires,
    version,
    empires,
    activeId,
    persistedActiveStationId,
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
    setPersistedActiveStationId
  }
})