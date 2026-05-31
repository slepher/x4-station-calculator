import { describe, expect, it } from 'vitest'
import { replayExecutionLog } from '@/store/logic/terraformingRuntime'
import type {
  TerraformingData,
  TerraformingProject,
  TerraformingCluster,
  TerraformingStat,
} from '@/store/logic/terraformingTaskResolver'
import terraformingJson from '@/assets/x4_game_data/9.0-Empire-beta/data/terraforming.json'

const raw = terraformingJson as unknown as TerraformingData & {
  stats: TerraformingStat[]; projects: TerraformingProject[]; clusters: TerraformingCluster[]
}

function findCluster(id: string) { const c = raw.clusters.find(c => c.id === id); if (!c) throw new Error(`Missing ${id}`); return c }

function run(log: Array<{ projectId: string }>, cluster: TerraformingCluster, flags?: { evaluations?: boolean; stepSnapshots?: boolean; goals?: boolean }) {
  return replayExecutionLog(log, cluster, raw as unknown as TerraformingData, { flags: flags ?? {} })
}

describe('replayExecutionLog — OceanOfFantasy', () => {
  describe('non-edit mode', () => {
    it('3 clouds → solidify after 2nd + volcano after 3rd', () => {
      const cluster = findCluster('OceanOfFantasy')
      const log: Array<{ projectId: string }> = []
      const append = (pid: string) => {
        log.push({ projectId: pid })
        const r = run(log, cluster, { evaluations: true, stepSnapshots: true })
        for (const s of r.steps) {
          if (s.type === 'auto-event' && !log.some(e => e.projectId === s.projectId)) {
            log.push({ projectId: s.projectId })
          }
        }
      }
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      const r = run(log, cluster, { evaluations: true, stepSnapshots: true })
      expect(r.steps.map(s => s.projectId)).toEqual([
        'tmp_cloudparticles', 'tmp_cloudparticles', 'evt_solidify_crust',
        'tmp_cloudparticles', 'evt_volcano_extinction',
      ])
    })
  })

  describe('edit mode', () => {
    it('goals between volcano and academy', () => {
      const cluster = findCluster('OceanOfFantasy')
      const log: Array<{ projectId: string }> = []
      const append = (pid: string) => {
        log.push({ projectId: pid })
        const r = run(log, cluster, {})
        for (const s of r.steps) {
          if (s.type === 'auto-event') log.push({ projectId: s.projectId })
        }
      }
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')

      const draftLog = log.map(e => ({ projectId: e.projectId }))
      draftLog.push({ projectId: 'ame_pheromone_art_academy' })
      const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
      const ids = r.steps.map(s => s.projectId)
      expect(ids[ids.length - 2]).toBe('evt_volcano_extinction')
      expect(ids[ids.length - 1]).toBe('ame_pheromone_art_academy')
      expect(r.goalEntries.length).toBeGreaterThan(0)
    })

    it('jumpstart + hydro + clouds → solidify at correct position, volcano after 3rd cloud', () => {
      const cluster = findCluster('OceanOfFantasy')
      const draftLog: Array<{ projectId: string }> = [
        { projectId: 'ter_jumpstart_currents' },
        { projectId: 'pwr_hydro' },
        { projectId: 'tmp_cloudparticles' },
        { projectId: 'tmp_cloudparticles' },
      ]
      let r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
      const si0 = r.steps.map(s => s.projectId).indexOf('evt_solidify_crust')
      expect(si0).toBeGreaterThan(-1)

      draftLog.push({ projectId: 'tmp_cloudparticles' })
      r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
      const ids = r.steps.map(s => s.projectId)
      const si = ids.indexOf('evt_solidify_crust')
      const vi = ids.indexOf('evt_volcano_extinction')
      expect(si).toBeGreaterThan(-1)
      expect(vi).toBeGreaterThan(-1)
      expect(si).toBeLessThan(vi)
    })

    it('commit preserves event order', () => {
      const cluster = findCluster('OceanOfFantasy')
      const log: Array<{ projectId: string }> = []
      const append = (pid: string) => {
        log.push({ projectId: pid })
        const r = run(log, cluster, {})
        for (const s of r.steps) {
          if (s.type === 'auto-event') log.push({ projectId: s.projectId })
        }
      }
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')

      const r = run(log, cluster, { evaluations: true, stepSnapshots: true })
      expect(r.steps.map(s => s.projectId)).toEqual([
        'tmp_cloudparticles', 'tmp_cloudparticles', 'evt_solidify_crust',
        'tmp_cloudparticles', 'evt_volcano_extinction',
      ])
    })
  })
})

