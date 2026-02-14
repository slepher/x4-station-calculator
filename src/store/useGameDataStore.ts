import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { loadLanguageAsync } from '@/i18n'
import type { 
  X4Module, 
  X4Ware, 
  RaceMedicalConsumption,
  LocalizedX4Module,
  LocalizedX4ModuleGroup,
  ModuleGroupResult
} from '@/types/x4'
import { generateFilteredModulesGrouped } from './logic/searchModule'

// 静态导入游戏数据
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

/**
 * 核心游戏数据 Store
 * 职责：
 *   1. 导入并 Map 化静态游戏数据（wares、modules、moduleGroups）
 *   2. 处理多语言名称预热，避免重复翻译计算
 *   3. 响应语言切换事件，更新本地化数据
 *   4. 作为项目唯一的静态数据源
 */
export const useGameDataStore = defineStore('gameData', () => {
  const { locale: currentLocale } = useI18n()
  const { translateModule, translateModuleGroup, translateWare } = useX4I18n()

  // --- 基础数据状态 ---
  const isReady = ref(false)
  const searchQuery = ref('')
  const waresMap = ref<Record<string, X4Ware>>({})
  const modulesMap = ref<Record<string, X4Module>>({})
  const localizedModulesMap = ref<Record<string, LocalizedX4Module>>({})
  const localizedWaresMap = ref<Record<string, { id: string, localeName: string }>>({})
  const localizedModuleGroupsMap = ref<Record<string, LocalizedX4ModuleGroup>>({})
  const medicalConsumptionMap = ref<RaceMedicalConsumption>({})
  const modulesByOutputMap = ref<Record<string, X4Module[]>>({}) // 索引：按产物 ID 查找生产模块
  const wareSetsByIndustrialRace = ref<Record<string, Set<string>>>({}) // 工业回溯集 (基于 Race: default/terran/teladi)
  const wareSetsByRace = ref<Record<string, Set<string>>>({})           // 农业回溯集 (基于 Race: argon/boron/etc)

  /**
   * 搜索增强：过滤后的模块列表（分组）
   */
  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  /**
   * 寻找生产特定产物的最佳模块 (回溯逻辑核心)
   * @param wareId 产物 ID
   * @param lineage 想要遵循的血统 (工业: default/terran/teladi, 农业: 具体种族)
   */
  function findModuleForWare(wareId: string, lineage: string) {
    const producers = modulesByOutputMap.value[wareId] || []
    if (producers.length === 0) return null

    // 1. 尝试匹配指定 race (核心逻辑：lineage 实际上直接对应 race)
    let found = producers.find(m => m.race === lineage)
    if (found) return found

    // 2. 尝试匹配指定 method (例如 lineage 为 'argon' 时寻找 method 为 'argon' 的模块)
    found = producers.find(m => m.method === lineage)
    if (found) return found

    // 3. 特殊逻辑：Teladi 工业线如果找不到 Teladi 模块，回退到 Default
    if (lineage === 'teladi') {
      found = producers.find(m => m.race === 'default')
      if (found) return found
    }

    // 4. 尝试匹配指定 default method (许多通用模块 method 为 default)
    found = producers.find(m => m.method === 'default')
    if (found) return found

    // 5. 兜底逻辑：农业线 (如 argon) 如果找不到匹配，回退到默认
    const agriRaces = ['argon', 'boron', 'paranid', 'split']
    if (agriRaces.includes(lineage)) {
      found = producers.find(m => m.race === 'default')
      if (found) return found
    }

    // 6. 最后的兜底：返回第一个可用的模块
    return producers[0]
  }

  /**
   * 预计算所有分类的回溯产业链 (候选区显示优化)
   */
  function precomputeCandidateWares() {
    const industrialRaces = ['default', 'terran', 'teladi']
    const agriRaces = ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']

    // 核心组定义，用于种子隔离
    const INDUSTRIAL_GROUPS = ['minerals', 'gases', 'refined', 'hightech', 'shiptech', 'energy']
    const AGRICULTURAL_GROUPS = ['agricultural', 'food', 'pharmaceutical', 'water', 'ice', 'energy']

    // 1. 计算工业 (By Race: default/terran/teladi)
    industrialRaces.forEach(raceKey => {
      const resultSet = new Set<string>()
      const seeds = new Set<string>()
      
      // 找出该 race 的工业种子产物
      Object.values(modulesMap.value).forEach(m => {
        if (m.race === raceKey && INDUSTRIAL_GROUPS.includes(m.group)) {
          Object.keys(m.outputs).forEach(id => {
            seeds.add(id)
          })
        }
      })

      // Teladi 特殊处理：包含 Default T3 作为种子
      if (raceKey === 'teladi') {
        Object.values(modulesMap.value).forEach(m => {
          if (m.race === 'default' && INDUSTRIAL_GROUPS.includes(m.group)) {
            Object.keys(m.outputs).forEach(id => {
              if (waresMap.value[id]?.tier === 3) {
                seeds.add(id)
              }
            })
          }
        })
      }

      // 执行回溯
      const visited = new Set<string>()
      const trace = (wareId: string) => {
        if (visited.has(wareId)) return
        visited.add(wareId)
        
        resultSet.add(wareId)
        
        const ware = waresMap.value[wareId]
        if (ware && ware.tier === 0) return

        const module = findModuleForWare(wareId, raceKey)
        if (module && module.inputs) {
          Object.keys(module.inputs).forEach(inputId => trace(inputId))
        }
      }
      seeds.forEach(id => trace(id))
      wareSetsByIndustrialRace.value[raceKey] = resultSet
    })

    // 2. 计算农业 (By Race)
    agriRaces.forEach(race => {
      const resultSet = new Set<string>()
      const seeds = new Set<string>()

      // 找出该 race 的农业种子产物
      Object.values(modulesMap.value).forEach(m => {
        if (m.race === race && AGRICULTURAL_GROUPS.includes(m.group)) {
          Object.keys(m.outputs).forEach(id => {
            seeds.add(id)
          })
        }
      })

      const visited = new Set<string>()
      const trace = (wareId: string) => {
        if (visited.has(wareId)) return
        visited.add(wareId)
        
        resultSet.add(wareId)

        const ware = waresMap.value[wareId]
        if (ware && ware.tier === 0) return

        // 核心修正：农业回溯时优先使用对应种族的生产方法
        const module = findModuleForWare(wareId, race)
        if (module && module.inputs) {
          Object.keys(module.inputs).forEach(inputId => trace(inputId))
        }
      }
      seeds.forEach(id => trace(id))
      wareSetsByRace.value[race] = resultSet
    })
  }

  /**
   * 构建 Wares 基础映射
   */
  function buildWaresMap() {
    const map: Record<string, X4Ware> = {}
    ;(waresRaw as any[]).forEach(w => {
      map[w.id] = {
        ...w,
        price: w.price || 0,
        minPrice: w.minPrice || 0,
        maxPrice: w.maxPrice || 0
      }
    })
    waresMap.value = map
    console.log('[GameDataStore] buildWaresMap finished. Size:', Object.keys(map).length)
  }

  /**
   * 构建 Modules 基础映射
   */
  function buildModulesMap() {
    const map: Record<string, X4Module> = {}
    const outputMap: Record<string, X4Module[]> = {}

    ;(ModulesRaw as any[]).forEach(m => {
      if(!m.isPlayerBlueprint) return; 
      const module: X4Module = {
        ...m,
        buildCost: m.buildCost || {},
        outputs: m.outputs || {},
        inputs: m.inputs || {},
        cycleTime: m.cycleTime || 0,
        workforce: {
          capacity: m.workforce?.capacity || 0,
          needed: m.workforce?.needed || 0,
          maxBonus: m.workforce?.maxBonus || 0
        }
      }
      map[m.id] = module

      // 建立产物到模块的索引
      Object.keys(module.outputs).forEach(wareId => {
        if (!outputMap[wareId]) {
          outputMap[wareId] = []
        }
        outputMap[wareId].push(module)
      })
    })
    modulesMap.value = map
    modulesByOutputMap.value = outputMap
  }

  /**
   * 构建医疗消耗数据映射
   */
  function buildMedicalConsumptionMap() {
    medicalConsumptionMap.value = consumptionRaw as RaceMedicalConsumption
  }

  /**
   * 预热本地化模块数据
   */
  function prepareLocalizedModules() {
    const isEn = currentLocale.value === 'en'
    const newModuleMap: Record<string, LocalizedX4Module> = {}

    ;(ModulesRaw as any[]).forEach(m => {
      if(!m.isPlayerBlueprint) return; 
      newModuleMap[m.id] = {
        ...m,
        localeName: isEn ? (m.name || '') : translateModule(m)
      }
    })

    localizedModulesMap.value = newModuleMap
  }

  /**
   * 预热本地化 Ware 数据
   */
  function prepareLocalizedWares() {
    const isEn = currentLocale.value === 'en'
    const newWareMap: Record<string, { id: string, localeName: string }> = {}

    ;(waresRaw as any[]).forEach(w => {
      newWareMap[w.id] = {
        id: w.id,
        localeName: isEn ? (w.name || '') : translateWare(w)
      }
    })

    localizedWaresMap.value = newWareMap
  }

  /**
   * 预热本地化模块组数据
   */
  function prepareLocalizedModuleGroups() {
    const isEn = currentLocale.value === 'en'
    const newModuleGroupsMap: Record<string, LocalizedX4ModuleGroup> = {}

    ;(moduleGroupsRaw as any[]).forEach((mg: any) => {
      newModuleGroupsMap[mg.id] = {
        ...mg,
        localeName: isEn ? (mg.name || '') : translateModuleGroup(mg)
      }
    })

    localizedModuleGroupsMap.value = newModuleGroupsMap
  }

  /**
   * 完整初始化：一次性执行所有 Map 构建和数据预热
   */
  async function initialize() {
    if (isReady.value) return
    console.log('[GameDataStore] Initializing...')

    // 加载语言包
    await loadLanguageAsync(currentLocale.value)

    // 构建基础 Map
    buildWaresMap()
    buildModulesMap()
    buildMedicalConsumptionMap()

    // 预热本地化数据
    prepareLocalizedModules()
    prepareLocalizedWares()
    prepareLocalizedModuleGroups()

    // 预计算候选区产业链
    precomputeCandidateWares()

    isReady.value = true
    console.log('[GameDataStore] Initialized. WareSetsByIndustrialRace keys:', Object.keys(wareSetsByIndustrialRace.value))
  }

  /**
   * 切换语言并更新本地化数据
   */
  async function changeLanguage(newLang: string) {
    currentLocale.value = newLang
    await loadLanguageAsync(newLang)
    prepareLocalizedModules()
    prepareLocalizedModuleGroups()
    precomputeCandidateWares() // 重新计算（虽然 ID 不变，但为了保险同步语言上下文）
  }

  // 监听外部语言切换（如来自 i18n 插件）
  watch(
    () => currentLocale.value,
    async (newLang) => {
      if (!isReady.value) return
      await loadLanguageAsync(newLang)
      prepareLocalizedModules()
      prepareLocalizedModuleGroups()
      precomputeCandidateWares()
    }
  )

  return {
    isReady,
    searchQuery,
    waresMap,
    modulesMap,
    localizedModulesMap,
    localizedWaresMap,
    localizedModuleGroupsMap,
    medicalConsumptionMap,
    wareSetsByIndustrialRace,
    wareSetsByRace,
    filteredModulesGrouped,
    currentLocale,
    initialize,
    changeLanguage,
    precomputeCandidateWares,
    findModuleForWare
  }
})
