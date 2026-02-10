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
}

export interface AnalysisGroup {
  id: string
  count: number
  value: number
  items: AnalysisItem[]
}

export interface StationAnalysis {
  totalCost: number
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
  priceMultiplier: number // 0-1 (buildPriceMultiplier)
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
  const globalMaterials: Record<string, number> = {}

  const moduleGroups: AnalysisGroup[] = aggregatedModules.map(m => {
    const info = modulesMap[m.id]
    if (!info) {
      return { id: m.id, count: m.count, value: 0, items: [] }
    }

    const items: AnalysisItem[] = []
    let moduleTotalValue = 0

    for (const [wareId, amountPerModule] of Object.entries(info.buildCost)) {
      const totalAmount = (amountPerModule as number) * m.count
      const ware = waresMap[wareId]
      if (!ware) continue

      const price = getPriceByMultiplier(ware, priceMultiplier)
      const value = totalAmount * price
      
      items.push({
        id: wareId,
        count: totalAmount,
        price: value
      })

      moduleTotalValue += value
      globalMaterials[wareId] = (globalMaterials[wareId] || 0) + totalAmount
    }

    totalCost += moduleTotalValue

    return {
      id: m.id,
      count: m.count,
      value: moduleTotalValue,
      items: sortMaterials(items)
    }
  })

  // 4. 生成总计材料列表
  const summaryItems: AnalysisItem[] = Object.entries(globalMaterials).map(([id, count]) => {
    const ware = waresMap[id]
    const price = ware ? getPriceByMultiplier(ware, priceMultiplier) : 0
    return {
      id,
      count,
      price: count * price
    }
  })

  return {
    totalCost,
    summaryItems: sortMaterials(summaryItems),
    moduleGroups: moduleGroups
  }
}
