import { test, expect, type Page } from '@playwright/test'

const terranId = 'module_ter_prod_energycells_01'
const baseId = 'module_gen_prod_energycells_01'
const candidate = (page: Page, id: string) => page.getByTestId(`grouped-candidate-item-${id}`)
const terranRow = (page: Page) => page.locator('.module-row').filter({ has: page.locator('.module-name-text', { hasText: /^Terran 能量电池产线$/ }) })

async function search(page: Page, query = '能量电池') {
  await page.getByTestId('candidate-search-input').fill(query)
  await expect(page.getByTestId('grouped-candidate-popover')).toBeVisible()
}

async function setDlcs(page: Page, active: boolean, enforce: boolean) {
  await page.getByTestId('settings-button').click()
  await page.getByTestId(active ? 'dlc-settings-select-all' : 'dlc-settings-clear-all').click()
  await page.getByTestId('dlc-settings-enforce-toggle').getByRole('checkbox').setChecked(enforce)
  await page.getByTestId('dlc-settings-save').click()
  await expect(page.getByTestId('dlc-settings-modal')).toBeHidden()
}

async function addTerranModule(page: Page) {
  await search(page)
  await candidate(page, terranId).click()
  await expect(terranRow(page)).toHaveCount(1)
  await expect(terranRow(page)).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  delete data['x4-setting_v9']
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.removeItem('x4-setting_v9')
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
})

test.describe('DLC Tag 显示 - 搜索候选列表', () => {
  test('搜索候选模块显示 DLC 标签', async ({ page }) => {
    await search(page)
    await expect(candidate(page, terranId).locator('.item-tag')).toHaveText('人类的摇篮')
    await expect(candidate(page, baseId)).toBeVisible()
    await expect(candidate(page, baseId).locator('.item-tag')).toHaveCount(0)
  })

  test('DLC 标签样式 - 激活状态', async ({ page }) => {
    await setDlcs(page, true, false)
    await search(page)
    await expect(candidate(page, terranId).locator('.item-tag')).toHaveClass(/item-tag--active/)
    await candidate(page, terranId).click()
    await expect(terranRow(page).locator('.dlc-tag')).toHaveClass(/dlc-tag--active/)
  })
})

test.describe('DLC Tag 显示 - 已添加模块列表', () => {
  test('已添加模块显示 DLC 标签', async ({ page }) => {
    await addTerranModule(page)
    // station-dlc-tag requires the translated DLC name as the visible label.
    await expect.soft(terranRow(page).locator('.dlc-tag')).toHaveText('人类的摇篮')
    await search(page)
    await candidate(page, baseId).click()
    const baseRow = page.locator('.module-row').filter({ has: page.locator('.module-name-text', { hasText: /^能量电池产线$/ }) })
    await expect(baseRow).toHaveCount(1)
    await expect(baseRow.locator('.dlc-tag')).toHaveCount(0)
  })

  test('DLC 标签 - 未激活状态样式', async ({ page }) => {
    // Add while active, then restrict: filtered candidates cannot create an existing inactive module.
    await addTerranModule(page)
    await setDlcs(page, false, true)
    const row = terranRow(page)
    await expect(row).toBeVisible()
    await expect(row).toHaveCSS('opacity', '0.5')
    await expect(row.locator('.dlc-tag')).toHaveClass(/dlc-tag--inactive/)
    await expect.soft(row.locator('input')).toBeDisabled()
    await expect(row.locator('.remove-btn')).toBeEnabled()
    await row.locator('.remove-btn').click()
    await expect(row).toHaveCount(0)
  })
})

test.describe('enforceDlcActivation - 搜索过滤', () => {
  test('关闭限制策略时显示全部模块', async ({ page }) => {
    await setDlcs(page, false, false)
    await search(page)
    await expect(candidate(page, terranId)).toBeVisible()
    await expect(candidate(page, terranId).locator('.item-tag')).toHaveClass(/item-tag--inactive/)
    await expect(candidate(page, baseId)).toBeVisible()
  })

  test('开启限制策略时隐藏未激活 DLC 模块', async ({ page }) => {
    await search(page)
    await expect(candidate(page, terranId)).toBeVisible()
    await page.keyboard.press('Escape')
    await setDlcs(page, false, true)
    await search(page)
    await expect(candidate(page, terranId)).toHaveCount(0)
    await expect(candidate(page, baseId)).toBeVisible()
    await search(page, terranId)
    await expect(page.locator('[data-testid^="grouped-candidate-group-"]')).toHaveCount(0)
    await page.reload()
    await page.getByTestId('sidebar-add-station').click()
    await search(page)
    await expect(candidate(page, terranId)).toHaveCount(0)
    await expect(candidate(page, baseId)).toBeVisible()
  })
})

test.describe('DLC 设置变化触发重算', () => {
  test('DLC 设置保存后触发重算', async ({ page }) => {
    await addTerranModule(page)
    const energyFlow = page.locator('[data-testid="flow-wrapper"][data-resource-id="energycells"]')
    await expect(energyFlow).toBeVisible()
    const before = await energyFlow.getByTestId('flow-value').innerText()
    expect(before).toMatch(/[1-9]/)
    await setDlcs(page, false, true)
    await expect(terranRow(page)).toBeVisible()
    await expect.configure({ soft: true }).poll(() => page.evaluate(() => (window as any).blueprintStore.stationState.productionFlows
      .filter((flow: { wareId: string }) => flow.wareId === 'energycells')
      .reduce((total: number, flow: { production: number }) => total + flow.production, 0)))
      .toBe(0)
    expect.soft((await energyFlow.getByTestId('flow-value').allTextContents()).join('')).not.toMatch(/[1-9]/)
    await setDlcs(page, false, false)
    await expect(energyFlow).toBeVisible()
    await expect(energyFlow.getByTestId('flow-value')).toHaveText(before)
  })
})
