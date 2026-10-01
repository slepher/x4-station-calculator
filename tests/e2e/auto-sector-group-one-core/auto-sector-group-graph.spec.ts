import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'
import maps from '../../../src/assets/x4_game_data/9.0-Empire/data/maps.json' with { type: 'json' }

const GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const ARCHIVE_TIME = 667632.933
const A = 'cluster_100_sector001_macro'
const B = 'cluster_24_sector001_macro'
const C = 'cluster_715_sector001_macro'
const D = 'cluster_48_sector001_macro'
const T = 'cluster_106_sector001_macro'
const X = 'cluster_31_sector001_macro'
const Y = 'cluster_27_sector001_macro'
const LANE_A = 'cluster_112_sector001_macro'
const LANE_B = 'cluster_112_sector002_macro'
const CONTAINER = 'storage_arg_l_container_01_macro'
const PRODUCTION = 'prod_arg_foodrations_macro'
const TEMPLATE_STATION = 'KXN-018'

type StationDef = { sectorMacro: string; code: string; containers?: number; production?: number }
type Edge = [string, string, 1 | 2]
type Distance = [string, string, number]
const archiveTemplates = new WeakMap<Page, any>()

function buildArchive(current: any, definitions: StationDef[], meta: Record<string, unknown> = {}) {
  if (!current?.sectors || typeof current.sectors !== 'object') throw new Error('archive fixture has no sectors object')
  const templateSector = current.sectors[A]
  if (!templateSector || typeof templateSector !== 'object') throw new Error(`archive fixture has no template sector ${A}`)
  const playerStations = templateSector.player_stations
  if (!playerStations || typeof playerStations !== 'object') throw new Error(`template sector ${A} has no player_stations object`)
  const templateStation = playerStations[TEMPLATE_STATION]
  if (!templateStation || typeof templateStation !== 'object') throw new Error(`template sector ${A} has no template station ${TEMPLATE_STATION}`)
  const bySector = new Map<string, StationDef[]>()
  for (const definition of definitions) {
    const list = bySector.get(definition.sectorMacro) ?? []
    list.push(definition)
    bySector.set(definition.sectorMacro, list)
  }
  const sectors = Object.fromEntries([...bySector.entries()].map(([sectorMacro, stations]) => [sectorMacro, {
    ...templateSector,
    name: sectorMacro,
    player_stations: Object.fromEntries(stations.map((definition, index) => [definition.code, {
      code: definition.code,
      macro: templateStation.macro,
      owner: 'player',
      component_id: `graph-${definition.code}`,
      zone_id: `graph-zone-${index}`,
      relative_position: { x: index * 1000, y: 0, z: 0 },
      position: { x: index * 1000, y: 0, z: 0, tx: 0, ty: 0 },
      constructions: [],
      modules: [
        ...(definition.containers ? [{ ref: CONTAINER, amount: definition.containers, module_id: 'module_arg_stor_container_l_01', type: 'storage', group: 'storage' }] : []),
        ...(definition.production ? [{ ref: PRODUCTION, amount: definition.production, module_id: 'module_arg_prod_foodrations_01', type: 'production', group: 'agricultural' }] : [])
      ],
      equipments: []
    }]))
  }]))
  return { ...current, meta: { ...current.meta, ...meta }, sectors }
}

function savedGroup(sectorMacro: string, order: number, connectedGroupIds: string[] = []) {
  return {
    name: `GRAPH-${order}`,
    order,
    sectorMacro,
    jumpRange: 3,
    coverageSectorMacros: [],
    connectedGroupIds,
    color: ['#f44e3b', '#0f8554', '#3b6ef4', '#af52de'][order - 1]
  }
}

function buildReachability(macros: string[], distances: Distance[]) {
  const result: Record<string, Record<string, number>> = Object.fromEntries(macros.map(macro => [macro, { [macro]: 0 }]))
  for (const [from, to, distance] of distances) {
    result[from]![to] = distance
    result[to]![from] = distance
  }
  return result
}

