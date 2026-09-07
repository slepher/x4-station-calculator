import { test } from '../../test-setup'
import { expect, type Page, type Locator } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

const GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const HUB = 'cluster_100_sector001_macro'
const MERCURY = 'cluster_106_sector001_macro'
const VIRTUAL = 'f36126e5-7798-ed14-3c03-938b961efa0b'

async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).liveStore.autoGroupResult?.groups.length)).toBeGreaterThan(0)
}
async function openMap(page: Page) {
  await ready(page)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  await page.locator('.auto-sector-bar .map-btn').click()
  await expect(page.locator('.auto-sector-group-map-panel--tabs')).toBeVisible()
}
const tab = (page: Page, name: string) => page.locator('.tab-btn').filter({ hasText: new RegExp(`^${name}$`) })
const hub = (page: Page) => page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^小行星带$/ }) })
const sector = (page: Page, id: string) => page.locator(`.sector-hover-target[data-map-sector-id="${id}"] .sector-polygon`)
const existing = (page: Page) => page.locator('.virtual-row').filter({ has: page.locator('.virtual-name').filter({ hasText: /^新建空间站$/ }) })
const virtualOverlay = (page: Page) => page.locator(`[data-placement-key="binding:station:${VIRTUAL}"]`)
async function groups(page: Page) { return page.evaluate(() => (window as any).liveStore.autoGroupResult.groups) }
async function drafts(page: Page) { return page.evaluate(() => (window as any).liveStore.virtualStationDrafts) }
async function saved(page: Page) {
  return page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    return JSON.parse(localStorage.getItem(key)!).list.find((b: any) => b.gameGuid === guid)
  }, GUID)
}
async function focusHub(page: Page) {
  await tab(page, '枢纽').click()
  await hub(page).locator('.pill--anchor .pill-label').click()
}
async function startDrag(page: Page, source: Locator) {
  const point = await source.evaluate(el => {
    const box = el.getBoundingClientRect()
    for (const fx of [0.5, 0.35, 0.65]) for (const fy of [0.5, 0.35, 0.65]) {
      const p = { x: box.x + box.width * fx, y: box.y + box.height * fy }
      const hit = document.elementFromPoint(p.x, p.y)
      if (hit && (el === hit || el.contains(hit))) return p
    }
    return null
  })
  expect(point, 'drag source must receive actual pointer input').not.toBeNull()
  await page.mouse.move(point!.x, point!.y, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(point!.x + 12, point!.y + 12, { steps: 4 })
  await expect(source).toHaveClass(/dragging/)
}
async function hoverSector(page: Page, id: string, fraction = 0.65) {
  const point = await sector(page, id).evaluate((el, preferred) => {
    const box = el.getBoundingClientRect()
    const parent = el.closest('.sector-hover-target')!
    for (const fx of [preferred, 0.2, 0.8, 0.35, 0.5]) for (const fy of [0.6, 0.35, 0.75]) {
      const p = { x: box.x + box.width * fx, y: box.y + box.height * fy }
      if (document.elementFromPoint(p.x, p.y)?.closest('.sector-hover-target') === parent) return p
    }
    return null
  }, fraction)
  expect(point, 'drop target must hit the intended sector rather than a station overlay').not.toBeNull()
  await page.mouse.move(point!.x, point!.y, { steps: 20 })
  console.log('[M3.2-drag-target]', JSON.stringify({ id, point, hit: await page.evaluate(p => document.elementFromPoint(p!.x, p!.y)?.outerHTML.slice(0, 350), point) }))
}
async function drop(page: Page, source: Locator, id: string, fraction = 0.65) {
  await startDrag(page, source)
  await hoverSector(page, id, fraction)
  await expect(page.locator('.placement-preview--binding')).toBeVisible()
  await page.mouse.up()
}
async function confirm(page: Page) {
  await tab(page, '交易站').click()
  for (const option of await page.locator('.candidate-item--virtual').all()) await option.click()
  const button = page.locator('.auto-sector-bar .confirm-btn')
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  await expect(button).toBeDisabled()
}

test.beforeEach(async ({ page }) => {
  await loadLiveBindingFixture(page)
  await page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    state.list.find((b: any) => b.gameGuid === guid).appliedAutoGroupArchiveTime = 667632.933
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload()
  await ready(page)
})

test('1.1/1.2/1.3/1.4/4.1/4.5/7.1/7.2 四页签中英切换与关闭重开保留真实 draft', async ({ page }) => {
  await page.getByTestId('sidebar-auto-sector-group').click()
  await expect(tab(page, '虚拟空间站')).toHaveCount(0)
  await page.locator('.auto-sector-bar .map-btn').click()
  await expect(page.locator('.auto-sector-group-map-panel--tabs')).toBeVisible()
  await expect(page.locator('.binding-sector-group')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').first().click()
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
  const before = await groups(page)
  for (const [name, content] of [['分配方案', '.allocation-card'], ['交易站', '.trade-station-card'], ['虚拟空间站', '.virtual-station-tab'], ['枢纽', '.group-item']]) {
    await tab(page, name!).click()
    await expect(tab(page, name!)).toHaveClass(/active/)
    await expect(page.locator(content!).first()).toBeVisible()
    await expect(page.locator('.auto-sector-bar')).toBeVisible()
  }
  expect(await groups(page)).toEqual(before)
  await page.getByRole('button', { name: '查看', exact: true }).click()
  await tab(page, '虚拟空间站').click()
  await expect(existing(page).locator('.virtual-delete')).toBeEnabled()
  const language = page.locator('select').filter({ hasText: /简体中文|English/ })
  await language.selectOption('en')
  for (const label of ['Hub', 'Allocation', 'Trade Station', 'Virtual Station']) await expect(tab(page, label)).toBeVisible()
  await language.selectOption('zh-CN')
  await page.getByTestId('map-save-panel-close').click()
  await expect(page.getByTestId('map-save-panel')).toBeHidden()
  await page.getByTestId('map-save-panel-tab').click()
  await expect(page.getByTestId('map-save-panel')).toBeVisible()
  expect(await groups(page)).toEqual(before)
})

test('2.1/2.2/2.3 地图coverage和anchor定位，Live点击保留视口', async ({ page }) => {
  await openMap(page)
  const mercuryBefore = await sector(page, MERCURY).boundingBox()
  await hub(page).locator('.pill--coverage .pill-label').filter({ hasText: /^水星$/ }).click()
  const mercury = await sector(page, MERCURY).boundingBox()
  expect(mercury).not.toBeNull()
  expect(mercury).not.toEqual(mercuryBefore)
  const asteroidBefore = await sector(page, HUB).boundingBox()
  await hub(page).locator('.pill--anchor .pill-label').click()
  const asteroid = await sector(page, HUB).boundingBox()
  expect(asteroid).not.toBeNull()
  expect(asteroid).not.toEqual(asteroidBefore)
  expect(Math.abs(asteroid!.x - mercury!.x)).toBeLessThan(30)
  const panelBox = await page.getByTestId('map-save-panel').boundingBox()
  expect(panelBox).not.toBeNull()
  expect(panelBox!.width).toBeLessThanOrEqual(360)
  const cardBox = await hub(page).boundingBox()
  expect(cardBox).not.toBeNull()
  for (const pill of await hub(page).locator('.pill:visible').all()) {
    const box = await pill.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1)
  }
  const viewport = await page.evaluate(() => (window as any).mapStore.viewportState)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  await hub(page).locator('.pill--anchor .pill-label').click()
  expect(await page.evaluate(() => (window as any).mapStore.viewportState)).toEqual(viewport)
})

test('3.1/3.2/3.3/1.5 色卡预设与透明色提交刷新保持工作台', async ({ page }) => {
  await openMap(page)
  await expect(hub(page).locator('.color-chip')).toBeDisabled()
  await expect(hub(page).locator('.color-chip')).toHaveCSS('width', '16px')
  await expect(hub(page).locator('.color-chip')).toHaveCSS('height', '16px')
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.locator('.auto-sector-bar .confirm-btn')).toBeVisible()
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').first().click()
  await expect(page.locator('.preset-color')).toHaveCount(0)
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
  await expect(hub(page).locator('.color-chip')).toHaveCSS('background-color', 'rgb(244, 78, 59)')
  await expect(page.locator('.sector-group-color-layer polygon[fill="#f44e3b"]')).toHaveCount(2)
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').last().click()
  await expect(hub(page).locator('.color-chip')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect.soft(hub(page).locator('.color-chip')).toHaveCSS('border-style', 'dashed')
  expect.soft((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBeUndefined()
  await confirm(page)
  expect.soft((await saved(page)).groups.find((g: any) => g.sectorMacro === HUB).color).toBeUndefined()
  await expect(tab(page, '枢纽')).toBeVisible()
  await expect(page.locator('.virtual-station-tab')).toBeHidden()
  await page.reload()
  await ready(page)
  expect.soft((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBeUndefined()
})

test('4.2/4.3/5.2/5.3/5.5/5.6/7.4 空白真实创建、移动与删除保持草案边界', async ({ page }) => {
  await openMap(page)
  await focusHub(page)
  await tab(page, '虚拟空间站').click()
  await page.locator('.virtual-group').filter({ has: existing(page) }).locator('.virtual-group-title').click()
  await expect(page.locator('.virtual-group-title')).toHaveText((await groups(page)).map((g: any) => g.name))
  await expect(page.locator('.blueprint-empire-button')).toBeVisible()
  const before = await saved(page)
  expect(await drafts(page)).toHaveLength(1)
  await expect(existing(page).locator('.virtual-sub')).toContainText('小行星带')
  await expect(existing(page).locator('.virtual-sub')).toContainText('x:')
  await drop(page, page.locator('.free-station-item--virtual'), HUB)
  await expect.poll(() => drafts(page)).toHaveLength(2)
  const created = (await drafts(page)).find((p: any) => p.id !== VIRTUAL)
  expect(created).toMatchObject({ name: '新空间站', type: 'industrial', modules: [], lockedWares: [], warePriority: {}, sectorMacro: HUB, groupId: HUB })
  expect(created.saveStationCode).toBeUndefined()
  const row = page.locator('.virtual-row').filter({ has: page.locator('.virtual-name').filter({ hasText: /^新空间站$/ }) })
  await drop(page, row, HUB, 0.35)
  expect(await drafts(page)).toHaveLength(2)
  expect((await drafts(page)).find((p: any) => p.id === created.id).position).not.toEqual(created.position)
  expect((await saved(page)).stationPlans).toEqual(before.stationPlans)
  await tab(page, '枢纽').click()
  await expect(virtualOverlay(page)).toBeVisible()
  await tab(page, '虚拟空间站').click()
  await row.locator('.virtual-delete').click()
  await expect(row).toHaveCount(0)
  expect((await drafts(page)).map((p: any) => p.id)).toEqual([VIRTUAL])
  expect((await saved(page)).stationPlans).toEqual(before.stationPlans)
})

test('5.4/7.3 无覆盖sector拒绝真实drop，不使用fallback group', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.pill--coverage .pill-label').filter({ hasText: /^水星$/ }).click()
  await hub(page).locator('.jump-input').fill('0')
  expect((await groups(page)).flatMap((g: any) => [g.sectorMacro, ...g.coverageSectorMacros])).not.toContain(MERCURY)
  await tab(page, '虚拟空间站').click()
  const before = await drafts(page)
  await startDrag(page, existing(page))
  await hoverSector(page, MERCURY)
  await expect(page.locator('.placement-preview--binding')).toHaveCount(0)
  await page.mouse.up()
  expect(await drafts(page)).toEqual(before)
})

test('5.4.2/7.3.1 多group覆盖拒绝真实drop且不选择fallback', async ({ page }) => {
  await page.evaluate(({ guid, mercury }) => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    binding.groups = binding.groups.slice(0, 2).map((g: any) => ({ ...g, coverageSectorMacros: [{ ref: mercury, jump: 3 }], connectedGroupIds: [] }))
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, mercury: MERCURY })
  await page.reload()
  await openMap(page)
  expect((await groups(page)).filter((g: any) => g.coverageSectorMacros.includes(MERCURY))).toHaveLength(2)
  await hub(page).locator('.pill--coverage .pill-label').filter({ hasText: /^水星$/ }).click()
  await tab(page, '虚拟空间站').click()
  const before = await drafts(page)
  await startDrag(page, existing(page))
  await hoverSector(page, MERCURY)
  // Coverage union permits a preview; unique group ownership is validated on release.
  await expect(page.locator('.placement-preview--binding')).toBeVisible()
  await page.mouse.up()
  expect(await drafts(page)).toEqual(before)
})

test('3.2.1/3.2.3 预设非透明颜色确认并reload保持', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').first().click()
  await confirm(page)
  expect((await saved(page)).groups.find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
  await page.reload()
  await openMap(page)
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
  await expect(hub(page).locator('.color-chip')).toHaveCSS('background-color', 'rgb(244, 78, 59)')
  await expect(page.locator('.sector-group-color-layer polygon[fill="#f44e3b"]')).toHaveCount(2)
})

test('4.2/5.1 从蓝图真实拖放复制模块设置且不复制身份', async ({ page }) => {
  await openMap(page)
  await tab(page, '虚拟空间站').click()
  await page.locator('.virtual-group').filter({ has: existing(page) }).locator('.virtual-group-title').click()
  await page.locator('.blueprint-empire-button').click()
  await page.locator('.bind-menu-item').filter({ has: page.locator('.bind-menu-item-name').filter({ hasText: /^Empire 1$/ }) }).click()
  const source = page.locator('.free-station-item').filter({ has: page.locator('.station-name').filter({ hasText: /^E1-S1$/ }) })
  await expect(source).toBeVisible()
  const before = await saved(page)
  await drop(page, source, HUB)
  await expect.poll(() => drafts(page)).toHaveLength(2)
  const created = (await drafts(page)).find((p: any) => p.id !== VIRTUAL)
  expect(created.id).not.toBe('empire-1-station-1')
  expect(created).toMatchObject({
    name: 'E1-S1', type: 'industrial', sectorMacro: HUB, groupId: HUB,
    modules: [{ id: 'module_gen_prod_claytronics_01', count: 6 }, { id: 'module_gen_prod_hullparts_01', count: 12 }],
    settings: { sunlight: 100, racePreference: 'argon', resourceBufferHours: 1, showEmpireGaps: true },
    lockedWares: ['quantumtubes'], warePriority: {}
  })
  expect(created.saveStationCode).toBeUndefined()
  expect((await saved(page)).stationPlans).toEqual(before.stationPlans)
  await expect(source).toBeVisible()
  expect(await page.evaluate(id => {
    const source = (window as any).blueprintStore.savedEmpires.list.find((e: any) => e.id === 'empire-1').stations.find((s: any) => s.id === 'empire-1-station-1')
    const draft = (window as any).liveStore.virtualStationDrafts.find((s: any) => s.id === id)
    return ['modules', 'settings', 'lockedWares', 'warePriority'].every(key => draft[key] !== source[key])
  }, created.id)).toBe(true)
})

test('6.1/6.2/6.3/6.4/6.5 virtual trade overlay真实拖动与跨hub拒绝', async ({ page }) => {
  await openMap(page)
  await focusHub(page)
  const overlay = page.locator('[data-placement-key="binding:station:5173b252-78ca-ac45-9e40-5afae79c4bab"]')
  await expect(overlay).toBeVisible()
  const beforeGroups = await groups(page)
  const beforeBinding = await saved(page)
  const beforeDrafts = await drafts(page)
  await drop(page, overlay, HUB, 0.35)
  const moved = (await groups(page)).find((g: any) => g.sectorMacro === HUB)
  expect(moved.virtualTradeStationPosition).not.toEqual(beforeGroups.find((g: any) => g.sectorMacro === HUB).virtualTradeStationPosition)
  expect(moved.sectorMacro).toBe(HUB)
  expect(moved.coverageSectorMacros).toEqual([MERCURY])
  expect(await drafts(page)).toEqual(beforeDrafts)
  expect(await saved(page)).toEqual(beforeBinding)
  await tab(page, '交易站').click()
  const card = page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: /^小行星带$/ }) })
  await expect(card.locator('.candidate-item--virtual .candidate-meta')).toHaveText(`x: ${(moved.virtualTradeStationPosition.x / 1000).toFixed(1)}km / z: ${(moved.virtualTradeStationPosition.z / 1000).toFixed(1)}km`)
  await card.locator('.candidate-item').filter({ has: page.locator('.candidate-name').filter({ hasText: /^KXN-018$/ }) }).click()
  await expect(overlay).toHaveCount(0)
  await card.locator('.candidate-item--virtual').click()
  await expect(overlay).toBeVisible()
  // Mars is the adjacent non-hub sector in maps.json; both it and the source remain visible at hub focus.
  await focusHub(page)
  const beforeReject = (await groups(page)).find((g: any) => g.sectorMacro === HUB).virtualTradeStationPosition
  await startDrag(page, overlay)
  await hoverSector(page, 'cluster_101_sector001_macro')
  // Overlay dragging previews pointer position; the specified rejection occurs on release.
  await expect(page.locator('.placement-preview--binding')).toBeVisible()
  await page.mouse.up()
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).virtualTradeStationPosition).toEqual(beforeReject)
  expect(await saved(page)).toEqual(beforeBinding)
  await confirm(page)
  const committed = await saved(page)
  expect(committed.groups.find((g: any) => g.sectorMacro === HUB).tradeStation).toMatchObject({ sectorMacro: HUB, position: moved.virtualTradeStationPosition })
  expect(committed.stationPlans).toHaveLength(beforeBinding.stationPlans.length)
  for (const { count, lastUpdated, groupId, ...plan } of beforeBinding.stationPlans) {
    // Current persistence drops obsolete metadata, adds setting defaults, and canonicalizes group identity.
    expect(committed.stationPlans.find((p: any) => p.id === plan.id)).toMatchObject({
      ...plan, groupId: beforeBinding.groups.find((g: any) => g.id === groupId).sectorMacro
    })
  }
  await page.reload()
  await openMap(page)
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB)).toMatchObject({ sectorMacro: HUB, coverageSectorMacros: [MERCURY], virtualTradeStationPosition: moved.virtualTradeStationPosition })
})

