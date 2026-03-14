import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { loadLanguageAsync, setGameFolderName } from '@/i18n'
import type {
  X4Module,
  X4Ware,
  RaceMedicalConsumption,
  LocalizedX4Module,
  LocalizedX4ModuleGroup,
  ModuleGroupResult,
  VersionConfig,
  VersionsFile,
  GameVersionStorage,
  X4Bullet,
  X4Map,
  X4RegionYield,
  X4Faction,
  X4Language,
  X4DefaultMax,
  X4ShipSlot,
  X4Consumable,
  X4Drone,
  X4Missile
} from '@/types/x4'
import { generateFilteredModulesGrouped } from './logic/searchModule'
import {
  loadGameDataFiles,
  buildWaresMap,
  buildModulesMap,
  buildModulesByMacroIdMap,
  buildModulesByOutputMap,
  buildMedicalConsumptionMap,
  buildLocalizedModulesMap,
  buildLocalizedModuleGroupsMap,
  findModuleForWare as findModuleForWareFn,
  precomputeCandidateWares
} from './logic/useGameData'
import type { GameDataFiles } from './logic/useGameData'

export const useGameDataStore = defineStore('gameData', () => {
  const { locale: currentLocale } = useI18n()
  const { translateModule, translateModuleGroup, translateWare } = useX4I18n()

  // Version management state
  const versionsConfig = ref<VersionConfig[]>([])
  const currentVersion = ref<string>('')
  const isBeta = ref<boolean>(false)
  const folderName = ref<string>('')
  const hasStoredVersion = ref<boolean>(false)

  // Core data state
  const isReady = ref(false)
  const searchQuery = ref('')
  const gameData = ref<GameDataFiles | null>(null)
  const waresMap = ref<Record<string, X4Ware>>({})
  const modulesMap = ref<Record<string, X4Module>>({})
  const modulesByMacroId = ref<Record<string, X4Module>>({})
  const modulesByOutputMap = ref<Record<string, X4Module[]>>({})
  const localizedModulesMap = ref<Record<string, LocalizedX4Module>>({})
  const localizedWaresMap = ref<Record<string, { id: string, localeName: string }>>({})
  const localizedModuleGroupsMap = ref<Record<string, LocalizedX4ModuleGroup>>({})
  const medicalConsumptionMap = ref<RaceMedicalConsumption>({})
  const wareSetsByIndustrialRace = ref<Record<string, Set<string>>>({})
  const wareSetsByRace = ref<Record<string, Set<string>>>({})
  const volumeCompressionMap = ref<Record<string, number>>({})

  // Static data (loaded once during initialize, not computed)
  const bullets = ref<X4Bullet[]>([])
  const missiles = ref<X4Missile[]>([])
  const drones = ref<X4Drone[]>([])
  const consumables = ref<X4Consumable[]>([])
  const maps = ref<X4Map>({ clusters: {} })
  const regionyields = ref<X4RegionYield[]>([])
  const factions = ref<X4Faction[]>([])
  const defaultMaxes = ref<Record<string, X4DefaultMax>>({})
  const shipSlots = ref<Record<string, X4ShipSlot[]>>({})
  const languages = ref<X4Language[]>([])

  // Version computed
  const currentVersionConfig = computed<VersionConfig | undefined>(() => {
    return versionsConfig.value.find(
      v => v.version === currentVersion.value && v.beta === isBeta.value
    )
  })

  const versionOptions = computed(() => {
    return versionsConfig.value.map(v => ({
      version: v.version,
      codename: v.codename,
      beta: v.beta,
      label: `${v.version}-${v.codename}${v.beta ? ' (beta)' : ''}`
    }))
  })

  const needsVersionSetup = computed(() => !hasStoredVersion.value)

  const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    return generateFilteredModulesGrouped(
      searchQuery.value,
      currentLocale.value,
      localizedModulesMap.value,
      localizedModuleGroupsMap.value
    )
  })

  function getStorageKey(module: 'empire' | 'logic_flow' | 'ship_blueprints'): string {
    const config = currentVersionConfig.value
    if (!config) {
      return module === 'empire' ? 'x4_empire_data' :
             module === 'logic_flow' ? 'x4_logic_flow_plans' : 'x4_ship_blueprints'
    }
    return config.storage_keys[module]
  }

  function getDefaultVersionConfig(versionsData: VersionsFile): VersionConfig | undefined {
    return versionsData.versions.find(
      v => v.version === versionsData.current_version && v.beta === versionsData.beta
    )
  }

  function applyVersionConfig(config: VersionConfig, hasStored: boolean) {
    currentVersion.value = config.version
    isBeta.value = config.beta
    folderName.value = config.folder_name
    hasStoredVersion.value = hasStored
  }

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

  function getRawData(file: keyof GameDataFiles): any[] | any {
    return gameData.value?.[file] || null
  }

  async function initialize() {
    if (isReady.value) return
    console.log('[GameDataStore] Initializing...')

    // 1. Load versions.json
    const versionsData = (await import('@/assets/versions.json')).default as VersionsFile
    versionsConfig.value = versionsData.versions
    const defaultConfig = getDefaultVersionConfig(versionsData)

    // 2. Check localStorage for stored version
    const storedVersionStr = localStorage.getItem('x4_game_version')
    if (storedVersionStr) {
      try {
        const storedVersion = JSON.parse(storedVersionStr) as GameVersionStorage
        const storedConfig = versionsData.versions.find(
          v => v.version === storedVersion.version && v.beta === storedVersion.beta
        )
        if (storedConfig) {
          applyVersionConfig(storedConfig, true)
        } else if (defaultConfig) {
          console.warn('[GameDataStore] Invalid stored version, resetting to default')
          localStorage.removeItem('x4_game_version')
          applyVersionConfig(defaultConfig, false)
        }
      } catch {
        console.warn('[GameDataStore] Failed to parse stored version, using default')
        localStorage.removeItem('x4_game_version')
        if (defaultConfig) applyVersionConfig(defaultConfig, false)
      }
    } else if (defaultConfig) {
      applyVersionConfig(defaultConfig, false)
    }

    // 3. Find matching version config
    const config = currentVersionConfig.value
    folderName.value = config?.folder_name || defaultConfig?.folder_name || '8.0-Diplomacy'

    // 4. Set game folder for i18n
    setGameFolderName(folderName.value)

    // 5. Load language
    await loadLanguageAsync(currentLocale.value)

    // 6. Load game data files
    await loadGameData()

    isReady.value = true
    console.log('[GameDataStore] Initialized. Version:', currentVersion.value, 'Beta:', isBeta.value)
  }

  async function loadGameData() {
    if (!folderName.value) return

    console.log('[GameDataStore] Loading game data from:', folderName.value)
    const data = await loadGameDataFiles(folderName.value)
    gameData.value = data

    // Build maps
    waresMap.value = buildWaresMap(data.wares)
    modulesMap.value = buildModulesMap(data.modules)
    modulesByMacroId.value = buildModulesByMacroIdMap(modulesMap.value)
    modulesByOutputMap.value = buildModulesByOutputMap(modulesMap.value)
    medicalConsumptionMap.value = buildMedicalConsumptionMap(data.consumption)

    const isEn = currentLocale.value === 'en'
    localizedModulesMap.value = buildLocalizedModulesMap(data.modules, isEn, translateModule)
    localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(data.moduleGroups, isEn, translateModuleGroup)

    const { wareSetsByIndustrialRace: industrial, wareSetsByRace: race } = precomputeCandidateWares(
      modulesMap.value,
      waresMap.value,
      modulesByOutputMap.value
    )
    wareSetsByIndustrialRace.value = industrial
    wareSetsByRace.value = race

    prepareLocalizedWares()
    buildVolumeCompressionMap()

    // Load static data (no computed, just direct assignment)
    bullets.value = data.bullets
    missiles.value = data.missiles
    drones.value = data.drones
    consumables.value = data.consumables
    maps.value = data.maps
    regionyields.value = data.regionyields
    factions.value = data.factions
    defaultMaxes.value = data.defaultMaxes
    shipSlots.value = data.shipSlots
    languages.value = data.languages
  }

  function setVersion(version: string, beta: boolean) {
    console.log('[GameDataStore] Setting version:', version, 'beta:', beta)

    if (versionsConfig.value.length > 0) {
      const matched = versionsConfig.value.find(v => v.version === version && v.beta === beta)
      if (!matched) {
        console.warn('[GameDataStore] Refusing to persist invalid version selection:', version, beta)
        return
      }
    }

    // Write to localStorage
    const versionData: GameVersionStorage = { version, beta }
    localStorage.setItem('x4_game_version', JSON.stringify(versionData))

    // Reload page to reinitialize with new version
    window.location.reload()
  }

  function persistVersionSelection(version: string, beta: boolean) {
    console.log('[GameDataStore] Persisting current version selection:', version, 'beta:', beta)

    if (versionsConfig.value.length > 0) {
      const matched = versionsConfig.value.find(v => v.version === version && v.beta === beta)
      if (!matched) {
        console.warn('[GameDataStore] Refusing to persist invalid version selection:', version, beta)
        return
      }
    }

    const versionData: GameVersionStorage = { version, beta }
    localStorage.setItem('x4_game_version', JSON.stringify(versionData))
    hasStoredVersion.value = true
  }

  async function changeLanguage(newLang: string) {
    currentLocale.value = newLang
    await loadLanguageAsync(newLang)

    const isEn = currentLocale.value === 'en'
    if (gameData.value) {
      localizedModulesMap.value = buildLocalizedModulesMap(gameData.value.modules, isEn, translateModule)
      localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(gameData.value.moduleGroups, isEn, translateModuleGroup)
    }

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
      if (gameData.value) {
        localizedModulesMap.value = buildLocalizedModulesMap(gameData.value.modules, isEn, translateModule)
        localizedModuleGroupsMap.value = buildLocalizedModuleGroupsMap(gameData.value.moduleGroups, isEn, translateModuleGroup)
      }

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
    // Version state
    versionsConfig,
    currentVersion,
    isBeta,
    folderName,
    hasStoredVersion,
    // Version computed
    currentVersionConfig,
    versionOptions,
    needsVersionSetup,
    persistVersionSelection,
    // Core state
    isReady,
    searchQuery,
    gameData,
    waresMap,
    modulesMap,
    modulesByMacroId,
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
    // Static data (refs, not computed)
    bullets,
    missiles,
    drones,
    consumables,
    maps,
    regionyields,
    factions,
    defaultMaxes,
    shipSlots,
    languages,
    // Methods
    getStorageKey,
    setVersion,
    getRawData,
    initialize,
    changeLanguage,
    findModuleForWare,
    getModuleDisplayName,
    getWareDisplayName,
    getModuleVolumeCompression
  }
})
