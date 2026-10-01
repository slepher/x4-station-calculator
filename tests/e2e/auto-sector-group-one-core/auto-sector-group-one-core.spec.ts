import { readFileSync } from 'node:fs'
import { test } from '../../test-setup'
import { expect, type Page, type Locator } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

const POST_VERSION = readFileSync(new URL('../../../src/workers/saveParser.post.ts', import.meta.url), 'utf8').match(/CURRENT_POST_PROCESSOR_VERSION = '([^']+)'/)![1]!
const GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const HUB = 'cluster_100_sector001_macro'
const COVERAGE = 'cluster_106_sector001_macro'
const VIRTUAL_ID = 'f36126e5-7798-ed14-3c03-938b961efa0b'
const CONTAINER = 'storage_arg_l_container_01_macro' // game data: 1,000,000 m³
const SOLID = 'storage_arg_l_solid_01_macro'
const LIQUID = 'storage_arg_l_liquid_01_macro'
const PRODUCTION = 'prod_arg_foodrations_macro'

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups.length ?? 0), { timeout: 15000 }).toBeGreaterThan(0)
}
async function openGroups(page: Page) {
  await ready(page)
  await page.getByTestId('sidebar-auto-sector-group').click()
  await expect(page.locator('.auto-sector-bar')).toBeVisible()
}
async function edit(page: Page) {
  await page.getByRole('button', { name: '编辑', exact: true }).click()
}
function hubCard(page: Page) {
  return page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^小行星带$/ }) })
}
async function result(page: Page) {
  return page.evaluate(() => (window as any).liveStore.autoGroupResult)
}
async function saved(page: Page) {
  return page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    return JSON.parse(localStorage.getItem(key)!).list.find((item: any) => item.gameGuid === guid)
  }, GUID)
}
// Persisted fixture initialization only; subsequent mutations use the UI.
async function appliedFixture(page: Page, single = false) {
  await page.evaluate(({ guid, hub, single }) => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((item: any) => item.gameGuid === guid)
    binding.appliedAutoGroupArchiveTime = 667632.933
    if (single) {
      binding.groups = binding.groups.filter((group: any) => group.sectorMacro === hub)
      binding.groups[0].connectedGroupIds = []
    }
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, hub: HUB, single })
  await page.reload()
  await ready(page)
}
async function chooseVirtualAndConfirm(page: Page) {
  const choices = page.locator('.candidate-item--virtual')
  expect(await choices.count()).toBeGreaterThan(0)
  for (const choice of await choices.all()) await choice.click()
  const confirm = page.locator('.auto-sector-bar .confirm-btn')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  const popup = page.locator('.confirm-popup')
  if (await popup.isVisible()) {
    await popup.locator('.confirm-popup-button--primary').click()
  }
  await expect(popup).toBeHidden()
  await expect(confirm).toBeDisabled()
}
async function candidateFixture(page: Page, definitions: Array<{ code: string; containers: number; production?: number; construction?: boolean }>) {
  const processed = await page.evaluate(() => (window as any).saveStore.selectedArchive)
  expect(processed.meta.post_processor_version).toBe(POST_VERSION)
  await loadLiveBindingFixture(page, { transformSave: save => {
    if (save.meta.guid !== GUID) return save
    const sector = processed.sectors[HUB]
    const original = sector.player_stations['KXN-018']
    const player_stations = Object.fromEntries(definitions.map(item => [item.code, {
      code: item.code, macro: original.macro, owner: 'player', component_id: `m3-${item.code}`,
      relative_position: original.relative_position, position: original.position, zone_id: original.zone_id,
      modules: [
        { ref: CONTAINER, amount: item.containers, module_id: 'module_arg_stor_container_l_01', type: 'storage', group: 'storage' },
        { ref: SOLID, amount: 50, module_id: 'module_arg_stor_solid_l_01', type: 'storage', group: 'storage' }, { ref: LIQUID, amount: 50, module_id: 'module_arg_stor_liquid_l_01', type: 'storage', group: 'storage' },
        { ref: PRODUCTION, amount: item.production ?? 0, module_id: 'module_arg_prod_foodrations_01', type: 'production', group: 'agricultural' }
      ],
      constructions: item.construction ? [{ id: 'm3-building', index: 1, ref: CONTAINER }] : []
    }]))
    // These enriched module rows are the post-processed fixture; do not regenerate them from construction records.
    return { ...processed, sectors: { ...processed.sectors, [HUB]: { ...sector, player_stations } } }
  } })
  await openGroups(page)
}
async function hubTradeCard(page: Page) {
  const group = (await result(page)).groups.find((item: any) => item.sectorMacro === HUB)
  return page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: new RegExp(`^${group.name}$`) }) })
}
async function addHub(page: Page, name: string) {
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const menu = page.locator('.hub-add-menu--overlay')
  await menu.locator('.hub-add-menu-search-input').fill(name)
  await menu.locator('.hub-add-menu-item').filter({ hasText: new RegExp(`^${name}$`) }).click()
  await expect(menu).toBeHidden()
}
async function dragTo(page: Page, source: Locator, target: Locator) {
  const start = await source.boundingBox()
  const end = await target.boundingBox()
  expect(start).not.toBeNull()
  expect(end).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
  await page.mouse.down()
  await page.mouse.move(start!.x + start!.width / 2 + 12, start!.y + start!.height / 2 + 12, { steps: 4 })
  await expect(source).toHaveClass(/dragging/)
  await page.mouse.move(end!.x + end!.width * 0.65, end!.y + end!.height * 0.6, { steps: 20 })
  await expect(page.locator('.placement-preview--binding')).toBeVisible()
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await loadLiveBindingFixture(page)
})

