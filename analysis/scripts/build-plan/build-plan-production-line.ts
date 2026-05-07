import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveBuildFlowView, computeVirtualEdges } from '@/store/logic/buildFlowDerivation'
import { computeWareSatisfactions } from '@/store/logic/calculateBuildFlowPlan'
import {
  createBuildFlowPlanPreview,
  computeBuildFlowPlan,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'
import type { BuildFlowPlanView, BuildGoal, BuildSchemeGroup, PreviewResult, ProductionLineAllocation } from '@/types/build-plan'
import type { X4Module, X4Ware, ProductionLineGroup, FlowNode, SavedFlowGroup, BuildFlowAssignment, VirtualEdge, SavedModule } from '@/types/x4'

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
  --no-build-material   Disable build-material line planning
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
const buildMaterialPlanningEnabled = !process.argv.includes('--no-build-material')

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

const preview = createBuildFlowPlanPreview(
  goals,
  groups,
  buildFlowView,
  modulesMap,
  waresMap,
  DEFAULT_BUILD_PLAN_SETTINGS,
  buildMaterialPlanningEnabled,
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
  goals: line.responsibilities.flatMap(r => {
    if (r.type === 'target-production') {
      if (r.moduleId) {
        return [{
          type: 'target-production' as const,
          moduleId: r.moduleId,
          count: r.count || 1,
        }]
      }
      if (r.wareId) {
        return [{
          type: 'target-production' as const,
          wareId: r.wareId,
          ratePerHour: r.ratePerHour || 0,
        }]
      }
      return []
    }
    if (!r.wareId) return []
    return [{
      type: r.type,
      wareId: r.wareId,
      ratePerHour: r.ratePerHour || 0,
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
      stepsCount: s.stepsCount,
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
              from: e.fromLineKey.slice(0, 8),
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
              fromLineKey: e.fromLineKey, toLineKey: e.toLineKey,
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
console.log(`  方案: ${selectedPlan.name || '(unnamed)'}`)
console.log(`  建材产线规划: ${buildMaterialPlanningEnabled ? '开启' : '关闭'}`)
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
      console.log(`     ├─ 模块 × 数量:`)
      for (const md of scheme.moduleBuildDetails) {
        const timeStr = md.buildTime > 0 ? `  (建筑 ${md.buildTime}s × ${md.count} = ${md.buildTime * md.count}s)` : ''
        console.log(`     │   ${modName(md.moduleId)} ×${md.count}${timeStr}`)
        const matEntries = Object.entries(md.materials).filter(([, qty]) => qty > 0)
        if (matEntries.length > 0) {
          const matStr = matEntries.map(([w, qty]) => `${wareName(w)} ${Math.round(qty)}`).join(', ')
          console.log(`     │     BuildCost: ${matStr}`)
        }
      }
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
for (const alloc of lineAllocations) {
  const name = alloc.groupName || alloc.groupId?.slice(0, 8) || '(待规划)'
  const goalStrs = alloc.goals.map(g => {
    if (g.type === 'production-rate') return `${wareName(g.wareId)} ${g.ratePerHour}/h`
    if (g.type === 'build-module') return `${modName(g.moduleId)} ×${g.count}`
    if (g.type === 'derived-production' || g.type === 'derived-build-material' || g.type === 'required-production')
      return `${wareName(g.wareId)} (${g.type})`
    if (g.type === 'derived-rate') return `${wareName(g.wareId)}(derived) ${g.ratePerHour}/h`
    return `?`
  })
  console.log(`  ${alloc.isUnmatched ? '⚠' : ' '} ${name}: ${goalStrs.join(', ')}`)
}

console.log(sep)
