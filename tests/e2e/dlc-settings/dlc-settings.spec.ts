import { test, expect, type Page } from '@playwright/test'

const dlcIds = ['ego_dlc_split', 'ego_dlc_terran', 'ego_dlc_pirate', 'ego_dlc_boron', 'ego_dlc_timelines', 'ego_dlc_mini_01', 'ego_dlc_mini_02']
const checkboxes = (page: Page) => page.locator('[data-testid^="dlc-settings-item-"] input')
const terran = (page: Page) => page.getByTestId('dlc-settings-item-ego_dlc_terran').getByRole('checkbox')
const policy = (page: Page) => page.getByTestId('dlc-settings-enforce-toggle').getByRole('checkbox')
const setting = (page: Page) => page.evaluate(() => localStorage.getItem('x4-setting_v9'))

async function openDlcSettings(page: Page) {
  await page.getByTestId('settings-button').click()
  await expect(page.getByTestId('dlc-settings-modal')).toBeVisible()
}

async function saveSettings(page: Page) {
  await page.getByTestId('dlc-settings-save').click()
  await expect(page.getByTestId('dlc-settings-modal')).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  delete data['x4-setting_v9']
  await page.evaluate((db) => {
    Object.entries(db).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.removeItem('x4-setting_v9')
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
})

test.describe('DLC Settings Modal - 基础交互', () => {
  test('打开 DLC 设置 modal', async ({ page }) => {
    await openDlcSettings(page)
    await expect(page.getByTestId('dlc-settings-modal').getByRole('heading')).toHaveText('DLC 设定')
  })

  for (const [label, button] of [['关闭按钮', 'dlc-settings-close'], ['取消按钮', 'dlc-settings-cancel']] as const) {
    test(`关闭 DLC 设置 modal - 点击${label}`, async ({ page }) => {
      await openDlcSettings(page)
      await terran(page).uncheck()
      await page.getByTestId(button).click()
      await expect(page.getByTestId('dlc-settings-modal')).toBeHidden()
      expect(await setting(page)).toBeNull()
      await openDlcSettings(page)
      await expect(terran(page)).toBeChecked()
    })
  }

  test('关闭 DLC 设置 modal - 点击遮罩', async ({ page }) => {
    await openDlcSettings(page)
    await terran(page).uncheck()
    await page.getByTestId('dlc-settings-modal-backdrop').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('dlc-settings-modal')).toBeHidden()
    expect(await setting(page)).toBeNull()
    await openDlcSettings(page)
    await expect(terran(page)).toBeChecked()
  })

  test('DLC 列表显示', async ({ page }) => {
    await openDlcSettings(page)
    await expect(page.locator('[data-testid^="dlc-settings-item-"]')).toHaveCount(7)
    for (const id of dlcIds) await expect(page.getByTestId(`dlc-settings-item-${id}`)).toBeVisible()
    await expect(page.getByTestId('dlc-settings-item-base')).toHaveCount(0)
  })

  test('全选/全不选功能', async ({ page }) => {
    await openDlcSettings(page)
    await expect(checkboxes(page)).toHaveCount(7)
    await page.getByTestId('dlc-settings-clear-all').click()
    await expect(page.locator('[data-testid^="dlc-settings-item-"] input:checked')).toHaveCount(0)
    await page.getByTestId('dlc-settings-select-all').click()
    await expect(page.locator('[data-testid^="dlc-settings-item-"] input:checked')).toHaveCount(7)
  })

  test('单个 DLC 勾选/取消', async ({ page }) => {
    await openDlcSettings(page)
    await expect(terran(page)).toBeChecked()
    await terran(page).uncheck()
    await expect(terran(page)).not.toBeChecked()
    await terran(page).check()
    await expect(terran(page)).toBeChecked()
  })

  test('限制策略开关', async ({ page }) => {
    await openDlcSettings(page)
    await expect(policy(page)).not.toBeChecked()
    await policy(page).check()
    await expect(policy(page)).toBeChecked()
    await policy(page).uncheck()
    await expect(policy(page)).not.toBeChecked()
  })

  test('保存设置', async ({ page }) => {
    const oldVersionSetting = await page.evaluate(() => localStorage.getItem('x4-setting'))
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-clear-all').click()
    await terran(page).check()
    await policy(page).check()
    await saveSettings(page)
    expect(JSON.parse((await setting(page))!)).toEqual({ activeDlcs: ['ego_dlc_terran'], enforceDlcActivation: true })
    expect(await page.evaluate(() => localStorage.getItem('x4-setting'))).toBe(oldVersionSetting)
    await page.reload()
    await openDlcSettings(page)
    await expect(terran(page)).toBeChecked()
    await expect(page.locator('[data-testid^="dlc-settings-item-"] input:checked')).toHaveCount(1)
    await expect(policy(page)).toBeChecked()
  })

  test('取消保存 - 设置不持久化', async ({ page }) => {
    await openDlcSettings(page)
    await saveSettings(page)
    const before = await setting(page)
    await openDlcSettings(page)
    await terran(page).uncheck()
    await policy(page).check()
    await page.getByTestId('dlc-settings-cancel').click()
    expect(await setting(page)).toBe(before)
    await page.reload()
    await openDlcSettings(page)
    await expect(terran(page)).toBeChecked()
    await expect(policy(page)).not.toBeChecked()
  })
})

test.describe('DLC Settings - 红点提示', () => {
  test('未设置 DLC 时显示红点', async ({ page }) => {
    expect(await setting(page)).toBeNull()
    await expect(page.getByTestId('settings-indicator')).toBeVisible()
  })

  test('已设置 DLC 后红点消失', async ({ page }) => {
    await openDlcSettings(page)
    await page.getByTestId('dlc-settings-clear-all').click()
    await saveSettings(page)
    await page.reload()
    await expect(page.getByTestId('settings-indicator')).toBeHidden()
    expect(JSON.parse((await setting(page))!)).toEqual({ activeDlcs: [], enforceDlcActivation: false })
  })
})

test.describe('DLC Settings - i18n', () => {
  test('DLC 名称使用游戏 i18n 翻译', async ({ page }) => {
    await openDlcSettings(page)
    await expect(page.getByTestId('dlc-settings-item-ego_dlc_terran').locator('.dlc-label')).toHaveText('人类的摇篮')
  })

  test('需要版本显示', async ({ page }) => {
    await openDlcSettings(page)
    await expect(page.getByTestId('dlc-settings-item-ego_dlc_terran').locator('.dlc-meta')).toHaveText('需要版本 6.0')
    await expect(page.getByTestId('dlc-settings-item-ego_dlc_mini_02').locator('.dlc-meta')).toHaveText('需要版本 8.0')
  })
})
