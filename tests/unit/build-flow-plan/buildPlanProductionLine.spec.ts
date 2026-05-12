import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveBuildFlowView, computeVirtualEdges } from '@/store/logic/buildFlowDerivation'
import { hydrateSavedFlowGroups } from '@/store/logic/hydrateSavedFlowGroups'
import { analyzeShipBlueprintBuild, DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER } from '@/store/logic/analyzeShipBlueprintBuild'
import {
  createBuildFlowPlanPreview,
  computeBuildFlowPlan,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'
import type { BuildFlowPlanView, BuildGoal } from '@/types/build-plan'
import type {
  BuildFlowAssignment,
  ProductionLineGroup,
  SavedFlowGroup,
  SavedShipBlueprintsState,
  ShipBlueprint,
  X4Consumable,
  X4Drone,
  X4Equipment,
  X4Missile,
  X4Module,
  X4Ship,
  X4Ware,
} from '@/types/x4'

const WARE_DATA: X4Ware[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD_DATA: X4Module[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))
const SHIP_DATA: X4Ship[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/ships.json'), 'utf-8'))
const EQUIP_DATA: X4Equipment[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'), 'utf-8'))
const CONSUMABLE_DATA: X4Consumable[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'), 'utf-8'))
const DRONE_DATA: X4Drone[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/drones.json'), 'utf-8'))
const MISSILE_DATA: X4Missile[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'), 'utf-8'))

const waresMap: Record<string, X4Ware> = {}
for (const ware of WARE_DATA) waresMap[ware.id] = ware

const modulesMap: Record<string, X4Module> = {}
for (const module of MOD_DATA) modulesMap[module.id] = module

const shipsMap = new Map<string, X4Ship>()
for (const ship of SHIP_DATA) shipsMap.set(ship.id, ship)

const equipmentMap = new Map<string, X4Equipment>()
for (const equipment of EQUIP_DATA) equipmentMap.set(equipment.id, equipment)

const consumablesMap = new Map<string, X4Consumable>()
for (const consumable of CONSUMABLE_DATA) consumablesMap.set(consumable.id, consumable)

const dronesMap = new Map<string, X4Drone>()
for (const drone of DRONE_DATA) dronesMap.set(drone.id, drone)

const missilesMap = new Map<string, X4Missile>()
for (const missile of MISSILE_DATA) missilesMap.set(missile.id, missile)

const wareMap = new Map<string, X4Ware>()
for (const ware of WARE_DATA) wareMap.set(ware.id, ware)

const modulesByOutputMap: Record<string, X4Module[]> = {}
for (const module of MOD_DATA) {
  if (!module.outputs) continue
  for (const wareId of Object.keys(module.outputs)) {
    if (!modulesByOutputMap[wareId]) modulesByOutputMap[wareId] = []
    modulesByOutputMap[wareId]!.push(module)
  }
}

function buildBlueprintMap(state: SavedShipBlueprintsState | undefined): Map<string, ShipBlueprint> {
  const map = new Map<string, ShipBlueprint>()
  for (const bucket of state?.ships || []) {
    for (const blueprint of bucket.blueprints || []) {
      map.set(blueprint.id, blueprint)
    }
  }
  return map
}

function expandFleetGoals(goals: BuildGoal[], blueprintMap: Map<string, ShipBlueprint>): BuildGoal[] {
  const expanded: BuildGoal[] = []
  for (const goal of goals) {
    if (goal.type !== 'fleet') {
      expanded.push(goal)
      continue
    }

    const totalByWare: Record<string, number> = {}
    for (const entry of goal.entries) {
      const blueprint = blueprintMap.get(entry.blueprintId)
      const ship = shipsMap.get(blueprint?.shipId || entry.shipId)
      if (!ship || !blueprint) continue

      const analysis = analyzeShipBlueprintBuild({
        blueprint,
        ship,
        equipments: equipmentMap,
        wares: wareMap,
        consumables: consumablesMap,
        drones: dronesMap,
        missiles: missilesMap,
        priceMultiplier: DEFAULT_SHIP_BUILD_PRICE_MULTIPLIER,
      })
      for (const item of analysis.summaryItems) {
        const { wareId, count: qty } = item
        totalByWare[wareId] = (totalByWare[wareId] || 0) + qty * entry.quantity
      }
    }

    for (const [wareId, totalQty] of Object.entries(totalByWare)) {
      expanded.push({
        type: 'production-rate',
        wareId,
        ratePerHour: Math.ceil(totalQty / goal.buildTime * 3600),
      })
    }
  }
  return expanded
}

function buildGroupsAndFlowView(savedGroups: SavedFlowGroup[], rawAssignments: any[], archivedGroupIds: string[]) {
  const groups = hydrateSavedFlowGroups(savedGroups, {
    waresMap,
    modulesMap,
    modulesByOutputMap,
    findModuleForWare: (wareId: string, lineage: string) => {
      const modules = modulesByOutputMap[wareId] || []
      const exact = modules.find(module => module.race === lineage || module.method === lineage)
      return exact || modules[0] || null
    },
  })

  const assignments: BuildFlowAssignment[] = rawAssignments.map((assignment: any) => ({
    wareId: assignment.wareId,
    sourceGroupId: assignment.sourceGroupId,
    targetType: assignment.targetType || 'output-build-material',
    targetGroupId: assignment.targetGroupId,
  }))

  const groupDisplayNames = new Map<string, string>()
  for (const group of groups) groupDisplayNames.set(group.id, group.name || group.id)
  const getWareLabel = (wareId: string): string => waresMap[wareId]?.name || wareId

  const derived = deriveBuildFlowView(groups, modulesMap, groupDisplayNames, getWareLabel, archivedGroupIds)
  const virtualEdges = computeVirtualEdges(derived.buildFlowGroups, assignments, archivedGroupIds, groups)
  const buildFlowView: BuildFlowPlanView = {
    buildFlowGroups: derived.buildFlowGroups,
    assignments,
    virtualEdges,
  }

  return { groups, buildFlowView }
}

function loadPlanData(index: number): {
  goals: BuildGoal[]
  groups: ProductionLineGroup[]
  buildFlowView: BuildFlowPlanView
} {
  const exportRaw = JSON.parse(readFileSync(resolve('tests/fixtures/export.json'), 'utf-8'))
  const data = exportRaw.data || exportRaw
  const bpState = data.x4_build_plan_goals
  const lfState = data.x4_logic_flow_plans
  const shipBlueprintState: SavedShipBlueprintsState | undefined = data.x4_ship_blueprints

  const selectedBp = bpState.list[index]
  const goals = expandFleetGoals(selectedBp.buildGoals || [], buildBlueprintMap(shipBlueprintState))
  const logicFlowPlanId: string | undefined = selectedBp.logicFlowPlanId
  const lfPlan = (lfState.list || []).find((plan: any) => plan.id === logicFlowPlanId)
  const { groups, buildFlowView } = buildGroupsAndFlowView(
    lfPlan.groups || [],
    lfPlan.buildFlow?.assignments || [],
    lfPlan.buildFlow?.archivedGroupIds || [],
  )

  return { goals, groups, buildFlowView }
}

describe('buildPlanProductionLine regression', () => {
  it('keeps manual target rates when a ware is both build-material and target', () => {
    const { goals, groups, buildFlowView } = loadPlanData(2)
    const preview = createBuildFlowPlanPreview(
      goals,
      groups,
      buildFlowView,
      modulesMap,
      waresMap,
      DEFAULT_BUILD_PLAN_SETTINGS,
      true,
    )

    expect(preview).not.toBeNull()

    const result = computeBuildFlowPlan({
      preview: preview!,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      settings: DEFAULT_BUILD_PLAN_SETTINGS,
    })

    const terranLine = result.lines.find(line => line.groupName === '地球人')
    expect(terranLine).toBeDefined()

    const computronicModule = terranLine!.allModules.find(module => module.id === 'module_ter_prod_computronicsubstrate_01')
    const siliconCarbideModule = terranLine!.allModules.find(module => module.id === 'module_ter_prod_siliconcarbide_01')

    expect(computronicModule?.count).toBe(32)
    expect(siliconCarbideModule?.count).toBe(25)
  })

  it('keeps both build-material and production responsibilities for the same ware', () => {
    const { goals, groups, buildFlowView } = loadPlanData(2)
    const preview = createBuildFlowPlanPreview(
      goals,
      groups,
      buildFlowView,
      modulesMap,
      waresMap,
      DEFAULT_BUILD_PLAN_SETTINGS,
      true,
    )

    expect(preview).not.toBeNull()

    const result = computeBuildFlowPlan({
      preview: preview!,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      settings: DEFAULT_BUILD_PLAN_SETTINGS,
    })

    const methaneOreLine = result.lines.find(line => line.groupName === '烷矿')
    expect(methaneOreLine).toBeDefined()

    const hullPartsItem = methaneOreLine!.mergedItems.find(
      item => item.kind === 'derived' && item.wareId === 'hullparts',
    )
    expect(hullPartsItem).toBeDefined()
    expect(hullPartsItem?.kind).toBe('derived')

    if (hullPartsItem?.kind === 'derived') {
      expect(hullPartsItem.derived).toContain('build-material')
      expect(hullPartsItem.derived).toContain('production')
    }

    expect(methaneOreLine!.targetRates.hullparts).toBeGreaterThan(900)
  })

  it('does not report production demand as aggregate build-material demand', () => {
    const { goals, groups, buildFlowView } = loadPlanData(2)
    const preview = createBuildFlowPlanPreview(
      goals,
      groups,
      buildFlowView,
      modulesMap,
      waresMap,
      DEFAULT_BUILD_PLAN_SETTINGS,
      true,
    )

    expect(preview).not.toBeNull()

    computeBuildFlowPlan({
      preview: preview!,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      settings: DEFAULT_BUILD_PLAN_SETTINGS,
    })

    const methaneHeliumNode = preview!.graph?.nodes.get(
      preview!.lines.find(line => line.groupName === '烷氦')?.groupId || '',
    )
    expect(methaneHeliumNode).toBeDefined()

    const demandAnalysis = methaneHeliumNode!.demandAnalysis
    expect(demandAnalysis).toBeDefined()
    expect(demandAnalysis?.aggregateRates.quantumtubes || 0).toBe(0)
    expect(demandAnalysis?.gapRates.quantumtubes || 0).toBeGreaterThan(0)
  })

  it('does not recursively overbuild direct target wares', () => {
    const { goals, groups, buildFlowView } = loadPlanData(2)
    const preview = createBuildFlowPlanPreview(
      goals,
      groups,
      buildFlowView,
      modulesMap,
      waresMap,
      DEFAULT_BUILD_PLAN_SETTINGS,
      true,
    )

    expect(preview).not.toBeNull()

    const result = computeBuildFlowPlan({
      preview: preview!,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      settings: DEFAULT_BUILD_PLAN_SETTINGS,
    })

    const methaneOreLine = result.lines.find(line => line.groupName === '烷矿')
    expect(methaneOreLine).toBeDefined()

    const energyModule = methaneOreLine!.allModules.find(module => module.id === 'module_gen_prod_energycells_01')
    expect(energyModule?.count).toBe(10)
    expect(methaneOreLine!.allModules.find(module => module.id === 'module_gen_prod_hullparts_01')?.count).toBe(4)
    expect(methaneOreLine!.allModules.find(module => module.id === 'module_gen_prod_advancedcomposites_01')?.count).toBe(4)
    expect(methaneOreLine!.allModules.find(module => module.id === 'module_gen_prod_graphene_01')?.count).toBe(4)
    expect(methaneOreLine!.allModules.find(module => module.id === 'module_gen_prod_refinedmetals_01')?.count).toBe(5)
  })
})