test('2.5 group handle排序只改变顺序，placeholder与确认持久化', async ({ page }) => {
  // Small persisted two-group precondition keeps both complete cards inside the map sidebar.
  await page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    binding.groups = binding.groups.slice(0, 2).map((g: any) => ({ ...g, coverageSectorMacros: [], connectedGroupIds: [] }))
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload()
  await openMap(page)
  const before = await groups(page)
  expect(before.map((g: any) => g.id)).toEqual([HUB, 'cluster_24_sector001_macro'])
  const handle = page.locator('.group-item .drag-handle').first()
  const start = await handle.boundingBox()
  const target = await page.locator('.group-item').nth(1).boundingBox()
  expect(start).not.toBeNull()
  expect(target).not.toBeNull()
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(start!.x + 15, start!.y + 15, { steps: 4 })
  await expect(page.locator('.drag-placeholder')).toBeVisible()
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height - 8, { steps: 20 })
  await page.mouse.up()
  await expect.poll(() => groups(page)).toEqual([before[1], before[0]])
  await tab(page, '交易站').click()
  for (const option of await page.locator('.candidate-item--virtual').all()) await option.click()
  await page.locator('.auto-sector-bar .confirm-btn').click()
  await expect(page.locator('.confirm-popup')).toBeVisible()
  await page.locator('.confirm-popup-button--primary').click()
  expect((await saved(page)).groups.map((g: any) => g.sectorMacro)).toEqual(['cluster_24_sector001_macro', HUB])
})

