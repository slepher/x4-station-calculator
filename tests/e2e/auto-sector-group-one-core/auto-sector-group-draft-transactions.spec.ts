import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

const GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const HUB = 'cluster_100_sector001_macro'
const COVERAGE = 'cluster_106_sector001_macro'
const BASELINE_ONLY = 'cluster_740_sector001_macro'
const OTHER = 'cluster_715_sector001_macro'
const ARCHIVE_TIME = 667632.933

const ASSIGNMENT_CARD_NAMES = ['水星', '安提亚的不幸 I', '猩红之星', '虚空', '异端的终结']
const INITIAL_ASSIGNMENTS = [
  {
    sectorMacro: COVERAGE,
    status: 'auto',
    defaultGroupId: HUB,
    selectedSectorMacro: HUB,
    selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: HUB, distance: 3, extendsRange: false, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  },
  {
    sectorMacro: 'cluster_26_sector001_macro',
    status: 'auto',
    defaultGroupId: OTHER,
    selectedSectorMacro: OTHER,
    selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: OTHER, distance: 1, extendsRange: false, resultingGroupSize: 10 },
      { type: 'absorb', targetGroupId: 'cluster_24_sector001_macro', distance: 2, extendsRange: false, resultingGroupSize: 10 },
      { type: 'absorb', targetGroupId: 'cluster_48_sector001_macro', distance: 3, extendsRange: false, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  },
  {
    sectorMacro: BASELINE_ONLY,
    status: 'auto',
    defaultGroupId: 'cluster_24_sector001_macro',
    selectedSectorMacro: 'cluster_24_sector001_macro',
    selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: 'cluster_24_sector001_macro', distance: 2, extendsRange: false, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  },
  {
    sectorMacro: 'cluster_27_sector001_macro',
    status: 'auto',
    defaultGroupId: 'cluster_48_sector001_macro',
    selectedSectorMacro: 'cluster_48_sector001_macro',
    selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: 'cluster_48_sector001_macro', distance: 1, extendsRange: false, resultingGroupSize: 10 },
      { type: 'absorb', targetGroupId: HUB, distance: 2, extendsRange: false, resultingGroupSize: 10 },
      { type: 'absorb', targetGroupId: 'cluster_24_sector001_macro', distance: 3, extendsRange: false, resultingGroupSize: 10 },
      { type: 'absorb', targetGroupId: OTHER, distance: 3, extendsRange: false, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  },
  {
    sectorMacro: 'cluster_31_sector001_macro',
    status: 'auto',
    defaultGroupId: 'cluster_601_sector001_macro',
    selectedSectorMacro: 'cluster_601_sector001_macro',
    selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: 'cluster_601_sector001_macro', distance: 1, extendsRange: false, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  }
] as const

function assignmentSnapshot(assignments: any[]) {
  return assignments.map(({ sectorMacro, status, defaultGroupId, selectedSectorMacro, selectedOptionIndex, options }) => ({
    sectorMacro,
    status,
    defaultGroupId,
    selectedSectorMacro,
    selectedOptionIndex,
    options
  }))
}

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups.length ?? 0)).toBeGreaterThan(0)
}
async function openGroups(page: Page) {
  await ready(page)
  await page.getByTestId('sidebar-auto-sector-group').click()
  await expect(page.locator('.auto-sector-bar')).toBeVisible()
}
async function edit(page: Page) { await page.getByRole('button', { name: '编辑', exact: true }).click() }
async function result(page: Page) { return page.evaluate(() => (window as any).liveStore.autoGroupResult) }
async function saved(page: Page) {
  return page.evaluate(guid => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    return JSON.parse(localStorage.getItem(key)!).list.find((item: any) => item.gameGuid === guid)
  }, GUID)
}
function hubCard(page: Page) {
  return page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^小行星带$/ }) })
}
async function appliedFixture(page: Page) {
  await page.evaluate(({ guid, time }) => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    state.list.find((item: any) => item.gameGuid === guid).appliedAutoGroupArchiveTime = time
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, time: ARCHIVE_TIME })
  await page.reload()
  await ready(page)
}
async function baselineReabsorbFixture(page: Page) {
  await page.evaluate(({ guid, hub, time }) => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((item: any) => item.gameGuid === guid)
    binding.appliedAutoGroupArchiveTime = time
    binding.groups = binding.groups.filter((item: any) =>
      item.sectorMacro === hub || item.sectorMacro === 'cluster_601_sector001_macro'
    )
    const group = binding.groups.find((item: any) => item.sectorMacro === hub)
    group.jumpRange = 6
    group.coverageSectorMacros = [{ ref: 'cluster_740_sector001_macro', jump: 6 }]
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, hub: HUB, time: ARCHIVE_TIME })
  await page.reload()
  await ready(page)
}
async function chooseVirtual(page: Page) {
  for (const item of await page.locator('.candidate-item--virtual').all()) await item.click()
}

