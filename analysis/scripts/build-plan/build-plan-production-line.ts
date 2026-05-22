import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveBuildFlowView, computeVirtualEdges } from '@/store/logic/buildFlowDerivation'
import { hydrateSavedFlowGroups } from '@/store/logic/hydrateSavedFlowGroups'
import {
  createBuildFlowPlanPreview,
  computeBuildFlowPlan,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'
import { ROOT_BUILD_COST_KEY } from '@/store/logic/buildFlowPlanGraph'
import { resolveBlueprintMaterialCost } from '@/store/logic/resolveBlueprintMaterialCost'
import { buildStepsScheme } from '@/components/empire/presenters/buildPlanStepsLogic'
import {
  parseBuildPlanProductionLineArgs,
  renderBuildPlanProductionLineHelp,
} from './buildPlanProductionLineArgs'
import type { BuildFlowPlanView, BuildGoal, BuildSchemeGroup, PreviewItem, ProductionLineAllocation } from '@/types/build-plan'
import type { X4Module, X4Ware, X4Ship, X4Equipment, X4Consumable, X4Drone, X4Missile, ProductionLineGroup, SavedFlowGroup, BuildFlowAssignment, ShipBlueprint, SavedShipBlueprintsState } from '@/types/x4'

const WARE_DATA: X4Ware[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD_DATA: X4Module[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))
const SHIP_DATA: X4Ship[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/ships.json'), 'utf-8'))
const EQUIP_DATA: X4Equipment[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'), 'utf-8'))
const CONSUMABLE_DATA: X4Consumable[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/consumables.json'), 'utf-8'))
const DRONE_DATA: X4Drone[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/drones.json'), 'utf-8'))
const MISSILE_DATA: X4Missile[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'), 'utf-8'))

const waresMap: Record<string, X4Ware> = {}
for (const w of WARE_DATA) waresMap[w.id] = w

const modulesMap: Record<string, X4Module> = {}
for (const m of MOD_DATA) modulesMap[m.id] = m

const shipsMap = new Map<string, X4Ship>()
for (const s of SHIP_DATA) shipsMap.set(s.id, s)

const equipmentMap = new Map<string, X4Equipment>()
for (const e of EQUIP_DATA) equipmentMap.set(e.id, e)

const consumablesMap = new Map<string, X4Consumable>()
for (const c of CONSUMABLE_DATA) consumablesMap.set(c.id, c)

const dronesMap = new Map<string, X4Drone>()
for (const d of DRONE_DATA) dronesMap.set(d.id, d)

const missilesMap = new Map<string, X4Missile>()
for (const m of MISSILE_DATA) missilesMap.set(m.id, m)

const modulesByOutputMap: Record<string, X4Module[]> = {}
for (const mod of MOD_DATA) {
  if (!mod.outputs) continue
  for (const w of Object.keys(mod.outputs)) {
    if (!modulesByOutputMap[w]) modulesByOutputMap[w] = []
    modulesByOutputMap[w]!.push(mod)
  }
}

const settings = {
  sunlight: 100, useHQ: false, manualWorkforce: 0, workforcePercent: 100,
  workforceAuto: true, considerWorkforceForAutoFill: false, supplyWorkforceBonus: false,
  buyMultiplier: 0.5, sellMultiplier: 0.5, minersEnabled: true, internalSupply: true,
  showEmpireGaps: false, racePreference: 'argon', resourceBufferHours: 1,
  primaryProductBufferHours: 12, secondaryProductBufferHours: 2, transportMinutes: 30,
  transportShipCapacity: 62000, enforceDlcActivation: false,
}

function displayGraphKey(key: string): string {
  return key === ROOT_BUILD_COST_KEY ? 'root' : key
}

function modName(id: string): string { const m = modulesMap[id]; return m?.name || id }
function wareName(id: string): string { const w = waresMap[id]; return w?.name || id }
function fmtCr(n: number): string { return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}` }
function fmtH(s: number): string { return `${(s / 3600).toFixed(2)}h` }

function mergeSavedModules(modules: Array<{ id: string; count: number }>): Array<{ id: string; count: number }> {
  const counts = new Map<string, number>()
  for (const module of modules) {
    counts.set(module.id, (counts.get(module.id) || 0) + module.count)
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count }))
}

function calculateNetProductionForModules(modules: Array<{ id: string; count: number }>): Record<string, number> {
  const state: Record<string, number> = {}
  for (const item of modules) {
    const mod = modulesMap[item.id]
    if (!mod) continue
    const eff = settings.considerWorkforceForAutoFill ? 1.3 : 1.0
    for (const [ware, val] of Object.entries(mod.outputs)) {
      let sf = 1.0
      if (ware === 'energycells') sf = settings.sunlight / 100.0
      state[ware] = (state[ware] || 0) + item.count * (val as number) * eff * sf
    }
    for (const [ware, val] of Object.entries(mod.inputs)) {
      state[ware] = (state[ware] || 0) - item.count * (val as number)
    }
  }
  return state
}

function getBuildMaterialTargetRateEntries(scheme: BuildScheme): Array<[string, number]> {
  const rates = scheme.stepTargetRates || scheme.targetRates
  return Object.entries(rates)
    .filter(([, rate]) => rate > 0)
    .filter(([wareId]) => wareId !== 'energycells')
}

function formatPreviewLineTargets(items: PreviewItem[]): string[] {
  const labels: string[] = []
  const derivedByWare = new Map<string, Set<string>>()
  const requiredByWare = new Map<string, Set<string>>()

  for (const item of items) {
    if (item.kind === 'derived') {
      for (const target of item.targets || []) {
        if (target.type === 'build-module') {
          labels.push(`${modName(item.moduleId)} ×${target.count || 1}`)
          continue
        }
        if (target.type === 'production-rate' && item.wareId) {
          labels.push(`${wareName(item.wareId)} ${(target.ratePerHour || 0).toFixed(1)}/h`)
          continue
        }
      }

      if (item.wareId) {
        for (const tag of item.derived || []) {
          if (tag === 'target') continue
          const tags = derivedByWare.get(item.wareId) || new Set<string>()
          tags.add(tag)
          derivedByWare.set(item.wareId, tags)
        }
      }
      continue
    }

    for (const tag of item.required || []) {
      const tags = requiredByWare.get(item.wareId) || new Set<string>()
      tags.add(tag)
      requiredByWare.set(item.wareId, tags)
    }
  }

  for (const [wareId, tags] of derivedByWare) {
    labels.push(`${wareName(wareId)} { derived: [${[...tags].join(', ')}] }`)
  }

  for (const [wareId, tags] of requiredByWare) {
    labels.push(`${wareName(wareId)} { required: [${[...tags].join(', ')}] }`)
  }

  return [...new Set(labels)]
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
    if (goal.type === 'fleet') {
      const totalByWare: Record<string, number> = {}
      for (const entry of goal.entries) {
        const blueprint = blueprintMap.get(entry.blueprintId)
        const ship = shipsMap.get(blueprint?.shipId || entry.shipId)
        if (!ship) continue
        if (!blueprint) continue
        const result = resolveBlueprintMaterialCost(blueprint, ship, equipmentMap, consumablesMap, dronesMap, missilesMap)
        for (const [wareId, qty] of Object.entries(result.materials)) {
          totalByWare[wareId] = (totalByWare[wareId] || 0) + qty * entry.quantity
        }
      }
      for (const [wareId, totalQty] of Object.entries(totalByWare)) {
        expanded.push({ type: 'production-rate', wareId, ratePerHour: Math.ceil(totalQty / goal.buildTime * 3600) })
      }
    } else {
      expanded.push(goal)
    }
  }
  return expanded
}

function printModuleDetailsSection(
  title: string,
  moduleDetails: Array<{
    moduleId: string
    count: number
    buildTime: number
    materials: Record<string, number>
  }>,
) {
  if (moduleDetails.length === 0) return
  console.log(`     ├─ ${title}:`)
  for (const md of moduleDetails) {
    const timeStr = md.buildTime > 0 ? `  (建筑 ${md.buildTime}s × ${md.count} = ${md.buildTime * md.count}s)` : ''
    console.log(`     │   ${modName(md.moduleId)} ×${md.count}${timeStr}`)
    const matEntries = Object.entries(md.materials).filter(([, qty]) => qty > 0)
    if (matEntries.length > 0) {
      const matStr = matEntries.map(([w, qty]) => `${wareName(w)} ${Math.round(qty)}`).join(', ')
      console.log(`     │     BuildCost: ${matStr}`)
    }
  }
}

function resolveModuleId(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const m of MOD_DATA) {
    if (m.name.toLowerCase().replace(/\s+/g, '') === key) return m.id
  }
  const partial = MOD_DATA.find((m: any) => m.name.toLowerCase().includes(name.toLowerCase()))
  return partial?.id || null
}

function resolveWareId(name: string): string | null {
  const key = name.toLowerCase().replace(/\s+/g, '')
  for (const w of WARE_DATA) {
    if (w.name.toLowerCase().replace(/\s+/g, '') === key) return w.id
  }
  const partial = WARE_DATA.find((w: any) => w.name.toLowerCase().includes(name.toLowerCase()))
  return partial?.id || null
}

function showHelp() {
  console.log(renderBuildPlanProductionLineHelp())
  process.exit(0)
}
const cliArgs = parseBuildPlanProductionLineArgs(process.argv.slice(2))
if (cliArgs.help) showHelp()

interface PlanData {
  goals: BuildGoal[]
  selectedPlanName: string
  groups: ProductionLineGroup[]
  buildFlowView: BuildFlowPlanView
  buildMaterialPlanningEnabled: boolean
}

function buildGroupsAndFlowView(savedGroups: SavedFlowGroup[], rawAssignments: any[], archivedGroupIds: string[]) {
  const groups = hydrateSavedFlowGroups(savedGroups, {
    waresMap,
    modulesMap,
    modulesByOutputMap,
    findModuleForWare: (wareId: string, lineage: string) => {
      const modules = modulesByOutputMap[wareId] || []
      const exact = modules.find(mod => mod.race === lineage || mod.method === lineage)
      return exact || modules[0] || null
    },
  })
  const assignments: BuildFlowAssignment[] = rawAssignments.map((a: any) => ({
    wareId: a.wareId, sourceGroupId: a.sourceGroupId, targetType: a.targetType || 'output-build-material', targetGroupId: a.targetGroupId,
  }))

  const groupDisplayNames = new Map<string, string>()
  for (const g of groups) groupDisplayNames.set(g.id, g.name || g.id)
  const getWareLabel = (wareId: string): string => waresMap[wareId]?.name || wareId

  const derived = deriveBuildFlowView(groups, modulesMap, groupDisplayNames, getWareLabel, archivedGroupIds)
  const virtualEdges = computeVirtualEdges(derived.buildFlowGroups, assignments, archivedGroupIds, groups)
  const buildFlowView: BuildFlowPlanView = { buildFlowGroups: derived.buildFlowGroups, assignments, virtualEdges }
  return { groups, buildFlowView }
}

function loadFromExport(fileArg: string | undefined, planIndex: number, buildMaterialEnabled: boolean): PlanData {
  const filePath = fileArg || 'tests/fixtures/export.json'
  const exportRaw = JSON.parse(readFileSync(resolve(filePath), 'utf-8'))
  const data = exportRaw.data || exportRaw

  const bpState = data.x4_build_plan_goals
  const lfState = data.x4_logic_flow_plans
  const shipBlueprintState: SavedShipBlueprintsState | undefined = data.x4_ship_blueprints

  if (!bpState?.list?.length) { console.error('No build-plan goals found in export'); process.exit(1) }

  const bpList: any[] = bpState.list
  const selectedBp = bpList[planIndex]
  if (!selectedBp) { console.error(`Build-plan index ${planIndex} not found (${bpList.length} plans)`); process.exit(1) }

  const rawGoals: BuildGoal[] = selectedBp.buildGoals || []
  const goals = expandFleetGoals(rawGoals, buildBlueprintMap(shipBlueprintState))
  const logicFlowPlanId: string | undefined = selectedBp.logicFlowPlanId

  const lfList: any[] = lfState?.list || []
  const lfPlan = logicFlowPlanId
    ? lfList.find((p: any) => p.id === logicFlowPlanId)
    : lfList[0]

  if (!lfPlan) { console.error('No matching logic-flow plan found'); process.exit(1) }

  const savedGroups: SavedFlowGroup[] = lfPlan.groups || []
  const rawAssignments: any[] = lfPlan.buildFlow?.assignments || []
  const archivedGroupIds: string[] = lfPlan.buildFlow?.archivedGroupIds || []
  const { groups, buildFlowView } = buildGroupsAndFlowView(savedGroups, rawAssignments, archivedGroupIds)

  return {
    goals,
    selectedPlanName: `${selectedBp.name || '(unnamed)'} [flow: ${lfPlan.name || '(unnamed)'}]`,
    groups,
    buildFlowView,
    buildMaterialPlanningEnabled: buildMaterialEnabled,
  }
}

function loadLegacy(buildMaterialEnabled: boolean): PlanData | null {
  const moduleArg = cliArgs.module
  const wareArg = cliArgs.ware
  const flowArg = cliArgs.flow
  if (!moduleArg && !wareArg && !flowArg) return null

  const goals: BuildGoal[] = []
  if (moduleArg) {
    for (const part of moduleArg.split(',')) {
      const [name, countStr] = part.split('*')
      const modId = resolveModuleId(name.trim())
      if (!modId) { console.error(`Module not found: ${name.trim()}`); process.exit(1) }
      goals.push({ type: 'build-module', moduleId: modId, count: parseInt(countStr || '1') })
    }
  }
  if (wareArg) {
    for (const part of wareArg.split(',')) {
      const [name, rateStr] = part.split('*')
      const wareId = resolveWareId(name.trim())
      if (!wareId) { console.error(`Ware not found: ${name.trim()}`); process.exit(1) }
      goals.push({ type: 'production-rate', wareId, ratePerHour: parseFloat(rateStr || '1000') })
    }
  }
  if (goals.length === 0) goals.push({ type: 'build-module', moduleId: 'module_gen_prod_missilecomponents_01', count: 5 })

  const flowPath = flowArg || 'tests/fixtures/logic-flow-module.json'
  const flowIndex = cliArgs.index

  const fixtureRaw = JSON.parse(readFileSync(resolve(flowPath), 'utf-8'))
  const plansList = fixtureRaw.list || []
  if (plansList.length === 0) { console.error('No flow plans found'); process.exit(1) }
  const selectedPlan = plansList[flowIndex]
  if (!selectedPlan) { console.error(`Plan index ${flowIndex} not found`); process.exit(1) }

  const savedGroups: SavedFlowGroup[] = selectedPlan.groups || []
  const rawAssignments: any[] = selectedPlan.buildFlow?.assignments || []
  const archivedGroupIds: string[] = selectedPlan.buildFlow?.archivedGroupIds || []
  const { groups, buildFlowView } = buildGroupsAndFlowView(savedGroups, rawAssignments, archivedGroupIds)

  return {
    goals,
    selectedPlanName: selectedPlan.name || '(unnamed)',
    groups,
    buildFlowView,
    buildMaterialPlanningEnabled: buildMaterialEnabled,
  }
}

const fileArg = cliArgs.file
const planIndex = cliArgs.index
const jsonMode = cliArgs.json
const useJson = jsonMode !== undefined && jsonMode !== false
const useCompactJson = jsonMode === 'compact'
const buildMaterialPlanningEnabled = !cliArgs.noBuildMaterial

const planData = loadLegacy(buildMaterialPlanningEnabled) ?? loadFromExport(fileArg, planIndex, buildMaterialPlanningEnabled)
const { goals, selectedPlanName, groups, buildFlowView, buildMaterialPlanningEnabled: bmEnabled } = planData

const preview = createBuildFlowPlanPreview(
  goals,
  groups,
  buildFlowView,
  modulesMap,
  waresMap,
  DEFAULT_BUILD_PLAN_SETTINGS,
  bmEnabled,
)
if (!preview) {
  console.error('Failed to compute build-flow preview')
  process.exit(1)
}

const savedLog = console.log
if (useJson) console.log = () => {}
const result = computeBuildFlowPlan({
  preview,
  modulesMap,
  waresMap,
  modulesByOutputMap,
  settings: DEFAULT_BUILD_PLAN_SETTINGS,
})
if (useJson) console.log = savedLog

const graph = preview.graph
const schemeGroups = result.schemeGroups
const lineAllocations: ProductionLineAllocation[] = preview.lines.map(line => ({
  groupId: line.groupId,
  groupName: line.groupName,
  isUnmatched: line.isUnmatched,
  lineage: line.lineage,
  goals: line.items.flatMap(item => {
    if (item.kind === 'derived') {
      const targetGoals = (item.targets || []).flatMap(target => {
        if (target.type === 'build-module') {
          return [{
            type: 'build-module' as const,
            moduleId: item.moduleId,
            count: target.count || 1,
          }]
        }
        if (item.wareId) {
          return [{
            type: 'production-rate' as const,
            wareId: item.wareId,
            ratePerHour: target.ratePerHour || 0,
          }]
        }
        return []
      })
      if (targetGoals.length > 0) return targetGoals
      if (!item.wareId) return []
      if (item.derived.includes('production')) {
        return [{
          type: 'derived-production' as const,
          wareId: item.wareId,
          ratePerHour: 0,
        }]
      }
      if (item.derived.includes('build-material')) {
        return [{
          type: 'derived-build-material' as const,
          wareId: item.wareId,
          ratePerHour: 0,
        }]
      }
      return []
    }
    return [{
      type: 'required-production' as const,
      wareId: item.wareId,
      ratePerHour: 0,
    }]
  }),
}))

// ---- Output ----

if (useJson) {
  const groupOutput = (group: BuildSchemeGroup) => ({
    groupType: group.groupType,
    groupLabel: group.groupLabel,
    schemes: group.schemes.map(s => ({
      label: s.label,
      description: s.description,
      purposeModules: s.purposeModules?.map(w => ({ wareId: w, wareName: wareName(w) })),
      modules: s.modules.map(m => ({ id: m.id, name: modName(m.id), count: m.count })),
      targetRates: s.targetRates,
      netProduction: Object.fromEntries(Object.entries(s.netProduction).filter(([, v]) => Math.abs(v) > 0.01)),
      buildMaterialTotals: s.buildMaterialTotals,
      isFeasible: s.isFeasible,
      moduleSummariesCount: s.moduleSummaries?.length || 0,
    })),
  })

  if (useCompactJson) {
    const output = {
      goals: goals.map(g => {
        if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
        return `${wareName(g.wareId)} ${g.ratePerHour}/h`
      }),
      buildMaterialPlanningEnabled,
      schemeGroups: schemeGroups.map(groupOutput),
      dependencyGraph: graph
        ? {
            nodes: [...graph.nodes.entries()].map(([id, node]) => ({
              id: id.slice(0, 8),
              lineName: node.lineName,
              trackedWares: [...node.trackedWares],
            })),
            edges: graph.edges.map(e => ({
              from: displayGraphKey(e.fromLineKey).slice(0, 8),
              to: e.toLineKey.slice(0, 8),
              wareId: e.wareId,
              label: e.sourceLabel,
            })),
            sccGroups: graph.sccGroups.map(scc => scc.map(id => id.slice(0, 8))),
          }
        : null,
    }
    console.log(JSON.stringify(output, null, 2))
  } else {
    const output = {
      goals: goals.map(g => ({
        type: g.type,
        ...(g.type === 'build-module' ? { moduleId: g.moduleId, name: modName(g.moduleId), count: g.count } : {}),
        ...(g.type === 'production-rate' ? { wareId: g.wareId, name: wareName(g.wareId), ratePerHour: g.ratePerHour } : {}),
      })),
      buildMaterialPlanningEnabled,
      schemeGroups: schemeGroups.map(groupOutput),
      dependencyGraph: graph
        ? {
            nodes: [...graph.nodes.entries()].map(([id, node]) => ({
              lineGroupId: id, lineName: node.lineName,
              trackedWares: [...node.trackedWares].map(w => ({ wareId: w, wareName: wareName(w) })),
              modules: node.modules, isSelfBootstrap: node.isSelfBootstrap,
            })),
            edges: graph.edges.map(e => ({
              fromLineKey: displayGraphKey(e.fromLineKey), toLineKey: e.toLineKey,
              wareId: e.wareId, wareName: wareName(e.wareId), sourceLabel: e.sourceLabel,
            })),
            sccGroups: graph.sccGroups,
            targetModules: graph.targetModules.map(m => ({ id: m.id, name: modName(m.id), count: m.count })),
            targetBuildCostRates: graph.targetBuildCostRates,
          }
        : null,
    }
    console.log(JSON.stringify(output, null, 2))
  }
  process.exit(0)
}

// ---- Human-readable output ----

const sep = '─'.repeat(70)
console.log(sep)
console.log('  Build Plan Production Line — Analysis')
console.log(`  目标: ${goals.map(g => {
  if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
  if (g.type === 'production-rate') return `${wareName(g.wareId)} ${g.ratePerHour}/h`
  return ''
}).join(', ')}`)
console.log(`  方案: ${selectedPlanName}`)
console.log(`  建材产线规划: ${bmEnabled ? '开启' : '关闭'}`)
console.log(sep)

for (const sg of schemeGroups) {
  const emoji = sg.groupType === 'build-material' ? '🔧' : '🏗️'
  console.log(`\n${emoji}  ${sg.groupLabel} (${sg.groupType}):`)
  console.log(`  共 ${sg.schemes.length} 个方案`)

  for (const scheme of sg.schemes) {
    console.log(`\n  ── ${scheme.label}`)
    if (scheme.description) console.log(`     ${scheme.description}`)
    console.log(`     ├─ 目的产物: ${(scheme.purposeModules || []).map(w => wareName(w)).join(', ')}`)
    console.log(`     ├─ 模块总数: ${scheme.modules.length}`)
    console.log(`     ├─ 建造步骤: ${scheme.stepsCount}`)

    // 模块明细
    if (scheme.moduleBuildDetails && scheme.moduleBuildDetails.length > 0) {
      const primarySet = new Set(scheme.primaryModuleIds)
      const primaryModuleDetails = scheme.moduleBuildDetails.filter(md => primarySet.has(md.moduleId))
      const derivedModuleDetails = scheme.moduleBuildDetails.filter(md => !primarySet.has(md.moduleId))
      printModuleDetailsSection('主要模块 × 数量', primaryModuleDetails)
      printModuleDetailsSection('次要模块 × 数量', derivedModuleDetails)
    }

    // 建材汇总
    const buildCost = Object.entries(scheme.buildMaterialTotals)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
    if (buildCost.length > 0) {
      const totalCredits = buildCost.reduce((sum, [w, qty]) => sum + qty * (waresMap[w]?.price || 0), 0)
      const totalQty = buildCost.reduce((sum, [, qty]) => sum + qty, 0)
      const totalTime = scheme.totalModuleBuildTime
      const totalHours = totalTime > 0 ? totalTime / 3600 : 1
      console.log(`     ├─ 建材汇总 (建筑时间 ${totalTime}s = ${totalHours.toFixed(2)}h):`)
      for (const [wareId, qty] of buildCost) {
        const price = waresMap[wareId]?.price || 0
        const rate = totalTime > 0 ? qty / totalHours : 0
        console.log(`     │   ${wareName(wareId).padEnd(24)} ${String(Math.round(qty)).padStart(8)}  ${rate.toFixed(1)}/h  ${(qty * price / 1e6).toFixed(2)}M cr`)
      }
      console.log(`     │   ───────────────────────────────────────────────`)
      console.log(`     │   总数量: ${Math.round(totalQty)}  总价: ${(totalCredits / 1e6).toFixed(2)}M cr`)
    }

    const prodRates = Object.entries(scheme.netProduction)
      .filter(([, rate]) => (rate as number) > 0.01)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
    if (prodRates.length > 0) {
      console.log(`     └─ 净产出速率:`)
      for (const [wareId, rate] of prodRates) {
        console.log(`         ${wareName(wareId)}: ${(rate as number).toFixed(2)}/h`)
      }
    }
  }
}

const allocByGroupId = new Map(lineAllocations.filter(a => a.groupId).map(a => [a.groupId!, a]))
const schemeByLabel = new Map<string, BuildScheme>()
for (const sg of schemeGroups) {
  for (const s of sg.schemes) schemeByLabel.set(s.label, s)
}

if (graph) {
console.log(`\n${sep}`)
console.log('  需求来源与满足率 (新格式):')

for (const [groupId, node] of graph.nodes) {
  const alloc = allocByGroupId.get(groupId)
  const scheme = schemeByLabel.get(node.lineName)
  const tag = node.isSelfBootstrap ? 'SELF-BOOT' : (graph.sccGroups.some(scc => scc.includes(groupId)) ? 'SCC' : 'DAG')
  console.log(`\n  [${tag}] ${node.lineName}`)

  // --- 1. 需求来源明细 (从 node.demandAnalysis 直接读取) ---
  const da = node.demandAnalysis
  if (da && Object.keys(da.perWareSources).length > 0) {
    console.log('  需求来源明细:')
    for (const [wareId, entries] of Object.entries(da.perWareSources)) {
      console.log(`    ${wareName(wareId)}:`)
      for (const e of entries) {
        console.log(`      ${e.label}  ${Math.round(e.qty)} / ${e.seconds}s → ${e.rate.toFixed(1)}/h`)
      }
    }
  }

  // --- 2. 聚合需求 ---
  const aggregateRates = da?.aggregateRates || {}
  if (da || Object.keys(aggregateRates).length > 0) {
    console.log('  聚合需求:')
    for (const [wareId, rate] of Object.entries(aggregateRates)) {
      const totals = da?.perWareTotals?.[wareId]
      if (totals) {
        const totalHours = totals.seconds / 3600
        console.log(`    ${wareName(wareId)}: ${rate.toFixed(1)}/h  (总时间 ${totals.seconds}s = ${totalHours.toFixed(2)}h, 总材料 ${Math.round(totals.qty)} 单元)`)
      } else {
        console.log(`    ${wareName(wareId)}: ${rate.toFixed(1)}/h`)
      }
    }
  }

  // --- 3. manual ---
  const manualWaresRates: Record<string, number> = {}
  const manualModRates: Record<string, number> = {}
  if (alloc) {
    for (const g of alloc.goals) {
      if (g.type === 'production-rate') manualWaresRates[g.wareId] = (manualWaresRates[g.wareId] || 0) + g.ratePerHour
      if (g.type === 'target-production' && g.wareId) {
        manualWaresRates[g.wareId] = (manualWaresRates[g.wareId] || 0) + (g.ratePerHour || 0)
      }
      if (g.type === 'build-module') {
        const mod = modulesMap[g.moduleId]
        if (mod?.outputs) {
          for (const [w, r] of Object.entries(mod.outputs)) {
            if (r > 0) manualModRates[w] = (manualModRates[w] || 0) + r / (mod.cycleTime || 60) * 3600 * g.count
          }
        }
      }
      if (g.type === 'target-production' && g.moduleId) {
        const mod = modulesMap[g.moduleId]
        if (mod?.outputs) {
          for (const [w, r] of Object.entries(mod.outputs)) {
            if (r > 0) manualModRates[w] = (manualModRates[w] || 0) + r * (g.count || 1)
          }
        }
      }
    }
  }

  const finalTargetRates = da?.targetRates || scheme?.targetRates || computeLine?.targetRates || {}
  const relevantWares = new Set<string>([...Object.keys(finalTargetRates), ...node.trackedWares])
  const relevantManualWares: Record<string, number> = {}
  for (const [w, r] of Object.entries(manualWaresRates)) {
    if (relevantWares.has(w)) relevantManualWares[w] = r
  }
  const relevantManualMods: Record<string, number> = {}
  for (const [w, r] of Object.entries(manualModRates)) {
    if (relevantWares.has(w)) relevantManualMods[w] = r
  }

  const hasManual = Object.keys(relevantManualWares).length > 0 || Object.keys(relevantManualMods).length > 0
  if (hasManual) {
    const parts: string[] = []
    if (Object.keys(relevantManualWares).length > 0) {
      const ws = Object.entries(relevantManualWares).map(([w, r]) => `${wareName(w)}: ${r.toFixed(1)}/h`)
      parts.push(`manual ware: [${ws.join(', ')}]`)
    }
    if (Object.keys(relevantManualMods).length > 0) {
      const ms = Object.entries(relevantManualMods).map(([w, r]) => `${wareName(w)}: ${r.toFixed(1)}/h`)
      parts.push(`manual module: [${ms.join(', ')}]`)
    }
    console.log(`  manual: ${parts.join('; ')}`)
  } else {
    console.log('  manual: (无)')
  }

  // --- 4. target = 聚合 + gap + ware + module ---
  const allWares = new Set<string>([
    ...Object.keys(finalTargetRates),
    ...Object.keys(relevantManualWares),
    ...Object.keys(relevantManualMods),
  ])
  if (allWares.size > 0) {
    console.log('  target = 聚合 + gap + ware + module:')
    for (const w of allWares) {
      const agg = aggregateRates[w] || 0
      const gap = da?.gapRates?.[w] || 0
      const mw = manualWaresRates[w] || 0
      const mm = manualModRates[w] || 0
      const total = agg + gap + mw + mm
      console.log(`    ${wareName(w)}: ${agg.toFixed(1)}/h + ${gap.toFixed(1)}/h + ${mw.toFixed(1)}/h + ${mm.toFixed(1)}/h = ${total.toFixed(1)}/h`)
    }
  }

  // --- 5. 产出 vs 目标 ---
  const prod = node.netProduction
  if (allWares.size > 0) {
    console.log('  产出 vs 目标:')
    for (const w of allWares) {
      const target = (aggregateRates[w] || 0) + (da?.gapRates?.[w] || 0) + (manualWaresRates[w] || 0) + (manualModRates[w] || 0)
      const p = Math.max(0, prod[w] || 0)
      const diff = p - target
      const status = diff >= -0.001 ? '✓' : '✗'
      const label = diff >= -0.001 ? '过剩' : '缺口'
      console.log(`    ${wareName(w)}: ${p.toFixed(1)}/h  ${p >= target - 0.001 ? '≥' : '<'} ${target.toFixed(1)}/h  ${status}  (${label} ${Math.abs(diff).toFixed(1)}/h)`)
    }
  }
}


console.log(`\n${sep}`)
console.log('  依赖图摘要:')
console.log(`  节点: ${graph.nodes.size}, 边: ${graph.edges.length}, SCC: ${graph.sccGroups.length} 组`)
for (const scc of graph.sccGroups) {
  const names = scc.map(id => graph.nodes.get(id)?.lineName || id.slice(0, 8))
  console.log(`    SCC: [${names.join(' ↔ ')}]`)
}
}

console.log(`\n  产线 ↔ 目标映射:`)
for (const line of preview.lines) {
  const name = line.groupName || line.groupId?.slice(0, 8) || '(待规划)'
  const targetStrs = formatPreviewLineTargets(line.items)
  console.log(`  ${line.isUnmatched ? '⚠' : ' '} ${name}: ${targetStrs.join(', ')}`)
}

const buildMaterialSchemeGroup = schemeGroups.find(group => group.groupType === 'build-material')
if (buildMaterialSchemeGroup && buildMaterialSchemeGroup.schemes.length > 0) {
  console.log(`\n${sep}`)
  console.log('  建材产线建造步骤:')
  for (const scheme of buildMaterialSchemeGroup.schemes) {
    const stepsScheme = buildStepsScheme(
      scheme,
      'build-material',
      modulesMap,
      waresMap,
      DEFAULT_BUILD_PLAN_SETTINGS,
    )
    console.log(`\n  ── ${scheme.label}`)
    if (!stepsScheme || stepsScheme.steps.length === 0) {
      console.log('    (无建造步骤)')
      continue
    }

    let cumDur = 0
    let cumCr = 0
    let currentGroup = -1
    for (const step of stepsScheme.steps) {
      if (step.groupIndex !== currentGroup) {
        currentGroup = step.groupIndex
        console.log(`\n  ▸ ${step.reason || '主产线'}`)
      }

      const stepDurInc = step.estimatedDuration - cumDur
      const stepCrInc = step.estimatedCredits - cumCr
      cumDur = step.estimatedDuration
      cumCr = step.estimatedCredits

      console.log(`    #${step.order}  ${modName(step.moduleId)} ×${step.moduleCount}`)
      console.log(`         建造: ${fmtH(step.moduleBuildTime)}  累计: ${fmtH(cumDur)}  步骤费: ${fmtCr(stepCrInc)}  累计费: ${fmtCr(cumCr)}`)

      if (step.materials.length > 0) {
        console.log('         材料明细:')
        for (const mat of step.materials) {
          const price = waresMap[mat.wareId]?.price || 0
          const consumed = Math.round(mat.quantity)
          console.log(
            `           ${wareName(mat.wareId).padEnd(30)} ×${String(consumed).padStart(6)}  `
            + `库存: ${String(Math.round(mat.stockBefore)).padStart(7)}  `
            + `自产: ${String(Math.round(mat.currentProdRate)).padStart(5)}/h  +${Math.round(mat.producedDuringBuild)}  `
            + `买: ${fmtCr(mat.creditsNeeded).padStart(7)}  (单价: ${fmtCr(price)})`,
          )
        }
      } else {
        console.log('         材料: 无')
      }
    }

    const targetWareIds = new Set(getBuildMaterialTargetRateEntries(scheme).map(([wareId]) => wareId))
    const primaryModuleIds = new Set(
      scheme.primaryModuleIds.filter(moduleId => {
        const mod = modulesMap[moduleId]
        if (!mod?.outputs) return false
        return Object.keys(mod.outputs).some(wareId => targetWareIds.has(wareId))
      }),
    )
    const schemePrimaryModules = mergeSavedModules(
      scheme.modules.filter(module => primaryModuleIds.has(module.id)),
    )
    const exitPrimaryModules = mergeSavedModules(
      (stepsScheme.greedyDebug?.exitModules || []).filter(module => primaryModuleIds.has(module.id)),
    )

    console.log('\n  ── Step 回放 vs Compute 对比 ──')
    const primaryIds = new Set([
      ...schemePrimaryModules.map(module => module.id),
      ...exitPrimaryModules.map(module => module.id),
    ])
    if (primaryIds.size > 0) {
      console.log('  Greedy 退出时主模块数量:')
      for (const moduleId of [...primaryIds].sort()) {
        const stepCount = exitPrimaryModules.find(module => module.id === moduleId)?.count || 0
        const computeCount = schemePrimaryModules.find(module => module.id === moduleId)?.count || 0
        const extraCount = computeCount - stepCount
        const status = extraCount === 0 ? '✓' : '→'
        const suffix = extraCount > 0 ? `, final=${computeCount} (+${extraCount} after tail-fill)` : `, final=${computeCount}`
        console.log(`    ${status} ${modName(moduleId)}: exit=${stepCount}${suffix}`)
      }
    }

    if (stepsScheme.greedyDebug && stepsScheme.greedyDebug.exitSatisfactions.length > 0) {
      console.log('  Greedy 退出检查满足率:')
      for (const row of stepsScheme.greedyDebug.exitSatisfactions) {
        const computeProd = Math.max(0, scheme.netProduction[row.wareId] || 0)
        const exitSat = row.targetRate > 0 ? row.prodRate / row.targetRate * 100 : 0
        const computeSat = row.targetRate > 0 ? computeProd / row.targetRate * 100 : 0
        const diff = row.prodRate - computeProd
        const status = Math.abs(diff) < 0.001 ? '✓' : '→'
        const suffix = Math.abs(diff) < 0.001
          ? `compute=${computeProd.toFixed(1)}/h (${computeSat.toFixed(1)}%)`
          : `final=${computeProd.toFixed(1)}/h (${computeSat.toFixed(1)}%, +${(computeProd - row.prodRate).toFixed(1)}/h after tail-fill)`
        console.log(
          `    ${status} ${wareName(row.wareId)}: `
          + `exit=${row.prodRate.toFixed(1)}/h (${exitSat.toFixed(1)}%, ${row.satisfied ? 'met' : 'unmet'}), `
          + `${suffix}, `
          + `target=${row.targetRate.toFixed(1)}/h, diff=${diff.toFixed(1)}/h`,
        )
      }
    }
  }
}

console.log(sep)
