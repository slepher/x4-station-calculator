import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchCapabilities } from '@/types/production-workbench-contract'
import type { ProductionTabItem } from '@/types/production-ui'
import type { StationType } from '@/types/x4'
import i18n from '@/i18n'

export interface TabbarPresenterProps {
  tabs: ComputedRef<ProductionTabItem[]>
  activeTabId: ComputedRef<string | null>
  expandedSectorId: ComputedRef<string | null>
  canCreateStation: boolean
  canOpenContextMenu: boolean
  contextMenuMode: 'full' | 'delete-only'
}

export interface TabbarPresenterEmits {
  selectOverview: () => void
  selectTerraforming: () => void
  selectTransit: (sectorId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => unknown
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => unknown
  deleteStation: (stationId: string) => void
  expandSector: (sectorId: string | null) => void
}

export interface UseProductionTabbarPresenterReturn {
  props: TabbarPresenterProps
  emits: TabbarPresenterEmits
}

export interface TabbarPresenterStore {
  session: {
    workbenchMode: 'overview' | 'station' | 'transit' | 'terraforming'
    activeStationId: string | null
    activeTransitSectorId: string | null
  }
  capabilities: ProductionWorkbenchCapabilities
  archiveStation?: unknown | null
  orderedStations?: Array<{
    id: string
    name: string
    sectorId?: string | null
    type?: StationType
    tag?: string
    factoryGroup?: string
  }>
  sectors?: Array<{
    id: string
    name: string
  }>
  orderedStationsBySector?: Array<{
    id: string
    name: string
    sectorId?: string | null
    type?: StationType
    tag?: string
    factoryGroup?: string
  }>
  tabSemanticsById?: Record<string, { tag?: string; factoryGroup?: string }>
  expandedSectorId?: string | null
  selectStation(stationId: string | null): void
  selectTerraforming?(): void
  selectTransitSector?(sectorId: string | null): void
  createStation(name?: string): unknown
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): unknown
  deleteStation(stationId: string): void
  setExpandedSector?(sectorId: string | null): void
}

function getFallbackTagForStationType(type?: StationType): string | undefined {
  if (type === 'shipyard') return 'shipyard'
  if (type === 'supply' || type === 'transit') return 'tradestation'
  return undefined
}

function resolveTabSemantics(
  store: TabbarPresenterStore,
  station: {
    type?: StationType
    tag?: string
    factoryGroup?: string
  },
  stationId: string
) {
  const semantics = store.tabSemanticsById?.[stationId]
  const tag = semantics?.tag ?? station.tag ?? getFallbackTagForStationType(station.type)
  const factoryGroup = semantics?.factoryGroup ?? station.factoryGroup
  return { tag, factoryGroup }
}

export function useProductionTabbarPresenter(store: TabbarPresenterStore): UseProductionTabbarPresenterReturn {
  const tabs = computed<ProductionTabItem[]>(() => {
    if (!store.capabilities.hasSectors) {
      const items: ProductionTabItem[] = [
        { id: 'overview', type: 'overview' as const, name: i18n.global.t('sector.overview') }
      ]
      if (store.selectTerraforming) {
        items.push({ id: 'terraforming', type: 'terraforming' as const, name: '地球化' })
      }
      items.push(...(store.orderedStations || []).map((station) => ({
        id: station.id,
        type: 'station' as const,
        name: station.name,
        sectorId: station.sectorId ?? undefined,
        stationType: station.type,
        ...resolveTabSemantics(store, station, station.id)
      })))
      return items
    }

    const result: ProductionTabItem[] = [
      { id: 'overview', type: 'overview', name: i18n.global.t('sector.overview') }
    ]
    if (store.selectTerraforming) {
      result.push({ id: 'terraforming', type: 'terraforming', name: '地球化' })
    }

    const grouped = new Map<string, ProductionTabItem[]>()
    const stations = store.orderedStationsBySector || []
    stations.forEach((station) => {
      const sectorId = station.sectorId || ''
      const item: ProductionTabItem = {
        id: station.id,
        type: 'station',
        name: station.name,
        sectorId: station.sectorId ?? undefined,
        stationType: station.type,
        ...resolveTabSemantics(store, station, station.id)
      }
      if (!sectorId) {
        result.push(item)
        return
      }
      const arr = grouped.get(sectorId) || []
      arr.push(item)
      grouped.set(sectorId, arr)
    })

    ;(store.sectors || []).forEach((sector) => {
      result.push({
        id: `transit:${sector.id}`,
        type: 'transit',
        name: sector.name,
        sectorId: sector.id
      })
      if (store.expandedSectorId === sector.id) {
        result.push(...(grouped.get(sector.id) || []))
      }
    })

    return result
  })

  const props: TabbarPresenterProps = {
    tabs,
    activeTabId: computed(() => {
      if (store.session.workbenchMode === 'terraforming') return 'terraforming'
      if (store.session.workbenchMode === 'transit' && store.session.activeTransitSectorId) {
        return `transit:${store.session.activeTransitSectorId}`
      }
      if (store.session.workbenchMode === 'overview') return 'overview'
      return store.session.activeStationId
    }),
    expandedSectorId: computed(() => store.expandedSectorId ?? null),
    canCreateStation: !store.capabilities.uniqueStation,
    canOpenContextMenu: !store.capabilities.uniqueStation || (store.capabilities.uniqueStation && !store.archiveStation),
    contextMenuMode: store.capabilities.uniqueStation ? 'delete-only' : 'full'
  }

  const emits: TabbarPresenterEmits = {
    selectOverview: () => store.selectStation(null),
    selectTerraforming: () => (store.selectTerraforming || (() => {}))(),
    selectTransit: (sectorId: string) => (store.selectTransitSector || (() => {}))(sectorId),
    selectStation: (stationId: string) => store.selectStation(stationId),
    createStation: () => store.createStation(),
    renameStation: (stationId: string) => store.renameStation(stationId, ''),
    duplicateStation: (stationId: string) => store.duplicateStation(stationId),
    deleteStation: (stationId: string) => store.deleteStation(stationId),
    expandSector: (sectorId: string | null) => (store.setExpandedSector || (() => {}))(sectorId)
  }

  return { props, emits }
}
