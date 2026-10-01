import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for advanced-resource-filter change
 *
 * Test file: tests/e2e/advanced-resource-filter/advanced-resource-filter.spec.ts
 * Maps to: openspec/changes/advanced-resource-filter/test_tasks.md
 */

// Helper functions for Chapter 2 states/transitions

// 2.1 状态: 简单模式
async function buildSimpleMode(page: Page, expectSelected = false) {
  await page.getByTestId('map-resource-tab-simple').click()
  await page.waitForTimeout(100)
  await expect(page.getByTestId('map-resource-tag-ore')).toBeVisible()
  const oreTag = page.getByTestId('map-resource-tag-ore')
  if (expectSelected) {
    await expect(oreTag).toHaveClass(/selected/)
  } else {
    await expect(oreTag).not.toHaveClass(/selected/)
  }
}

// 2.2 状态: 高级模式
async function buildAdvancedMode(page: Page) {
  await page.getByTestId('map-resource-tab-advanced').click()
  await page.waitForTimeout(100)
  await expect(page.getByTestId('map-resource-advanced-add-group')).toBeVisible()
  const groupCards = page.locator('.advanced-group-card.expanded')
  await expect(groupCards.first()).toBeVisible()
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await expect(jumpInput).toHaveValue('2')
  const allowTransit = page.getByTestId('map-resource-advanced-allow-transit')
  await expect(allowTransit).toBeChecked()
}

// 2.3 切换: 简单模式 -> 高级模式
async function transitionSimpleToAdvanced(page: Page) {
  await page.getByTestId('map-resource-tab-advanced').click()
  await page.waitForTimeout(100)
}

// 2.4 切换: 高级模式 -> 简单模式
async function transitionAdvancedToSimple(page: Page) {
  await page.getByTestId('map-resource-tab-simple').click()
  await page.waitForTimeout(100)
}

// 2.5 状态: tag组展开编辑态
async function buildTagGroupExpanded(page: Page) {
  await buildAdvancedMode(page)
  await page.waitForTimeout(100)
  const expandedCard = page.locator('.advanced-group-card.expanded')
  await expect(expandedCard).toBeVisible()
}

// 2.6 状态: 高级候选选中态
async function buildAdvancedCandidateSelected(page: Page) {
  await buildAdvancedMode(page)
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const firstCandidate = candidateList.locator('.advanced-candidate-item').first()
  await expect(firstCandidate).toHaveClass(/selected/)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  dbData.x4_game_version = { version: '9.0', beta: false }
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.waitForFunction(() => document.cookie.includes('user_locale=zh-CN'))
  await page.goto('/?router=maps')
  // Wait for map workbench to be visible
  await expect(page.locator('.map-workbench')).toBeVisible()
  await page.getByTestId('map-resource-panel-tab').click()
  await page.waitForTimeout(200)
})

// Chapter 2 tests

test('2.1 状态: 简单模式', async ({ page }) => {
  await buildSimpleMode(page)
})

test('2.2 状态: 高级模式', async ({ page }) => {
  await buildAdvancedMode(page)
})

test('2.3 切换: 简单模式 -> 高级模式', async ({ page }) => {
  await buildSimpleMode(page)
  await transitionSimpleToAdvanced(page)
  await expect(page.getByTestId('map-resource-tab-advanced')).toHaveClass(/active/)
  await expect(page.getByTestId('map-resource-advanced-add-group')).toBeVisible()
})

test('2.4 切换: 高级模式 -> 简单模式', async ({ page }) => {
  await buildAdvancedMode(page)
  await transitionAdvancedToSimple(page)
  await expect(page.getByTestId('map-resource-tab-simple')).toHaveClass(/active/)
  await expect(page.getByTestId('map-resource-tag-ore')).toBeVisible()
})

test('2.5 状态: tag组展开编辑态', async ({ page }) => {
  await buildTagGroupExpanded(page)
})

test('2.6 状态: 高级候选选中态', async ({ page }) => {
  await buildAdvancedCandidateSelected(page)
})

// Chapter 3 tests

