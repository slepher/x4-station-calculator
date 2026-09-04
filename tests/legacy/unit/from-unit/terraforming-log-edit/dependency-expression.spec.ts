import { describe, expect, it } from 'vitest'
import {
  evaluateTerraformingProjectExecution,
  type TerraformingProject,
  type TerraformingStat,
} from '@/store/logic/terraformingTaskResolver'

function project(id: string, extra: Partial<TerraformingProject> = {}): TerraformingProject {
  return {
    id,
    group: 'biosphere',
    nameId: id,
    descriptionId: id,
    duration: 1,
    repeatCooldown: null,
    resilient: false,
    chance: 100,
    version: null,
    research: null,
    conditions: [],
    effects: [],
    sideEffects: [],
    resources: { price: 0, wares: [] },
    deliveries: [],
    rebates: [],
    removedProjects: [],
    blockedProjects: [],
    blockedGroups: [],
    predecessors: [],
    ...extra,
  }
}

function evaluate(target: TerraformingProject, completedIds: string[], extraProjects: TerraformingProject[] = []) {
  const clusterProjects = [
    project('bio_tailored'),
    project('bio_jumpstart'),
    project('bio_cull'),
    project('bio_toxicfruit_genemod'),
    project('bio_toxicfruit_cull'),
    project('bio_parasites_cull'),
    ...extraProjects,
    target,
  ]
  const projectMap = new Map(clusterProjects.map(item => [item.id, item]))
  const completedProjects = new Map(completedIds.map(id => [id, 1]))
  const stats: TerraformingStat[] = []
  return evaluateTerraformingProjectExecution(
    target,
    { stats: {}, completedProjects },
    projectMap,
    clusterProjects,
    stats,
  )
}

describe('terraforming dependency expression', () => {
  it('allows fertilise soil through tailored microbes without microbial culling', () => {
    const fertiliseSoil = project('agr_fertilize', {
      dependencies: {
        any: [
          { completed: 'bio_tailored' },
          { all: [{ completed: 'bio_jumpstart' }, { completed: 'bio_cull' }] },
        ],
      },
    })

    expect(evaluate(fertiliseSoil, ['bio_tailored']).valid).toBe(true)
    expect(evaluate(fertiliseSoil, ['bio_jumpstart']).valid).toBe(false)
    expect(evaluate(fertiliseSoil, ['bio_jumpstart', 'bio_cull']).valid).toBe(true)
  })

  it('only requires parasite culling after the toxic fruit cull branch', () => {
    const vineyards = project('agr_vineyards', {
      group: 'food_luxury',
      dependencies: {
        any: [
          { completed: 'bio_toxicfruit_genemod' },
          { all: [{ completed: 'bio_toxicfruit_cull' }, { completed: 'bio_parasites_cull' }] },
        ],
      },
    })

    expect(evaluate(vineyards, ['bio_toxicfruit_genemod']).valid).toBe(true)
    expect(evaluate(vineyards, ['bio_toxicfruit_cull']).valid).toBe(false)
    expect(evaluate(vineyards, ['bio_toxicfruit_cull', 'bio_parasites_cull']).valid).toBe(true)
  })

  it('does not block execution on group dependency markers', () => {
    const arcology = project('res_arcology', {
      dependencies: {
        all: [
          { groupCompleted: 'power' },
          { groupCompleted: 'food_staple' },
        ],
      },
    })

    expect(evaluate(arcology, [], [
      project('pwr_geothermal', { group: 'power' }),
      project('agr_hydroponics', { group: 'food_staple' }),
    ]).valid).toBe(true)
  })

  it('requires a side effect source before executing the generated project', () => {
    const retrofit = project('ind_refineries_retrofit', {
      predecessors: [
        { ref: 'ind_refineries_cheap', type: 'project', any: false },
      ],
    })

    expect(evaluate(retrofit, [], [
      project('ind_refineries_cheap'),
    ]).valid).toBe(false)
    expect(evaluate(retrofit, ['ind_refineries_cheap'], [
      project('ind_refineries_cheap'),
    ]).valid).toBe(true)
  })

  it('allows any side effect source to unlock the generated project', () => {
    const generated = project('generated_project', {
      dependencies: {
        any: [
          { completed: 'source_a' },
          { completed: 'source_b' },
        ],
      },
    })

    expect(evaluate(generated, [], [
      project('source_a'),
      project('source_b'),
    ]).valid).toBe(false)
    expect(evaluate(generated, ['source_b'], [
      project('source_a'),
      project('source_b'),
    ]).valid).toBe(true)
  })

  it('checks predecessors and dependency expressions together', () => {
    const target = project('combined_target', {
      predecessors: [
        { ref: 'same_group_source', type: 'project', any: false },
      ],
      dependencies: { completed: 'cross_group_source' },
    })

    expect(evaluate(target, ['same_group_source'], [
      project('same_group_source'),
      project('cross_group_source'),
    ]).valid).toBe(false)
    expect(evaluate(target, ['cross_group_source'], [
      project('same_group_source'),
      project('cross_group_source'),
    ]).valid).toBe(false)
    expect(evaluate(target, ['same_group_source', 'cross_group_source'], [
      project('same_group_source'),
      project('cross_group_source'),
    ]).valid).toBe(true)
  })
})
