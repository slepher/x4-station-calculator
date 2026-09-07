import { test } from '../test-setup'
import { expect, type Page } from '@playwright/test'
import db from '../fixtures/db.json' with { type: 'json' }

const zone = (page: Page, id: string) => page.locator(`[data-zone-id="${id}"]`)
const state = (page: Page) => page.evaluate(() => {
  const s = (window as any).dragTestStore
  return { a: s.zoneAItems, b: s.zoneBItems, active: s.isDragging, item: s.draggingItemId, hover: s.hoveredZoneId, events: s.events.map((e: any) => e.type) }
})
async function start(page: Page, id = 'item-1', source = 'A') {
  const item = zone(page, source).locator(`[data-item-id="${id}"]`)
  const box = await item.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2 + 15, box!.y + box!.height / 2 + 15, { steps: 5 })
  await expect.poll(async () => (await state(page)).active).toBe(true)
  expect((await state(page)).item).toBe(id)
}
async function hoverB(page: Page) {
  const box = await page.getByTestId('zone-b').boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 10, { steps: 20 })
  await expect.poll(async () => (await state(page)).hover).toBe('B')
}
async function idle(page: Page) {
  await expect.poll(async () => { const s = await state(page); return [s.active, s.item, s.hover] }).toEqual([false, null, null])
  await expect(page.locator('.sortable-chosen, .sortable-ghost, .sortable-drag')).toHaveCount(0)
}
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = JSON.parse(JSON.stringify(db))
  delete fixture.vsn
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, fixture)
  await page.reload()
  await page.getByTestId('language-select').selectOption('en')
  await page.goto('/?view=drag-test&test=true')
  await expect(page.getByRole('heading', { name: 'Vue Drag Test Page' })).toBeVisible()
})

test('A.1/B.1/C.1/ST.1/ST.2/E.1 real mouse moves one item and records the complete lifecycle', async ({ page }) => {
  expect((await state(page)).a.map((i: any) => i.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
  expect((await state(page)).b).toEqual([])
  await start(page)
  await hoverB(page)
  await expect(zone(page, 'B')).toHaveClass(/border-blue-500/)
  await expect(zone(page, 'B')).toHaveClass(/bg-blue-500\/10/)
  await page.mouse.up()
  await idle(page)
  const s = await state(page)
  expect(s.a.map((i: any) => i.id)).toEqual(['item-2', 'item-3', 'item-4', 'item-5'])
  expect(s.b.map((i: any) => i.id)).toEqual(['item-1'])
  expect(s.events[0]).toBe('dragstart')
  expect(s.events).toContain('dragenter')
  expect(s.events).toContain('drop')
  expect(s.events.at(-1)).toBe('dragend')
  await expect(zone(page, 'B').locator('[data-item-id="item-1"]')).toHaveCount(1)
  // Retain original diagnostic logs; historical store-manipulation recommendations are superseded by this real UI test.
  console.log('Historical method-comparison diagnostics below are retained; current acceptance uses real mouse actions only.')
  console.log('FINDING: dispatchEvent does NOT trigger vuedraggable events')
  console.log('REASON: vuedraggable (SortableJS) does not listen to native DragEvents')
  console.log('SOLUTION: Must use Playwright mouse API or direct store manipulation')
  console.log('FINDING: Playwright Mouse API successfully triggers drag events')
  console.log('FINDING: Visual highlight works correctly during drag')
  console.log('FINDING: Data is correctly updated after drop')
  console.log('FINDING: Direct store manipulation is the most reliable method for E2E testing')
})

test('C.2/S.1/H.1/H.2/H.3/E.2/E.3 hover, leave and cancel retain all items', async ({ page }) => {
  await start(page)
  await expect(zone(page, 'B')).toHaveClass(/border-blue-500/)
  await hoverB(page)
  await expect(zone(page, 'B')).toHaveClass(/bg-blue-500\/10/)
  await page.mouse.move(5, 5, { steps: 20 })
  await expect.poll(async () => (await state(page)).hover).toBeNull()
  await page.mouse.up()
  await idle(page)
  const s = await state(page)
  expect(s.a.map((i: any) => i.id).sort()).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
  expect(s.b).toEqual([])
  expect(s.events).toContain('dragenter')
  expect(s.events).toContain('dragleave')
  expect(s.events).not.toContain('drop')
  expect(s.events[0]).toBe('dragstart')
  expect(s.events.at(-1)).toBe('dragend')
})

for (const [button, item, before, after, flag] of [
  ['Add Auto Item to Zone B', 'item-1', 'Auto', 'Manual', 'isAuto'],
  ['Add Isolated Item to Zone B', 'item-2', 'Isolate', 'Connect', 'isIsolated']
]) {
  test(`S.3/S.4 ${before} placeholder presents hover action and converts on drop`, async ({ page }) => {
    await page.getByRole('button', { name: button!, exact: true }).click()
    await start(page, item!)
    await expect(zone(page, 'B').locator('.status-label')).toHaveText(before!)
    await hoverB(page)
    await expect(zone(page, 'B').locator('.status-label')).toHaveText(after!)
    await page.mouse.up()
    await idle(page)
    const matches = (await state(page)).b.filter((i: any) => i.id === item)
    expect(matches).toHaveLength(1)
    expect(matches[0][flag!]).toBe(false)
  })
}

test('S.6 locked lineage rejects Argon without moving it', async ({ page }) => {
  await page.getByRole('button', { name: 'Zone B: Unlocked', exact: true }).click()
  await start(page, 'item-5')
  await expect(zone(page, 'B')).toHaveClass(/border-red-600/)
  await expect(zone(page, 'B').locator('.status-label')).toContainText('Rejected')
  await hoverB(page)
  await page.mouse.up()
  await idle(page)
  expect((await state(page)).b).toEqual([])
  expect((await state(page)).a.map((i: any) => i.id)).toContain('item-5')
})

test('S.5 locked lineage permits Terran', async ({ page }) => {
  await page.getByRole('button', { name: 'Zone B: Unlocked', exact: true }).click()
  await start(page, 'item-4')
  await expect(zone(page, 'B')).toHaveClass(/border-amber-500/)
  await hoverB(page)
  await page.mouse.up()
  await idle(page)
  expect((await state(page)).b.map((i: any) => i.id)).toEqual(['item-4'])
})

test('S.2/ST.4 same-zone duplicate remains unique', async ({ page }) => {
  await start(page)
  await hoverB(page)
  await page.mouse.up()
  await idle(page)
  await start(page, 'item-1', 'B')
  await expect(zone(page, 'B')).toHaveClass(/border-red-500/)
  await expect(zone(page, 'B').locator('.status-label')).toHaveText('Duplicated')
  await page.mouse.up()
  await idle(page)
  expect((await state(page)).b.map((i: any) => i.id)).toEqual(['item-1'])
})

test('ST.3 Reset restores initial state after adding placeholders', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Auto Item to Zone B', exact: true }).click()
  await page.getByRole('button', { name: 'Add Isolated Item to Zone B', exact: true }).click()
  expect((await state(page)).b.map((i: any) => i.id)).toEqual(['item-1', 'item-2'])
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  const s = await state(page)
  expect(s.a.map((i: any) => i.id)).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
  expect(s.b).toEqual([])
  expect(s.events).toEqual([])
})
