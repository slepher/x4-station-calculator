import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('Empire CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    dbData.x4_game_version = { version: '9.0', beta: false }
    dbData.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.getByTestId('sidebar-add-station').click()
    await expect(page.locator('[data-testid="sidebar-station"][data-station-id]')).toHaveCount(1)
  })

  test('opens load modal from toolbar', async ({ page }) => {
    const loadBtn = page.locator('[data-testid="toolbar-load-btn"]')
    await expect(loadBtn).toBeVisible()
    await loadBtn.click()
    await expect(page.locator('[data-testid="dialog-backdrop"]')).toBeVisible()
  })

  test('default empire exists with one station', async ({ page }) => {
    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const count = await stationTabs.count()
    expect(count).toBe(1)
  })

  test('new button creates fresh empire', async ({ page }) => {
    const oldId = await page.getByTestId('sidebar-station').getAttribute('data-station-id')
    const newBtn = page.locator('[data-testid="toolbar-new-btn"]')
    await newBtn.click()

    const dialog = page.locator('[data-testid="dialog-backdrop"]')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /丢弃|Discard/ }).click()
    await expect(dialog).toBeHidden()

    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const count = await stationTabs.count()
    expect(count).toBe(1)
    await expect(stationTabs).not.toHaveAttribute('data-station-id', oldId!)
  })

  test('load modal opens and shows saved empires', async ({ page }) => {
    await page.getByTestId('toolbar-save-btn').click()
    const dialog = page.getByTestId('dialog-backdrop')
    await expect(dialog).toBeVisible()
    await dialog.locator('.dialog-input').fill('Loadable Empire')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).toBeHidden()
    const savedStationId = await page.getByTestId('sidebar-station').getAttribute('data-station-id')
    await page.getByTestId('toolbar-new-btn').click()
    await expect(page.getByTestId('sidebar-station')).not.toHaveAttribute('data-station-id', savedStationId!)
    await page.getByTestId('toolbar-load-btn').click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Loadable Empire')
    await expect(dialog.getByTestId('load-empire-btn')).toHaveCount(1)
    await dialog.getByTestId('load-empire-btn').click()
    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('sidebar-station')).toHaveAttribute('data-station-id', savedStationId!)
  })
})
