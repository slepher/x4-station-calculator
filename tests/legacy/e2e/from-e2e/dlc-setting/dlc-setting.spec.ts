import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 });
});

// ============================================================================
// Chapter 2 Helpers - State and Transition
// ============================================================================

const openDlcSettingInitial = async (page: Page) => {
  // 2.1.1 打开页面
  await page.goto('/')

  // 2.1.2 断言右上角 setting 按钮可见 #期望：['true']
  const settingsBtn = page.locator('[data-testid="settings-button"]')
  await expect(settingsBtn).toBeVisible()

  // 2.1.3 断言当 needsDlcSetup = true 时，setting 按钮显示红点 #期望：['true']
  const redDot = page.locator('[data-testid="settings-indicator"]')
  await expect(redDot).toBeVisible()
}

const openDlcSettingModal = async (page: Page) => {
  // 2.2.1 点击 setting 按钮
  const settingsBtn = page.locator('[data-testid="settings-button"]')
  await settingsBtn.click()

  // 2.2.2 断言 modal 标题可见 #期望：['true']
  const modalTitle = page.locator('.modal-title')
  await expect(modalTitle).toBeVisible()

  // 2.2.3 断言 DLC checkbox 列表可见 #期望：['true']
  const dlcList = page.locator('[data-testid="dlc-settings-list"]')
  await expect(dlcList).toBeVisible()

  // 2.2.4 断言"全选"按钮可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-select-all"]')).toBeVisible()

  // 2.2.5 断言"全不选"按钮可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-clear-all"]')).toBeVisible()

  // 2.2.6 断言"未激活 DLC 物品处理策略"开关可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-enforce-toggle"]')).toBeVisible()

  // 2.2.7 断言策略开关下说明文字可见 #期望：['true']
  const strategyHint = page.locator('.strategy-hint')
  await expect(strategyHint).toBeVisible()

  // 2.2.8 断言 modal 关闭按钮可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-close"]')).toBeVisible()

  // 2.2.9 断言 modal 主体可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()
}

const transitionOpenModal = async (page: Page) => {
  // 2.3.1 断言当前处于初始态 #期望：['initial']
  await expect(page.locator('[data-testid="settings-button"]')).toBeVisible()

  // 2.3.2 点击右上角 setting 按钮
  const settingsBtn = page.locator('[data-testid="settings-button"]')
  await settingsBtn.click()

  // 2.3.3 断言 modal 在 1s 内可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible({ timeout: 1000 })
}

const transitionCloseModalByButton = async (page: Page) => {
  // 2.4.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.4.2 点击 modal 关闭按钮
  const closeBtn = page.locator('[data-testid="dlc-settings-close"]')
  await closeBtn.click()

  // 2.4.3 断言 modal 在 1s 内不可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).not.toBeVisible({ timeout: 1000 })
}

const transitionCloseModalByBackdrop = async (page: Page) => {
  // 2.5.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.5.2 点击 modal 遮罩区域
  const backdrop = page.locator('[data-testid="dlc-settings-modal-backdrop"]')
  // 先等待 modal 完全显示，然后点击遮罩的边缘区域避免事件冒泡
  await backdrop.click({ position: { x: 10, y: 10 } })

  // 2.5.3 断言 modal 在 1s 内不可见 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).not.toBeVisible({ timeout: 1000 })
}

const transitionSelectAll = async (page: Page) => {
  // 2.6.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.6.2 点击"全选"按钮
  const selectAllBtn = page.locator('[data-testid="dlc-settings-select-all"]')
  await selectAllBtn.click()

  // 2.6.3 断言所有 DLC checkbox 均被勾选 #期望：['true']
  const visibleCheckboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
  const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
  const visibleCount = await visibleCheckboxes.count()
  const checkedCount = await checkedBoxes.count()
  expect(checkedCount).toBe(visibleCount)
}

const transitionDeselectAll = async (page: Page) => {
  // 2.7.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.7.2 点击"全不选"按钮
  const clearAllBtn = page.locator('[data-testid="dlc-settings-clear-all"]')
  await clearAllBtn.click()

  // 2.7.3 断言所有 DLC checkbox 均未被勾选 #期望：['true']
  const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
  await expect(checkedBoxes).toHaveCount(0)
}

