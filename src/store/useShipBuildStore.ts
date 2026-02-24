import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type StationActiveView = 'production' | 'flow' | 'ship-build'

export const useShipBuildStore = defineStore('ship-build', () => {
  const activeView = ref<StationActiveView>(
    (localStorage.getItem('x4_station_active_view') as StationActiveView) || 'production'
  )

  watch(activeView, (val) => {
    localStorage.setItem('x4_station_active_view', val)
  })

  return {
    activeView
  }
})
