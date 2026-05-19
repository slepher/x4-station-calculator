import { computed, type Ref, type ComputedRef } from 'vue'
import type {
  EmpirePlan,
  SaveBindingPlan,
  EmpireGroupedFlows,
  EmpireWareFlow,
  SectorInternalData,
  SupplyPlanningInput,
  X4Module,
  X4Ware
} from '@/types/x4'
import type { WareProductionFlow, DerivedProductionFlow } from '@/types/production-flow'
import { deriveProductionFlows, type CalculateWareFlowDerivedInput } from './calculateWareFlowDerived'
import { buildStationComponentGapFlows, type StationComponentGapFlows } from './stationGapViewModel'
import { readSaveBindingAggregatedFlows, buildTransitHubsFromBinding } from './liveProductionFlows'
import { StationDerivedMap } from '@/store/state/StationDerivedMap'
import type { EmpireSourceView } from './empireSourceView'

export interface EmpireFlowFacadeDeps {
  productionSource: Ref<'empire' | 'save-binding'>
  activeEmpire: Ref<EmpirePlan | null>
  activeBinding: Ref<SaveBindingPlan | null>
  sourceView: EmpireSourceView
  modulesMap: Ref<Record<string, X4Module> | null>
  waresMap: Ref<Record<string, X4Ware> | null>
  flowMap: Ref<StationDerivedMap | null> | ComputedRef<StationDerivedMap | null>
}

export interface EmpireFlowFacade {
  empireGroupedFlows: ComputedRef<EmpireGroupedFlows>
  sectorInternalDataMap: ComputedRef<Map<string, SectorInternalData>>
  getSupplyPlanningInput: (sectorId: string) => SupplyPlanningInput
  getSectorInternalData: (sectorId: string) => SectorInternalData
  getSectorFinalProductionFlows: (sectorId: string) => WareProductionFlow[]
  getStationComponentGapFlows: (stationId: string | null, activeStationId: string | null) => StationComponentGapFlows
  deriveFlows: (
    productionFlows: WareProductionFlow[],
    settings: CalculateWareFlowDerivedInput['settings'],
    warePriorityLevels?: Record<string, number>,
    volumeContributionMethod?: 'sum' | 'max'
  ) => DerivedProductionFlow[]
}

export function classifyAndEnrichFlows(
  flows: WareProductionFlow[],
  waresMap: Record<string, X4Ware>
): EmpireGroupedFlows {
  const supply: EmpireWareFlow[] = []
  const operations: EmpireWareFlow[] = []

  for (const flow of flows) {
    const isWorkforce = flow.contributions.some(c => c.class === 'workforce' || c.class === 'workforce_idle')
    const isNonContainer = flow.transportType !== 'container'
    const category = (isWorkforce || isNonContainer) ? 'supply' : 'operations'

    const ware = waresMap[flow.wareId]
    const empireFlow: EmpireWareFlow = {
      wareId: flow.wareId,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      transportType: flow.transportType,
      unitVolume: flow.unitVolume,
      production: flow.production,
      consumption: flow.consumption,
      netRate: flow.netRate,
      minPrice: ware?.minPrice || 0,
      avgPrice: ware?.price || 0,
      maxPrice: ware?.maxPrice || 0,
      contributions: flow.contributions
    }

    if (category === 'supply') supply.push(empireFlow)
    else operations.push(empireFlow)
  }

  const allFlows = [...operations, ...supply].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
    if (a.tier !== b.tier) return b.tier - a.tier
    return Math.abs(b.netRate) - Math.abs(a.netRate)
  })

  return { flows: allFlows, empireGroups: { operations, supply } }
}

function createEmptyEmpireGroupedFlows(): EmpireGroupedFlows {
  return {
    flows: [],
    empireGroups: {
      operations: [],
      supply: []
    }
  }
}





