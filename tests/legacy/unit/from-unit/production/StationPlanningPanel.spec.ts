/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    currentLocale: 'en',
    modulesMap: {
      energy_mod: {
        id: 'energy_mod',
        name: 'Energy Mod',
        group: 'production',
        type: 'production',
        dlc_tag: 'base'
      }
    },
    localizedModulesMap: {},
    localizedModuleGroupsMap: {
      production: { localeName: 'Production' }
    },
    isDlcActive: () => true
  })
}))

vi.mock('@/store/logic/searchModule', () => ({
  generateFilteredModulesGrouped: () => [],
  compareModulesByPickerOrder: () => 0,
  compareModuleGroupsByPickerOrder: () => 0
}))

describe('StationPlanningPanel', () => {
  it('clicking auto module uses max of auto count and archive total', async () => {
    const wrapper = mount(StationPlanningPanel, {
      props: {
        plannedModules: [],
        recommendedModules: [],
        autoIndustryModules: [{ id: 'energy_mod', count: 3, diffAnnotation: '-2' }],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false,
        archiveModules: [],
        buildingModules: [],
        archiveTotalMap: { energy_mod: 5 }
      },
      global: {
        stubs: {
          draggable: {
            props: ['modelValue'],
            template: '<div><slot v-for="(element, index) in modelValue" name="item" :element="element" :index="index" /></div>'
          },
          StationModulePicker: {
            template: '<div data-testid="module-picker-stub"></div>'
          },
          StationPlanningItem: {
            props: ['item'],
            template: '<button class="planning-item-stub" @click="$emit(\'transfer\', item)">{{ item.id }}</button>'
          }
        }
      }
    })

    await wrapper.get('.planning-item-stub').trigger('click')

    expect(wrapper.emitted('updatePlannedModules')).toEqual([
      [[{ id: 'energy_mod', count: 5 }]]
    ])
  })

  it('renders recommended modules inside the planned tier with dashed group styling', () => {
    const wrapper = mount(StationPlanningPanel, {
      props: {
        plannedModules: [
          { id: 'energy_mod', count: 3 }
        ],
        recommendedModules: [{ id: 'orphan_mod', count: 4, isReferenceRecommended: true }],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false,
        archiveModules: [],
        buildingModules: [],
        archiveTotalMap: { orphan_mod: 4, energy_mod: 2 }
      },
      global: {
        stubs: {
          draggable: {
            props: ['modelValue'],
            template: '<div><slot v-for="(element, index) in modelValue" name="item" :element="element" :index="index" /></div>'
          },
          StationModulePicker: {
            template: '<div data-testid="module-picker-stub"></div>'
          },
          StationPlanningItem: {
            props: ['item', 'readonly'],
            template: '<div class="planning-item-stub" :data-id="item.id" :data-readonly="readonly"></div>'
          }
        }
      }
    })

    const items = wrapper.findAll('.planning-item-stub')
    expect(items).toHaveLength(2)
    expect(items[0]?.attributes('data-id')).toBe('energy_mod')
    expect(items[1]?.attributes('data-id')).toBe('orphan_mod')
    expect(items[1]?.attributes('data-readonly')).toBe('true')
    expect(wrapper.find('.recommended-inline-list').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('planning.recommended_modules')
  })

  it('clicking recommended module promotes it to explicit planned total instead of adding on top', async () => {
    const wrapper = mount(StationPlanningPanel, {
      props: {
        plannedModules: [{ id: 'energy_mod', count: 1 }],
        recommendedModules: [{ id: 'energy_mod', count: 4, isReferenceRecommended: true }],
        autoIndustryModules: [],
        autoHabitationModules: [],
        autoInfrastructureModules: [],
        enforceDlcActivation: false,
        archiveModules: [],
        buildingModules: [],
        archiveTotalMap: { energy_mod: 3 }
      },
      global: {
        stubs: {
          draggable: {
            props: ['modelValue'],
            template: '<div><slot v-for="(element, index) in modelValue" name="item" :element="element" :index="index" /></div>'
          },
          StationModulePicker: {
            template: '<div data-testid="module-picker-stub"></div>'
          },
          StationPlanningItem: {
            props: ['item'],
            template: '<button class="planning-item-stub" @click="$emit(\'transfer\', item)">{{ item.id }}</button>'
          }
        }
      }
    })

    await wrapper.get('.recommended-inline-list .planning-item-stub').trigger('click')

    expect(wrapper.emitted('updatePlannedModules')).toEqual([
      [[{ id: 'energy_mod', count: 4 }]]
    ])
  })
})
