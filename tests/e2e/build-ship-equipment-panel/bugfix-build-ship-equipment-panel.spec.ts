import { expect } from '@playwright/test'
import { test } from '../../test-setup'

// Helper: 进入大太刀船只建造视图
const enterOdachi = async (page: any) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()
  const odachiItem = page.locator('.blueprint-item').filter({ hasText: /Odachi|odachi/i }).first()
  await expect(odachiItem).toBeVisible()
  await odachiItem.click()
  await odachiItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()
  await page.waitForTimeout(500)
}

// Helper: 切换到 weapon 标签
const switchToWeaponTab = async (page: any) => {
  const weaponTab = page.locator('[data-testid="slot-type-weapon"]')
  await expect(weaponTab).toBeVisible({ timeout: 10000 })
  await weaponTab.click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  // 1. 加载 fixture
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  // 2. reload
  await page.reload()

  // 3. 设置语言
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
})

// 4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化 - 修复后
test('4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化 - 修复后', async ({ page }) => {
  // 4.1.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)

  // 4.1.2 点击任一空槽位打开 Picker
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)

  // 点击武器槽位打开 Picker（不选装备，保持空槽位状态）
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)

  // 4.1.3 修复后：断言 Picker 宽度为 col-span-8（已变化）
  // #期望: ['col-span-8']
  const fitPanel = page.locator('[data-testid="ship-build-panel-fit"]')
  const fitPanelClass = await fitPanel.getAttribute('class')
  expect(fitPanelClass).toContain('col-span-8')

  // 4.1.4 修复后：断言 Material 面板隐藏
  // #期望: [hidden]
  const materialPanel = page.locator('[data-testid="ship-build-panel-materials"]')
  await expect(materialPanel).not.toBeVisible()
})
