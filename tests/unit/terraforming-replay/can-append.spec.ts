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
    ...project,
  }
}

function presenterFor(projects: TerraformingProject[], initialLog: TerraformingExecutionEntry[]) {
  const cluster: TerraformingCluster = {
    id: 'cluster',
    macro: 'macro.cluster',
    partName: 'cluster',
    initialStats: { a: 0 },
    projectIds: projects.map(item => item.id),
    taskProjectIds: projects.map(item => item.id),
  }
  const data: TerraformingData = {
    stats: [stat('a')],
    projectGroups: [{ id: 'test', nameId: 'test', name: 'Test' }, { id: 'events', nameId: 'events', name: 'Events' }],
    projects,
    clusters: [cluster],
    deliveryShips: [],
  }
  const log = ref(initialLog)
  let seq = initialLog.length
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
    appendTerraformingProjectExecution: (projectId: string, count = 1) => {
      for (let i = 0; i < count; i += 1) {
        seq += 1
        log.value = [...log.value, { id: `cluster-exec-${seq}`, projectId }]
      }
    },
    setTerraformingProjectCount: () => {},
    removeTerraformingExecutionEntry: entryId => { log.value = log.value.filter(entry => entry.id !== entryId) },
    replaceTerraformingExecutionLog: entries => {
      log.value = entries.map((entry, index) => ({
        id: entry.id || `cluster-exec-${index + 1}`,
        projectId: entry.projectId,
      }))
      seq = log.value.length
    },
    clearTerraformingExecutionQueue: () => { log.value = [] },
    mapsClusters: {},
    mapsSectors: {},
    wareNames: computed(() => new Map()),
    moduleGroupNames: computed(() => new Map()),
    wareGroupMap: computed(() => new Map()),
  }
  return { presenter: useTerraformingPresenter(store), log }
}

describe('terraforming replay canAppend committed state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('ignores stale event occurrences when checking notCompleted dependencies', () => {
    const staleEvent = project({
      id: 'evt_stale',
      group: 'events',
      conditions: [{ stat: 'a', minvalue: 1, usesValueBounds: true }],
    })
    const target = project({
      id: 'target_task',
      dependencies: { notCompleted: 'evt_stale' },
    })
    const { presenter, log } = presenterFor([staleEvent, target], [
      { id: 'stale', projectId: 'evt_stale' },
    ])

    presenter.emits.toggleProject('target_task')

    expect(log.value.map(entry => entry.projectId)).toEqual(['target_task'])
  })
})
