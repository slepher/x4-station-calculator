import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { test } from '../../test-setup'

const ARG_BEAM_ID = 'turret_arg_m_beam_02_mk1'
const TER_BEAM_ID = 'turret_ter_m_beam_02_mk1'
const ARG_GATLING_ID = 'turret_arg_m_gatling_02_mk1'
const GROUP_BACK_DOWN_MID = 'group_back_down_mid'
const GROUP_BACK_MID_UP = 'group_back_mid_up'
const GROUP_DOWN_MID_LEFT = 'group_down_mid_left'
const GROUP_DOWN_MID_RIGHT = 'group_down_mid_right'

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

const enterOsakaBaseState = async (page: Page) => {
  await openShipBuild(page)

  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }

  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()

  const osaka = page.locator('.list-item').filter({ hasText: /Osaka|大阪/ }).first()
  await expect(osaka).toBeVisible()
  await osaka.click()
}

const switchToTurretSlot = async (page: Page) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^T$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const assignTurretEquipmentByGroup = async (page: Page, groupName: string, equipmentId: string) => {
  const connectionKey = await page.evaluate(({ groupNameArg, equipmentIdArg }) => {
    const store = (window as any).shipBuildStore
    if (!store) {
      throw new Error('shipBuildStore is unavailable in test env')
    }

    const rows = Array.isArray(store.connectionRows) ? store.connectionRows : []
    const row = rows.find((item: any) => item.slotType === 'turret' && item.groupName === groupNameArg)
    if (!row) {
      throw new Error(`Cannot find turret group row for ${groupNameArg}`)
    }

    const hasTargetOption = Array.isArray(row.options)
      && row.options.some((opt: any) => opt?.id === equipmentIdArg)
    if (!hasTargetOption) {
      throw new Error(`Equipment ${equipmentIdArg} not found in group ${groupNameArg}`)
    }

    store.applyConnectionAssignment({
      connectionKey: row.connectionKey,
      equipmentId: equipmentIdArg
    })
    return row.connectionKey as string
  }, { groupNameArg: groupName, equipmentIdArg: equipmentId })

  await expect.poll(async () => {
    return page.evaluate((connectionKeyArg) => {
      const store = (window as any).shipBuildStore
      return store?.selectedByConnection?.[connectionKeyArg] || null
    }, connectionKey)
  }).toBe(equipmentId)
}

const buildStateStandardOsaka = async (page: Page) => {
  await enterOsakaBaseState(page)
}

const assertStateStandardOsaka = async (page: Page) => {
  await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
}

const buildStateMaterialAggregation = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToTurretSlot(page)

  await assignTurretEquipmentByGroup(page, GROUP_BACK_DOWN_MID, ARG_BEAM_ID)
  await assignTurretEquipmentByGroup(page, GROUP_BACK_MID_UP, TER_BEAM_ID)
  await assignTurretEquipmentByGroup(page, GROUP_DOWN_MID_LEFT, ARG_BEAM_ID)
}

const assertStateMaterialAggregation = async (page: Page) => {
  await expect(page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)).toContainText(/x\s*3/i)
  await expect(page.getByTestId(`ship-build-material-equipment-group-${TER_BEAM_ID}`)).toContainText(/x\s*1/i)
}

const buildStateMultiModuleAggregation = async (page: Page) => {
  await buildStateMaterialAggregation(page)
  await assignTurretEquipmentByGroup(page, GROUP_DOWN_MID_RIGHT, ARG_GATLING_ID)
}

const assertStateMultiModuleAggregation = async (page: Page) => {
  await assertStateMaterialAggregation(page)
  await expect(page.getByTestId(`ship-build-material-equipment-group-${ARG_GATLING_ID}`)).toContainText(/x\s*2/i)
}

const selectMethod = async (page: Page, method: string) => {
  const select = page.getByTestId('ship-build-material-method-select')
  await expect(select).toBeVisible()
  const tagName = await select.evaluate((node) => node.tagName)
  if (tagName === 'SELECT') {
    await select.selectOption(method)
    return
  }
  await select.click()
  await page.getByRole('option', { name: new RegExp(`^${method}$`, 'i') }).click()
}

const expand = async (row: Locator) => {
  await row.click()
}