test('1.2/2.1/2.2/6.4 saved baseline 展示、编辑与 unpin 保留身份', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  const card = hubCard(page)
  await expect(card.locator('.group-name')).toHaveText('小行星带')
  await expect(card.locator('.jump-readonly')).toHaveText('3')
  await expect(card.locator('.pill--trade-station')).toContainText('虚拟交易站')
  await expect(card.locator('.retain-chk')).toHaveCount(0)
  await expect(card.locator('.state-btn--pinned')).toBeEnabled()
  await edit(page)
  await expect(card.locator('.retain-chk')).toHaveCount(0)
  await page.getByRole('button', { name: '重算', exact: true }).click()
  await expect(card.locator('.retain-chk')).toHaveCount(3)
  await expect(card.locator('.jump-input')).toHaveValue('3')
  await expect(card.locator('.state-btn--delete')).toHaveCount(0)
  await card.locator('.state-btn--pinned').click()
  await expect(card.locator('.jump-readonly')).toHaveText('3')
  for (const checkbox of await card.locator('.retain-chk input').all()) await expect(checkbox).toBeDisabled()
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB)).toMatchObject({ id: HUB, isPinned: false, jumpRange: 3 })
  await card.locator('.state-btn--unpinned').click()
  await page.getByRole('button', { name: '查看', exact: true }).click()
  await expect(card.locator('.jump-readonly')).toHaveText('3')
  await expect(page.getByRole('button', { name: '退出', exact: true })).toHaveCount(0)
})

test('2.3/2.4 coverage 删除恢复与 jumpRange 同步且不改连接', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await edit(page)
  const card = hubCard(page)
  const before = (await result(page)).groups.find((group: any) => group.sectorMacro === HUB)
  expect(before.coverageSectorMacros).toEqual([COVERAGE])
  await card.locator('.pill--coverage:not(.pill--removed) .pill-action--remove').click()
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB).coverageSectorMacros).toEqual([])
  await expect(card.locator('.pill--candidate').filter({ has: page.locator('.pill-label').filter({ hasText: /^水星$/ }) }).locator('.pill-action--add')).toHaveCount(1)
  await card.locator('.pill--candidate').filter({ has: page.locator('.pill-label').filter({ hasText: /^水星$/ }) }).locator('.pill-action--add').click()
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB).coverageSectorMacros).toEqual([COVERAGE])
  await card.locator('.jump-input').fill('0')
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB)).toMatchObject({ jumpRange: 0, coverageSectorMacros: [], connectedGroupIds: before.connectedGroupIds })
  await card.locator('.jump-input').fill('3')
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB)).toMatchObject({ jumpRange: 3, coverageSectorMacros: [COVERAGE], connectedGroupIds: before.connectedGroupIds })
})

