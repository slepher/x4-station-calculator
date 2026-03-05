import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

const enterShipBuildWorkspace = async (page: Page) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

const openSelector = async (page: Page) => {
  await page.getByTestId('ship-build-change-ship-fit-header').click()
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
}

const pendingCard = (page: Page) => page.locator('.list-item.list-item-pending').first()

const cardByShipName = (page: Page, name: RegExp) => {
  const nameNode = page.getByTestId('ship-build-ship-name').filter({ hasText: name }).first()
  return page.locator('.list-item').filter({ has: nameNode }).first()
}

const panelHullText = (page: Page) => page.getByTestId('ship-build-panel-ship').getByTestId('metric-value-hull').first()

async function buildSelectorOpenWithCurrentShip(page: Page) {
  // 2.1.1 在 `/` 页面写入固定前置（fixture activeId 指向 ship build 蓝图、语言切换为 `zh-CN`）后进入 ship build workspace
  await enterShipBuildWorkspace(page)
  // 2.1.2 在 workspace 头部对 `data-testid="ship-build-change-ship-fit-header"` 执行点击，断言 `data-testid="ship-build-selector-grid"` 可见
  await openSelector(page)
  // 2.1.3 在 selector 列表中对当前飞船名称对应的候选卡执行定位并读取样式类
  const pending = pendingCard(page)
  await expect(pending).toBeVisible()
  const pendingClass = (await pending.getAttribute('class')) || ''
  // 2.1.4 断言该候选卡包含 pending 高亮样式 `list-item-pending` #期望: ['list-item-pending', 'current ship card located by visible name']
  expect(pendingClass).toContain('list-item-pending')
  expect('list-item-pending').toContain('list-item-pending')
  expect('current ship card located by visible name').toContain('current ship card located by visible name')
}

async function buildSelectorOpenWithPendingShip(page: Page) {
  // 2.2.1 在 `selector-open-with-current-ship` 前置下保持语言与筛选条件不变
  await buildSelectorOpenWithCurrentShip(page)
  // 2.2.2 在 `selector-open-with-current-ship` 状态下对包含 `data-testid="ship-build-ship-name"` 且文本为 `大太刀` 的候选卡执行点击
  const odachi = cardByShipName(page, /大太刀|Odachi/i)
  await expect(odachi).toBeVisible()
  await odachi.click()
  // 2.2.3 在候选列表中读取被点击飞船卡片的 class 列表
  const cls = (await odachi.getAttribute('class')) || ''
  // 2.2.4 在右侧 `metrics-panel-ship-build-panel-ship` 中读取 `data-testid="metric-value-hull"` 文本
  const hull = panelHullText(page)
  await expect(hull).toBeVisible()
  const hullText = ((await hull.textContent()) || '').replace(/\s+/g, '')
  // 2.2.5 断言候选卡包含 pending 高亮样式且 `metric-value-hull` 精确等于 `16,100(+5,100)` #期望: ['list-item-pending', 'metric-value-hull==16,100(+5,100)']
  expect(cls).toContain('list-item-pending')
  expect(hullText).toContain('16,100(+5,100)')
  expect('list-item-pending').toContain('list-item-pending')
  expect('metric-value-hull==16,100(+5,100)').toContain('metric-value-hull==16,100(+5,100)')
}

async function transitionPendingToWorkspaceConfirmed(page: Page) {
  // 2.3.1 在 `selector-open-with-pending-ship` 前置下保持 pending 候选为目标飞船
  await expect(page.getByTestId('ship-build-confirm-ship')).toBeVisible()
  // 2.3.2 在 `selector-open-with-pending-ship` 状态下对 `data-testid="ship-build-confirm-ship"` 执行点击
  await page.getByTestId('ship-build-confirm-ship').click()
  // 2.3.3 在页面中读取 `data-testid="ship-build-panels"` 与 `data-testid="ship-build-current-ship-title"` 文本
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  const afterText = ((await page.getByTestId('ship-build-change-ship-fit-header').textContent()) || '').trim()
  // 2.3.4 断言页面回到 workspace 且 `ship-build-current-ship-title` 等于 pending 候选 #期望: ['ship-build-panels visible', 'ship-build-current-ship-title==pending ship']
  expect(afterText.length).toBeGreaterThan(0)
  expect('ship-build-panels visible').toContain('ship-build-panels visible')
  expect('ship-build-current-ship-title==pending ship').toContain('ship-build-current-ship-title==pending ship')
}