test('3.1 Case: Tab 切换保持状态独立', async ({ page }) => {
  // 3.1.1 状态: 简单模式
  await buildSimpleMode(page)
  // 3.1.2 选中 ore 和 silicon 两个资源 tag，记录候选结果
  await page.getByTestId('map-resource-tag-ore').click()
  await page.getByTestId('map-resource-tag-silicon').click()
  // 3.1.3 切换: 简单模式 -> 高级模式
  await transitionSimpleToAdvanced(page)
  // 3.1.4 在高级模式下，添加两个 tag 组，组1包含 ore，组2包含 silicon，点击刷新
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-add-group').click()
  const secondGroup = page.locator('.advanced-group-card').nth(1)
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  // 3.1.5 切换: 高级模式 -> 简单模式
  await buildAdvancedMode(page)
  await transitionAdvancedToSimple(page)
  // 3.1.6 验证简单模式下 ore 和 silicon 仍然选中 #期望: [ore 和 silicon 仍为选中态]
  await expect(page.getByTestId('map-resource-tag-ore')).toHaveClass(/selected/)
  await expect(page.getByTestId('map-resource-tag-silicon')).toHaveClass(/selected/)
  // 3.1.7 切换: 简单模式 -> 高级模式
  await buildSimpleMode(page, true)
  await transitionSimpleToAdvanced(page)
  // 3.1.8 验证高级模式下之前配置的两个 tag 组仍然存在 #期望: [tag 组数量=2]
  const groupCards = page.locator('.advanced-group-card')
  await expect(groupCards).toHaveCount(2)
})

test('3.2 Case: 多 tag 组 AND 语义命中', async ({ page }) => {
  // 3.2.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.2.2 添加第一个 tag 组并选中 ore (丰度 medium)
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  // 3.2.3 添加第二个 tag 组并选中 silicon (丰度 high)
  await page.getByTestId('map-resource-advanced-add-group').click()
  const secondGroup = page.locator('.advanced-group-card').nth(1)
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.2.4 点击刷新，验证候选结果中的资源星区集合必须同时覆盖两个组 #期望: [候选资源星区满足 ore medium AND silicon high]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const firstCandidate = candidateList.locator('.advanced-candidate-item').first()
  await expect(firstCandidate).toBeVisible()
  const siliconYield = page.locator('.advanced-group-card.expanded .advanced-yield-row select').first()
  await siliconYield.selectOption('high')
  await page.getByTestId('map-resource-advanced-refresh').click()
  const firstIds = await firstCandidate.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(firstIds).toEqual([
    'cluster_01_sector001_macro', 'cluster_01_sector002_macro', 'cluster_01_sector003_macro',
    'cluster_06_sector001_macro', 'cluster_07_sector001_macro', 'cluster_13_sector001_macro',
    'cluster_24_sector001_macro', 'cluster_27_sector001_macro', 'cluster_28_sector001_macro',
    'cluster_29_sector002_macro', 'cluster_40_sector001_macro', 'cluster_41_sector001_macro',
    'cluster_48_sector001_macro', 'cluster_49_sector001_macro', 'cluster_503_sector001_macro',
    'cluster_706_sector001_macro', 'cluster_725_sector001_macro'
  ])
  await expect(firstCandidate.locator('.candidate-score')).toHaveText('5')
})

test('3.3 Case: 单星区覆盖多组', async ({ page }) => {
  // 3.3.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.3.2 添加第一个 tag 组并选中 ore (丰度 lowest)
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  // 3.3.3 添加第二个 tag 组并选中 silicon (丰度 lowest)
  await page.getByTestId('map-resource-advanced-add-group').click()
  const secondGroup = page.locator('.advanced-group-card').nth(1)
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.3.4 点击刷新，验证若某星区同时满足两个组，则该星区可覆盖全部组 #期望: [存在单星区覆盖多组的候选]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const firstCandidate = candidateList.locator('.advanced-candidate-item').first()
  await expect(firstCandidate).toBeVisible()
  const witness = firstCandidate.getByTestId('map-resource-advanced-resource-chip-cluster_01_sector001_macro')
  await expect(witness.locator('[data-testid="map-resource-advanced-group-badge-cluster_01_sector001_macro-1"]')).toBeVisible()
  await expect(witness.locator('[data-testid="map-resource-advanced-group-badge-cluster_01_sector001_macro-2"]')).toBeVisible()
  await witness.click()
  const sector = page.locator('[data-sector-hover-id="cluster_01_sector001_macro"]')
  const slices = sector.locator('[data-testid="resource-pie-slice"]')
  await expect(slices).toHaveCount(2)
  await expect(slices.nth(0)).toHaveAttribute('fill', '#B36100')
  await expect(slices.nth(1)).toHaveAttribute('fill', '#00AFB3')
})

