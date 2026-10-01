import { test } from '../test-setup'
import { expect } from '@playwright/test'
import dbFixture from '../fixtures/db.json' with { type: 'json' }

test.use({ viewport: { width: 1280, height: 720 } })

test.describe('Button Tooltip Integration', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`))
    await page.goto('/')
    await page.evaluate((fixture) => {
      for (const [key, value] of Object.entries(fixture)) {
        if (key !== 'vsn') localStorage.setItem(key, JSON.stringify(value))
      }
      localStorage.setItem('isTestEnv', 'true')
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '9.0', beta: false }))
    }, dbFixture)
    await page.reload()
    const debug = await page.evaluate(() => ({
      hasStore: !!(window as any).store,
      hasPinia: !!(window as any).__pinia
    }))
    console.log('[Test Debug]', debug)
    await page.getByTestId('language-select').selectOption('en')
    await page.locator('[data-testid="sidebar-station"][data-station-id="empire-1-station-1"]').click()
    await expect(page.locator('[data-testid="flow-wrapper"][data-resource-id="hullparts"]')).toBeVisible()
  })

  test('Tooltip persistence on click', async ({ page }) => {
    const button = page.locator('[data-resource-id="hullparts"] .favorite-btn')
    await expect(button).toHaveClass(/level-2/)
    await button.hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]').filter({ has: page.locator('.priority-tooltip-container') })
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.is-active .label-cell')).toHaveText('Primary')
    await button.click()
    await expect(button).toHaveClass(/level-1/)
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.is-active .label-cell')).toHaveText('Secondary')
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
  })

  test('Lock button tooltip persistence', async ({ page }) => {
    const button = page.locator('[data-resource-id="hullparts"] .lock-btn')
    await expect(button).not.toHaveClass(/is-locked|non-operable/)
    await button.hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]').filter({ has: page.locator('.lock-tooltip-container') })
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.is-active .label-cell')).toHaveText('Unlocked')
    await button.click()
    await expect(button).toHaveClass(/is-locked/)
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.is-active .label-cell')).toHaveText('Locked')
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
  })

  test('Tooltip Layout and Content Filtering', async ({ page }) => {
    await page.locator('[data-resource-id="hullparts"] .favorite-btn').hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]').filter({ has: page.locator('.priority-tooltip-container') })
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.priority-tooltip-container')).toHaveCSS('display', 'grid')
    const rows = tooltip.locator('.priority-tooltip-row')
    await expect(rows).toHaveCount(2)
    for (const cell of ['icon', 'label', 'hours', 'desc']) {
      await expect(rows.first().locator(`.${cell}-cell`)).toBeVisible()
    }
    await expect(rows.locator('.label-cell')).toHaveText(['Primary', 'Secondary'])
    await expect(rows.locator('.hours-cell')).toHaveText(['12h', '2h'])
    await expect(rows.locator('.desc-cell')).toHaveText(['Long', 'Short'])
    await expect(tooltip.locator('.priority-tooltip-container')).toHaveCSS('grid-template-columns', /^\S+ \S+ \S+ \S+$/)
    const labelBox = await rows.first().locator('.label-cell').boundingBox()
    const hoursBox = await rows.first().locator('.hours-cell').boundingBox()
    expect(labelBox?.width).toBeGreaterThanOrEqual(80)
    expect(hoursBox?.width).toBeGreaterThanOrEqual(70)
    await expect(rows.first().locator('.label-cell')).toHaveCSS('white-space', 'nowrap')
    await expect(rows.first().locator('.hours-cell')).toHaveCSS('white-space', 'nowrap')
  })

  test('Pure Consumption Resource Interaction', async ({ page }) => {
    const button = page.locator('[data-resource-id="ore"] .favorite-btn')
    await expect(button).toHaveClass(/disabled/)
    await expect(button).toHaveClass(/level-0/)
    await expect(button).toHaveCSS('cursor', 'default')
    await expect(button).toHaveCSS('opacity', '1')
    await button.hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip.locator('.priority-tooltip-row')).toHaveCount(1)
    await expect(tooltip.locator('.label-cell')).toHaveText('No Demand')
    await expect(tooltip.locator('.hours-cell')).toHaveText('1h')
    await expect(tooltip.locator('.desc-cell')).toHaveText('Res')
    await button.click()
    await expect(button).toHaveClass(/level-0/)
    await expect(tooltip).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
  })
})
