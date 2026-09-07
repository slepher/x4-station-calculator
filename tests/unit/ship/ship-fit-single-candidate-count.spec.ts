// @vitest-environment jsdom
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ShipBuildPanelFit from '@/components/ship-build/ShipBuildPanelFit.vue'
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import { loadShipTestFixture } from './ship-test-fixture'
import i18n from '@/i18n'

const shipId = 'ship_ter_l_destroyer_01_a'
const weaponId = 'weapon_ter_l_destroyer_01_mk1'
const wrappers: ReturnType<typeof shallowMount>[] = []
function setup() {
  const store = useShipBuildStore()
  store.setSelectedShipId(shipId)
  const wrapper = shallowMount(ShipBuildPanelFit, { global: { plugins: [i18n] } })
  wrappers.push(wrapper)
  const state = (wrapper.vm.$ as any).setupState
  return { store, wrapper, state }
}
function counts(store: ReturnType<typeof useShipBuildStore>) {
  return store.blueprint!.connections.flatMap(c => c.group.map(g => ({ id: g.equipment_id, count: g.count })))
}

describe('Fit single candidate and target count', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    loadShipTestFixture()
    const gameData = useGameDataStore()
    gameData.gameData = JSON.parse(JSON.stringify(gameData.gameData))
  })
  afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

  it('fills a partial unique weapon and clears the full group without opening the picker', async () => {
    const { store, wrapper, state } = setup()
    state.handleSlotTypeClick('weapon')
    state.setMode('group')
    await nextTick()
    const target = state.slotTargets[0]
    const key = target.connectionKeys[0]
    store.applyConnectionAssignment({ connectionKey: key, equipmentId: weaponId })
    store.setConnectionAssignmentCount({ connectionKey: key, count: 1 })
    await nextTick()
    expect(state.slotTargets[0].totalCount).toBe(2)
    await wrapper.get(`[data-testid="slot-${target.key}"]`).trigger('click')
    expect(counts(store)).toEqual([{ id: weaponId, count: 1 }, { id: weaponId, count: 1 }])
    expect(wrapper.emitted('picker-open')).toBeUndefined()
    await wrapper.get(`[data-testid="slot-${target.key}"]`).trigger('click')
    expect(counts(store)).toEqual([])
    expect(wrapper.emitted('picker-open')).toBeUndefined()
  })

  it('uses aggregate capacity as group step and keeps realtime changes out of the blueprint', async () => {
    const { store, wrapper, state } = setup()
    state.handleSlotTypeClick('engine')
    state.setMode('group')
    await nextTick()
    const slider = wrapper.findAllComponents(X4DualPhaseRangeSlider)[0]!
    expect(slider.props('max')).toBe(2)
    expect(slider.props('step')).toBe(2)
    const before = JSON.stringify(store.blueprint)
    slider.vm.$emit('update:model-value', 1)
    await nextTick()
    expect(JSON.stringify(store.blueprint)).toBe(before)
    state.setMode('connection')
    await nextTick()
    expect(wrapper.findAllComponents(X4DualPhaseRangeSlider)[0]!.props('step')).toBe(1)
  })

  it('keeps equipment ID in group zero preview and zero commit', async () => {
    const { store, state } = setup()
    state.handleSlotTypeClick('weapon')
    state.setMode('group')
    await nextTick()
    const target = state.slotTargets[0]
    target.connectionKeys.forEach((connectionKey: string) => store.applyConnectionAssignment({ connectionKey, equipmentId: weaponId }))
    await nextTick()
    const before = JSON.stringify(store.blueprint)
    const preview = store.buildPreviewBlueprint({ connectionKeys: target.connectionKeys, equipmentId: weaponId, mode: 'group', targetCount: 0 })!
    expect(preview.connections[0]!.group[0]).toMatchObject({ equipment_id: weaponId, count: 0 })
    expect(JSON.stringify(store.blueprint)).toBe(before)
    state.handleCountSliderCommit(state.slotTargets[0], 0)
    expect(counts(store)).toEqual([{ id: weaponId, count: 0 }, { id: weaponId, count: 0 }])
    expect(store.currentBuildAnalysis.equipmentEntries).toEqual([])
    const stats = shallowMount(ShipBuildPanelStats, { props: { shipBlueprint: store.blueprint }, global: { plugins: [i18n] } })
    wrappers.push(stats as any)
    expect((stats.vm.$ as any).setupState.getWeaponStatsByUseEquipmentStats(store.blueprint)).toEqual({ burst: 0, sustained: 0 })
  })

  it('shares bounded heterogeneous capacity allocation between preview and commit', async () => {
    const game = useGameDataStore()
    const ship = game.gameData!.ships.find(ship => ship.id === shipId)!
    const weapon = ship.slots.find(slot => slot.type === 'weapon')!
    weapon.groups[0]!.connection.count = 1
    weapon.groups[1]!.connection.count = 3
    const { store, state } = setup()
    state.handleSlotTypeClick('weapon')
    state.setMode('group')
    await nextTick()
    const keys = state.slotTargets[0].connectionKeys
    for (const [total, expected] of [[0, [0, 0]], [3, [1, 2]], [4, [1, 3]], [99, [1, 3]]] as const) {
      const payload = { connectionKeys: keys, equipmentId: weaponId, mode: 'group' as const, targetCount: total }
      const before = JSON.stringify(store.blueprint)
      const preview = store.buildPreviewBlueprint(payload)!
      expect(JSON.stringify(store.blueprint)).toBe(before)
      expect(preview.connections[0]!.group.map(group => group.count)).toEqual(expected)
      store.applyTargetAssignment(payload)
      expect(store.blueprint).toEqual(preview)
      expect(counts(store).map(item => item.count)).toEqual(expected)
    }
  })

  it('opens zero/multiple candidate targets and requires compatibility across every connection', async () => {
    const { store, wrapper, state } = setup()
    state.handleSlotTypeClick('engine')
    await nextTick()
    await wrapper.get(`[data-testid="slot-${state.slotTargets[0].key}"]`).trigger('click')
    expect(wrapper.emitted('picker-open')).toHaveLength(1)
    state.handleSlotTypeClick('weapon')
    state.setMode('group')
    await nextTick()
    const target = state.slotTargets[0]
    store.setMockTagPatch({ targetShipId: shipId, slotType: 'weapon', connections: {
      [target.connectionKeys[1]]: { groupName: 'test-incompatible', size: 'large', tags: ['not-a-real-equipment-tag'] }
    } })
    expect(store.getCompatibleEquipmentIds(target.connectionKeys)).toEqual([])
    state.handleSlotClick(target)
    expect(wrapper.emitted('picker-open')).toHaveLength(2)
    expect(counts(store)).toEqual([])
  })

  it('filters DLC and forbidden blueprints for a parent shield without changing its parent equipment', async () => {
    const { store, wrapper, state } = setup()
    state.handleSlotTypeClick('turret')
    await nextTick()
    const parent = state.slotTargets[0]
    const shield = state.slotTargets[1]
    expect(shield.connectionKeys[0]).toBe(`${parent.connectionKeys[0]}::shield`)
    const game = useGameDataStore()
    const equipment = store.findEquipment(store.getCompatibleEquipmentIds(shield.connectionKeys)[0])!
    const parentEquipment = store.findEquipment(store.getCompatibleEquipmentIds(parent.connectionKeys)[0])!
    expect(equipment.type).toBe('shield')
    game.gameData!.equipments = [
      parentEquipment,
      { ...equipment, id: 'shield-allowed', dlc_tag: 'base' },
      { ...equipment, id: 'shield-inactive', dlc_tag: 'terran' },
      { ...equipment, id: 'shield-forbidden', dlc_tag: 'base', noplayerblueprint: true },
      { ...equipment, id: 'shield-incompatible', dlc_tag: 'base', slotTags: ['not-a-real-equipment-tag'] }
    ]
    game.dlcSetting = { enforceDlcActivation: true, activeDlcs: [] }
    expect(store.getCompatibleEquipmentIds(shield.connectionKeys)).toEqual(['shield-allowed'])
    store.applyConnectionAssignment({ connectionKey: parent.connectionKeys[0], equipmentId: parentEquipment.id })
    const before = store.blueprint!.connections[0]!.group[0]!
    const parentState = { id: before.equipment_id, count: before.count }
    state.handleSlotClick(shield)
    const after = store.blueprint!.connections[0]!.group[0]!
    expect({ id: after.equipment_id, count: after.count }).toEqual(parentState)
    expect(after.shield).toEqual({ equipment_id: 'shield-allowed', count: shield.totalCount })
    expect(wrapper.emitted('picker-open')).toBeUndefined()
  })

  it('fills and clears a standalone shield and retains its ID when its count is zero', async () => {
    const { store, wrapper, state } = setup()
    state.handleSlotTypeClick('shield')
    await nextTick()
    const target = state.slotTargets[0]
    expect(target.connectionKeys[0].split('::')[1]).toBe('shield')
    expect(target.connectionKeys[0].split('::')).toHaveLength(4)
    const game = useGameDataStore()
    const equipment = store.findEquipment(store.getCompatibleEquipmentIds(target.connectionKeys)[0])!
    game.gameData!.equipments = [{ ...equipment, id: 'standalone-shield', dlc_tag: 'base' }]
    state.handleSlotClick(target)
    await nextTick()
    expect(counts(store)).toEqual([{ id: 'standalone-shield', count: target.totalCount }])
    state.handleCountSliderCommit(state.slotTargets[0], 0)
    await nextTick()
    expect(counts(store)).toEqual([{ id: 'standalone-shield', count: 0 }])
    state.handleSlotClick(state.slotTargets[0])
    await nextTick()
    state.handleSlotClick(state.slotTargets[0])
    expect(counts(store)).toEqual([])
    expect(wrapper.emitted('picker-open')).toBeUndefined()
  })
})