test('3.1/3.2/3.4/3.5 玩家 hub 添加删除清理 coverage 与引用', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await edit(page)
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const menu = page.locator('.hub-add-menu--overlay')
  await expect(menu.locator('.hub-add-menu-item').filter({ hasText: /^小行星带$/ })).toBeDisabled()
  const player = menu.locator('.hub-add-menu-item:not(:disabled)').filter({ hasText: /水星/ })
  await expect(player).toHaveCount(1)
  await player.click()
  const added = (await result(page)).groups.find((group: any) => group.sectorMacro === COVERAGE)
  expect(added).toMatchObject({ id: COVERAGE, isNew: true })
  expect((await result(page)).groups.find((group: any) => group.sectorMacro === HUB).coverageSectorMacros).not.toContain(COVERAGE)
  expect((await result(page)).assignments.map((a: any) => a.sectorMacro)).not.toContain(COVERAGE)
  const card = page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^水星$/ }) })
  await card.locator('.state-btn--delete').click()
  await expect(card).toHaveCount(0)
  const after = await result(page)
  expect(after.assignments.map((a: any) => a.sectorMacro)).toContain(COVERAGE)
  for (const group of after.groups) expect(group.connectedGroupIds).not.toContain(COVERAGE)
  for (const assignment of after.assignments) expect(assignment.options.map((o: any) => o.targetGroupId)).not.toContain(COVERAGE)
  await expect(page.locator('.trade-station-card .card-group-name').filter({ hasText: added.name })).toHaveCount(0)
})

for (const scenario of [
  { title: '4.1/4.2 pure 首位', definitions: [{ code: 'PURE', containers: 10 }, { code: 'PROD', containers: 8, production: 1 }], expected: 'PURE' },
  { title: '4.2 混合生产首位需选择', definitions: [{ code: 'PROD', containers: 30, production: 1 }, { code: 'PURE', containers: 5 }], expected: null },
  { title: '4.2 全生产显著领先', definitions: [{ code: 'A', containers: 20, production: 1 }, { code: 'B', containers: 10, production: 1 }], expected: 'A' },
  { title: '4.2/4.4 全生产等分 gate', definitions: [{ code: 'A', containers: 10, production: 1 }, { code: 'B', containers: 10, production: 1 }], expected: null }
]) {
  test(scenario.title, async ({ page }) => {
    await candidateFixture(page, scenario.definitions)
    const card = await hubTradeCard(page)
    await expect(card.locator('.candidate-item:not(.candidate-item--virtual) .candidate-name')).toContainText(scenario.definitions.map(item => item.code))
    const selected = card.locator('.candidate-item--selected:not(.candidate-item--virtual) .candidate-name')
    await expect(selected).toHaveText(scenario.expected === null ? [] : [scenario.expected])
    expect((await result(page)).groups.find((g: any) => g.sectorMacro === HUB).selectedTradeStation).toEqual(
      scenario.expected === null ? undefined : { type: 'player', stationCode: scenario.expected }
    )
    if (scenario.expected === null) {
      await edit(page)
      await hubCard(page).locator('.color-chip').click()
      await page.locator('.preset-color').last().click()
      await expect(page.locator('.auto-sector-bar .confirm-btn')).toBeDisabled()
      await card.locator('.candidate-item--virtual').click()
      await expect(card.locator('.candidate-item--virtual')).toHaveClass(/candidate-item--selected/)
    }
  })
}

test('1.3/4.1/6.1 container-only construction score 与 raw/top5 独立预期', async ({ page }) => {
  await candidateFixture(page, [
    { code: 'P1', containers: 50, production: 1 }, { code: 'P2', containers: 40, production: 1 },
    { code: 'P3', containers: 30, production: 1 }, { code: 'P4', containers: 20, production: 1 },
    { code: 'P5', containers: 18, production: 1 }, { code: 'PURE6', containers: 5, construction: true },
    { code: 'PURE5', containers: 5 }, { code: 'ZERO', containers: 0 }
  ])
  const raw = (await result(page)).sectorStationCandidates[HUB]
  expect(raw.map((c: any) => c.stationCode)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'PURE6', 'PURE5'])
  expect(raw.find((c: any) => c.stationCode === 'PURE6')).toMatchObject({ containerCap: 6_000_000, prodLines: 0, score: 6_000_000, qualified: true, isPureHub: true })
  expect(raw[0]).toMatchObject({ containerCap: 50_000_000, prodLines: 1, isPureHub: false })
  expect(raw[0].score).toBeCloseTo(50_000_000 / (1 + Math.log(2)), 5)
  const card = await hubTradeCard(page)
  await expect(card.locator('.candidate-item:not(.candidate-item--virtual) .candidate-name')).toHaveText(['P1', 'P2', 'P3', 'PURE6', 'PURE5'])
})

test('4.1 全零 container 保留全部候选', async ({ page }) => {
  await candidateFixture(page, [{ code: 'ZERO-A', containers: 0 }, { code: 'ZERO-B', containers: 0 }])
  const raw = (await result(page)).sectorStationCandidates[HUB]
  expect(raw.map((c: any) => ({ code: c.stationCode, cap: c.containerCap }))).toEqual([{ code: "ZERO-A", cap: 0 }, { code: "ZERO-B", cap: 0 }])
  const card = await hubTradeCard(page)
  await expect(card.locator(".candidate-item:not(.candidate-item--virtual) .candidate-name")).toHaveText(["ZERO-A", "ZERO-B"])
})

