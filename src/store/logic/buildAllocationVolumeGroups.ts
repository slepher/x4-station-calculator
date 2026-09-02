import type {
  AllocationVolumeGroup,
  AllocationVolumeItem,
  AllocationVolumeDetailRow,
  AllocationVolumeDetailSection,
  AllocationCargoOnlyItem
} from '@/types/production-workbench-contract'
import type { DerivedProductionFlow } from '@/types/production-flow'
import type { WareAmount } from '@/types/saveArchive'
import type { useGameDataStore } from '../useGameDataStore'
import i18n from '@/i18n'

type GameDataStore = ReturnType<typeof useGameDataStore>

export interface BuildAllocationVolumeGroupsParams {
  derivedProductionFlows: DerivedProductionFlow[]
  cargoMap: Map<string, number>
  targetMap: Map<string, number>
  hasArchiveStation: boolean
  gameData: GameDataStore
}

export interface BuildAllocationCargoOnlyItemsParams {
  cargo: WareAmount[]
  targetCounts: WareAmount[]
  derivedProductionFlows: DerivedProductionFlow[]
  gameData: GameDataStore
}

function compareAllocationItems(a: AllocationVolumeItem, b: AllocationVolumeItem): number {
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
  if (a.tier !== b.tier) return b.tier - a.tier
  if (a.wareId < b.wareId) return -1
  if (a.wareId > b.wareId) return 1
  return 0
}

function compareCargoOnlyItems(a: AllocationCargoOnlyItem, b: AllocationCargoOnlyItem): number {
  if (a.tier !== b.tier) return b.tier - a.tier
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}

function computeDeltaFillMinutes(targetCount: number, currentCount: number, ratePerHour: number): number | undefined {
  if (targetCount <= currentCount) return undefined
  if (ratePerHour <= 0) return undefined
  return ((targetCount - currentCount) / ratePerHour) * 60
}

function computeStockConsumeMinutes(stockCount: number, ratePerHour: number): number | undefined {
  if (stockCount <= 0) return undefined
  if (ratePerHour <= 0) return undefined
  return (stockCount / ratePerHour) * 60
}

function buildAllocationDetailSection(
  key: string,
  title: string,
  includeCurrentColumn: boolean,
  includeTargetColumn: boolean,
  rows: AllocationVolumeDetailRow[]
): AllocationVolumeDetailSection | null {
  if (rows.length === 0) return null
  return { key, title, includeCurrentColumn, includeTargetColumn, rows }
}