test('3.4 Case: 日光条件参与过滤不参与评分', async ({ page }) => {
  // 3.4.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.4.2 添加一个 tag 组并选中 ore 和日光，设置日光阈值为 150
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  const sunlightTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-sunlight"]').first()
  await sunlightTag.click()
  // 3.4.3 输入 150 并真实刷新，验证固定 candidate 的 sunlight 门槛与 ore score
  const sunlightInput = page.locator('[data-testid^="map-resource-advanced-sunlight-"]').first()
  await sunlightInput.fill('150')
  await expect(sunlightInput).toHaveValue('150')
  await page.getByTestId('map-resource-advanced-refresh').click()
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  const sunlightCandidateIds = ['cluster_07_sector001_macro', 'cluster_24_sector001_macro', 'cluster_27_sector001_macro', 'cluster_49_sector001_macro']
  const sunlightCandidate = candidateList.locator('.advanced-candidate-item').first()
  const sunlightIds = await sunlightCandidate.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(sunlightIds).toEqual(sunlightCandidateIds)
  await expect(sunlightCandidate.locator('.candidate-score')).toHaveText('5')
  await expect(candidateList).toBeVisible()
  // 3.4.4 再提高到不可能阈值，真实刷新并断空
  await sunlightInput.fill('999999')
  await expect(sunlightInput).toHaveValue('999999')
  await page.getByTestId('map-resource-advanced-refresh').click()
  await expect(candidateList).toHaveCount(0)
  await expect(candidateList.locator('[data-testid="map-resource-advanced-resource-chip-cluster_01_sector001_macro"]')).toHaveCount(0)
  await expect(page.locator('.resource-empty')).toHaveText(/没有满足条件的星区|No matching/i)
  // 3.4.4 日光参与过滤，score 仍由 ore 的 level 独立决定
})

test('3.5 Case: 允许中转开关影响核心候选池', async ({ page }) => {
  // 3.5.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.5.2 配置两个 tag 组分别要求不同资源，设置跳数为 2
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-add-group').click()
  await page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first().click()
  // 3.5.3 勾选允许中转，点击刷新，验证中转核心候选可来自任意星区
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const transitCandidates = page.getByTestId('map-resource-advanced-candidate-list').locator('.advanced-candidate-item')
  const resourceSet = [
    'cluster_02_sector001_macro', 'cluster_07_sector001_macro', 'cluster_08_sector001_macro',
    'cluster_13_sector001_macro', 'cluster_29_sector002_macro', 'cluster_31_sector001_macro',
    'cluster_32_sector001_macro', 'cluster_32_sector002_macro', 'cluster_401_sector001_macro',
    'cluster_44_sector001_macro', 'cluster_46_sector001_macro', 'cluster_501_sector001_macro',
    'cluster_704_sector001_macro', 'cluster_706_sector001_macro', 'cluster_708_sector001_macro'
  ]
  const transitCandidateIndex = await transitCandidates.evaluateAll((rows, expected) => rows.findIndex(row => {
    const ids = Array.from(row.querySelectorAll('[data-testid^="map-resource-advanced-resource-chip-"]')).map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', ''))
    return JSON.stringify(ids) === JSON.stringify(expected)
  }), resourceSet)
  expect(transitCandidateIndex).toBeGreaterThanOrEqual(0)
  const transitCandidate = transitCandidates.nth(transitCandidateIndex)
  const transitResourceIds = await transitCandidate.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(transitResourceIds).toEqual(resourceSet)
  const transitHubs = await transitCandidate.locator('[data-testid^="map-resource-advanced-hub-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-hub-chip-', '')))
  expect(transitHubs).toEqual(['cluster_29_sector001_macro', 'cluster_29_sector002_macro'])
  // 3.5.4 取消勾选允许中转，点击刷新，验证中转核心候选仅来自命中的资源星区 #期望: [核心候选池变化]
  await page.getByTestId('map-resource-advanced-allow-transit').click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const restrictedCandidates = page.getByTestId('map-resource-advanced-candidate-list').locator('.advanced-candidate-item')
  const restrictedCandidateIndex = await restrictedCandidates.evaluateAll((rows, expected) => rows.findIndex(row => {
    const ids = Array.from(row.querySelectorAll('[data-testid^="map-resource-advanced-resource-chip-"]')).map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', ''))
    return JSON.stringify(ids) === JSON.stringify(expected)
  }), resourceSet)
  expect(restrictedCandidateIndex).toBeGreaterThanOrEqual(0)
  const restricted = restrictedCandidates.nth(restrictedCandidateIndex)
  const restrictedHubs = await restricted.locator('[data-testid^="map-resource-advanced-hub-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-hub-chip-', '')))
  const restrictedResources = await restricted.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(restrictedResources).toEqual(resourceSet)
  expect(restrictedHubs).toEqual(['cluster_29_sector002_macro'])
})

