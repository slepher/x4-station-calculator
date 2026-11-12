// @vitest-environment jsdom
import { shallowMount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StationToolbar from '@/components/StationToolbar.vue'
import SmartSaveDialog from '@/components/common/SmartSaveDialog.vue'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useShipBuildWorkspacePresenter } from '@/components/ship-build/presenters/useShipBuildWorkspacePresenter'
import { loadShipTestFixture } from './ship-test-fixture'
import i18n from '@/i18n'

const wrappers: Array<{ unmount(): void }> = []
function setup() {
  const store = useShipBuildStore()
  store.setSelectedShipId('ship_ter_l_destroyer_01_a')
  store.saveAsBlueprint('Left')
  store.activeView = 'ship-build'
  const ui = useShipBuildWorkspacePresenter()
  ui.openComparison()
  const wrapper = shallowMount(StationToolbar, {
    global: { plugins: [i18n], stubs: { SmartSaveDialog: false } }
  })
  wrappers.push(wrapper)
  return { store, ui, wrapper }
}

describe('shared SmartSaveDialog for independent ship plans', () => {
  beforeEach(() => { setActivePinia(createPinia()); loadShipTestFixture(); localStorage.clear() })
  afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks() })

  it.each(['A', 'B'] as const)('suggests a different unused numbered name when saving %s as a copy', async side => {
    const { store, ui, wrapper } = setup()
    store.savePlan(side, 'High 1')
    store.savePlan(side === 'A' ? 'B' : 'A', 'High 2')
    const originalId = store.getPlan(side)!.saveTargetId!
    ui.save(side, true)
    await nextTick()
    expect((wrapper.get('[data-testid="smart-save-name"]').element as HTMLInputElement).value).toBe('High 3')
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(store.getPlan(side)!.blueprint!.name).toBe('High 3')
    expect(store.getPlan(side)!.saveTargetId).not.toBe(originalId)
    expect(store.findBlueprintById(originalId)!.name).toBe('High 1')
  })

  it('retains the protected side on failed save and exits only after retry succeeds', async () => {
    const { store, ui, wrapper } = setup()
    store.savePlan('B', 'Right')
    store.getPlan('B')!.blueprint!.name = 'Edited right'
    store.blueprint!.name = 'Keep unsaved left'
    ui.exit('A')
    await nextTick()
    expect(wrapper.findAllComponents(SmartSaveDialog)).toHaveLength(1)
    expect(wrapper.getComponent(SmartSaveDialog).props('context')!.name).toBe('Edited right')
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(ui.compare.value).toBe(true)
    expect(store.isPlanDirty('B')).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    failure.mockRestore()
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(ui.compare.value).toBe(false)
    expect(store.blueprint!.name).toBe('Keep unsaved left')
    expect(store.isPlanDirty('A')).toBe(true)
    expect(wrapper.find('[data-testid="dialog-backdrop"]').exists()).toBe(false)
  })

  it('uses the shared name input for an unsaved protected plan and preserves work on cancellation', async () => {
    const { store, ui, wrapper } = setup()
    store.getPlan('B')!.blueprint!.name = 'Draft right'
    ui.exit('A')
    await nextTick()
    expect((wrapper.get('[data-testid="smart-save-name"]').element as HTMLInputElement).value).toBe('Draft right')
    await wrapper.get('[data-testid="smart-save-cancel"]').trigger('click')
    expect(ui.compare.value).toBe(true)
    expect(store.isPlanDirty('B')).toBe(true)
    ui.exit('A')
    await nextTick()
    await wrapper.get('[data-testid="smart-save-name"]').setValue('')
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(ui.compare.value).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    await wrapper.get('[data-testid="smart-save-name"]').setValue('Saved right')
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(ui.compare.value).toBe(false)
    expect(store.savedBlueprints.ships.flatMap(bucket => bucket.blueprints).some(bp => bp.name === 'Saved right')).toBe(true)
  })

  it('advances from A to B in the same dialog, resets its input and permits cancelling the transition', async () => {
    const { store, ui, wrapper } = setup()
    store.blueprint!.name = 'Edited left'
    store.getPlan('B')!.blueprint!.name = 'Draft right'
    const done = vi.fn()
    ui.guardSession('leave', done)
    await nextTick()
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(store.isPlanDirty('A')).toBe(false)
    expect(ui.protection.value!.side).toBe('B')
    expect(wrapper.getComponent(SmartSaveDialog).props('isOpen')).toBe(true)
    expect((wrapper.get('[data-testid="smart-save-name"]').element as HTMLInputElement).value).toBe('Draft right')
    await wrapper.get('[data-testid="smart-save-cancel"]').trigger('click')
    expect(done).not.toHaveBeenCalled()
    expect(store.isPlanDirty('B')).toBe(true)
    ui.guardSession('leave', done)
    await nextTick()
    await wrapper.get('[data-testid="smart-save-discard"]').trigger('click')
    expect(done).toHaveBeenCalledOnce()
  })

  it('keeps save-as bound to its opening session and rejects a replaced session', async () => {
    const { store, ui, wrapper } = setup()
    ui.save('B', true)
    await nextTick()
    ui.activeSide.value = 'A'
    await wrapper.get('[data-testid="smart-save-name"]').setValue('Right copy')
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(store.getPlan('B')!.blueprint!.name).toBe('Right copy')
    expect(store.blueprint!.name).toBe('Left')
    ui.save('B', true)
    await nextTick()
    store.replaceComparisonBlueprint(store.getPlan('B')!.saveTargetId!)
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(ui.naming.value).not.toBeNull()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('preserves automatic close and existing policy steps for ordinary callers', async () => {
    const wrapper = mount(SmartSaveDialog, { props: { isOpen: true, intent: 'SAVE_AS', initialName: 'Copy', storeType: 'ship-build' }, global: { plugins: [i18n] } })
    wrappers.push(wrapper)
    await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
    expect(wrapper.emitted('submit-default')).toEqual([[{ steps: [{ type: 'SAVE_AS', name: 'Copy' }] }]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it.each(['zh-CN', 'en'] as const)('uses numbered preset names across ships and preserves the original dialog in %s', async locale => {
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = locale
    try {
      const { store, ui, wrapper } = setup()
      store.replaceComparisonShip('ship_ter_m_corvette_02_a')
      const shipId = store.getPlan('B')!.blueprint!.shipId
      const preset = store.getLoadableBlueprintsForShip(shipId).find(bp => bp.id.endsWith('high'))!
      store.loadPlanPreset('B', preset.id)
      ui.save('B')
      await nextTick()
      expect(wrapper.get('h3').text()).toBe(i18n.global.t('menu.dialog_title_save_as'))
      expect((wrapper.get('[data-testid="smart-save-name"]').element as HTMLInputElement).value)
        .toBe(`${i18n.global.t('shipBuild.built_in_high')} 1`)
      expect(wrapper.text()).not.toContain('shipBuild.default_blueprint_name')
      await wrapper.get('[data-testid="smart-save-primary"]').trigger('click')
      expect(store.getPlan('B')!.blueprint!.name).toBe(`${i18n.global.t('shipBuild.built_in_high')} 1`)
      ui.exit('A')
      store.clearLoadoutForCurrentShip()
      const leftPreset = store.getLoadableBlueprintsForShip(store.blueprint!.shipId).find(bp => bp.id.endsWith('high'))!
      store.loadPlanPreset('A', leftPreset.id)
      ui.save('A')
      await nextTick()
      expect(wrapper.get('h3').text()).toBe(i18n.global.t('menu.dialog_title_save_as'))
      expect((wrapper.get('[data-testid="smart-save-name"]').element as HTMLInputElement).value)
        .toBe(`${i18n.global.t('shipBuild.built_in_high')} 2`)
    } finally {
      i18n.global.locale.value = previousLocale
    }
  })

  it.each(['save', 'discard'] as const)('preserves the existing import %s event and automatic close', async action => {
    const wrapper = mount(SmartSaveDialog, { props: { isOpen: true, intent: 'NEW', mode: 'import' }, global: { plugins: [i18n] } })
    wrappers.push(wrapper)
    await wrapper.get(`[data-testid="smart-save-${action === 'save' ? 'primary' : 'discard'}"]`).trigger('click')
    expect(wrapper.emitted('submit-import')).toEqual([[{ choice: action === 'save' ? 'SAVE_AND_IMPORT' : 'DISCARD_AND_IMPORT' }]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
