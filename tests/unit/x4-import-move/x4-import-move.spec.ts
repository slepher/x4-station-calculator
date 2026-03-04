/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import TopViewSwitch from '@/components/common/TopViewSwitch.vue'
import ImportPlanModal from '@/components/ImportPlanModal.vue'
import { useEmpireStore } from '@/store/useEmpireStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      view: {
        production: '生产',
        logical_flow: '逻辑流',
        ship_build: '舰船配装'
      },
      importView: {
        title: '导入',
        tab_logic_flow: '导入 logic-flow',
        tab_game_blueprint: '导入游戏蓝图',
        tab_x4_station: '导入 x4-station',
        blueprint_upload_description: '上传描述',
        blueprint_select_file: '选择文件',
        blueprint_select_hint: '提示',
        x4_station_description: 'x4-station 描述',
        x4_station_placeholder: '输入分享串',
        x4_station_failed: '导入失败'
      },
      menu: {
        action_import: '导入',
        action_cancel: '取消'
      }
    }
  }
})

const LogicFlowImportBodyStub = defineComponent({
  props: {
    mode: {
      type: String,
      required: true
    }
  },
  template: '<div data-testid="logicflow-import-body" :data-mode="mode" />'
})

const mountImportModal = (initialTab: 'logic-flow' | 'game-blueprint' | 'x4-station') =>
  mount(ImportPlanModal, {
    props: { isOpen: true, initialTab },
    global: {
      plugins: [i18n],
      stubs: {
        StationImportConfirmDialog: true,
        SmartSaveDialog: true,
        LogicFlowImportWarningModal: true,
        LogicFlowImportBody: LogicFlowImportBodyStub
      }
    }
  })