test.beforeEach(async ({ page }) => { await loadLiveBindingFixture(page) })

test('2.1/2.3/2.4 transfer and assignment ordering follow the edited coverage', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await edit(page)
  const card = hubCard(page)
  const before = (await result(page)).groups.find((g: any) => g.sectorMacro === HUB)
  const names = await page.locator('.allocation-card .card-sector-name').allTextContents()
  expect((await result(page)).groups).toHaveLength(5)
  expect((await result(page)).assignments.map((a: any) => a.sectorMacro)).toEqual([
    COVERAGE, 'cluster_26_sector001_macro', 'cluster_740_sector001_macro', 'cluster_27_sector001_macro', 'cluster_31_sector001_macro'
  ])
  expect((await result(page)).assignments.map((a: any) => a.options.length)).toEqual([2, 4, 2, 5, 2])
  expect(names).toEqual(['水星', '安提亚的不幸 I', '猩红之星', '虚空', '异端的终结'])
  await card.locator('.jump-input').fill('5')
  const destination = page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^阿尔忒弥斯的朦胧$/ }) })
  await destination.locator('.jump-input').fill('5')
  const transfer = destination.locator('.pill--candidate').filter({ has: page.locator('.pill-label').filter({ hasText: /^安提亚的不幸 I$/ }) })
  await expect(transfer.locator('.pill-action--transfer')).toHaveCount(1)
  await transfer.locator('.pill-action--transfer').click()
  const transferred = (await result(page)).groups
  expect(transferred.find((g: any) => g.sectorMacro === OTHER).coverageSectorMacros).toContain('cluster_26_sector001_macro')
  expect(transferred.find((g: any) => g.sectorMacro === 'cluster_24_sector001_macro').coverageSectorMacros).not.toContain('cluster_26_sector001_macro')
  expect((await result(page)).assignments.find((a: any) => a.sectorMacro === 'cluster_26_sector001_macro')).toMatchObject({
    status: 'auto', defaultGroupId: OTHER, selectedSectorMacro: OTHER, selectedOptionIndex: 0,
    options: [
      { type: 'absorb', targetGroupId: OTHER, distance: 1, extendsRange: false },
      { type: 'absorb', targetGroupId: 'cluster_24_sector001_macro', distance: 2, extendsRange: false },
      { type: 'absorb', targetGroupId: 'cluster_48_sector001_macro', distance: 3, extendsRange: false },
      { type: 'absorb', targetGroupId: HUB, distance: 4, extendsRange: false },
      { type: 'standalone', distance: 0, extendsRange: false }
    ]
  })
  await card.locator('.jump-input').fill('0')
  const zero = (await result(page)).groups.find((g: any) => g.sectorMacro === HUB)
  expect(zero).toMatchObject({ jumpRange: 0, coverageSectorMacros: [], connectedGroupIds: before.connectedGroupIds })
  expect((await result(page)).groups.filter((g: any) => g.sectorMacro === OTHER)).toHaveLength(1)
  expect((await result(page)).groups.find((g: any) => g.sectorMacro === OTHER)).toMatchObject({ coverageSectorMacros: ['cluster_26_sector001_macro'], connectedGroupIds: ['cluster_24_sector001_macro', 'cluster_48_sector001_macro'] })
  await card.locator('.jump-input').fill('3')
  expect((await result(page)).groups.find((g: any) => g.sectorMacro === HUB)).toMatchObject({ jumpRange: 3, coverageSectorMacros: [COVERAGE], connectedGroupIds: before.connectedGroupIds })
  expect(await page.locator('.allocation-card .card-sector-name').allTextContents()).toEqual(['水星', '猩红之星', '安提亚的不幸 I', '虚空', '异端的终结'])
})

