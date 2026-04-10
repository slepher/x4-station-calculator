import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const stationSettings = {
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
  transportMinutes: 10,
  transportShipCapacity: 62000
}

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
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
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')

  await page.evaluate((settings) => {
    const binding = {
      gameGuid: 'e2e-game',
      selectedArchiveTime: 100,
      groups: [{
        id: 'group-a',
        name: 'Group A',
        order: 0,
        sectorMacro: 'sector_macro_a',
        jumpRange: 0,
        coverageSectorMacros: [],
        connectedGroupIds: []
      }],
      stationPlans: [{
        id: 'plan-alpha',
        groupId: 'group-a',
        name: 'Alpha Binding',
        type: 'industrial',
        modules: [],
        settings
      }],
      updatedAt: 1
    }
    ;(window as any).shipBuildStore.activeView = 'production'
    ;(window as any).saveBindingStore.loadData({
      version: 1,
      activeGameGuid: 'e2e-game',
      list: [binding]
    })
    ;(window as any).saveBindingStore.createOrOpenBinding('e2e-game', 100)
    ;(window as any).empireStore.switchToBinding('e2e-game')
    ;(window as any).empireStore.selectStation('__save_binding__e2e-game__plan-alpha')
  }, stationSettings)

  await expect(page.locator('.station-tab').filter({ hasText: 'Alpha Binding' })).toBeVisible()
})

test('editing a binding station marks dirty and save binding persists the draft', async ({ page }) => {
  const raceSelect = page.locator('.context-toolbar .race-select').last()
  await raceSelect.selectOption('terran')

  await expect(page.locator('.binding-status')).toContainText(/绑定有未保存改动|Unsaved binding changes/)
  await page.locator('.binding-save-button').click()
  await expect(page.locator('.binding-status')).toContainText(/绑定已保存|Binding saved/)

  const persistedRace = await page.evaluate(() => {
    const raw = localStorage.getItem('x4_save_bindings')
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.list?.[0]?.stationPlans?.[0]?.settings?.racePreference
  })
  expect(persistedRace).toBe('terran')
})

test('switching empire keeps binding draft and returning restores it', async ({ page }) => {
  const raceSelect = page.locator('.context-toolbar .race-select').last()
  await raceSelect.selectOption('terran')

  await page.locator('.overview-tab').click()
  await page.locator('.source-tab').filter({ hasText: /帝国|Empire/ }).click()
  await expect(page.locator('.source-tab').filter({ hasText: /帝国|Empire/ })).toHaveClass(/active/)

  const bindingSourceTab = page.locator('.source-tab').filter({ hasText: /存档绑定|Save Binding/ })
  await expect(bindingSourceTab).not.toBeDisabled()
  await bindingSourceTab.click()

  await expect(bindingSourceTab).toHaveClass(/active/)
  const draftRace = await page.evaluate(() => {
    return (window as any).saveBindingStore.activeBinding.stationPlans[0].settings.racePreference
  })
  expect(draftRace).toBe('terran')
})

test('creating a station in binding mode creates a virtual station in the active group', async ({ page }) => {
  const beforeCount = await page.locator('.station-tab').count()
  await page.locator('.add-btn').click()

  await expect(page.locator('.station-tab')).toHaveCount(beforeCount + 1)
  await expect(page.locator('.binding-status')).toContainText(/绑定有未保存改动|Unsaved binding changes/)

  const created = await page.evaluate(() => {
    const binding = (window as any).saveBindingStore.activeBinding
    return binding.stationPlans.find((plan: any) => !plan.saveStationCode && plan.name)
  })
  expect(created.groupId).toBe('group-a')
  expect(created.saveStationCode).toBeUndefined()
})
