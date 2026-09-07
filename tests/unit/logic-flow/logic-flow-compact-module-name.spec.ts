/** @vitest-environment jsdom */
import { shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LogicFlowPlanningZone from '@/components/logic-flow/LogicFlowPlanningZone.vue'

const state = vi.hoisted(() => ({
  groups: [],
  isDragging: false,
  draggingWareId: null,
  draggingLineage: 'teladi',
}))
vi.mock('@/store/useLogicFlowStore', () => ({ useLogicFlowStore: () => state }))
vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    isRawMaterialWare: (id: string) => id === 'ore',
    getWareDisplayName: (id: string) => ({ ore: 'Ore', hullparts: 'Hull Parts', unknown: 'Unknown Ware' })[id],
    getModuleDisplayName: (id: string) => ({ common: 'Hull Part Production', teladi: 'Teladi Hull Part Production' })[id],
    findModuleForWare: (ware: string, lineage: string) => ware === 'hullparts'
      ? { id: lineage === 'teladi' ? 'teladi' : 'common' }
      : null,
  }),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const wrappers: ReturnType<typeof shallowMount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
function planning() {
  const wrapper = shallowMount(LogicFlowPlanningZone, {
    global: { mocks: { $t: (key: string) => key } },
  })
  wrappers.push(wrapper)
  return wrapper.vm as unknown as {
    getCompactNodeDisplayName: (node: object, group: object) => string
  }
}

const common = { wareId: 'hullparts', moduleId: 'common', isPreview: false }
const teladi = { wareId: 'hullparts', moduleId: 'teladi', isPreview: false }
const group = { nodes: [common, teladi], isLocked: false, lockedLineage: 'default' }

describe('compact module names', () => {
  it('preserves the identity of two modules producing the same ware', () => {
    const { getCompactNodeDisplayName: name } = planning()
    expect([name(common, group), name(teladi, group)])
      .toEqual(['Hull Part Production', 'Teladi Hull Part Production'])
  })

  it.each([
    ['raw', { wareId: 'ore' }, group, 'Ore'],
    ['ware placeholder', { wareId: 'hullparts' }, { ...group, nodes: [] }, 'Hull Parts'],
    ['unlocked preview', { wareId: 'hullparts', isPreview: true }, group, 'Teladi Hull Part Production'],
    ['locked preview', { wareId: 'hullparts', isPreview: true }, { ...group, isLocked: true }, 'Hull Part Production'],
    ['preview without a producer', { wareId: 'unknown', isPreview: true }, group, 'Unknown Ware'],
  ])('keeps %s naming', (_scenario, node, target, expected) => {
    expect(planning().getCompactNodeDisplayName(node, target)).toBe(expected)
  })
})