export function buildAllocationDetailSections(
  flow: DerivedProductionFlow,
  currentCount: number,
  targetCount: number,
  recommendedCount: number,
  hasArchiveData: boolean,
  gameData: GameDataStore
): AllocationVolumeDetailSection[] {
  i18n.global.locale.value
  const sections: AllocationVolumeDetailSection[] = []
  const netProductionRate = flow.netRate > 0 ? flow.netRate : 0
  const netConsumptionRate = flow.netRate < 0 ? Math.abs(flow.netRate) : 0
  const totalProductionRate = flow.production > 0 ? flow.production : 0
  const totalConsumptionRate = flow.consumption > 0 ? flow.consumption : 0

  const fillCurrentRows = [
    {
      key: 'current-net-fill',
      label: i18n.global.t('wareflow.allocation_current_net_fill_time'),
      ratePerHour: netProductionRate,
      targetMinutes: hasArchiveData ? computeDeltaFillMinutes(targetCount, currentCount, netProductionRate) : undefined,
      recommendedMinutes: computeDeltaFillMinutes(recommendedCount, currentCount, netProductionRate)
    },
    {
      key: 'current-gross-fill',
      label: i18n.global.t('wareflow.allocation_current_gross_fill_time'),
      ratePerHour: totalProductionRate,
      targetMinutes: hasArchiveData ? computeDeltaFillMinutes(targetCount, currentCount, totalProductionRate) : undefined,
      recommendedMinutes: computeDeltaFillMinutes(recommendedCount, currentCount, totalProductionRate)
    }
  ] as AllocationVolumeDetailRow[]
  const visibleFillCurrentRows = fillCurrentRows.filter((row) => row.currentMinutes !== undefined || row.targetMinutes !== undefined || row.recommendedMinutes !== undefined)

  const fillEmptyRows = [
    {
      key: 'empty-net-fill',
      label: i18n.global.t('wareflow.allocation_empty_net_fill_time'),
      ratePerHour: netProductionRate,
      targetMinutes: hasArchiveData ? computeDeltaFillMinutes(targetCount, 0, netProductionRate) : undefined,
      recommendedMinutes: computeDeltaFillMinutes(recommendedCount, 0, netProductionRate)
    },
    {
      key: 'empty-gross-fill',
      label: i18n.global.t('wareflow.allocation_empty_gross_fill_time'),
      ratePerHour: totalProductionRate,
      targetMinutes: hasArchiveData ? computeDeltaFillMinutes(targetCount, 0, totalProductionRate) : undefined,
      recommendedMinutes: computeDeltaFillMinutes(recommendedCount, 0, totalProductionRate)
    }
  ] as AllocationVolumeDetailRow[]
  const visibleFillEmptyRows = fillEmptyRows.filter((row) => row.currentMinutes !== undefined || row.targetMinutes !== undefined || row.recommendedMinutes !== undefined)

  const drainRows = [
    {
      key: 'current-net-drain',
      label: i18n.global.t('wareflow.allocation_current_net_drain_time'),
      ratePerHour: netConsumptionRate,
      currentMinutes: hasArchiveData ? computeStockConsumeMinutes(currentCount, netConsumptionRate) : undefined,
      targetMinutes: hasArchiveData ? computeStockConsumeMinutes(targetCount, netConsumptionRate) : undefined,
      recommendedMinutes: computeStockConsumeMinutes(recommendedCount, netConsumptionRate)
    },
    {
      key: 'current-gross-drain',
      label: i18n.global.t('wareflow.allocation_current_gross_drain_time'),
      ratePerHour: totalConsumptionRate,
      currentMinutes: hasArchiveData ? computeStockConsumeMinutes(currentCount, totalConsumptionRate) : undefined,
      targetMinutes: hasArchiveData ? computeStockConsumeMinutes(targetCount, totalConsumptionRate) : undefined,
      recommendedMinutes: computeStockConsumeMinutes(recommendedCount, totalConsumptionRate)
    }
  ] as AllocationVolumeDetailRow[]
  const visibleDrainRows = drainRows.filter((row) => row.currentMinutes !== undefined || row.targetMinutes !== undefined || row.recommendedMinutes !== undefined)

  const fillCurrentSection = buildAllocationDetailSection(
    'fill-current',
    i18n.global.t('wareflow.allocation_section_fill_current'),
    false,
    hasArchiveData,
    visibleFillCurrentRows
  )
  if (fillCurrentSection && hasArchiveData) sections.push(fillCurrentSection)

  const fillEmptySection = buildAllocationDetailSection(
    'fill-empty',
    i18n.global.t('wareflow.allocation_section_fill_empty'),
    false,
    hasArchiveData,
    visibleFillEmptyRows
  )
  if (fillEmptySection) sections.push(fillEmptySection)

  const drainSection = buildAllocationDetailSection(
    'drain',
    i18n.global.t('wareflow.allocation_section_drain'),
    hasArchiveData,
    hasArchiveData,
    visibleDrainRows
  )
  if (drainSection) sections.push(drainSection)

  const downstreamRows: AllocationVolumeDetailRow[] = []

  flow.contributions.forEach((contribution, index) => {
    if (contribution.class !== 'module') return
    if (contribution.type !== 'consumption') return
    const pureConsumptionRate = Math.abs(contribution.amount)
    const localizedModule = gameData.localizedModulesMap[contribution.id]
    const moduleInfo = gameData.modulesMap[contribution.id]
    const label = localizedModule?.localeName || moduleInfo?.name || contribution.id
    const row: AllocationVolumeDetailRow = {
      key: `downstream-${contribution.id}-${index}`,
      label,
      ratePerHour: pureConsumptionRate,
      currentMinutes: hasArchiveData ? computeStockConsumeMinutes(currentCount, pureConsumptionRate) : undefined,
      targetMinutes: hasArchiveData ? computeStockConsumeMinutes(targetCount, pureConsumptionRate) : undefined,
      recommendedMinutes: computeStockConsumeMinutes(recommendedCount, pureConsumptionRate)
    }
    if (row.currentMinutes === undefined && row.targetMinutes === undefined && row.recommendedMinutes === undefined) return
    downstreamRows.push(row)
  })

  const downstreamSection = buildAllocationDetailSection(
    'downstream',
    i18n.global.t('wareflow.allocation_section_downstream'),
    hasArchiveData,
    hasArchiveData,
    downstreamRows
  )
  if (downstreamSection) sections.push(downstreamSection)

  const stationBreakdownRows: AllocationVolumeDetailRow[] = []
  flow.contributions.forEach((contribution, index) => {
    if (contribution.class !== 'station') return

    const isProduction = contribution.type === 'production'
    const ratePerHour = Math.abs(contribution.amount)

    const row: AllocationVolumeDetailRow = isProduction
      ? {
          key: `station-${contribution.id}-${index}`,
          label: (contribution as any).name || contribution.id,
          ratePerHour,
          currentMinutes: undefined,
          targetMinutes: hasArchiveData ? computeDeltaFillMinutes(targetCount, 0, ratePerHour) : undefined,
          recommendedMinutes: computeDeltaFillMinutes(recommendedCount, 0, ratePerHour)
        }
      : {
          key: `station-${contribution.id}-${index}`,
          label: (contribution as any).name || contribution.id,
          ratePerHour,
          currentMinutes: hasArchiveData ? computeStockConsumeMinutes(currentCount, ratePerHour) : undefined,
          targetMinutes: hasArchiveData ? computeStockConsumeMinutes(targetCount, ratePerHour) : undefined,
          recommendedMinutes: computeStockConsumeMinutes(recommendedCount, ratePerHour)
        }

    if (row.currentMinutes === undefined && row.targetMinutes === undefined && row.recommendedMinutes === undefined) return
    stationBreakdownRows.push(row)
  })

  const stationBreakdownSection = buildAllocationDetailSection(
    'station-breakdown',
    i18n.global.t('wareflow.allocation_section_station_breakdown'),
    hasArchiveData,
    hasArchiveData,
    stationBreakdownRows
  )
  if (stationBreakdownSection) sections.push(stationBreakdownSection)

  return sections
}