test('2.5/2.6/3.2/6.3 standalone choice is explicit and other cards remain unchanged', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  const card = page.locator('.allocation-card').filter({ has: page.locator('.card-sector-name').filter({ hasText: /^水星$/ }) })
  expect(await page.locator('.allocation-card .card-sector-name').allTextContents()).toEqual(ASSIGNMENT_CARD_NAMES)
  expect(assignmentSnapshot((await result(page)).assignments)).toEqual(INITIAL_ASSIGNMENTS)
  await card.locator('.option-row').last().click()
  await expect(card.locator('.option-row').last()).toHaveClass(/option-selected/)
  expect((await result(page)).assignments.find((a: any) => a.sectorMacro === COVERAGE).selectedSectorMacro).toBe(COVERAGE)
  expect(await page.locator('.allocation-card .card-sector-name').allTextContents()).toEqual(ASSIGNMENT_CARD_NAMES)
  expect(assignmentSnapshot((await result(page)).assignments.filter((a: any) => a.sectorMacro !== COVERAGE)))
    .toEqual(INITIAL_ASSIGNMENTS.filter((a) => a.sectorMacro !== COVERAGE))
  expect((await result(page)).groups.filter((g: any) => g.sectorMacro === COVERAGE)).toHaveLength(1)
  await card.locator('.option-row').last().click()
  expect((await result(page)).groups.filter((g: any) => g.sectorMacro === COVERAGE)).toHaveLength(1)
})

test('6.3 clean slate exposes standalone-only assignments without an automatic selection', async ({ page }) => {
  await page.evaluate(guid => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    state.list.find((item: any) => item.gameGuid === guid).groups = []
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload()
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult)).toBeTruthy()
  const assignments = await page.evaluate(() => (window as any).liveStore.autoGroupResult.assignments)
  const standaloneOnly = assignments.find((a: any) => a.sectorMacro === COVERAGE)
  expect(standaloneOnly).toMatchObject({
    sectorMacro: COVERAGE,
    selectedOptionIndex: null,
    options: [{ type: 'standalone', distance: 0 }]
  })
  expect(standaloneOnly.options).toHaveLength(1)
})

test('2.5/2.6/5.2 recompute expands the minimum layer and keeps the saved baseline until confirm', async ({ page }) => {
  await baselineReabsorbFixture(page)
  await openGroups(page)
  const before = await saved(page)
  expect(before.groups.map((g: any) => g.sectorMacro)).toEqual([HUB, 'cluster_601_sector001_macro'])
  expect(before.groups.find((g: any) => g.sectorMacro === HUB)).toMatchObject({
    jumpRange: 6,
    coverageSectorMacros: [{ ref: BASELINE_ONLY, jump: 6 }]
  })
  await edit(page)
  const baselineGroup = hubCard(page)
  expect((await result(page)).groups.map((g: any) => g.sectorMacro)).toEqual([HUB, 'cluster_601_sector001_macro'])
  expect((await result(page)).groups.find((g: any) => g.sectorMacro === HUB)).toMatchObject({
    jumpRange: 6,
    coverageSectorMacros: [BASELINE_ONLY]
  })
  await baselineGroup.locator('.jump-input').fill('2')
  expect((await result(page)).groups.find((g: any) => g.sectorMacro === HUB)).toMatchObject({
    jumpRange: 2,
    coverageSectorMacros: []
  })
  const baselineAssignment = (await result(page)).assignments.find((a: any) => a.sectorMacro === BASELINE_ONLY)
  expect(baselineAssignment.options.filter((option: any) => option.extendsRange)).toHaveLength(0)
  expect.soft(baselineAssignment).toMatchObject({
    sectorMacro: BASELINE_ONLY,
    selectedSectorMacro: null,
    selectedOptionIndex: null,
    options: [
      { type: 'absorb', targetGroupId: HUB, distance: 6, extendsRange: false },
      { type: 'standalone', distance: 0, extendsRange: false }
    ]
  })
  await page.getByRole('button', { name: '重算', exact: true }).click()
  await page.getByRole('button', { name: '重新计算', exact: true }).click()
  await expect(page.locator('.generate-card')).toBeHidden()
  const draft = await result(page)
  expect(draft.groups.some((g: any) => g.sectorMacro === HUB)).toBe(true)
  expect(draft.assignments.find((a: any) => a.sectorMacro === COVERAGE)).toMatchObject({
    status: 'uncertain_extend',
    selectedSectorMacro: null,
    selectedOptionIndex: null,
    options: [
      { type: 'absorb', targetGroupId: HUB, distance: 3, extendsRange: true, resultingGroupSize: 10 },
      { type: 'standalone', distance: 0, extendsRange: false, resultingGroupSize: 1 }
    ]
  })
  expect(draft.groups.find((g: any) => g.sectorMacro === HUB).jumpRange).toBe(2)
  expect(await saved(page)).toEqual(before)
  await page.getByRole('button', { name: '查看', exact: true }).click()
  expect(await page.evaluate(() => (window as any).liveStore.calcBaselinePillState)).toBeTruthy()
})

