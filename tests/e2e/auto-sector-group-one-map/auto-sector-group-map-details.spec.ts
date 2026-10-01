import { test } from '../../test-setup'
import { expect, type Page, type Locator } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

const GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const HUB = 'cluster_100_sector001_macro'
const MERCURY = 'cluster_106_sector001_macro'
const VIRTUAL = 'f36126e5-7798-ed14-3c03-938b961efa0b'

const tab = (page: Page, name: string) => page.locator('.tab-btn').filter({ hasText: new RegExp(`^${name}$`) })
const hub = (page: Page) => page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^小行星带$/ }) })
const sector = (page: Page, id: string) => page.locator(`.sector-hover-target[data-map-sector-id="${id}"] .sector-polygon`)
const existing = (page: Page) => page.locator('.virtual-row').filter({ has: page.locator('.virtual-name').filter({ hasText: /^新建空间站$/ }) })

async function openMap(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups.length ?? 0), { timeout: 15000 }).toBeGreaterThan(0)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  await page.locator('.auto-sector-bar .map-btn').click()
  await expect(page.locator('.auto-sector-group-map-panel--tabs')).toBeVisible()
}

async function groups(page: Page) { return page.evaluate(() => (window as any).liveStore.autoGroupResult.groups) }

test.beforeEach(async ({ page }) => {
  await loadLiveBindingFixture(page)
  await page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    state.list.find((b: any) => b.gameGuid === guid).appliedAutoGroupArchiveTime = 667632.933
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload()
})

test('1.3.3 layer来回保留完整draft，trade focus命中sector', async ({ page }) => {
  await openMap(page)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.color-chip').click()
  await page.locator('.preset-color').first().click()
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
  const before = await groups(page)
  await page.locator('.breadcrumb-item.clickable').first().click()
  await page.locator('.default-map-item').click()
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  await page.locator('.auto-sector-bar .map-btn').click()
  expect(await groups(page)).toEqual(before)
  const focus = async (locator: Locator, id: string) => {
    const old = await sector(page, id).boundingBox()
    expect(old).not.toBeNull()
    await locator.click()
    await expect.poll(async () => {
      const next = await sector(page, id).boundingBox()
      return next && `${next.x}:${next.y}`
    }).not.toBe(`${old!.x}:${old!.y}`)
  }
  await tab(page, '交易站').click()
  const trade = page.locator('.trade-station-card').filter({ has: page.locator('.card-group-name').filter({ hasText: /^小行星带$/ }) }).locator('.card-group-name')
  await expect(trade).toHaveCount(1)
  await focus(trade, HUB)
})

test('2.1.3/2.3.3 非空connected与compact/candidate focus', async ({ page }) => {
  await page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    const [a, b] = binding.groups
    a.coverageSectorMacros = []; b.coverageSectorMacros = []
    a.connectedGroupIds = [b.id]; b.connectedGroupIds = [a.id]
    a.coverageRetainEnabled = true; b.coverageRetainEnabled = true
    a.jumpRange = 5; b.jumpRange = 5
    a.isPinned = true; b.isPinned = true
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload()
  await openMap(page)
  const connected = hub(page).locator('.pill--connected .pill-label')
  await expect(connected).toHaveCount(1)
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).connectedGroupIds).toEqual(['cluster_24_sector001_macro'])
  const targetGroupLabel = (await page.locator('.group-item .pill--anchor .pill-label').allTextContents()).find(text => text !== '小行星带')
  expect(targetGroupLabel).toBeTruthy()
  await expect(connected).toHaveText(targetGroupLabel!)
  const connectedTarget = sector(page, 'cluster_24_sector001_macro')
  const beforeConnected = await connectedTarget.boundingBox()
  expect(beforeConnected).not.toBeNull()
  await connected.click()
  const afterConnected = await connectedTarget.boundingBox()
  expect(afterConnected).not.toBeNull()
  expect(`${afterConnected!.x}:${afterConnected!.y}`).not.toBe(`${beforeConnected!.x}:${beforeConnected!.y}`)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  const candidate = hub(page).locator('.pill--candidate .pill-label').filter({ hasText: /^水星$/ })
  await expect(candidate).toHaveCount(1)
  const candidateTarget = sector(page, MERCURY)
  const beforeCandidate = await candidateTarget.boundingBox()
  expect(beforeCandidate).not.toBeNull()
  await candidate.click()
  const afterCandidate = await candidateTarget.boundingBox()
  expect(afterCandidate).not.toBeNull()
  expect(`${afterCandidate!.x}:${afterCandidate!.y}`).not.toBe(`${beforeCandidate!.x}:${beforeCandidate!.y}`)
})

