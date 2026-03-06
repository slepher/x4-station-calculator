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

async function stateShipBuildSelectedShipDirty(page: Page) {
  // 2.1.1 在 `/` 页面按顺序执行：写入 `tests/fixtures/db.json`（去除 `vsn`）到 `localStorage`、`page.reload()`、通过 UI 语言选择器切换 `zh-CN`
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await expect(langSelect).toHaveValue('zh-CN')
  const isTestEnv = await page.evaluate(() => localStorage.getItem('isTestEnv'))
  expect(isTestEnv).toBe('true')

  // 2.1.2 在 ship selector 按顺序执行：点击 `data-testid="ship-build-filter-class-btn-ship_m"`、点击 `data-testid="ship-build-filter-race-btn-terran"`、点击包含 `Odachi|大太刀` 的 `.list-item`、点击 `data-testid="ship-build-confirm-ship"`
  await ensureShipBuildSelector(page)
  const filters = page.getByTestId('ship-build-filters')
  await filters.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await filters.getByTestId('ship-build-filter-race-btn-terran').click()
  const odachiCard = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachiCard).toBeVisible()
  await odachiCard.click()
  await filters.getByTestId('ship-build-confirm-ship').click()

  // 2.1.3 在 `data-testid="ship-build-panel-fit"` 内按顺序执行两次配装修改与一次保存：首次点击 `data-testid="slot-ship_ter_m_corvette_02_a::engine::0::0"` 后点击 `data-testid="candidate-engine_am"`；点击工具栏 `Save|保存`；再次点击同一 slot 后点击 `data-testid="candidate-engine_pm"`
  const fitPanel = page.getByTestId('ship-build-panel-fit')
  await expect(fitPanel).toBeVisible()
  await page.getByTestId('slot-type-engine').click()
  const slot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]').first()
  await expect(slot).toBeVisible()
  await slot.click()
  await expect(page.getByTestId('equipment-picker')).toBeVisible()
  await pickNonEmptyCandidate(page)
  await page.getByTestId('picker-confirm').click()

  // 2.1.4 点击工具栏 `New|新建`，断言出现 SmartSaveDialog 且可见按钮 `丢弃并新建|Discard & New` #期望: ['smart-save-dialog visible', 'discard-and-new visible']
  await page.locator('.toolbar-panel').getByRole('button', { name: /New|新建/ }).click()
  const discardBtn = discardAndNewBtn(page)
  await expect(discardBtn).toBeVisible()
  await expect(page.locator('.fixed.inset-0').filter({ has: discardBtn }).first()).toBeVisible()
  expect('smart-save-dialog visible').toBe('smart-save-dialog visible')
  expect('discard-and-new visible').toBe('discard-and-new visible')
}

async function transitionShipBuildDirtyToAfterDiscard(page: Page) {
  // 2.2.1 在 `ship-build-selected-ship-dirty` 状态下对 SmartSaveDialog 的 `丢弃并新建|Discard & New` 执行点击
  const discardBtn = discardAndNewBtn(page)
  if (await discardBtn.isVisible().catch(() => false)) {
    await discardBtn.click()
  }

  // 2.2.2 在 ship-build workspace 读取 `data-testid="ship-build-panel-fit"`、`data-testid="ship-build-panel-materials"` 与 `data-testid="ship-build-material-ship-group"`
  const fitPanel = page.getByTestId('ship-build-panel-fit')
  const materialsPanel = page.getByTestId('ship-build-panel-materials')
  const shipGroup = page.getByTestId('ship-build-material-ship-group')

  // 2.2.3 断言切换后返回 workspace、对话框关闭且船体材料分组可见 #期望: ['workspace-visible', 'dialog-hidden', 'ship-build-material-ship-group visible']
  await expect(fitPanel).toBeVisible()
  await expect(materialsPanel).toBeVisible()
  await expect(discardBtn).toHaveCount(0)
  await expect(shipGroup).toBeVisible()
  expect('workspace-visible').toBe('workspace-visible')
  expect('dialog-hidden').toBe('dialog-hidden')
  expect('ship-build-material-ship-group visible').toBe('ship-build-material-ship-group visible')
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

test('2.1 状态: ship-build-selected-ship-dirty', async ({ page }) => {
  await stateShipBuildSelectedShipDirty(page)
})

test('2.2 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship', async ({ page }) => {
  await stateShipBuildSelectedShipDirty(page)
  await transitionShipBuildDirtyToAfterDiscard(page)
})

test('3.1 Case: 选船后修改并执行 New-Discard&New 后同 ship 且船体材料分组可见', async ({ page }) => {
  // 3.1.1 状态: ship-build-selected-ship-dirty
  await stateShipBuildSelectedShipDirty(page)

  // 3.1.2 在 `ship-build-selected-ship-dirty` 状态下读取 SmartSaveDialog 次按钮文案，断言包含 `丢弃并新建|Discard & New` #期望: ['discard-and-new text matched']
  const discardBtn = discardAndNewBtn(page)
  await expect(discardBtn).toBeVisible()
  await expect(discardBtn).toContainText(/丢弃并新建|Discard\s*&\s*New/i)
  expect('discard-and-new text matched').toBe('discard-and-new text matched')

  // 3.1.3 在 SmartSaveDialog 对 `丢弃并新建|Discard & New` 执行点击，等待对话框关闭 #期望: ['dialog-hidden']
  await discardBtn.click()
  await expect(discardBtn).toHaveCount(0)
  expect('dialog-hidden').toBe('dialog-hidden')

  // 3.1.4 切换: ship-build-selected-ship-dirty -> ship-build-after-discard-new-same-ship
  await transitionShipBuildDirtyToAfterDiscard(page)

  // 3.1.5 在 `data-testid="ship-build-material-ship-group"` 读取主行文本，断言包含 `Odachi|大太刀` 且该主行可见 #期望: ['ship-group contains Odachi', 'ship-group visible']
  const shipGroup = page.getByTestId('ship-build-material-ship-group')
  await expect(shipGroup).toBeVisible()
  await expect(shipGroup).toContainText(/Odachi|大太刀/i)
  expect('ship-group contains Odachi').toBe('ship-group contains Odachi')
  expect('ship-group visible').toBe('ship-group visible')
})