test('2.4 Map侧栏定位菜单与Live overlay各自语义', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  const menu = page.locator('.hub-add-menu')
  await expect(menu).toBeVisible()
  await expect(menu).not.toHaveClass(/hub-add-menu--overlay/)
  const mercury = menu.locator('.hub-add-menu-item').filter({ has: page.locator('.sector-name').filter({ hasText: /^水星$/ }) })
  const before = await sector(page, MERCURY).boundingBox()
  await mercury.locator('.hub-add-menu-locate-btn').click()
  await expect(menu).toBeVisible()
  expect(await sector(page, MERCURY).boundingBox()).not.toEqual(before)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.locator('.hub-add-menu--overlay')).toBeVisible()
  await expect(page.locator('.hub-add-menu-locate-btn')).toHaveCount(0)
})

test('4.4 未分组区域显示移除说明，恢复coverage重新归组', async ({ page }) => {
  await page.evaluate(({ guid, virtual, sector }) => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    state.list.find((b: any) => b.gameGuid === guid).stationPlans.find((p: any) => p.id === virtual).sectorMacro = sector
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, virtual: VIRTUAL, sector: MERCURY })
  await page.reload()
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.jump-input').fill('0')
  await tab(page, '虚拟空间站').click()
  await expect(page.locator('.virtual-group--ungrouped .virtual-name')).toHaveText('新建空间站')
  await expect(page.locator('.virtual-warning')).toContainText('提交时')
  expect(await drafts(page)).toHaveLength(1)
  expect((await drafts(page))[0].groupId).toBeNull()
  await tab(page, '枢纽').click()
  await hub(page).locator('.jump-input').fill('3')
  await tab(page, '虚拟空间站').click()
  await expect(page.locator('.virtual-group--ungrouped')).toHaveCount(0)
  expect((await drafts(page))[0]).toMatchObject({ id: VIRTUAL, groupId: HUB, sectorMacro: MERCURY })
})

