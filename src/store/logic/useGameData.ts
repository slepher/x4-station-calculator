import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { loadLanguageAsync } from '@/i18n'
import type { X4Module, X4Ware, X4ModuleGroup } from '@/types/x4'

// 静态导入游戏数据
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'

// --- 类型导出 ---
export type LocalizedX4Module = X4Module & { localeName: string }
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string }

export interface GameDataState {
  waresMap: Ref<Record<string, X4Ware>>
  modulesMap: Ref<Record<string, X4Module>>
  localizedModulesMap: Ref<Record<string, LocalizedX4Module>>
  localizedModuleGroupsMap: Ref<Record<string, LocalizedX4ModuleGroup>>
}

/**
 * 独立的游戏数据管理 Composable
 * 职责：
 *   1. 导入并 Map 化静态游戏数据（wares、modules、moduleGroups）
 *   2. 处理多语言名称预热，避免重复翻译计算
 *   3. 响应语言切换事件，更新本地化数据
 */
export function useGameData(): GameDataState & { initialize: () => Promise<void>; currentLocale: Ref<string> } {
  const { locale: currentLocale } = useI18n()
  const { translateModule, translateModuleGroup } = useX4I18n()

  // --- 基础数据状态 ---
  const waresMap = ref<Record<string, X4Ware>>({})
  const modulesMap = ref<Record<string, X4Module>>({})
  const localizedModulesMap = ref<Record<string, LocalizedX4Module>>({})
  const localizedModuleGroupsMap = ref<Record<string, LocalizedX4ModuleGroup>>({})

  /**
   * 构建 Wares 基础映射
   * 确保每个 Ware 对象都具有必要的默认值
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
  }

  /**
   * 构建 Modules 基础映射
   * 确保每个 Module 对象都具有必要的默认值
   */
  function buildModulesMap() {
    const map: Record<string, X4Module> = {}
    ;(ModulesRaw as any[]).forEach(m => {
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
   * 预热本地化模块数据
   * 针对 EN 模式进行优化：直接使用 name 字段，避免重复翻译查找
   * 非 EN 模式：执行翻译逻辑获取本地化名称
   */
  function prepareLocalizedModules() {
    const isEn = currentLocale.value === 'en'
    const newModuleMap: Record<string, LocalizedX4Module> = {}

    ;(ModulesRaw as any[]).forEach(m => {
      newModuleMap[m.id] = {
        ...m,
        localeName: isEn ? (m.name || '') : translateModule(m)
      }
    })

    localizedModulesMap.value = newModuleMap
  }

  /**
   * 预热本地化模块组数据
   * 针对 EN 模式进行优化：直接使用 name 字段，避免重复翻译查找
   * 非 EN 模式：执行翻译逻辑获取本地化名称
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
    // 加载语言包
    await loadLanguageAsync(currentLocale.value)

    // 构建基础 Map
    buildWaresMap()
    buildModulesMap()

    // 预热本地化数据
    prepareLocalizedModules()
    prepareLocalizedModuleGroups()
  }

  /**
   * 语言切换时的响应处理
   * 只需更新本地化数据，基础 Map 无需重建
   */
  watch(
    () => currentLocale.value,
    async (newLang) => {
      await loadLanguageAsync(newLang)
      prepareLocalizedModules()
      prepareLocalizedModuleGroups()
    }
  )

  // 返回状态和初始化方法
  return {
    waresMap,
    modulesMap,
    localizedModulesMap,
    localizedModuleGroupsMap,
    initialize,
    currentLocale
  }
}