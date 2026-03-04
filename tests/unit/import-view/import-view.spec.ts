/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import TopViewSwitch from '@/components/common/TopViewSwitch.vue'
import ImportPlanModal from '@/components/ImportPlanModal.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      view: {
        production: 'Quantified',
        logical_flow: 'Logical Flow',
        ship_build: 'Ship Build'
      },
      importView: {
        title: 'Import',
        tab_logic_flow: 'Import Logic-Flow',
        tab_game_blueprint: 'Import Game Blueprint',
        tab_x4_station: 'Import x4-station String',
        logic_flow_description: 'desc',
        logic_flow_action_open: 'Select Logic-Flow Plan',
        blueprint_upload_description: 'upload desc',
        blueprint_select_file: 'select file',
        blueprint_select_hint: 'hint',
        blueprint_station_name: 'Station Name',
        blueprint_module_total: 'Module Count',
        blueprint_upload_no_modules: 'no modules',
        blueprint_upload_failed: 'failed',
        blueprint_strategy_title: 'strategy',
        blueprint_strategy_message: 'message',
        blueprint_action_overwrite: 'Overwrite',
        blueprint_action_add: 'Add',
        blueprint_action_new_station: 'New Station',
        x4_station_description: 'desc',
        x4_station_placeholder: 'example-json',
        x4_station_failed: 'failed'
      },
      logicFlowImport: {
        mode_station_hint: 'station hint',
        mode_empire_hint: 'empire hint'
      },
      menu: {
        import_description: 'desc',
        import_placeholder_suffix: 'suffix',
        import_failed: 'failed',
        action_import: 'Import',
        action_cancel: 'Cancel',
        default_empire_name: 'My Empire'
      },
      planning: {
        no_saved_flow_plans: 'No saved flow plans'
      }
    }
  }
})

describe('import-view unit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('top-view-switch emits update:modelValue', async () => {
    const wrapper = mount(TopViewSwitch, {
      props: {
        modelValue: 'production'
      },
      global: {
        plugins: [i18n]
      }
    })

    await wrapper.get('[data-testid="top-view-btn-flow"]').trigger('click')
    const payloads = wrapper.emitted('update:modelValue') ?? []
    expect(payloads[0]?.[0]).toBe('flow')
  })

  it('import modal shows 3 tabs and switches content', async () => {
    const wrapper = mount(ImportPlanModal, {
      props: {
        isOpen: true
      },
      global: {
        plugins: [i18n],
        stubs: {
          StationImportConfirmDialog: true,
          SmartSaveDialog: true,
          LogicFlowImportWarningModal: true
        }
      }
    })

    expect(wrapper.find('[data-testid="top-view-switch-import-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="import-blueprint-file-upload"]').exists()).toBe(true)

    await wrapper.get('[data-testid="top-view-btn-import-view-x4-station"]').trigger('click')
    expect(wrapper.find('[data-testid="import-x4-station-input"]').exists()).toBe(true)

    await wrapper.get('[data-testid="top-view-btn-import-view-logic-flow"]').trigger('click')
    expect(wrapper.find('[data-testid="logicflow-import-body"]').exists()).toBe(true)
  })
})
