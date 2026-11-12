// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, shallowMount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useShipBuildWorkspacePresenter } from '@/components/ship-build/presenters/useShipBuildWorkspacePresenter'
import { compareMetric, useShipBuildCompareStatsPresenter } from '@/components/ship-build/presenters/useShipBuildCompareStatsPresenter'
import { useGameDataStore } from '@/store/useGameDataStore'
import ShipBuildWorkspaceView from '@/components/ship-build/ShipBuildWorkspaceView.vue'
import ShipBuildPanelStats from '@/components/ship-build/ShipBuildPanelStats.vue'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ShipBuildView from '@/components/ship-build/ShipBuildView.vue'
import ShipBuildSelectorView from '@/components/ship-build/ShipBuildSelectorView.vue'
import X4DualPhaseRangeSlider from '@/components/common/X4DualPhaseRangeSlider.vue'
import StationToolbar from '@/components/StationToolbar.vue'
import { loadShipTestFixture } from './ship-test-fixture'
import i18n from '@/i18n'

function setup() {
  const store = useShipBuildStore()
  store.setSelectedShipId('ship_ter_l_destroyer_01_a')
  store.saveAsBlueprint('A')
  const ui = useShipBuildWorkspacePresenter()
  return { store, ui }
}
describe('comparison workspace and protected commands', () => {
  beforeEach(() => { setActivePinia(createPinia()); loadShipTestFixture(); localStorage.clear() })

  it.each(['A', 'B'] as const)('syncs favorite UI and persists both toggle directions on %s', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    store.savePlan('B', 'B')
    const otherSide = side === 'A' ? 'B' : 'A'
    store.getPlan(otherSide)!.blueprint!.name = 'other unsaved draft'
    const other = JSON.stringify(store.getPlan(otherSide))
    const targetId = store.getPlan(side)!.saveTargetId!
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = () => wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`)
    for (const favorite of [true, false]) {
      await panel().get('.ship-blueprint-fav-btn').trigger('click')
      expect(panel().get('.ship-blueprint-fav-btn').classes().includes('is-favorited')).toBe(favorite)
      expect(store.findBlueprintById(targetId)!.favorite).toBe(favorite)
      expect(store.getPlan(side)!.blueprint!.favorite).toBe(favorite)
      await panel().get('[data-testid="ship-build-blueprint-save"]').trigger('click')
      expect(store.findBlueprintById(targetId)!.favorite).toBe(favorite)
      expect(store.isPlanDirty(side)).toBe(false)
      const persisted = JSON.parse(localStorage.getItem('x4_ship_blueprints')!)
      expect(persisted.ships.flatMap((bucket: any) => bucket.blueprints).find((bp: any) => bp.id === targetId).favorite).toBe(favorite)
      expect(JSON.stringify(store.getPlan(otherSide))).toBe(other)
    }
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('keeps mixed assignments until an explicit candidate is chosen on %s', async side => {
    const { store, ui } = setup()
    store.setSelectedShipId('ship_arg_xl_carrier_01_a')
    ui.openComparison()
    const high = store.getLoadableBlueprintsForShip(store.getPlan(side)!.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    store.loadPlanPreset(side, high.id)
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = () => wrapper.get(`[data-side="${side}"]`)
    await panel().findAll('button').find(b => b.text() === 'T')!.trigger('click')
    await panel().findAll('button').find(b => b.text() === 'M1')!.trigger('click')
    await panel().findAll('.slot-row')[0]!.trigger('click')
    const candidate = wrapper.findAll('[data-testid^="candidate-"]').find(b => {
      const id = b.attributes('data-testid')
      return id !== 'candidate-empty' && id !== `candidate-${ui.currentEquipmentId.value}`
    })!
    await candidate.trigger('click')
    expect(ui.confirmPicker()).toBe(true)
    await nextTick()
    await panel().findAll('button').find(b => b.text() === i18n.global.t('ship_build.fit_mode_group'))!.trigger('click')
    await panel().findAll('button').find(b => b.text() === 'M')!.trigger('click')
    const before = JSON.stringify(store.getPlan(side))
    const other = JSON.stringify(store.getPlan(side === 'A' ? 'B' : 'A'))
    await panel().findAll('.slot-row')[0]!.trigger('click')
    expect(wrapper.findAll('.candidate-item-active')).toHaveLength(0)
    expect(ui.preview.value).toBeNull()
    expect(ui.confirmPicker()).toBe(true)
    await nextTick()
    expect(JSON.stringify(store.getPlan(side))).toBe(before)
    await panel().findAll('.slot-row')[0]!.trigger('click')
    await wrapper.get('[data-testid="candidate-empty"]').trigger('click')
    expect(ui.preview.value).not.toBeNull()
    ui.closePicker()
    await nextTick()
    expect(JSON.stringify(store.getPlan(side))).toBe(before)
    await panel().findAll('.slot-row')[0]!.trigger('click')
    expect(wrapper.findAll('.candidate-item-active')).toHaveLength(0)
    await wrapper.get('[data-testid="candidate-empty"]').trigger('click')
    const keys = [...ui.pickerTarget.value!.connectionKeys]
    expect(ui.confirmPicker()).toBe(true)
    keys.forEach(key => expect(store.getPlanConnectionAssignment(side, key)?.equipmentId).toBeFalsy())
    expect(JSON.stringify(store.getPlan(side === 'A' ? 'B' : 'A'))).toBe(other)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('keeps installed turret selected across L and M groups on %s', async side => {
    const { store, ui } = setup()
    store.setSelectedShipId('ship_arg_xl_carrier_01_a')
    ui.openComparison()
    const high = store.getLoadableBlueprintsForShip(store.getPlan(side)!.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    store.loadPlanPreset(side, high.id)
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = wrapper.get(`[data-side="${side}"]`)
    await panel.findAll('button').find(b => b.text() === 'T')!.trigger('click')
    await panel.findAll('.slot-row')[0]!.trigger('click')
    const before = JSON.stringify(store.getPlan(side)!.blueprint)
    for (const tab of ['M1', 'M2', 'L']) {
      await panel.findAll('button').find(b => b.text() === tab)!.trigger('click')
      await nextTick()
      const installed = store.getPlanConnectionAssignment(side, ui.pickerTarget.value!.connectionKeys[0]!)!.equipmentId
      expect(ui.currentEquipmentId.value).toBe(installed)
      expect(ui.highlightedEquipmentId.value).toBe(installed)
      expect(wrapper.get('[data-column="picker"] .candidate-item-active').attributes('data-testid')).toBe(`candidate-${installed}`)
    }
    ui.confirmPicker()
    expect(JSON.stringify(store.getPlan(side)!.blueprint)).toBe(before)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('changes only the selected ship side %s and keeps comparison on cancel', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    store.getPlan('A')!.blueprint!.name = 'dirty A'
    store.getPlan('B')!.blueprint!.name = 'dirty B'
    const other = side === 'A' ? 'B' : 'A'
    const before = JSON.stringify(store.getPlan(other))
    const wrapper = mount(ShipBuildView, { global: { plugins: [i18n] } })
    await wrapper.get(`[data-side="${side}"] [data-testid="ship-build-change-ship-fit-header"]`).trigger('click')
    ui.cancelShipSelection()
    await nextTick()
    expect(ui.compare.value).toBe(true)
    expect(store.viewMode).toBe('workbench')
    await wrapper.get(`[data-side="${side}"] [data-testid="ship-build-change-ship-fit-header"]`).trigger('click')
    ui.chooseShip('ship_ter_m_corvette_02_a')
    expect(ui.protection.value!.side).toBe(side)
    ui.discard()
    expect(ui.compare.value).toBe(true)
    expect(store.getPlan(side)!.blueprint!.shipId).toBe('ship_ter_m_corvette_02_a')
    expect(JSON.stringify(store.getPlan(other))).toBe(before)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('saves only %s from its header and opens side-bound save-as from its menu', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    store.savePlan('B', 'B')
    const other = side === 'A' ? 'B' : 'A'
    const target = store.getPlan(side)!.saveTargetId!
    store.getPlan(side)!.blueprint!.name = `Edited ${side}`
    const otherBefore = JSON.stringify(store.getPlan(other))
    ui.activate(other)
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`)
    await panel.get('[data-testid="ship-build-blueprint-save"]').trigger('click')
    expect(store.findBlueprintById(target)!.name).toBe(`Edited ${side}`)
    expect(store.isPlanDirty(side)).toBe(false)
    expect(JSON.stringify(store.getPlan(other))).toBe(otherBefore)
    expect(panel.find('[data-testid="ship-build-blueprint-menu"]').exists()).toBe(false)
    await panel.get('[data-testid="ship-build-blueprint-menu-trigger"]').trigger('click')
    await panel.get('[data-testid="ship-build-blueprint-save-as"]').trigger('click')
    expect(ui.naming.value!.side).toBe(side)
    expect(ui.saveDialog.value!.intent).toBe('SAVE_AS')
    expect(panel.find('[data-testid="ship-build-blueprint-menu"]').exists()).toBe(false)
    ui.cancel()
    store.deleteBlueprint(target, side)
    await nextTick()
    await panel.get('[data-testid="ship-build-blueprint-save"]').trigger('click')
    expect(ui.naming.value!.side).toBe(side)
    expect(ui.saveDialog.value!.intent).toBe('SAVE_AS')
    ui.cancel()
    ui.openPicker(side, 'engine', null, false)
    await nextTick()
    expect(panel.get('[data-testid="ship-build-blueprint-save"]').attributes('disabled')).toBeDefined()
    expect(panel.get('[data-testid="ship-build-blueprint-menu-trigger"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('shows equipment comparison above ship stats when choosing equipment on %s', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    const high = store.getLoadableBlueprintsForShip(store.getPlan(side)!.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    store.loadPlanPreset(side, high.id)
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    await wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`).findAll('.slot-row')[0]!.trigger('click')
    const candidate = wrapper.findAll('[data-testid^="candidate-"]').find(item => {
      const id = item.attributes('data-testid')
      return id !== 'candidate-empty' && id !== `candidate-${ui.currentEquipmentId.value}`
    })!
    expect(candidate).toBeTruthy()
    await candidate.trigger('click')
    const statsColumn = wrapper.get('[data-column="stats"]')
    const equipment = statsColumn.findAllComponents(MetricsPanel).find(panel => panel.props('panelId') === 'ship-build-equipment')!
    expect(equipment).toBeTruthy()
    expect(equipment.props('objCurrent')).not.toBeNull()
    expect(equipment.props('objTarget')).not.toBeNull()
    expect(equipment.props('objCurrent')).not.toEqual(equipment.props('objTarget'))
    expect(statsColumn.element.firstElementChild).toBe(equipment.element)
    expect(wrapper.get('[data-column="picker"]').find('[data-testid="metrics-panel-ship-build-equipment"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('selects the installed equipment when switching occupied slots on %s', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    const high = store.getLoadableBlueprintsForShip(store.getPlan(side)!.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    store.loadPlanPreset(side, high.id)
    const before = JSON.stringify([store.getPlan('A'), store.getPlan('B')])
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`)
    const slots = panel.findAll('.slot-row')
    for (const index of [0, 1, 0]) {
      await slots[index]!.trigger('click')
      await nextTick()
      const installed = store.getPlanConnectionAssignment(side, ui.pickerTarget.value!.connectionKeys[0]!)!.equipmentId
      expect(installed).toBeTruthy()
      expect(ui.currentEquipmentId.value).toBe(installed)
      expect(ui.highlightedEquipmentId.value).toBe(installed)
      if (index === 0) {
        const picker = wrapper.get('[data-column="picker"]')
        const terran = picker.findAll('button').find(button => button.text().startsWith('TERRAN'))!
        await terran.trigger('click')
        expect(picker.findAll('.candidate-item-active')).toHaveLength(0)
        expect(ui.highlightedEquipmentId.value).toBe(installed)
        await terran.trigger('click')
        expect(picker.get('.candidate-item-active').attributes('data-testid')).toBe(`candidate-${installed}`)
      }
      ui.highlightedEquipmentId.value = null
      await nextTick()
    }
    expect(JSON.stringify([store.getPlan('A'), store.getPlan('B')])).toBe(before)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('switches from engine to attached shield on %s without confirming the previous preview', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    const before = JSON.stringify([store.getPlan('A'), store.getPlan('B'), store.savedBlueprints])
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const panel = wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`)
    const slots = panel.findAll('.slot-row')
    expect(slots.length).toBeGreaterThan(1)
    await slots[0]!.trigger('click')
    expect(ui.pickerSide.value).toBe(side)
    const engineTarget = ui.pickerTarget.value!.key
    ui.highlightedEquipmentId.value = 'engine_arg_l_allround_01_mk1'
    await nextTick()
    await slots[1]!.trigger('click')
    expect(ui.pickerSide.value).toBe(side)
    expect(ui.pickerTarget.value!.key).not.toBe(engineTarget)
    expect(ui.currentSlotType.value).toBe('shield')
    expect(ui.currentIsShield.value).toBe(true)
    expect(ui.highlightedEquipmentId.value).toBeNull()
    expect(panel.findAll('.slot-row-expanded')).toHaveLength(1)
    expect(slots[1]!.classes()).toContain('slot-row-expanded')
    expect(ui.openPicker(side === 'A' ? 'B' : 'A', 'engine', null, false)).toBe(false)
    expect(wrapper.getComponent(ShipBuildPanelStats).props('shipBlueprint')).toEqual(store.getPlan(side)!.blueprint)
    expect(wrapper.getComponent(ShipBuildPanelStats).props('targetBlueprint')).toEqual(ui.preview.value)
    expect(JSON.stringify([store.getPlan('A'), store.getPlan('B'), store.savedBlueprints])).toBe(before)
    const shieldKeys = ui.pickerTarget.value!.connectionKeys
    const shieldId = store.getCompatibleEquipmentIds(shieldKeys, side)[0]!
    expect(shieldId).toBeTruthy()
    ui.highlightedEquipmentId.value = shieldId
    await nextTick()
    expect(ui.confirmPicker()).toBe(true)
    expect(store.getPlanConnectionAssignment(side, shieldKeys[0]!)!.equipmentId).toBe(shieldId)
    const engineKeys = store.getConnectionRows(store.findShip(store.getPlan(side)!.blueprint!.shipId))
      .filter(row => row.slotType === 'engine').map(row => row.connectionKey)
    engineKeys.forEach(key => expect(store.getPlanConnectionAssignment(side, key)!.equipmentId).toBeFalsy())
    expect(store.isPlanDirty(side === 'A' ? 'B' : 'A')).toBe(false)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('compares only before and after while editing %s and hides comparison exit actions', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    store.replaceComparisonShip('ship_ter_m_corvette_02_a')
    const beforeA = JSON.stringify(store.getPlan('A'))
    const beforeB = JSON.stringify(store.getPlan('B'))
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    ui.openPicker(side, 'engine', null, false)
    await nextTick()
    const keys = store.getConnectionRows(store.findShip(store.getPlan(side)!.blueprint!.shipId))
      .filter(row => row.slotType === 'engine').map(row => row.connectionKey)
    ui.pickerTarget.value = { key: 'engine', size: 'M', tags: [], count: 1, totalCount: 1, connectionKeys: keys }
    ui.highlightedEquipmentId.value = 'engine_ter_m_allround_01_mk1'
    await nextTick()
    const stats = wrapper.getComponent(ShipBuildPanelStats)
    expect(stats.props('comparison')).toBe(false)
    expect(stats.props('shipBlueprint')).toEqual(store.getPlan(side)!.blueprint)
    expect(stats.props('targetBlueprint')).toEqual(ui.preview.value)
    expect(stats.props('targetBlueprint')!.shipId).toBe(store.getPlan(side)!.blueprint!.shipId)
    expect(wrapper.find('[data-testid="ship-compare-exit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ship-compare-keep-b"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ship-compare-open"]').exists()).toBe(false)
    ui.closePicker()
    await nextTick()
    expect(wrapper.getComponent(ShipBuildPanelStats).props('comparison')).toBe(true)
    expect(wrapper.getComponent(ShipBuildPanelStats).props('shipBlueprint')).toEqual(store.getPlan('A')!.blueprint)
    expect(wrapper.getComponent(ShipBuildPanelStats).props('targetBlueprint')).toEqual(store.getPlan('B')!.blueprint)
    expect(wrapper.find('[data-testid="ship-compare-exit"]').exists()).toBe(true)
    expect(JSON.stringify(store.getPlan('A'))).toBe(beforeA)
    expect(JSON.stringify(store.getPlan('B'))).toBe(beforeB)
    wrapper.unmount()
  })

  it.each(['A', 'B'] as const)('preserves saved name and dirty dot on %s, but shows the preset after deletion', async side => {
    const { store, ui } = setup()
    ui.openComparison()
    store.savePlan('B', 'B')
    const plan = store.getPlan(side)!
    const target = plan.saveTargetId!
    const other = side === 'A' ? 'B' : 'A'
    const beforeOther = JSON.stringify(store.getPlan(other))
    const high = store.getLoadableBlueprintsForShip(plan.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n], stubs: { teleport: true } } })
    const panel = wrapper.get(`[data-testid="ship-build-panel-fit"][data-side="${side}"]`)
    const trigger = () => panel.get('[data-testid="ship-build-blueprint-menu-trigger"]')
    const selectHigh = async (saved: boolean, dirty: boolean) => {
      await trigger().trigger('click')
      await panel.get(`[data-testid="ship-blueprint-choice-${high.id}"]`).trigger('click')
      expect(trigger().text()).toBe(saved ? side : i18n.global.t('shipBuild.built_in_high'))
      expect(panel.find('.ship-blueprint-dirty-dot').exists()).toBe(dirty)
      expect(store.isPlanDirty(side)).toBe(saved ? dirty : true)
      await trigger().trigger('click')
      expect(panel.get('.ship-blueprint-menu-row-current').get('button').attributes('data-testid'))
        .toBe(`ship-blueprint-choice-${saved ? target : high.id}`)
    }
    await selectHigh(true, true)
    expect(plan.saveTargetId).toBe(target)
    expect(store.getPlanPresetId(side)).toBeNull()
    const savedCount = store.savedBlueprints.ships.flatMap(bucket => bucket.blueprints).length
    expect(store.savePlan(side)).toBe('saved')
    expect(store.savedBlueprints.ships.flatMap(bucket => bucket.blueprints)).toHaveLength(savedCount)
    expect(plan.saveTargetId).toBe(target)
    expect(store.findBlueprintById(target)!.name).toBe(side)
    await trigger().trigger('click')
    await selectHigh(true, false)
    await panel.get(`[data-testid="ship-blueprint-delete-${target}"]`).trigger('click')
    expect(store.findBlueprintById(target)).not.toBeNull()
    expect(wrapper.getComponent(ConfirmDialog).props('name')).toBe(side)
    await wrapper.getComponent(ConfirmDialog).get('[data-testid="confirm-dialog-cancel"]').trigger('click')
    expect(store.findBlueprintById(target)).not.toBeNull()
    await panel.get('[data-testid="ship-build-blueprint-menu-trigger"]').trigger('click')
    await panel.get(`[data-testid="ship-blueprint-delete-${target}"]`).trigger('click')
    await wrapper.getComponent(ConfirmDialog).get('[data-testid="confirm-dialog-confirm"]').trigger('click')
    expect(plan.saveTargetId).toBeNull()
    expect(store.findBlueprintById(target)).toBeNull()
    expect(trigger().text()).toContain(i18n.global.t('shipBuild.status_custom'))
    expect(panel.find('.ship-blueprint-dirty-dot').exists()).toBe(true)
    await selectHigh(false, false)
    expect(plan.saveTargetId).toBeNull()
    expect(store.planRequiresSaveAs(side)).toBe(true)
    expect(store.getPlanPresetId(side)).toBe(high.id)
    expect(JSON.stringify(store.getPlan(other))).toBe(beforeOther)
    wrapper.unmount()
  })

  it('keeps the outlined open and exit controls in the central stats panel', async () => {
    setup()
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const stats = () => wrapper.get('[data-column="stats"]')
    expect(wrapper.findAll('[data-column]').map(node => node.attributes('data-column'))).toEqual(['A', 'stats', 'materials'])
    expect(stats().get('[data-testid="ship-compare-open"]').classes()).toContain('compare-toggle')
    expect(wrapper.get('[data-column="A"]').find('[data-testid="ship-compare-open"]').exists()).toBe(false)
    await stats().get('[data-testid="ship-compare-open"]').trigger('click')
    expect(wrapper.findAll('[data-column]').map(node => node.attributes('data-column'))).toEqual(['A', 'stats', 'B'])
    expect(stats().get('[data-testid="ship-compare-exit"]').classes()).toContain('compare-toggle')
    await stats().get('[data-testid="ship-compare-exit"]').trigger('click')
    expect(stats().find('[data-testid="ship-compare-open"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('maps exactly three ordered columns, locks picker commands and preserves both work copies', () => {
    const { store, ui } = setup()
    expect(ui.columns.value).toEqual(['A', 'stats', 'materials'])
    expect(ui.activate('B')).toBe(false)
    ui.openComparison()
    expect(ui.activeSide.value).toBe('A')
    expect(ui.columns.value).toEqual(['A', 'stats', 'B'])
    const before = JSON.stringify(store.getPlan('B'))
    ui.openPicker('A', 'engine', null, false)
    expect(ui.columns.value).toEqual(['A', 'picker', 'stats'])
    expect(ui.activate('B')).toBe(false)
    expect(ui.save('A')).toBe(false)
    expect(ui.exit('A')).toBe(false)
    expect(ui.openShipSelection()).toBe(false)
    ui.closePicker()
    expect(JSON.stringify(store.getPlan('B'))).toBe(before)
    ui.openPicker('B', 'engine', null, false)
    expect(ui.columns.value).toEqual(['stats', 'picker', 'B'])
    ui.closePicker()
    expect(ui.activeSide.value).toBe('B')
  })

  it('binds naming to its original side and session and preserves dirty on cancellation', () => {
    const { store, ui } = setup()
    ui.openComparison()
    store.getPlan('B')!.blueprint!.name = 'edited B'
    ui.save('B')
    expect(ui.naming.value!.side).toBe('B')
    expect(ui.activate('A')).toBe(false)
    ui.activeSide.value = 'A'
    ui.naming.value!.name = 'saved B'
    expect(ui.submitName()).toBe(true)
    expect(store.blueprint!.name).toBe('A')
    expect(store.getPlan('B')!.blueprint!.name).toBe('saved B')
    ui.save('B', true)
    store.replaceComparisonBlueprint(store.getPlan('B')!.saveTargetId!)
    expect(ui.submitName()).toBe(false)
    ui.cancel()
    store.getPlan('B')!.blueprint!.name = 'dirty again'
    ui.save('B', true)
    ui.cancel()
    expect(store.isPlanDirty('B')).toBe(true)
  })

  it('protects the closing side rather than active side and never reloads the retained plan', () => {
    const { store, ui } = setup()
    ui.openComparison()
    store.getPlan('B')!.blueprint!.name = 'dirty B'
    ui.exit('A')
    expect(ui.protection.value!.side).toBe('B')
    ui.cancel()
    expect(ui.compare.value).toBe(true)
    ui.exit('A')
    ui.saveProtected()
    expect(ui.naming.value!.side).toBe('B')
    ui.cancel()
    expect(ui.compare.value).toBe(true)
    store.blueprint!.name = 'dirty A'
    ui.exit('B')
    expect(ui.protection.value!.side).toBe('A')
    ui.discard()
    expect(ui.compare.value).toBe(false)
    expect(store.blueprint!.name).toBe('dirty B')
    expect(store.isPlanDirty('A')).toBe(true)
    expect(ui.activeSide.value).toBe('A')
    expect(ui.columns.value).toEqual(['A', 'stats', 'materials'])
  })

  it('protects A then B for session changes and cancels without undoing an earlier successful save', () => {
    const { store, ui } = setup()
    ui.openComparison()
    store.blueprint!.name = 'dirty A'
    store.getPlan('B')!.blueprint!.name = 'dirty B'
    const done = vi.fn()
    ui.guardSession('leave', done)
    expect(ui.protection.value!.side).toBe('A')
    ui.saveProtected()
    expect(store.isPlanDirty('A')).toBe(false)
    expect(ui.protection.value!.side).toBe('B')
    ui.cancel()
    expect(done).not.toHaveBeenCalled()
    expect(store.isPlanDirty('B')).toBe(true)
    expect(store.findBlueprintById(store.blueprint!.id)!.name).toBe('dirty A')
  })

  it('rejects the A identity before protection and retains old B on replace cancellation', () => {
    const { store, ui } = setup()
    ui.openComparison()
    expect(ui.loadPlan(store.blueprint!.id, 'B')).toBe(false)
    expect(ui.protection.value).toBeNull()
    store.getPlan('B')!.blueprint!.name = 'dirty B'
    ui.openShipSelection()
    ui.chooseShip('ship_ter_m_corvette_02_a')
    ui.cancel()
    expect(store.getPlan('B')!.blueprint!.name).toBe('dirty B')
    ui.openShipSelection()
    ui.chooseShip('ship_ter_m_corvette_02_a')
    ui.discard()
    expect(store.getPlan('B')!.blueprint!.shipId).toBe('ship_ter_m_corvette_02_a')
    expect(store.isPlanDirty('B')).toBe(false)
  })

  it('renders one comparison panel, mirrors only B and restores the ordinary retained fit', async () => {
    const { ui } = setup()
    ui.openComparison()
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    expect(wrapper.findAll('[data-testid="ship-compare-stats"]')).toHaveLength(1)
    expect(wrapper.find('[data-side="A"].mirrored').exists()).toBe(false)
    expect(wrapper.find('[data-side="B"].mirrored').exists()).toBe(true)
    await wrapper.get('[data-testid="view-tab-btn-metrics-panel-ship-build-stats-panel-detail"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="metric-item-"]')).toHaveLength(36)
    ui.openPicker('B', 'engine', null, false)
    await nextTick()
    expect(wrapper.findAll('[data-column]').map(node => node.attributes('data-column'))).toEqual(['stats', 'picker', 'B'])
    expect(wrapper.find('[data-side="B"].mirrored').exists()).toBe(true)
    expect(wrapper.getComponent(ShipBuildPanelStats).props('comparison')).toBe(false)
    expect(wrapper.findAll('[data-testid="ship-build-panel-stats"]')).toHaveLength(1)
    ui.closePicker()
    await nextTick()
    expect(wrapper.getComponent(ShipBuildPanelStats).findAll('[data-testid^="metric-item-"]')).toHaveLength(36)
    ui.exit('B')
    await nextTick()
    expect(wrapper.find('.mirrored').exists()).toBe(false)
    expect(wrapper.find('[data-column="materials"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('keeps save failure in the protected comparison and completes only after successful persistence', () => {
    const { store, ui } = setup()
    ui.openComparison()
    store.savePlan('B', 'B')
    store.getPlan('B')!.blueprint!.name = 'changed'
    ui.exit('A')
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(ui.saveProtected()).toBe(false)
    expect(ui.compare.value).toBe(true)
    expect(store.isPlanDirty('B')).toBe(true)
    failing.mockRestore()
    expect(ui.saveProtected()).toBe(true)
    expect(ui.compare.value).toBe(false)
  })

  it('uses both class defaults and converts radar values and scales with the same units', () => {
    const { store, ui } = setup()
    ui.openComparison()
    store.replaceComparisonShip('ship_ter_m_corvette_02_a')
    const game = useGameDataStore()
    game.defaultMaxes = { ship_l: { hull: 100, radar_range: 100000 }, ship_m: { hull: 300, radar_range: 300000 } } as never
    const presenter = useShipBuildCompareStatsPresenter(ref(store.blueprint), ref(store.getPlan('B')!.blueprint))
    expect(presenter.rows.value.find(row => row.key === 'hull')!.max).toBe(300)
    expect(presenter.rows.value.find(row => row.key === 'radar_range')!.max).toBe(300)
    expect(presenter.rows.value.find(row => row.key === 'radar_range')!.a).toBe(Math.round(store.selectedShip!.radarRange / 1000))
    expect(presenter.rows.value.filter(row => row.key.startsWith('storage_'))).toHaveLength(5)
    ui.activate('B')
    const hull = presenter.rows.value.find(row => row.key === 'hull')!
    expect(hull.diff).toBe(store.findShip('ship_ter_m_corvette_02_a')!.hull - store.selectedShip!.hull)
  })

  it('routes toolbar buttons and shortcuts to B and blocks both during a picker', async () => {
    const { store, ui } = setup()
    store.activeView = 'ship-build'
    ui.openComparison()
    store.savePlan('B', 'B')
    ui.activate('B')
    store.getPlan('B')!.blueprint!.name = 'button saved B'
    const wrapper = shallowMount(StationToolbar, { global: { plugins: [i18n] } })
    expect(wrapper.get('[data-testid="toolbar-save-btn"]').text()).toContain(i18n.global.t('menu.save'))
    expect(wrapper.find('[data-testid="ship-compare-active-side"]').exists()).toBe(false)
    await wrapper.get('[data-testid="toolbar-save-btn"]').trigger('click')
    expect(store.isPlanDirty('B')).toBe(false)
    expect(store.blueprint!.name).toBe('A')
    store.getPlan('B')!.blueprint!.name = 'shortcut saved B'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }))
    expect(store.isPlanDirty('B')).toBe(false)
    ui.openPicker('B', 'engine', null, false)
    await nextTick()
    expect(wrapper.get('[data-testid="toolbar-save-btn"]').attributes('disabled')).toBeDefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true, shiftKey: true, cancelable: true }))
    expect(ui.naming.value).toBeNull()
    wrapper.unmount()
  })

  it('reuses the blueprint menu on the right, opens it leftward and applies presets only to that plan', async () => {
    const { store, ui } = setup()
    ui.openComparison()
    const originalA = JSON.stringify(store.getPlan('A'))
    const wrapper = mount(ShipBuildWorkspaceView, { global: { plugins: [i18n] } })
    const right = wrapper.get('[data-testid="ship-build-panel-fit"][data-side="B"]')
    vi.spyOn(right.element, 'getBoundingClientRect').mockReturnValue({ left: 600, right: 900, top: 100 } as DOMRect)
    await right.get('[data-testid="ship-build-blueprint-menu-trigger"]').trigger('click')
    const menu = right.get('[data-testid="ship-build-blueprint-menu"]')
    expect(menu.attributes('style')).toContain('left: auto')
    expect(menu.attributes('style')).toContain(`right: ${window.innerWidth - 600 + 8}px`)
    expect(ui.selectingShip.value).toBeNull()
    expect(menu.get(`[data-testid="ship-blueprint-choice-${store.blueprint!.id}"]`).attributes('disabled')).toBeDefined()
    expect(menu.get(`[data-testid="ship-blueprint-delete-${store.blueprint!.id}"]`).attributes('disabled')).toBeDefined()
    expect(menu.get('.ship-blueprint-menu-row-other').text()).toContain(store.blueprint!.name)
    const preset = store.getLoadableBlueprintsForShip(store.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
    await menu.get(`[data-testid="ship-blueprint-choice-${preset.id}"]`).trigger('click')
    expect(store.getPlan('B')!.blueprint!.connections.length).toBeGreaterThan(0)
    expect(JSON.stringify(store.getPlan('A'))).toBe(originalA)
    expect(ui.compare.value).toBe(true)
    expect(wrapper.find('[data-testid="ship-side-A"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ship-side-B"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="metrics-panel-ship-build-stats-panel"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('reuses the original selector for the right plan, retaining the left plan on cancel and confirm', async () => {
    const { store, ui } = setup()
    ui.openComparison()
    const before = JSON.stringify(store.getPlan('A'))
    const wrapper = mount(ShipBuildView, { global: { plugins: [i18n] } })
    ui.openShipSelection()
    await nextTick()
    let selector = wrapper.findAllComponents(ShipBuildSelectorView).find(component => component.props('side') === 'B')!
    expect(selector.find('[data-testid="ship-build-filter-column"]').exists()).toBe(true)
    expect(selector.find('[data-testid="ship-build-list-column"]').exists()).toBe(true)
    await selector.get('[data-testid="ship-build-cancel-ship-change"]').trigger('click')
    expect(ui.selectingShip.value).toBeNull()
    expect(JSON.stringify(store.getPlan('A'))).toBe(before)
    ui.openShipSelection()
    await nextTick()
    selector = wrapper.findAllComponents(ShipBuildSelectorView).find(component => component.props('side') === 'B')!
    await selector.get('[data-testid="ship-build-filter-class-btn-ship_m"]').trigger('click')
    const state = (selector.vm.$ as any).setupState
    state.setPendingShipId('ship_ter_m_corvette_02_a')
    await nextTick()
    await selector.get('[data-testid="ship-build-confirm-ship"]').trigger('click')
    expect(store.getPlan('B')!.blueprint!.shipId).toBe('ship_ter_m_corvette_02_a')
    expect(JSON.stringify(store.getPlan('A'))).toBe(before)
    expect(ui.selectingShip.value).toBeNull()
    wrapper.unmount()
  })
})

describe('comparison metrics and native reversed quantity slider', () => {
  it('uses only defaults, clips both bars, preserves real numbers and respects metric direction', () => {
    expect(compareMetric(20, 40, 100, 300)).toMatchObject({ max: 300, diff: 20, tone: 'better' })
    expect(compareMetric(400, 600, 100, 300)).toMatchObject({ max: 300, diff: 200, widthA: 100, widthB: 100, textB: '600' })
    expect(compareMetric(20, 40, 100, 300, 'lower').tone).toBe('worse')
    expect(compareMetric(20, 40, 100, 300, 'neutral').tone).toBe('neutral')
    expect(compareMetric(0, 0, 0, 0)).toMatchObject({ scale: 'zero', diff: 0, textA: '0', widthA: 0 })
    expect(compareMetric(undefined, 0, undefined, 300)).toMatchObject({ scale: 'missing', diff: undefined, textA: '—', textB: '0' })
  })

  it('uses native RTL pointer/keyboard direction and keeps value and commit contracts', async () => {
    const wrapper = mount(X4DualPhaseRangeSlider, { props: { modelValue: 2, min: 0, max: 10, step: 2, direction: 'rtl' } })
    const input = wrapper.get('input')
    expect(input.attributes()).toMatchObject({ dir: 'rtl', min: '0', max: '10', step: '2' })
    expect(wrapper.get('.slider-fill-green').attributes('style')).toContain('right: 0px')
    await input.setValue('6')
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([6])
    expect(wrapper.emitted('commit')!.at(-1)).toEqual([6])
    await wrapper.setProps({ direction: 'ltr', modelValue: 0 })
    expect(input.attributes('dir')).toBe('ltr')
    expect(wrapper.get('.slider-fill-green').attributes('style')).toContain('width: 0%')
    wrapper.unmount()
  })
})
