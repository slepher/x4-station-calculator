import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import dbFixture from '../../fixtures/db.json' with { type: 'json' }

test.use({ viewport: { width: 1280, height: 720 } })

test.describe('button-tooltip-side web integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate((fixture) => {
      for (const [key, value] of Object.entries(fixture)) {
        if (key !== 'vsn') localStorage.setItem(key, JSON.stringify(value))
      }
      localStorage.setItem('isTestEnv', 'true')
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
    }, dbFixture)
    await page.reload()
    await page.getByTestId('language-select').selectOption('en')
    await page.locator('[data-testid="sidebar-station"][data-station-id="empire-1-station-1"]').click()
    await expect(page.locator('[data-testid="flow-wrapper"][data-resource-id="hullparts"]')).toBeVisible()
  })

  test('2.0 测试启动与页面可达性', async ({ page }) => {
    const rail = page.locator('[data-resource-id="hullparts"] .flow-action-rail')
    await expect(rail).toBeVisible()
    await expect(rail.locator('.favorite-btn')).toBeVisible()
    await expect(rail.locator('.lock-btn')).toBeVisible()
  })

  test('3.1 收藏按钮 tooltip 向左弹出', async ({ page }) => {
    const button = page.locator('[data-resource-id="hullparts"] .favorite-btn')
    await button.hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveAttribute('data-placement', 'left')
    const buttonBox = await button.boundingBox()
    const tooltipBox = await tooltip.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(tooltipBox).not.toBeNull()
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(buttonBox!.x)
    await expect(tooltip.locator('.priority-tooltip-row')).toHaveCount(2)
    for (const cell of ['icon', 'label', 'hours', 'desc']) {
      await expect(tooltip.locator(`.${cell}-cell`).first()).toBeVisible()
    }
    await expect(tooltip.locator('.label-cell')).toHaveText(['Primary', 'Secondary'])
    await expect(tooltip.locator('.desc-cell')).toHaveText(['Long', 'Short'])
    const labelBox = await tooltip.locator('.label-cell').first().boundingBox()
    const hoursBox = await tooltip.locator('.hours-cell').first().boundingBox()
    expect(labelBox?.width).toBeGreaterThanOrEqual(80)
    expect(hoursBox?.width).toBeGreaterThanOrEqual(70)
    await expect(tooltip.locator('.label-cell').first()).toHaveCSS('white-space', 'nowrap')
    await expect(tooltip.locator('.hours-cell').first()).toHaveCSS('white-space', 'nowrap')
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
  })

  test('3.2 锁定按钮 tooltip 向右弹出', async ({ page }) => {
    const button = page.locator('[data-resource-id="hullparts"] .lock-btn')
    await button.hover()
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveAttribute('data-placement', 'right')
    const buttonBox = await button.boundingBox()
    const tooltipBox = await tooltip.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(tooltipBox).not.toBeNull()
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(buttonBox!.x + buttonBox!.width)
    await expect(tooltip.locator('.lock-tooltip-row')).toHaveCount(2)
    for (const cell of ['icon', 'label', 'desc']) {
      await expect(tooltip.locator(`.${cell}-cell`).first()).toBeVisible()
    }
    await expect(tooltip.locator('.label-cell')).toHaveText(['Unlocked', 'Locked'])
    await expect(tooltip.locator('.desc-cell')).toHaveText(['Auto Fill', 'Keep Current'])
    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()
  })

  test('3.3 按钮交互回归', async ({ page }) => {
    const favorite = page.locator('[data-resource-id="hullparts"] .favorite-btn')
    const lock = page.locator('[data-resource-id="hullparts"] .lock-btn')
    await expect(favorite).toHaveClass(/level-2/)
    await favorite.click()
    await expect(favorite).toHaveClass(/level-1/)
    await favorite.click()
    await expect(favorite).toHaveClass(/level-2/)
    await expect(lock).not.toHaveClass(/is-locked/)
    await lock.click()
    await expect(lock).toHaveClass(/is-locked/)
    await lock.click()
    await expect(lock).not.toHaveClass(/is-locked/)
    const disabled = page.locator('[data-resource-id="ore"] .favorite-btn')
    await expect(disabled).toHaveClass(/disabled/)
    await expect(disabled).toHaveClass(/level-0/)
    await disabled.click()
    await expect(disabled).toHaveClass(/level-0/)
    const resourceLock = page.locator('[data-resource-id="ore"] .lock-btn')
    await expect(resourceLock).toHaveClass(/non-operable/)
    await expect(resourceLock).toHaveCSS('pointer-events', 'none')
  })
})