test('3.2/5.2 manual player hub uses fixed candidate set and removes obsolete group on save/reload', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await edit(page)
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const menu = page.locator('.hub-add-menu--overlay')
  await menu.locator('.hub-add-menu-search-input').fill('水星')
  await menu.locator('.hub-add-menu-item').filter({ hasText: /^水星$/ }).click()
  const added = page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^水星$/ }) })
  await expect(added).toHaveCount(1)
  const draft = await result(page)
  expect(draft.groups.find((g: any) => g.sectorMacro === COVERAGE)).toMatchObject({ id: COVERAGE, isNew: true })
  const manualCard = page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: /^水星$/ }) })
  await expect(manualCard.locator('.candidate-item:not(.candidate-item--virtual) .candidate-name')).toHaveText(['MGO-010'])
  await expect(manualCard.locator('.candidate-item--selected .candidate-name')).toHaveText('MGO-010')
  await added.locator('.state-btn--delete').click()
  await expect(added).toHaveCount(0)
  expect((await result(page)).assignments.map((a: any) => a.sectorMacro)).toContain(COVERAGE)
  await page.locator('.auto-sector-bar .confirm-btn').click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  const after = await saved(page)
  expect(after.groups.map((g: any) => g.sectorMacro)).not.toContain(COVERAGE)
  await page.reload()
  await ready(page)
  expect((await saved(page)).groups.map((g: any) => g.sectorMacro)).not.toContain(COVERAGE)
})

test('5.2 real connection edit persists while unrelated group identity stays stable', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await edit(page)
  const before = await result(page)
  const target = page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^阿尔忒弥斯的朦胧$/ }) })
  const targetBefore = before.groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro')
  expect(targetBefore).toMatchObject({ jumpRange: 3, coverageSectorMacros: [], connectedGroupIds: ['cluster_24_sector001_macro', 'cluster_48_sector001_macro'], selectedTradeStation: { type: 'player', stationCode: 'BHW-834' } })
  const connectionPill = target.locator('.pill--connected').filter({ hasText: /月之舟/ })
  await expect(connectionPill).toHaveCount(1)
  await connectionPill.locator('.pill-action--remove').click()
  const removed = (await result(page)).groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro')
  expect(removed).toMatchObject({ jumpRange: 3, coverageSectorMacros: [], connectedGroupIds: ['cluster_24_sector001_macro'] })
  const current = await result(page)
  expect(current.groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro')).toMatchObject({ jumpRange: 3, coverageSectorMacros: [], connectedGroupIds: ['cluster_24_sector001_macro'], selectedTradeStation: { type: 'player', stationCode: 'BHW-834' } })
  expect(current.groups.map((g: any) => g.sectorMacro)).toEqual(before.groups.map((g: any) => g.sectorMacro))
  await chooseVirtual(page)
  const tradeCard = page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: /^阿尔忒弥斯的朦胧$/ }) })
  await tradeCard.locator('.candidate-item').filter({ has: page.locator('.candidate-name').filter({ hasText: /^BHW-834$/ }) }).click()
  await expect(page.locator('.auto-sector-bar .confirm-btn')).toBeEnabled()
  await page.locator('.auto-sector-bar .confirm-btn').click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  const persisted = await saved(page)
  expect(persisted.groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro')).toMatchObject({ jumpRange: 3, coverageSectorMacros: [], connectedGroupIds: ['cluster_24_sector001_macro'], tradeStation: { saveStationCode: 'BHW-834' } })
  await page.reload()
  await ready(page)
  expect((await saved(page)).groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro')).toMatchObject({ jumpRange: 3, coverageSectorMacros: [], connectedGroupIds: ['cluster_24_sector001_macro'], tradeStation: { saveStationCode: 'BHW-834' } })
})