async function installBinding(page: Page, groups: any[], archiveTime = ARCHIVE_TIME) {
  await page.evaluate(({ guid, groups, archiveTime }) => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    let binding = state.list.find((item: any) => item.gameGuid === guid)
    if (!binding) {
      binding = { gameGuid: guid, bindingName: 'M3.1 graph', selectedArchiveTime: archiveTime, groups: [], stationPlans: [], updatedAt: 1 }
      state.list.push(binding)
    }
    binding.selectedArchiveTime = archiveTime
    binding.groups = groups
    binding.stationPlans = []
    if (groups.length > 0) binding.appliedAutoGroupArchiveTime = archiveTime
    else delete binding.appliedAutoGroupArchiveTime
    localStorage.setItem(key, JSON.stringify(state))
    localStorage.setItem('x4_station_active_view', JSON.stringify({ activeBinding: guid, activeView: 'live-production' }))
  }, { guid: GUID, groups, archiveTime })
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 2000 })
  await page.evaluate(async guid => {
    const w = window as any
    w.activeViewStore.activeBinding = guid
    await w.liveStore.activateBinding(guid)
  }, GUID)
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups.length ?? 0)).toBeGreaterThan(0)
}

async function installGraph(page: Page, macros: string[], edges: Edge[], distances: Distance[]) {
  await page.evaluate(({ macros, edges, reachability }) => {
    const w = window as any
    const sourceMaps = w.gameDataStore.maps
    if (!sourceMaps?.sectors || typeof sourceMaps.sectors !== 'object') throw new Error('game maps fixture has no sectors object')
    for (const macro of macros) {
      if (!sourceMaps.sectors[macro]) throw new Error(`game maps fixture has no sector ${macro}`)
    }
    const sectors = Object.fromEntries(macros.map((macro: string, index: number) => [macro, {
      ...sourceMaps.sectors[macro],
      id: macro,
      macro,
      cluster_id: `graph_cluster_${index}`,
      cluster_gates: {}
    }]))
    const clusters: Record<string, any> = Object.fromEntries(macros.map((macro: string, index: number) => [`graph_cluster_${index}`, {
      id: `graph_cluster_${index}`,
      sectors: [macro],
      sector_links: {}
    }]))
    clusters.graph_links = {
      id: 'graph_links',
      sectors: [],
      sector_links: Object.fromEntries(edges.map(([from, to, laneCount]: Edge, index: number) => [`graph_link_${index}`, {
        sector_a_id: from,
        sector_b_id: to,
        render: { lane_count: laneCount }
      }]))
    }
    w.gameDataStore.maps = { ...sourceMaps, sectors, clusters }
    w.gameDataStore.sectorReachability = reachability
  }, { macros, edges, reachability: buildReachability(macros, distances) })
}

async function loadScenario(page: Page, definitions: StationDef[], groups: any[], macros: string[], edges: Edge[], distances: Distance[]) {
  let template = archiveTemplates.get(page)
  if (!template) {
    template = await page.evaluate(() => (window as any).saveStore.selectedArchive)
    if (!template || typeof template !== 'object') throw new Error('selected archive template is missing')
    archiveTemplates.set(page, template)
  }
  await loadLiveBindingFixture(page, {
    transformSave: current => current.meta.guid === GUID ? buildArchive(template, definitions) : current
  })
  await installBinding(page, groups)
  await installGraph(page, macros, edges, distances)
}

async function open(page: Page) {
  await page.getByTestId('sidebar-auto-sector-group').click()
  await expect(page.locator('.auto-sector-bar')).toBeVisible()
}

async function result(page: Page) {
  return page.evaluate(() => (window as any).liveStore.autoGroupResult)
}

async function recalculate(page: Page, options: { generateNodes: boolean; ignoreCurrent?: boolean }) {
  await page.getByRole('button', { name: '重算', exact: true }).click()
  const generateCard = page.locator('.generate-card:visible')
  await expect(generateCard).toBeVisible()
  const nodeCheckbox = generateCard.locator('.param-field').filter({ hasText: '节点' }).locator('input[type="checkbox"]')
  if (await nodeCheckbox.isChecked() !== options.generateNodes) await nodeCheckbox.setChecked(options.generateNodes)
  if (options.ignoreCurrent) await generateCard.getByRole('button', { name: '忽略当前节点', exact: true }).click()
  await generateCard.getByRole('button', { name: '重新计算', exact: true }).click()
  await expect(generateCard).toBeHidden()
}

async function cardForSector(page: Page, sectorMacro: string) {
  const index = (await result(page)).groups.findIndex((group: any) => group.sectorMacro === sectorMacro)
  expect(index).toBeGreaterThanOrEqual(0)
  return page.locator('.group-item').nth(index)
}

test.beforeEach(async ({ page }) => {
  await loadLiveBindingFixture(page)
})

