// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { SketchPicker } from 'vue-color'
import SectorGroupCard from '@/components/empire/sector-overview/SectorGroupCard.vue'
import MapSectorGroupColorLayer from '@/components/map/layers/MapSectorGroupColorLayer.vue'
import type { GroupDraftInfo } from '@/store/logic/autoGroup'
import type { MapSectorPolygonCluster } from '@/composables/useMapSvgSectors'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))

const wrappers: VueWrapper[] = []
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); wrappers.length = 0; document.body.innerHTML = '' })

const group: GroupDraftInfo = {
  id: 'hub', name: 'Hub', sectorMacro: 'hub', jumpRange: 2, originalJumpRange: 2,
  coverageSectorMacros: [], connectedGroupIds: [], excludedDefaultAssignmentSectorMacros: [],
  isNew: false, isPinned: true, coverageRetainEnabled: true, connectionRetainEnabled: true,
  tradeStationRetainEnabled: true, baseline: true, color: '#16a5a5'
}

async function openPicker() {
  const wrapper = mount(SectorGroupCard, {
    attachTo: document.body,
    props: { group, groups: [group], assignments: [], maps: null, sectorGraph: {}, sectorClusterMap: {}, playerSectorMacros: [], editable: true, diffEnabled: false }
  })
  wrappers.push(wrapper)
  await wrapper.get('.color-chip').trigger('click')
  expect(document.querySelector('.vc-sketch-picker')).not.toBeNull()
  return wrapper
}

describe('sector group picker events', () => {
  it('consumes the real transparent preset once, with clear as the final event', async () => {
    const wrapper = await openPicker()
    const preset = document.querySelector<HTMLElement>('.preset-color[title="transparent"]')!
    expect(preset.hasAttribute('data-color')).toBe(false)
    preset.click()
    await nextTick()
    expect(wrapper.emitted('color-change')).toEqual([['hub', undefined]])
    expect(document.querySelector('.color-picker-popper')).toBeNull()
    await wrapper.setProps({ group: { ...group, color: undefined } })
    expect(wrapper.get('.color-chip').classes()).toContain('color-chip--empty')
  })

  it('keeps the real opaque preset color and emits only one change', async () => {
    const wrapper = await openPicker()
    document.querySelector<HTMLElement>('.preset-color[title="#F44E3B"]')!.click()
    await nextTick()
    expect(wrapper.emitted('color-change')).toEqual([['hub', '#f44e3b']])
    expect(document.querySelector('.color-picker-popper')).toBeNull()
  })

  it.each(['#ff000000', '#12345600'])('clears zero-alpha picker hex8 output %s', async (value) => {
    const wrapper = await openPicker()
    wrapper.findComponent(SketchPicker).vm.$emit('update:modelValue', value)
    await nextTick()
    expect(wrapper.emitted('color-change')).toEqual([['hub', undefined]])
  })

  it('preserves a nonzero alpha channel', async () => {
    const wrapper = await openPicker()
    wrapper.findComponent(SketchPicker).vm.$emit('update:modelValue', '#f44e3b80')
    await nextTick()
    expect(wrapper.emitted('color-change')).toEqual([['hub', '#f44e3b80']])
  })

  it('does not replace malformed picker input with a default color', async () => {
    const wrapper = await openPicker()
    wrapper.findComponent(SketchPicker).vm.$emit('update:modelValue', 'not-a-color')
    await nextTick()
    expect(wrapper.emitted('color-change')).toBeUndefined()
    expect(document.querySelector('.color-picker-popper')).not.toBeNull()
  })
})

function sector(id: string, sx: number, sy: number, radius: number): MapSectorPolygonCluster['sectors'][number] {
  return { id, clusterId: 'cluster', name: id, displayName: id, owner: '', sunlight: 100, resources: [], sx, sy, radius, color: '#fff', label: id, labelY: sy, labelFontSize: 12, hasKhaakHive: false, khaakHiveSources: [] }
}
function renderLayer(sectors: MapSectorPolygonCluster['sectors'], colors: Record<string, string>) {
  const hexPoints = vi.fn((x: number, y: number, radius: number) => `${x},${y} ${x + radius},${y}`)
  const wrapper = mount(MapSectorGroupColorLayer, { props: {
    clusterPolygons: [{ id: 'cluster', cx: 999, cy: 888, color: '#fff', clusterRadius: 200, sectors }],
    sectorGroupColorMap: colors, hexPoints
  } })
  wrappers.push(wrapper)
  return { wrapper, hexPoints }
}

describe('sector group coverage geometry', () => {
  it('uses the single sector center, including zero coordinates, and two-thirds radius', () => {
    const { wrapper, hexPoints } = renderLayer([sector('single', 0, 0, 120)], { single: '#f44e3b' })
    expect(hexPoints).toHaveBeenCalledWith(0, 0, 80)
    expect(wrapper.findAll('polygon')).toHaveLength(1)
    expect(wrapper.get('polygon').attributes('fill')).toBe('#f44e3b')
    expect(wrapper.get('polygon').attributes('fill-opacity')).toBe('0.35')
  })

  it('uses each multi-sector center/radius and does not draw uncolored sectors', () => {
    const { wrapper, hexPoints } = renderLayer([sector('a', 10, 20, 60), sector('b', 30, 40, 90), sector('none', 50, 60, 120)], { a: '#f44e3b', b: '#16a5a5' })
    expect(hexPoints.mock.calls).toEqual([[10, 20, 40], [30, 40, 60]])
    expect(wrapper.findAll('polygon').map(polygon => polygon.attributes('fill'))).toEqual(['#f44e3b', '#16a5a5'])
  })

  it('does not draw a single sector with no group color', () => {
    const { wrapper, hexPoints } = renderLayer([sector('none', 0, 0, 120)], {})
    expect(wrapper.findAll('polygon')).toHaveLength(0)
    expect(hexPoints).not.toHaveBeenCalled()
  })
})
