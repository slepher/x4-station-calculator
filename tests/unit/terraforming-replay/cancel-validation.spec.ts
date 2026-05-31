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
  executionLog: TerraformingExecutionEntry[],
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
    wareNames: computed(() => new Map()),
    moduleGroupNames: computed(() => new Map()),
    wareGroupMap: computed(() => new Map()),
  }
  return useTerraformingPresenter(store)
}

describe('terraforming replay cancel validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('removes all contiguous events after the target task before validating later tasks', () => {
    const taskA = project({ id: 'task_a', effects: [{ stat: 'a', change: 1 }] })
    const eventX = project({
      id: 'evt_x',
      group: 'events',
      conditions: [{ stat: 'a', minvalue: 1, usesValueBounds: true }],
      effects: [{ stat: 'b', change: 1 }],
    })
    const eventY = project({
      id: 'evt_y',
      group: 'events',
      conditions: [{ stat: 'b', minvalue: 1, usesValueBounds: true }],
      effects: [{ stat: 'c', change: 1 }],
    })
    const taskB = project({
      id: 'task_b',
      conditions: [{ stat: 'c', minvalue: 1, usesValueBounds: true }],
    })
    const presenter = presenterFor([taskA, eventX, eventY, taskB], { a: 0, b: 0, c: 0 }, [
      { id: 'a', projectId: 'task_a' },
      { id: 'x', projectId: 'evt_x' },
      { id: 'y', projectId: 'evt_y' },
      { id: 'b', projectId: 'task_b' },
    ])

    const validation = presenter.props.resourcePanel.getCancelValidation('a')

    expect(validation.canCancel).toBe(false)
    expect(validation.affectedEntryIds).toContain('b')
    expect(validation.affectedEntryIds).not.toContain('x')
    expect(validation.affectedEntryIds).not.toContain('y')
  })

  it('allows cancel when replay can reinsert an event before the later dependent task', () => {
    const taskA = project({ id: 'task_a', effects: [{ stat: 'a', change: 1 }] })
    const taskC = project({ id: 'task_c', effects: [{ stat: 'a', change: 1 }] })
    const eventX = project({
      id: 'evt_x',
      group: 'events',
      repeatCooldown: 0,
      conditions: [{ stat: 'a', minvalue: 1, usesValueBounds: true }],
      effects: [{ stat: 'b', change: 1 }],
    })
    const taskB = project({
      id: 'task_b',
      conditions: [{ stat: 'b', minvalue: 1, usesValueBounds: true }],
    })
    const presenter = presenterFor([taskA, eventX, taskC, taskB], { a: 0, b: 0 }, [
      { id: 'a', projectId: 'task_a' },
      { id: 'x', projectId: 'evt_x' },
      { id: 'c', projectId: 'task_c' },
      { id: 'b', projectId: 'task_b' },
    ])

    const validation = presenter.props.resourcePanel.getCancelValidation('a')

    expect(validation.canCancel).toBe(true)
    expect(validation.affectedEntryIds).toEqual([])
  })

  it('does not block cancel because of an invalid task before the target entry', () => {
    const beforeTask = project({
      id: 'before_task',
      conditions: [{ stat: 'z', minvalue: 1, usesValueBounds: true }],
    })
    const taskA = project({ id: 'task_a', effects: [{ stat: 'a', change: 1 }] })
    const taskB = project({ id: 'task_b' })
    const presenter = presenterFor([beforeTask, taskA, taskB], { a: 0, z: 0 }, [
      { id: 'before', projectId: 'before_task' },
      { id: 'a', projectId: 'task_a' },
      { id: 'b', projectId: 'task_b' },
    ])

    const validation = presenter.props.resourcePanel.getCancelValidation('a')

    expect(validation.canCancel).toBe(true)
    expect(validation.affectedEntryIds).toEqual([])
  })
})
