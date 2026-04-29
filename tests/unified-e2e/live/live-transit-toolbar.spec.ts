import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

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

    const sectorTab = page.locator('.supply-tab').filter({ hasText: '小行星' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('.station-tab').filter({ hasText: '地球人' })
    await expect(stationTab).toBeVisible({ timeout: 5000 })

    const toolbar = page.locator('.live-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 5000 })

    const toolbarLabel = toolbar.locator('.group-label').first()
    await expect(toolbarLabel).toBeVisible({ timeout: 3000 })

    const nameInput = toolbar.locator('.ghost-input')
    await expect(nameInput).toBeVisible({ timeout: 3000 })

    await page.waitForTimeout(300)

    const inputValue = await nameInput.inputValue()
    expect(inputValue).toBe('小行星')

    await nameInput.fill('测试名称')
    await page.waitForTimeout(300)

    const fillValue = await nameInput.inputValue()
    expect(fillValue).toBe('测试名称')

    const renamedTab = page.locator('.supply-tab').filter({ hasText: '测试名称' })
    await expect(renamedTab).toBeVisible({ timeout: 3000 })

    const overviewTab = page.locator('.overview-tab')
    await expect(overviewTab).toBeVisible({ timeout: 3000 })
    await overviewTab.click()
    await page.waitForTimeout(300)

    await expect(renamedTab).toBeVisible({ timeout: 3000 })
    await renamedTab.click()
    await page.waitForTimeout(500)

    const restoredInput = page.locator('.live-toolbar .ghost-input')
    await expect(restoredInput).toBeVisible({ timeout: 3000 })
    const restoredValue = await restoredInput.inputValue()
    expect(restoredValue).toBe('测试名称')

    await restoredInput.fill('小行星')
    await page.waitForTimeout(300)
  })
})
