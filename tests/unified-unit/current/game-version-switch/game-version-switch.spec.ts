/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'en' },
    t: (key: string) => key
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateModule: (value: { id?: string }) => value?.id || '',
    translateModuleGroup: (value: { id?: string }) => value?.id || '',
    translateWare: (value: { id?: string }) => value?.id || '',
    translateShip: (ship: { name?: string }) => ship.name || 'Ship'
  })
}))

vi.mock('@/i18n', () => ({
  loadLanguageAsync: vi.fn().mockResolvedValue(undefined),
  setGameFolderName: vi.fn()
}))

vi.mock('@/store/logic/useGameData', () => ({
  loadGameDataFiles: vi.fn().mockResolvedValue({
    wares: [],
    modules: [],
    moduleGroups: [],
    consumption: {},
    ships: [],
    shipRaces: [],
    shipTypes: [],
    equipments: [],
    equipmentTypes: [],
    slotTags: [],
    consumables: [],
    drones: [],
    missiles: [],
    bullets: [],
    maps: { clusters: {} },
    regionyields: [],
    factions: [],
    defaultMaxes: {},
    shipSlots: {},
    languages: []
  }),
  buildWaresMap: vi.fn(() => ({})),
  buildModulesMap: vi.fn(() => ({})),
  buildModulesByMacroIdMap: vi.fn(() => ({})),
  buildModulesByOutputMap: vi.fn(() => ({})),
  buildMedicalConsumptionMap: vi.fn(() => ({})),
  buildLocalizedModulesMap: vi.fn(() => ({})),
  buildLocalizedModuleGroupsMap: vi.fn(() => ({})),
  findModuleForWare: vi.fn(() => null),
  precomputeCandidateWares: vi.fn(() => ({
    wareSetsByIndustrialRace: {},
    wareSetsByRace: {}
  }))
}))

const setVersionMock = vi.fn()
const persistVersionSelectionMock = vi.fn()
const saveEmpireMock = vi.fn()
const saveEmpireAsMock = vi.fn(() => true)
const saveCurrentPlanMock = vi.fn(() => true)
const saveCurrentPlanAsMock = vi.fn(() => true)
const saveBlueprintMock = vi.fn()
const saveAsBlueprintMock = vi.fn()

const gameDataState = {
  currentVersion: '8.0',
  isBeta: false,
  hasStoredVersion: true,
  displayVersion: (version: string, beta: boolean, codename?: string, miniVersion?: number) => `${version}${codename ? `-${codename}` : ''}${beta ? '-beta' : ''}${miniVersion !== undefined ? `-${miniVersion}` : ''}`,
  displayFullVersion: (version: string, beta: boolean, showMiniVersion?: boolean) => `${version}${beta ? '-beta' : ''}`,
  getStorageKey: (module: string) => {
    const version = gameDataState.currentVersion
    const beta = gameDataState.isBeta
    const versionSuffix = beta ? `_v${version.split('.')[0]}_beta` : (version === '8.0' ? '' : `_v${version.split('.')[0]}`)
    const baseKeys: Record<string, string> = {
      empire: 'x4_empire_data',
      logic_flow: 'x4_logic_flow_plans',
      ship_blueprints: 'x4_ship_blueprints'
    }
    return baseKeys[module] + versionSuffix
  }
}

const empireState = {
  isDirty: false,
  requiresSaveAsOnSave: vi.fn(() => false)
}

const logicFlowState = {
  isDirty: false,
  requiresSaveAsOnSave: vi.fn(() => false)
}

const shipBuildState = {
  isDirty: false,
  requiresSaveAsOnSave: vi.fn(() => false),
  selectedShip: null as null | { id: string; nameId: string; name?: string }
}

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: vi.fn(() => ({
    get currentVersion() {
      return gameDataState.currentVersion
    },
    get isBeta() {
      return gameDataState.isBeta
    },
    get hasStoredVersion() {
      return gameDataState.hasStoredVersion
    },
    displayVersion: gameDataState.displayVersion,
    displayFullVersion: gameDataState.displayFullVersion,
    getStorageKey: gameDataState.getStorageKey,
    versionOptions: [
      { version: '8.0', codename: 'Diplomacy', beta: false, label: '8.0-Diplomacy' },
      { version: '9.0', codename: 'Empire', beta: true, label: '9.0-Empire-beta-6' }
    ],
    setVersion: setVersionMock,
    persistVersionSelection: persistVersionSelectionMock,
    initialize: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: vi.fn(() => ({
    get isDirty() {
      return empireState.isDirty
    },
    requiresSaveAsOnSave: empireState.requiresSaveAsOnSave,
    saveEmpire: saveEmpireMock,
    saveEmpireAs: saveEmpireAsMock
  }))
}))

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: vi.fn(() => ({
    get isDirty() {
      return logicFlowState.isDirty
    },
    requiresSaveAsOnSave: logicFlowState.requiresSaveAsOnSave,
    saveCurrentPlan: saveCurrentPlanMock,
    saveCurrentPlanAs: saveCurrentPlanAsMock
  }))
}))

vi.mock('@/store/useShipBuildStore', () => ({
  useShipBuildStore: vi.fn(() => ({
    get isDirty() {
      return shipBuildState.isDirty
    },
    requiresSaveAsOnSave: shipBuildState.requiresSaveAsOnSave,
    get selectedShip() {
      return shipBuildState.selectedShip
    },
    saveBlueprint: saveBlueprintMock,
    saveAsBlueprint: saveAsBlueprintMock
  }))
}))

