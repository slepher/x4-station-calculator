/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import ProductionLineGroup from '../../../src/components/ProductionLineGroup.vue'
import { useLogicFlowStore } from '../../../src/store/useLogicFlowStore'
import { useGameDataStore } from '../../../src/store/useGameDataStore'
import { useEmpireStore } from '../../../src/store/useEmpireStore'
import { buildStationImportPayload, buildEmpireImportTargets, hasImportableGroups } from '../../../src/store/logic/logicFlowImport'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' }
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key,
      locale: { value: 'en' }
    }
  })
}))

vi.mock('vuedraggable', () => ({
  default: {
    name: 'draggable',
    template: '<div><slot /></div>'
  }
}))

const makeNode = (overrides: Record<string, any>) => ({
  id: overrides.id ?? crypto.randomUUID(),
  wareId: overrides.wareId ?? 'hullparts',
  moduleId: overrides.moduleId,
  race: overrides.race ?? 'default',
  lineage: overrides.lineage ?? 'default',
  column: overrides.column ?? 1,
  isIsolated: overrides.isIsolated ?? false,
  isAuto: overrides.isAuto ?? false,
  isRoot: overrides.isRoot ?? true,
  source: overrides.source ?? 'manual',
  order: overrides.order ?? 0,
})

const makeSavedGroup = (overrides: Record<string, any>) => ({
  id: overrides.id ?? crypto.randomUUID(),
  name: overrides.name ?? '',
  category: overrides.category ?? 'industrial',
  subCategory: overrides.subCategory ?? 'default',
  isLocked: overrides.isLocked ?? true,
  lockedLineage: overrides.lockedLineage ?? 'default',
  nodes: overrides.nodes ?? [],
})

