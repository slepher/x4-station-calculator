import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
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
import { computeTerraformingRuntimeStats } from '@/store/logic/terraformingRuntime'
import terraformingJson from '@/assets/x4_game_data/9.0-Empire-beta/data/terraforming.json'

const raw = terraformingJson as unknown as TerraformingData & {
  stats: TerraformingStat[]; projects: TerraformingProject[]; clusters: TerraformingCluster[]
}

function findCluster(id: string) { const c = raw.clusters.find(c => c.id === id); if (!c) throw new Error(`Missing ${id}`); return c }

function makeStore(cluster: TerraformingCluster) {
  const executionLog = ref<TerraformingExecutionEntry[]>([])
  let seq = 0
  const store: TerraformingPresenterStore = {
    terraformingData: computed(() => raw as unknown as TerraformingData),
    terraformingSelectedClusterId: computed(() => cluster.id),
    terraformingSelectedCluster: computed(() => cluster),
    terraformingCurrentStats: computed(() => {
      const m = new Map<string, number>(); for (const e of executionLog.value) m.set(e.projectId, (m.get(e.projectId) ?? 0) + 1)
      return computeTerraformingRuntimeStats(cluster, m, raw as unknown as TerraformingData)
    }),
    terraformingRuntimeProjectIds: computed(() => cluster.taskProjectIds),
    terraformingCompletedProjects: computed(() => {
      const m = new Map<string, number>(); for (const e of executionLog.value) m.set(e.projectId, (m.get(e.projectId) ?? 0) + 1); return m
    }),
    terraformingExecutionLog: computed(() => executionLog.value),
    terraformingHqStationName: computed(() => ''), terraformingHqArchiveStation: computed(() => null),
    terraformingHqEffectiveModules: computed(() => []), terraformingHqClusterId: computed(() => null),
    selectTerraformingCluster: () => {}, setTerraformingCompletedProjects: () => {},
    appendTerraformingProjectExecution: (pid: string, c = 1) => { for (let i = 0; i < c; i++) executionLog.value = [...executionLog.value, { id: `${cluster.id}-exec-${++seq}`, projectId: pid }] },
    setTerraformingProjectCount: () => {}, removeTerraformingExecutionEntry: (eid: string) => { executionLog.value = executionLog.value.filter(e => e.id !== eid) },
    replaceTerraformingExecutionLog: (e: TerraformingExecutionEntry[]) => { executionLog.value = e },
    clearTerraformingExecutionQueue: () => { executionLog.value = [] },
    mapsClusters: {}, mapsSectors: {}, wareNames: computed(() => new Map()), moduleGroupNames: computed(() => new Map()), wareGroupMap: computed(() => new Map()),
  }
  return { store, executionLog }
}

