import { defineStore } from 'pinia'
import { mockModules, waresDb } from '@/assets/mock_data'

// 增强接口定义
export interface ModuleData {
  id: string
  name: string
  race?: string
  type?: string
  workforce?: { capacity: number, needed: number }
  inputs?: Record<string, number> // 资源ID: 每小时数量
  outputs?: Record<string, number>
  cost?: number
  buildCost?: Record<string, number> // 新增
}

export interface ResourceDetailItem {
  moduleName: string;
  count: number;
  amount: number; // 正数生产，负数消耗
  efficiency?: number; // 比如光照加成
}

export interface PlannedModule {
  moduleId: string
  count: number
}

export const useStationStore = defineStore('station', {
  state: () => ({
    modules: mockModules,
    plannedModules: [] as PlannedModule[],
    sunlight: 100,
    wares: waresDb,
    settings: {
      useHQ: false,
      workforceAuto: true,
      workforcePercent: 100,
      resourcePricePercent: 50, // 资源价格滑块
      productPricePercent: 50,  // 产品价格滑块
    }
  }),

  getters: {
    getModuleInfo: (state) => (id: string) => state.modules.find(m => m.id === id),

    // 1. 计算全站资源净产出 (核心算法)
    netProduction(state) {
      const result: Record<string, number> = {}

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info) return

        // 计算产出 (加法)
        if (info.outputs) {
          for (const [ware, amount] of Object.entries(info.outputs)) {
            // 特殊逻辑：能量电池受阳光影响
            let efficiency = 1.0
            if (ware === 'energycells' && info.type === 'production') {
              efficiency = state.sunlight / 100
            }
            const total = amount * item.count * efficiency
            result[ware] = (result[ware] || 0) + total
          }
        }

        // 计算消耗 (减法)
        if (info.inputs) {
          for (const [ware, amount] of Object.entries(info.inputs)) {
             const total = amount * item.count
             result[ware] = (result[ware] || 0) - total
          }
        }
      })
      return result
    },

    // 2. 计算劳动力情况
    workforceStats(state) {
      let needed = 0
      let capacity = 0

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (info?.workforce) {
          needed += (info.workforce.needed || 0) * item.count
          capacity += (info.workforce.capacity || 0) * item.count
        }
      })

      return { needed, capacity, diff: capacity - needed }
    },

    // 3. 计算建造成本
    totalConstructionCost(state) {
      return state.plannedModules.reduce((acc, item) => {
        const info = state.modules.find(m => m.id === item.moduleId)
        return acc + (info?.cost || 0) * item.count
      }, 0)
    },
    
    // 4. 计算每小时盈利 (净产出 * 价格)
    hourlyProfit(state): number {
      // 这里的 netProduction 需要通过 this 访问，TS 中通常不能直接访问兄弟 getter
      // 简单起见，我们在外部计算，或者这里重新调用逻辑。
      // 为演示方便，我们暂时简化，在 UI 层结合 netProduction 和 prices 计算。
      return 0 
    },

    getResourceDetails: (state) => (resourceId: string): ResourceDetailItem[] => {
      const details: ResourceDetailItem[] = [];

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId);
        if (!info) return;

        let amount = 0;
        let efficiency = 1.0;

        // 1. 检查是否是产出
        if (info.outputs && info.outputs[resourceId]) {
          // 特殊逻辑：能量电池受阳光影响
          if (resourceId === 'energycells' && info.type === 'production') {
            efficiency = state.sunlight / 100;
          }
          amount = info.outputs[resourceId] * item.count * efficiency;
        }

        // 2. 检查是否是消耗 (消耗为负数)
        if (info.inputs && info.inputs[resourceId]) {
          amount = -(info.inputs[resourceId] * item.count);
        }

        // 如果该模块与此资源有关，加入列表
        if (amount !== 0) {
          details.push({
            moduleName: info.name,
            count: item.count,
            amount: amount,
            efficiency: efficiency !== 1.0 ? efficiency : undefined
          });
        }
      });

      // 排序：先看生产(正数)，再看消耗(负数)
      return details.sort((a, b) => b.amount - a.amount);
    },

    // ★ 1. 人力详情 Getter (用于 StationWorkforce)
    workforceDetails(state) {
      const details: any[] = []
      let totalNeeded = 0
      let totalCapacity = 0

      // 如果勾选了 HQ，增加额外需求
      if (state.settings.useHQ) {
         totalNeeded += 200
      }

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info?.workforce) return

        const needed = (info.workforce.needed || 0) * item.count
        const capacity = (info.workforce.capacity || 0) * item.count
        
        if (needed > 0 || capacity > 0) {
          totalNeeded += needed
          totalCapacity += capacity
          details.push({
            name: info.name,
            count: item.count,
            value: capacity > 0 ? capacity : -needed, // 正数提供，负数消耗
            isCapacity: capacity > 0
          })
        }
      })
      
      // 排序：先显示提供的(绿色)，再显示消耗的(红色)
      details.sort((a, b) => b.value - a.value)

      return { list: details, totalNeeded, totalCapacity }
    },

    // ★ 2. 建设成本详情 Getter (用于 StationConstruction)
    constructionDetails(state) {
      const materials: Record<string, number> = {}
      let totalCredits = 0

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info) return

        // 计算总价 (Credits)
        totalCredits += (info.cost || 0) * item.count

        // 计算材料 (Materials)
        if (info.buildCost) {
          for (const [mat, amount] of Object.entries(info.buildCost)) {
            materials[mat] = (materials[mat] || 0) + amount * item.count
          }
        }
      })

      return { totalCredits, materials }
    },

    // ★ 3. 利润计算 Getter (用于 StationProfit)
    // 这里为了简化，暂时只计算基础逻辑，暂不应用复杂的百分比滑块算法
    profitDetails(state) {
       // 复用 netProduction 的结果
       // 注意：在 Store 内部调用 getter 需要用 this
       const production = this.netProduction
       let expenses = 0
       let revenue = 0
       
       const items = Object.entries(production).map(([key, amount]) => {
         const price = state.wares[key]?.price || 0
         const value = amount * price
         if (amount > 0) revenue += value
         else expenses += Math.abs(value)
         
         return {
           id: key,
           name: state.wares[key]?.name || key,
           amount,
           value, // 总价值
           isIncome: amount > 0
         }
       })
       
       return {
         list: items.sort((a, b) => b.value - a.value),
         expenses: -expenses,
         revenue,
         profit: revenue - expenses
       }
    },

    // ----------------------------------------------------------------
    // 1. 人力详情 (拆分为：需求组 & 提供组)
    // ----------------------------------------------------------------
    workforceBreakdown(state) {
      const neededItems: any[] = []
      const capacityItems: any[] = []
      let totalNeeded = 0
      let totalCapacity = 0

      // 1. 遍历模块
      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info?.workforce) return

        const needed = (info.workforce.needed || 0) * item.count
        const capacity = (info.workforce.capacity || 0) * item.count

        // 记录需求 (红)
        if (needed > 0) {
          totalNeeded += needed
          neededItems.push({ name: info.name, count: item.count, value: -needed })
        }
        // 记录提供 (绿)
        if (capacity > 0) {
          totalCapacity += capacity
          capacityItems.push({ name: info.name, count: item.count, value: capacity })
        }
      })

      // 2. 处理 HQ (作为需求项)
      if (state.settings.useHQ) {
        totalNeeded += 200
        neededItems.push({ name: 'Headquarters', count: 1, value: -200 })
      }

      return {
        needed: { total: totalNeeded, list: neededItems },
        capacity: { total: totalCapacity, list: capacityItems },
        diff: totalCapacity - totalNeeded
      }
    },

    // ----------------------------------------------------------------
    // 2. 利润详情 (拆分为：支出组 & 收入组)
    // ----------------------------------------------------------------
    profitBreakdown(state) {
      // 需要先获取净产出 (这里逻辑稍微复杂，为了性能我们手动再算一遍，或者拆分 netProduction)
      // 为了准确对应“支出”和“收入”，我们不能只看净值，要看每个资源的流向
      
      const expensesMap: Record<string, number> = {} // 消耗的资源
      const productionMap: Record<string, number> = {} // 生产的资源

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info) return

        // 累加产出
        if (info.outputs) {
          for (const [ware, amount] of Object.entries(info.outputs)) {
            let efficiency = 1.0
            if (ware === 'energycells' && info.type === 'production') {
              efficiency = state.sunlight / 100
            }
            const total = amount * item.count * efficiency
            productionMap[ware] = (productionMap[ware] || 0) + total
          }
        }
        // 累加消耗
        if (info.inputs) {
          for (const [ware, amount] of Object.entries(info.inputs)) {
            const total = amount * item.count
            expensesMap[ware] = (expensesMap[ware] || 0) + total
          }
        }
      })

      // 转换为数组并计算价值
      // 注意：这里用的是“平均价格”，如果要做滑块，需要用 settings.pricePercent 计算
      const toList = (map: Record<string, number>, isExpense: boolean) => {
        let totalVal = 0
        const list = Object.entries(map).map(([id, amount]) => {
          const price = state.wares[id]?.price || 0
          const value = amount * price
          totalVal += value
          return { id, name: state.wares[id]?.name, amount, value: isExpense ? -value : value }
        }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        return { total: totalVal, list }
      }

      const expenses = toList(expensesMap, true)
      const production = toList(productionMap, false)

      return {
        expenses,
        production,
        profit: production.total - expenses.total
      }
    },

    constructionBreakdown(state) {
      let totalCost = 0
      const moduleList: any[] = []
      const totalMaterials: Record<string, number> = {}

      state.plannedModules.forEach(item => {
        const info = state.modules.find(m => m.id === item.moduleId)
        if (!info) return

        const cost = (info.cost || 0) * item.count
        totalCost += cost

        // ★ 修改点：这里要把 buildCost 和 id 带上
        moduleList.push({
          id: item.moduleId, // 必须有 ID 才能控制展开
          name: info.name,
          count: item.count,
          cost: cost,
          buildCost: info.buildCost // 把配方传出去
        })

        // 汇总所有材料 (用于最底部的总计)
        if (info.buildCost) {
          for (const [mat, amount] of Object.entries(info.buildCost)) {
            totalMaterials[mat] = (totalMaterials[mat] || 0) + amount * item.count
          }
        }
      })

      return { totalCost, moduleList, totalMaterials }
    }
  },

  actions: {
    addModule(moduleId: string, amount = 1) {
      const existing = this.plannedModules.find(m => m.moduleId === moduleId)
      if (existing) existing.count += amount
      else this.plannedModules.push({ moduleId, count: amount })
    },
    removeModule(moduleId: string) {
      const index = this.plannedModules.findIndex(m => m.moduleId === moduleId)
      if (index !== -1) this.plannedModules.splice(index, 1)
    },
    updateCount(moduleId: string, count: number) {
      const item = this.plannedModules.find(m => m.moduleId === moduleId)
      if (item) item.count = Math.max(1, count)
    },
    loadDemoPreset() {
      this.plannedModules = [
        { moduleId: 'module_arg_hab_l_01', count: 16 },
        { moduleId: 'module_gen_prod_energycells_01', count: 4 },
        { moduleId: 'module_gen_prod_quantumtubes_01', count: 8 },
        { moduleId: 'module_gen_prod_graphene_01', count: 8 },
        { moduleId: 'module_gen_prod_hullparts_01', count: 20 },
        { moduleId: 'module_gen_prod_refinedmetals_01', count: 9 },
        { moduleId: 'module_gen_prod_superfluidcoolant_01', count: 4 },
        { moduleId: 'module_gen_prod_plasmaconductors_01', count: 10 },
        { moduleId: 'module_gen_prod_advancedcomposites_01', count: 4 },
      ]
    }
  }
})