export function createEmpireFlowFacade(deps: EmpireFlowFacadeDeps): EmpireFlowFacade {
  const {
    productionSource,
    activeEmpire,
    activeBinding,
    sourceView,
    modulesMap,
    waresMap,
    flowMap: inputFlowMap
  } = deps

  const derivedBindingStations = sourceView.derivedBindingStations
  const productionStations = sourceView.productionStations
  const productionSectors = sourceView.productionSectors
  const sectors = sourceView.sectors
  const sectorLinks = sourceView.sectorLinks
  const orderedStationsBySector = sourceView.orderedStationsBySector

  const empireGroupedFlows = computed<EmpireGroupedFlows>(() => {
    const flowMap = inputFlowMap.value
    if (!flowMap) return createEmptyEmpireGroupedFlows()
    if (productionSource.value === 'save-binding') {
      const binding = activeBinding.value
      if (!binding || !waresMap.value) {
        return createEmptyEmpireGroupedFlows()
      }
      const stations = derivedBindingStations.value.map((item) => item.station)
      const transitHubs = buildTransitHubsFromBinding(binding.groups)
      const result = readSaveBindingAggregatedFlows({
        stations,
        waresMap: waresMap.value,
        getCache: (stationId) => flowMap.getCache(stationId)
      }, { transitHubs })
      return result.groupedFlows
    }
    
    if (!activeEmpire.value || !waresMap.value) {
      return createEmptyEmpireGroupedFlows()
    }

    const rawFlows = flowMap.getEmpireFlows()
    return classifyAndEnrichFlows(rawFlows, waresMap.value)
  })

  const rawSectorGroupedFlowsMap = computed<Map<string, EmpireGroupedFlows>>(() => {
    const map = new Map<string, EmpireGroupedFlows>()
    const flowMap = inputFlowMap.value
    if (!flowMap) return map
    if (!waresMap.value) return map

    const sectorList = productionSectors.value

    sectorList.forEach((sector) => {
      const rawFlows = flowMap.getSectorFlows(sector.id)
      map.set(sector.id, classifyAndEnrichFlows(rawFlows, waresMap.value!))
    })

    return map
  })

  const sectorInternalDataMap = computed<Map<string, SectorInternalData>>(() => {
    const map = new Map<string, SectorInternalData>()
    const flowMap = inputFlowMap.value
    if (!flowMap) return map
    if (!modulesMap.value) return map

    const stations = productionStations.value
    const sectorList = productionSectors.value

    sectorList.forEach((sector) => {
      const localStationIds = stations
        .filter((station) => station.sectorId === sector.id)
        .map((station) => station.id)

      const rawGroupedFlows = rawSectorGroupedFlowsMap.value.get(sector.id) || createEmptyEmpireGroupedFlows()

      map.set(sector.id, {
        sectorId: sector.id,
        planning: {
          sectorId: sector.id,
          localStationIds
        },
        localGroupedFlows: rawGroupedFlows,
        storageModulePlans: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: []
      })
    })

    return map
  })

  function getSupplyPlanningInput(sectorId: string): SupplyPlanningInput {
    if (!inputFlowMap.value) {
      return {
        sectorId,
        localStationIds: []
      }
    }
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal.planning
    return {
      sectorId,
      localStationIds: []
    }
  }

  function getSectorInternalData(sectorId: string): SectorInternalData {
    if (!inputFlowMap.value) {
      return {
        sectorId,
        planning: getSupplyPlanningInput(sectorId),
        localGroupedFlows: createEmptyEmpireGroupedFlows(),
        storageModulePlans: [],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: []
      }
    }
    const internal = sectorInternalDataMap.value.get(sectorId)
    if (internal) return internal
    return {
      sectorId,
      planning: getSupplyPlanningInput(sectorId),
      localGroupedFlows: createEmptyEmpireGroupedFlows(),
      storageModulePlans: [],
      autoIndustryModules: [],
      autoHabitationModules: [],
      autoInfrastructureModules: []
    }
  }

  function deriveFlows(
    flows: WareProductionFlow[],
    settings: CalculateWareFlowDerivedInput['settings'],
    warePriorityLevels?: Record<string, number>,
    volumeContributionMethod?: 'sum' | 'max'
  ): DerivedProductionFlow[] {
    return deriveProductionFlows({
      productionFlows: flows,
      autoIndustryModules: [],
      plannedModules: [],
      modulesMap: modulesMap.value || {},
      waresMap: waresMap.value || {},
      stationNameMap: Object.fromEntries(productionStations.value.map(s => [s.id, s.name])),
      sectorNameMap: Object.fromEntries(sectors.value.map(s => [s.id, s.name])),
      settings,
      warePriorityLevels: warePriorityLevels || {},
      volumeContributionMethod
    })
  }

  function getSectorFinalProductionFlows(sectorId: string): WareProductionFlow[] {
    if (!inputFlowMap.value) return []
    return inputFlowMap.value.getSectorCombinedFlows(sectorId)
  }

  function getStationComponentGapFlows(stationId: string | null, activeStationId: string | null): StationComponentGapFlows {
    if (!inputFlowMap.value) {
      return { operations: [], supply: [] }
    }
    const effectiveStationId = stationId || activeStationId || null
    if (!effectiveStationId) {
      return { operations: [], supply: [] }
    }

    const station = productionStations.value.find((item) => item.id === effectiveStationId)
    const currentSectorId = station?.sectorId || ''
    if (!currentSectorId) {
      return { operations: [], supply: [] }
    }

    return buildStationComponentGapFlows({
      currentSectorId,
      sectors: sectors.value,
      sectorLinks: sectorLinks.value,
      orderedStations: orderedStationsBySector.value,
      sectorInternalDataMap: sectorInternalDataMap.value
    })
  }

  return {
    empireGroupedFlows,
    sectorInternalDataMap,
    getSupplyPlanningInput,
    getSectorInternalData,
    getSectorFinalProductionFlows,
    getStationComponentGapFlows,
    deriveFlows
  }
}
