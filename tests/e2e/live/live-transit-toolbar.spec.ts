import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'
import { getSidebarTransit } from './helpers/sidebarNavigation'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})

async function setLanguage(page: Page, lang: string) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

test.describe('Live Transit Toolbar - Group Name Binding', () => {
  test('transit toolbar displays bindingGroup.name instead of binding.name', async ({ page }) => {
    await setLanguage(page, 'zh-CN')

    const sectorTab = await getSidebarTransit(page, 'cluster_100_sector001_macro')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.locator('.sidebar-nav').click()

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })

    const toolbar = page.locator('.live-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 5000 })

    const toolbarLabel = toolbar.locator('.group-label').first()
    await expect(toolbarLabel).toBeVisible({ timeout: 3000 })

    const nameInput = toolbar.locator('.ghost-input')
    await expect(nameInput).toBeVisible({ timeout: 3000 })

    const inputValue = await nameInput.inputValue()
    expect(inputValue).toBe('小行星')
    const before = await page.evaluate(() => (window as any).saveBindingStore.activeBinding)

    await nameInput.fill('测试名称')

    const fillValue = await nameInput.inputValue()
    expect(fillValue).toBe('测试名称')

    const renamedTab = await getSidebarTransit(page, 'cluster_100_sector001_macro')
    await expect(renamedTab).toBeVisible({ timeout: 3000 })

    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await expect(overviewTab).toBeVisible({ timeout: 3000 })
    await overviewTab.click()

    await expect(renamedTab).toBeVisible({ timeout: 3000 })
    await renamedTab.locator('.sidebar-nav').click()

    const restoredInput = page.locator('.live-toolbar .ghost-input')
    await expect(restoredInput).toBeVisible({ timeout: 3000 })
    const restoredValue = await restoredInput.inputValue()
    expect(restoredValue).toBe('测试名称')
    await page.getByTestId('toolbar-save-btn').click()
    const saved = await page.evaluate(() => {
      const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
      return JSON.parse(localStorage.getItem(key)!).list.find((b: any) => b.gameGuid === 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111')
    })
    expect(saved.bindingName).toBe('slepher')
    expect(saved.groups.find((g: any) => g.sectorMacro === 'cluster_100_sector001_macro').name).toBe('测试名称')
    expect(saved.groups.filter((g: any) => g.sectorMacro !== 'cluster_100_sector001_macro')).toEqual(before.groups.filter((g: any) => g.sectorMacro !== 'cluster_100_sector001_macro'))
    expect(saved.stationPlans).toEqual(before.stationPlans)
    await page.reload()
    await page.getByTestId('top-view-btn-live-production').click()
    await (await getSidebarTransit(page, 'cluster_100_sector001_macro')).locator('.sidebar-nav').click()
    await expect(page.locator('.live-toolbar .ghost-input')).toHaveValue('测试名称')

  })
})
