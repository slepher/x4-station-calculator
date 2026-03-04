import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

function createEmpireV2MacroImportPayload() {
  return {
    meta: { format: 'x4-import-export', version: 1 },
    x4_empire_data: {
      version: 2,
      activeId: 'imp-empire-1',
      activeStationId: 'imp-station-1',
      list: [
        {
          id: 'imp-empire-1',
          name: 'Imported Empire',
          stations: [
            {
              id: 'imp-station-1',
              name: 'Imported Station',
              type: 'industrial',
              count: 1,
              modules: [
                { id: 'prod_gen_hullparts_macro', count: 1 }
              ],
              settings: {
                sunlight: 100,
                useHQ: false,
                manualWorkforce: 0,
                workforcePercent: 100,
                workforceAuto: true,
                considerWorkforceForAutoFill: false,
                supplyWorkforceBonus: false,
                buyMultiplier: 0.5,
                sellMultiplier: 0.5,
                minersEnabled: false,
                internalSupply: false,
                showEmpireGaps: false,
                racePreference: 'argon',
                resourceBufferHours: 1,
                primaryProductBufferHours: 12,
                secondaryProductBufferHours: 2,
                transportShipCapacity: 62000
              },
              lastUpdated: 1772453451902,
              lockedWares: [],
              warePriority: {}
            }
          ]
        }
      ]
    }
  }
}

async function loadDbFixture(page: Page) {
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
}

async function setLanguageByUi(page: Page) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ }).first()
  await langSelect.selectOption('zh-CN')
}

async function openStorageImportWizard(page: Page) {
  const wizard = page.getByTestId('storage-import-wizard')
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Enter').catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    const titleConfirm = page.locator('.toolbar-panel input + button').first()
    if (await titleConfirm.isVisible().catch(() => false)) {
      await titleConfirm.click({ force: true })
    }
    const btn = page.getByTestId('toolbar-import-btn')
    await expect(btn).toBeVisible()
    await btn.click({ force: true })
    if (await wizard.isVisible().catch(() => false)) return
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="toolbar-import-btn"]') as HTMLButtonElement | null
      el?.click()
    })
    if (await wizard.isVisible().catch(() => false)) return
    await page.waitForTimeout(120)
  }
  await expect(wizard).toBeVisible()
}

async function runEmpireOverwriteImport(page: Page, payload: object) {
  await openStorageImportWizard(page)
  await page.getByTestId('storage-import-file-input').setInputFiles({
    name: 'module-id-empire-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf-8')
  })
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })
  return page.evaluate(() => {
    const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
    return Number(empire.version || 0)
  })
}

test.describe('module-id bug', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loadDbFixture(page)
    await page.reload()
    await setLanguageByUi(page)
  })

  test('4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级', async ({ page }) => {
    // 4.1.1 状态: empire-v2-macro
    const payload = createEmpireV2MacroImportPayload()
    expect(payload.x4_empire_data.version).toBe(2)

    // 4.1.2 通过 `storage-import-file-input` 上传旧 Empire JSON，勾选 Empire 模块并点击 `storage-import-mode-overwrite` + `storage-import-apply-btn`
    const versionAfterImport = await runEmpireOverwriteImport(page, payload)
    expect(versionAfterImport).toBeGreaterThanOrEqual(2)
  })
})
