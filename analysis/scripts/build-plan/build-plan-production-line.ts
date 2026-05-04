import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveBuildFlowView, computeVirtualEdges } from '@/store/logic/buildFlowDerivation'
import { buildFlowPlanGraph } from '@/store/logic/buildFlowPlanGraph'
import { expandGoalDependencies, mergeModules, computeFlowPlanLines, makeSchemesWithGroups } from '@/store/logic/calculateBuildFlowPlan'
import { computeProductionLineAllocation } from '@/store/logic/computeProductionLineAllocation'
import type { BuildFlowPlanView, BuildGoal, BuildSchemeGroup } from '@/types/build-plan'
import type { X4Module, X4Ware, ProductionLineGroup, FlowNode, SavedFlowGroup, BuildFlowAssignment, VirtualEdge } from '@/types/x4'

const WARE_DATA = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD_DATA = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, X4Ware> = {}
for (const w of WARE_DATA) waresMap[w.id] = w

const modulesMap: Record<string, X4Module> = {}
for (const m of MOD_DATA) modulesMap[m.id] = m

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

function modName(id: string): string { const m = modulesMap[id]; return m?.name || id }
function wareName(id: string): string { const w = waresMap[id]; return w?.name || id }

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

let nodeIdCounter = 0

function deserializePlan(savedGroups: SavedFlowGroup[]): ProductionLineGroup[] {
  return savedGroups.map(savedGroup => {
    const nodes: FlowNode[] = []
    for (const savedNode of savedGroup.nodes) {
      if (savedNode.module) {
        const mod = modulesMap[savedNode.module]
        if (!mod) continue
        const outputWares = Object.keys(mod.outputs || {})
        const wareId = outputWares.length > 0 ? outputWares[0]! : savedNode.module
        nodes.push({
          id: `node_${++nodeIdCounter}`,
          wareId,
          moduleId: savedNode.module,
          race: mod.race || 'argon',
          lineage: '', column: mod.tier ?? 1,
          isIsolated: false, isAuto: false, isRoot: true, source: 'manual', order: 0,
        })
      } else if (savedNode.isolated) {
        nodes.push({
          id: `node_${++nodeIdCounter}`,
          wareId: savedNode.isolated,
          race: 'argon', lineage: '', column: 1,
          isIsolated: true, isAuto: false, isRoot: false, source: 'manual', order: 0,
        })
      }
    }
    return {
      id: savedGroup.id,
      name: savedGroup.name || '',
      category: savedGroup.category,
      subCategory: savedGroup.subCategory,
      isLocked: savedGroup.isLocked ?? false,
      lockedLineage: savedGroup.lockedLineage || '',
      nodes,
    }
  })
}

function showHelp() {
  console.log(`Usage: npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts [options]

Options:
  --module="Name*N"     Build-module goal (comma-separated)
  --ware="Name*R"       Production-rate goal (comma-separated)
  --flow=<path>         Logic-flow fixture JSON path (default: tests/fixtures/logic-flow-module.json)
  --index=<N>           Use the N-th flow plan in the fixture (default: 0)
  --json                JSON output mode (default for --json: full output)
  --json=compact        Compact JSON output (scheme groups only)
  --help, -h            Show this help

Default: Missile Component Production x5

Examples:
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts
  npx vite-node analysis/scripts/build-plan/build-plan-production-line.ts --json`)
  process.exit(0)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) showHelp()

function parseArgs(): BuildGoal[] {
  const goals: BuildGoal[] = []
  const moduleArg = process.argv.find(a => a.startsWith('--module='))
  const wareArg = process.argv.find(a => a.startsWith('--ware='))
  if (moduleArg) {
    const value = moduleArg.slice('--module='.length)
    for (const part of value.split(',')) {
      const [name, countStr] = part.split('*')
      const modId = resolveModuleId(name.trim())
      if (!modId) { console.error(`Module not found: ${name.trim()}`); process.exit(1) }
      goals.push({ type: 'build-module', moduleId: modId, count: parseInt(countStr || '1') })
    }
  }
  if (wareArg) {
    const value = wareArg.slice('--ware='.length)
    for (const part of value.split(',')) {
      const [name, rateStr] = part.split('*')
      const wareId = resolveWareId(name.trim())
      if (!wareId) { console.error(`Ware not found: ${name.trim()}`); process.exit(1) }
      goals.push({ type: 'production-rate', wareId, ratePerHour: parseFloat(rateStr || '1000') })
    }
  }
  if (goals.length === 0)
    goals.push({ type: 'build-module', moduleId: 'module_gen_prod_missilecomponents_01', count: 5 })
  return goals
}

