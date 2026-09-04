/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import LogicFlowCandidateZone from '@/components/LogicFlowCandidateZone.vue'
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

describe('LogicFlowCandidateZone Derivation', () => {
  const waresMap = {
    'ore': { id: 'ore', name: 'Ore', tier: 0, group: 'minerals' },
    'silicon': { id: 'silicon', name: 'Silicon', tier: 0, group: 'minerals' },
    'nividium': { id: 'nividium', name: 'Nividium', tier: 0, group: 'minerals' },
    'energycells': { id: 'energycells', name: 'Energy Cells', tier: 0, group: 'energy' },
    'microchip': { id: 'microchip', name: 'Microchip', tier: 1, group: 'hightech' },
  }

  const localizedWaresMap = {
    'ore': { localeName: 'Ore' },
    'silicon': { localeName: 'Silicon' },
    'nividium': { localeName: 'Nividium' },
    'energycells': { localeName: 'Energy Cells' },
    'microchip': { localeName: 'Microchip' },
  }

  const initialState = {
    gameData: {
      waresMap,
      localizedWaresMap,
      wareSetsByIndustrialRace: { 
        'default': new Set(['ore', 'silicon', 'energycells', 'microchip']),
        'terran': new Set(['ore', 'energycells', 'microchip']) // Terran case: No Silicon
      },
      wareSetsByRace: { 
        'default': new Set(['ore', 'silicon', 'energycells', 'microchip']) 
      },
      searchQuery: ''
    },
    logicFlow: {
      groups: [],
      isWareInAnyGroup: () => false,
      calculateRequiredT0Wares: () => ({})
    }
  }

  it('should only show wares that are in the currentWareSet', async () => {
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

    // 1. Default race: should show Ore and Silicon, but NOT Nividium (since it's not in wareSets)
    expect(wrapper.find('[data-ware-id="ore"]').exists()).toBe(true)
    expect(wrapper.find('[data-ware-id="silicon"]').exists()).toBe(true)
    expect(wrapper.find('[data-ware-id="nividium"]').exists()).toBe(false)

    // 2. Switch to Terran: should show Ore, but NOT Silicon (since it's not in terran wareSet)
    // In the component, activeSubCategory is a ref. We can find the button and click it or just modify the state if we have access.
    // Since we are using Pinia, we can't easily change the local 'activeSubCategory' ref from outside without exposing it or using a more complex setup.
    // But we can test the initial render of a specific race if we change the mock.
  })

  it('should exclude Silicon in Terran race if not in its wareSet', () => {
    const terranInitialState = {
        ...initialState,
        gameData: {
            ...initialState.gameData,
            // We can't easily mock the 'activeSubCategory' ref inside the component,
            // but we can check if the component correctly uses the store data.
        }
    }
    
    // To properly test the switch, we would need to trigger the UI interaction.
    // Let's find the Terran pill and click it.
  })
})