test('1.1 clean slate creates fixed hubs, coverage and ordinary assignment through generate UI', async ({ page }) => {
  await loadScenario(page, [
    { sectorMacro: A, code: 'CLEAN-A', containers: 10 },
    { sectorMacro: B, code: 'CLEAN-B', containers: 6 },
    { sectorMacro: T, code: 'CLEAN-T', production: 1 }
  ], [], [A, B, T], [], [[A, B, 3], [A, T, 1], [B, T, 2]])
  await open(page)
  await recalculate(page, { generateNodes: true, ignoreCurrent: true })

  const current = await result(page)
  expect(current.groups.map((group: any) => group.sectorMacro)).toEqual([A, B])
  expect(current.groups.every((group: any) => group.isNew && group.source === 'auto')).toBe(true)
  expect(current.groups.find((group: any) => group.sectorMacro === A).coverageSectorMacros).toEqual([T])
  expect(current.groups.map((group: any) => [group.sectorMacro, [...group.connectedGroupIds].sort()])).toEqual([[A, [B]], [B, [A]]])
  const assignment = current.assignments.find((item: any) => item.sectorMacro === T)
  expect(assignment.status).toBe('auto')
  expect(assignment.defaultGroupId).toBe(A)
  await expect(page.locator('.allocation-card')).toHaveCount(1)
})

test('1.2.3 selecting a later save adds exactly one player sector to the incremental graph', async ({ page }) => {
  const oldTime = 700_100
  const newTime = 700_200
  const processed = await page.evaluate(() => (window as any).saveStore.selectedArchive)
  await loadLiveBindingFixture(page, {
    transformSaves: saves => {
      const source = saves.find(save => save.meta.guid === GUID)
      if (!source) throw new Error('M3.1 graph source save missing')
      const others = saves.filter(save => save.meta.guid !== GUID)
      return [
        ...others,
        buildArchive(processed, [{ sectorMacro: A, code: 'INC-A', production: 1 }], { time: oldTime, filename: 'graph_before' }),
        buildArchive(processed, [{ sectorMacro: A, code: 'INC-A', production: 1 }, { sectorMacro: T, code: 'INC-T', production: 1 }], { time: newTime, filename: 'graph_later' })
      ]
    },
    initialArchiveId: `${GUID}_${oldTime}`
  })
  await installBinding(page, [savedGroup(A, 1)], oldTime)
  await open(page)
  expect((await result(page)).playerSectorMacros).toEqual([A])

  await page.getByTestId('top-view-btn-maps').click()
  await page.getByTestId('map-save-panel-tab').click()
  const laterSave = page.getByTestId('map-save-panel').locator('.save-item').filter({ hasText: 'graph_later' })
  await laterSave.getByTestId('save-time-bind').click()
  await expect.poll(() => page.evaluate(() => (window as any).saveStore.selectedArchive?.meta.time)).toBe(newTime)
  await page.getByTestId('top-view-btn-live-production').click()
  await expect.poll(() => page.evaluate(() => (window as any).saveStore.selectedArchive?.meta.time)).toBe(newTime)
  await installGraph(page, [A, T], [], [[A, T, 1]])
  await page.getByTestId('sidebar-auto-sector-group').click()
  await recalculate(page, { generateNodes: false })

  const current = await result(page)
  expect(current.playerSectorMacros).toEqual([A, T])
  expect(current.groups.map((group: any) => group.sectorMacro)).toEqual([A])
  expect(current.assignments.map((assignment: any) => assignment.sectorMacro)).toEqual([T])
  await expect(page.locator('.allocation-card')).toHaveCount(1)
})

test('1.3.3/1.3.4 static scores drive over-30-percent default and under-30-percent tie', async ({ page }) => {
  const runScoreCase = async (containersB: number) => {
    await loadScenario(page, [
      { sectorMacro: A, code: 'SCORE-A', containers: 20, production: 1 },
      { sectorMacro: B, code: 'SCORE-B', containers: containersB, production: 1 },
      { sectorMacro: T, code: 'SCORE-T', production: 1 }
    ], [], [A, B, T], [], [[A, B, 2], [A, T, 1], [B, T, 1]])
    await open(page)
    await recalculate(page, { generateNodes: true, ignoreCurrent: true })
    return result(page)
  }

  const decisive = await runScoreCase(10)
  const expectedA = 20_000_000 / (1 + Math.log(2))
  const expectedB = 10_000_000 / (1 + Math.log(2))
  expect(decisive.groups.find((group: any) => group.sectorMacro === A).hubScore).toBeCloseTo(expectedA, 5)
  expect(decisive.groups.find((group: any) => group.sectorMacro === B).hubScore).toBeCloseTo(expectedB, 5)
  const decisiveAssignment = decisive.assignments.find((item: any) => item.sectorMacro === T)
  expect(decisiveAssignment.status).toBe('auto')
  expect(decisiveAssignment.defaultGroupId).toBe(A)

  const tied = await runScoreCase(16)
  const expectedTieB = 16_000_000 / (1 + Math.log(2))
  expect(tied.groups.find((group: any) => group.sectorMacro === B).hubScore).toBeCloseTo(expectedTieB, 5)
  const tiedAssignment = tied.assignments.find((item: any) => item.sectorMacro === T)
  expect(tiedAssignment.status).toBe('uncertain_tie')
  expect(tiedAssignment.selectedOptionIndex).toBeNull()
  expect(tiedAssignment.options.map((option: any) => option.type)).toEqual(['absorb', 'absorb', 'standalone'])
  await expect(page.locator('.allocation-card.card-uncertain')).toHaveCount(1)
})