test('4.5/5.1/5.2/5.5/6.6/6.7 UI trade 选择确认并 reload，不改 save-coded plans', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  const before = await saved(page)
  const savePlans = await page.evaluate(() => (window as any).saveBindingStore.draftBinding.stationPlans.filter((plan: any) => plan.saveStationCode))
  expect(savePlans.length).toBeGreaterThan(0)
  await edit(page)
  await hubCard(page).locator('.jump-input').fill('2')
  await chooseVirtualAndConfirm(page)
  const after = await saved(page)
  const hub = after.groups.find((group: any) => group.sectorMacro === HUB)
  expect(hub).toMatchObject({ sectorMacro: HUB, jumpRange: 2, coverageSectorMacros: [] })
  expect(hub.tradeStation).toMatchObject({ sectorMacro: HUB })
  expect(hub.tradeStation.saveStationCode).toBeUndefined()
  expect(hub.tradeStation.position).toEqual(before.groups.find((g: any) => g.sectorMacro === HUB).tradeStation.position)
  expect(after.groups.map((group: any) => group.sectorMacro).sort()).toEqual(before.groups.map((group: any) => group.sectorMacro).sort())
  expect(after.stationPlans.filter((plan: any) => plan.saveStationCode)).toEqual(savePlans)
  for (const group of after.groups) expect(group.tradeStation.saveStationCode).toBeUndefined()
  await page.reload()
  await ready(page)
  expect((await saved(page)).groups).toEqual(after.groups)
})

test('5.3/5.4 真实拖动跨覆盖区，confirm 保留实际 sector 与新 group', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  const before = await saved(page)
  const destination = 'cluster_26_sector001_macro'
  const owner = 'cluster_24_sector001_macro'
  expect((await result(page)).groups.find((g: any) => g.sectorMacro === owner).coverageSectorMacros).toContain(destination)
  await page.locator('.auto-sector-bar .map-btn').click()
  const focus = page.locator('.pill--coverage .pill-label').filter({ hasText: /^安提亚的不幸 I$/ })
  await expect(focus).toHaveCount(1)
  await focus.click()
  await page.getByRole('button', { name: '虚拟空间站', exact: true }).click()
  const source = page.locator('.virtual-row').filter({ has: page.locator('.virtual-name').filter({ hasText: /^新建空间站$/ }) })
  const target = page.locator(`.sector-hover-target[data-map-sector-id="${destination}"] .sector-polygon`)
  await dragTo(page, source, target)
  await expect.poll(() => page.evaluate(id => (window as any).liveStore.virtualStationDrafts.find((p: any) => p.id === id), VIRTUAL_ID)).toMatchObject({ groupId: owner, sectorMacro: destination })
  expect((await saved(page)).stationPlans).toEqual(before.stationPlans)
  await page.getByTestId('top-view-btn-live-production').click()
  await openGroups(page)
  await chooseVirtualAndConfirm(page)
  expect((await saved(page)).stationPlans.find((p: any) => p.id === VIRTUAL_ID)).toMatchObject({ groupId: owner, sectorMacro: destination })
  await expect(page.getByTestId('empire-wareflow-dashboard')).toHaveCount(0)
  await page.reload()
  await ready(page)
  expect((await saved(page)).stationPlans.find((p: any) => p.id === VIRTUAL_ID)).toMatchObject({ groupId: owner, sectorMacro: destination })
})

test('3.3/4.1/4.2 非玩家 hub 仅创建 virtual trade，不创建 stationPlan', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  const plans = await page.evaluate(() => (window as any).liveStore.virtualStationDrafts)
  const archive = await page.evaluate(() => (window as any).saveStore.selectedArchive)
  await edit(page)
  await addHub(page, '大交易所 I')
  const added = (await result(page)).groups.find((g: any) => g.sectorMacro === 'cluster_01_sector001_macro')
  expect(added).toMatchObject({ id: 'cluster_01_sector001_macro', isNew: true })
  expect.soft(added.selectedTradeStation).toEqual({ type: 'virtual', stationCode: '__virtual__' })
  const card = page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: /^大交易所 I$/ }) })
  await expect(card.locator('.candidate-item:not(.candidate-item--virtual)')).toHaveCount(0)
  await expect.soft(card.locator('.candidate-item--virtual')).toHaveClass(/candidate-item--selected/)
  expect(await page.evaluate(() => (window as any).liveStore.virtualStationDrafts)).toEqual(plans)
  expect(await page.evaluate(() => (window as any).saveStore.selectedArchive)).toEqual(archive)
})

