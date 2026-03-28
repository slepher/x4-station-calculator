import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for dlc-settings change
 *
 * Test file: tests/e2e/dlc-settings/dlc-settings.spec.ts
 * Maps to: openspec/changes/dlc-setting/test_tasks.md
 */

// Helper: 打开 DLC 设置 modal
async function openDlcSettings(page: Page) {
  await page.getByTestId('settings-button').click()
  await page.waitForTimeout(200)
}

// Helper: 获取 DLC 列表中的所有项
async function getDlcListItems(page: Page) {
  return page.locator('[data-testid^="dlc-settings-item-"]')
}

// Helper: 保存按钮
const saveButton = (page: Page) => page.getByTestId('dlc-settings-save')
const cancelButton = (page: Page) => page.getByTestId('dlc-settings-cancel')
const selectAllButton = (page: Page) => page.getByTestId('dlc-settings-select-all')
const clearAllButton = (page: Page) => page.getByTestId('dlc-settings-clear-all')
const dlcModal = (page: Page) => page.getByTestId('dlc-settings-modal')
const dlcModalBackdrop = (page: Page) => page.getByTestId('dlc-settings-modal-backdrop')
const enforceToggle = (page: Page) => page.getByTestId('dlc-settings-enforce-toggle')

test.beforeEach(async ({ page }) => {
  await page.goto("/")

  // 加载 fixture（排除 vsn 字段）
  const dbFixture = await import("../../fixtures/db.json", { with: { type: "json" } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  // 直接设置语言到 fixture 数据中
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem("isTestEnv", "true")
    // 设置语言为中文
    document.cookie = "user_locale=zh-CN; path=/"
  }, dbData)

  await page.reload()
  await page.waitForTimeout(200)
})

test.describe('DLC Settings Modal - 基础交互', () => {
  test('打开 DLC 设置 modal', async ({ page }) => {
    await openDlcSettings(page)
    await expect(dlcModal(page)).toBeVisible()
    await expect(dlcModal(page).getByRole('heading', { name: 'DLC 设定' })).toBeVisible()
  })

  test('关闭 DLC 设置 modal - 点击关闭按钮', async ({ page }) => {
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-close').click()
    await expect(dlcModal(page)).not.toBeVisible()
  })

  test('关闭 DLC 设置 modal - 点击遮罩', async ({ page }) => {
    await openDlcSettings(page)
    await dlcModalBackdrop(page).click({ position: { x: 50, y: 50 } })
    await expect(dlcModal(page)).not.toBeVisible()
  })

  test('关闭 DLC 设置 modal - 点击取消按钮', async ({ page }) => {
    await openDlcSettings(page)
    await cancelButton(page).click()
    await expect(dlcModal(page)).not.toBeVisible()
  })

  test('DLC 列表显示', async ({ page }) => {
    await openDlcSettings(page)
    const items = await getDlcListItems(page)
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('全选/全不选功能', async ({ page }) => {
    await openDlcSettings(page)
    const items = await getDlcListItems(page)
    const count = await items.count()

    // 全不选
    await clearAllButton(page).click()
    for (let i = 0; i < count; i++) {
      const checkbox = items.nth(i).locator('input[type="checkbox"]')
      await expect(checkbox).not.toBeChecked()
    }

    // 全选
    await selectAllButton(page).click()
    for (let i = 0; i < count; i++) {
      const checkbox = items.nth(i).locator('input[type="checkbox"]')
      await expect(checkbox).toBeChecked()
    }
  })

  test('单个 DLC 勾选/取消', async ({ page }) => {
    await openDlcSettings(page)
    const items = await getDlcListItems(page)
    const firstItem = items.nth(0)
    const checkbox = firstItem.locator('input[type="checkbox"]')

    // 取消勾选
    if (await checkbox.isChecked()) {
      await checkbox.uncheck()
      await expect(checkbox).not.toBeChecked()
    }

    // 重新勾选
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  })

  test('限制策略开关', async ({ page }) => {
    await openDlcSettings(page)
    const toggle = enforceToggle(page)

    // 验证初始状态是 unchecked（默认 false）
    await expect(toggle).not.toBeChecked()

    // 切换到 checked
    await toggle.click()
    await page.waitForTimeout(100)
    await expect(toggle).toBeChecked()

    // 切换回 unchecked
    await toggle.click()
    await page.waitForTimeout(100)
    await expect(toggle).not.toBeChecked()
  })

  test('保存设置', async ({ page }) => {
    await openDlcSettings(page)

    // 修改一些设置 - 全选
    await selectAllButton(page).click()
    await page.waitForTimeout(100)

    // 保存
    await saveButton(page).click()
    await expect(dlcModal(page)).not.toBeVisible()

    // 重新打开验证设置已保存
    await openDlcSettings(page)
    await page.waitForTimeout(100)

    // 验证所有 DLC 都被选中
    const items = await getDlcListItems(page)
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      const checkbox = items.nth(i).locator('input[type="checkbox"]')
      await expect(checkbox).toBeChecked()
    }
  })

  test('取消保存 - 设置不持久化', async ({ page }) => {
    await openDlcSettings(page)

    // 获取初始状态
    const items = await getDlcListItems(page)
    const firstItem = items.nth(0)
    const checkbox = firstItem.locator('input[type="checkbox"]')
    const initialState = await checkbox.isChecked()

    // 修改设置
    if (initialState) {
      await checkbox.uncheck()
    } else {
      await checkbox.check()
    }

    // 取消
    await cancelButton(page).click()
    await expect(dlcModal(page)).not.toBeVisible()

    // 重新打开验证设置未保存
    await openDlcSettings(page)
    await expect(checkbox).toBeChecked(initialState)
  })
})

test.describe('DLC Settings - 红点提示', () => {
  test('未设置 DLC 时显示红点', async ({ page }) => {
    // 清除 DLC 设置
    await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.includes('setting')) {
          localStorage.removeItem(key)
        }
      })
    })
    await page.reload()

    // 红点应该显示
    const indicator = page.getByTestId('settings-indicator')
    await expect(indicator).toBeVisible()
  })

  test('已设置 DLC 后红点消失', async ({ page }) => {
    // 先设置 DLC
    await openDlcSettings(page)
    await saveButton(page).click()
    await expect(dlcModal(page)).not.toBeVisible()

    // 红点应该消失
    const indicator = page.getByTestId('settings-indicator')
    await expect(indicator).not.toBeVisible()
  })
})

test.describe('DLC Settings - i18n', () => {
  test('DLC 名称使用游戏 i18n 翻译', async ({ page }) => {
    await openDlcSettings(page)

    // DLC 标签应该显示翻译后的名称，而不是原始 ID
    const items = await getDlcListItems(page)
    const firstItem = items.nth(0)
    const label = firstItem.locator('.dlc-label')
    await expect(label).toBeVisible()

    // 标签文本不应为空
    const labelText = await label.textContent()
    expect(labelText?.trim()).not.toBe('')
  })

  test('需要版本显示', async ({ page }) => {
    await openDlcSettings(page)

    const items = await getDlcListItems(page)
    const firstItem = items.nth(0)
    const meta = firstItem.locator('.dlc-meta')
    await expect(meta).toBeVisible()

    // 应该包含版本号
    const metaText = await meta.textContent()
    expect(metaText).toContain('需要版本')
  })
})
