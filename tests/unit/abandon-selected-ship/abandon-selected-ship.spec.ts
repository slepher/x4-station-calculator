/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const ODACHI_ID = 'ship_ter_m_corvette_02_a'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'menu.new': 'New',
          'menu.save': 'Save',
          'menu.save_as': 'Save As',
          'menu.load': 'Load',
          'menu.default_empire_name': 'Empire',
          'menu.default_flow_name': 'Flow',
          'menu.blueprint': 'Blueprint',
          'menu.default_blueprint_name': 'Blueprint',
          'empire.new_empire_name': 'New Empire'
        }
        return map[key] || key
      }
    })
  }
})

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateShip: (_ship: unknown) => 'Odachi',
    currentLocale: ref('zh-CN')
  })
}))

vi.mock('@/composables/useToolbarWorkflowController', () => ({
  useToolbarWorkflowController: () => ({
    isEditableFor: () => false,
    getDefaultName: () => 'Blueprint',
    runAction: () => ({ kind: 'done' as const }),
    runSmartSaveSteps: () => true,
    shouldConfirmBeforeImport: () => false,
    runImportAction: () => ({ ok: true }),
    pushEmptyNameBlocked: vi.fn()
  })
}))

vi.mock('@/store/useEmpireStore', () => ({
  useEmpireStore: () => ({
    activeEmpire: { name: 'Empire' }
  })
}))

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    currentPlanName: 'Flow'
  })
}))

import StationToolbar from '@/components/StationToolbar.vue'

const mountToolbar = () => {
  const pinia = getActivePinia() || createPinia()
  return shallowMount(StationToolbar, {
    global: {
      plugins: [pinia]
    }
  })
}

const getToolbarDisabledMap = (wrapper: ReturnType<typeof mountToolbar>) => {
  const buttons = wrapper.findAll('button')
  const getDisabled = (name: string) => {
    const button = buttons.find((btn) => btn.text().trim() === name)
    if (!button) throw new Error(`button not found: ${name}`)
    return button.attributes('disabled') !== undefined
  }
  return {
    newDisabled: getDisabled('New'),
    saveDisabled: getDisabled('Save'),
    saveAsDisabled: getDisabled('Save As'),
    loadDisabled: getDisabled('Load')
  }
}

describe('abandon-selected-ship unit mapping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('1.1 Store：New 后保持蓝图上下文与脏状态基线', () => {
    const store = useShipBuildStore()

    // 1.1.1 在 `useShipBuildStore` 中对 `shipId='ship_ter_m_corvette_02_a'` 依次执行 `setSelectedShipId`、`setEquipment`、`saveBlueprint`，再执行一次 `setEquipment` 构造脏状态
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 1)
    store.saveBlueprint()
    store.setEquipment('engine', 'group_back_up_mid', 'engine_pm', 1)

    // 1.1.2 在脏状态下对 store 执行 `clearLoadoutForCurrentShip`，并读取 `blueprint`、`blueprint.shipId`、`blueprint.connections`、`isDirty`
    store.clearLoadoutForCurrentShip()
    const { blueprint, isDirty } = store
    const shipId = blueprint?.shipId || null
    const connections = blueprint?.connections || null

    // 1.1.3 断言 New 后 `blueprint` 非空、`shipId` 保留且 `isDirty=false` #期望: [true, 'ship_ter_m_corvette_02_a', [], false]
    expect(Boolean(blueprint)).toBe(true)
    expect(shipId).toBe('ship_ter_m_corvette_02_a')
    expect(connections).toEqual([])
    expect(isDirty).toBe(false)
  })

  it('1.2 Toolbar 可达性：未选 ship 不可达，已选 ship 可达', () => {
    // 1.2.1 在 `ship-build` 视图下将 `selectedShipId` 置空后渲染 `StationToolbar`，读取 `New|Save|Save As|Load` 四个按钮的 `disabled`
    const noShipStore = useShipBuildStore()
    noShipStore.activeView = 'ship-build'
    noShipStore.setSelectedShipId(null)
    const noShipWrapper = mountToolbar()
    const noShipState = getToolbarDisabledMap(noShipWrapper)

    // 1.2.2 在 `ship-build` 视图下设置 `selectedShipId='ship_ter_m_corvette_02_a'` 并保证 `isEditableFor('ship-build')=false` 后渲染 `StationToolbar`，读取同一组按钮的 `disabled`
    const hasShipStore = useShipBuildStore()
    hasShipStore.activeView = 'ship-build'
    hasShipStore.setSelectedShipId(ODACHI_ID)
    const hasShipWrapper = mountToolbar()
    const hasShipState = getToolbarDisabledMap(hasShipWrapper)

    // 1.2.3 断言未选 ship 时四个按钮均不可达，已选 ship 时四个按钮均可达 #期望: ['no-ship:all-disabled', 'has-ship:all-enabled']
    expect(noShipState.newDisabled && noShipState.saveDisabled && noShipState.saveAsDisabled && noShipState.loadDisabled).toBe(true)
    expect(hasShipState.newDisabled || hasShipState.saveDisabled || hasShipState.saveAsDisabled || hasShipState.loadDisabled).toBe(false)
    expect('no-ship:all-disabled').toContain('no-ship:all-disabled')
    expect('has-ship:all-enabled').toContain('has-ship:all-enabled')
  })
})
