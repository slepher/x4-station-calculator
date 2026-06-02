import { computed } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  useTerraformingPresenter,
  type TerraformingPresenterStore,
} from '@/components/empire/presenters/useTerraformingPresenter'
import type {
  TerraformingData,
  TerraformingProject,
} from '@/store/logic/terraformingTaskResolver'

function project(id: string, extra: Partial<TerraformingProject> = {}): TerraformingProject {
  return {
    id,
    group: 'test',
    nameId: '',
    name: id,
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

function presenterFor(projects: TerraformingProject[]) {
  const data: TerraformingData = {
    stats: [],
    projectGroups: [{ id: 'test', nameId: 'test', name: 'Test' }],
    projects,
    clusters: [{
      id: 'cluster',
      macro: 'macro.cluster_macro',
      partName: 'cluster',
      initialStats: {},
      projectIds: projects.map(item => item.id),
      taskProjectIds: projects.map(item => item.id),
    }],
    deliveryShips: [],
  }
  const store: TerraformingPresenterStore = {
    terraformingData: computed(() => data),
    terraformingSelectedClusterId: computed(() => 'cluster'),
    terraformingSelectedCluster: computed(() => data.clusters[0] ?? null),
    terraformingRuntimeProjectIds: computed(() => projects.map(item => item.id)),
    terraformingExecutionLog: computed(() => []),
    terraformingHqStationName: computed(() => ''),
    terraformingHqArchiveStation: computed(() => null),
    terraformingHqEffectiveModules: computed(() => []),
    terraformingHqClusterId: computed(() => null),
    selectTerraformingCluster: () => {},
    setTerraformingCompletedProjects: () => {},
    appendTerraformingProjectExecution: () => {},
    setTerraformingProjectCount: () => {},
    removeTerraformingExecutionEntry: () => {},
    replaceTerraformingExecutionLog: () => {},
    clearTerraformingExecutionQueue: () => {},
    mapsClusters: {},
    mapsSectors: {},
    wareNames: computed(() => new Map()),
    moduleGroupNames: computed(() => new Map()),
    wareGroupMap: computed(() => new Map()),
  }
  return useTerraformingPresenter(store)
}

describe('terraforming dependency presenter', () => {
  it('formats completed-only alternatives like predecessor alternatives', () => {
    const presenter = presenterFor([
      project('source_a', { name: 'Source A' }),
      project('source_b', { name: 'Source B' }),
      project('target', {
        dependencies: {
          any: [
            { completed: 'source_a' },
            { completed: 'source_b' },
          ],
        },
      }),
    ])

    const lines = presenter.props.taskList.taskNodeDisplays.value.get('target')?.dependencyLines

    expect(lines).toContainEqual({
      label: 'Needs',
      value: 'Any Source A | Source B',
      blocked: true,
    })
  })

  it('keeps action labels for not-completed alternatives', () => {
    const presenter = presenterFor([
      project('cheap', { name: 'Low Cost Refineries' }),
      project('retrofit', { name: 'Retrofit Emissions Filters' }),
      project('target', {
        dependencies: {
          any: [
            { notCompleted: 'cheap' },
            { completed: 'retrofit' },
          ],
        },
      }),
    ])

    const lines = presenter.props.taskList.taskNodeDisplays.value.get('target')?.dependencyLines

    expect(lines).toContainEqual({
      label: 'Needs',
      value: 'not Low Cost Refineries or Retrofit Emissions Filters',
      blocked: false,
    })
  })
})