test('3.6 Case: 跳数约束限制可达范围', async ({ page }) => {
  // 3.6.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.6.2 配置 tag 组，设置跳数为 1
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await jumpInput.fill('1')
  await expect(jumpInput).toHaveValue('1')
  // 3.6.3 点击刷新，记录候选结果
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const jumpOne = page.getByTestId('map-resource-advanced-candidate-list').locator('.advanced-candidate-item').first()
  await expect(jumpOne).toBeVisible()
  const jumpOneIds = await jumpOne.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(jumpOneIds).toEqual([
    'cluster_01_sector001_macro', 'cluster_01_sector002_macro', 'cluster_01_sector003_macro',
    'cluster_06_sector001_macro', 'cluster_13_sector001_macro', 'cluster_503_sector001_macro',
    'cluster_725_sector001_macro'
  ])
  // 3.6.4 将跳数改为 3，再次刷新，验证候选资源星区范围扩大 #期望: [候选数量增加或持平]
  await jumpInput.fill('3')
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const jumpThree = page.getByTestId('map-resource-advanced-candidate-list').locator('.advanced-candidate-item').first()
  const jumpThreeIds = await jumpThree.locator('[data-testid^="map-resource-advanced-resource-chip-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')))
  expect(jumpThreeIds).toEqual([
    'cluster_01_sector001_macro', 'cluster_01_sector002_macro', 'cluster_01_sector003_macro',
    'cluster_02_sector001_macro', 'cluster_04_sector001_macro', 'cluster_06_sector001_macro',
    'cluster_07_sector001_macro', 'cluster_100_sector001_macro', 'cluster_112_sector002_macro',
    'cluster_113_sector001_macro', 'cluster_13_sector001_macro', 'cluster_24_sector001_macro',
    'cluster_25_sector001_macro', 'cluster_25_sector002_macro', 'cluster_26_sector001_macro',
    'cluster_26_sector002_macro', 'cluster_27_sector001_macro', 'cluster_28_sector001_macro',
    'cluster_29_sector002_macro', 'cluster_32_sector001_macro', 'cluster_32_sector002_macro',
    'cluster_36_sector001_macro', 'cluster_40_sector001_macro', 'cluster_41_sector001_macro',
    'cluster_48_sector001_macro', 'cluster_49_sector001_macro', 'cluster_503_sector001_macro',
    'cluster_705_sector001_macro', 'cluster_706_sector001_macro', 'cluster_720_sector001_macro',
    'cluster_725_sector001_macro', 'cluster_740_sector001_macro'
  ])
  expect(jumpOneIds.every(id => jumpThreeIds.includes(id))).toBe(true)
  expect(jumpThreeIds).toContain('cluster_740_sector001_macro')
  await jumpInput.fill('9')
  await expect(jumpInput).toHaveValue('5')
})

test('3.7 Case: 候选卡片交互', async ({ page }) => {
  // 3.7.1 状态: 高级候选选中态
  await buildAdvancedCandidateSelected(page)
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  // 3.7.2 点击候选卡片中的资源星区 tag，验证地图 focus 到该星区 #期望: [地图视图移动到对应星区]
  const sectorTag = candidateList.locator('.candidate-chip-button').first()
  const svg = page.locator('svg[data-testid="map-svg-canvas"]')
  const beforeFirstFocus = await svg.getAttribute('viewBox')
  await sectorTag.click()
  expect(await svg.getAttribute('viewBox')).not.toBe(beforeFirstFocus)
  // 3.7.3 点击另一候选的资源星区 tag，验证当前候选切换且地图 focus 到该星区 #期望: [候选选中态切换]
  const secondCandidate = candidateList.locator('.advanced-candidate-item').nth(1)
  await expect(secondCandidate).toBeVisible()
  await secondCandidate.locator('.candidate-chip-button').first().click()
  await expect(secondCandidate).toHaveClass(/selected/)
  const beforeHubFocus = await svg.getAttribute('viewBox')
  const hubTag = secondCandidate.locator('[data-testid^="map-resource-advanced-hub-chip-"]').first()
  await expect(hubTag).toBeVisible()
  await hubTag.click()
  expect(await svg.getAttribute('viewBox')).not.toBe(beforeHubFocus)
  await expect(secondCandidate).toHaveClass(/selected/)
})

