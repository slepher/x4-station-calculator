import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

const ENERGY = 'module_gen_prod_energycells_01'
const ARG_STORAGE = 'module_arg_stor_container_l_01'
const TER_STORAGE = 'module_ter_stor_container_l_01'
const ARG_PIER = 'module_arg_pier_l_03'

async function setupStation(page: Page) {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
}

async function addModule(page: Page, id: string) {
  await page.getByTestId('candidate-search-input').fill(id)
  await page.getByTestId('grouped-candidate-item-' + id).click()
}

async function saveNewEmpire(page: Page, name: string) {
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await expect(dialog).toBeVisible()
  await dialog.locator('.dialog-input').fill(name)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function savedStation(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('x4_empire_data_v9')
    if (!raw) throw new Error('No saved empire state')
    const state = JSON.parse(raw)
    const empire = state.list.find((item: { id: string }) => item.id === state.activeId)
    if (!empire || empire.stations.length !== 1) throw new Error('Expected one active saved station')
    return empire.stations[0]
  })
}

async function setHours(page: Page, label: string, hours: number) {
  const slider = page.locator('.slider-container').filter({ has: page.getByText(label, { exact: true }) }).locator('input[type="range"]')
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < hours; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(hours))
}

const plannedRows = (page: Page) => page.locator('.tier-section').first().locator('.module-row')

async function setPlannedCount(page: Page, index: number, count: number) {
  const input = plannedRows(page).nth(index).getByRole('spinbutton')
  await input.fill(String(count))
  await input.press('Tab')
  await expect(input).toHaveValue(String(count))
}

async function autoStorage(page: Page) {
  return page.evaluate(() => (window as any).blueprintStore.stationState.autoInfrastructureModules
    .filter((module: { id: string }) => module.id.includes('_stor_')))
}

async function autoInfrastructure(page: Page) {
  return page.evaluate(() => (window as any).blueprintStore.stationState.autoInfrastructureModules)
}

test.beforeEach(async ({ page }) => setupStation(page))

test.describe('Module Management - Storage Auto-Fill', () => {
  test('Case 1: Basic Storage Auto-Fill', async ({ page }) => {
    await addModule(page, ENERGY)
    await expect(plannedRows(page)).toHaveCount(1)
    await expect(plannedRows(page).getByRole('spinbutton')).toHaveValue('1')
    // 10,500 cells/h × 12h × 1m³ = 126,000m³; one Argon L holds 1,000,000m³.
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 1 }])
    await expect(page.locator('.tier-auto .count-text').filter({ hasText: /^1$/ })).toHaveCount(2)
  })

  test('Case 2: Race Preference Change', async ({ page }) => {
    await addModule(page, ENERGY)
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 1 }])
    await page.locator('select.race-select').selectOption('terran')
    await expect.poll(() => autoStorage(page)).toEqual([{ id: TER_STORAGE, count: 1 }])
    await saveNewEmpire(page, 'Terran Storage')
    expect((await savedStation(page)).settings.racePreference).toBe('terran')
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await expect(page.locator('select.race-select')).toHaveValue('terran')
    await expect.poll(() => autoStorage(page)).toEqual([{ id: TER_STORAGE, count: 1 }])
  })

  test('Case 3: Incremental Fill', async ({ page }) => {
    await addModule(page, ENERGY)
    await setPlannedCount(page, 0, 10)
    // 1,260,000m³ requires two L containers, minus the explicit planned capacity.
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 2 }])
    await addModule(page, ARG_STORAGE)
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 1 }])
    await setPlannedCount(page, 1, 2)
    await expect.poll(() => autoStorage(page)).toEqual([])
    await expect(plannedRows(page)).toHaveCount(2)
  })

  test('Case 4: Buffer Response', async ({ page }) => {
    await addModule(page, ENERGY)
    await setPlannedCount(page, 0, 10)
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 2 }])
    await page.getByTestId('view-tab-btn-station-wareflow-volume').click()
    await setHours(page, '主产物缓冲时间', 24)
    // 10 × 10,500 × 24 = 2,520,000m³, hence three L containers.
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 3 }])
    await saveNewEmpire(page, 'Storage Buffer')
    expect((await savedStation(page)).settings.primaryProductBufferHours).toBe(24)
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await expect.poll(() => autoStorage(page)).toEqual([{ id: ARG_STORAGE, count: 3 }])
  })

  test('Case 5: Unified Infrastructure Capacity', async ({ page }) => {
    await addModule(page, ENERGY)

    // 10,500 m³/h × 12 h = 126,000 m³; one Argon L holds 1,000,000 m³.
    // Transport demand is 10,500 m³/h; 62,000 × 15 throughput needs one pier.
    await expect.poll(() => autoInfrastructure(page)).toEqual([
      { id: ARG_STORAGE, count: 1 },
      { id: ARG_PIER, count: 1 }
    ])
    await expect(page.locator('.tier-auto .module-row')).toHaveCount(2)

    await addModule(page, ARG_STORAGE)
    await expect.poll(() => autoInfrastructure(page)).toEqual([{ id: ARG_PIER, count: 1 }])
    await expect(page.locator('.tier-auto .module-row')).toHaveCount(1)
  })
})