export function buildAllocationVolumeGroups(params: BuildAllocationVolumeGroupsParams): AllocationVolumeGroup[] {
  const { derivedProductionFlows, cargoMap, targetMap, hasArchiveStation, gameData } = params

  const grouped = new Map<'container' | 'solid' | 'liquid', AllocationVolumeItem[]>([
    ['container', []],
    ['solid', []],
    ['liquid', []]
  ])

  for (const flow of derivedProductionFlows) {
    // ponytail: allocations model production cargo; add a condensate group if Protectyon gains production flows.
    if (flow.transportType === 'condensate') continue
    const ware = gameData.waresMap[flow.wareId]
    const localizedWare = gameData.localizedWaresMap[flow.wareId]
    const recommendedCount = Math.round(flow.totalOccupiedCount)
    const currentCount = cargoMap.get(flow.wareId) || 0
    const targetCount = hasArchiveStation
      ? (targetMap.get(flow.wareId) || 0)
      : recommendedCount
    const item: AllocationVolumeItem = {
      wareId: flow.wareId,
      name: localizedWare?.localeName || ware?.name || flow.wareId,
      transportType: flow.transportType,
      orderIndex: flow.orderIndex,
      tier: flow.tier,
      currentCount,
      targetCount,
      recommendedCount,
      scaleMaxCount: Math.max(currentCount, targetCount, recommendedCount),
      hasArchiveStation,
      detailSections: buildAllocationDetailSections(flow, currentCount, targetCount, recommendedCount, hasArchiveStation, gameData)
    }
    grouped.get(flow.transportType)?.push(item)
  }

  return (['container', 'solid', 'liquid'] as const).map((key) => {
    const items = grouped.get(key) || []
    items.sort(compareAllocationItems)
    return {
      key,
      items,
      currentTotalVolume: items.reduce((sum, item) => sum + item.currentCount * (gameData.waresMap[item.wareId]?.volume || 0), 0),
      targetTotalVolume: items.reduce((sum, item) => sum + item.targetCount * (gameData.waresMap[item.wareId]?.volume || 0), 0),
      recommendedTotalVolume: items.reduce((sum, item) => sum + item.recommendedCount * (gameData.waresMap[item.wareId]?.volume || 0), 0),
      hasArchiveStation
    }
  })
}

export function buildAllocationCargoOnlyItems(params: BuildAllocationCargoOnlyItemsParams): AllocationCargoOnlyItem[] {
  const { cargo, targetCounts, derivedProductionFlows, gameData } = params

  const mainWareIds = new Set(derivedProductionFlows.map((flow) => flow.wareId))
  const targetMap = new Map<string, number>()
  for (const item of targetCounts) {
    targetMap.set(item.ware, item.amount)
  }

  const items: AllocationCargoOnlyItem[] = []
  for (const item of cargo) {
    if (item.amount <= 0) continue
    if (mainWareIds.has(item.ware)) continue
    const ware = gameData.waresMap[item.ware]
    const localizedWare = gameData.localizedWaresMap[item.ware]
    items.push({
      wareId: item.ware,
      name: localizedWare?.localeName || ware?.name || item.ware,
      tier: ware?.tier || 0,
      currentCount: item.amount,
      targetCount: targetMap.get(item.ware) || 0
    })
  }

  items.sort(compareCargoOnlyItems)
  return items
}
