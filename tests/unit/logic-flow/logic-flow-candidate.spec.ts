/**
 * @vitest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import LogicFlowCandidateZone from '@/components/logic-flow/LogicFlowCandidateZone.vue'
import { createTestingPinia } from '@pinia/testing'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    waresMap: {
      ore: { id: 'ore', name: 'Ore', tier: 0, group: 'minerals' },
      silicon: { id: 'silicon', name: 'Silicon', tier: 0, group: 'minerals' },
      energycells: { id: 'energycells', name: 'Energy Cells', tier: 0, group: 'energy' },
      hullparts: { id: 'hullparts', name: 'Hull Parts', tier: 1, group: 'construction' },
    },
    localizedWaresMap: {},
    wareSetsByIndustrialRace: { default: new Set(['ore', 'silicon', 'energycells', 'hullparts']) },
    wareSetsByRace: { default: new Set(['ore', 'silicon', 'energycells', 'hullparts']) },
    searchQuery: '',
    activeDlcs: [],
    enforceDlcActivation: false,
    isRawMaterialWare: (wareId: string) => ['ore', 'silicon'].includes(wareId),
    findModuleForWare: () => null,
    getModuleVolumeCompression: () => undefined,
    getWareDisplayName: (wareId: string) => wareId,
  }),
}))

vi.mock('@/store/useLogicFlowStore', () => ({
  useLogicFlowStore: () => ({
    groups: [],
    currentPlanName: '',
    isDefaultLocked: true,
    isWareInAnyGroup: () => false,
    calculateRequiredRawMaterials: () => ({}),
  }),
}))

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
      te: () => false,
      locale: { value: 'en' }
    }
  })
}))

describe('LogicFlowCandidateZone', () => {
  const waresMap = {
    'ore': { id: 'ore', name: 'Ore', tier: 0, group: 'minerals' },
    'silicon': { id: 'silicon', name: 'Silicon', tier: 0, group: 'minerals' },
    'energycells': { id: 'energycells', name: 'Energy Cells', tier: 0, group: 'energy' },
    'hullparts': { id: 'hullparts', name: 'Hull Parts', tier: 1, group: 'construction' },
  }

  const localizedWaresMap = {
    'ore': { localeName: 'Ore' },
    'silicon': { localeName: 'Silicon' },
    'energycells': { localeName: 'Energy Cells' },
    'hullparts': { localeName: 'Hull Parts' },
  }

  const initialState = {
    gameData: {
      waresMap,
      localizedWaresMap,
      wareSetsByIndustrialRace: { 'default': new Set(['ore', 'silicon', 'energycells', 'hullparts']) },
      wareSetsByRace: { 'default': new Set(['ore', 'silicon', 'energycells', 'hullparts']) },
      modulesByOutputMap: { energycells: [{}], hullparts: [{}] },
      activeDlcs: [],
      dlcSetting: { activeDlcs: [], enforceDlcActivation: false },
      searchQuery: ''
    },
    logicFlow: {
      groups: [],
      isWareInAnyGroup: () => false,
      calculateRequiredRawMaterials: () => ({})
    }
  }

  it('should hide quick add and disable dragging for Ore, Silicon, and Energy Cells', () => {
    const wrapper = mount(LogicFlowCandidateZone, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn,
          initialState,
          stubActions: false
        })],
        stubs: {
            Teleport: true
        }
      }
    })

    // Find Ore card
    const oreCard = wrapper.find('[data-ware-id="ore"]')
    expect(oreCard.exists()).toBe(true)
    expect(oreCard.attributes('draggable')).toBe('false')
    expect(oreCard.find('.ware-card-add-btn').exists()).toBe(false)

    // Find Silicon card
    const siliconCard = wrapper.find('[data-ware-id="silicon"]')
    expect(siliconCard.exists()).toBe(true)
    expect(siliconCard.attributes('draggable')).toBe('false')
    expect(siliconCard.find('.ware-card-add-btn').exists()).toBe(false)

    const ecCard = wrapper.find('[data-ware-id="energycells"]')
    expect(ecCard.exists()).toBe(true)
    expect(ecCard.attributes('draggable')).toBe('false')
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

    const hullPartsCard = wrapper.find('[data-ware-id="hullparts"]')
    expect(hullPartsCard.exists()).toBe(true)
    expect(hullPartsCard.attributes('draggable')).toBe('true')
    expect(hullPartsCard.find('.ware-card-add-btn').exists()).toBe(true)
  })
})
