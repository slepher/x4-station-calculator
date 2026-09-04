import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveBuildFlowView, computeVirtualEdges } from '@/store/logic/buildFlowDerivation'
import { hydrateSavedFlowGroups } from '@/store/logic/hydrateSavedFlowGroups'
import {
  createBuildFlowPlanPreview,
  computeBuildFlowPlan,
  DEFAULT_BUILD_PLAN_SETTINGS,
} from '@/store/logic/buildPlanProductionLine'
import type { BuildFlowAssignment, BuildFlowPlanView, BuildGoal } from '@/types/build-plan'
import type { ProductionLineGroup, SavedFlowGroup, X4Module, X4Ware } from '@/types/x4'

const WARE_DATA: X4Ware[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'), 'utf-8'))
const MOD_DATA: X4Module[] = JSON.parse(readFileSync(resolve('src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'), 'utf-8'))

const waresMap: Record<string, X4Ware> = {}
for (const ware of WARE_DATA) waresMap[ware.id] = ware

const modulesMap: Record<string, X4Module> = {}
for (const module of MOD_DATA) modulesMap[module.id] = module

const modulesByOutputMap: Record<string, X4Module[]> = {}
for (const module of MOD_DATA) {
  if (!module.outputs) continue
  for (const wareId of Object.keys(module.outputs)) {
    if (!modulesByOutputMap[wareId]) modulesByOutputMap[wareId] = []
    modulesByOutputMap[wareId]!.push(module)
  }
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

  const selectedBp = bpState.list[index]
  const goals = selectedBp.buildGoals || []
  const logicFlowPlanId: string | undefined = selectedBp.logicFlowPlanId
  const lfPlan = (lfState.list || []).find((plan: any) => plan.id === logicFlowPlanId)
  const { groups, buildFlowView } = buildGroupsAndFlowView(
    lfPlan.groups || [],
    lfPlan.buildFlow?.assignments || [],
    lfPlan.buildFlow?.archivedGroupIds || [],
  )

  return { goals, groups, buildFlowView }
}

describe('buildPlanProductionLine unmatched preview group', () => {
  it('treats unmatched target lines as valid preview groups for build-material demand', () => {
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

    const targetLine = preview!.lines.find(line => line.groupName === '导弹部件')
    expect(targetLine).toBeDefined()
    expect(targetLine?.groupId).toBeTruthy()

    const claytronicsCarrier = preview!.lines.find(line =>
      line.items.some(
        item => item.kind === 'derived'
          && item.wareId === 'claytronics'
          && item.derived.includes('build-material'),
      ),
    )
    expect(claytronicsCarrier).toBeDefined()
    const claytronicsItem = claytronicsCarrier!.items.find(
      item => item.kind === 'derived' && item.wareId === 'claytronics',
    )
    expect(claytronicsItem?.kind).toBe('derived')
    if (claytronicsItem?.kind === 'derived') {
      expect(claytronicsItem.relatedLineGroupIds).toContain(targetLine!.groupId!)
    }

    const result = computeBuildFlowPlan({
      preview: preview!,
      modulesMap,
      waresMap,
      modulesByOutputMap,
      settings: DEFAULT_BUILD_PLAN_SETTINGS,
    })

    const buildMaterialGroup = result.schemeGroups.find(group => group.groupType === 'build-material')
    expect(buildMaterialGroup).toBeDefined()
    expect(buildMaterialGroup!.schemes.length).toBeGreaterThan(0)
    expect(buildMaterialGroup!.schemes.length).toBeGreaterThan(0)
  })
})