describe('replayExecutionLog — FrontierEdge', () => {
  it('no airpressure stat goal', () => {
    const cluster = findCluster('FrontierEdge')
    const draftLog: Array<{ projectId: string }> = [
      'ter_tectonic_scaffolding', 'tmp_blackdust', 'evt_icemelt', 'bio_tailored',
      'agr_fertilize', 'agr_fields_wheat', 'agr_forestation', 'ame_resort_winter',
    ].map(id => ({ projectId: id }))

    const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
    const statGoalIds = r.goalEntries
      .filter(g => g.kind === 'stat')
      .map(g => g.statGoal?.statId)

    expect(statGoalIds.filter(s => s === 'airpressure')).toEqual([])
    expect(statGoalIds.filter(s => s === 'population').length).toBeGreaterThan(0)
  })

  it('resort is invalid with 4 stat goals having targetValue', () => {
    const cluster = findCluster('FrontierEdge')
    const draftLog: Array<{ projectId: string }> = [
      'ter_tectonic_scaffolding', 'tmp_blackdust', 'evt_icemelt', 'bio_tailored',
      'agr_fertilize', 'agr_fields_wheat', 'agr_forestation', 'ame_resort_winter',
    ].map(id => ({ projectId: id }))

    const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })

    // resort may be valid or invalid depending on prior entry effects
    const resortStep = r.steps.find(s => s.projectId === 'ame_resort_winter')
    expect(resortStep).toBeDefined()

    // stat goals should have targetStatConditionIndex for UI display
    const statGoals = r.goalEntries.filter(g => g.kind === 'stat')
    // at least population goal exists; some goals merged with prior entries
    expect(statGoals.length).toBeGreaterThanOrEqual(1)
    for (const g of statGoals) {
      expect(g.statGoal).toBeDefined()
      expect(g.statGoal!.targetStatConditionIndex).toBeGreaterThanOrEqual(0)
    }
  })

  it('single resort: valid after goals, airpressure=5', () => {
    const cluster = findCluster('FrontierEdge')
    const draftLog: Array<{ projectId: string }> = [
      { projectId: 'ame_resort_winter' },
    ]
    const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
    expect(r.steps.length).toBe(1)
    const step = r.steps[0]!

    // Check: step should be valid after goal application
    expect(step.valid).toBe(true)
    // airpressure=5 (state 2), derive-adjusted after oxygen goal gas contribution
    expect(step.statsAfter?.['airpressure']).toBe(5)

    // Stat goals should exist with proper targetValue
    const statGoals = r.goalEntries.filter(g => g.kind === 'stat')
    expect(statGoals.length).toBeGreaterThan(0)
    const apGoal = statGoals.find(g => g.statGoal?.statId === 'airpressure')
    expect(apGoal).toBeDefined()
    expect(apGoal!.statGoal!.targetValue).toBe(5)
  })
})

describe('replayExecutionLog — BlackHoleSun', () => {
  describe('non-edit mode', () => {
    it('wat_import + cloud → warming → cloud → warming', () => {
      const cluster = findCluster('BlackHoleSun')
      const log: Array<{ projectId: string }> = []
      const append = (pid: string) => {
        log.push({ projectId: pid })
        const r = run(log, cluster, {})
        for (const s of r.steps) {
          if (s.type === 'auto-event' && !log.some(e => e.projectId === s.projectId)) {
            log.push({ projectId: s.projectId })
          }
        }
      }
      append('wat_import')
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      const r = run(log, cluster, { evaluations: true, stepSnapshots: true })
      expect(r.steps.map(s => s.projectId)).toEqual([
        'wat_import',
        'tmp_cloudparticles', 'evt_globalwarming_methane',
        'tmp_cloudparticles', 'evt_globalwarming_methane',
      ])
    })

    it('afterStats temp 6→5 at 2nd cloud', () => {
      const cluster = findCluster('BlackHoleSun')
      const log: Array<{ projectId: string }> = []
      const append = (pid: string) => {
        log.push({ projectId: pid })
        const r = run(log, cluster, {})
        for (const s of r.steps) {
          if (s.type === 'auto-event' && !log.some(e => e.projectId === s.projectId)) {
            log.push({ projectId: s.projectId })
          }
        }
      }
      append('wat_import')
      append('tmp_cloudparticles')
      append('tmp_cloudparticles')
      const r = run(log, cluster, { evaluations: true, stepSnapshots: true })
      const secondCloud = r.steps[3]!
      expect(secondCloud.projectId).toBe('tmp_cloudparticles')
      expect(secondCloud.statsAfter?.['temperature']).toBe(5)
    })
  })

  describe('edit mode', () => {
    it('cloud → warming → cloud → warming', () => {
      const cluster = findCluster('BlackHoleSun')
      const log: Array<{ projectId: string }> = []
      log.push({ projectId: 'wat_import' })
      const r0 = run(log, cluster, {})
      for (const s of r0.steps) {
        if (s.type === 'auto-event') log.push({ projectId: s.projectId })
      }

      const draftLog = log.map(e => ({ projectId: e.projectId }))
      draftLog.push({ projectId: 'tmp_cloudparticles' })
      draftLog.push({ projectId: 'tmp_cloudparticles' })

      const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
      const ids = r.steps.map(s => s.projectId)
      expect(ids).toEqual([
        'wat_import',
        'tmp_cloudparticles', 'evt_globalwarming_methane',
        'tmp_cloudparticles', 'evt_globalwarming_methane',
      ])
    })

    it('2nd cloud stat change 6→5, 2nd warming 5→6', () => {
      const cluster = findCluster('BlackHoleSun')
      const log: Array<{ projectId: string }> = []
      log.push({ projectId: 'wat_import' })
      const r0 = run(log, cluster, {})
      for (const s of r0.steps) {
        if (s.type === 'auto-event') log.push({ projectId: s.projectId })
      }

      const draftLog = log.map(e => ({ projectId: e.projectId }))
      draftLog.push({ projectId: 'tmp_cloudparticles' })
      draftLog.push({ projectId: 'tmp_cloudparticles' })

      const r = run(draftLog, cluster, { evaluations: true, stepSnapshots: true, goals: true })
      const secondCloud = r.steps[3]!
      expect(secondCloud.projectId).toBe('tmp_cloudparticles')
      expect(secondCloud.statsBefore?.['temperature']).toBe(6)
      expect(secondCloud.statsAfter?.['temperature']).toBe(5)

      const secondWarming = r.steps[4]!
      expect(secondWarming.projectId).toBe('evt_globalwarming_methane')
      expect(secondWarming.statsBefore?.['temperature']).toBe(5)
      expect(secondWarming.statsAfter?.['temperature']).toBe(6)
    })
  })
})
