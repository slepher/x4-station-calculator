import type { X4Module, StationPlan, BindingStationPlan } from '@/types/x4'
import type { PlayerStationEntry } from '@/types/saveArchive'
import type { StationSemanticDerived } from '@/store/state/StationDerivedMap'
import { classifyPlayerStationPoi, buildAggregatedModulesFromStationPlan, getFactoryGroup, getProductionProfile } from './stationPoiSemantics'

export interface BuildSemanticsDeps {
  modulesMap: Record<string, X4Module>
}

export function buildStationSemantics(
  station: StationPlan | BindingStationPlan,
  deps: BuildSemanticsDeps
): StationSemanticDerived {
  const aggregatedModules = buildAggregatedModulesFromStationPlan(station, deps.modulesMap)
  const classification = classifyPlayerStationPoi({
    modules: aggregatedModules,
    modulesMap: deps.modulesMap,
    isHeadquarter: false
  })

  return {
    tag: classification.tag,
    factoryGroup: classification.factoryGroup,
    productionProfile: classification.productionProfile,
    profileName: classification.profileName
  }
}

export function buildArchiveSemantics(
  archiveEntry: PlayerStationEntry,
  deps: BuildSemanticsDeps
): StationSemanticDerived {
  const existingTag = archiveEntry.tag
  const existingFactoryGroup = archiveEntry.factoryGroup

  if (existingTag && existingFactoryGroup) {
    return {
      tag: existingTag,
      factoryGroup: existingFactoryGroup,
      productionProfile: archiveEntry.productionProfile,
      profileName: archiveEntry.profileName
    }
  }

  const modulesArray = archiveEntry.modules || []

  if (modulesArray.length === 0) {
    return { tag: existingTag || 'constructionsite', factoryGroup: existingFactoryGroup }
  }

  const fallbackFactoryGroup = existingFactoryGroup || getFactoryGroup(modulesArray)
  const fallbackProfile = getProductionProfile(modulesArray, deps.modulesMap)

  return {
    tag: existingTag || 'factory',
    factoryGroup: fallbackFactoryGroup,
    productionProfile: fallbackProfile.productionProfile || archiveEntry.productionProfile,
    profileName: fallbackProfile.profileName || archiveEntry.profileName
  }
}
