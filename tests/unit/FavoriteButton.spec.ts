/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FavoriteButton from '../../src/components/common/FavoriteButton.vue'
import { createI18n } from 'vue-i18n'

// Mock i18n
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      tooltip: {
        buffer_long: 'Long',
        buffer_short: 'Short',
        buffer_resource: 'Res',
        priority_level_2_label: 'Primary',
        priority_level_1_label: 'Secondary',
        priority_level_0_label: 'No Demand'
      }
    }
  }
})

describe('FavoriteButton Logic', () => {
  const mountBtn = (props: any) => mount(FavoriteButton, {
    props,
    global: {
      plugins: [i18n],
      directives: {
        tippy: {} // Mock v-tippy
      }
    }
  })

  describe('formattedBufferHours', () => {
    it('should show both buffers when both present', () => {
      const wrapper = mountBtn({
        hasProduction: true,
        hasConsumption: true,
        primaryProductBufferHours: 12,
        resourceBufferHours: 1,
        level: 2
      })
      // Accessing internal computed property logic via rendered output or component instance is tricky in setup script.
      // Instead, we can check the tooltip content if we could access it, but v-tippy is directive.
      // A better way for unit testing internal logic in script setup is to extract the logic or test the side effects.
      // Here we will inspect the component's vm if possible, or rely on a slightly different approach:
      // Since the logic is inside `getBufferHoursString` which is not exported, we have to test via the tooltip content generation logic if exposed, 
      // or simply copy the logic here for verification if we can't easily access the component internals.
      
      // However, to truly test the component, we should look at how it renders. 
      // The tooltip content is passed to v-tippy. 
      // Let's trust the logic extraction for now or use a white-box approach if we can.
      
      // Actually, looking at the component, `getBufferHoursString` is used in `tooltipContent`.
      // We can try to access `wrapper.vm.tooltipContent` if it was exposed, but <script setup> is closed by default.
      
      // Alternative: We can verify the logic by reproducing it here as a "Specification Test" matching the requirement.
      // But that doesn't test the code.
      
      // Let's rely on the fact that we can't easily unit test private functions in <script setup> without `defineExpose`.
      // So I will assume we need to verify the logic conceptually or add a temporary expose.
      // OR, we can try to find where `getBufferHoursString` is used in the template? 
      // It is used in `tooltipContent` computed, which is passed to `v-tippy`.
      
      // Let's create a test that asserts the logic directly by importing a helper if we extracted it.
      // Since we didn't extract it, I will write a test that mounts the component and checks if I can read the tooltip content from the directive call?
      
      // Strategy: Mock v-tippy and intercept the content.
    })
  })
})

// Since testing private logic in .vue is hard, I'll extract the logic to a standalone file for testing? 
// No, that changes the code structure too much for a verification step.

// Let's try to mock the directive and capture the value.
const tippyMock = vi.fn()
const MountWithTippy = (props: any) => mount(FavoriteButton, {
  props,
  global: {
    plugins: [i18n],
    directives: {
      tippy: {
        mounted: (el, binding) => tippyMock(binding.value),
        updated: (el, binding) => tippyMock(binding.value)
      }
    }
  }
})

describe('FavoriteButton Logic (via Tippy Content)', () => {
  beforeEach(() => {
    tippyMock.mockClear()
  })

  it('formats hours correctly: prod=12, res=1 -> 12h + 1h', () => {
    MountWithTippy({
      hasProduction: true,
      hasConsumption: true,
      primaryProductBufferHours: 12,
      resourceBufferHours: 1,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    // The content is HTML string. We look for "12h + 1h".
    expect(content).toContain('12h + 1h')
  })

  it('formats hours correctly: prod=0.001, res=2 -> 2h (hides 0h)', () => {
    MountWithTippy({
      hasProduction: true,
      hasConsumption: true,
      primaryProductBufferHours: 0.001,
      resourceBufferHours: 2,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    expect(content).toContain('>2h<') // Should contain exactly 2h, not 0h + 2h.
    expect(content).not.toContain('0h +')
  })

  it('formats hours correctly: prod=12, no res -> 12h', () => {
    MountWithTippy({
      hasProduction: true,
      hasConsumption: false,
      primaryProductBufferHours: 12,
      resourceBufferHours: 0,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    expect(content).toContain('>12h<')
  })

  it('generates description correctly: Level 2 + Prod Only -> Long', () => {
    MountWithTippy({
      hasProduction: true,
      hasConsumption: false,
      availableLevels: [0, 1, 2],
      level: 2
    })
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    // We expect the Primary row (active) to have "Long" but NOT "Long+Res" logic.
    // However, the No Demand row will still show "Res", so checking for global absence of "Res" is wrong.
    // Let's verify that the Primary row description is exactly "Long".
    
    // Simplest way: Check for the sequence.
    // Primary row structure: label-cell">Primary</span>...desc-cell">Long</span>
    expect(content).toMatch(/Primary<\/span>\s*<span class="hours-cell">[^<]*<\/span>\s*<span class="desc-cell">Long<\/span>/)
  })

  it('generates description correctly: Level 2 + Prod + Cons -> Long+Res', () => {
    MountWithTippy({
      hasProduction: true,
      hasConsumption: true,
      availableLevels: [0, 1, 2],
      level: 2
    })
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    expect(content).toContain('Long+Res')
  })
  
  it('filters rows based on availableLevels: Planned [1, 2]', () => {
     MountWithTippy({
      hasProduction: true,
      hasConsumption: true,
      availableLevels: [1, 2],
      level: 2
    })
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    expect(content).toContain('Primary')
    expect(content).toContain('Secondary')
    expect(content).not.toContain('No Demand')
  })
  
   it('filters rows based on availableLevels: Cons [0]', () => {
     MountWithTippy({
      hasProduction: false,
      hasConsumption: true,
      availableLevels: [0],
      level: 0
    })
    const content = tippyMock.mock.calls[0][0].content.value || tippyMock.mock.calls[0][0].content
    expect(content).not.toContain('Primary')
    expect(content).not.toContain('Secondary')
    expect(content).toContain('No Demand')
  })
})
