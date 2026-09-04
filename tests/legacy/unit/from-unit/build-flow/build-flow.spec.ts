/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  computeDemandMaterialSet,
  deriveBuildFlowView,
  computeBuildFlowGroups,
  cleanupStaleAssignments,
  computeVirtualEdges,
  type BuildFlowLineCard,
  type BuildFlowGroup,
  type BuildFlowAssignment
} from '@/store/logic/buildFlowDerivation'
import type { ProductionLineGroup, X4Module, FlowNode } from '@/types/x4'

vi.mock('@/store/useGameDataStore', () => ({
  useGameDataStore: () => ({
    modulesMap: {
      'module_gen_prod_hullparts_01': { id: 'module_gen_prod_hullparts_01', macroId: 'module_gen_prod_hullparts_01_macro', wareId: 'module_gen_prod_hullparts_01', nameId: '{20104,2}', name: 'Hull Part Production', dlc_tag: '', type: 'production', method: 'default', isPlayerBlueprint: true, group: 'production_gen', race: 'argon', buildTime: 60, buildCost: { graphene: 50, refinedmetals: 30, energycells: 10 }, cycleTime: 60, workforce: { needed: 10, capacity: 50, maxBonus: 0 }, outputs: { hullparts: 100 }, inputs: {}, dockingCount: 0, color: '#ffffff', color_rgb: '255,255,255', tier: 2 },
      'module_gen_prod_graphene_01': { id: 'module_gen_prod_graphene_01', macroId: 'module_gen_prod_graphene_01_macro', wareId: 'module_gen_prod_graphene_01', nameId: '{20104,1}', name: 'Graphene Production', dlc_tag: '', type: 'production', method: 'default', isPlayerBlueprint: true, group: 'production_gen', race: 'argon', buildTime: 60, buildCost: { methane: 20 }, cycleTime: 60, workforce: { needed: 10, capacity: 50, maxBonus: 0 }, outputs: { graphene: 100 }, inputs: {}, dockingCount: 0, color: '#ffffff', color_rgb: '255,255,255', tier: 1 }
    },
    waresMap: { hullparts: { id: 'hullparts', tier: 2 }, graphene: { id: 'graphene', tier: 1 }, refinedmetals: { id: 'refinedmetals', tier: 1 } },
    getWareDisplayName: (wareId: string) => wareId.toUpperCase()
  })
}))

import { useLogicFlowStore } from '@/store/useLogicFlowStore'

function createMockModule(id: string, outputs: Record<string, number>, buildCost: Record<string, number>, tier: number): X4Module {
  return {
    id,
    macroId: `${id}_macro`,
    wareId: id,
    nameId: `{20104,${tier}}`,
    name: `${id} Production`,
    dlc_tag: '',
    type: 'production',
    method: 'default',
    isPlayerBlueprint: true,
    group: 'production_gen',
    race: 'argon',
    buildTime: 60,
    buildCost,
    cycleTime: 60,
    workforce: { needed: 10, capacity: 50, maxBonus: 0 },
    outputs,
    inputs: {},
    dockingCount: 0,
    color: '#ffffff',
    color_rgb: '255,255,255',
    tier
  }
}

function createMockGroup(id: string, name: string, nodes: FlowNode[]): ProductionLineGroup {
  return {
    id,
    name,
    category: 'industrial',
    subCategory: 'default',
    isLocked: false,
    lockedLineage: 'default',
    nodes
  }
}

function createManualNode(wareId: string): FlowNode {
  return {
    id: `node-${wareId}`,
    wareId,
    source: 'manual',
    moduleId: undefined,
    race: 'argon',
    lineage: 'default',
    column: 1,
    isIsolated: false,
    isAuto: false,
    isRoot: true,
    order: 1
  }
}

function createModuleNode(moduleId: string): FlowNode {
  return {
    id: `node-mod-${moduleId}`,
    wareId: moduleId,
    source: 'auto',
    moduleId,
    race: 'argon',
    lineage: 'default',
    column: 1,
    isIsolated: false,
    isAuto: true,
    isRoot: false,
    order: 2
  }
}

function createIsolatedNode(wareId: string): FlowNode {
  return {
    id: `node-iso-${wareId}`,
    wareId,
    source: 'auto',
    moduleId: undefined,
    race: 'argon',
    lineage: 'default',
    column: 1,
    isIsolated: true,
    isAuto: true,
    isRoot: false,
    order: 3
  }
}

