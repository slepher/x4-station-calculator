import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'

async function getStationNames(page: Page) {
  const labels = await page.locator('.station-tab .tab-label').allTextContents()
  return labels.map(v => v.trim())
}

async function getStationIds(page: Page) {
  return page.locator('.station-tab[data-station-id]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-station-id') || '')
      .filter(Boolean)
  )
}

async function getStationPositionSnapshot(page: Page) {
  return page.locator('.station-tab[data-station-id]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const el = node as HTMLElement
      const rect = el.getBoundingClientRect()
      return {
        id: node.getAttribute('data-station-id') || '',
        x: Math.round(rect.left + rect.width / 2)
      }
    })
  )
}

async function waitForStationCount(page: Page, count: number) {
  await expect.poll(async () => {
    return page.locator('.station-tab[data-station-id]').count()
  }, { timeout: 5000 }).toBe(count)
}

async function createNamedStations(page: Page, names: string[]) {
  const addBtn = page.locator('.add-btn').first()

  for (let i = 0; i < names.length; i++) {
    await addBtn.click({ timeout: 500 })
    await page.waitForTimeout(150)

    const currentTab = page.locator('.station-tab').nth(i)
    await currentTab.click({ timeout: 500 })

    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible({ timeout: 500 })
    await nameInput.fill(names[i]!, { timeout: 500 })
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
  }
}

async function dragStationBeforeStation(page: Page, sourceId: string, targetId: string) {
  const source = page.locator(`.station-tab[data-station-id="${sourceId}"]`).first()
  const target = page.locator(`.station-tab[data-station-id="${targetId}"]`).first()

  const s = await source.boundingBox()
  const t = await target.boundingBox()
  if (!s || !t) throw new Error('missing tab box')

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 4)
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(2000)
}

async function clickSaveAndAssertStatusMonitor(page: Page) {
  const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/ }).first()
  await saveBtn.click({ timeout: 500 })

  const monitor = page.locator('div.fixed.bottom-6.right-6.z-\\[9999\\]')
  await expect(monitor).toBeVisible({ timeout: 5000 })

  const latestCard = monitor.locator('div.pointer-events-auto').first()
  await expect(latestCard.locator('span.text-\\[10px\\].font-black.uppercase')).toContainText(/save/i)
  await expect(latestCard.locator('div.text-xs.font-mono')).toContainText(/保存|save/i)
}

async function addOneModuleToMakePlanSavable(page: Page) {
  const searchInput = page.locator('.search-box .search-input').first()
  await searchInput.focus()
  await searchInput.fill('Energy Cell')
  const resultItem = page.locator('.results-popover .result-item').first()
  await expect(resultItem).toBeVisible({ timeout: 1000 })
  await resultItem.click({ timeout: 500 })
  await expect.poll(async () => {
    return page.locator('.module-row').count()
  }, { timeout: 3000 }).toBeGreaterThan(0)
}

test.describe('station-tab-drag web integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
  })

  test('W1: 标签拖拽重排成功', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta', 'Gamma'])
    await waitForStationCount(page, 3)

    const initial = await getStationNames(page)
    const initialIds = await getStationIds(page)
    const gammaId = initialIds[2]!
    const alphaId = initialIds[0]!
    const expectedIds = [initialIds[2]!, initialIds[0]!, initialIds[1]!]

    const attempts: Array<{ attempt: number, ids: string[], pos: Array<{ id: string, x: number }> }> = []
    let finalIds = await getStationIds(page)
    for (let attempt = 0; attempt < 3; attempt++) {
      await dragStationBeforeStation(page, gammaId, alphaId)
      finalIds = await getStationIds(page)
      attempts.push({
        attempt: attempt + 1,
        ids: finalIds,
        pos: await getStationPositionSnapshot(page)
      })
      if (JSON.stringify(finalIds) === JSON.stringify(expectedIds)) {
        break
      }
    }

    expect(initial.slice(0, 3)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(
      finalIds,
      `拖拽后顺序未达到目标。expected=${JSON.stringify(expectedIds)} attempts=${JSON.stringify(attempts)}`
    ).toEqual(expectedIds)
    const firstTab = page.locator('.tabs-scroll-area .tab-item').first()
    await expect(firstTab).toHaveClass(/overview-tab/)
  })

  test('W2: 帝国总览固定首位', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta', 'Gamma'])
    const initialIds = await getStationIds(page)

    await dragStationBeforeStation(page, initialIds[2]!, initialIds[0]!)

    const firstTab = page.locator('.tabs-scroll-area .tab-item').first()
    await expect(firstTab).toHaveClass(/overview-tab/)
  })

  test('W3: 保存并刷新后顺序保持', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta', 'Gamma'])
    await waitForStationCount(page, 3)
    const initialIds = await getStationIds(page)
    const gammaId = initialIds[2]!
    const alphaId = initialIds[0]!
    const expected = [initialIds[2]!, initialIds[0]!, initialIds[1]!]

    const attempts: Array<{ attempt: number, ids: string[], pos: Array<{ id: string, x: number }> }> = []
    let finalIds = await getStationIds(page)
    for (let attempt = 0; attempt < 3; attempt++) {
      await dragStationBeforeStation(page, gammaId, alphaId)
      finalIds = await getStationIds(page)
      attempts.push({
        attempt: attempt + 1,
        ids: finalIds,
        pos: await getStationPositionSnapshot(page)
      })
      if (JSON.stringify(finalIds) === JSON.stringify(expected)) {
        break
      }
    }
    expect(
      finalIds,
      `保存前拖拽重排未达成。expected=${JSON.stringify(expected)} attempts=${JSON.stringify(attempts)}`
    ).toEqual(expected)

    await addOneModuleToMakePlanSavable(page)
    await clickSaveAndAssertStatusMonitor(page)

    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

    await waitForStationCount(page, 3)
    const reloaded = await getStationIds(page)
    expect(reloaded).toEqual(expected)

    const firstTab = page.locator('.tabs-scroll-area .tab-item').first()
    await expect(firstTab).toHaveClass(/overview-tab/)
    await expect(page.locator('.station-tab[data-station-id]')).toHaveCount(3)
  })

  test('W4: 取消拖拽不改变顺序', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta', 'Gamma'])
    const before = await getStationNames(page)

    const source = page.locator('.station-tab').nth(2)
    const s = await source.boundingBox()
    if (!s) throw new Error('missing source tab box')

    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 6)
    await page.mouse.move(20, 20, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const after = await getStationNames(page)
    expect(after).toEqual(before)
  })
})