import { useGameDataStore } from '@/store/useGameDataStore'
import VersionSettingsModal from '@/components/VersionSettingsModal.vue'

describe('1 单元测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    setVersionMock.mockReset()
    persistVersionSelectionMock.mockReset()
    saveEmpireMock.mockReset()
    saveEmpireAsMock.mockClear()
    saveCurrentPlanMock.mockClear()
    saveCurrentPlanAsMock.mockClear()
    saveBlueprintMock.mockReset()
    saveAsBlueprintMock.mockReset()
    empireState.isDirty = false
    empireState.requiresSaveAsOnSave.mockReturnValue(false)
    logicFlowState.isDirty = false
    logicFlowState.requiresSaveAsOnSave.mockReturnValue(false)
    shipBuildState.isDirty = false
    shipBuildState.requiresSaveAsOnSave.mockReturnValue(false)
    shipBuildState.selectedShip = null
    gameDataState.currentVersion = '8.0'
    gameDataState.isBeta = false
    gameDataState.hasStoredVersion = true
    document.body.innerHTML = ''
  })

  it('1.1 版本管理逻辑测试', async () => {
    const store = useGameDataStore()
    expect(store.getStorageKey('empire')).toBe('x4_empire_data')
    
    gameDataState.currentVersion = '9.0'
    gameDataState.isBeta = true
    expect(store.getStorageKey('logic_flow')).toBe('x4_logic_flow_plans_v9_beta')
    
    gameDataState.currentVersion = '8.0'
    gameDataState.isBeta = false
    expect(store.getStorageKey('ship_blueprints')).toBe('x4_ship_blueprints')
    
    gameDataState.currentVersion = '9.0'
    gameDataState.isBeta = false
    expect(store.getStorageKey('empire')).toBe('x4_empire_data_v9')
  })

  it('1.2 版本显示格式测试', async () => {
    const store = useGameDataStore()
    expect(store.displayVersion('9.0', true, 'Empire', 6)).toBe('9.0-Empire-beta-6')
    expect(store.displayFullVersion('9.0', true)).toBe('9.0-beta')
    expect(store.displayFullVersion('8.0', false)).toBe('8.0')
    expect(store.versionOptions.map(option => option.label)).toEqual([
      '8.0-Diplomacy',
      '9.0-Empire-beta-6'
    ])
  })

  it('1.3 VersionSettingsModal 未保存模块流程测试', async () => {
    logicFlowState.isDirty = true
    shipBuildState.isDirty = true

    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('[data-testid="version-select"]').setValue('9.0::beta')

    expect(wrapper.text()).toContain('settings.gameVersion.unsavedModules')
    expect(wrapper.text()).toContain('moduleNames.flow')
    expect(wrapper.text()).toContain('moduleNames.ship')
    expect(wrapper.find('[data-testid="version-save-switch"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-switch"]').text()).toBe('settings.gameVersion.switch')
    expect(wrapper.text()).toContain('common.cancel')

    await wrapper.get('[data-testid="unsaved-module-logic_flow"]').setValue(true)

    expect(wrapper.find('[data-testid="version-switch"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-save-switch"]').text()).toBe('settings.gameVersion.saveAndSwitch')

    logicFlowState.requiresSaveAsOnSave.mockReturnValue(true)
    shipBuildState.requiresSaveAsOnSave.mockReturnValue(true)
    shipBuildState.selectedShip = { id: 'ship-1', nameId: '{1,1}', name: 'Falx' }

    const wrapper2 = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper2.get('[data-testid="version-select"]').setValue('9.0::beta')
    await wrapper2.get('[data-testid="unsaved-select-all"]').setValue(true)

    expect(wrapper2.find('[data-testid="module-name-logic_flow"]').exists()).toBe(true)
    expect((wrapper2.get('[data-testid="module-name-logic_flow"]').element as HTMLInputElement).value).toBe('menu.default_flow_name')
    expect(wrapper2.find('[data-testid="module-name-ship_blueprints"]').exists()).toBe(true)
    expect((wrapper2.get('[data-testid="module-name-ship_blueprints"]').element as HTMLInputElement).value).toBe('Falx menu.blueprint')

    await wrapper2.get('[data-testid="version-save-switch"]').trigger('click')

    expect(saveCurrentPlanAsMock).toHaveBeenCalledWith('menu.default_flow_name')
    expect(saveAsBlueprintMock).toHaveBeenCalledWith('Falx menu.blueprint')
    expect(setVersionMock).toHaveBeenCalledWith('9.0', true)
  })

  it('1.4 VersionSettingsModal 同版本确认与禁用测试', async () => {
    gameDataState.hasStoredVersion = false
    logicFlowState.isDirty = true

    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    expect(wrapper.find('[data-testid="unsaved-modules-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-switch"]').text()).toBe('settings.gameVersion.save')

    await wrapper.get('[data-testid="version-switch"]').trigger('click')

    expect(persistVersionSelectionMock).toHaveBeenCalledWith('8.0', false)
    expect(setVersionMock).not.toHaveBeenCalled()

    gameDataState.hasStoredVersion = true

    const wrapper2 = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    const button = wrapper2.get('[data-testid="version-switch"]')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })
})