test('3.3/3.4 颜色只在binding显示，faction/group/resource层级与coverage尺寸', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').first().click()
  await expect(page.locator('.sector-group-color-layer polygon[fill="#f44e3b"]')).toHaveCount(2)
  const geometry = await page.evaluate(hub => {
    const target = document.querySelector(`.sector-hover-target[data-map-sector-id="${hub}"] .sector-polygon`)!.getBoundingClientRect()
    const fills = [...document.querySelectorAll('.sector-group-color-layer polygon[fill="#f44e3b"]')].map(el => el.getBoundingClientRect())
    const match = fills.find(box => Math.abs((box.x + box.width / 2) - (target.x + target.width / 2)) < 1 && Math.abs((box.y + box.height / 2) - (target.y + target.height / 2)) < 1)
    const faction = document.querySelector('.sector-fill-layer')!
    const group = document.querySelector('.sector-group-color-layer')!
    const sectors = document.querySelector('.clusters')!
    return { ratio: match ? match.width / target.width : null, factionBeforeGroup: !!(faction.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING), groupBeforeSectors: !!(group.compareDocumentPosition(sectors) & Node.DOCUMENT_POSITION_FOLLOWING) }
  }, HUB)
  expect(geometry.factionBeforeGroup).toBe(true)
  expect(geometry.groupBeforeSectors).toBe(true)
  expect.soft(geometry.ratio).toBeCloseTo(2 / 3, 2)
  await page.locator('.breadcrumb-item.clickable').first().click()
  await page.locator('.default-map-item').click()
  await expect(page.locator('.sector-group-color-layer')).toHaveCount(0)
  await expect(page.locator('.hub-link-routes')).toHaveCount(0)
})
