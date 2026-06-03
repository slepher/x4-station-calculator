import { computed, type ComputedRef } from 'vue'
import type { ProductionWorkbenchCapabilities } from '@/types/production-workbench-contract'
import type { ProductionTabItem } from '@/types/production-ui'
import type { StationType } from '@/types/x4'
import i18n from '@/i18n'

export interface SidebarPresenterProps {
  tabs: ComputedRef<ProductionTabItem[]>
  activeTabId: ComputedRef<string | null>
  expandedSectorId: ComputedRef<string | null>
    hasSectors: boolean
  showTerraforming: boolean
  showTechTree: boolean
  showResearch: boolean
  showBlueprintRecipe: boolean
  canCreateStation: boolean
  terraformingClusters: ComputedRef<{ id: string; nameId: string }[]>
  activeTerraformingClusterId: ComputedRef<string | null>
  canOpenContextMenu: boolean
  contextMenuMode: 'full' | 'delete-only'
  canDeleteStation: (stationId: string) => boolean
}

export interface SidebarPresenterEmits {
  selectOverview: () => void
  selectTerraforming: () => void
  selectTechTree: () => void
  selectResearch: () => void
  selectBlueprintRecipe: () => void
  selectTransit: (sectorId: string) => void
  selectTerraformingCluster: (clusterId: string) => void
  selectStation: (stationId: string) => void
  createStation: () => unknown
  renameStation: (stationId: string) => void
  duplicateStation: (stationId: string) => unknown
  deleteStation: (stationId: string) => void
  expandSector: (sectorId: string | null) => void
  jumpToBinding: (tabId: string, tabType: 'station' | 'transit') => void
}

export interface UseProductionSidebarPresenterReturn {
  props: SidebarPresenterProps
  emits: SidebarPresenterEmits
}

export interface SidebarPresenterStore {
  session: {
    workbenchMode: 'overview' | 'station' | 'transit' | 'terraforming' | 'tech-tree' | 'research' | 'blueprint-recipe'
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
  selectTechTree?(): void
  selectResearch?(): void
  selectBlueprintRecipe?(): void
  selectTransitSector?(sectorId: string | null): void
  createStation(name?: string): unknown
  renameStation(stationId: string, name: string): void
  duplicateStation(stationId: string): unknown
  deleteStation(stationId: string): void
  setExpandedSector?(sectorId: string | null): void
  jumpToMapBinding?(tabId: string, tabType: 'station' | 'transit'): void
  canDeleteStation?(stationId: string): boolean
}

function getFallbackTagForStationType(type?: StationType): string | undefined {
  if (type === 'shipyard') return 'shipyard'
  if (type === 'supply' || type === 'transit') return 'tradestation'
  return undefined
}

function resolveTabSemantics(
  store: SidebarPresenterStore,
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

export function useProductionSidebarPresenter(store: SidebarPresenterStore): UseProductionSidebarPresenterReturn {
  const tabs = computed<ProductionTabItem[]>(() => {
    if (!store.capabilities.hasSectors) {
      const items: ProductionTabItem[] = [
        { id: 'overview', type: 'overview' as const, name: i18n.global.t('sector.overview') }
      ]
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
      result.push(...(grouped.get(sector.id) || []))
    })

    return result
  })

  const hasSectors = store.capabilities.hasSectors
  const showTerraforming = true
  const showTechTree = false
  const showResearch = true
  const showBlueprintRecipe = true

  const props: SidebarPresenterProps = {
    tabs,
    activeTabId: computed(() => {
      if (store.session.workbenchMode === 'terraforming') return 'terraforming'
      if (store.session.workbenchMode === 'tech-tree') return 'tech-tree'
      if (store.session.workbenchMode === 'research') return 'research'
      if (store.session.workbenchMode === 'blueprint-recipe') return 'blueprint-recipe'
      if (store.session.workbenchMode === 'transit' && store.session.activeTransitSectorId) {
        return `transit:${store.session.activeTransitSectorId}`
      }
      if (store.session.workbenchMode === 'overview') return 'overview'
      return store.session.activeStationId
    }),
    expandedSectorId: computed(() => store.expandedSectorId ?? null),
    hasSectors,
    showTerraforming,
    showTechTree,
    showResearch,
    showBlueprintRecipe,
    canCreateStation: !store.capabilities.uniqueStation,
    canOpenContextMenu: !store.capabilities.uniqueStation || (store.capabilities.uniqueStation && !store.archiveStation),
    contextMenuMode: store.capabilities.uniqueStation ? 'delete-only' : 'full',
    canDeleteStation: (stationId: string) => store.canDeleteStation?.(stationId) ?? !store.capabilities.uniqueStation,
    terraformingClusters: computed(() => []),
    activeTerraformingClusterId: computed(() => null),
  }

  const emits: SidebarPresenterEmits = {
    selectOverview: () => store.selectStation(null),
    selectTerraforming: () => (store.selectTerraforming || (() => {}))(),
    selectTechTree: () => (store.selectTechTree || (() => {}))(),
    selectResearch: () => (store.selectResearch || (() => {}))(),
    selectBlueprintRecipe: () => (store.selectBlueprintRecipe || (() => {}))(),
    selectTerraformingCluster: () => {},
    selectTransit: (sectorId: string) => (store.selectTransitSector || (() => {}))(sectorId),
    selectStation: (stationId: string) => store.selectStation(stationId),
    createStation: () => store.createStation(),
    renameStation: (stationId: string) => store.renameStation(stationId, ''),
    duplicateStation: (stationId: string) => store.duplicateStation(stationId),
    deleteStation: (stationId: string) => store.deleteStation(stationId),
    expandSector: (sectorId: string | null) => (store.setExpandedSector || (() => {}))(sectorId),
    jumpToBinding: (tabId: string, tabType: 'station' | 'transit') => {
      ;(store.jumpToMapBinding || (() => {}))(tabId, tabType)
    }
  }

  return { props, emits }
}
