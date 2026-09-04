import { describe, it, expect } from 'vitest'
import { computeFlowPlanLines, makeSchemes } from '@/store/logic/calculateBuildFlowPlan'
import { ROOT_BUILD_COST_KEY } from '@/store/logic/buildFlowPlanGraph'
import type { BuildFlowPlanGraph, BuildFlowPlanLine, BuildFlowPlanView } from '@/types/build-plan'
import type { BuildFlowGroup, BuildFlowTag, BuildFlowLineCard, BuildFlowAssignment, SavedModule, X4Module, X4Ware, StationSettings } from '@/types/x4'

const DEFAULT_SETTINGS: StationSettings = {
  sunlight: 100,
  useHQ: false,
  manualWorkforce: 0,
  workforcePercent: 100,
  workforceAuto: true,
  considerWorkforceForAutoFill: false,
  supplyWorkforceBonus: false,
  buyMultiplier: 0.5,
  sellMultiplier: 0.5,
  minersEnabled: true,
  internalSupply: true,
  showEmpireGaps: false,
  racePreference: 'argon',
  resourceBufferHours: 1,
  primaryProductBufferHours: 12,
  secondaryProductBufferHours: 2,
  transportMinutes: 30,
  transportShipCapacity: 62000,
  enforceDlcActivation: false
}

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
    name: overrides.id,
    nameId: '',
    type: 'production',
    method: 'default',
    race: 'argon',
    dlc_tag: 'base',
    tier: 1,
    group: 'hightech',
    macroId: '',
    isPlayerBlueprint: true,
    buildTime: 3600,
    buildCost: {},
    inputs: {},
    outputs: {},
    workforceCapacity: 0,
    workforceNeeded: 0,
    ...overrides
  }
}

function makeWare(overrides: Partial<X4Ware> & { id: string }): X4Ware {
  return {
    name: overrides.id,
    nameId: '',
    dlc_tag: 'base',
    transport: 'container',
    volume: 1,
    price: 100,
    minPrice: 50,
    maxPrice: 200,
    tier: 1,
    group: 'hightech',
    ...overrides
  }
}

const hullpartsWare = makeWare({ id: 'hullparts', name: 'Hull Parts' })
const claytronicsWare = makeWare({ id: 'claytronics', name: 'Claytronics' })
const advancedWare = makeWare({ id: 'advancedcomposites', name: 'Advanced Composites' })

// Hull Part Production: produces hullparts, needs refinedmetals, graphene
const hullpartsModule = makeModule({
  id: 'module_hullparts',
  name: 'Hull Part Production',
  outputs: { hullparts: 100 },
  inputs: { refinedmetals: 200, graphene: 100, energycells: 50 },
  buildCost: { advancedcomposites: 100, plasmaconductors: 100 },
  buildTime: 3600,
})

// Claytronics Production: produces claytronics
const claytronicsModule = makeModule({
  id: 'module_claytronics',
  name: 'Claytronics Production',
  outputs: { claytronics: 40 },
  inputs: { siliconwafers: 200, microchips: 100, energycells: 50 },
  buildCost: { hullparts: 2851, claytronics: 1140, energycells: 249 },
  buildTime: 3600,
})

const modulesMap: Record<string, X4Module> = {
  module_hullparts: hullpartsModule,
  module_claytronics: claytronicsModule,
}

const waresMap: Record<string, X4Ware> = {
  hullparts: hullpartsWare,
  claytronics: claytronicsWare,
  advancedcomposites: advancedWare,
}

describe('computeFlowPlanLines', () => {
  it('computes DAG node modules from upstream demand', () => {
    // Setup: C needs hullparts. L1 produces hullparts.
    // L1 has no self-bootstrap (buildCost wares are different from trackedWares)
    const node1: BuildFlowPlanLine = {
      lineGroupId: 'L1',
      lineName: 'L1',
      trackedWares: new Set(['hullparts']),
      modules: [],
      moduleIds: [],
      isSelfBootstrap: false,
      netProduction: {},
    }

    const cBuildCostRates = { hullparts: 500 }  // C needs 500 hullparts/h

    const graph: BuildFlowPlanGraph = {
      nodes: new Map([['L1', node1]]),
      edges: [
        { fromLineKey: ROOT_BUILD_COST_KEY, toLineKey: 'L1', wareId: 'hullparts', sourceLabel: 'target line buildCost' },
      ],
      sccGroups: [],
      targetModules: [{ id: 'module_claytronics', count: 1 }],
      targetBuildCostRates: cBuildCostRates,
    }

    computeFlowPlanLines(graph, modulesMap, waresMap, DEFAULT_SETTINGS, [])

    const computedNode = graph.nodes.get('L1')!
    // Should have modules to produce ~500 hullparts/h
    expect(computedNode.modules.length).toBeGreaterThan(0)
    // At least one hullpart module
    const hpMod = computedNode.modules.find(m => m.id === 'module_hullparts')
    expect(hpMod).toBeDefined()
    expect(hpMod!.count).toBeGreaterThanOrEqual(5) // 5 modules × 100 = 500/h
  })
})

describe('makeSchemes', () => {
  it('outputs schemes in leaf→root order', () => {
    const node1: BuildFlowPlanLine = {
      lineGroupId: 'L1',
      lineName: 'Hull Parts Line',
      trackedWares: new Set(['hullparts']),
      modules: [{ id: 'module_hullparts', count: 5 }],
      moduleIds: ['module_hullparts'],
      isSelfBootstrap: false,
      netProduction: { hullparts: 500 },
    }

    const cModules: SavedModule[] = [{ id: 'module_claytronics', count: 1 }]
    const cBuildCostRates = { hullparts: 500 }

    const graph: BuildFlowPlanGraph = {
      nodes: new Map([['L1', node1]]),
      edges: [
        { fromLineKey: ROOT_BUILD_COST_KEY, toLineKey: 'L1', wareId: 'hullparts', sourceLabel: 'target line buildCost' },
      ],
      sccGroups: [],
      targetModules: cModules,
      targetBuildCostRates: cBuildCostRates,
    }

    const schemes = makeSchemes(graph, modulesMap, waresMap, DEFAULT_SETTINGS)

    // Leaf→root: L1 first, then C
    expect(schemes.length).toBe(2)
    expect(schemes[0]!.label).toBe('Hull Parts Line')
    expect(schemes[1]!.label).toBe('目标产线')
    expect(schemes[0]!.modules.length).toBeGreaterThan(0)
  })
})
