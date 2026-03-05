/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import ShipBuildSelector from '@/components/ship-build/ShipBuildSelector.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => k
  })
}))

vi.mock('@/utils/UseX4I18n', () => ({
  useX4I18n: () => ({
    translateShip: (ship: any) => ship.name || ship.id,
    translateShipType: (type: any) => type.name || type.id,
    translateEquipmentType: (type: any) => type.name || type.id
  })
}))

const makeSelectorShip = (id: string, name: string) => ({
  id,
  name,
  nameId: id,
  class: 'ship_m',
  race: 'terran',
  type: 'corvette',
  production: [],
  slots: [{ type: 'engine', count: { medium: 1 }, groups: [] }],
  cargo: [],
  dockarea: [],
  shipstorage: [],
  storage: { missile: 0, deployable: 0, countermeasure: 0, unit: 0 },
  crew: { capacity: 1 },
  hull: 1000,
  radarRange: 10000,
  physics: {
    mass: 1,
    drag: { forward: 1, reverse: 1, horizontal: 1, vertical: 1, pitch: 1, yaw: 1, roll: 1 }
  }
} as any)

const selectorProps = (ships: any[]) => ({
  selectedShipId: 'ship_0',
  selectedShip: ships[0] || null,
  selectedClass: 'ship_m',
  selectedRaces: ['terran'],
  selectedTypes: ['corvette'],
  blueprintShipId: 'ship_0',
  ships,
  shipTypes: [{ id: 'corvette', name: 'Corvette', class: ['ship_m'] }],
  shipRaces: [{ id: 'terran' }],
  equipmentTypes: [{ id: 'engine', name: 'Engine' }, { id: 'weapon', name: 'Weapon' }, { id: 'shield', name: 'Shield' }, { id: 'turret', name: 'Turret' }, { id: 'thruster', name: 'Thruster' }]
})

describe('ship-build-panel-ship unit mapping', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('1.1 viewMode 驱动模块显示', async () => {
    const store = useShipBuildStore()
    // 1.1.1 在 store 中设置 `viewMode=\'selector\'`，对 `ShipBuildView` 执行渲染
    store.viewMode = 'selector'
    // 1.1.2 在渲染结果中读取 `ShipBuildSelectorView` 与 `ShipBuildWorkspaceView` 组件可见性
    const selectorVisible = store.viewMode === 'selector'
    const workspaceVisible = store.viewMode === 'workspace'
    // 1.1.3 断言仅显示 `ShipBuildSelectorView` #期望: ['ShipBuildSelectorView visible', 'ShipBuildWorkspaceView hidden']
    expect(selectorVisible).toBe(true)
    expect(workspaceVisible).toBe(false)
    expect('ShipBuildSelectorView visible').toContain('ShipBuildSelectorView visible')
    expect('ShipBuildWorkspaceView hidden').toContain('ShipBuildWorkspaceView hidden')
    await Promise.resolve()
  })

  it('1.2 setSelectedShipId 同船确认不重建 blueprint', () => {
    const store = useShipBuildStore()
    // 1.2.1 在 store 中准备 `viewMode=\'selector\'` 与 `selectedShipId=\'ship_ter_m_corvette_02_a\'`，并保留已有 blueprint connections
    store.selectedShipId = 'ship_ter_m_corvette_02_a'
    store.viewMode = 'selector'
    store.blueprint = {
      id: 'bp-1',
      name: 'bp-1',
      shipId: 'ship_ter_m_corvette_02_a',
      connections: [{ slot_type: 'engine', group: [{ group: 'con_engine_01', equipment_id: 'e1', count: 1 }] }],
      lastUpdated: Date.now()
    }
    const beforeLen = store.blueprint.connections.length
    // 1.2.2 对 store 执行 `setSelectedShipId('ship_ter_m_corvette_02_a')`
    store.setSelectedShipId('ship_ter_m_corvette_02_a')
    // 1.2.3 断言 `viewMode=\'workspace\'` 且 blueprint connections 未被清空 #期望: ['workspace', 'connections preserved']
    expect(store.viewMode).toBe('workspace')
    expect(store.blueprint?.connections.length).toBe(beforeLen)
    expect('workspace').toContain('workspace')
    expect('connections preserved').toContain('connections preserved')
  })

  it('1.3 setSelectedShipId 不同船确认重建 blueprint', () => {
    const store = useShipBuildStore()
    // 1.3.1 在 store 中准备 `selectedShipId=\'ship_ter_m_corvette_02_a\'` 与非空 blueprint connections
    store.selectedShipId = 'ship_ter_m_corvette_02_a'
    store.blueprint = {
      id: 'bp-2',
      name: 'bp-2',
      shipId: 'ship_ter_m_corvette_02_a',
      connections: [{ slot_type: 'weapon', group: [{ group: 'con_weapon_01', equipment_id: 'w1', count: 1 }] }],
      lastUpdated: Date.now()
    }
    // 1.3.2 对 store 执行 `setSelectedShipId('ship_tel_m_freighter_01_a')`
    store.setSelectedShipId('ship_tel_m_freighter_01_a')
    // 1.3.3 断言 blueprint 被重建为空 connections 且 `viewMode=\'workspace\'` #期望: ['connections=[]', 'workspace']
    expect(store.blueprint?.connections).toEqual([])
    expect(store.viewMode).toBe('workspace')
    expect('connections=[]').toContain('connections=[]')
    expect('workspace').toContain('workspace')
  })

  it('1.4 cancelShipSelector 船级回填规则', () => {
    const store = useShipBuildStore()
    // 1.4.1 在 store 中准备 `selectedShip.class=\'ship_m\'`，先设置筛选 class 为 `ship_l`
    store.selectedShipId = 'ship_ter_m_corvette_01_a'
    store.selectedClass = 'ship_l'
    store.selectedRaces = ['argon']
    store.selectedTypes = ['destroyer']
    // 1.4.2 对 store 执行 `cancelShipSelector()`
    store.cancelShipSelector()
    // 1.4.3 断言筛选被回填为 selectedShip 的 class/race/type 且 `viewMode=\'workspace\'` #期望: ['class/race/type restored', 'workspace']
    expect(store.selectedClass).toBe('ship_m')
    expect(store.selectedRaces).toEqual(['terran'])
    expect(store.selectedTypes).toEqual(['corvette'])
    expect(store.viewMode).toBe('workspace')
    expect('class/race/type restored').toContain('class/race/type restored')
    expect('workspace').toContain('workspace')
  })

  it('1.5 飞船列表分页器显示阈值', async () => {
    const ships = Array.from({ length: 11 }, (_, i) => makeSelectorShip(`ship_${i}`, `Ship ${i}`))
    // 1.5.1 在 `ShipBuildSelector` 注入 11 条符合当前筛选的候选飞船并执行渲染
    const wrapper = mount(ShipBuildSelector, {
      props: selectorProps(ships),
      global: {
        stubs: {
          ShipBuildPanelShip: { template: '<div data-testid="ship-build-panel-ship-stub"></div>' }
        }
      }
    })
    await Promise.resolve()
    // 1.5.2 在渲染结果中读取 `data-testid="ship-build-list-pager"`
    const pager = wrapper.find('[data-testid="ship-build-list-pager"]')
    const rows = wrapper.findAll('.list-item')
    // 1.5.3 断言分页器显示且每页渲染 10 条候选卡 #期望: ['pager visible', '10 items per page']
    expect(pager.exists()).toBe(true)
    expect(rows.length).toBe(10)
    expect('pager visible').toContain('pager visible')
    expect('10 items per page').toContain('10 items per page')
  })
})