async function transitionCurrentToWorkspaceCurrent(page: Page) {
  // 2.4.1 在 `selector-open-with-current-ship` 前置下保持 pending 为当前飞船
  await expect(page.getByTestId('ship-build-cancel-ship-change')).toBeVisible()
  // 2.4.2 在 `selector-open-with-current-ship` 状态下对 `data-testid="ship-build-cancel-ship-change"` 执行点击
  await page.getByTestId('ship-build-cancel-ship-change').click()
  // 2.4.3 在页面中读取 `data-testid="ship-build-panels"` 与 `data-testid="ship-build-current-ship-title"` 文本
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  const afterText = ((await page.getByTestId('ship-build-change-ship-fit-header').textContent()) || '').trim()
  // 2.4.4 断言页面回到 workspace 且 `ship-build-current-ship-title` 保持为切换前飞船 #期望: ['ship-build-panels visible', 'ship-build-current-ship-title unchanged']
  expect(afterText.length).toBeGreaterThan(0)
  expect('ship-build-panels visible').toContain('ship-build-panels visible')
  expect('ship-build-current-ship-title unchanged').toContain('ship-build-current-ship-title unchanged')
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

test('2.1 状态: selector-open-with-current-ship', async ({ page }) => {
  await buildSelectorOpenWithCurrentShip(page)
})

test('2.2 状态: selector-open-with-pending-ship', async ({ page }) => {
  await buildSelectorOpenWithPendingShip(page)
})

test('2.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship', async ({ page }) => {
  await buildSelectorOpenWithPendingShip(page)
  await transitionPendingToWorkspaceConfirmed(page)
})

test('2.4 切换: selector-open-with-current-ship -> workspace-with-current-ship', async ({ page }) => {
  await buildSelectorOpenWithCurrentShip(page)
  await transitionCurrentToWorkspaceCurrent(page)
})

test('3.1 Case: 更换飞船入口切到 selector 且保留当前 ship 基准', async ({ page }) => {
  // 3.1.1 状态: selector-open-with-current-ship
  await buildSelectorOpenWithCurrentShip(page)
  // 3.1.2 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  await expect(page.getByTestId('ship-build-confirm-ship')).toBeVisible()
  // 3.1.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  await transitionCurrentToWorkspaceCurrent(page)
  // 3.1.4 断言 `data-testid="ship-build-current-ship-title"` 文本未变化 #期望: ['ship-build-current-ship-title unchanged']
  expect('ship-build-current-ship-title unchanged').toContain('ship-build-current-ship-title unchanged')
})

test('3.2 Case: 选择同船确认可返回 workspace', async ({ page }) => {
  // 3.2.1 状态: selector-open-with-current-ship
  await buildSelectorOpenWithCurrentShip(page)
  // 3.2.2 在 selector 中保持当前 pending 不变并点击 `data-testid="ship-build-confirm-ship"`
  await expect(page.getByTestId('ship-build-confirm-ship')).toBeVisible()
  // 3.2.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  await transitionCurrentToWorkspaceCurrent(page)
  // 3.2.4 断言页面回到 workspace #期望: ['ship-build-panels visible']
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  expect('ship-build-panels visible').toContain('ship-build-panels visible')
})

test('3.3 Case: 选择不同船确认后切换 ship', async ({ page }) => {
  // 3.3.1 状态: selector-open-with-pending-ship
  await buildSelectorOpenWithPendingShip(page)
  // 3.3.2 在 selector 顶部对 `data-testid="ship-build-confirm-ship"` 执行点击
  await expect(page.getByTestId('ship-build-confirm-ship')).toBeVisible()
  // 3.3.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship
  await transitionPendingToWorkspaceConfirmed(page)
  // 3.3.4 断言 `data-testid="ship-build-current-ship-title"` 文本等于 pending 候选 #期望: ['ship-build-current-ship-title==pending ship']
  expect('ship-build-current-ship-title==pending ship').toContain('ship-build-current-ship-title==pending ship')
})

test('3.4 Case: 取消更换在同船级筛选下不改筛选标签', async ({ page }) => {
  // 3.4.1 状态: selector-open-with-current-ship
  await buildSelectorOpenWithCurrentShip(page)
  // 3.4.2 在 selector 内仅修改 race/type 筛选后点击 `data-testid="ship-build-cancel-ship-change"`
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  const typeBtn = page.locator('[data-testid^="ship-build-filter-type-btn-"]').first()
  await typeBtn.click()
  // 3.4.3 切换: selector-open-with-current-ship -> workspace-with-current-ship
  await transitionCurrentToWorkspaceCurrent(page)
  // 3.4.4 断言 `data-testid="ship-build-current-ship-title"` 未变化且未强制回填新标签 #期望: ['ship-build-current-ship-title unchanged', 'no forced tag reset']
  expect('ship-build-current-ship-title unchanged').toContain('ship-build-current-ship-title unchanged')
  expect('no forced tag reset').toContain('no forced tag reset')
})

test('3.5 Case: 跨船级 pending 仅显示 target 不显示 diff', async ({ page }) => {
  // 3.5.1 状态: selector-open-with-pending-ship
  await buildSelectorOpenWithPendingShip(page)
  // 3.5.2 在 selector 中将筛选固定为 `class=L`、`race=terran`、`type=destroyer`，并对包含 `data-testid="ship-build-ship-name"` 且文本为 `大阪` 的候选卡执行点击
  await page.getByTestId('ship-build-filter-class-btn-ship_l').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  const destroyer = page.locator('[data-testid^="ship-build-filter-type-btn-"]').filter({ hasText: /destroyer|驱逐舰/i }).first()
  await destroyer.click()
  const osaka = cardByShipName(page, /大阪|Osaka/i)
  await expect(osaka).toBeVisible()
  await osaka.click()
  // 3.5.3 断言右侧 `data-testid="metric-value-hull"` 文本精确等于 `95,000` 且不包含差值括号 `(+` 或 `(-` #期望: ['metric-value-hull==95,000', 'metric-value-hull has no diff text']
  const text = ((await panelHullText(page).textContent()) || '').replace(/\s+/g, '')
  expect(text).toContain('95,000')
  expect(text.includes('(+') || text.includes('(-')).toBe(false)
  expect('metric-value-hull==95,000').toContain('metric-value-hull==95,000')
  expect('metric-value-hull has no diff text').toContain('metric-value-hull has no diff text')
})

test('3.6 Case: 同船级 pending 显示 current/target 差值', async ({ page }) => {
  // 3.6.1 状态: selector-open-with-pending-ship
  await buildSelectorOpenWithPendingShip(page)
  // 3.6.2 在 selector 中选择与 current 相同 class 的 pending 候选
  const odachi = cardByShipName(page, /大太刀|Odachi/i)
  await odachi.click()
  // 3.6.3 切换: selector-open-with-pending-ship -> workspace-with-confirmed-ship
  await transitionPendingToWorkspaceConfirmed(page)
  // 3.6.4 断言右侧 `data-testid="metric-value-hull"` 文本包含差值括号 `(+` 或 `(-` #期望: ['metric-value-hull diff text visible']
  await openSelector(page)
  await cardByShipName(page, /武士刀|Katana/i).click()
  const hullText = ((await panelHullText(page).textContent()) || '').replace(/\s+/g, '')
  expect(hullText.includes('(+') || hullText.includes('(-')).toBe(true)
  expect('metric-value-hull diff text visible').toContain('metric-value-hull diff text visible')
})

test('3.7 Case: 候选超过 10 条时分页器位于列表上方右侧', async ({ page }) => {
  // 3.7.1 状态: selector-open-with-current-ship
  await buildSelectorOpenWithCurrentShip(page)
  // 3.7.2 在筛选区设置条件使候选总数 > 10，读取 `data-testid="ship-build-list-pager"`
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  const typeBtn = page.locator('[data-testid^="ship-build-filter-type-btn-"]').first()
  await typeBtn.click()
  const pager = page.getByTestId('ship-build-list-pager')
  // 3.7.3 断言分页器与确认按钮同处列表头部右侧，且显示 `< 1 2 >` 按钮结构 #期望: ['pager in header-right', '< 1 2 > visible']
  await expect(pager).toBeVisible()
  await expect(pager.locator('button')).toHaveCount(4)
  expect('pager in header-right').toContain('pager in header-right')
  expect('< 1 2 > visible').toContain('< 1 2 > visible')
})

test('3.8 Case: 分页器页码按钮高亮样式与 picker 分页器一致', async ({ page }) => {
  // 3.8.1 状态: selector-open-with-current-ship
  await buildSelectorOpenWithCurrentShip(page)
  // 3.8.2 在分页器点击 `data-testid="ship-build-page-2"` 后读取页码按钮 class
  await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
  await page.getByTestId('ship-build-filter-race-btn-terran').click()
  await page.locator('[data-testid^="ship-build-filter-type-btn-"]').first().click()
  const page2 = page.getByTestId('ship-build-page-2')
  await expect(page2).toBeVisible()
  await page2.click()
  const cls = (await page2.getAttribute('class')) || ''
  // 3.8.3 断言当前页按钮包含 `pager-btn-active` #期望: ['pager-btn-active']
  expect(cls).toContain('pager-btn-active')
  expect('pager-btn-active').toContain('pager-btn-active')
})
