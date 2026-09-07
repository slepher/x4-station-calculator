// @vitest-environment jsdom
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ShipBuildPanelEquipment from '@/components/ship-build/ShipBuildPanelEquipment.vue'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { loadShipTestFixture } from './ship-test-fixture'
import equipments from '@/assets/x4_game_data/9.0-Empire/data/equipments.json'
import bullets from '@/assets/x4_game_data/9.0-Empire/data/bullets.json'
import i18n from '@/i18n'

const wrappers: ReturnType<typeof shallowMount>[] = []
function render(id: string | null, currentId: string | null = null) {
  const store = useShipBuildStore()
  store.setSelectedShipId('ship_ter_m_corvette_02_a')
  const selectedShip = JSON.parse(JSON.stringify(store.selectedShip))
  selectedShip.physics.mass = 10
  selectedShip.physics.drag.forward = 2
  const equipment = store.findEquipment(id === null ? currentId : id)
  const wrapper = shallowMount(ShipBuildPanelEquipment, { props: {
    panelMode: 'equipment', isPickerOpen: true, pickerTarget: { connectionKeys: [], size: 'medium', tags: [] },
    highlightedEquipmentId: id, currentEquipmentId: currentId, selectedShip,
    slotType: equipment ? equipment.type : 'engine', isShield: false
  }, global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  return { wrapper, state: (wrapper.vm.$ as any).setupState, equipment }
}
describe('Equipment canonical details and summary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadShipTestFixture()
    const game = useGameDataStore()
    game.gameData!.equipments = equipments as any
    game.bullets = bullets as any
  })
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

  it('renders all turret fields using actual beam stats including zero thermal fields', () => {
    const { wrapper } = render('turret_arg_m_beam_01_mk1')
    const panel = wrapper.getComponent(MetricsPanel)
    const keys = panel.props('schema').flat().map((field: any) => field.key)
    expect(keys).toEqual(expect.arrayContaining(['burstDPS', 'sustainedDPS', 'range', 'singleDamage', 'avgShotTime', 'ammo', 'ammoReload', 'chargetime', 'timeToOverheat', 'cooldelay', 'coolTime', 'cycleTime']))
    expect(panel.props('objTarget')).toMatchObject({ burstDPS: 54, sustainedDPS: 54, range: 5000, singleDamage: 378, chargetime: 0, timeToOverheat: 0, cooldelay: 0, coolTime: 0, cycleTime: 0 })
  })

  it('renders engine thrust fields and travel speed with charge without changing shared physics', () => {
    const { wrapper, state, equipment } = render('engine_arg_m_allround_01_mk1')
    const panel = wrapper.getComponent(MetricsPanel)
    const keys = panel.props('schema').flat().map((field: any) => field.key)
    expect(keys).toEqual(expect.arrayContaining(['thrustForward', 'boostMultiplier', 'travelThrust', 'travelCharge']))
    expect(panel.props('objTarget')).toMatchObject({ thrustForward: 960, speed: 480, boostMultiplier: 7.38, travelThrust: 10089.6, travelSpeed: 5045, travelCharge: 8 })
    expect(state.getEquipmentSummary2(equipment).value).toBe('5045:8')
  })

  it('preserves current-only, candidate comparison, maxima and empty selection behavior', async () => {
    const { wrapper, state } = render(null, 'shield_arg_m_standard_01_mk1')
    const current = wrapper.getComponent(MetricsPanel)
    expect(current.props('schema').flat().map((field: any) => field.key)).toEqual(expect.arrayContaining(['shieldMax', 'shieldRate', 'shieldDelay']))
    expect(state.panelCurrentValues).toBeNull()
    expect(state.panelTargetValues).toMatchObject({ shieldMax: 5750, shieldRate: 100, shieldDelay: 12.5 })
    await wrapper.setProps({ highlightedEquipmentId: 'shield_arg_m_standard_01_mk2' })
    expect(state.panelCurrentValues).toMatchObject({ shieldMax: 5750, shieldRate: 100, shieldDelay: 12.5 })
    expect(state.panelTargetValues).toMatchObject({ shieldMax: 7475, shieldRate: 140, shieldDelay: 12.5 })
    const shield = current.props('schema').flat().find((item: any) => item.key === 'shieldMax')
    expect(shield.max).toBeGreaterThanOrEqual(state.panelTargetValues.shieldMax)
    await wrapper.setProps({ highlightedEquipmentId: null, currentEquipmentId: null })
    expect(wrapper.findComponent(MetricsPanel).exists()).toBe(false)
  })

  it('retains thruster field and summary outputs', () => {
    const { wrapper, state, equipment } = render('thruster_gen_m_allround_01_mk1')
    expect(wrapper.getComponent(MetricsPanel).props('schema').flat().map((field: any) => field.key)).toEqual(expect.arrayContaining(['pitch', 'yaw', 'roll', 'strafe', 'pitchRate', 'yawRate', 'rollRate', 'strafeSpeed', 'strafeAcceleration']))
    expect(state.getEquipmentSummary1(equipment).value).not.toBe('')
    expect(state.getEquipmentSummary2(equipment).value).not.toBe('')
  })
})
