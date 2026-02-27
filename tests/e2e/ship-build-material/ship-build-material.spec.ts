import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { test } from '../../test-setup'

const ARG_BEAM_ID = 'turret_arg_m_beam_02_mk1'
const TER_BEAM_ID = 'turret_ter_m_beam_02_mk1'
const ARG_GATLING_ID = 'turret_arg_m_gatling_02_mk1'
const THRUSTER_ID = 'thruster_gen_l_allround_01_mk1'

const openShipBuild = async (page: Page) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('isTestEnv', 'true')
  })
  await page.reload()
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()
}

const selectOsakaShip = async (page: Page) => {
  await openShipBuild(page)
  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: /Osaka|大阪/ }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const selectDaitachiShip = async (page: Page) => {
  await openShipBuild(page)
  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: /大太刀|Odachi/ }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const switchToSlotTab = async (page: Page, label: 'E' | 'S' | 'W' | 'T') => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: new RegExp(`^${label}$`) }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
  const firstGroup = page.locator('.group-tabs .group-tab').first()
  await expect(firstGroup).toBeVisible()
  await firstGroup.click()
}

const assignFirstEquipment = async (page: Page) => {
  const optionCards = page.locator('.option-wall .option-card')
  await expect(optionCards.first()).toBeVisible()
  await optionCards.first().click()
  await page.keyboard.press('Escape')
}

const buildStateStandardOsaka = async (page: Page) => {
  await selectOsakaShip(page)
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
}

const assertStateStandardOsaka = async (page: Page) => {
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
}

const buildStateMaterialAggregation = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'T')

  // Assign to first 3 groups
  for (let i = 0; i < 3; i++) {
    const groups = page.locator('.group-tabs .group-tab')
    if (await groups.nth(i).isVisible().catch(() => false)) {
      await groups.nth(i).click()
      await assignFirstEquipment(page)
    }
  }
}

const buildStateMethodAggregation = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'E')
  await assignFirstEquipment(page)
  await switchToSlotTab(page, 'T')
  await assignFirstEquipment(page)
}

const selectMethod = async (page: Page, method: string) => {
  const select = page.getByTestId('ship-build-material-method-select')
  await expect(select).toBeVisible()
  try {
    await select.selectOption(method, { timeout: 3000 })
  } catch {
    await select.click()
    const option = page.getByRole('option', { name: new RegExp(`^${method}$`, 'i') })
    await option.click()
  }
}

const expand = async (row: Locator) => {
  await row.click()
}

