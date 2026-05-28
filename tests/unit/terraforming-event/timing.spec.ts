import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  useTerraformingPresenter,
  type TerraformingPresenterStore,
} from '@/components/empire/presenters/useTerraformingPresenter'
import type {
  TerraformingData,
  TerraformingProject,
  TerraformingCluster,
  TerraformingStat,
} from '@/store/logic/terraformingTaskResolver'
import type { TerraformingExecutionEntry } from '@/store/logic/terraformingRuntime'
import {
  computeTerraformingRuntimeStats,
} from '@/store/logic/terraformingRuntime'
import terraformingJson from '@/assets/x4_game_data/9.0-Empire-beta/data/terraforming.json'

const raw = terraformingJson as unknown as TerraformingData & {
  stats: TerraformingStat[]
  projects: TerraformingProject[]
  clusters: TerraformingCluster[]
}

function findCluster(id: string): TerraformingCluster {
  const c = raw.clusters.find(c => c.id === id)
  if (!c) throw new Error(`Cluster ${id} not found`)
  return c
}

function makeStore(cluster: TerraformingCluster): {
  store: TerraformingPresenterStore
  executionLog: ReturnType<typeof ref<TerraformingExecutionEntry[]>>
} {
  const executionLog = ref<TerraformingExecutionEntry[]>([])
  let seq = 0

  function computeCompleted(): Map<string, number> {
    const m = new Map<string, number>()
    for (const e of executionLog.value) {
      m.set(e.projectId, (m.get(e.projectId) ?? 0) + 1)
    }
    return m
  }

  const store: TerraformingPresenterStore = {
    terraformingData: computed(() => raw as unknown as TerraformingData),
    terraformingSelectedClusterId: computed(() => cluster.id),
    terraformingSelectedCluster: computed(() => cluster),
    terraformingCurrentStats: computed(() => {
      return computeTerraformingRuntimeStats(cluster, computeCompleted(), raw as unknown as TerraformingData)
    }),
    terraformingRuntimeProjectIds: computed(() => cluster.taskProjectIds),
    terraformingCompletedProjects: computed(() => computeCompleted()),
    terraformingExecutionLog: computed(() => executionLog.value),
    terraformingHqStationName: computed(() => ''),
    terraformingHqArchiveStation: computed(() => null),
    terraformingHqEffectiveModules: computed(() => []),
    terraformingHqClusterId: computed(() => null),
    selectTerraformingCluster: () => {},
    setTerraformingCompletedProjects: () => {},
    appendTerraformingProjectExecution: (projectId: string, count = 1) => {
      for (let i = 0; i < count; i++) {
        executionLog.value = [...executionLog.value, { id: `${cluster.id}-exec-${++seq}`, projectId }]
      }
    },
    setTerraformingProjectCount: () => {},
    removeTerraformingExecutionEntry: (entryId: string) => {
      executionLog.value = executionLog.value.filter(e => e.id !== entryId)
    },
    replaceTerraformingExecutionLog: (entries: TerraformingExecutionEntry[]) => {
      executionLog.value = entries
    },
    clearTerraformingExecutionQueue: () => {
      executionLog.value = []
    },
    mapsClusters: {},
    mapsSectors: {},
    wareNames: computed(() => new Map()),
    moduleGroupNames: computed(() => new Map()),
    wareGroupMap: computed(() => new Map()),
  }
  return { store, executionLog }
}

describe('terraforming event timing — OceanOfFantasy', () => {
  it('non-edit mode: 3 cloud particles auto-trigger solidify after 2nd', () => {
    const cluster = findCluster('OceanOfFantasy')
    const { store } = makeStore(cluster)
    const presenter = useTerraformingPresenter(store)

    // Execute one at a time so events fire at correct positions
    presenter.emits.setProjectCount('tmp_cloudparticles', 1)
    presenter.emits.setProjectCount('tmp_cloudparticles', 2)
    presenter.emits.setProjectCount('tmp_cloudparticles', 3)

    const projectIds = presenter.props.resourcePanel.executionTimeline.value.map(e => e.projectId)
    expect(projectIds).toEqual([
      'tmp_cloudparticles',
      'tmp_cloudparticles',
      'evt_solidify_crust',
      'tmp_cloudparticles',
      'evt_volcano_extinction',
    ])
  })

  it('edit mode: enter edit, project goals at end, commit preserves order', () => {
    const cluster = findCluster('OceanOfFantasy')
    const { store, executionLog } = makeStore(cluster)
    const presenter = useTerraformingPresenter(store)

    // Execute 3 clouds
    presenter.emits.setProjectCount('tmp_cloudparticles', 1)
    presenter.emits.setProjectCount('tmp_cloudparticles', 2)
    presenter.emits.setProjectCount('tmp_cloudparticles', 3)

    presenter.emits.startQueueEdit()

    const planEntries = presenter.props.resourcePanel.queueEditState.planEntries.value
    // Project/cluster goals should be at the end
    const lastTaskEventIdx = planEntries.reduceRight((acc, e, i) => {
      if (acc >= 0) return acc
      return (e.type === 'task' || e.type === 'auto-event') ? i : -1
    }, -1)
    for (const e of planEntries) {
      if (e.type === 'goal' && (e.entry.kind === 'project' || e.entry.kind === 'cluster')) {
        expect(planEntries.indexOf(e)).toBeGreaterThan(lastTaskEventIdx)
      }
    }

    presenter.emits.completeQueueEdit()
    const committedIds = executionLog.value.map(e => e.projectId)
    expect(committedIds).toEqual([
      'tmp_cloudparticles',
      'tmp_cloudparticles',
      'evt_solidify_crust',
      'tmp_cloudparticles',
      'evt_volcano_extinction',
    ])
  })

  it('edit mode: stat goals position between volcano_extinction and academy', () => {
    const cluster = findCluster('OceanOfFantasy')
    const { store } = makeStore(cluster)
    const presenter = useTerraformingPresenter(store)

    // Execute 3 clouds (triggers solidify, volcano_extinction)
    presenter.emits.setProjectCount('tmp_cloudparticles', 1)
    presenter.emits.setProjectCount('tmp_cloudparticles', 2)
    presenter.emits.setProjectCount('tmp_cloudparticles', 3)

    presenter.emits.startQueueEdit()

    // Add academy — should generate stat goals
    presenter.emits.appendDraftTask('ame_pheromone_art_academy')

    const planEntries = presenter.props.resourcePanel.queueEditState.planEntries.value
    const types = planEntries.map(e => e.type)
    const projectIds = planEntries.filter(e => e.type !== 'goal').map(e => e.entry.projectId)

    // volcano_extinction is auto-event, academy is task — both last in sequence
    expect(projectIds[projectIds.length - 2]).toBe('evt_volcano_extinction')
    expect(projectIds[projectIds.length - 1]).toBe('ame_pheromone_art_academy')

    // Stat goals should be between the last auto-event and the last task
    const goalTypes: string[] = []
    let foundVolcano = false
    for (const e of planEntries) {
      if (e.type === 'auto-event' && e.entry.projectId === 'evt_volcano_extinction') {
        foundVolcano = true
        continue
      }
      if (foundVolcano && e.type === 'task' && e.entry.projectId === 'ame_pheromone_art_academy') {
        break
      }
      if (foundVolcano) {
        goalTypes.push(e.entry.kind as string)
      }
    }
    // All entries between volcano and academy must be stat goals
    for (const k of goalTypes) {
      expect(k).toBe('stat')
    }
    expect(goalTypes.length).toBeGreaterThan(0)
  })
})
