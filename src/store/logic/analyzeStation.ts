import type { 
  SavedModule, 
  X4Module, 
  X4Ware
} from '../../types/x4'
import { getPriceByMultiplier } from './calculatorUtils'

export interface AnalysisItem {
  id: string
  count: number
  price: number
  volume: number
}

export interface AnalysisGroup {
  id: string
  count: number
  value: number // Total Price (Cr)
  volume: number // Total Volume (m³)
  
  // Time View Data
  unitTime: number
  totalTime: number

  // Worker View Data
  unitCapacity: number
  totalCapacity: number
  unitNeeded: number
  totalNeeded: number
  unitWorkerDiff: number // unitCapacity - unitNeeded
  totalWorkerDiff: number // totalCapacity - totalNeeded

  items: AnalysisItem[] // Materials breakdown
}

export interface StationAnalysis {
  totalCost: number
  totalVolume: number
  totalTime: number
  totalCapacity: number
  totalNeeded: number
  playerHQNeeded: number
  totalWorkerDiff: number
  summaryItems: AnalysisItem[]
  moduleGroups: AnalysisGroup[]
}

/**
 * 核心分析函数：将模块列表转换为仪表盘所需的分组数据
 */
export function analyzeStation(
  plannedModules: SavedModule[],
  modulesMap: Record<string, X4Module>,
  waresMap: Record<string, X4Ware>,
  priceMultiplier: number, // 0-1 (buildPriceMultiplier)
  useHQ: boolean = false
): StationAnalysis {
  // 1. 模块合并 (按 moduleId 聚合)
  // 注意：我们按输入的 plannedModules 顺序保留第一个出现的模块位置
  const aggregatedModules: Array<{ id: string; count: number }> = []
  const moduleMap = new Map<string, number>()

  plannedModules.forEach(m => {
    const existingIdx = moduleMap.get(m.id)
    if (existingIdx !== undefined && aggregatedModules[existingIdx]) {
      aggregatedModules[existingIdx].count += m.count
    } else {
      moduleMap.set(m.id, aggregatedModules.length)
      aggregatedModules.push({ id: m.id, count: m.count })
    }
  })

  // 2. 排序辅助函数 (Tier 降序, Name 升序)
  const sortMaterials = (items: AnalysisItem[]) => {
    return items.sort((a, b) => {
      const wareA = waresMap[a.id]
      const wareB = waresMap[b.id]
      const tierA = wareA?.tier ?? 0
      const tierB = wareB?.tier ?? 0
      
      if (tierB !== tierA) return tierB - tierA
      
      const nameA = wareA?.name || a.id
      const nameB = wareB?.name || b.id
      return nameA < nameB ? -1 : 1
    })
  }

  // 3. 计算各模块分组
  let totalCost = 0
  let totalVolume = 0
  let totalTime = 0
  let totalCapacity = 0
  let totalNeeded = 0
  const globalMaterials: Record<string, number> = {}

  const moduleGroups: AnalysisGroup[] = aggregatedModules.map(m => {
    const info = modulesMap[m.id]
    if (!info) {
      return { 
        id: m.id, 
        count: m.count, 
        value: 0, 
        volume: 0,
        items: [],
        unitTime: 0,
        totalTime: 0,
        unitCapacity: 0,
        totalCapacity: 0,
        unitNeeded: 0,
        totalNeeded: 0,
        unitWorkerDiff: 0,
        totalWorkerDiff: 0
      }
    }

    const items: AnalysisItem[] = []
    let moduleTotalValue = 0
    let moduleTotalVolume = 0
    
    // 计算材料
    for (const [wareId, amountPerModule] of Object.entries(info.buildCost)) {
      const totalAmount = (amountPerModule as number) * m.count
      const ware = waresMap[wareId]
      if (!ware) continue

      const price = getPriceByMultiplier(ware, priceMultiplier)
      const value = totalAmount * price
      const volume = totalAmount * (ware.volume || 0)
      
      items.push({
        id: wareId,
        count: totalAmount,
        price: value,
        volume: volume
      })

      moduleTotalValue += value
      moduleTotalVolume += volume
      globalMaterials[wareId] = (globalMaterials[wareId] || 0) + totalAmount
    }

    const unitTime = info.buildTime || 0
    const moduleTotalTime = unitTime * m.count
    
    const unitCapacity = info.workforce?.capacity || 0
    const moduleTotalCapacity = unitCapacity * m.count
    
    const unitNeeded = info.workforce?.needed || 0
    const moduleTotalNeeded = unitNeeded * m.count
    
    const unitWorkerDiff = unitCapacity - unitNeeded
    const moduleTotalWorkerDiff = moduleTotalCapacity - moduleTotalNeeded

    totalCost += moduleTotalValue
    totalVolume += moduleTotalVolume
    totalTime += moduleTotalTime
    totalCapacity += moduleTotalCapacity
    totalNeeded += moduleTotalNeeded

    return {
      id: m.id,
      count: m.count,
      value: moduleTotalValue,
      volume: moduleTotalVolume,
      
      unitTime,
      totalTime: moduleTotalTime,
      
      unitCapacity,
      totalCapacity: moduleTotalCapacity,
      unitNeeded,
      totalNeeded: moduleTotalNeeded,
      unitWorkerDiff,
      totalWorkerDiff: moduleTotalWorkerDiff,

      items: sortMaterials(items)
    }
  })

  // 4. 生成总计材料列表
  const summaryItems: AnalysisItem[] = Object.entries(globalMaterials).map(([id, count]) => {
    const ware = waresMap[id]
    const price = ware ? getPriceByMultiplier(ware, priceMultiplier) : 0
    const unitVolume = ware?.volume || 0
    return {
      id,
      count,
      price: count * price,
      volume: count * unitVolume
    }
  })

  const playerHQNeeded = useHQ ? 200 : 0
  const finalTotalNeeded = totalNeeded + playerHQNeeded

  return {
    totalCost,
    totalVolume,
    totalTime,
    totalCapacity,
    totalNeeded: finalTotalNeeded,
    playerHQNeeded,
    totalWorkerDiff: totalCapacity - finalTotalNeeded,
    summaryItems: sortMaterials(summaryItems),
    moduleGroups: moduleGroups
  }
}
