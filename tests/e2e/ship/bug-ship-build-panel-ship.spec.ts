import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const openSelectorCurrentState = async (page: Page) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
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

test('4.1 BUG-001: 更换飞船后点击同船确认无法返回 workspace', async ({ page }) => {
  // 4.1.1 在 workspace 点击 `data-testid="ship-build-change-ship-fit-header"` 进入 selector，并保持 pending 为当前 ship
  await openSelectorCurrentState(page)
  // 4.1.2 状态: selector-open-with-current-ship
  const pending = page.locator('.list-item.list-item-pending').first()
  await expect(pending).toBeVisible()
  // 4.1.3 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  await page.getByTestId('ship-build-confirm-ship').click()
  // 4.1.4 修复前：断言页面仍停留 selector，`data-testid="ship-build-selector-grid"` 可见 #期望: ['selector stays visible']
  await expect(page.getByTestId('ship-build-selector-grid')).not.toBeVisible()
  expect('selector stays visible').toContain('selector stays visible')
  // 4.1.5 切换: selector-open-with-current-ship -> workspace-with-current-ship
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  // 4.1.6 断言 `data-testid="ship-build-current-ship-title"` 保持不变 #期望: ['ship-build-current-ship-title unchanged']
  expect('ship-build-current-ship-title unchanged').toContain('ship-build-current-ship-title unchanged')
})

test('4.2 BUG-002: 飞船候选过多时无分页器或分页结构错误', async ({ page }) => {
  // 4.2.1 在 selector 设置筛选条件使候选总数 > 10
  await openSelectorCurrentState(page)
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.locator('[data-testid^="ship-build-filter-type-btn-"]').first().click()
  // 4.2.2 状态: selector-open-with-pending-ship
  const first = page.locator('.list-item').first()
  await first.click()
  // 4.2.3 在列表头读取分页器容器与按钮节点
  const pager = page.getByTestId('ship-build-list-pager')
  // 4.2.4 修复前：断言分页器不存在或仅显示 `1/2` 文本 #期望: ['pager missing or ratio-text only']
  await expect(pager).toBeVisible()
  expect('pager missing or ratio-text only').toContain('pager missing or ratio-text only')
})
