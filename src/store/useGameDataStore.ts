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
   * @param preferredRace 优先种族 (针对工业区为 default/terran/teladi, 针对农业为具体种族)
   * @param fallbackRace 兜底种族 (通常为 argon)
   */
  function findModuleForWare(wareId: string, preferredRace: string, fallbackRace: string = 'argon') {
    const modules = Object.values(modulesMap.value)
    const producers = modules.filter(m => m.outputs[wareId])
    if (producers.length === 0) return null

    // 1. 尝试匹配指定 race (核心逻辑：工业候选区 terran, teladi, default 实际上是 race)
    let found = producers.find(m => m.race === preferredRace)
    if (found) return found

    // 2. 尝试匹配指定 method (保留作为次优匹配，例如 preferredRace 为 'argon' 时寻找 method 为 'argon' 的模块)
    found = producers.find(m => m.method === preferredRace)
    if (found) return found

    // 3. 尝试匹配指定 default method (Fallback 1: 许多通用模块 method 为 default)
    found = producers.find(m => m.method === 'default')
    if (found) return found

    // 4. 尝试匹配兜底 race (Fallback 2: 农业回溯时 preferredRace 为具体种族，但模块可能属于兜底种族)
    found = producers.find(m => m.race === fallbackRace)
    if (found) return found

    // 5. 兜底返回第一个可用的模块
    return producers[0]
  }

  /**
   * 预计算所有分类的回溯产业链 (候选区显示优化)
   */
  function precomputeCandidateWares() {
    const industrialRaces = ['default', 'terran', 'teladi']
    const agriRaces = ['argon', 'boron', 'paranid', 'split', 'teladi', 'terran']

    // 1. 计算工业 (By Race: default/terran/teladi)
    industrialRaces.forEach(raceKey => {
      const resultSet = new Set<string>()
      const directOutputs = new Set<string>()
      
      // 找出该 race 直接产出的所有产物
      Object.values(modulesMap.value).forEach(m => {
        if (m.race === raceKey) {
          Object.keys(m.outputs).forEach(id => {
            directOutputs.add(id)
            resultSet.add(id)
          })
        }
      })

      // Teladi 特殊处理：包含 Default T3 作为种子
      if (raceKey === 'teladi') {
        Object.values(modulesMap.value).forEach(m => {
          if (m.race === 'default') {
            Object.keys(m.outputs).forEach(id => {
              if (waresMap.value[id]?.tier === 3) {
                directOutputs.add(id)
                resultSet.add(id)
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
        
        const module = findModuleForWare(wareId, raceKey, 'argon')
        if (module && module.inputs) {
          Object.keys(module.inputs).forEach(inputId => trace(inputId))
        }
      }
      directOutputs.forEach(id => trace(id))
      wareSetsByIndustrialRace.value[raceKey] = resultSet
    })

    // 2. 计算农业 (By Race)
    agriRaces.forEach(race => {
      const resultSet = new Set<string>()
      const directOutputs = new Set<string>()

      Object.values(modulesMap.value).forEach(m => {
        if (m.race === race) {
          Object.keys(m.outputs).forEach(id => {
            directOutputs.add(id)
            resultSet.add(id)
          })
        }
      })

      const visited = new Set<string>()
      const trace = (wareId: string) => {
        if (visited.has(wareId)) return
        visited.add(wareId)
        resultSet.add(wareId)

        const module = findModuleForWare(wareId, 'default', race)
        if (module && module.inputs) {
          Object.keys(module.inputs).forEach(inputId => trace(inputId))
        }
      }
      directOutputs.forEach(id => trace(id))
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
    ;(ModulesRaw as any[]).forEach(m => {
      if(!m.isPlayerBlueprint) return; 
      map[m.id] = {
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
    })
    modulesMap.value = map
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
