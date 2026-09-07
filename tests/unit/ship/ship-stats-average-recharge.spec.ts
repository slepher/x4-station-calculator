// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { loadShipTestFixture } from './ship-test-fixture'
import type { EngineDetail } from '@/composables/useEquipmentStats'
import type { ShipBlueprint } from '@/types/x4'
import i18n from '@/i18n'

const wrappers: ReturnType<typeof mount>[] = []
const beam = 'turret_arg_m_beam_02_mk1'
const pulse = 'turret_ter_m_laser_02_mk1'
const engine = 'engine_ter_l_allround_01_mk1'
function blueprint(): ShipBlueprint {
  return {
    id: 'average', name: 'Weighted turrets', shipId: 'ship_ter_l_destroyer_01_a', materialMethod: 'default', createdAt: 1, lastUpdated: 1,
    connections: [{ slot_type: 'turret', group: [
      { group: 'group_front_mid_mid', equipment_id: beam, count: 1 },
      { group: 'group_up_mid_mid', equipment_id: pulse, count: 2 }
    ] }]
  }
}
function render(current = blueprint(), target?: ShipBlueprint) {
  const wrapper = mount(ShipBuildPanelStats, { props: { shipBlueprint: current, targetBlueprint: target }, global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  return wrapper
}
const value = (wrapper: ReturnType<typeof mount>, key: string) => wrapper.get(`[data-testid="metric-value-${key}"]`).text()

describe('actual ShipBuildPanelStats weighted turret average and recharge rate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadShipTestFixture()
  })
  afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

  it('weights two actual turret models by installed count, with unrelated metrics unchanged', () => {
    const wrapper = render()
    // 8.0 beam72damage*1s/3s=24DPS. Pulse12damage*2barrels*3shots/(3/6+0.5s)=72DPS.
    // (24*1+72*2)/3=56, not 56/6 or unweighted48.
    expect(value(wrapper, 'turret_avg')).toBe('56MW')
    expect(value(wrapper, 'hull')).toBe('95,000MJ')
    expect(value(wrapper, 'crew')).toBe('75')
    expect(value(wrapper, 'speed')).toBe('0m/s')
    expect(value(wrapper, 'weapon_burst')).toBe('0MW')
  })

  it.each(['zero', 'empty'])('%s installed turrets produce zero rather than phantom contribution', mode => {
    const current = blueprint()
    if (mode === 'empty') current.connections = []
    else current.connections[0]!.group.forEach(group => { group.count = 0 })
    expect(value(render(current), 'turret_avg')).toBe('0MW')
  })

  it('excludes disabled DLC turret from both numerator and denominator reactively', async () => {
    const game = useGameDataStore()
    game.dlcSetting = { enforceDlcActivation: true, activeDlcs: [] }
    const wrapper = render()
    expect(value(wrapper, 'turret_avg')).toBe('24MW')
    game.dlcSetting = { enforceDlcActivation: false, activeDlcs: [] }
    await nextTick()
    expect(value(wrapper, 'turret_avg')).toBe('56MW')
  })

  it('preview applies the same weighted formula without changing current blueprint', async () => {
    const current = blueprint()
    const original = JSON.stringify(current)
    const target = structuredClone(current)
    target.connections[0]!.group[1]!.count = 0
    const wrapper = render(current, target)
    const props = wrapper.getComponent(MetricsPanel).props()
    expect(props.objCurrent!.turret_avg).toBe(56)
    expect(props.objTarget!.turret_avg).toBe(24)
    expect(value(wrapper, 'turret_avg')).toBe('24(-32)MW')
    expect(JSON.stringify(current)).toBe(original)
    await wrapper.setProps({ targetBlueprint: undefined })
    expect(value(wrapper, 'turret_avg')).toBe('56MW')
    expect(JSON.stringify(current)).toBe(original)
  })

  it('converts engine recharge100 to panel1%/s while retaining shared equipment details', async () => {
    const current = blueprint()
    current.connections = [{ slot_type: 'engine', group: [{ group: 'engine', equipment_id: engine, count: 2 }] }]
    const store = useShipBuildStore()
    const shared = useEquipmentStats(store.findEquipment(engine)!, store.findShip(current.shipId)!)
    expect((shared.details.value as EngineDetail).boostRecharge).toBe(100)
    const wrapper = render(current)
    await wrapper.get('[data-testid="view-tab-btn-metrics-panel-ship-build-stats-panel-detail"]').trigger('click')
    expect(value(wrapper, 'boost_recharge')).toBe('1%/s')
    expect(value(wrapper, 'speed')).toBe('108m/s')
    expect(value(wrapper, 'travel_speed')).toBe('3,033m/s')
    expect(value(wrapper, 'boost_speed')).toBe('520m/s')
    expect((shared.details.value as EngineDetail).boostRecharge).toBe(100)
    const target = structuredClone(current)
    target.connections[0]!.group[0]!.count = 0
    await wrapper.setProps({ targetBlueprint: target })
    expect(value(wrapper, 'boost_recharge')).toBe('0(-1)%/s')
    expect(wrapper.getComponent(MetricsPanel).props('objCurrent')!.boost_recharge).toBe(1)
  })
})