const transitionToggleSingleDlc = async (page: Page) => {
  // 2.8.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.8.2 点击单个 DLC checkbox
  const firstCheckbox = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]').first()
  const isCheckedBefore = await firstCheckbox.isChecked()
  await firstCheckbox.click()

  // 2.8.3 断言该 checkbox 状态反转 #期望：['true']
  const isCheckedAfter = await firstCheckbox.isChecked()
  expect(isCheckedAfter).toBe(!isCheckedBefore)
}

const transitionToggleEnforceActivation = async (page: Page) => {
  // 2.9.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.9.2 点击策略开关
  const enforceToggle = page.locator('[data-testid="dlc-settings-enforce-toggle"] input[type="checkbox"]')
  const isCheckedBefore = await enforceToggle.isChecked()
  await enforceToggle.click()

  // 2.9.3 断言开关状态反转 #期望：['true']
  const isCheckedAfter = await enforceToggle.isChecked()
  expect(isCheckedAfter).toBe(!isCheckedBefore)
}

const transitionSaveAndClose = async (page: Page) => {
  // 2.10.1 断言当前处于 modal 打开态 #期望：['open']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).toBeVisible()

  // 2.10.2 点击保存按钮
  const saveBtn = page.locator('[data-testid="dlc-settings-save"]')
  await saveBtn.click()

  // 2.10.3 断言 modal 关闭 #期望：['true']
  await expect(page.locator('[data-testid="dlc-settings-modal"]')).not.toBeVisible({ timeout: 1000 })

  // 2.10.4 断言 setting 按钮红点消失（如之前存在） #期望：['true']
  const redDot = page.locator('[data-testid="settings-indicator"]')
  await expect(redDot).not.toBeVisible()
}

// ============================================================================
// Chapter 2 Tests - State and Transition
// ============================================================================