describe('import-logic-flow unit coverage', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    const gameData = useGameDataStore()
    gameData.localizedWaresMap = {
      hullparts: { localeName: 'Hull Parts' },
      microchips: { localeName: 'Microchips' },
      claytronics: { localeName: 'Claytronics' },
      ore: { localeName: 'Ore' },
      graphene: { localeName: 'Graphene' }
    } as any
    gameData.waresMap = {
      hullparts: { id: 'hullparts', tier: 2, transport: 'container' },
      microchips: { id: 'microchips', tier: 2, transport: 'container' },
      claytronics: { id: 'claytronics', tier: 3, transport: 'container' },
      ore: { id: 'ore', tier: 0, transport: 'solid' },
      graphene: { id: 'graphene', tier: 1, transport: 'container' }
    } as any
    gameData.modulesMap = {
      prod_gen_hullparts_macro: { id: 'prod_gen_hullparts_macro', race: 'default', inputs: { ore: 10 } },
      prod_gen_microchips_macro: { id: 'prod_gen_microchips_macro', race: 'default', inputs: { ore: 10 } },
      prod_gen_claytronics_macro: { id: 'prod_gen_claytronics_macro', race: 'default', inputs: { microchips: 10 } }
    } as any
    gameData.getWareDisplayName = ((wareId: string) => gameData.localizedWaresMap[wareId]?.localeName || wareId) as any
    gameData.findModuleForWare = ((wareId: string) => {
      if (wareId === 'hullparts') return gameData.modulesMap['prod_gen_hullparts_macro'] as any
      if (wareId === 'microchips') return gameData.modulesMap['prod_gen_microchips_macro'] as any
      if (wareId === 'claytronics') return gameData.modulesMap['prod_gen_claytronics_macro'] as any
      return null
    }) as any
    gameData.wareSetsByIndustrialRace = { default: new Set(['hullparts', 'microchips', 'claytronics', 'ore']) } as any
    gameData.wareSetsByRace = { default: new Set(['hullparts', 'microchips', 'claytronics', 'ore']) } as any
  })

  const mountGroup = (group: any) => {
    const logicFlow = useLogicFlowStore()
    logicFlow.groups = [group] as any

    return mount(ProductionLineGroup, {
      props: { group },
      global: {
        plugins: [pinia],
        stubs: {
          FlowNodeComponent: true,
          Teleport: true
        }
      }
    })
  }

  it('1.1.1 默认组名：group.name 为空时返回最高 tier 的 manual 节点名称', () => {
    const group = {
      id: 'g-default-name',
      name: '',
      category: 'industrial',
      subCategory: 'default',
      isLocked: false,
      lockedLineage: 'default',
      nodes: [
        makeNode({ id: 'n1', wareId: 'hullparts', column: 2, source: 'manual', order: 1 }),
        makeNode({ id: 'n2', wareId: 'claytronics', column: 3, source: 'manual', order: 0 }),
        makeNode({ id: 'n3', wareId: 'ore', column: 0, source: 'auto', order: 0 }),
      ]
    }

    const wrapper = mountGroup(group)
    expect(wrapper.find('h3').text()).toContain('Claytronics')
  })

  it('1.1.2 默认组名：同 tier 优先非 isolated，其次按 order', () => {
    const group = {
      id: 'g-isolated-priority',
      name: '',
      category: 'industrial',
      subCategory: 'default',
      isLocked: false,
      lockedLineage: 'default',
      nodes: [
        makeNode({ id: 'n1', wareId: 'hullparts', column: 2, source: 'manual', isIsolated: true, order: 0 }),
        makeNode({ id: 'n2', wareId: 'microchips', column: 2, source: 'manual', isIsolated: false, order: 1 }),
      ]
    }

    const wrapper = mountGroup(group)
    expect(wrapper.find('h3').text()).toContain('Microchips')
  })

  it('1.1.3 默认组名：有 group.name 时返回显式名称', () => {
    const group = {
      id: 'g-custom-name',
      name: 'My Explicit Group',
      category: 'industrial',
      subCategory: 'default',
      isLocked: false,
      lockedLineage: 'default',
      nodes: [
        makeNode({ id: 'n1', wareId: 'claytronics', column: 3, source: 'manual', order: 0 }),
      ]
    }

    const wrapper = mountGroup(group)
    expect(wrapper.find('h3').text()).toContain('My Explicit Group')
  })

  it('1.2.1 规划区映射：仅 manual 节点进入 plannedModules', () => {
    const group = makeSavedGroup({
      id: 'g-manual-only',
      nodes: [
        makeNode({ id: 'manual-node', wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro', isIsolated: false }),
        makeNode({ id: 'auto-node', wareId: 'ore', source: 'auto', moduleId: undefined, isIsolated: false }),
      ]
    })

    const payload = buildStationImportPayload(group as any, useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(payload.plannedModules).toEqual([{ id: 'prod_gen_hullparts_macro', count: 1 }])
  })

  it('1.2.2 规划区映射：相同 moduleId 正确聚合计数', () => {
    const group = makeSavedGroup({
      id: 'g-aggregate-count',
      nodes: [
        makeNode({ wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro', order: 0 }),
        makeNode({ wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro', order: 1 }),
        makeNode({ wareId: 'microchips', source: 'manual', moduleId: 'prod_gen_microchips_macro', order: 2 }),
      ]
    })

    const payload = buildStationImportPayload(group as any, useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(payload.plannedModules).toEqual([
      { id: 'prod_gen_hullparts_macro', count: 2 },
      { id: 'prod_gen_microchips_macro', count: 1 },
    ])
  })

  it('1.2.3 规划区映射：无 manual 节点时判定为空规划区', () => {
    const group = makeSavedGroup({
      id: 'g-empty-group',
      nodes: [
        makeNode({ wareId: 'ore', source: 'auto', moduleId: undefined, isIsolated: false }),
      ]
    })

    const payload = buildStationImportPayload(group as any, useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(payload.manualModuleCount).toBe(0)
    expect(payload.plannedModules).toEqual([])
  })

  it('1.3.1 isolated 锁定过滤：container 类型进入锁定集合', () => {
    const group = makeSavedGroup({
      id: 'g-container-lock',
      nodes: [
        makeNode({ wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro', isIsolated: false }),
        makeNode({ wareId: 'graphene', source: 'manual', moduleId: undefined, isIsolated: true }),
      ]
    })

    const payload = buildStationImportPayload(group as any, useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(payload.lockedWares).toContain('graphene')
  })

  it('1.3.2 isolated 锁定过滤：非 container 类型忽略并产出 warning', () => {
    const group = makeSavedGroup({
      id: 'g-non-container-warning',
      nodes: [
        makeNode({ wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro', isIsolated: false }),
        makeNode({ wareId: 'ore', source: 'manual', moduleId: undefined, isIsolated: true }),
      ]
    })

    const payload = buildStationImportPayload(group as any, useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(payload.lockedWares).not.toContain('ore')
    expect(payload.warnings.some((w) => w.type === 'isolated_non_container_ignored' && w.wareId === 'ore')).toBe(true)
  })

  it('1.4.1 Empire 导入编排：含空规划区时跳过建站并产出 warning', () => {
    const nonEmpty = makeSavedGroup({
      id: 'g-empire-non-empty',
      nodes: [makeNode({ wareId: 'hullparts', source: 'manual', moduleId: 'prod_gen_hullparts_macro' })]
    })
    const empty = makeSavedGroup({
      id: 'g-empire-empty',
      nodes: [makeNode({ wareId: 'ore', source: 'auto', moduleId: undefined, isIsolated: false })]
    })

    const result = buildEmpireImportTargets([nonEmpty as any, empty as any], useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(result.targets).toHaveLength(1)
    expect(result.warnings.some((w) => w.type === 'empty_group_skipped' && w.groupId === 'g-empire-empty')).toBe(true)
  })

  it('1.4.2 Empire 导入编排：方案全空时导入被阻止（无 importable groups）', () => {
    const emptyA = makeSavedGroup({ id: 'g-empty-a', nodes: [] })
    const emptyB = makeSavedGroup({ id: 'g-empty-b', nodes: [makeNode({ wareId: 'ore', source: 'auto', moduleId: undefined })] })

    expect(hasImportableGroups([emptyA as any, emptyB as any])).toBe(false)

    const result = buildEmpireImportTargets([emptyA as any, emptyB as any], useGameDataStore().waresMap as any, useGameDataStore().getWareDisplayName)
    expect(result.targets).toHaveLength(0)
  })

  it('1.5.1 Store 回归：手动投放/节点变更不会自动写入 group.name', () => {
    const store = useLogicFlowStore()
    const group = store.addGroup('industrial', 'default')

    expect(group.name).toBe('')
    store.expandUpstream(group.id, 'hullparts', 'manual', 'default')
    expect(group.name).toBe('')
  })

  it('1.6.1 dirty 判定：仅 activeStationId 变化不计入，业务数据变更计入', () => {
    const empireStore = useEmpireStore()
    empireStore.createEmpire('ILF Dirty Scope')

    const stationA = empireStore.createStation('A', 'industrial')
    const stationB = empireStore.createStation('B', 'industrial')
    expect(stationA).toBeTruthy()
    expect(stationB).toBeTruthy()

    empireStore.saveEmpire()
    expect(empireStore.shouldConfirmBeforeEmpireReset()).toBe(false)

    empireStore.selectStation(stationA!.id)
    expect(empireStore.shouldConfirmBeforeEmpireReset()).toBe(false)

    empireStore.selectStation(stationB!.id)
    expect(empireStore.shouldConfirmBeforeEmpireReset()).toBe(false)

    empireStore.updateEmpireName('ILF Dirty Scope Updated')
    expect(empireStore.shouldConfirmBeforeEmpireReset()).toBe(true)
  })
})
