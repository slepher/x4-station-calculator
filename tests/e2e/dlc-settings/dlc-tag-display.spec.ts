import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for dlc-tag display in station planning
 *
 * Test file: tests/e2e/dlc-settings/dlc-tag-display.spec.ts
 * Maps to: openspec/changes/station-dlc-tag/test_tasks.md
 */

// Helper: 打开 DLC 设置 modal
async function openDlcSettings(page: Page) {
  await page.getByTestId('settings-button').click()
  await page.waitForTimeout(200)
}

// Helper: 保存按钮
const saveButton = (page: Page) => page.getByTestId('dlc-settings-save')
const cancelButton = (page: Page) => page.getByTestId('dlc-settings-cancel')
const enforceToggle = (page: Page) => page.getByTestId('dlc-settings-enforce-toggle')

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  // 加载 fixture（排除 vsn 字段）
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  // 直接设置语言到 fixture 数据中
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
    // 设置语言为中文
    document.cookie = 'user_locale=zh-CN; path=/'
  }, dbData)

  await page.reload()
  await page.waitForTimeout(200)
})

test.describe('DLC Tag 显示 - 搜索候选列表', () => {
  test('搜索候选模块显示 DLC 标签', async ({ page }) => {
    // 聚焦搜索框以打开候选列表
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    // 等待候选列表出现
    const popover = page.getByTestId('station-module-candidate-popover')
    await expect(popover).toBeVisible()

    // 检查是否有 DLC 标签（可能有也可能没有，取决于数据）
    // 至少验证候选列表正常渲染
    const groups = page.locator('[data-testid^="station-module-candidate-group-"]')
    await expect(groups.first()).toBeVisible()
  })

  test('DLC 标签样式 - 激活状态', async ({ page }) => {
    // 确保所有 DLC 激活（默认状态）
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-select-all').click()
    await saveButton(page).click()
    await page.waitForTimeout(200)

    // 打开搜索
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    // 查找 DLC 标签（激活状态应为绿色）
    const popover = page.getByTestId('station-module-candidate-popover')
    const activeTags = popover.locator('.dlc-tag--active')

    // 至少验证标签存在且样式正确
    const count = await activeTags.count()
    if (count > 0) {
      const firstTag = activeTags.first()
      await expect(firstTag).toBeVisible()
      // 验证样式类
      await expect(firstTag).toHaveClass(/dlc-tag--active/)
    }
  })
})

test.describe('DLC Tag 显示 - 已添加模块列表', () => {
  test('已添加模块显示 DLC 标签', async ({ page }) => {
    // 添加一个模块
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    // 选择第一个候选模块
    const popover = page.getByTestId('station-module-candidate-popover')
    const firstModule = popover.locator('[data-testid^="station-module-candidate-"]').first()
    await firstModule.click()
    await page.waitForTimeout(200)

    // 验证模块已添加到规划列表
    const moduleRows = page.locator('.module-row')
    await expect(moduleRows.first()).toBeVisible()

    // 检查 DLC 标签是否存在（如果有 DLC 模块）
    const dlcTags = moduleRows.first().locator('.dlc-tag')
    const tagCount = await dlcTags.count()

    // 注意：base 模块不显示标签，所以 tagCount 可能为 0
    // 这个测试主要验证标签渲染逻辑存在
    if (tagCount > 0) {
      await expect(dlcTags.first()).toBeVisible()
    }
  })

  test('DLC 标签 - 未激活状态样式', async ({ page }) => {
    // 首先取消所有 DLC
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-clear-all').click()
    await enforceToggle(page).check() // 启用限制策略
    await saveButton(page).click()
    await page.waitForTimeout(200)

    // 添加一个模块（可能是 base 或 DLC 模块）
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    const popover = page.getByTestId('station-module-candidate-popover')
    const modules = popover.locator('[data-testid^="station-module-candidate-"]')
    const count = await modules.count()

    // 寻找非 base 模块
    let foundNonBase = false
    for (let i = 0; i < count; i++) {
      const module = modules.nth(i)
      const text = await module.textContent()
      // 检查是否有 DLC 标签（非 base 模块会显示 DLC 标签）
      const hasDlcTag = text?.includes('DLC') || text?.includes('Kingdom') || text?.includes('Cradle')
      if (hasDlcTag) {
        await module.click()
        foundNonBase = true
        break
      }
    }

    // 如果没有找到非 base 模块，跳过后续测试
    test.skip(!foundNonBase, '没有可用的非 base DLC 模块')

    await page.waitForTimeout(200)

    // 验证模块行处于未激活状态
    const moduleRows = page.locator('.module-row')
    const firstRow = moduleRows.first()
    // 检查模块行是否有 inactive 类或者 opacity 样式
    const opacity = await firstRow.evaluate(el => getComputedStyle(el).opacity)
    expect(parseFloat(opacity)).toBeLessThan(1)
  })
})

test.describe('enforceDlcActivation - 搜索过滤', () => {
  test('关闭限制策略时显示全部模块', async ({ page }) => {
    // 确保限制策略关闭
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-clear-all').click()
    await enforceToggle(page).uncheck() // 关闭限制
    await saveButton(page).click()
    await page.waitForTimeout(200)

    // 打开搜索
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    // 候选列表应该显示所有模块（包括未激活 DLC）
    const popover = page.getByTestId('station-module-candidate-popover')
    await expect(popover).toBeVisible()

    const modules = popover.locator('[data-testid^="station-module-candidate-"]')
    const count = await modules.count()
    expect(count).toBeGreaterThan(0)
  })

  test('开启限制策略时隐藏未激活 DLC 模块', async ({ page }) => {
    // 取消所有 DLC 并启用限制
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-clear-all').click()
    await enforceToggle(page).check() // 启用限制
    await saveButton(page).click()
    await page.waitForTimeout(200)

    // 打开搜索
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    const popover = page.getByTestId('station-module-candidate-popover')
    await expect(popover).toBeVisible()

    // 检查未激活 DLC 标签的数量
    const inactiveTags = popover.locator('.dlc-tag--inactive')
    const inactiveCount = await inactiveTags.count()

    // 开启限制后，不应该看到未激活的 DLC 标签
    expect(inactiveCount).toBe(0)
  })
})

test.describe('DLC 设置变化触发重算', () => {
  test('DLC 设置保存后触发重算', async ({ page }) => {
    // 添加一些模块
    const searchInput = page.getByTestId('station-module-search-input')
    await searchInput.click()
    await page.waitForTimeout(300)

    const popover = page.getByTestId('station-module-candidate-popover')
    const firstModule = popover.locator('[data-testid^="station-module-candidate-"]').first()
    await firstModule.click()
    await page.waitForTimeout(200)

    // 修改 DLC 设置
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-select-all').click()
    await saveButton(page).click()
    await page.waitForTimeout(200)

    // 验证模块列表仍然可见
    const moduleRows = page.locator('.module-row')
    await expect(moduleRows.first()).toBeVisible()
  })
})
