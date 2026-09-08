import { computed } from 'vue'
import { useBlueprintProductionStore } from '@/store/useBlueprintProductionStore'
import type { MapStationPanelItem } from '@/components/map/MapStationPanel.vue'
import type { EntityLocation } from '@/types/x4'

export function useMapStationPresenter() {
  const blueprintStore = useBlueprintProductionStore()

  const items = computed<MapStationPanelItem[]>(() => {
    const empire = blueprintStore.activeEmpire
    if (!empire) return []

    const sectors = (empire.sectors || []).map((sector) => ({
      id: sector.id,
      kind: 'sector' as const,
      name: sector.name,
      icon: 'tradestation' as const,
      groupId: 'sectors',
      groupName: 'Sectors',
      location: sector.location
    }))
    const stations = empire.stations
      .filter((station) => station.modules.length > 0)
      .map((station) => ({
        id: station.id,
        kind: 'station' as const,
        name: station.name,
        icon: station.type === 'shipyard' ? 'shipyard' as const : 'factory' as const,
        groupId: station.sectorId || 'stations',
        groupName: station.sectorId || 'Stations',
        location: station.location
      }))
    return [...stations, ...sectors]
  })

  const setLocation = (item: MapStationPanelItem, location: EntityLocation | null): boolean => {
    if (item.kind === 'station') return blueprintStore.setStationLocation(item.id, location)
    return blueprintStore.setSectorLocation(item.id, location)
  }

  return { items, setLocation }
}