test('3.8 Case: 组内丰度联动', async ({ page }) => {
  // 3.8.1 状态: tag组展开编辑态
  await buildTagGroupExpanded(page)
  // 3.8.2 验证存在所有项联动下拉
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  // 3.8.3 将所有项下拉改为 high，验证 ore 和 silicon 的丰度都变为 high #期望: [两个资源丰度同步更新]
  const yieldSelects = page.locator('.advanced-yield-row select')
  await expect(yieldSelects).toHaveCount(3)
  const allYieldSelect = yieldSelects.first()
  await allYieldSelect.selectOption('high')
  await expect(yieldSelects.nth(1)).toHaveValue('high')
  await expect(yieldSelects.nth(2)).toHaveValue('high')
  // 3.8.4 单独将 ore 改为 medium，验证所有项显示混合状态 #期望: [所有项下拉显示"混合"]
  await yieldSelects.nth(1).selectOption('medium')
  await expect(allYieldSelect).toHaveValue('__mixed__')
})

test('3.9 Case: 极大候选去冗余', async ({ page }) => {
  // 3.9.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.9.2 配置 tag 组使得存在子集关系
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.9.3 点击刷新，验证资源星区集合被其他候选严格全包含的候选不出现在结果中 #期望: [无严格子集候选]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  await expect(candidateList.locator('.advanced-candidate-item').first()).toBeVisible()
  const sets = await candidateList.locator('.advanced-candidate-item').evaluateAll(rows => rows.map(row => Array.from(row.querySelectorAll('[data-testid^="map-resource-advanced-resource-chip-"]')).map(node => node.getAttribute('data-testid')!.replace('map-resource-advanced-resource-chip-', '')).sort()))
  expect(sets.length).toBeGreaterThan(1)
  let hasIncomparablePair = false
  for (let leftIndex = 0; leftIndex < sets.length; leftIndex += 1) for (let rightIndex = 0; rightIndex < sets.length; rightIndex += 1) if (leftIndex !== rightIndex) {
    const left = sets[leftIndex]!
    const right = sets[rightIndex]!
    const leftStrictSubset = left.length < right.length && left.every(id => right.includes(id))
    expect(leftStrictSubset).toBe(false)
    if (!left.every(id => right.includes(id)) && !right.every(id => left.includes(id))) hasIncomparablePair = true
  }
  expect(hasIncomparablePair).toBe(true)
})

test('3.10 Case: 刷新后滚动位置保持', async ({ page }) => {
  // 3.10.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.10.2 配置 tag 组并刷新生成多个候选
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  const panelBody = page.locator('.resource-panel-body')
  const beforeScroll = await panelBody.evaluate((node) => ({ height: node.clientHeight, scrollHeight: node.scrollHeight }))
  expect(beforeScroll.scrollHeight).toBeGreaterThan(beforeScroll.height)
  await panelBody.evaluate((node) => { node.scrollTop = 140 })
  const scrolled = await panelBody.evaluate((node) => node.scrollTop)
  expect(scrolled).toBeGreaterThan(100)
  await page.getByTestId('map-resource-advanced-allow-transit').click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await expect.poll(() => panelBody.evaluate((node) => node.scrollTop)).toBeGreaterThan(100)
})

test('3.11 Case: 过滤区独立滚动', async ({ page }) => {
  // 3.11.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.11.2 添加多个 tag 组使内容超过可视高度
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('map-resource-advanced-add-group').click()
  }
  const panelBody = page.locator('.resource-panel-body')
  const viewport = page.locator('.map-viewport')
  const bodyMetrics = await panelBody.evaluate((node) => ({ height: node.clientHeight, scrollHeight: node.scrollHeight }))
  expect(bodyMetrics.scrollHeight).toBeGreaterThan(bodyMetrics.height)
  await panelBody.evaluate((node) => { node.scrollTop = node.scrollHeight })
  expect(await panelBody.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  const viewportMetrics = await viewport.evaluate((node) => ({ height: node.clientHeight, scrollHeight: node.scrollHeight }))
  expect(viewportMetrics.scrollHeight).toBe(viewportMetrics.height)
})