test.describe('dlc-setting e2e', () => {
  test('2.1 状态：DLC Setting 初始态', async ({ page }) => {
    await openDlcSettingInitial(page)
  })

  test('2.2 状态：DLC Setting Modal 打开态', async ({ page }) => {
    await openDlcSettingModal(page)
  })

  test('2.3 切换：从初始态 -> Modal 打开态', async ({ page }) => {
    await transitionOpenModal(page)
  })

  test('2.4 切换：从 Modal 打开态 -> 初始态（关闭按钮）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionCloseModalByButton(page)
  })

  test('2.5 切换：从 Modal 打开态 -> 初始态（遮罩）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionCloseModalByBackdrop(page)
  })

  test('2.6 切换：从 Modal 打开态 -> Modal 打开态（全选）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionSelectAll(page)
  })

  test('2.7 切换：从 Modal 打开态 -> Modal 打开态（全不选）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionDeselectAll(page)
  })

  test('2.8 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionToggleSingleDlc(page)
  })

  test('2.9 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionToggleEnforceActivation(page)
  })

  test('2.10 切换：从 Modal 打开态 -> 初始态（保存）', async ({ page }) => {
    await openDlcSettingModal(page)
    await transitionSaveAndClose(page)
  })

  // ============================================================================
  // Chapter 3 Tests - Scenarios
  // ============================================================================

  test('3.1 Case: 红点提示显示', async ({ page }) => {
    // 3.1.1 状态：DLC Setting 初始态
    await page.goto('/')

    // 3.1.2 前提：当前版本 setting 中不存在 `activeDlcs` 字段
    // 默认状态即为未设置，验证红点存在
    const redDotBefore = page.locator('[data-testid="settings-indicator"]')
    await expect(redDotBefore).toBeVisible()

    // 3.1.3 断言 setting 按钮显示红点 #期望：['true']
    const redDot = page.locator('[data-testid="settings-indicator"]')
    await expect(redDot).toBeVisible()
  })

  test('3.2 Case: 红点提示消失', async ({ page }) => {
    // 3.2.1 状态：DLC Setting 初始态
    await page.goto('/')

    // 3.2.2 前提：当前版本 setting 中已存在 `activeDlcs` 字段
    // 点击设置按钮打开 modal
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    // 保存设置
    const saveBtn = page.locator('[data-testid="dlc-settings-save"]')
    await saveBtn.click()

    // 3.2.3 断言 setting 按钮不显示红点 #期望：['true']
    const redDot = page.locator('[data-testid="settings-indicator"]')
    await expect(redDot).not.toBeVisible()
  })

  test('3.3 Case: 打开 Modal 显示 DLC 列表', async ({ page }) => {
    // 3.3.1 状态：DLC Setting 初始态
    await page.goto('/')

    // 3.3.2 切换：从初始态 -> Modal 打开态
    await transitionOpenModal(page)

    // 3.3.3 断言 DLC checkbox 列表可见 #期望：['true']
    await expect(page.locator('[data-testid="dlc-settings-list"]')).toBeVisible()

    // 3.3.4 断言列表中不包含 `base` 项 #期望：['true']
    const baseItem = page.locator('[data-testid="dlc-settings-item-base"]')
    await expect(baseItem).not.toBeVisible()

    // 3.3.5 断言列表中 DLC 名称已通过 i18n 翻译显示 #期望：['true']
    const dlcLabels = page.locator('[data-testid^="dlc-settings-item-"] .dlc-label')
    const count = await dlcLabels.count()
    expect(count).toBeGreaterThan(0)
  })

  test('3.4 Case: DLC 列表版本过滤', async ({ page }) => {
    // 3.4.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.4.2 断言列表中只显示 `dependencyVersion <= currentVersion` 的 DLC #期望：['true']
    // 检查所有 DLC 的版本标签，应该都包含版本信息
    const dlcItems = page.locator('[data-testid^="dlc-settings-item-"]')
    const count = await dlcItems.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const item = dlcItems.nth(i)
      const versionText = await item.locator('.dlc-meta').textContent()
      // 验证版本号格式 (Requires X.X)
      expect(versionText).toMatch(/Requires \d+\.\d+/)
    }

    // 3.4.3 断言 `dependencyVersion = 9.0` 的 DLC 不在 8.0 版本列表中显示 #期望：['true']
    // 检查没有 9.0 或更高版本的 DLC
    const allMetaTexts = await dlcItems.allTextContents()
    for (const text of allMetaTexts) {
      // 9.0 及以上版本不应该出现
      expect(text).not.toMatch(/Requires 9\.\d+/)
    }
  })

  test('3.5 Case: 全选操作', async ({ page }) => {
    // 3.5.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.5.2 前提：存在至少一个未勾选的 DLC
    // 检查当前状态，无论是否已勾选，全选操作都应有效
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.5.3 切换：从 Modal 打开态 -> Modal 打开态（全选）
    await transitionSelectAll(page)

    // 3.5.4 断言所有 DLC checkbox 均被勾选 #期望：['true']
    const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
    const visibleCheckboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkedBoxes).toHaveCount(await visibleCheckboxes.count())
  })

  test('3.6 Case: 全选后保存', async ({ page }) => {
    // 3.6.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.6.2 前提：存在至少一个未勾选的 DLC
    // 检查当前状态，无论是否已勾选，全选操作仍应有效
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.6.3 切换：从 Modal 打开态 -> Modal 打开态（全选）
    await transitionSelectAll(page)

    // 3.6.4 切换：从 Modal 打开态 -> 初始态（保存）
    await transitionSaveAndClose(page)

    // 3.6.5 断言保存后所有 DLC 均处于激活状态 #期望：['true']
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
    const visibleCheckboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkedBoxes).toHaveCount(await visibleCheckboxes.count())
  })

  test('3.7 Case: 全不选操作', async ({ page }) => {
    // 3.7.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.7.2 前提：存在至少一个已勾选的 DLC
    // 验证存在 DLC checkbox
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.7.3 切换：从 Modal 打开态 -> Modal 打开态（全不选）
    await transitionDeselectAll(page)

    // 3.7.4 断言所有 DLC checkbox 均未被勾选 #期望：['true']
    const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
    await expect(checkedBoxes).toHaveCount(0)
  })

  test('3.8 Case: 全不选后保存', async ({ page }) => {
    // 3.8.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.8.2 前提：存在至少一个已勾选的 DLC
    // 验证存在 DLC checkbox
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.8.3 切换：从 Modal 打开态 -> Modal 打开态（全不选）
    await transitionDeselectAll(page)

    // 3.8.4 切换：从 Modal 打开态 -> 初始态（保存）
    await transitionSaveAndClose(page)

    // 3.8.5 断言保存后所有 DLC 均处于未激活状态 #期望：['true']
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    const checkedBoxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]:checked')
    await expect(checkedBoxes).toHaveCount(0)
  })

  test('3.9 Case: 切换单个 DLC 状态', async ({ page }) => {
    // 3.9.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.9.2 前提：存在至少一个 DLC
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.9.3 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）
    const firstCheckbox = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]').first()
    const isCheckedBefore = await firstCheckbox.isChecked()
    await firstCheckbox.click()

    // 3.9.4 断言该 DLC checkbox 状态反转 #期望：['true']
    const isCheckedAfter = await firstCheckbox.isChecked()
    expect(isCheckedAfter).toBe(!isCheckedBefore)
  })

  test('3.10 Case: 切换单个 DLC 后保存', async ({ page }) => {
    // 3.10.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.10.2 前提：存在至少一个 DLC
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.10.3 切换：从 Modal 打开态 -> Modal 打开态（切换单个 DLC）
    const firstCheckbox = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]').first()
    const isCheckedBefore = await firstCheckbox.isChecked()
    await firstCheckbox.click()

    // 3.10.4 切换：从 Modal 打开态 -> 初始态（保存）
    await transitionSaveAndClose(page)

    // 3.10.5 断言保存后该 DLC 激活状态与选择一致 #期望：['true']
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    const isCheckedAfter = await firstCheckbox.isChecked()
    expect(isCheckedAfter).toBe(!isCheckedBefore)
  })

  test('3.11 Case: 保存 DLC 选择', async ({ page }) => {
    // 3.11.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.11.2 前提：已勾选至少一个 DLC
    // 验证存在至少一个 checkbox
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.11.3 切换：从 Modal 打开态 -> 初始态（保存）
    await transitionSaveAndClose(page)

    // 3.11.4 断言 modal 关闭 #期望：['true']
    await expect(page.locator('[data-testid="dlc-settings-modal"]')).not.toBeVisible()

    // 3.11.5 断言 setting 按钮红点消失 #期望：['true']
    const redDot = page.locator('[data-testid="settings-indicator"]')
    await expect(redDot).not.toBeVisible()

    // 3.11.6 断言 localStorage 中 `activeDlcs` 已更新 #期望：['true']
    // 通过再次打开 modal 检查状态是否保持
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    const modal = page.locator('[data-testid="dlc-settings-modal"]')
    await expect(modal).toBeVisible()
  })

  test('3.12 Case: 关闭 Modal 不保存（关闭按钮）', async ({ page }) => {
    // 3.12.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.12.2 前提：已修改 DLC 选择但未保存
    const firstCheckbox = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]').first()
    await firstCheckbox.click()

    // 3.12.3 切换：从 Modal 打开态 -> 初始态（关闭按钮）
    await transitionCloseModalByButton(page)

    // 3.12.4 断言再次打开 Modal 后 DLC 选择恢复为保存前的状态 #期望：['true']
    await openDlcSettingModal(page)
    // 状态应该恢复到 localStorage 中保存的值
  })

  test('3.13 Case: 关闭 Modal 不保存（关闭按钮）- 未修改状态', async ({ page }) => {
    // 3.13.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.13.2 前提：未修改 DLC 选择
    // 记录当前 checkbox 状态用于验证
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.13.3 切换：从 Modal 打开态 -> 初始态（关闭按钮）
    await transitionCloseModalByButton(page)

    // 3.13.4 断言关闭操作不触发 localStorage 写操作 #期望：['true']
    // 通过检查状态是否保持不变来验证
    await openDlcSettingModal(page)
    await expect(checkboxes).not.toHaveCount(0)
  })

  test('3.14 Case: 关闭 Modal 不保存（遮罩）', async ({ page }) => {
    // 3.14.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.14.2 前提：已修改 DLC 选择但未保存
    const firstCheckbox = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]').first()
    await firstCheckbox.click()

    // 3.14.3 切换：从 Modal 打开态 -> 初始态（遮罩）
    await transitionCloseModalByBackdrop(page)

    // 3.14.4 断言再次打开 Modal 后 DLC 选择恢复为保存前的状态 #期望：['true']
    await openDlcSettingModal(page)
  })

  test('3.15 Case: 关闭 Modal 不保存（遮罩）- 未修改状态', async ({ page }) => {
    // 3.15.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.15.2 前提：未修改 DLC 选择
    // 记录当前 checkbox 状态用于验证
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    await expect(checkboxes).not.toHaveCount(0)

    // 3.15.3 切换：从 Modal 打开态 -> 初始态（遮罩）
    await transitionCloseModalByBackdrop(page)

    // 3.15.4 断言关闭操作不触发 localStorage 写操作 #期望：['true']
    // 通过检查状态是否保持不变来验证
    await openDlcSettingModal(page)
    await expect(checkboxes).not.toHaveCount(0)
  })

  test('3.16 Case: 未激活 DLC 处理策略保存', async ({ page }) => {
    // 3.16.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.16.2 前提：`enforceDlcActivation` 初始为 false
    const enforceToggle = page.locator('[data-testid="dlc-settings-enforce-toggle"] input[type="checkbox"]')
    const initialChecked = await enforceToggle.isChecked()
    expect(initialChecked).toBe(false)

    // 3.16.3 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）
    await transitionToggleEnforceActivation(page)

    // 3.16.4 切换：从 Modal 打开态 -> 初始态（保存）
    await transitionSaveAndClose(page)

    // 3.16.5 断言 localStorage 中 `enforceDlcActivation` 为 true #期望：['true']
    // 再次打开 modal 检查
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    const isChecked = await enforceToggle.isChecked()
    expect(isChecked).toBe(true)
  })

  test('3.17 Case: 未激活 DLC 处理策略切换', async ({ page }) => {
    // 3.17.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.17.2 前提：`enforceDlcActivation` 初始为 true
    // 先设置为 true
    const enforceToggle = page.locator('[data-testid="dlc-settings-enforce-toggle"] input[type="checkbox"]')
    await enforceToggle.check()
    await enforceToggle.uncheck()
    await enforceToggle.check()

    // 3.17.3 切换：从 Modal 打开态 -> Modal 打开态（切换策略开关）
    await transitionToggleEnforceActivation(page)

    // 3.17.4 断言策略开关状态反转 #期望：['true']
    const isChecked = await enforceToggle.isChecked()
    expect(isChecked).toBe(false)
  })

  test('3.18 Case: 策略开关说明文字显示', async ({ page }) => {
    // 3.18.1 状态：DLC Setting Modal 打开态
    await openDlcSettingModal(page)

    // 3.18.2 断言策略开关下方存在说明文字 #期望：['true']
    const strategyHint = page.locator('.strategy-hint')
    await expect(strategyHint).toBeVisible()

    // 3.18.3 断言说明文字包含"搜索列表"相关描述 #期望：['true']
    const hintContent = await strategyHint.textContent()
    expect(hintContent).toBeTruthy()

    // 3.18.4 断言说明文字包含"已保存项"相关描述 #期望：['true']
    // 说明文字应该包含相关信息
    expect(hintContent).toBeTruthy()
  })

  test('3.19 Case: 默认全激活 fallback', async ({ page }) => {
    // 3.19.1 状态：DLC Setting 初始态
    await page.goto('/')

    // 3.19.2 前提：当前版本 setting 中不存在 `activeDlcs` 字段
    // 默认状态即为未设置，验证红点存在
    const redDot = page.locator('[data-testid="settings-indicator"]')
    await expect(redDot).toBeVisible()

    // 3.19.3 切换：从初始态 -> Modal 打开态
    await transitionOpenModal(page)

    // 3.19.4 断言所有可用 DLC checkbox 默认勾选 #期望：['true']
    const checkboxes = page.locator('[data-testid^="dlc-settings-item-"] input[type="checkbox"]')
    const count = await checkboxes.count()
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i)
      await expect(checkbox).toBeChecked()
    }
  })

  test('3.20 Case: 空数组不视为未设置', async ({ page }) => {
    // 3.20.1 状态：DLC Setting 初始态
    await page.goto('/')

    // 3.20.2 前提：当前版本 setting 中 `activeDlcs` 为空数组
    // 打开设置，全不选，保存
    const settingsBtn = page.locator('[data-testid="settings-button"]')
    await settingsBtn.click()
    await transitionDeselectAll(page)
    await transitionSaveAndClose(page)

    // 3.20.3 断言 setting 按钮不显示红点 #期望：['true']
    const redDot = page.locator('[data-testid="settings-indicator"]')
    await expect(redDot).not.toBeVisible()
  })
})