test('1.4 fixed distances produce the exact symmetric MST and exclude the over-range edge', async ({ page }) => {
  await loadScenario(page, [
    { sectorMacro: A, code: 'MST-A', production: 1 }, { sectorMacro: B, code: 'MST-B', production: 1 }, { sectorMacro: C, code: 'MST-C', production: 1 }
  ], [savedGroup(A, 1), savedGroup(B, 2), savedGroup(C, 3)], [A, B, C], [], [[A, B, 1], [B, C, 2]])
  await open(page)
  await recalculate(page, { generateNodes: false })

  const current = await result(page)
  expect(current.groups.map((group: any) => [group.sectorMacro, [...group.connectedGroupIds].sort()])).toEqual([
    [A, [B]], [B, [A, C].sort()], [C, [B]]
  ])
  expect(current.groups.find((group: any) => group.sectorMacro === A).connectedGroupIds).not.toContain(C)
})

test('1.5 one bridge auto-applies while two bridge plans gate assignments until UI selection', async ({ page }) => {
  await loadScenario(page, [
    { sectorMacro: A, code: 'BRIDGE-A', production: 1 }, { sectorMacro: B, code: 'BRIDGE-B', production: 1 }, { sectorMacro: X, code: 'BRIDGE-X', production: 1 }
  ], [savedGroup(A, 1), savedGroup(B, 2)], [A, B, X], [], [[A, X, 1], [B, X, 1]])
  await open(page)
  await recalculate(page, { generateNodes: false })
  const single = await result(page)
  expect(single.bridgePlans).toHaveLength(1)
  expect(single.bridgePlans[0].selected).toBe(true)
  expect(single.groups.filter((group: any) => group.source === 'bridge').map((group: any) => group.sectorMacro)).toEqual([X])
  await expect(page.locator('.bridge-plan-card')).toHaveCount(0)

  await loadScenario(page, [
    { sectorMacro: A, code: 'BRIDGE-A', production: 1 }, { sectorMacro: B, code: 'BRIDGE-B', production: 1 },
    { sectorMacro: X, code: 'BRIDGE-X', production: 1 }, { sectorMacro: Y, code: 'BRIDGE-Y', production: 1 }
  ], [savedGroup(A, 1), savedGroup(B, 2)], [A, B, X, Y], [], [[A, X, 1], [B, X, 1], [A, Y, 1], [B, Y, 1]])
  await open(page)
  await recalculate(page, { generateNodes: false })
  const multiple = await result(page)
  expect(multiple.bridgePlans).toHaveLength(2)
  expect(multiple.selectedBridgePlanId).toBeUndefined()
  await expect(page.locator('.bridge-plan-card')).toHaveCount(2)
  await expect(page.locator('.allocation-card')).toHaveCount(0)
  const confirmWasDisabled = await page.locator('.auto-sector-bar .confirm-btn').isDisabled()
  await page.locator('.bridge-plan-select').first().click()
  const selected = await result(page)
  expect(selected.selectedBridgePlanId).toBe(multiple.bridgePlans[0].id)
  expect(selected.groups.filter((group: any) => group.source === 'bridge')).toHaveLength(1)
  await expect(page.locator('.bridge-plan-card')).toHaveCount(0)
  await expect(page.locator('.allocation-card')).toHaveCount(1)
  expect(confirmWasDisabled).toBe(true)
})

