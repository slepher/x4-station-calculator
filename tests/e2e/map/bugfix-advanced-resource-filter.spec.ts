import { test, expect, type Page } from '@playwright/test'

/**
 * Bug-fix test for BUG-001: 跨 cluster 候选缺失
 *
 * Test file: tests/e2e/advanced-resource-filter/bugfix-advanced-resource-filter.spec.ts
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
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.goto('/?router=maps')
  // Wait for map workbench to be visible
  await expect(page.locator('.map-workbench')).toBeVisible()
  await page.getByTestId('map-resource-panel-tab').click()
  await page.waitForTimeout(200)
})

test('4.1 BUG-001: 跨 cluster 候选缺失 (修复后验证)', async ({ page }) => {
  // 4.1.1 在地图界面，对高级模式资源过滤面板，配置 tag 组要求跨 cluster 星区
  await page.getByTestId('map-resource-tab-advanced').click()
  await page.waitForTimeout(100)

  // Configure two groups and require a fixed cross-cluster witness.
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-add-group').click()
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()

  // 4.1.2 设置跳数为 2，勾选允许中转，点击刷新
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await jumpInput.fill('2')

  const allowTransit = page.getByTestId('map-resource-advanced-allow-transit')
  await expect(allowTransit).toBeChecked()

  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)

  // 4.1.3 修复后验证结果含 cluster_01 与 cluster_06 的固定跨 cluster witness
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const candidates = candidateList.locator('.advanced-candidate-item')
  const firstCandidate = candidates.first()
  await expect(firstCandidate).toBeVisible()
  await expect(firstCandidate.getByTestId('map-resource-advanced-resource-chip-cluster_01_sector001_macro')).toBeVisible()
  const witnessIds = await firstCandidate.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(witnessIds).toContain('cluster_01_sector001_macro')
  expect(witnessIds).toContain('cluster_06_sector001_macro')
})
