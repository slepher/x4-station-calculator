import { useGameDataStore } from '@/store/useGameDataStore'
import type { X4Map, X4MapSector } from '@/types/x4'
import { resolveMapSectorByMacro } from '../mapSectorMacro'

export interface MapSaveAddressGroup {
  sectorMacro: string
}

export interface PresentedMapSaveAddressGroup extends MapSaveAddressGroup {
  isAddressInactive: boolean
}

interface MapSaveDlcState {
  maps: X4Map
  enforceDlcActivation: boolean
  isDlcActive: (dlcTag: string) => boolean
}

export function presentMapSaveAddressGroup<T extends MapSaveAddressGroup>(
  group: T,
  dlcState: MapSaveDlcState
): T & PresentedMapSaveAddressGroup {
  if (!dlcState.enforceDlcActivation) {
    return { ...group, isAddressInactive: false }
  }

  const resolved = resolveMapSectorByMacro<X4MapSector>(dlcState.maps, group.sectorMacro)
  if (!resolved) {
    return { ...group, isAddressInactive: false }
  }

  const cluster = dlcState.maps.clusters[resolved.clusterId]
  if (!cluster) {
    return { ...group, isAddressInactive: false }
  }

  return {
    ...group,
    isAddressInactive: !dlcState.isDlcActive(cluster.dlc_tag)
  }
}

export function useMapSavePanelPresenter() {
  const gameData = useGameDataStore()

  function presentAddressGroup<T extends MapSaveAddressGroup>(group: T): T & PresentedMapSaveAddressGroup {
    return presentMapSaveAddressGroup(group, {
      maps: gameData.maps,
      enforceDlcActivation: gameData.enforceDlcActivation,
      isDlcActive: gameData.isDlcActive
    })
  }

  return { presentAddressGroup }
}
