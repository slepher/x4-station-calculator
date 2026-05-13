import { describe, it, expect } from 'vitest'
import { bootstrapFillForLine, mergeModules } from '@/store/logic/calculateBuildFlowPlan'
import type { BuildRateSource, BuildGroup } from '@/types/build-plan'
import type { X4Module, X4Ware, StationSettings } from '@/types/x4'

const DEFAULT_SETTINGS: StationSettings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false,
}

function makeModule(overrides: Partial<X4Module> & { id: string }): X4Module {
  return {
    name: overrides.id, nameId: '', type: 'production', method: 'default',
    race: 'argon', dlc_tag: 'base', tier: 1, group: 'hightech',
    macroId: '', isPlayerBlueprint: true, buildTime: 3600, buildCost: {},
    inputs: {}, outputs: {}, workforceCapacity: 0, workforceNeeded: 0,
    ...overrides,
  }
}

function makeWare(overrides: Partial<X4Ware> & { id: string }): X4Ware {
  return {
    name: overrides.id, nameId: '', dlc_tag: 'base', transport: 'container',
    volume: 1, price: 100, minPrice: 50, maxPrice: 200, tier: 1, group: 'hightech',
    ...overrides,
  }
}

const hullpartsMod = makeModule({
  id: 'module_hullparts', name: 'Hull Part Production',
  outputs: { hullparts: 100 }, inputs: { energycells: 50 },
  buildCost: { advancedcomposites: 100 }, buildTime: 3600,
})

const claytronicsMod = makeModule({
  id: 'module_claytronics', name: 'Claytronics Production',
  outputs: { claytronics: 40 }, inputs: { energycells: 50 },
  buildCost: { hullparts: 2851, claytronics: 1140 }, buildTime: 3600,
})

const modulesMap: Record<string, X4Module> = {
  module_hullparts: hullpartsMod,
  module_claytronics: claytronicsMod,
}

const waresMap: Record<string, X4Ware> = {
  hullparts: makeWare({ id: 'hullparts', name: 'Hull Parts' }),
  claytronics: makeWare({ id: 'claytronics', name: 'Claytronics' }),
  advancedcomposites: makeWare({ id: 'advancedcomposites', name: 'Advanced Composites' }),
}

describe('bootstrapFillForLine', () => {
  it('generates modules in one shot for a simple demand', () => {
    // C buildCost has hullparts qty=500 over 3600s → rate=500/h
    // L1 produces hullparts (100/cycle=100/h), no self-bootstrap
    const sources: BuildRateSource[] = [
      { label: 'C buildCost', rates: { hullparts: 500 }, materials: { hullparts: 500, advancedcomposites: 300 } },
    ]

    const groups = bootstrapFillForLine(sources, [], DEFAULT_SETTINGS, modulesMap, waresMap, {}, [], new Set(), new Set(['hullparts']))
    const allMods = mergeModules(groups.flatMap(g => g.modules))

    const hpMod = allMods.find(m => m.id === 'module_hullparts')
    expect(hpMod).toBeDefined()
    expect(hpMod!.count).toBeGreaterThanOrEqual(5)
  })

  it('loops when self-bootstrap creates new demand', () => {
    // C buildCost has claytronics qty=80 over 3600s → rate=80/h
    // claytronics module produces 40/cycle=40/h AND needs claytronics in buildCost
    // After first pass (2 modules), build cost creates new claytronics demand → loop
    const sources: BuildRateSource[] = [
      { label: 'C buildCost', rates: { claytronics: 80 }, materials: { hullparts: 200, claytronics: 80 } },
    ]

    const groups = bootstrapFillForLine(sources, [], DEFAULT_SETTINGS, modulesMap, waresMap, {}, [], new Set(), new Set(['claytronics']))
    const allMods = mergeModules(groups.flatMap(g => g.modules))

    const ctMod = allMods.find(m => m.id === 'module_claytronics')
    expect(ctMod).toBeDefined()
    // 80/h demand + self-bootstrap build cost claytronics → more than 2
    expect(ctMod!.count).toBeGreaterThanOrEqual(2)
  })
})