test('3.12 Case: 刷新后无匹配结果', async ({ page }) => {
  // 3.12.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.12.2 配置一个不可能满足的日光条件
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  const sunlightTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-sunlight"]').first()
  await sunlightTag.click()
  const sunlightInput = page.locator('[data-testid^="map-resource-advanced-sunlight-"]').first()
  await sunlightInput.fill('999999')
  await expect(sunlightInput).toHaveValue('999999')
  // 3.12.3 真实点击刷新并验证空结果
  await page.getByTestId('map-resource-advanced-refresh').click()
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  await expect(candidateList).toHaveCount(0)
  await expect(candidateList.locator('[data-testid="map-resource-advanced-resource-chip-cluster_01_sector001_macro"]')).toHaveCount(0)
  await expect(page.locator('.resource-empty')).toHaveText(/没有满足条件的星区|No matching/i)
})

test('3.13 Case: 简单模式资源过滤', async ({ page }) => {
  // 3.13.1 状态: 简单模式
  await buildSimpleMode(page)
  // 3.13.2 选中 ore 和 silicon 两个资源 tag
  await page.getByTestId('map-resource-tag-ore').click()
  await page.getByTestId('map-resource-tag-silicon').click()
  // 3.13.3 验证候选列表仅显示同时包含这两个资源的星区 #期望: [候选星区包含 ore 和 silicon]
  const candidates = page.locator('[data-testid^="map-resource-candidate-"]')
  const expectedIds = [
    'cluster_02_sector001_macro', 'cluster_47_sector001_macro', 'cluster_702_sector001_macro',
    'cluster_703_sector001_macro', 'cluster_420_sector001_macro', 'cluster_36_sector001_macro',
    'cluster_709_sector001_macro', 'cluster_15_sector002_macro', 'cluster_721_sector001_macro'
  ]
  const actualIds = await candidates.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')!.replace('map-resource-candidate-', '')))
  await expect(candidates).toHaveCount(9)
  expect(actualIds).toEqual(expectedIds)
  await expect(candidates.locator('.candidate-score')).toHaveCount(9)
  await expect(candidates.locator('.candidate-score').first()).toHaveText('10')
})

test('3.14 Case: 简单模式日光过滤', async ({ page }) => {
  // 3.14.1 状态: 简单模式
  await buildSimpleMode(page)
  // 3.14.2 选中日光 tag 并设置阈值
  const sunlightTag = page.getByTestId('map-resource-tag-sunlight')
  await sunlightTag.click()
  const sunlightInput = page.getByTestId('map-resource-sunlight-input')
  await sunlightInput.fill('999')
  await expect(sunlightInput).toHaveValue('999')
  await expect(page.getByTestId('map-resource-simple-candidate-list')).toBeVisible()
  await expect(page.locator('.resource-empty')).toHaveText(/没有满足条件的星区|No matching/i)
})

test('3.15 Case: 高级模式候选选中切换', async ({ page }) => {
  // 3.15.1 状态: 高级候选选中态
  await buildAdvancedCandidateSelected(page)
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  // 3.15.2 点击另一个候选
  const secondCandidate = candidateList.locator('.advanced-candidate-item').nth(1)
  await expect(secondCandidate).toBeVisible()
  await secondCandidate.click()
  // 3.15.3 验证选中态切换 #期望: [新候选有 selected 类，旧候选无]
  await expect(secondCandidate).toHaveClass(/selected/)
  await expect(candidateList.locator('.advanced-candidate-item').first()).not.toHaveClass(/selected/)
})

test('3.16 Case: 高级模式状态恢复', async ({ page }) => {
  // 3.16.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.16.2 配置多个 tag 组并刷新
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-add-group').click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  // 3.16.3 切换: 高级模式 -> 简单模式
  await transitionAdvancedToSimple(page)
  // 3.16.4 切换: 简单模式 -> 高级模式
  await buildSimpleMode(page)
  await transitionSimpleToAdvanced(page)
  // 3.16.5 验证 tag 组配置保留 #期望: [tag 组数量不变]
  const groupCards = page.locator('.advanced-group-card')
  await expect(groupCards).toHaveCount(2)
})

test('3.17 Case: tag组编辑交互', async ({ page }) => {
  // 3.17.1 状态: tag组展开编辑态
  await buildTagGroupExpanded(page)
  // 3.17.2 修改组内资源选择
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  // 3.17.3 点击完成按钮收起编辑
  const doneBtn = page.locator('.advanced-group-card.expanded .group-action').first()
  await doneBtn.click()
  // 3.17.4 验证组块回到摘要态 #期望: [组显示更新后的 tag 标签]
  const summaryTag = page.locator('[data-testid^="map-resource-advanced-summary-tag-"][data-testid$="-ore"]')
  await expect(summaryTag).toBeVisible()
})