const WARE_DISPLAY_NAMES: Record<string, string[]> = {
  energycells: ['Energy Cells', '能量电池'],
  computronicsubstrate: ['Computronic Substrate', '电子基质'],
  metallicmicrolattice: ['Metallic Microlattice', '金属微晶'],
  advancedelectronics: ['Advanced Electronics', '先进电子设备'],
  turretcomponents: ['Turret Components', '炮塔部件'],
  siliconcarbide: ['Silicon Carbide', '碳化硅'],
  claytronics: ['Claytronics', '电子黏土'],
  hullparts: ['Hull Parts', '船体部件']
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getWareDisplayNames = (wareId: string): string[] => {
  const names = WARE_DISPLAY_NAMES[wareId]
  if (!names || names.length === 0) {
    throw new Error(`Missing display-name mapping for ware: ${wareId}`)
  }
  return names
}

const wareNameRegex = (wareId: string) => {
  const names = getWareDisplayNames(wareId)
  return new RegExp(names.map(escapeRegExp).join('|'), 'i')
}

const materialRowByWare = (container: Locator, wareId: string) => {
  return container.locator('.list-item').filter({
    hasText: wareNameRegex(wareId)
  })
}

const assertMaterialCount = async (container: Locator, wareId: string, expected: number) => {
  const rows = materialRowByWare(container, wareId)
  await expect(rows).toHaveCount(1)
  const row = rows.first()
  const normalized = new Intl.NumberFormat('en-US').format(Math.round(expected))
  const names = getWareDisplayNames(wareId)
  const countAndName = new RegExp(
    `${escapeRegExp(normalized)}\\s*x\\s*(?:${names.map(escapeRegExp).join('|')})`,
    'i'
  )
  await expect(row).toContainText(countAndName)
}

const assertMaterialMissing = async (container: Locator, wareId: string) => {
  await expect(materialRowByWare(container, wareId)).toHaveCount(0)
}

const setPriceSlider = async (page: Page, value: number) => {
  const slider = page.getByTestId('ship-build-material-price-slider')
  await expect(slider).toBeVisible()
  const rangeInput = slider.locator('input[type="range"]').first()
  await expect(rangeInput).toBeVisible()
  await rangeInput.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement
    input.value = String(nextValue)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await expect(rangeInput).toHaveValue(String(value))
}

test.describe('ship-build-material', () => {
  test('2.1 状态：标准测试状态-大阪', async ({ page }) => {
    await buildStateStandardOsaka(page)
    await assertStateStandardOsaka(page)
  })

  test('2.2 状态：标准测试状态-大阪-材料分项聚合', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    await assertStateMaterialAggregation(page)
  })

  test('2.3 切换：method default -> closedloop -> terran', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    await selectMethod(page, 'default')
    await selectMethod(page, 'closedloop')

    await selectMethod(page, 'terran')
    await expect(page.getByTestId('ship-build-material-method-select')).toHaveValue('terran')
  })

  test('2.4 状态：标准测试状态-大阪-多模块聚合', async ({ page }) => {
    await buildStateMultiModuleAggregation(page)
    await assertStateMultiModuleAggregation(page)
  })

  test('3.1 场景：总材料折叠明细展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    const summary = page.getByTestId('ship-build-material-summary')
    await expand(summary)

    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await assertMaterialCount(summaryList, 'energycells', 1164)
    await assertMaterialCount(summaryList, 'computronicsubstrate', 286)
    await assertMaterialCount(summaryList, 'metallicmicrolattice', 507)
    await assertMaterialCount(summaryList, 'advancedelectronics', 18)
    await assertMaterialCount(summaryList, 'turretcomponents', 30)
    await assertMaterialCount(summaryList, 'siliconcarbide', 4)
  })

  test('3.2 场景：装备分项按 ID 聚合展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    await expect(groups).toHaveCount(2)
    await expect(page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)).toContainText(/x\s*3/i)
    await expect(page.getByTestId(`ship-build-material-equipment-group-${TER_BEAM_ID}`)).toContainText(/x\s*1/i)
  })

  test('3.3 场景：装备分项展开明细', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    const argGroup = page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)
    await expand(argGroup)
    const argList = page.getByTestId(`ship-build-material-equipment-list-${ARG_BEAM_ID}`)
    await assertMaterialCount(argList, 'advancedelectronics', 18)
    await assertMaterialCount(argList, 'energycells', 30)
    await assertMaterialCount(argList, 'turretcomponents', 30)

    const terGroup = page.getByTestId(`ship-build-material-equipment-group-${TER_BEAM_ID}`)
    await expand(terGroup)
    const terList = page.getByTestId(`ship-build-material-equipment-list-${TER_BEAM_ID}`)
    await assertMaterialCount(terList, 'computronicsubstrate', 5)
    await assertMaterialCount(terList, 'energycells', 100)
    await assertMaterialCount(terList, 'metallicmicrolattice', 36)
    await assertMaterialCount(terList, 'siliconcarbide', 4)
  })

  test('3.4 场景：method fallback 生效', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    await selectMethod(page, 'closedloop')

    const terGroupClosedloop = page.getByTestId(`ship-build-material-equipment-group-${TER_BEAM_ID}`)
    await expand(terGroupClosedloop)
    const terListClosedloop = page.getByTestId(`ship-build-material-equipment-list-${TER_BEAM_ID}`)
    await assertMaterialCount(terListClosedloop, 'computronicsubstrate', 5)
    await assertMaterialCount(terListClosedloop, 'energycells', 100)
    await assertMaterialCount(terListClosedloop, 'metallicmicrolattice', 36)
    await assertMaterialCount(terListClosedloop, 'siliconcarbide', 4)

    const argGroupClosedloop = page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)
    await expand(argGroupClosedloop)
    const argListClosedloop = page.getByTestId(`ship-build-material-equipment-list-${ARG_BEAM_ID}`)
    await assertMaterialCount(argListClosedloop, 'claytronics', 6)
    await assertMaterialCount(argListClosedloop, 'energycells', 330)
    await assertMaterialCount(argListClosedloop, 'hullparts', 45)
    await assertMaterialMissing(argListClosedloop, 'advancedelectronics')
    await assertMaterialMissing(argListClosedloop, 'turretcomponents')

    await selectMethod(page, 'terran')
    const argGroupTerran = page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)
    await expand(argGroupTerran)
    const argListTerran = page.getByTestId(`ship-build-material-equipment-list-${ARG_BEAM_ID}`)
    await assertMaterialCount(argListTerran, 'advancedelectronics', 18)
    await assertMaterialCount(argListTerran, 'energycells', 30)
    await assertMaterialCount(argListTerran, 'turretcomponents', 30)
    await assertMaterialMissing(argListTerran, 'claytronics')
    await assertMaterialMissing(argListTerran, 'hullparts')
  })

  test('3.5 场景：价格滑条联动', async ({ page }) => {
    await buildStateMaterialAggregation(page)

    const summary = page.getByTestId('ship-build-material-summary')
    await expand(summary)

    const summaryList = page.getByTestId('ship-build-material-summary-list')
    const summaryBefore = await summaryList.innerText()
    await assertMaterialCount(summaryList, 'energycells', 1164)

    const argGroup = page.getByTestId(`ship-build-material-equipment-group-${ARG_BEAM_ID}`)
    await expand(argGroup)
    const argList = page.getByTestId(`ship-build-material-equipment-list-${ARG_BEAM_ID}`)
    const argBefore = await argList.innerText()
    await assertMaterialCount(argList, 'energycells', 30)

    await setPriceSlider(page, 1)

    const summaryAfter = await summaryList.innerText()
    const argAfter = await argList.innerText()

    await assertMaterialCount(summaryList, 'energycells', 1164)
    await assertMaterialCount(argList, 'energycells', 30)
    expect(summaryAfter).not.toBe(summaryBefore)
    expect(argAfter).not.toBe(argBefore)
  })

  test('3.6 场景：多模块聚合下材料数量正确', async ({ page }) => {
    await buildStateMultiModuleAggregation(page)

    const summary = page.getByTestId('ship-build-material-summary')
    await expand(summary)

    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await assertMaterialCount(summaryList, 'energycells', 1174)
    await assertMaterialCount(summaryList, 'computronicsubstrate', 286)
    await assertMaterialCount(summaryList, 'metallicmicrolattice', 507)
    await assertMaterialCount(summaryList, 'advancedelectronics', 20)
    await assertMaterialCount(summaryList, 'turretcomponents', 54)
    await assertMaterialCount(summaryList, 'siliconcarbide', 4)

    const gatlingGroup = page.getByTestId(`ship-build-material-equipment-group-${ARG_GATLING_ID}`)
    await expand(gatlingGroup)
    const gatlingList = page.getByTestId(`ship-build-material-equipment-list-${ARG_GATLING_ID}`)
    await assertMaterialCount(gatlingList, 'advancedelectronics', 2)
    await assertMaterialCount(gatlingList, 'energycells', 10)
    await assertMaterialCount(gatlingList, 'turretcomponents', 24)
  })
})
