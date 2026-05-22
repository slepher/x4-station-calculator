import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const loadModalTitleRe = /Load Ship Blueprint|载入飞船配装|载入蓝图|加载飞船配装/i

const gotoShipBuild = async (page: any) => {
  await page.getByTestId('top-view-btn-ship-build').click()
  const filters = page.getByTestId('ship-build-selector-grid')
  if (await filters.isVisible().catch(() => false)) return
  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

const ensureSelectorOpen = async (page: any) => {
  if (await page.getByTestId('ship-build-selector-grid').isVisible().catch(() => false)) {
    return
  }
  const switchBtn = page.getByTestId('ship-build-change-ship-fit-header')
  if (await switchBtn.isVisible().catch(() => false)) {
    await switchBtn.click()
  }
  await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
}

const selectOsakaAndEnterWorkspace = async (page: any) => {
  await gotoShipBuild(page)

  await page.evaluate(() => {
    const store = (window as any).shipBuildStore
    store.setSelectedShipId('ship_ter_l_destroyer_01_a')
  })

  await expect(page.getByTestId('ship-build-panels')).toBeVisible()
}

const loadBuiltInPreset = async (page: any, presetName: '低配' | '中配' | '高配') => {
  const toolbar = page.locator('.toolbar-panel')
  const loadBtn = toolbar.getByRole('button', { name: /Load|载入|加载/i })
  await expect(loadBtn).toBeEnabled()
  await loadBtn.click()

  await expect(page.getByText(loadModalTitleRe)).toBeVisible()
  const item = page
    .locator('.blueprint-item')
    .filter({ hasText: presetName })
    .filter({ hasNot: page.locator('.blueprint-delete-btn') })
    .first()
  await expect(item).toBeVisible()

  // 载入前先校验预设卡片摘要里包含“引擎”信息（不接受“推进器”替代）
  const summaryText = await item.locator('.text-sm.text-slate-400').first().innerText()
  expect(summaryText).toMatch(/引擎|Engine/i)

  await item.getByRole('button', { name: /Load|载入|加载/i }).click()

  await expect(page.getByText(loadModalTitleRe)).toBeHidden()
}

const hasVisibleNonEmptySlotInCurrentType = async (page: any) => {
  const panel = page.getByTestId('ship-build-panel-fit')
  const rows = panel.locator('[data-testid^="slot-"]:not([data-testid^="slot-type-"])')
  await expect(rows.first()).toBeVisible()
  const titles = (await rows.locator('.slot-row-title').allTextContents()).map((t: string) => t.trim())
  const values = (await rows.locator('.slot-row-value').allTextContents()).map((t: string) => t.trim())
  return titles.map((title: string, idx: number) => ({ title, value: values[idx] || '' }))
}

const isNotEmptySlotText = (text: string) => text.length > 0 && text !== '空槽位' && text !== 'Empty Slot'

const assertSlotTypeLoadedInUI = async (page: any, slotType: 'engine' | 'turret') => {
  const panel = page.getByTestId('ship-build-panel-fit')
  await panel.getByTestId(`slot-type-${slotType}`).click()
  const items = await hasVisibleNonEmptySlotInCurrentType(page)

  const mainItems = items.filter((item: any) => !/护盾|shield/i.test(item.title))
  return mainItems.length > 0 && mainItems.every((item: any) => isNotEmptySlotText(item.value))
}

const assertEngineAndTurretLoadedInUI = async (page: any) => {
  const panel = page.getByTestId('ship-build-panel-fit')
  await expect(panel).toBeVisible()

  const engineLoaded = await assertSlotTypeLoadedInUI(page, 'engine')
  const turretLoaded = await assertSlotTypeLoadedInUI(page, 'turret')

  return { engineLoaded, turretLoaded }
}

const applyFixture = async (page: any, fixturePath: '../../fixtures/db.json' | '../../fixtures/x4-export.json') => {
  await page.goto('/')

  const dbFixture = await import(fixturePath, { with: { type: 'json' } })
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
}

const presetNames: Array<'低配' | '中配' | '高配'> = ['低配', '中配', '高配']

test.describe('默认 fixture(db.json) 对比', () => {
  test.beforeEach(async ({ page }) => {
    await applyFixture(page, '../../fixtures/db.json')
  })

  for (const presetName of presetNames) {
    test(`Osaka 默认预设载入(${presetName}): 配置列表与页面均包含引擎和炮塔 [db.json]`, async ({ page }) => {
      await selectOsakaAndEnterWorkspace(page)
      await loadBuiltInPreset(page, presetName)

      const state = await assertEngineAndTurretLoadedInUI(page)
      expect(state.engineLoaded).toBe(true)
      expect(state.turretLoaded).toBe(true)
    })
  }
})

test.describe('用户提供 fixture(x4-export.json) 对比', () => {
  test.beforeEach(async ({ page }) => {
    await applyFixture(page, '../../fixtures/x4-export.json')
  })

  for (const presetName of presetNames) {
    test(`Osaka 默认预设载入(${presetName}): 配置列表与页面均包含引擎和炮塔 [x4-export.json]`, async ({ page }) => {
      await selectOsakaAndEnterWorkspace(page)
      await loadBuiltInPreset(page, presetName)

      const state = await assertEngineAndTurretLoadedInUI(page)
      expect(state.engineLoaded).toBe(true)
      expect(state.turretLoaded).toBe(true)
    })
  }
})
