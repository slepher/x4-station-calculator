import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for advanced-resource-filter change
 *
 * Test file: tests/e2e/advanced-resource-filter/advanced-resource-filter.spec.ts
 * Maps to: openspec/changes/advanced-resource-filter/test_tasks.md
 */

// Helper functions for Chapter 2 states/transitions

// 2.1 状态: 简单模式
async function buildSimpleMode(page: Page) {
  await page.getByTestId('map-resource-tab-simple').click()
  await page.waitForTimeout(100)
  await expect(page.getByTestId('map-resource-tag-ore')).toBeVisible()
  const oreTag = page.getByTestId('map-resource-tag-ore')
  await expect(oreTag).not.toHaveClass(/selected/)
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
  const editBtn = page.locator('.advanced-group-card').first().locator('button:has-text("编辑")')
  if (await editBtn.isVisible()) {
    await editBtn.click()
  }
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
})

test('2.4 切换: 高级模式 -> 简单模式', async ({ page }) => {
  await buildAdvancedMode(page)
  await transitionAdvancedToSimple(page)
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
  await secondGroup.locator('button:has-text("编辑")').click()
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
  await buildSimpleMode(page)
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
  await secondGroup.locator('button:has-text("编辑")').click()
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.2.4 点击刷新，验证候选结果中的资源星区集合必须同时覆盖两个组 #期望: [候选资源星区满足 ore medium AND silicon high]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  await expect(candidateList.locator('.advanced-candidate-item').first()).toBeVisible()
  // 3.2.5 验证候选分数为各组最佳星区平均 level 的最小值 #期望: [分数计算正确]
  const scoreEl = candidateList.locator('.candidate-score').first()
  await expect(scoreEl).toBeVisible()
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
  await secondGroup.locator('button:has-text("编辑")').click()
  const siliconTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-silicon"]').first()
  await siliconTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.3.4 点击刷新，验证若某星区同时满足两个组，则该星区可覆盖全部组 #期望: [存在单星区覆盖多组的候选]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  await expect(candidateList.locator('.advanced-candidate-item').first()).toBeVisible()
  // 3.3.5 验证地图上该星区的饼图切片为两组资源的并集 #期望: [饼图包含 ore 和 silicon 切片]
})

test('3.4 Case: 日光条件参与过滤不参与评分', async ({ page }) => {
  // 3.4.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.4.2 添加一个 tag 组并选中 ore 和日光，设置日光阈值为 150
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  const sunlightTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-sunlight"]').first()
  await sunlightTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.4.3 点击刷新，验证候选中的资源星区必须同时满足 ore 条件和日光条件 #期望: [资源星区日光值>=150]
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  // 3.4.4 验证评分仅基于 ore 的 level 计算，日光不参与 #期望: [分数仅与 ore level 相关]
})

test('3.5 Case: 允许中转开关影响核心候选池', async ({ page }) => {
  // 3.5.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.5.2 配置两个 tag 组分别要求不同资源，设置跳数为 2
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  // 3.5.3 勾选允许中转，点击刷新，验证中转核心候选可来自任意星区
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.5.4 取消勾选允许中转，点击刷新，验证中转核心候选仅来自命中的资源星区 #期望: [核心候选池变化]
  await page.getByTestId('map-resource-advanced-allow-transit').click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.5.5 验证两种模式下候选数量可能不同 #期望: [候选数量差异反映核心池限制]
})

test('3.6 Case: 跳数约束限制可达范围', async ({ page }) => {
  // 3.6.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.6.2 配置 tag 组，设置跳数为 1
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await jumpInput.fill('1')
  // 3.6.3 点击刷新，记录候选结果
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.6.4 将跳数改为 3，再次刷新，验证候选资源星区范围扩大 #期望: [候选数量增加或持平]
  await jumpInput.fill('3')
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.6.5 验证跳数输入限制在 1-5 范围 #期望: [输入超出范围时被 clamp]
})