const goals = parseArgs()
const flowArg = process.argv.find(a => a.startsWith('--flow='))
const flowPath = flowArg ? flowArg.slice('--flow='.length) : 'tests/fixtures/logic-flow-module.json'
const indexArg = process.argv.find(a => a.startsWith('--index='))
const flowIndex = indexArg ? parseInt(indexArg.slice('--index='.length)) : 0
const jsonMode = process.argv.find(a => a.startsWith('--json'))
const useJson = jsonMode !== undefined
const useCompactJson = jsonMode === '--json=compact'

const fixtureRaw = JSON.parse(readFileSync(resolve(flowPath), 'utf-8'))
const plansList = fixtureRaw.list || []
if (plansList.length === 0) { console.error('No flow plans found'); process.exit(1) }
const selectedPlan = plansList[flowIndex]
if (!selectedPlan) { console.error(`Plan index ${flowIndex} not found`); process.exit(1) }

const savedGroups: SavedFlowGroup[] = selectedPlan.groups || []
const rawAssignments: any[] = selectedPlan.buildFlow?.assignments || []
const archivedGroupIds: string[] = selectedPlan.buildFlow?.archivedGroupIds || []

const groups = deserializePlan(savedGroups)
const assignments: BuildFlowAssignment[] = rawAssignments.map((a: any) => ({
  wareId: a.wareId, sourceGroupId: a.sourceGroupId, targetType: a.targetType || 'output-build-material', targetGroupId: a.targetGroupId,
}))

const groupDisplayNames = new Map<string, string>()
for (const g of groups) groupDisplayNames.set(g.id, g.name || g.id)
function getWareLabel(wareId: string): string { return waresMap[wareId]?.name || wareId }

const derived = deriveBuildFlowView(groups, modulesMap, groupDisplayNames, getWareLabel, archivedGroupIds)
const virtualEdges = computeVirtualEdges(derived.buildFlowGroups, assignments, archivedGroupIds, groups)
const buildFlowView: BuildFlowPlanView = { buildFlowGroups: derived.buildFlowGroups, assignments, virtualEdges }

const baseModules = goals.flatMap(g => expandGoalDependencies(g, modulesMap, waresMap))
const cModules = mergeModules(baseModules)
const graph = buildFlowPlanGraph(cModules, buildFlowView, modulesMap, groups)

// ---- Compute line modules & grouped schemes ----

computeFlowPlanLines(graph, modulesMap, waresMap, settings, [])

const savedLog = console.log
if (useJson) console.log = () => {}
const lineAllocations = computeProductionLineAllocation(goals, groups, buildFlowView, modulesMap, modulesByOutputMap)
if (useJson) console.log = savedLog

