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
import {
  buildWaresMap,
  buildModulesMap,
  buildModulesByOutputMap,
  buildMedicalConsumptionMap,
  buildLocalizedModulesMap,
  buildLocalizedModuleGroupsMap,
  findModuleForWare as findModuleForWareFn,
  precomputeCandidateWares
} from './logic/useGameData'

export const useGameDataStore = defineStore('gameData', () => {
  const { locale: currentLocale } = useI18n()
  const { translateModule, translateModuleGroup, translateWare } = useX4I18n()

  const isReady = ref(false)
  const searchQuery = ref('')
  const waresMap = ref<Record<string, X4Ware>>({})
  const modulesMap = ref<Record<string, X4Module>>({})
  const modulesByOutputMap = ref<Record<string, X4Module[]>>({})
  const localizedModulesMap = ref<Record<string, LocalizedX4Module>>({})
  const localizedWaresMap = ref<Record<string, { id: string, localeName: string }>>({})
  const localizedModuleGroupsMap = ref<Record<string, LocalizedX4ModuleGroup>>({})
  const medicalConsumptionMap = ref<RaceMedicalConsumption>({})
  const wareSetsByIndustrialRace = ref<Record<string, Set<string>>>({})
  const wareSetsByRace = ref<Record<string, Set<string>>>({})
  const volumeCompressionMap = ref<Record<string, number>>({})

  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  function findModuleForWare(wareId: string, lineage: string): X4Module | null {
    return findModuleForWareFn(wareId, lineage, modulesByOutputMap.value)
  }

  function getModuleDisplayName(moduleId: string | undefined): string {
    if (!moduleId) return ''
    return localizedModulesMap.value[moduleId]?.localeName || moduleId
  }

  function getWareDisplayName(wareId: string | undefined): string {
    if (!wareId) return ''
    return localizedWaresMap.value[wareId]?.localeName || wareId
  }

  function prepareLocalizedWares() {
    const isEn = currentLocale.value === 'en'
    const newWareMap: Record<string, { id: string, localeName: string }> = {}
    Object.values(waresMap.value).forEach(w => {
      newWareMap[w.id] = {
        id: w.id,
        localeName: isEn ? (w.name || '') : translateWare(w)
      }
    })
    localizedWaresMap.value = newWareMap
  }

  function buildVolumeCompressionMap() {
    const map: Record<string, number> = {}
    Object.values(modulesMap.value).forEach(module => {
      let outputVolume = 0
      if (module.outputs) {
        Object.entries(module.outputs).forEach(([wareId, amount]) => {
          const ware = waresMap.value[wareId]
          if (ware) {
            outputVolume += amount * ware.volume
          }
        })
      }
      let inputVolume = 0
      if (module.inputs) {
        Object.entries(module.inputs).forEach(([wareId, amount]) => {
          if (wareId === 'energycells') return
          const ware = waresMap.value[wareId]
          if (ware) {
            inputVolume += amount * ware.volume
          }
        })
      }
      if (inputVolume > 0) {
        map[module.id] = outputVolume / inputVolume
      }
    })
    volumeCompressionMap.value = map
  }

  function getModuleVolumeCompression(moduleId: string | undefined): number | undefined {
    if (!moduleId) return undefined
    return volumeCompressionMap.value[moduleId]
  }

  async function initialize() {
    if (isReady.value) return
    console.log('[GameDataStore] Initializing...')

    await loadLanguageAsync(currentLocale.value)

    waresMap.value = buildWaresMap()
    modulesMap.value = buildModulesMap()
    modulesByOutputMap.value = buildModulesByOutputMap(modulesMap.value)
    medicalConsumptionMap.value = buildMedicalConsumptionMap()

    const isEn = currentLocale.value === 'en'
    localizedModulesMap.value = buildLocalizedModulesMap(isEn, translateModule)
    localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(isEn, translateModuleGroup)

    const { wareSetsByIndustrialRace: industrial, wareSetsByRace: race } = precomputeCandidateWares(
      modulesMap.value,
      waresMap.value,
      modulesByOutputMap.value
    )
    wareSetsByIndustrialRace.value = industrial
    wareSetsByRace.value = race

    prepareLocalizedWares()
    buildVolumeCompressionMap()

    isReady.value = true
    console.log('[GameDataStore] Initialized. WareSetsByIndustrialRace keys:', Object.keys(wareSetsByIndustrialRace.value))
  }

  async function changeLanguage(newLang: string) {
    currentLocale.value = newLang
    await loadLanguageAsync(newLang)
    
    const isEn = currentLocale.value === 'en'
    localizedModulesMap.value = buildLocalizedModulesMap(isEn, translateModule)
    localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(isEn, translateModuleGroup)
    
    const { wareSetsByIndustrialRace: industrial, wareSetsByRace: race } = precomputeCandidateWares(
      modulesMap.value,
      waresMap.value,
      modulesByOutputMap.value
    )
    wareSetsByIndustrialRace.value = industrial
    wareSetsByRace.value = race
    
    prepareLocalizedWares()
  }

  watch(
    () => currentLocale.value,
    async (newLang) => {
      if (!isReady.value) return
      await loadLanguageAsync(newLang)
      
      const isEn = currentLocale.value === 'en'
      localizedModulesMap.value = buildLocalizedModulesMap(isEn, translateModule)
      localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(isEn, translateModuleGroup)
      
      const { wareSetsByIndustrialRace: industrial, wareSetsByRace: race } = precomputeCandidateWares(
        modulesMap.value,
        waresMap.value,
        modulesByOutputMap.value
      )
      wareSetsByIndustrialRace.value = industrial
      wareSetsByRace.value = race
      
      prepareLocalizedWares()
    }
  )

  return {
    isReady,
    searchQuery,
    waresMap,
    modulesMap,
    modulesByOutputMap,
    localizedModulesMap,
    localizedWaresMap,
    localizedModuleGroupsMap,
    medicalConsumptionMap,
    wareSetsByIndustrialRace,
    wareSetsByRace,
    volumeCompressionMap,
    filteredModulesGrouped,
    currentLocale,
    initialize,
    changeLanguage,
    findModuleForWare,
    getModuleDisplayName,
    getWareDisplayName,
    getModuleVolumeCompression
  }
})
