// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import draggable from 'vuedraggable'
import DragTestPage from '@/components/test/DragTestPage.vue'
import { useDragTestStore } from '@/store/useDragTestStore'

function render() {
  const pinia = createPinia()
  const store = useDragTestStore(pinia)
  const wrapper = mount(DragTestPage, { global: { plugins: [pinia] } })
  const lists = wrapper.findAllComponents(draggable)
  const start = async (itemId: string) => {
    lists[0].vm.$emit('start', { item: wrapper.get(`[data-item-id="${itemId}"]`).element })
    await nextTick()
  }
  const over = async (zoneId: 'A' | 'B') => {
    const zone = wrapper.get(`[data-zone-id="${zoneId}"]`)
    setBounds(zone.element, zoneId === 'A' ? 20 : 200, 20)
    await zone.trigger('dragenter', { clientX: zoneId === 'A' ? 50 : 250, clientY: 50 })
    await zone.trigger('dragover', { clientX: zoneId === 'A' ? 50 : 250, clientY: 50 })
  }
  const add = async (itemId: string, zoneId: 'A' | 'B') => {
    lists[zoneId === 'A' ? 0 : 1].vm.$emit('add', {
      item: wrapper.get(`[data-item-id="${itemId}"]`).element
    })
    await nextTick()
  }
  const end = async (source: 'A' | 'B' = 'A') => {
    lists[source === 'A' ? 0 : 1].vm.$emit('end')
    await nextTick()
  }
  return { wrapper, store, lists, start, over, add, end }
}

function setBounds(element: Element, left: number, top: number) {
  element.getBoundingClientRect = () => ({
    left,
    top,
    right: left + 100,
    bottom: top + 100,
    width: 100,
    height: 100,
    x: left,
    y: top,
    toJSON: () => ({})
  })
}