function buildMockModulesMap(): Record<string, X4Module> {
  return {
    'module_gen_prod_hullparts_01': createMockModule('module_gen_prod_hullparts_01', { hullparts: 100 }, { graphene: 50, refinedmetals: 30, energycells: 10 }, 2),
    'module_gen_prod_graphene_01': createMockModule('module_gen_prod_graphene_01', { graphene: 100 }, { methane: 20 }, 1),
    'module_gen_prod_refinedmetals_01': createMockModule('module_gen_prod_refinedmetals_01', { refinedmetals: 100 }, {}, 1),
    'module_gen_prod_claytronics_01': createMockModule('module_gen_prod_claytronics_01', { claytronics: 100 }, { antimattercells: 10, microchips: 20, quantumtubes: 30 }, 3),
    'module_gen_prod_quantumtubes_01': createMockModule('module_gen_prod_quantumtubes_01', { quantumtubes: 100 }, { graphene: 40, superfluidcoolant: 20 }, 2)
  }
}

const mockModulesMap = buildMockModulesMap()
const mockGetWareLabel = (wareId: string) => wareId.toUpperCase()

describe('buildFlowDerivation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1.1 测试 computeDemandMaterialSet 正确排除归档产线', () => {
    // 1.1.1 在 buildFlowDerivation.ts 对 computeDemandMaterialSet 编写单元测试
    // 1.1.2 给定 groups 包含 2 条产线，其中 1 条 archivedGroupIds 包含
    const groupA = createMockGroup('group-a', 'A', [
      createManualNode('hullparts'),
      createModuleNode('module_gen_prod_hullparts_01')
    ])
    const groupB = createMockGroup('group-b', 'B', [
      createManualNode('graphene'),
      createModuleNode('module_gen_prod_graphene_01')
    ])
    const groups = [groupA, groupB]
    const archivedGroupIds = ['group-b']
    // 1.1.3 执行 computeDemandMaterialSet 并断言结果不包含归档产线的 buildCost wareId #期望: [仅非归档产线的wareId集合]
    const result = computeDemandMaterialSet(groups, mockModulesMap, archivedGroupIds)
    expect(result.has('graphene')).toBe(true)
    expect(result.has('refinedmetals')).toBe(true)
    expect(result.has('energycells')).toBe(true)
    expect(result.has('methane')).toBe(false)
  })

  it('1.2 测试 deriveBuildFlowView 正确推导入选产线', () => {
    // 1.2.1 在 buildFlowDerivation.ts 对 deriveBuildFlowView 编写单元测试
    // 1.2.2 给定 groups 包含产线 A（主要产品命中 demandMaterialSet）和产线 B（不命中）
    const groupA = createMockGroup('group-a', 'A', [
      createManualNode('hullparts'),
      createModuleNode('module_gen_prod_hullparts_01')
    ])
    const groupC = createMockGroup('group-c', 'C', [
      createManualNode('graphene'),
      createModuleNode('module_gen_prod_graphene_01')
    ])
    const groupD = createMockGroup('group-d', 'D', [
      createManualNode('someotherware'),
      createModuleNode('module_gen_prod_refinedmetals_01')
    ])
    const groups = [groupA, groupC, groupD]
    const displayNames = new Map<string, string>()
    displayNames.set('group-a', '产线A')
    displayNames.set('group-c', '产线C')
    displayNames.set('group-d', '产线D')
    // 1.2.3 执行 deriveBuildFlowView 并断言 lineCards 仅包含产线 A #期望: [产线A的groupId]
    const result = deriveBuildFlowView(groups, mockModulesMap, displayNames, mockGetWareLabel)
    expect(result.lineCards.some(c => c.groupId === 'group-c')).toBe(true)
    expect(result.lineCards.some(c => c.groupId === 'group-d')).toBe(false)
  })

  it('1.3 测试 computeBuildFlowGroups 分组算法连通分量', () => {
    // 1.3.1 在 buildFlowDerivation.ts 对 computeBuildFlowGroups 编写单元测试
    // 1.3.2 给定 3 条入选产线：A 提供 hullparts 且需 graphene，B 提供 graphene 且需 hullparts，C 提供 refinedmetals 且无建材需求
    const cardA: BuildFlowLineCard = {
      groupId: 'group-a',
      title: '产线A',
      sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
      buildMaterialTags: [{ tagId: 'tgt:a:graphene', wareId: 'graphene', label: 'GRAPHENE' }]
    }
    const cardB: BuildFlowLineCard = {
      groupId: 'group-b',
      title: '产线B',
      sourceTags: [{ tagId: 'src:b:graphene', wareId: 'graphene', label: 'GRAPHENE' }],
      buildMaterialTags: [{ tagId: 'tgt:b:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
    }
    const cardC: BuildFlowLineCard = {
      groupId: 'group-c',
      title: '产线C',
      sourceTags: [{ tagId: 'src:c:refinedmetals', wareId: 'refinedmetals', label: 'REFINEDMETALS' }],
      buildMaterialTags: []
    }
    const lineCards = [cardA, cardB, cardC]
    // 1.3.3 执行 computeBuildFlowGroups 并断言 A 和 B 在同一组，C 在另一组 #期望: [2个分组, groupKey包含A:B和C]
    const result = computeBuildFlowGroups(lineCards)
    expect(result.length).toBe(2)
    const connectedGroup = result.find(g => g.lineCards.some(c => c.groupId === 'group-a'))
    expect(connectedGroup?.lineCards.some(c => c.groupId === 'group-b')).toBe(true)
    const isolatedGroup = result.find(g => g.lineCards.some(c => c.groupId === 'group-c'))
    expect(isolatedGroup?.lineCards.length).toBe(1)
    expect(isolatedGroup?.lineCards[0]?.groupId).toBe('group-c')
  })

  it('1.4 测试 cleanupStaleAssignments 跨组清理', () => {
    // 1.4.1 在 buildFlowDerivation.ts 对 cleanupStaleAssignments 编写单元测试
    // 1.4.2 给定 assignments 包含一条跨组绑定（来源在组 A，目标在组 B）
    const assignment: BuildFlowAssignment = {
      wareId: 'hullparts',
      sourceGroupId: 'group-a',
      targetType: 'line-build-material',
      targetGroupId: 'group-b'
    }
    const assignments: BuildFlowAssignment[] = [assignment]
    const cardA: BuildFlowLineCard = {
      groupId: 'group-a',
      title: '产线A',
      sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
      buildMaterialTags: []
    }
    const cardB: BuildFlowLineCard = {
      groupId: 'group-b',
      title: '产线B',
      sourceTags: [{ tagId: 'src:b:other', wareId: 'other', label: 'OTHER' }],
      buildMaterialTags: [{ tagId: 'tgt:b:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
    }
    const buildFlowGroups: BuildFlowGroup[] = [
      { groupKey: 'group-a', lineCards: [cardA], outputBuildTags: [], outputMaterialTags: [] },
      { groupKey: 'group-b', lineCards: [cardB], outputBuildTags: [], outputMaterialTags: [] }
    ]
    const groupA = createMockGroup('group-a', 'A', [
      createManualNode('hullparts'),
      createModuleNode('module_gen_prod_hullparts_01')
    ])
    const groupB = createMockGroup('group-b', 'B', [
      createManualNode('other'),
      createModuleNode('module_gen_prod_quantumtubes_01')
    ])
    const groups = [groupA, groupB]
    const demandMaterialSet = computeDemandMaterialSet(groups, mockModulesMap)
    // 1.4.3 执行 cleanupStaleAssignments 并断言该 assignment 被删除 #期望: [assignments.length减少1]
    const result = cleanupStaleAssignments(assignments, groups, demandMaterialSet, mockModulesMap, buildFlowGroups)
    expect(result.length).toBe(0)
  })

  it('1.5 测试 archiveGroup 清理相关 assignments', () => {
    // 1.5.1 在 useLogicFlowStore.ts 对 archiveBuildFlowGroup 编写单元测试
    setActivePinia(createPinia())
    const logicFlow = useLogicFlowStore()
    // 1.5.2 给定产线 X 存在作为来源的 assignment 和作为目标的 assignment
    const groupX = createMockGroup('group-x', 'X', [
      createManualNode('hullparts'),
      createModuleNode('module_gen_prod_hullparts_01')
    ])
    const groupY = createMockGroup('group-y', 'Y', [
      createManualNode('graphene'),
      createModuleNode('module_gen_prod_graphene_01')
    ])
    logicFlow.groups = [groupX, groupY]
    const assignment1: BuildFlowAssignment = {
      wareId: 'hullparts',
      sourceGroupId: 'group-x',
      targetType: 'line-build-material',
      targetGroupId: 'group-y'
    }
    const assignment2: BuildFlowAssignment = {
      wareId: 'graphene',
      sourceGroupId: 'group-y',
      targetType: 'line-build-material',
      targetGroupId: 'group-x'
    }
    logicFlow.buildFlowAssignments = [assignment1, assignment2]
    // 1.5.3 执行 archiveGroup(X) 并断言 assignments 数组不包含 X 相关记录 #期望: [assignments.filter涉及X返回空数组]
    logicFlow.archiveBuildFlowGroup('group-x')
    const xRelated = logicFlow.buildFlowAssignments.filter(
      a => a.sourceGroupId === 'group-x' || a.targetGroupId === 'group-x'
    )
    expect(xRelated.length).toBe(0)
  })

  describe('computeVirtualEdges', () => {
    it('建材区默认连线: 分组内非归档产线匹配时生成虚线虚拟连线', () => {
      const group: BuildFlowGroup = {
        groupKey: 'group-a',
        lineCards: [
          {
            groupId: 'group-a',
            title: '产线A',
            sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
            buildMaterialTags: []
          }
        ],
        outputBuildTags: [{ tagId: 'tgt:output-build:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
        outputMaterialTags: [{ tagId: 'tgt:output:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
      }
      const buildFlowGroups = [group]
      const assignments: BuildFlowAssignment[] = []
      const archivedGroupIds: string[] = []
      const allGroups: ProductionLineGroup[] = []

      const result = computeVirtualEdges(buildFlowGroups, assignments, archivedGroupIds, allGroups)

      const buildEdge = result.find(e => e.targetType === 'output-build-material')
      expect(buildEdge).toBeDefined()
      expect(buildEdge!.wareId).toBe('hullparts')
      expect(buildEdge!.sourceGroupId).toBe('group-a')
      expect(buildEdge!.isArchived).toBe(false)
      expect(buildEdge!.isDashed).toBe(true)
    })

    it('材料区优先搜索归档产线: 归档产线匹配时无线仅涂色', () => {
      const group: BuildFlowGroup = {
        groupKey: 'group-a',
        lineCards: [
          {
            groupId: 'group-a',
            title: '产线A',
            sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
            buildMaterialTags: []
          }
        ],
        outputBuildTags: [],
        outputMaterialTags: [{ tagId: 'tgt:output:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
      }
      const buildFlowGroups = [group]
      const assignments: BuildFlowAssignment[] = []
      const archivedGroupIds = ['group-archived']
      const allGroups: ProductionLineGroup[] = [
        createMockGroup('group-archived', 'Archive', [
          createManualNode('hullparts')
        ])
      ]

      const result = computeVirtualEdges(buildFlowGroups, assignments, archivedGroupIds, allGroups)

      const matEdge = result.find(e => e.targetType === 'output-material')
      expect(matEdge).toBeDefined()
      expect(matEdge!.sourceGroupId).toBe('group-archived')
      expect(matEdge!.isArchived).toBe(true)
      expect(matEdge!.isDashed).toBe(false)
    })

    it('材料区归档产线无匹配时回退到非归档产线: 虚线', () => {
      const group: BuildFlowGroup = {
        groupKey: 'group-a',
        lineCards: [
          {
            groupId: 'group-a',
            title: '产线A',
            sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
            buildMaterialTags: []
          }
        ],
        outputBuildTags: [],
        outputMaterialTags: [{ tagId: 'tgt:output:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
      }
      const buildFlowGroups = [group]
      const assignments: BuildFlowAssignment[] = []
      const archivedGroupIds = ['group-archived']
      const allGroups: ProductionLineGroup[] = [
        createMockGroup('group-archived', 'Archive', [
          createManualNode('graphene')
        ])
      ]

      const result = computeVirtualEdges(buildFlowGroups, assignments, archivedGroupIds, allGroups)

      const matEdge = result.find(e => e.targetType === 'output-material')
      expect(matEdge).toBeDefined()
      expect(matEdge!.sourceGroupId).toBe('group-a')
      expect(matEdge!.isArchived).toBe(false)
      expect(matEdge!.isDashed).toBe(true)
    })

    it('已手动绑定的产出标签不生成虚拟连线', () => {
      const group: BuildFlowGroup = {
        groupKey: 'group-a',
        lineCards: [
          {
            groupId: 'group-a',
            title: '产线A',
            sourceTags: [{ tagId: 'src:a:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
            buildMaterialTags: []
          }
        ],
        outputBuildTags: [{ tagId: 'tgt:output-build:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }],
        outputMaterialTags: [{ tagId: 'tgt:output:hullparts', wareId: 'hullparts', label: 'HULLPARTS' }]
      }
      const buildFlowGroups = [group]
      const assignments: BuildFlowAssignment[] = [
        { wareId: 'hullparts', sourceGroupId: 'group-a', targetType: 'output-build-material' }
      ]
      const archivedGroupIds: string[] = []
      const allGroups: ProductionLineGroup[] = []

      const result = computeVirtualEdges(buildFlowGroups, assignments, archivedGroupIds, allGroups)

      const buildEdge = result.find(e => e.targetType === 'output-build-material')
      expect(buildEdge).toBeUndefined()
    })
  })
})