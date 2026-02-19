/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import LogicFlowCandidateZone from '../../src/components/LogicFlowCandidateZone.vue'
import { createTestingPinia } from '@pinia/testing'

// Mock vuedraggable
vi.mock('vuedraggable', () => ({
  default: {
    template: '<div><slot name="item" v-for="element in modelValue" :element="element" /></div>',
    props: ['modelValue']
  }
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ 
    t: (key: string) => key,
    locale: { value: 'en' }
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key,
      locale: { value: 'en' }
    }
  })
}))

describe('LogicFlowCandidateZone', () => {
  const waresMap = {
    'ore': { id: 'ore', name: 'Ore', tier: 0, group: 'minerals' },
    'silicon': { id: 'silicon', name: 'Silicon', tier: 0, group: 'minerals' },
    'energycells': { id: 'energycells', name: 'Energy Cells', tier: 0, group: 'energy' },
    'microchip': { id: 'microchip', name: 'Microchip', tier: 1, group: 'hightech' },
  }

  const localizedWaresMap = {
    'ore': { localeName: 'Ore' },
    'silicon': { localeName: 'Silicon' },
    'energycells': { localeName: 'Energy Cells' },
    'microchip': { localeName: 'Microchip' },
  }

  const initialState = {
    gameData: {
      waresMap,
      localizedWaresMap,
      wareSetsByIndustrialRace: { 'default': new Set(['ore', 'silicon', 'energycells', 'microchip']) },
      wareSetsByRace: { 'default': new Set(['ore', 'silicon', 'energycells', 'microchip']) },
      searchQuery: ''
    },
    logicFlow: {
      groups: [],
      isWareInAnyGroup: () => false,
      calculateRequiredT0Wares: () => ({})
    }
  }

  it('should NOT show quick add button for Tier 0 resources (except Energy Cells)', () => {
    const wrapper = mount(LogicFlowCandidateZone, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState
        })],
        stubs: {
            Teleport: true
        }
      }
    })

    // Find Ore card
    const oreCard = wrapper.find('[data-ware-id="ore"]')
    expect(oreCard.exists()).toBe(true)
    // Check for quick add container
    expect(oreCard.find('.quick-add-container').exists()).toBe(false)

    // Find Silicon card
    const siliconCard = wrapper.find('[data-ware-id="silicon"]')
    expect(siliconCard.exists()).toBe(true)
    expect(siliconCard.find('.quick-add-container').exists()).toBe(false)
  })

  it('should NOT show add button for Energy Cells', () => {
    const wrapper = mount(LogicFlowCandidateZone, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState
        })],
        stubs: {
            Teleport: true
        }
      }
    })

    const ecCard = wrapper.find('[data-ware-id="energycells"]')
    expect(ecCard.exists()).toBe(true)
    expect(ecCard.find('.ware-card-add-btn').exists()).toBe(false)
  })

  it('should show add button for Tier 1+ resources', () => {
    const wrapper = mount(LogicFlowCandidateZone, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState
        })],
        stubs: {
            Teleport: true
        }
      }
    })

    const microchipCard = wrapper.find('[data-ware-id="microchip"]')
    expect(microchipCard.exists()).toBe(true)
    expect(microchipCard.find('.ware-card-add-btn').exists()).toBe(true)
  })
})
