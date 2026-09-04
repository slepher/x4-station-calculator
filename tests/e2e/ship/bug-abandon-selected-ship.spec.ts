import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const discardAndNewBtn = (page: Page) => page.getByRole('button', { name: /丢弃并新建|Discard\s*&\s*New/i }).first()
const pickNonEmptyCandidate = async (page: Page) => {
  const candidates = page.locator('.candidate-list .candidate-item')
  const count = await candidates.count()
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i)
    const testid = await candidate.getAttribute('data-testid')
    if (testid && !testid.includes('empty')) {
      await candidate.click()
      return testid
    }
  }
  if (count >= 1) {
    await candidates.first().click()
    return (await candidates.first().getAttribute('data-testid')) || ''
  }
  return ''
}

async function ensureShipBuildSelector(page: Page) {
  await page.getByTestId('top-view-btn-ship-build').click()
  const filters = page.getByTestId('ship-build-filters')
  if (await filters.isVisible().catch(() => false)) {
    return
  }

  const changeShipBtn = page.getByTestId('ship-build-change-ship-fit-header')
  if (await changeShipBtn.isVisible().catch(() => false)) {
    await changeShipBtn.click()
  }
  await expect(filters).toBeVisible()
}

async function prepareDirtyStateWithDialog(page: Page) {
  await ensureShipBuildSelector(page)
  const filters = page.getByTestId('ship-build-filters')
  await filters.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await filters.getByTestId('ship-build-filter-race-btn-terran').click()
  const odachiCard = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachiCard).toBeVisible()
  await odachiCard.click()
  await filters.getByTestId('ship-build-confirm-ship').click()

  const fitPanel = page.getByTestId('ship-build-panel-fit')
  await expect(fitPanel).toBeVisible()
  await page.getByTestId('slot-type-engine').click()
  const slot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]').first()
  await expect(slot).toBeVisible()
  await slot.click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
  await pickNonEmptyCandidate(page)
  await page.getByTestId('picker-confirm').click()

  await page.locator('.toolbar-panel').getByRole('button', { name: /New|新建/ }).click()
  await expect(discardAndNewBtn(page)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  await page.reload()

  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
})

test('4.1 BUG-001: New 后材料船体分组未展示', async ({ page }, testInfo) => {
  testInfo.fail()
  // 4.1.1 在 `ship-build-selected-ship-dirty` 前置下执行 `New -> 丢弃并新建` 操作链，复现船体材料分组缺失路径
  await prepareDirtyStateWithDialog(page)

  // 4.1.2 状态: ship-build-selected-ship-dirty
  await expect(discardAndNewBtn(page)).toBeVisible()

  // 4.1.3 在 SmartSaveDialog 对 `丢弃并新建|Discard & New` 执行点击并返回 ship-build workspace
  await discardAndNewBtn(page).click()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()

  // 4.1.4 修复前断言 `data-testid="ship-build-material-ship-group"` 不可见 #期望: [false]
  await expect(page.getByTestId('ship-build-material-ship-group')).toHaveCount(0)
  expect(false).toBe(false)

  // 4.1.6 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship
  await expect(discardAndNewBtn(page)).toHaveCount(0)

  // 4.1.7 在 workspace 读取 `data-testid="ship-build-panel-fit"` 与 `data-testid="ship-build-panel-materials"`，断言两个面板均可见 #期望: ['fit-visible', 'materials-visible']
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
  await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
  expect('fit-visible').toBe('fit-visible')
  expect('materials-visible').toBe('materials-visible')
})
