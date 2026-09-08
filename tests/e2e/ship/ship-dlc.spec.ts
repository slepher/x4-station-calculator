import { test, expect } from '@playwright/test'

test.describe('Ship DLC', () => {
  const shipBuildButton = (page: any) => page.getByRole('button', { name: /Ship Build|船只建造/ })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)
    await page.reload()
    await page.locator('[data-testid="language-select"]').selectOption('en')
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.waitForSelector('.toolbar-panel', { state: 'visible' })
  })

  const setDlcActivation = async (page: any, active: 'all' | 'none' | 'mini02', enforce: boolean) => {
    await page.getByTestId('settings-button').click()
    await page.getByTestId('dlc-settings-modal').waitFor()
    await page.getByTestId(active === 'all' ? 'dlc-settings-select-all' : 'dlc-settings-clear-all').click()
    if (active === 'mini02') await page.getByTestId('dlc-settings-item-ego_dlc_mini_02').locator('input').check()
    const enforceToggle = page.getByTestId('dlc-settings-enforce-toggle').locator('input')
    if (await enforceToggle.isChecked() !== enforce) await enforceToggle.click()
    await page.getByTestId('dlc-settings-save').click()
    await expect(page.getByTestId('dlc-settings-modal')).toBeHidden()
  }

  const enterShipSelectorWithFilters = async (page: any) => {
    await shipBuildButton(page).click()
    await page.waitForSelector('[data-testid="ship-build-selector-grid"]', { state: 'visible' })
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M' }).click()
    await page.getByTestId('ship-build-filter-race').locator('button').filter({ hasText: /^generic/ }).click()
    await page.waitForSelector('.list-body li', { state: 'visible' })
  }

  const shipItems = (page: any) => page.getByTestId('ship-build-list-column').locator('.list-body li')

  const genericMShips = [
    { id: 'ship_gen_m_corvette_01', name: 'Envoy' },
    { id: 'ship_gen_m_corvette_02', name: 'Cypher' },
    { id: 'ship_gen_m_tugboat_01_a', name: 'Manticore' },
    { id: 'ship_gen_m_yacht_01_a', name: 'Astrid' }
  ] as const
  const genericMIds = genericMShips.map((ship) => ship.id)
  const expectedShips = (active: 'all' | 'none' | 'mini02', enforce: boolean) => {
    if (!enforce) return genericMIds.length
    if (active === 'all') return genericMIds.length
    if (active === 'mini02') return 3
    return 1
  }

  test('2.1 状态:舰船选择界面', async ({ page }) => {
    await setDlcActivation(page, 'all', false)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page).first()).toBeVisible()
    await expect(shipItems(page).locator('.dlc-tag').first()).toBeVisible()
  })

  test('2.2 状态:装备选择器打开', async ({ page }) => {
    await setDlcActivation(page, 'all', false)
    await enterShipSelectorWithFilters(page)
    await shipItems(page).first().click()
    await page.getByTestId('ship-build-confirm-ship').click()
    await page.waitForSelector('[data-testid="ship-build-fit-panel"]', { state: 'visible' })
    await page.locator('[data-testid^="slot-type-"]').first().click()
    await page.waitForSelector('[data-testid^="slot-"]', { state: 'visible' })
    await expect(page.locator('[data-testid^="slot-"]').first()).toBeVisible()
  })

  test('2.3 状态:DLC标签激活态', async ({ page }) => {
    await setDlcActivation(page, 'all', false)
    await enterShipSelectorWithFilters(page)
    const activeTag = shipItems(page).locator('.dlc-tag--active')
    await expect(activeTag.first()).toBeVisible()
    await expect(activeTag.first()).toHaveClass(/dlc-tag--active/)
  })

  test('2.4 状态:DLC标签未激活态', async ({ page }) => {
    await setDlcActivation(page, 'none', false)
    await enterShipSelectorWithFilters(page)
    const inactiveTag = shipItems(page).locator('.dlc-tag--inactive')
    await expect(inactiveTag.first()).toBeVisible()
    await expect(inactiveTag.first()).toHaveClass(/dlc-tag--inactive/)
  })

  test('2.5 状态:DLC限制关', async ({ page }) => {
    await setDlcActivation(page, 'none', false)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page)).toHaveCount(expectedShips('none', false))
    for (const ship of genericMShips) await expect(shipItems(page).locator('[data-testid="ship-build-ship-name"]').filter({ hasText: new RegExp(`^${ship.name}$`) })).toHaveCount(1)
    await expect(shipItems(page).locator('.dlc-tag--inactive').first()).toBeVisible()
  })

  test('2.6 状态:DLC限制开', async ({ page }) => {
    await setDlcActivation(page, 'none', true)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page)).toHaveCount(expectedShips('none', true))
    await expect(shipItems(page).locator('[data-testid="ship-build-ship-name"]').filter({ hasText: /^Manticore$/ })).toHaveCount(1)
    await expect(shipItems(page).locator('.dlc-tag--inactive')).toHaveCount(0)
  })

  test('3.1 Case: DLC 标签显示与样式语义', async ({ page }) => {
    await setDlcActivation(page, 'none', false)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page).filter({ hasNot: page.locator('.dlc-tag') }).first()).toBeVisible()
    await expect(shipItems(page).locator('.dlc-tag--inactive').first()).toBeVisible()
  })

  test('3.2 Case: enforceDlcActivation=false 时舰船候选完整显示', async ({ page }) => {
    await setDlcActivation(page, 'none', false)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page)).toHaveCount(expectedShips('none', false))
    await expect(page.getByTestId('ship-build-filter-race-btn-generic')).toHaveText('generic(4)')
  })

  test('3.3 Case: enforceDlcActivation=true 时舰船候选过滤', async ({ page }) => {
    await setDlcActivation(page, 'none', true)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page)).toHaveCount(expectedShips('none', true))
    await expect(shipItems(page).locator('.dlc-tag--inactive')).toHaveCount(0)
    await expect(page.getByTestId('ship-build-filter-race-btn-generic')).toHaveText('generic(1)')
  })

  test('3.1.8-3.1.9 equipment DLC tag and invalid current ship fallback', async ({ page }) => {
    await setDlcActivation(page, 'mini02', true)
    await enterShipSelectorWithFilters(page)
    await expect(shipItems(page)).toHaveCount(expectedShips('mini02', true))
    const shipNamed = (name: string) => shipItems(page).locator('[data-testid="ship-build-ship-name"]').filter({ hasText: new RegExp(`^${name}$`) })
    await expect(shipNamed('Envoy')).toBeVisible()
    await expect(shipNamed('Cypher')).toBeVisible()
    await expect(shipNamed('Manticore')).toBeVisible()
    await expect(shipNamed('Astrid')).toHaveCount(0)
    await shipNamed('Envoy').click()
    await page.getByTestId('ship-build-confirm-ship').click()
    await page.waitForSelector('[data-testid="ship-build-fit-panel"]', { state: 'visible' })
    await page.locator('[data-testid^="slot-type-engine"]').first().click()
    await page.locator('[data-testid^="slot-"]:not([data-testid^="slot-type-"])').first().click()
    const equipment = page.getByTestId('candidate-engine_arg_m_corvette_01_mk1')
    await expect(equipment.locator('.dlc-tag')).toHaveText('Envoy Pack')
    await expect(equipment.locator('.dlc-tag')).toHaveClass(/dlc-tag--active/)

    await setDlcActivation(page, 'none', false)
    await expect(equipment.locator('.dlc-tag')).toHaveClass(/dlc-tag--inactive/)
    await setDlcActivation(page, 'none', true)
    await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4_ship_blueprints') || '{}').activeShipId)).toBe('ship_ter_m_corvette_01_a')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4_ship_blueprints') || '{}').activeBlueprintId)).toBe('d111f259-6c0d-f519-aa82-10829f684cbb')
    await page.reload()
    await expect(page.getByTestId('ship-build-selector-grid')).toBeVisible()
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)
    await page.getByTestId('settings-button').click()
    await expect(page.getByTestId('dlc-settings-item-ego_dlc_mini_02').locator('input')).not.toBeChecked()
    await expect(page.getByTestId('dlc-settings-enforce-toggle').locator('input')).toBeChecked()
  })
})