test('2.3.3 compact group card五类computed style相对Live保持合同', async ({ page }) => {
  await openMap(page)
  const mapCard = hub(page)
  const readStyles = async (card: Locator) => card.evaluate(el => {
    const style = (selector: string) => {
      const node = el.querySelector(selector)
      if (!node) throw new Error(`missing ${selector}`)
      const css = getComputedStyle(node)
      return { padding: css.padding, marginBottom: css.marginBottom, fontSize: css.fontSize, gap: css.gap, columnGap: css.columnGap }
    }
    const rootCss = getComputedStyle(el)
    return {
      root: { padding: rootCss.padding, marginBottom: rootCss.marginBottom, fontSize: rootCss.fontSize, gap: rootCss.gap, columnGap: rootCss.columnGap },
      header: style('.group-header'), label: style('.config-label'), pills: style('.pill-list'), jump: style('.jump-group-grid')
    }
  })
  const mapStyles = await readStyles(mapCard)
  await page.getByTestId('top-view-btn-live-production').click()
  await page.getByTestId('sidebar-auto-sector-group').click()
  const liveCard = hub(page)
  const liveStyles = await readStyles(liveCard)
  expect(mapStyles.root.padding).not.toBe(liveStyles.root.padding)
  expect(mapStyles.header.marginBottom).not.toBe(liveStyles.header.marginBottom)
  expect(mapStyles.label.fontSize).not.toBe(liveStyles.label.fontSize)
  expect(mapStyles.pills.gap).not.toBe(liveStyles.pills.gap)
  expect(mapStyles.jump.columnGap).not.toBe(liveStyles.jump.columnGap)
})

test('2.1.3 allocation candidate fixture先验非空，再聚焦assignment sector', async ({ page }) => {
  await page.evaluate(({ guid, virtual, mercury }) => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    binding.groups = binding.groups.filter((g: any) => g.sectorMacro === 'cluster_100_sector001_macro').map((g: any) => ({ ...g, coverageSectorMacros: [], connectedGroupIds: [] }))
    binding.stationPlans.find((p: any) => p.id === virtual).sectorMacro = mercury
    localStorage.setItem(key, JSON.stringify(state))
  }, { guid: GUID, virtual: VIRTUAL, mercury: MERCURY })
  await page.reload()
  await openMap(page)
  await tab(page, '分配方案').click()
  const cards = page.locator('.allocation-card')
  await expect.poll(() => cards.count()).toBeGreaterThan(0)
  const assignmentCard = cards.filter({ hasText: '水星' })
  await expect(assignmentCard).toHaveCount(1)
  const assignmentSector = assignmentCard.locator('.card-sector-name')
  await expect(assignmentSector).toHaveText('水星')
  const old = await sector(page, MERCURY).boundingBox()
  expect(old).not.toBeNull()
  await assignmentSector.click()
  await expect.poll(async () => {
    const next = await sector(page, MERCURY).boundingBox()
    return next && `${next.x}:${next.y}`
  }).not.toBe(`${old!.x}:${old!.y}`)
})

