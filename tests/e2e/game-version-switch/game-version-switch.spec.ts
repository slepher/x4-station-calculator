import { test, expect, Page } from '@playwright/test'

async function buildVersionModalOpen(page: Page) {
  await page.locator('[data-testid="toolbar-version-btn"]').click()
  await page.locator('[data-testid="version-settings-modal-backdrop"]').waitFor({ state: 'visible' })
  await page.locator('[data-testid="version-select"]').waitFor({ state: 'visible' })
  await expect(page.locator('[data-testid="version-settings-modal"]')).toContainText(/游戏版本|Game Version/)
}

async function transitionSelectTargetVersion(page: Page) {
  await page.locator('[data-testid="version-select"]').selectOption('9.0::beta')
  await expect(page.locator('[data-testid="version-select"]')).toHaveValue('9.0::beta')
}

async function transitionConfirmSwitchReload(page: Page) {
  await page.locator('[data-testid="version-switch"]').click()
  await page.waitForEvent('load')
}

test.describe('2 E2E 标准状态与状态迁移', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
  })

  test('2.1 状态: 版本弹窗已打开', async ({ page }) => {
    await buildVersionModalOpen(page)
  })

  test('2.2 切换: 打开版本弹窗 -> 选择目标版本', async ({ page }) => {
    await buildVersionModalOpen(page)
    await transitionSelectTargetVersion(page)
  })
})

test.describe('3 E2E 测试场景', () => {
  test('3.1 Case: 首次访问显示红点', async ({ page }) => {
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

    await expect(page.locator('[data-testid="toolbar-version-indicator"]')).toBeVisible()

    await buildVersionModalOpen(page)

    await page.locator('[data-testid="version-switch"]').click()

    await expect(page.locator('[data-testid="toolbar-version-indicator"]')).toBeHidden()
  })

  test('3.2 Case: 切换版本后数据隔离', async ({ page }) => {
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')

    await buildVersionModalOpen(page)
    await transitionSelectTargetVersion(page)
    await transitionConfirmSwitchReload(page)

    const storedVersion = await page.evaluate(() => {
      const raw = localStorage.getItem('x4_game_version')
      return raw ? JSON.parse(raw) : null
    })
    expect(storedVersion).toEqual({ version: '9.0', beta: true })

    const oldEmpireDataExists = await page.evaluate(() => {
      return localStorage.getItem('x4_empire_data') !== null
    })
    expect(oldEmpireDataExists).toBe(true)
  })

  test('3.5 Case: 同版本确认写入', async ({ page }) => {
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

    await buildVersionModalOpen(page)

    await expect(page.locator('[data-testid="version-switch"]')).toContainText(/保存|Save/)

    const urlBefore = page.url()
    await page.locator('[data-testid="version-switch"]').click()

    const storedVersion = await page.evaluate(() => localStorage.getItem('x4_game_version'))
    expect(storedVersion).toContain('"version":"8.0"')
    expect(storedVersion).toContain('"beta":false')

    expect(page.url()).toBe(urlBefore)
  })

  test('3.6 Case: 同版本已写库按钮禁用', async ({ page }) => {
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('x4_game_version', JSON.stringify({ version: '8.0', beta: false }))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')

    await buildVersionModalOpen(page)

    await expect(page.locator('[data-testid="version-switch"]')).toBeDisabled()
  })
})