test.describe('Module Management - Scale Buttons', () => {
  test('应该显示正确的按钮选项', async ({ page }) => {
    await expect(page.locator('.scale-button')).toHaveText(['1/5', '1/3', '1/2', '2x', '3x', '5x'])
  })

  test('按钮应该右对齐', async ({ page }) => {
    const header = page.locator('.tier-header').first()
    const buttons = page.locator('.scale-buttons')
    const headerBox = await header.boundingBox()
    const buttonsBox = await buttons.boundingBox()
    if (!headerBox || !buttonsBox) throw new Error('Missing scale header bounds')
    expect(headerBox.x + headerBox.width - buttonsBox.x - buttonsBox.width).toBeCloseTo(13, 0)
    const labelBox = await header.locator('.tier-label').boundingBox()
    if (!labelBox) throw new Error('Missing planned section label bounds')
    expect(buttonsBox.x).toBeGreaterThanOrEqual(labelBox.x + labelBox.width)
  })

  test('按钮hover效果应该正确', async ({ page }) => {
    const button = page.locator('.scale-button').first()
    await expect(button).toHaveCSS('background-color', 'rgb(51, 65, 85)')
    await expect(button).toHaveCSS('color', 'rgb(148, 163, 184)')
    await button.hover()
    await expect(button).toHaveCSS('background-color', 'rgb(217, 119, 6)')
    await expect(button).toHaveCSS('color', 'rgb(255, 251, 235)')
  })

  test('按钮高度应该为18px', async ({ page }) => {
    await expect(page.locator('.scale-button').first()).toHaveCSS('height', '18px')
  })

  test('按钮点击应该调整模块数量', async ({ page }) => {
    await addModule(page, ENERGY)
    await addModule(page, ARG_STORAGE)
    await setPlannedCount(page, 0, 3)
    await setPlannedCount(page, 1, 2)
    await page.locator('.scale-button').filter({ hasText: /^2x$/ }).click()
    await expect(plannedRows(page).nth(0).getByRole('spinbutton')).toHaveValue('6')
    await expect(plannedRows(page).nth(1).getByRole('spinbutton')).toHaveValue('4')
    await page.locator('.scale-button').filter({ hasText: '1/2' }).click()
    await expect(plannedRows(page).nth(0).getByRole('spinbutton')).toHaveValue('3')
    await expect(plannedRows(page).nth(1).getByRole('spinbutton')).toHaveValue('2')
    await saveNewEmpire(page, 'Module Counts')
    expect((await savedStation(page)).modules).toEqual([{ id: ENERGY, count: 3 }, { id: ARG_STORAGE, count: 2 }])
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await expect(plannedRows(page).nth(0).getByRole('spinbutton')).toHaveValue('3')
    await expect(plannedRows(page).nth(1).getByRole('spinbutton')).toHaveValue('2')
    await plannedRows(page).nth(1).locator('.remove-btn').click()
    await expect(plannedRows(page)).toHaveCount(1)
    await page.getByTestId('toolbar-save-btn').click()
    expect((await savedStation(page)).modules).toEqual([{ id: ENERGY, count: 3 }])
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await expect(plannedRows(page)).toHaveCount(1)
    await expect(plannedRows(page).getByRole('spinbutton')).toHaveValue('3')
  })

  test('规划区高度应该与工业区保持一致', async ({ page }) => {
    await addModule(page, 'module_gen_prod_hullparts_01')
    const plannedHeader = page.locator('.tier-header').first()
    const industryHeader = page.locator('.tier-auto .tier-header').first()
    await expect(plannedHeader).toHaveCSS('height', '32px')
    await expect(industryHeader).toHaveCSS('height', '32px')
  })

  test('按钮样式应该与资源产出概览标签保持一致', async ({ page }) => {
    const button = page.locator('.scale-button').first()
    await expect(button).toHaveCSS('font-size', '8px')
    await expect(button).toHaveCSS('font-weight', '700')
    await expect(button).toHaveCSS('text-transform', 'uppercase')
  })
})