test('旧3.4与3.1.3/3.4.2 初始无色无fill且重算保留edited color', async ({ page }) => {
  await page.evaluate(guid => {
    const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    const state = JSON.parse(localStorage.getItem(key)!)
    const binding = state.list.find((b: any) => b.gameGuid === guid)
    binding.groups = binding.groups.map((g: any) => ({ ...g, color: undefined }))
    localStorage.setItem(key, JSON.stringify(state))
  }, GUID)
  await page.reload(); await openMap(page)
  await expect(hub(page).locator('.color-chip')).toHaveCSS('border-style', 'dashed')
  await expect(page.locator('.sector-group-color-layer polygon')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await hub(page).locator('.color-chip').click(); await page.locator('.preset-color').first().click()
  const color = '#f44e3b'
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe(color)
  await page.getByRole('button', { name: '重算', exact: true }).click()
  await expect(page.locator('.generate-card')).toBeVisible()
  await page.getByRole('button', { name: '重新计算', exact: true }).click()
  await expect(page.locator('.generate-card')).toBeHidden()
  expect((await groups(page)).find((g: any) => g.sectorMacro === HUB).color).toBe('#f44e3b')
})

test('4.3.3 row结构不包含group-title或group-name元素', async ({ page }) => {
  await openMap(page); await tab(page, '虚拟空间站').click()
  const row = existing(page)
  await expect(row).toHaveCount(1)
  await expect(row.locator('.virtual-name')).toHaveText('新建空间站')
  await expect(row.locator('.virtual-sub')).toContainText('小行星带')
  await expect(row.locator('.virtual-group-title, .group-name')).toHaveCount(0)
})

test('5.1.3 蓝图真实拖放复制完整settings', async ({ page }) => {
  await openMap(page); await tab(page, '虚拟空间站').click()
  await page.locator('.virtual-group').filter({ has: existing(page) }).locator('.virtual-group-title').click()
  await page.locator('.blueprint-empire-button').click()
  await page.locator('.bind-menu-item').filter({ has: page.locator('.bind-menu-item-name').filter({ hasText: /^Empire 1$/ }) }).click()
  const source = page.locator('.free-station-item').filter({ has: page.locator('.station-name').filter({ hasText: /^E1-S1$/ }) })
  await expect(source).toBeVisible()
  const point = await source.evaluate(el => {
    const box = el.getBoundingClientRect()
    for (const fx of [.5, .35, .65]) for (const fy of [.5, .35, .65]) {
      const point = { x: box.x + box.width * fx, y: box.y + box.height * fy }
      const hit = document.elementFromPoint(point.x, point.y)
      if (hit && (hit === el || el.contains(hit))) return point
    }
    return null
  })
  expect(point).not.toBeNull()
  await page.mouse.move(point!.x, point!.y, { steps: 5 }); await page.mouse.down()
  await page.mouse.move(point!.x + 12, point!.y + 12, { steps: 4 }); await expect(source).toHaveClass(/dragging/)
  const target = page.locator('.sector-hover-target[data-map-sector-id="cluster_100_sector001_macro"] .sector-polygon')
  const targetPoint = await target.evaluate(el => {
    const box = el.getBoundingClientRect(); const parent = el.closest('.sector-hover-target')!
    for (const fx of [.65, .35, .5]) for (const fy of [.6, .35, .75]) {
      const point = { x: box.x + box.width * fx, y: box.y + box.height * fy }
      if (document.elementFromPoint(point.x, point.y)?.closest('.sector-hover-target') === parent) return point
    }
    return null
  })
  expect(targetPoint).not.toBeNull()
  await page.mouse.move(targetPoint!.x, targetPoint!.y, { steps: 20 })
  await expect(page.locator('.placement-preview--binding')).toBeVisible(); await page.mouse.up()
  const created = await page.evaluate(() => (window as any).liveStore.virtualStationDrafts.find((s: any) => s.name === 'E1-S1'))
  expect(created).toBeTruthy()
  const sourceSettings = await page.evaluate(() => (window as any).blueprintStore.savedEmpires.list.find((e: any) => e.id === 'empire-1').stations.find((s: any) => s.id === 'empire-1-station-1').settings)
  expect(created.settings).toEqual(sourceSettings)
  expect(created.saveStationCode).toBeUndefined()
})