test('2.5/2.6/3.5 standalone 末位、手动选择保持 card 身份且不重复建组', async ({ page }) => {
  await openGroups(page)
  const names = await page.locator('.allocation-card .card-sector-name').allTextContents()
  expect(names).toContain('水星')
  const card = page.locator('.allocation-card').filter({ has: page.locator('.card-sector-name').filter({ hasText: /^水星$/ }) })
  await expect(card.locator('.option-row').last()).toContainText('独立成组')
  const assignment = (await result(page)).assignments.find((a: any) => a.sectorMacro === COVERAGE)
  expect(assignment.options.at(-1).type).toBe('standalone')
  expect(assignment.selectedSectorMacro).not.toBe(COVERAGE)
  await card.locator('.option-row').last().click()
  await expect(card.locator('.option-row').last()).toHaveClass(/option-selected/)
  expect(await page.locator('.allocation-card .card-sector-name').allTextContents()).toEqual(names)
  expect((await result(page)).assignments.find((a: any) => a.sectorMacro === COVERAGE).displayBucket).toBe(assignment.displayBucket)
  expect((await result(page)).groups.filter((g: any) => g.sectorMacro === COVERAGE)).toHaveLength(1)
  await card.locator('.option-row').last().click()
  expect((await result(page)).groups.filter((g: any) => g.sectorMacro === COVERAGE)).toHaveLength(1)
})

test('5.4 未分组虚拟站确认时移除，保存站保留', async ({ page }) => {
  await appliedFixture(page, true)
  await page.evaluate(({ guid, virtual, coverage }) => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    binding.stationPlans.find((p: any) => p.id === virtual).sectorMacro = coverage
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, virtual: VIRTUAL_ID, coverage: COVERAGE })
  await page.reload()
  await openGroups(page)
  await edit(page)
  await hubCard(page).locator('.jump-input').fill('0')
  expect(await page.evaluate(id => (window as any).liveStore.virtualStationDrafts.find((p: any) => p.id === id).groupId, VIRTUAL_ID)).toBeNull()
  await page.locator('.candidate-item--virtual').click()
  await expect(page.locator('.auto-sector-bar .confirm-btn')).toBeEnabled()
  await page.locator('.auto-sector-bar .confirm-btn').click()
  await expect(page.locator('.confirm-popup')).toBeVisible()
  await page.locator('.confirm-popup-button--primary').click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  expect((await saved(page)).stationPlans.map((p: any) => p.id)).not.toContain(VIRTUAL_ID)
  expect((await saved(page)).stationPlans.map((p: any) => p.saveStationCode)).toContain('KXN-018')
  await page.reload()
  await ready(page)
  expect((await saved(page)).stationPlans.map((p: any) => p.id)).not.toContain(VIRTUAL_ID)
})

test('4.3/4.5/6.7 saved trade retain 后允许手选其它玩家站并持久化', async ({ page }) => {
  await appliedFixture(page)
  await openGroups(page)
  await page.getByRole('button', { name: '重算', exact: true }).click()
  const group = page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^阿尔忒弥斯的朦胧$/ }) })
  await group.locator('.retain-chk').filter({ hasText: '交易站' }).locator('input').check()
  await page.getByRole('button', { name: '重新计算', exact: true }).click()
  const card = page.locator('.trade-station-card').filter({ has: page.locator('.candidate-name').filter({ hasText: /^BHW-834$/ }) })
  await expect(card.locator('.candidate-item--selected .candidate-name')).toHaveText('BHW-834')
  for (const choice of await page.locator('.candidate-item--virtual').all()) await choice.click()
  await card.locator('.candidate-item').filter({ has: page.locator('.candidate-name').filter({ hasText: /^RWC-785$/ }) }).click()
  await expect(card.locator('.candidate-item--selected .candidate-name')).toHaveText('RWC-785')
  await page.locator('.auto-sector-bar .confirm-btn').click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  expect((await saved(page)).groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro').tradeStation.saveStationCode).toBe('RWC-785')
  await page.reload()
  await ready(page)
  expect((await saved(page)).groups.find((g: any) => g.sectorMacro === 'cluster_715_sector001_macro').tradeStation.saveStationCode).toBe('RWC-785')
})