test('6.2 the fixed lane_count=1 superhighway endpoints never form a transport edge', async ({ page }) => {
  const lane = Object.values((maps as any).clusters).flatMap((cluster: any) => Object.values(cluster.sector_links ?? {}))
    .find((link: any) => link.sector_a_id === LANE_A && link.sector_b_id === LANE_B) as any
  expect(lane).toMatchObject({ sector_a_id: LANE_A, sector_b_id: LANE_B, render: { lane_count: 1 } })
  await loadScenario(page, [
    { sectorMacro: LANE_A, code: 'LANE-A', production: 1 }, { sectorMacro: LANE_B, code: 'LANE-B', production: 1 }
  ], [savedGroup(LANE_A, 1), savedGroup(LANE_B, 2)], [LANE_A, LANE_B], [[LANE_A, LANE_B, 1]], [])
  await open(page)
  await recalculate(page, { generateNodes: false })
  expect((await result(page)).groups.map((group: any) => [group.sectorMacro, group.connectedGroupIds])).toEqual([[LANE_A, []], [LANE_B, []]])
})

test('6.4 unpin preserves the baseline card until recompute then excludes it from input', async ({ page }) => {
  await loadScenario(page, [{ sectorMacro: B, code: 'UNPIN-B', production: 1 }], [savedGroup(A, 1), savedGroup(B, 2)], [A, B], [], [])
  await open(page)
  const card = await cardForSector(page, A)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await card.locator('.state-btn--pinned').click()
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === A).isPinned).toBe(false)
  await page.getByRole('button', { name: '重算', exact: true }).click()
  await expect(card.locator('.retain-chk input')).toHaveCount(3)
  await expect(card.locator('.retain-chk input:disabled')).toHaveCount(3)
  const generateCard = page.locator('.generate-card:visible')
  await generateCard.getByRole('button', { name: '重新计算', exact: true }).click()
  await expect(generateCard).toBeHidden()
  expect((await result(page)).groups.map((group: any) => group.sectorMacro)).toEqual([B])
})

test('6.5 disabling connection retain at both endpoints drops the old edge before natural MST', async ({ page }) => {
  await loadScenario(page, [
    { sectorMacro: A, code: 'RETAIN-A', production: 1 }, { sectorMacro: B, code: 'RETAIN-B', production: 1 }, { sectorMacro: C, code: 'RETAIN-C', production: 1 }
  ], [savedGroup(A, 1, [B]), savedGroup(B, 2, [A]), savedGroup(C, 3)], [A, B, C], [], [[A, B, 3], [A, C, 1], [B, C, 1]])
  await open(page)
  expect((await result(page)).groups.map((group: any) => [group.sectorMacro, group.connectedGroupIds])).toEqual([[A, [B]], [B, [A]], [C, []]])
  await page.getByRole('button', { name: '重算', exact: true }).click()
  const generateCard = page.locator('.generate-card:visible')
  for (const macro of [A, B]) {
    const card = await cardForSector(page, macro)
    await card.locator('label[title="保留当前桥接"] input').uncheck()
  }
  await generateCard.getByRole('button', { name: '重新计算', exact: true }).click()
  await expect(generateCard).toBeHidden()
  expect((await result(page)).groups.map((group: any) => [group.sectorMacro, [...group.connectedGroupIds].sort()])).toEqual([
    [A, [C]], [B, [C]], [C, [A, B].sort()]
  ])
})

test('6.8 a six-jump player sector has only standalone and cannot enter MST or bridge plans', async ({ page }) => {
  const chain = [A, B, C, D, X, Y, T]
  const edges: Edge[] = chain.slice(0, -1).map((macro, index) => [macro, chain[index + 1]!, 2])
  const withinFive: Distance[] = chain.slice(1, 6).map((macro, index) => [A, macro, index + 1])
  expect(edges).toHaveLength(6)
  await loadScenario(page, [
    { sectorMacro: A, code: 'FAR-A', production: 1 }, { sectorMacro: T, code: 'FAR-T', production: 1 }
  ], [savedGroup(A, 1)], chain, edges, withinFive)
  await open(page)
  await recalculate(page, { generateNodes: false })

  const current = await result(page)
  const assignment = current.assignments.find((item: any) => item.sectorMacro === T)
  expect(assignment.status).toBe('unresolved_no_candidate')
  expect(assignment.selectedOptionIndex).toBeNull()
  expect(assignment.options).toEqual([{ type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }])
  expect(current.groups).toHaveLength(1)
  expect(current.groups[0].connectedGroupIds).toEqual([])
  expect(current.bridgePlans).toEqual([])
  await expect(page.locator('.allocation-card .option-row')).toHaveCount(1)
  await expect(page.locator('.allocation-card .option-row')).toContainText('独立成组')
})
