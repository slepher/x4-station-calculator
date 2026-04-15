/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import LiveStationToolbar from '@/components/empire/context_toolbar/LiveStationToolbar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'zh-CN' },
    t: (key: string) => key,
    te: () => false
  })
}))

describe('1 单元测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const defaultProps = {
    stationName: '测试站点',
    stationCode: 'TEST-001',
    sectorName: '测试星区',
    sectorNameId: undefined,
    stationPosition: undefined,
    sectorResources: [],
    sectorSunlight: 100,
    hasBindingStation: false,
    hasSaveStation: false,
    mode: 'planning' as 'live' | 'planning',
    canToggle: false,
    settings: {
      racePreference: 'argon',
      considerWorkforceForAutoFill: true,
      showEmpireGaps: false
    },
    races: [
      { value: 'argon', label: 'Argon' },
      { value: 'paranid', label: 'Paranid' }
    ],
    singleBerthThroughput: 10000
  }

  it('1.1 Unit: mode prop 正确渲染模式状态', async () => {
    // 1.1.1 输入 mode='planning', canToggle=true -> 显示规划模式，可点击
    const wrapper1 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: true, mode: 'planning', canToggle: true }
    })
    const modeBtn = wrapper1.find('.mode-toggle-chip')
    expect(modeBtn.classes()).toContain('active-planning')
    expect(modeBtn.attributes('disabled')).toBeUndefined()

    // 1.1.2 输入 mode='live', canToggle=true -> 显示实时模式，可点击
    const wrapper2 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: true, mode: 'live', canToggle: true }
    })
    const modeBtn2 = wrapper2.find('.mode-toggle-chip')
    expect(modeBtn2.classes()).toContain('active-live')
    expect(modeBtn2.attributes('disabled')).toBeUndefined()

    // 1.1.3 输入 mode='planning', canToggle=false -> 显示规划模式，不可点击
    const wrapper3 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: false, mode: 'planning', canToggle: false }
    })
    const modeBtn3 = wrapper3.find('.mode-toggle-chip')
    expect(modeBtn3.classes()).toContain('active-planning')
    expect(modeBtn3.classes()).toContain('no-toggle')
    expect(modeBtn3.attributes('disabled')).toBeDefined()
  })

  it('1.2 Unit: canToggle prop 正确控制切换能力', async () => {
    // 1.2.1 输入 canToggle=true -> 点击按钮触发 toggleMode 事件
    const wrapper1 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: true, mode: 'planning', canToggle: true }
    })
    await wrapper1.find('.mode-toggle-chip').trigger('click')
    expect(wrapper1.emitted('toggleMode')).toBeTruthy()
    expect(wrapper1.emitted('toggleMode')?.length).toBe(1)

    // 1.2.2 输入 canToggle=false -> 点击按钮不触发 toggleMode 事件
    const wrapper2 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: false, mode: 'planning', canToggle: false }
    })
    await wrapper2.find('.mode-toggle-chip').trigger('click')
    expect(wrapper2.emitted('toggleMode')).toBeFalsy()
  })
})