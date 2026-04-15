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

  it('1.1 Unit: initialMode computed 正确计算初始模式', async () => {
    // 1.1.1 输入 hasBindingStation=true, hasSaveStation=true -> 输出 'planning' #期望: ['planning']
    const wrapper1 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: true }
    })
    expect(wrapper1.vm.initialMode).toBe('planning')

    // 1.1.2 输入 hasBindingStation=true, hasSaveStation=false -> 输出 'planning' #期望: ['planning']
    const wrapper2 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: false }
    })
    expect(wrapper2.vm.initialMode).toBe('planning')

    // 1.1.3 输入 hasBindingStation=false, hasSaveStation=true -> 输出 'live' #期望: ['live']
    const wrapper3 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: false, hasSaveStation: true }
    })
    expect(wrapper3.vm.initialMode).toBe('live')

    // 1.1.4 输入 hasBindingStation=false, hasSaveStation=false -> 输出 'planning' (fallback) #期望: ['planning']
    const wrapper4 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: false, hasSaveStation: false }
    })
    expect(wrapper4.vm.initialMode).toBe('planning')
  })

  it('1.2 Unit: canToggle computed 正确计算切换能力', async () => {
    // 1.2.1 输入 hasBindingStation=true, hasSaveStation=true -> 输出 true #期望: [true]
    const wrapper1 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: true }
    })
    expect(wrapper1.vm.canToggle).toBe(true)

    // 1.2.2 输入 hasBindingStation=true, hasSaveStation=false -> 输出 false #期望: [false]
    const wrapper2 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: true, hasSaveStation: false }
    })
    expect(wrapper2.vm.canToggle).toBe(false)

    // 1.2.3 输入 hasBindingStation=false, hasSaveStation=true -> 输出 true #期望: [true]
    const wrapper3 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: false, hasSaveStation: true }
    })
    expect(wrapper3.vm.canToggle).toBe(true)

    // 1.2.4 输入 hasBindingStation=false, hasSaveStation=false -> 输出 false #期望: [false]
    const wrapper4 = mount(LiveStationToolbar, {
      props: { ...defaultProps, hasBindingStation: false, hasSaveStation: false }
    })
    expect(wrapper4.vm.canToggle).toBe(false)
  })
})