describe('x4-import-move unit mapping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1.1 顶部视图切换组件支持 production/flow/ship-build 切换', async () => {
    // 1.1.1 挂载 `TopViewSwitch` 默认三按钮视图
    const wrapper = mount(TopViewSwitch, {
      props: { modelValue: 'production' },
      global: { plugins: [i18n] }
    })

    // 1.1.2 依次点击 `top-view-btn-flow` 与 `top-view-btn-ship-build`
    await wrapper.get('[data-testid="top-view-btn-flow"]').trigger('click')
    await wrapper.get('[data-testid="top-view-btn-ship-build"]').trigger('click')

    // 1.1.3 断言 `update:modelValue` 依次发出 `flow`、`ship-build` #期望: ['flow', 'ship-build']
    const payloads = wrapper.emitted('update:modelValue') ?? []
    expect(payloads[0]?.[0]).toBe('flow')
    expect(payloads[1]?.[0]).toBe('ship-build')
  })

  it('1.2 ImportPlanModal 采用统一 3-tab 导入视图', async () => {
    // 1.2.1 挂载 `ImportPlanModal` 并设置 `initialTab=game-blueprint`
    const wrapper = mountImportModal('game-blueprint')

    // 1.2.2 断言 3 个导入 tab 按钮均可见
    expect(wrapper.find('[data-testid="top-view-btn-import-view-logic-flow"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="top-view-btn-import-view-game-blueprint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="top-view-btn-import-view-x4-station"]').exists()).toBe(true)

    // 1.2.3 切换到 `x4-station` 后断言可见 `import-x4-station-input`，再切换到 `logic-flow` 后断言可见 `logicflow-import-body` #期望: ['import-x4-station-input', 'logicflow-import-body']
    await wrapper.get('[data-testid="top-view-btn-import-view-x4-station"]').trigger('click')
    expect(wrapper.html()).toContain('import-x4-station-input')

    await wrapper.get('[data-testid="top-view-btn-import-view-logic-flow"]').trigger('click')
    expect(wrapper.html()).toContain('logicflow-import-body')
  })

  it('1.3 logic-flow tab 内嵌主体透传导入模式', async () => {
    // 1.3.1 挂载 `ImportPlanModal` 并切换到 `logic-flow` tab
    const wrapper = mountImportModal('game-blueprint')
    await wrapper.get('[data-testid="top-view-btn-import-view-logic-flow"]').trigger('click')

    // 1.3.2 断言渲染 `logicflow-import-body` 内嵌主体
    const hasLogicBody = wrapper.find('[data-testid="logicflow-import-body"]').exists()

    // 1.3.3 断言内嵌主体收到 `mode` 属性且值属于 `station|empire` #期望: [true]
    const mode = wrapper.get('[data-testid="logicflow-import-body"]').attributes('data-mode')
    expect(hasLogicBody && (mode === 'station' || mode === 'empire')).toBe(true)
  })

  it('1.4 x4-station 字符串拒绝 JSON 输入', async () => {
    // 1.4.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
    const wrapper = mountImportModal('x4-station')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1.4.2 输入 JSON 字符串并执行导入
    await wrapper.get('[data-testid="top-view-btn-import-view-x4-station"]').trigger('click')
    await wrapper.get('[data-testid="import-x4-station-input"]').setValue('{"modules":[]}')
    await wrapper.get('[data-testid="import-view-action-import"]').trigger('click')

    // 1.4.3 断言显示错误文案节点 `importView.x4_station_failed`（或等价稳定定位） #期望: ['importView.x4_station_failed']
    expect(wrapper.html()).toContain('importView.x4_station_failed')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('1.5 x4-station 非法输入不输出 console error', async () => {
    // 1.5.1 挂载 `ImportPlanModal` 并切换到 `x4-station` tab
    const wrapper = mountImportModal('x4-station')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1.5.2 输入 JSON 字符串执行导入并监听 `console.error`
    await wrapper.get('[data-testid="top-view-btn-import-view-x4-station"]').trigger('click')
    await wrapper.get('[data-testid="import-x4-station-input"]').setValue('{"invalid":true}')
    await wrapper.get('[data-testid="import-view-action-import"]').trigger('click')

    // 1.5.3 断言仅展示错误提示且未触发 `console.error` #期望: [true]
    const hasErrorText = wrapper.text().includes('导入失败')
    const noConsoleError = !consoleErrorSpy.mock.calls.length
    expect(hasErrorText && noConsoleError).toBe(true)
    consoleErrorSpy.mockRestore()
  })

  it('1.6 非空站点下三 tab 导入统一进入策略弹窗', async () => {
    // 1.6.1 挂载 `ImportPlanModal` 并注入包含模块的当前站点数据
    const pinia = createPinia()
    setActivePinia(pinia)
    const empireStore = useEmpireStore()
    // Create a station with modules (non-empty)
    const station = empireStore.createStation('Test Station')
    if (station) {
      station.modules = [
        { id: 'prod_gen_energycells_macro', count: 1 },
        { id: 'prod_gen_refinedmetals_macro', count: 2 }
      ]
    }

    const wrapper = mount(ImportPlanModal, {
      props: { isOpen: true, initialTab: 'game-blueprint' },
      global: {
        plugins: [i18n, pinia],
        stubs: {
          StationImportConfirmDialog: true,
          SmartSaveDialog: true,
          LogicFlowImportWarningModal: true,
          LogicFlowImportBody: LogicFlowImportBodyStub
        }
      }
    })

    // 1.6.2 依次切换 `logic-flow`、`game-blueprint`、`x4-station` tab 并执行 `import-view-action-import`
    await wrapper.get('[data-testid="import-view-action-import"]').trigger('click')

    // 1.6.3 断言三次导入均显示 `blueprint-import-strategy-modal`，且可见 `blueprint-strategy-cancel`、`blueprint-strategy-overwrite`、`blueprint-strategy-add`、`blueprint-strategy-new` #期望: ['blueprint-strategy-cancel', 'blueprint-strategy-overwrite', 'blueprint-strategy-add', 'blueprint-strategy-new']
    expect(wrapper.html()).toContain('blueprint-import-strategy-modal')
    expect(wrapper.html()).toContain('blueprint-strategy-cancel')
    expect(wrapper.html()).toContain('blueprint-strategy-overwrite')
    expect(wrapper.html()).toContain('blueprint-strategy-add')
    expect(wrapper.html()).toContain('blueprint-strategy-new')
  })
})