describe('drag demo list ownership', () => {
  it('moves a normal item through one store-owned transaction', async () => {
    const { wrapper, store, lists, start, over, add, end } = render()
    expect(store.zoneAItems.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(store.zoneBItems).toEqual([])

    await start('item-1')
    await over('B')
    await add('item-1', 'B')
    await end()

    expect(store.zoneAItems.map(item => item.id)).toEqual(['item-2', 'item-3', 'item-4', 'item-5'])
    expect(store.zoneBItems.map(item => ({ id: item.id, zone: item.zone }))).toEqual([{ id: 'item-1', zone: 'B' }])
    expect(store.events.map(event => event.type)).toEqual(['dragstart', 'dragenter', 'dragover', 'drop', 'dragend'])
    expect(lists[0].props('list')).toBeNull()
    expect(lists[0].props('modelValue')).not.toBe(store.items)
    wrapper.unmount()
  })

  it('cancels after leave without moving any item', async () => {
    const { wrapper, store, start, over, end } = render()
    await start('item-1')
    await over('B')
    const zoneB = wrapper.get('[data-zone-id="B"]')
    await zoneB.trigger('dragleave', { clientX: 5, clientY: 5 })
    await end()

    expect(store.zoneAItems.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(store.zoneBItems).toEqual([])
    expect(store.hoveredZoneId).toBeNull()
    expect(store.events.map(event => event.type)).toEqual(['dragstart', 'dragenter', 'dragover', 'dragleave', 'dragend'])
    wrapper.unmount()
  })

  it.each([
    ['Auto', 'item-1', 1, 'isAuto'],
    ['Isolate', 'item-2', 2, 'isIsolated']
  ] as const)('converts the %s placeholder without duplication', async (label, itemId, buttonIndex, flag) => {
    const { wrapper, store, start, over, add, end } = render()
    await wrapper.findAll('button')[buttonIndex].trigger('click')
    expect(wrapper.find('[data-zone-id="B"] .status-label').exists()).toBe(false)

    await start(itemId)
    expect(wrapper.get('[data-zone-id="B"] .status-label').text()).toBe(label)
    await over('B')
    expect(wrapper.get('[data-zone-id="B"] .status-label').text()).toBe(label === 'Auto' ? 'Manual' : 'Connect')
    await add(itemId, 'B')
    await end()

    const matches = store.zoneBItems.filter(item => item.id === itemId)
    expect(matches).toHaveLength(1)
    expect(matches[0][flag]).toBe(false)
    expect(store.zoneAItems.some(item => item.id === itemId)).toBe(false)
    expect(new Set(store.items.map(item => item.id)).size).toBe(store.items.length)
    wrapper.unmount()
  })

  it('rejects locked Argon before Sortable can reparent DOM', async () => {
    const { wrapper, store, lists, start, over, add, end } = render()
    await wrapper.get('button').trigger('click')
    await start('item-5')
    await over('B')

    const canMove = lists[0].props('move') as ((event: unknown) => boolean) | undefined
    expect(canMove?.({
      draggedContext: { element: store.items.find(item => item.id === 'item-5') },
      to: lists[1].element
    })).toBe(false)
    expect(store.hoveredZoneId).toBe('B')
    expect(store.getDropStatus('item-5', 'B')).toBe('rejected')
    expect(wrapper.get('[data-zone-id="B"]').classes()).toContain('border-red-600')
    expect(wrapper.get('[data-zone-id="B"] .status-label').text()).toContain('Rejected')
    await add('item-5', 'B')
    await end()

    expect(store.zoneAItems.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(store.zoneBItems).toEqual([])
    expect(wrapper.findAll('[data-zone-id="A"] [data-item-id="item-5"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-zone-id="B"] [data-item-id="item-5"]')).toHaveLength(0)
    expect(store.events.map(event => event.type)).toEqual(['dragstart', 'dragenter', 'dragover', 'dragend'])
    wrapper.unmount()
  })

  it('never force-removes Vue-owned DOM when a rejected add reaches the component boundary', async () => {
    const { wrapper, store, start, over, add, end } = render()
    await wrapper.findAll('button')[0].trigger('click')
    await start('item-5')
    await over('B')
    await add('item-5', 'B')
    await end()

    expect(store.zoneAItems.map(item => item.id)).toContain('item-5')
    expect(store.zoneBItems).toEqual([])
    expect(wrapper.findAll('[data-zone-id="A"] [data-item-id="item-5"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-zone-id="B"] [data-item-id="item-5"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('captures genuine nested dragover and permits locked Terran', async () => {
    const { wrapper, store, lists, start, add, end } = render()
    await wrapper.get('button').trigger('click')
    await start('item-4')
    const zoneB = wrapper.get('[data-zone-id="B"]')
    setBounds(zoneB.element, 200, 20)
    await zoneB.trigger('dragenter', { clientX: 250, clientY: 50 })
    const nested = zoneB.get('.draggable-area').element
    nested.addEventListener('dragover', event => event.stopPropagation())
    nested.dispatchEvent(new MouseEvent('dragover', { bubbles: true, clientX: 250, clientY: 50 }))
    await nextTick()
    const canMove = lists[0].props('move') as (event: unknown) => boolean
    expect(canMove({
      draggedContext: { element: store.items.find(item => item.id === 'item-4') },
      to: lists[1].element
    })).toBe(true)
    await add('item-4', 'B')
    await end()

    expect(store.zoneBItems.map(item => item.id)).toEqual(['item-4'])
    expect(store.events.map(event => event.type)).toEqual(['dragstart', 'dragenter', 'dragover', 'drop', 'dragend'])
    wrapper.unmount()
  })

  it('keeps a same-zone duplicate unique', async () => {
    const { wrapper, store, lists, start, over, add, end } = render()
    await start('item-1')
    await over('B')
    await add('item-1', 'B')
    await end()

    await start('item-1')
    const canMove = lists[1].props('move') as ((event: unknown) => boolean) | undefined
    expect(canMove?.({
      draggedContext: { element: store.items.find(item => item.id === 'item-1') },
      to: lists[1].element
    })).toBe(false)
    await end('B')

    expect(store.getDropStatus('item-1', 'B')).toBe('duplicated')
    expect(store.zoneBItems.map(item => item.id)).toEqual(['item-1'])
    expect(store.items.filter(item => item.id === 'item-1')).toHaveLength(1)
    wrapper.unmount()
  })

  it('resets items, flags, hover, and event history', async () => {
    const { wrapper, store, start, over } = render()
    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.findAll('button')[2].trigger('click')
    await start('item-4')
    await over('B')
    await wrapper.findAll('button')[3].trigger('click')

    expect(store.zoneAItems.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(store.zoneBItems).toEqual([])
    expect(store.events).toEqual([])
    expect(store.isDragging).toBe(false)
    expect(store.draggingItemId).toBeNull()
    expect(store.hoveredZoneId).toBeNull()
    wrapper.unmount()
  })
})
