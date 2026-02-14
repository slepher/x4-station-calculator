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

// Stub for Tippy component
// We render the content slot so we can inspect it
const TippyStub = {
  template: `
    <div class="tippy-stub">
      <slot />
      <div class="tippy-content">
        <slot name="content" />
      </div>
    </div>
  `
}

describe('FavoriteButton Logic (via Tippy Content)', () => {
  const mountBtn = (props: any) => mount(FavoriteButton, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        tippy: TippyStub
      }
    }
  })

  const getContent = (wrapper: any) => wrapper.find('.tippy-content').text()
  const getContentHtml = (wrapper: any) => wrapper.find('.tippy-content').html()

  it('formats hours correctly: prod=12, res=1 -> 12h + 1h', () => {
    const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: true,
      primaryProductBufferHours: 12,
      resourceBufferHours: 1,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    expect(getContent(wrapper)).toContain('12h + 1h')
  })

  it('formats hours correctly: prod=0.001, res=2 -> 2h (hides 0h)', () => {
    const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: true,
      primaryProductBufferHours: 0.001,
      resourceBufferHours: 2,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    const content = getContent(wrapper)
    // Check that we see "2h" but not "0h +"
    expect(content).toContain('2h')
    expect(content).not.toContain('0h +')
  })

  it('formats hours correctly: prod=12, no res -> 12h', () => {
    const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: false,
      primaryProductBufferHours: 12,
      resourceBufferHours: 0,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    expect(getContent(wrapper)).toContain('12h')
  })

  it('generates description correctly: Level 2 + Prod Only -> Long', () => {
    const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: false,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    // Find the row corresponding to Primary (level 2)
    // The rows are rendered with v-for. We can find them by checking the label.
    const rows = wrapper.findAll('.priority-tooltip-row')
    const primaryRow = rows.find(r => r.text().includes('Primary'))
    
    expect(primaryRow).toBeDefined()
    expect(primaryRow?.text()).toContain('Long')
    // Should NOT contain Res because it's prod only
    expect(primaryRow?.text()).not.toContain('Res')
  })

  it('generates description correctly: Level 2 + Prod + Cons -> Long+Res', () => {
    const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: true,
      availableLevels: [0, 1, 2],
      level: 2
    })
    
    const rows = wrapper.findAll('.priority-tooltip-row')
    const primaryRow = rows.find(r => r.text().includes('Primary'))
    
    expect(primaryRow).toBeDefined()
    expect(primaryRow?.text()).toContain('Long')
    expect(primaryRow?.text()).toContain('Res') 
    // The concatenation depends on translation keys, but in our mock we have 'Long' and 'Res'.
    // The component likely joins them or uses a specific key.
    // Let's check what the component does. 
    // In Read output: `buffer_long: 'Long'`, `buffer_resource: 'Res'`
    // The component code was truncated, but usually it joins them.
    // Let's just check both words exist.
  })
  
  it('filters rows based on availableLevels: Planned [1, 2]', () => {
     const wrapper = mountBtn({
      hasProduction: true,
      hasConsumption: true,
      availableLevels: [1, 2],
      level: 2
    })
    
    const content = getContent(wrapper)
    expect(content).toContain('Primary')
    expect(content).toContain('Secondary')
    expect(content).not.toContain('No Demand')
  })
  
   it('filters rows based on availableLevels: Cons [0]', () => {
     const wrapper = mountBtn({
      hasProduction: false,
      hasConsumption: true,
      availableLevels: [0],
      level: 0
    })
    
    const content = getContent(wrapper)
    expect(content).not.toContain('Primary')
    expect(content).not.toContain('Secondary')
    expect(content).toContain('No Demand')
  })
})