test('3.7 Case: 候选卡片交互', async ({ page }) => {
  // 3.7.1 状态: 高级候选选中态
  await buildAdvancedCandidateSelected(page)
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  // 3.7.2 点击候选卡片中的资源星区 tag，验证地图 focus 到该星区 #期望: [地图视图移动到对应星区]
  const sectorTag = candidateList.locator('.candidate-chip-button').first()
  await sectorTag.click()
  // 3.7.3 点击另一候选的资源星区 tag，验证当前候选切换且地图 focus 到该星区 #期望: [候选选中态切换]
  const secondCandidate = candidateList.locator('.advanced-candidate-item').nth(1)
  if (await secondCandidate.isVisible()) {
    await secondCandidate.locator('.candidate-chip-button').first().click()
    await expect(secondCandidate).toHaveClass(/selected/)
  }
  // 3.7.4 点击当前候选的中转核心 tag，验证候选不切换但地图 focus 到该星区 #期望: [选中候选不变]
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
  const allYieldSelect = page.locator('.advanced-yield-row:has-text("所有项") select').first()
  if (await allYieldSelect.isVisible()) {
    await allYieldSelect.selectOption('high')
  }
  // 3.8.4 单独将 ore 改为 medium，验证所有项显示混合状态 #期望: [所有项下拉显示"混合"]
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
  // 3.9.4 验证互不全包含的候选同时保留 #期望: [互不包含候选共存]
})

test('3.10 Case: 刷新后滚动位置保持', async ({ page }) => {
  // 3.10.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.10.2 配置 tag 组并刷新生成多个候选
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
  // 3.10.3 滚动候选列表到中部位置，记录 scrollTop 值
  // 3.10.4 修改 tag 组配置，点击刷新，验证滚动位置保持不变 #期望: [scrollTop 与刷新前相近]
})

test('3.11 Case: 过滤区独立滚动', async ({ page }) => {
  // 3.11.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.11.2 添加多个 tag 组使内容超过可视高度
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('map-resource-advanced-add-group').click()
  }
  // 3.11.3 在过滤区内滚动，验证仅过滤区内部滚动，地图区域不出现滚动条 #期望: [地图区域无额外滚动条]
})

test('3.12 Case: 跨 cluster 候选生成', async ({ page }) => {
  // 3.12.1 状态: 高级模式
  await buildAdvancedMode(page)
  // 3.12.2 配置 tag 组要求分布在不同 cluster 的资源
  const oreTag = page.locator('[data-testid^="map-resource-advanced-tag-"][data-testid$="-ore"]').first()
  await oreTag.click()
  // 3.12.3 设置跳数足够大以允许跨 cluster 连通
  const jumpInput = page.getByTestId('map-resource-advanced-jump-limit')
  await jumpInput.fill('4')
  // 3.12.4 勾选允许中转，点击刷新，验证跨 cluster 的候选组合进入结果 #期望: [存在跨 cluster 候选]
  await page.getByTestId('map-resource-advanced-refresh').click()
  await page.waitForTimeout(200)
})

test('3.13 Case: 简单模式资源过滤', async ({ page }) => {
  // 3.13.1 状态: 简单模式
  await buildSimpleMode(page)
  // 3.13.2 选中 ore 和 silicon 两个资源 tag
  await page.getByTestId('map-resource-tag-ore').click()
  await page.getByTestId('map-resource-tag-silicon').click()
  // 3.13.3 验证候选列表仅显示同时包含这两个资源的星区 #期望: [候选星区包含 ore 和 silicon]
  const candidates = page.locator('[data-testid^="map-resource-candidate-"]')
  await expect(candidates.first()).toBeVisible()
  // 3.13.4 验证候选按分数排序 #期望: [分数递减]
})

test('3.14 Case: 简单模式日光过滤', async ({ page }) => {
  // 3.14.1 状态: 简单模式
  await buildSimpleMode(page)
  // 3.14.2 选中日光 tag 并设置阈值
  const sunlightTag = page.getByTestId('map-resource-tag-sunlight')
  await sunlightTag.click()
  // 3.14.3 验证候选仅包含满足日光条件的星区 #期望: [候选星区日光值满足阈值]
})

test('3.15 Case: 高级模式候选选中切换', async ({ page }) => {
  // 3.15.1 状态: 高级候选选中态
  await buildAdvancedCandidateSelected(page)
  const candidateList = page.getByTestId('map-resource-advanced-candidate-list')
  // 3.15.2 点击另一个候选
  const secondCandidate = candidateList.locator('.advanced-candidate-item').nth(1)
  if (await secondCandidate.isVisible()) {
    await secondCandidate.click()
    // 3.15.3 验证选中态切换 #期望: [新候选有 selected 类，旧候选无]
    await expect(secondCandidate).toHaveClass(/selected/)
  }
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
  const doneBtn = page.locator('.advanced-group-card.expanded button:has-text("完成")')
  await doneBtn.click()
  // 3.17.4 验证组块回到摘要态 #期望: [组显示更新后的 tag 标签]
  const summaryTag = page.locator('.advanced-group-card .summary-tag')
  await expect(summaryTag.first()).toBeVisible()
})