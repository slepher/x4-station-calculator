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
        archiveTotalMap: { energy_mod: 5 },
        recommendedModulesExpanded: false
      },
      global: {
        stubs: {
          draggable: {
            template: '<div><slot /></div>'
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
})
