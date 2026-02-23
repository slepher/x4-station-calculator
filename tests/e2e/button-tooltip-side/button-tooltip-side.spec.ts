import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

type StorageEntry = [string, string]

function loadFixtureStorage(): StorageEntry[] {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'db.json')
  const raw = fs.readFileSync(fixturePath, 'utf-8')
  const data = JSON.parse(raw) as Record<string, unknown>
  return Object.entries(data)
    .filter(([key]) => key !== 'vsn')
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
}

const fixtureStorage = loadFixtureStorage()

test.describe('button-tooltip-side web integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((entries: StorageEntry[]) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
      for (const [key, value] of entries) {
        window.localStorage.setItem(key, value)
      }
      window.localStorage.setItem('isTestEnv', 'true')
      window.localStorage.setItem('x4_station_active_view', 'production')
    }, fixtureStorage)

    await page.goto('/')
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    const stationTab = page.locator('.station-tab[data-station-id]').first()
    await expect(stationTab).toBeVisible({ timeout: 10000 })
    await stationTab.click()
    await page.waitForSelector('.flow-wrapper', { timeout: 10000 })
  })

  test('2.0 测试启动与页面可达性', async ({ page }) => {
    const flowWrapper = page.locator('.flow-wrapper').first()
    await expect(flowWrapper).toBeVisible({ timeout: 10000 })

    const actionRail = flowWrapper.locator('.flow-action-rail')
    await expect(actionRail).toBeVisible()

    await expect(actionRail.locator('.favorite-btn')).toBeVisible()
    await expect(actionRail.locator('.lock-btn')).toBeVisible()
  })

  test('3.1 收藏按钮 tooltip 向左弹出', async ({ page }) => {
    const flowWrapper = page.locator('.flow-wrapper').first()
    const favButton = flowWrapper.locator('.favorite-btn')

    await expect(favButton).toBeVisible()
    await favButton.hover()

    const tooltip = page.locator('div.tippy-box[data-theme="x4"][data-placement="left"]')
    await expect(tooltip).toBeVisible()

    const rows = tooltip.locator('.priority-tooltip-row')
    await expect(rows.first()).toBeVisible()

    await expect(tooltip.locator('.icon-cell').first()).toBeVisible()
    await expect(tooltip.locator('.label-cell').first()).toBeVisible()
    await expect(tooltip.locator('.hours-cell').first()).toBeVisible()
    await expect(tooltip.locator('.desc-cell').first()).toBeVisible()

    const labelText = (await tooltip.locator('.label-cell').first().innerText()).trim()
    const descText = (await tooltip.locator('.desc-cell').first().innerText()).trim()
    expect(labelText.length).toBeGreaterThan(0)
    expect(descText.length).toBeGreaterThan(0)
  })

  test('3.2 锁定按钮 tooltip 向右弹出', async ({ page }) => {
    const flowWrapper = page.locator('.flow-wrapper').first()
    const lockButton = flowWrapper.locator('.lock-btn')

    await expect(lockButton).toBeVisible()
    await lockButton.hover()

    const tooltip = page.locator('div.tippy-box[data-theme="x4"][data-placement="right"]')
    await expect(tooltip).toBeVisible()

    const rows = tooltip.locator('.lock-tooltip-row')
    await expect(rows.first()).toBeVisible()

    await expect(tooltip.locator('.icon-cell').first()).toBeVisible()
    await expect(tooltip.locator('.label-cell').first()).toBeVisible()
    await expect(tooltip.locator('.desc-cell').first()).toBeVisible()

    const labelText = (await tooltip.locator('.label-cell').first().innerText()).trim()
    const descText = (await tooltip.locator('.desc-cell').first().innerText()).trim()
    expect(labelText.length).toBeGreaterThan(0)
    expect(descText.length).toBeGreaterThan(0)
  })

  test('3.3 按钮交互回归', async ({ page }) => {
    const flowWrapper = page.locator('.flow-wrapper').first()
    const favButton = flowWrapper.locator('.favorite-btn')
    const lockButton = flowWrapper.locator('.lock-btn')

    await expect(favButton).toBeVisible()
    await expect(lockButton).toBeVisible()

    const favClassBefore = await favButton.getAttribute('class')
    const favDisabled = await favButton.evaluate((el) => el.classList.contains('disabled'))

    await favButton.click()
    await page.waitForTimeout(150)

    const favClassAfter = await favButton.getAttribute('class')
    if (favDisabled) {
      expect(favClassAfter).toEqual(favClassBefore)
    } else {
      expect(favClassAfter).not.toEqual(favClassBefore)
    }

    const lockClassBefore = await lockButton.getAttribute('class')
    await lockButton.click()
    await page.waitForTimeout(150)
    const lockClassAfter = await lockButton.getAttribute('class')
    expect(lockClassAfter).not.toEqual(lockClassBefore)

    const disabledButtons = page.locator('.flow-action-rail .favorite-btn.disabled, .flow-action-rail .lock-btn.non-operable')
    const disabledCount = await disabledButtons.count()
    if (disabledCount > 0) {
      await expect(disabledButtons.first()).toBeVisible()
    }
  })
})