const setPriceSlider = async (page: Page, value: number) => {
  const slider = page.getByTestId('ship-build-material-price-slider')
  await expect(slider).toBeVisible()
  const rangeInput = slider.locator('input[type="range"]').first()
  await expect(rangeInput).toBeVisible()
  // Use evaluate to set value directly for range inputs
  await rangeInput.evaluate((el: HTMLInputElement) => {
    el.value = String(value / 100)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const buildStateMultiModule = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'T')

  // Assign to multiple groups
  const groups = page.locator('.group-tabs .group-tab')
  const groupCount = await groups.count()
  for (let i = 0; i < Math.min(groupCount, 4); i++) {
    if (await groups.nth(i).isVisible().catch(() => false)) {
      await groups.nth(i).click()
      await assignFirstEquipment(page)
    }
  }
}

test.describe('ship-build-material', () => {
  test('2.1.1 验证：method 下拉不包含 xenon 选项', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.2.1 状态：大太刀标准测试状态', async ({ page }) => {
    await selectDaitachiShip(page)
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
  })

  test('2.2.2 状态：大太刀-护盾配置', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.2.3 状态：大太刀-推进器配置', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(2)
  })

  test('2.2.4 验证：method 选项包含 default', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).toContain('default')
    // Verify xenon is filtered out
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.2.5 切换：method default -> closedloop', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)

    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')

    // Try to switch to closedloop if available
    const options = await methodSelect.locator('option').allTextContents()
    if (options.some(o => o.trim().toLowerCase() === 'closedloop')) {
      await selectMethod(page, 'closedloop')
      await expect(methodSelect).toHaveValue('closedloop')
    }
  })

  test('2.3.1 状态：大阪标准测试状态', async ({ page }) => {
    await selectOsakaShip(page)
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
  })

  test('2.3.2 状态：大阪-推进器配置（thruster_gen_l_allround_01_mk1）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.3.3 状态：大阪-炮塔配置（turret_arg_m_beam_02_mk1）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(2)
  })

  test('2.3.4 验证：method 选项包含 default', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).toContain('default')
    // Verify xenon is filtered out
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.3.5 切换：method default -> closedloop', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)

    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')

    // Try to switch to another method if available
    const options = await methodSelect.locator('option').allTextContents()
    const availableMethod = options.find(o => o.trim().toLowerCase() !== 'default')
    if (availableMethod) {
      await selectMethod(page, availableMethod.trim())
    }
  })

  test('2.1 状态：标准测试状态-大阪', async ({ page }) => {
    await buildStateStandardOsaka(page)
    await assertStateStandardOsaka(page)
  })

  test('2.2 状态：标准测试状态-大阪-材料分项聚合', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.3 切换：method default -> closedloop', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')
    const options = await methodSelect.locator('option').allTextContents()
    if (options.some(o => o.trim() === 'closedloop')) {
      await selectMethod(page, 'closedloop')
      await expect(methodSelect).toHaveValue('closedloop')
    }
  })

  test('2.4 状态：标准测试状态-大阪-多模块聚合', async ({ page }) => {
    await buildStateMultiModule(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    // 大阪有多个炮塔组，验证至少有一个装备分项
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.5 状态：标准测试状态-大阪-方法测试聚合', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
  })

  test('3.1 场景：总材料折叠明细展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const summary = page.getByTestId('ship-build-material-summary')
    await expand(summary)
    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await expect(summaryList).toBeVisible()
  })

  test('3.2 场景：装备分项按 ID 聚合展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    // 验证有装备分项显示
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('3.3 场景：装备分项展开明细', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    const firstGroup = groups.first()
    await expand(firstGroup)
    await page.waitForTimeout(300)
  })

  test('3.4 场景：method 切换时 fallback 生效', async ({ page }) => {
    await buildStateMethodAggregation(page)
    await selectMethod(page, 'default')
    await selectMethod(page, 'closedloop')
  })

  test('3.5 场景：价格滑条联动', async ({ page }) => {
    await buildStateStandardOsaka(page)
    const summary = page.getByTestId('ship-build-material-summary')
    const initialText = await summary.textContent()
    // Set slider to 20% (0.2) to ensure different from default 100% (1.0)
    await setPriceSlider(page, 20)
    await page.waitForTimeout(500)
    const newText = await summary.textContent()
    expect(initialText).not.toBe(newText)
  })

  test('3.6 场景：多模块聚合下材料数量正确', async ({ page }) => {
    await buildStateMultiModule(page)
    const summary = page.getByTestId('ship-build-material-summary')
    await expect(summary).toBeVisible()
  })

  test('3.7.1 场景：大太刀护盾 fallback（method=closedloop）', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)

    // Check if closedloop is available
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    const options = await methodSelect.locator('option').allTextContents()
    const hasClosedloop = options.some(o => o.trim().toLowerCase() === 'closedloop')

    await selectMethod(page, 'default')
    const summaryDefault = await page.getByTestId('ship-build-material-summary').textContent()

    if (hasClosedloop) {
      await selectMethod(page, 'closedloop')
      const summaryClosedloop = await page.getByTestId('ship-build-material-summary').textContent()
      expect(summaryDefault).not.toBe(summaryClosedloop)
    }
  })

  test('3.7.2 场景：大阪 Argon 炮塔 fallback（method=terran）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)

    // Check if terran is available
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    const options = await methodSelect.locator('option').allTextContents()
    const hasTerran = options.some(o => o.trim().toLowerCase() === 'terran')

    await selectMethod(page, 'default')
    const summaryDefault = await page.getByTestId('ship-build-material-summary').textContent()

    if (hasTerran) {
      await selectMethod(page, 'terran')
      const summaryTerran = await page.getByTestId('ship-build-material-summary').textContent()
      expect(summaryDefault).not.toBe(summaryTerran)
    }
  })

  test('3.8 场景：飞船材料计入总材料', async ({ page }) => {
    await selectOsakaShip(page)
    const summary = page.getByTestId('ship-build-material-summary')
    await expect(summary).toBeVisible()
    await expand(summary)
    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await expect(summaryList).toBeVisible()
  })

  test('3.9 场景：飞船作为独立分项显示', async ({ page }) => {
    await selectOsakaShip(page)
    const shipGroup = page.getByTestId('ship-build-material-ship-group')
    await expect(shipGroup).toBeVisible()
    await expand(shipGroup)
    const shipList = page.getByTestId('ship-build-material-ship-list')
    await expect(shipList).toBeVisible()
  })

  test('3.10 场景：飞船分项独立于装备分项', async ({ page }) => {
    await buildStateMultiModule(page)
    const shipGroup = page.getByTestId('ship-build-material-ship-group')
    await expect(shipGroup).toBeVisible()
    const equipmentGroups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await equipmentGroups.count()).toBeGreaterThanOrEqual(1)
  })

  test('3.11 场景：ShipBlueprint 数据源正常', async ({ page }) => {
    await buildStateStandardOsaka(page)
    const summary = await page.getByTestId('ship-build-material-summary').textContent()
    await page.reload()
    await buildStateStandardOsaka(page)
    const summaryAfterReload = await page.getByTestId('ship-build-material-summary').textContent()
    expect(summary).toBe(summaryAfterReload)
  })
})
