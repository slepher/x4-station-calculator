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

function presenterFor(
  projects: TerraformingProject[],
  initialStats: Record<string, number>,
  initialLog: TerraformingExecutionEntry[],
) {
  const cluster: TerraformingCluster = {
    id: 'cluster',
    macro: 'macro.cluster',
    partName: 'cluster',
    initialStats,
    projectIds: projects.map(item => item.id),
    taskProjectIds: projects.map(item => item.id),
  }
  const data: TerraformingData = {
    stats: Object.keys(initialStats).map(stat),
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

describe('terraforming auto-event canonical sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('canonicalizes a misplaced existing event instead of treating the same projectId as already handled', () => {
    const triggerTask = project({
      id: 'trigger_event',
      effects: [{ stat: 'a', change: 1 }],
    })
    const event = project({
      id: 'evt_a',
      group: 'events',
      conditions: [{ stat: 'a', minvalue: 1, usesValueBounds: true }],
      effects: [{ stat: 'b', change: 1 }],
    })
    const { presenter, log } = presenterFor([triggerTask, event], { a: 0, b: 0 }, [
      { id: 'stale-event', projectId: 'evt_a' },
    ])

    presenter.emits.toggleProject('trigger_event')

    expect(log.value.map(entry => entry.projectId)).toEqual(['trigger_event', 'evt_a'])
  })

  it('maps repeated timeline rows to log entry ids by occurrence order', () => {
    const repeatableTask = project({
      id: 'repeat_task',
      repeatCooldown: 1,
    })
    const { presenter } = presenterFor([repeatableTask], { a: 0 }, [
      { id: 'first-entry', projectId: 'repeat_task' },
      { id: 'second-entry', projectId: 'repeat_task' },
    ])

    expect(presenter.props.resourcePanel.executionTimeline.value.map(entry => entry.id)).toEqual([
      'first-entry',
      'second-entry',
    ])
  })
})
