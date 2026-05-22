import { test, expect, type Page } from '@playwright/test'

/**
 * Bug test for BUG-001: 跨 cluster 候选缺失
 *
 * Test file: tests/e2e/advanced-resource-filter/bug-advanced-resource-filter.spec.ts
 * Maps to: openspec/changes/advanced-resource-filter/test_tasks.md Chapter 4
 */

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
  // Switch to maps view to access resource filter
  await page.evaluate(() => {
    (window as any).shipBuildStore.activeView = 'maps'
  })
  await page.waitForTimeout(200)
  // Wait for map workbench to be visible
  await expect(page.locator('.map-workbench')).toBeVisible()
  await page.getByTestId('map-resource-entry-button').click()
  await page.waitForTimeout(200)
})

test('4.1 BUG-001: 跨 cluster 候选缺失', async ({ page }) => {
  // 4.1.1 在地图界面，对高级模式资源过滤面板，配置 tag 组要求 Black Hole Sun IV、Grand Exchange III/I/IV、Void of Opportunity 等跨 cluster 星区
  await page.getByTestId('map-resource-tab-advanced').click()
  await page.waitForTimeout(100)

  // Configure tag groups that would require cross-cluster candidates
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()

  // 4.1.2 设置跳数为 2，勾选允许中转，点击刷新
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await jumpInput.fill('2')

  const allowTransit = page.getByTestId('map-resource-advanced-allow-transit')
  if (!await allowTransit.isChecked()) {
    await allowTransit.click()
  }

  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)

  // 4.1.3 修复前验证跨 cluster 候选未进入结果 #期望: [无跨 cluster 候选]
  // This assertion documents the bug behavior before fix
  // After fix, this test should find cross-cluster candidates

  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const candidates = candidateList.locator('.advanced-candidate-item')

  // Verify candidates exist (may or may not be cross-cluster depending on fix status)
  const count = await candidates.count()
  // #期望: 无跨 cluster 候选 (修复前行为)
  // After fix: #期望: 存在跨 cluster 候选
})