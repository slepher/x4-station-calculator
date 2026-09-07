import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { X4Ship } from '@/types/x4'

export function useShipBuildSelectorPresenter() {
  const store = useShipBuildStore()
  const { selectedShipId } = storeToRefs(store)
  const pendingShipId = ref<string | null>(null)
  const selectedClass = ref<X4Ship['class'] | null>(null)
  const selectedRaces = ref<string[]>([])
  const selectedTypes = ref<string[]>([])
  const currentShip = computed(() => selectedShipId.value ? store.findShip(selectedShipId.value) : null)
  const confirmShipId = computed(() => pendingShipId.value !== null ? pendingShipId.value : selectedShipId.value)

  const restoreShipFilters = (ship: X4Ship | null | undefined) => {
    if (!ship) {
      selectedClass.value = null
      selectedRaces.value = []
      selectedTypes.value = []
      return
    }
    selectedClass.value = ship.class
    selectedRaces.value = ship.race ? [ship.race] : []
    selectedTypes.value = ship.type ? [ship.type] : []
  }

  watch(selectedShipId, () => {
    pendingShipId.value = null
    restoreShipFilters(currentShip.value)
  }, { immediate: true })

  store.$onAction(({ name, after }) => {
    if (name !== 'loadBlueprint') return
    const previousBlueprint = store.blueprint
    after(() => {
      if (store.blueprint === previousBlueprint) return
      pendingShipId.value = null
      restoreShipFilters(currentShip.value)
    })
  })

  const setSelectedClass = (value: string | null) => {
    selectedClass.value = value as X4Ship['class'] | null
  }
  const toggleRace = (value: string) => {
    selectedRaces.value = selectedRaces.value.includes(value)
      ? selectedRaces.value.filter(id => id !== value)
      : [...selectedRaces.value, value]
  }
  const toggleType = (value: string) => {
    selectedTypes.value = selectedTypes.value.includes(value)
      ? selectedTypes.value.filter(id => id !== value)
      : [...selectedTypes.value, value]
  }
  const setPendingShipId = (value: string | null) => {
    pendingShipId.value = value
  }
  const confirmPendingShip = () => {
    if (confirmShipId.value) store.setSelectedShipId(confirmShipId.value)
  }
  const handleCancelShipChange = () => {
    pendingShipId.value = null
    if (currentShip.value && selectedClass.value !== currentShip.value.class) {
      restoreShipFilters(currentShip.value)
    }
    store.cancelShipSelector()
  }

  return {
    selectedShipId, pendingShipId, selectedClass, selectedRaces, selectedTypes,
    currentShip, confirmShipId, setSelectedClass, toggleRace, toggleType,
    setPendingShipId, confirmPendingShip, handleCancelShipChange
  }
}
