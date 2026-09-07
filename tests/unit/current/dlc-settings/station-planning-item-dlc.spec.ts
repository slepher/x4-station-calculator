// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import StationPlanningItem from '@/components/empire/StationPlanningItem.vue'
import type { X4Module } from '@/types/x4'

const state = reactive({ active: true, label: '人类的摇篮' })
vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    getDlcDisplayName: () => state.label,
    isDlcActive: () => state.active
  })
}))
vi.mock('@/utils/UseX4I18n', () => ({ useX4I18n: () => ({ translateModule: () => '能量电池生产' }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const info = { id: 'terran-energy', type: 'production', dlc_tag: 'terran' } as X4Module
const render = (props = {}) => mount(StationPlanningItem, {
  props: { item: { id: info.id, count: 2 }, info, ...props }
})

describe('StationPlanningItem DLC presentation', () => {
  beforeEach(() => { state.active = true; state.label = '人类的摇篮' })

  it('renders the translated label and updates its language and activation color', async () => {
    const wrapper = render()
    expect(wrapper.get('.dlc-tag').text()).toBe('人类的摇篮')
    expect(wrapper.get('.dlc-tag').attributes('title')).toBe('人类的摇篮')
    expect(wrapper.get('.dlc-tag').classes()).toContain('dlc-tag--active')
    state.label = 'Cradle of Humanity'
    state.active = false
    await nextTick()
    expect(wrapper.get('.dlc-tag').text()).toBe('Cradle of Humanity')
    expect(wrapper.get('.dlc-tag').classes()).toContain('dlc-tag--inactive')
  })

  it('omits the tag for base modules', () => {
    expect(render({ info: { ...info, dlc_tag: 'base' } }).find('.dlc-tag').exists()).toBe(false)
  })

  it('disables inactive quantity while keeping the row and deletion available', async () => {
    const wrapper = render({ inactiveByDlc: true, countDisabled: false })
    expect(wrapper.classes()).toContain('module-row--inactive')
    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('.spin-up').trigger('click')
    expect(wrapper.emitted('update:count')).toBeUndefined()
    await wrapper.get('.remove-btn').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('restores quantity editing when the restriction is removed', async () => {
    const wrapper = render({ inactiveByDlc: true })
    await wrapper.setProps({ inactiveByDlc: false })
    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(false)
    await wrapper.get('.spin-up').trigger('click')
    expect(wrapper.emitted('update:count')).toEqual([[3]])
  })

  it('preserves caller quantity restrictions independently of DLC', async () => {
    const wrapper = render({ countDisabled: true, inactiveByDlc: false })
    expect((wrapper.get('input').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('.spin-up').trigger('click')
    expect(wrapper.emitted('update:count')).toBeUndefined()
  })

  it('keeps readonly rows without editing or deletion and preserves transfer', async () => {
    const wrapper = render({ readonly: true, inactiveByDlc: true })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('.remove-btn').exists()).toBe(false)
    await wrapper.get('.count-display').trigger('click')
    expect(wrapper.emitted('transfer')).toEqual([[{ id: info.id, count: 2 }]])
    await wrapper.setProps({ noClick: true })
    await wrapper.get('.count-display').trigger('click')
    expect(wrapper.emitted('transfer')).toHaveLength(1)
  })
})