const schemeGroups = makeSchemesWithGroups(graph, lineAllocations, modulesMap, waresMap, settings)

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
      stepsCount: s.stepsCount,
    })),
  })

  if (useCompactJson) {
    const output = {
      goals: goals.map(g => {
        if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
        return `${wareName(g.wareId)} ${g.ratePerHour}/h`
      }),
      schemeGroups: schemeGroups.map(groupOutput),
      dependencyGraph: {
        nodes: [...graph.nodes.entries()].map(([id, node]) => ({
          id: id.slice(0, 8),
          lineName: node.lineName,
          trackedWares: [...node.trackedWares],
        })),
        edges: graph.edges.map(e => ({
          from: e.fromLineKey.slice(0, 8),
          to: e.toLineKey.slice(0, 8),
          wareId: e.wareId,
          label: e.sourceLabel,
        })),
        sccGroups: graph.sccGroups.map(scc => scc.map(id => id.slice(0, 8))),
      },
    }
    console.log(JSON.stringify(output, null, 2))
  } else {
    const output = {
      goals: goals.map(g => ({
        type: g.type,
        ...(g.type === 'build-module' ? { moduleId: g.moduleId, name: modName(g.moduleId), count: g.count } : {}),
        ...(g.type === 'production-rate' ? { wareId: g.wareId, name: wareName(g.wareId), ratePerHour: g.ratePerHour } : {}),
      })),
      schemeGroups: schemeGroups.map(groupOutput),
      dependencyGraph: {
        nodes: [...graph.nodes.entries()].map(([id, node]) => ({
          lineGroupId: id, lineName: node.lineName,
          trackedWares: [...node.trackedWares].map(w => ({ wareId: w, wareName: wareName(w) })),
          modules: node.modules, isSelfBootstrap: node.isSelfBootstrap,
        })),
        edges: graph.edges.map(e => ({
          fromLineKey: e.fromLineKey, toLineKey: e.toLineKey,
          wareId: e.wareId, wareName: wareName(e.wareId), sourceLabel: e.sourceLabel,
        })),
        sccGroups: graph.sccGroups,
        cModules: graph.cModules.map(m => ({ id: m.id, name: modName(m.id), count: m.count })),
        cBuildCostRates: graph.cBuildCostRates,
      },
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
console.log(`  方案: ${selectedPlan.name || '(unnamed)'}`)
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

    const primarySet = new Set(scheme.primaryModuleIds)
    const primaryModules = scheme.modules.filter(m => primarySet.has(m.id))
    const derivedModules = scheme.modules.filter(m => !primarySet.has(m.id))
    if (primaryModules.length > 0) {
      console.log(`     ├─ 主要模块:`)
      for (const m of primaryModules) {
        const mod = modulesMap[m.id]
        const outputStr = mod?.outputs ? Object.entries(mod.outputs)
          .filter(([, v]) => (v as number) > 0)
          .map(([w, v]) => `${wareName(w)} ${v}/cycle`)
          .join(', ') : ''
        console.log(`     │   ${modName(m.id)} ×${m.count}${outputStr ? `  (${outputStr})` : ''}`)
      }
    }
    if (derivedModules.length > 0) {
      console.log(`     ├─ 配套模块:`)
      for (const m of derivedModules) {
        console.log(`     │   ${modName(m.id)} ×${m.count}`)
      }
    }

    const buildCost = Object.entries(scheme.buildMaterialTotals)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
    if (buildCost.length > 0) {
      const totalCredits = buildCost.reduce((sum, [w, qty]) => sum + qty * (waresMap[w]?.price || 0), 0)
      console.log(`     └─ 建材需求:`)
      for (const [wareId, qty] of buildCost) {
        const price = waresMap[wareId]?.price || 0
        console.log(`         ${wareName(wareId).padEnd(28)} ×${String(Math.round(qty)).padStart(8)}  ≈ ${(qty * price / 1e6).toFixed(2)}M cr`)
      }
      console.log(`         建材总价: ${(totalCredits / 1e6).toFixed(2)}M cr`)
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

console.log(`\n${sep}`)
console.log('  依赖图摘要:')
console.log(`  节点: ${graph.nodes.size}, 边: ${graph.edges.length}, SCC: ${graph.sccGroups.length} 组`)
for (const scc of graph.sccGroups) {
  const names = scc.map(id => graph.nodes.get(id)?.lineName || id.slice(0, 8))
  console.log(`    SCC: [${names.join(' ↔ ')}]`)
}

console.log(`\n  产线 ↔ 目标映射:`)
for (const alloc of lineAllocations) {
  const name = alloc.groupName || alloc.groupId?.slice(0, 8) || '(待规划)'
  const goalStrs = alloc.goals.map(g => {
    if (g.type === 'production-rate' || g.type === 'derived-rate')
      return `${wareName(g.wareId)}${g.type === 'derived-rate' ? '(derived)' : ''} ${g.ratePerHour}/h`
    return `${modName(g.moduleId)} ×${g.count}`
  })
  console.log(`  ${alloc.isUnmatched ? '⚠' : ' '} ${name}: ${goalStrs.join(', ')}`)
}

console.log(sep)
