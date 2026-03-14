/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

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
  displayVersion: (version: string, beta: boolean, codename?: string) => `${version}${codename ? `-${codename}` : ''}${beta ? '-beta' : ''}`,
  displayFullVersion: (version: string, beta: boolean) => `${version}${beta ? '-beta' : ''}`
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'settings.gameVersion.title': 'Game Version',
        'settings.gameVersion.select': 'Select game version',
        'settings.gameVersion.switch': 'Switch',
        'settings.gameVersion.save': 'Save',
        'settings.gameVersion.saveAndSwitch': 'Save and switch',
        'settings.gameVersion.unsavedModules': 'Unsaved modules',
        'settings.gameVersion.selectAll': 'Select all',
        'settings.gameVersion.saveScopeWarning': 'Checked modules will be saved before switching version.',
        'moduleNames.sector': 'Sector',
        'moduleNames.flow': 'Flow',
        'moduleNames.ship': 'Ship',
        'settings.gameVersion.moduleNameLabel': 'Name',
        'common.cancel': 'Cancel',
        'menu.default_flow_name': 'Flow Draft',
        'menu.default_blueprint_name': 'New Blueprint',
        'menu.blueprint': 'Blueprint',
        'sector.new_sector_name': 'New Sector',
        'menu.placeholder_enter_name': 'Enter name'
      }
      return dict[key] || key
    }
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateShip: (ship: { name?: string }) => ship.name || 'Ship'
  })
}))

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
    versionOptions: [
      { version: '8.0', codename: 'Diplomacy', beta: false, label: '8.0-Diplomacy' },
      { version: '9.0', codename: 'Empire', beta: true, label: '9.0-Empire-beta' }
    ],
    setVersion: setVersionMock,
    persistVersionSelection: persistVersionSelectionMock
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

import VersionSettingsModal from '@/components/VersionSettingsModal.vue'

describe('VersionSettingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

  it('选择 9.0 版本时会把 beta 一起传给 setVersion', async () => {
    const wrapper = mount(VersionSettingsModal, {
      props: {
        visible: true
      },
      global: {
        stubs: {
          teleport: true
        }
      }
    })

    const select = wrapper.get('[data-testid="version-select"]')
    await select.setValue('9.0::beta')
    await wrapper.get('[data-testid="version-switch"]').trigger('click')

    expect(setVersionMock).toHaveBeenCalledWith('9.0', true)
  })

  it('存在 dirty 模块但未勾选时仍显示取消和切换', async () => {
    logicFlowState.isDirty = true
    shipBuildState.isDirty = true

    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('[data-testid="version-select"]').setValue('9.0::beta')

    expect(wrapper.text()).toContain('Unsaved modules')
    expect(wrapper.text()).toContain('Flow')
    expect(wrapper.text()).toContain('Ship')
    expect(wrapper.find('[data-testid="version-save-switch"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-switch"]').text()).toBe('Switch')

    const checkboxes = wrapper.findAll('[data-testid^="unsaved-module-"]')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach((checkbox) => {
      expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    })
  })

  it('勾选模块后显示保存并切换，并为 isNew 模块显示独立名称输入框', async () => {
    empireState.isDirty = true
    logicFlowState.isDirty = true
    shipBuildState.isDirty = true
    logicFlowState.requiresSaveAsOnSave.mockReturnValue(true)
    shipBuildState.requiresSaveAsOnSave.mockReturnValue(true)
    shipBuildState.selectedShip = { id: 'ship-1', nameId: '{1,1}', name: 'Falx' }

    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    await wrapper.get('[data-testid="version-select"]').setValue('9.0::beta')
    await wrapper.get('[data-testid="unsaved-select-all"]').setValue(true)

    expect(wrapper.find('[data-testid="version-switch"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-save-switch"]').text()).toBe('Save and switch')
    expect(wrapper.text()).toContain('Sector')
    expect((wrapper.get('[data-testid="module-name-logic_flow"]').element as HTMLInputElement).value).toBe('Flow Draft')
    expect((wrapper.get('[data-testid="module-name-ship_blueprints"]').element as HTMLInputElement).value).toBe('Falx Blueprint')

    await wrapper.get('[data-testid="version-save-switch"]').trigger('click')

    expect(saveEmpireMock).toHaveBeenCalledTimes(1)
    expect(saveCurrentPlanAsMock).toHaveBeenCalledWith('Flow Draft')
    expect(saveAsBlueprintMock).toHaveBeenCalledWith('Falx Blueprint')
    expect(setVersionMock).toHaveBeenCalledWith('9.0', true)
  })

  it('同版本但尚未写库时，切换只确认写入版本且不走保存流', async () => {
    gameDataState.hasStoredVersion = false
    logicFlowState.isDirty = true

    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    expect(wrapper.find('[data-testid="unsaved-modules-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="version-switch"]').text()).toBe('Save')

    await wrapper.get('[data-testid="version-switch"]').trigger('click')

    expect(persistVersionSelectionMock).toHaveBeenCalledWith('8.0', false)
    expect(setVersionMock).not.toHaveBeenCalled()
    expect(saveCurrentPlanMock).not.toHaveBeenCalled()
  })

  it('同版本且已经写库时，切换按钮置灰', async () => {
    const wrapper = mount(VersionSettingsModal, {
      props: { visible: true },
      global: { stubs: { teleport: true } }
    })

    const button = wrapper.get('[data-testid="version-switch"]')
    expect((button.element as HTMLButtonElement).disabled).toBe(true)

    await button.trigger('click')

    expect(setVersionMock).not.toHaveBeenCalled()
    expect(persistVersionSelectionMock).not.toHaveBeenCalled()
  })
})