describe('terraforming event timing — OceanOfFantasy', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    // Ensure GameDataStore has waresMap available
    const { useGameDataStore } = await import('@/store/useGameDataStore')
    const gds = useGameDataStore()
    gds.waresMap = {} as any
    gds.moduleGroupNames = {} as any
    gds.localizedModulesMap = {} as any
    gds.modulesMap = {} as any
    gds.wareNames = computed(() => new Map())
  })
  it('non-edit: 3 clouds → solidify after 2nd + volcano after 3rd', () => {
    const { store } = makeStore(findCluster('OceanOfFantasy'))
    const p = useTerraformingPresenter(store)
    p.emits.setProjectCount('tmp_cloudparticles', 1)
    p.emits.setProjectCount('tmp_cloudparticles', 2)
    p.emits.setProjectCount('tmp_cloudparticles', 3)
    expect(p.props.resourcePanel.executionTimeline.value.map(e => e.projectId)).toEqual([
      'tmp_cloudparticles', 'tmp_cloudparticles', 'evt_solidify_crust', 'tmp_cloudparticles', 'evt_volcano_extinction',
    ])
  })

  it('edit mode: enter → project goals interleaved → commit preserves order', () => {
    const { store } = makeStore(findCluster('OceanOfFantasy'))
    const p = useTerraformingPresenter(store)
    p.emits.setProjectCount('tmp_cloudparticles', 1)
    p.emits.setProjectCount('tmp_cloudparticles', 2)
    p.emits.setProjectCount('tmp_cloudparticles', 3)
    p.emits.startQueueEdit()
    p.emits.completeQueueEdit()
    expect(store.terraformingExecutionLog.value.map(e => e.projectId)).toEqual([
      'tmp_cloudparticles', 'tmp_cloudparticles', 'evt_solidify_crust', 'tmp_cloudparticles', 'evt_volcano_extinction',
    ])
  })

  it('edit mode: stat goals between volcano and academy', () => {
    const { store } = makeStore(findCluster('OceanOfFantasy'))
    const p = useTerraformingPresenter(store)
    p.emits.setProjectCount('tmp_cloudparticles', 1)
    p.emits.setProjectCount('tmp_cloudparticles', 2)
    p.emits.setProjectCount('tmp_cloudparticles', 3)
    p.emits.startQueueEdit()
    p.emits.appendDraftTask('ame_pheromone_art_academy')

    const plan = p.props.resourcePanel.queueEditState.planEntries.value
    const ids = plan.filter(e => e.type !== 'goal').map(e => e.entry.projectId)
    expect(ids[ids.length - 2]).toBe('evt_volcano_extinction')
    expect(ids[ids.length - 1]).toBe('ame_pheromone_art_academy')

    let found = false, kinds: string[] = []
    for (const e of plan) {
      if (e.type === 'auto-event' && e.entry.projectId === 'evt_volcano_extinction') { found = true; continue }
      if (found && e.type === 'task' && e.entry.projectId === 'ame_pheromone_art_academy') break
      if (found && e.type === 'goal') kinds.push(e.entry.kind as string)
    }
    expect(kinds.length).toBeGreaterThan(0)
    for (const k of kinds) expect(k).toBe('stat')
  })

  it('edit mode: jumpstart + hydro + clouds → solidify at correct position, volcano after 3rd cloud', () => {
    const { store } = makeStore(findCluster('OceanOfFantasy'))
    const p = useTerraformingPresenter(store)
    p.emits.startQueueEdit()

    p.emits.appendDraftTask('ter_jumpstart_currents')
    p.emits.appendDraftTask('pwr_hydro')
    p.emits.appendDraftTask('tmp_cloudparticles')
    p.emits.appendDraftTask('tmp_cloudparticles')

    let ids = p.props.resourcePanel.queueEditState.planEntries.value
      .filter(e => e.type !== 'goal').map(e => e.entry.projectId)
    expect(ids.indexOf('evt_solidify_crust')).toBeGreaterThan(-1)

    // Add 3rd cloud
    p.emits.appendDraftTask('tmp_cloudparticles')
    ids = p.props.resourcePanel.queueEditState.planEntries.value
      .filter(e => e.type !== 'goal').map(e => e.entry.projectId)

    const si = ids.indexOf('evt_solidify_crust')
    const vi = ids.indexOf('evt_volcano_extinction')
    expect(si).toBeGreaterThan(-1)
    expect(vi).toBeGreaterThan(-1)
    expect(si).toBeLessThan(vi)
  })
})

describe('terraforming event timing — FrontierEdge', () => {
  beforeEach(async () => { setActivePinia(createPinia()); const { useGameDataStore } = await import('@/store/useGameDataStore'); const g = useGameDataStore(); g.waresMap = {} as any; g.moduleGroupNames = {} as any; g.localizedModulesMap = {} as any; g.modulesMap = {} as any; g.wareNames = computed(() => new Map()) })

  it('edit mode: no airpressure stat goal', () => {
    const cluster = findCluster('FrontierEdge')
    const { store } = makeStore(cluster)
    const p = useTerraformingPresenter(store)
    p.emits.startQueueEdit()

    p.emits.appendDraftTask('ter_tectonic_scaffolding')
    p.emits.appendDraftTask('tmp_blackdust')
    p.emits.appendDraftTask('evt_icemelt')
    p.emits.appendDraftTask('bio_tailored')
    p.emits.appendDraftTask('agr_fertilize')
    p.emits.appendDraftTask('agr_fields_wheat')
    p.emits.appendDraftTask('agr_forestation')
    p.emits.appendDraftTask('ame_resort_winter')

    const planEntries = p.props.resourcePanel.queueEditState.planEntries.value
    const flow = planEntries.filter(e => e.type !== 'goal').map(e => ({ type: e.type, pid: e.entry.projectId }))
    console.log('task+event flow:', JSON.stringify(flow, null, 2))
    const statGoalIds = planEntries
      .filter(e => e.type === 'goal' && e.entry.kind === 'stat')
      .map(e => e.entry.statGoalModel?.statId)

    // Should not have airpressure stat goal
    console.log('statGoalIds:', statGoalIds); expect(statGoalIds.filter(s => s === 'airpressure')).toEqual([])
    // Should have population stat goal (housing)
    expect(statGoalIds.filter(s => s === 'population').length).toBeGreaterThan(0)
  })
})
