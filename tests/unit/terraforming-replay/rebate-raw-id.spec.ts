import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, beforeEach } from 'vitest'
import {
  useTerraformingPresenter,
  type TerraformingPresenterStore,
} from '@/components/empire/presenters/useTerraformingPresenter'
import type {
  TerraformingCluster,
  TerraformingData,
  TerraformingProject,
  TerraformingStat,
} from '@/store/logic/terraformingTaskResolver'
import type { TerraformingExecutionEntry } from '@/store/logic/terraformingRuntime'
import { useGameDataStore } from '@/store/useGameDataStore'

function stat(id: string): TerraformingStat {
  return {
    id,
    nameId: id,
    default: 0,
    dynamic: true,
    icon: '',
    ranges: [{ start: 0, end: 999, state: 0, rgb: '', descriptionId: `${id}.state0` }],
  }
}

function project(project: Partial<TerraformingProject> & { id: string }): TerraformingProject {
  return {
    id: project.id,
    group: 'test',
    nameId: project.id,
    name: project.id,
    descriptionId: project.id,
    duration: null,
    repeatCooldown: 0,
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
    ...project,
  }
}

function presenterFor(projects: TerraformingProject[], executionLog: TerraformingExecutionEntry[]) {
  const cluster: TerraformingCluster = {
    id: 'cluster',
    macro: 'macro.cluster',
    partName: 'cluster',
    initialStats: {},
    projectIds: projects.map(item => item.id),
    taskProjectIds: projects.map(item => item.id),
  }
  const data: TerraformingData = {
    stats: [stat('unused')],
    projectGroups: [{ id: 'test', nameId: 'test', name: 'Test' }],
    projects,
    clusters: [cluster],
    deliveryShips: [],
  }
  const log = ref(executionLog)
  const store: TerraformingPresenterStore = {
    terraformingData: computed(() => data),
    terraformingSelectedClusterId: computed(() => cluster.id),
    terraformingSelectedCluster: computed(() => cluster),
    terraformingRuntimeProjectIds: computed(() => projects.map(item => item.id)),
    terraformingExecutionLog: computed(() => log.value),
    terraformingHqStationName: computed(() => ''),
    terraformingHqArchiveStation: computed(() => null),
    terraformingHqEffectiveModules: computed(() => []),
    terraformingHqClusterId: computed(() => null),
    selectTerraformingCluster: () => {},
    setTerraformingCompletedProjects: () => {},
    appendTerraformingProjectExecution: () => {},
    setTerraformingProjectCount: () => {},
    removeTerraformingExecutionEntry: () => {},
    replaceTerraformingExecutionLog: entries => { log.value = entries },
    clearTerraformingExecutionQueue: () => { log.value = [] },
    mapsClusters: {},
    mapsSectors: {},
    wareNames: computed(() => new Map([['ware_b', 'Ware B']])),
    moduleGroupNames: computed(() => new Map([['group_a', 'Shared Display'], ['group_b', 'Shared Display']])),
    wareGroupMap: computed(() => new Map([['ware_a', 'group_a'], ['ware_b', 'group_b']])),
  }
  return useTerraformingPresenter(store)
}

describe('terraforming replay rebate raw-id matching', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const gameData = useGameDataStore()
    gameData.waresMap = { ware_b: { maxPrice: 10 } } as any
    gameData.modulesMap = {} as any
    gameData.localizedModulesMap = {} as any
  })

  it('does not discount a ware from a different raw group when display names collide', () => {
    const rebateProject = project({
      id: 'rebate_group_a',
      rebates: [{ wareGroup: 'group_a', value: 50 }],
    })
    const targetProject = project({
      id: 'consume_group_b',
      resources: { price: 0, wares: [{ ware: 'ware_b', amount: 10, actualAmount: 10 }] },
    })
    const presenter = presenterFor([rebateProject, targetProject], [
      { id: 'r', projectId: 'rebate_group_a' },
      { id: 't', projectId: 'consume_group_b' },
    ])

    const targetEntry = presenter.props.resourcePanel.executionTimeline.value
      .find(entry => entry.projectId === 'consume_group_b')

    expect(targetEntry?.discountedWares).toEqual([])
    expect(targetEntry?.discountAmount).toBe(0)
  })
})
