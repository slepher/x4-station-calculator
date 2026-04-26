import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})

async function setLanguage(page: Page, lang: string) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

async function switchToLiveProduction(page: Page) {
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}

async function selectStationInSector(page: Page, sectorName: string, stationName: string) {
  const supplyTab = page.locator('.supply-tab').filter({ hasText: sectorName })
  await expect(supplyTab).toBeVisible({ timeout: 5000 })
  await supplyTab.click()
  await page.waitForTimeout(500)

  const stationTab = page.locator('.station-tab').filter({ hasText: stationName })
  await expect(stationTab).toBeVisible({ timeout: 5000 })
  await stationTab.click()
  await page.waitForTimeout(300)
}

test.describe('Live Station Fixture Load', () => {
  test('loads save binding fixture and reveals archive-only station tabs', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '神圣眼光' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()

    const archiveStationTab = page.locator('.station-tab').filter({ hasText: 'PPW-916' })
    await expect(archiveStationTab).toBeVisible({ timeout: 5000 })
  })
})

test.describe('3 E2E 测试场景', () => {
  test('3.1 Case: 站点"地球人"双数据源-规划模式可切换', async ({ page }) => {
    await selectStationInSector(page, '小行星', '地球人')
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('规划')
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
    await expect(modeBtn).toBeEnabled()
  })

  test('3.2 Case: 站点"新建空间站"仅有bindingStation-规划模式不可切换', async ({ page }) => {
    await selectStationInSector(page, '小行星', '新建空间站')
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('规划')
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
    await expect(modeBtn).toBeDisabled()
  })

  test('3.10 Case: 站点"新建空间站"bindingStation-星区坐标sunlight正确显示', async ({ page }) => {
    await selectStationInSector(page, '小行星', '新建空间站')

    const sectorField = page.locator('.input-group').filter({ hasText: /星区|Sector/ }).first()
    const sectorDisplay = sectorField.locator('.text-sky-400')
    await expect(sectorDisplay).toBeVisible({ timeout: 500 })
    const sectorNameText = await sectorDisplay.textContent()
    expect(sectorNameText).toContain('小行星带')

    const sunlightField = page.locator('.input-group').filter({ hasText: /光伏效率|Sunlight/ }).first()
    const sunlightValue = sunlightField.locator('.text-sky-400')
    await expect(sunlightValue).toBeVisible({ timeout: 500 })
    const sunlightText = await sunlightValue.textContent()
    expect(sunlightText).toBe('13')

    const resourcesField = page.locator('.input-group').filter({ hasText: /星区资源|Sector Resources/ })
    await expect(resourcesField).toBeVisible({ timeout: 500 })
    const resourcesDisplay = resourcesField.locator('.font-mono.text-sky-400')
    await expect(resourcesDisplay).toBeVisible({ timeout: 500 })
    const resourcesText = await resourcesDisplay.textContent()
    expect(resourcesText).toBe('7')

    await sectorField.click()
    await page.waitForTimeout(100)

    await expect(page.locator('.sector-popover')).toBeVisible({ timeout: 500 })

    const popoverContent = page.locator('.sector-popover .popover-content')
    await expect(popoverContent).toBeVisible({ timeout: 500 })

    const positionItems = popoverContent.locator('.position-row')
    await expect(positionItems).toHaveCount(3, { timeout: 500 })

    const xRow = positionItems.filter({ hasText: 'X' })
    const xValue = await xRow.locator('.position-value').textContent()
    expect(xValue).toBe('67.5')

    const yRow = positionItems.filter({ hasText: 'Y' })
    const yValue = await yRow.locator('.position-value').textContent()
    expect(yValue).toBe('0')

    const zRow = positionItems.filter({ hasText: 'Z' })
    const zValue = await zRow.locator('.position-value').textContent()
    expect(zValue).toBe('81.3')

    await page.locator('.sector-popover .fixed').click()
    await page.waitForTimeout(100)

    await resourcesField.click()
    await page.waitForTimeout(100)

    const resourcesPopover = page.locator('.resources-popover')
    await expect(resourcesPopover).toBeVisible({ timeout: 500 })

    const resourceItems = resourcesPopover.locator('.resource-item')
    await expect(resourceItems).toHaveCount(7, { timeout: 500 })

    const resourceTexts = await resourceItems.allTextContents()
    expect(resourceTexts.some(t => t.includes('氦') || t.includes('Helium'))).toBe(true)
    expect(resourceTexts.some(t => t.includes('氢') || t.includes('Hydrogen'))).toBe(true)
    expect(resourceTexts.some(t => t.includes('冰') || t.includes('Ice'))).toBe(true)
  })

  test('3.3 Case: 存档站点"PPW-916"仅有saveStation-实时模式可切换', async ({ page }) => {
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-live/)
    const modeText = await modeBtn.locator('.chip-status').textContent()
    expect(modeText).toContain('实时')
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    await expect(modeBtn).toBeEnabled()
  })

  test('3.4 Case: 模式切换交互-点击按钮可切换状态', async ({ page }) => {
    await selectStationInSector(page, '小行星', '地球人')
    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 1000 })
    await expect(modeBtn).toHaveClass(/active-planning/)
    await modeBtn.click()
    await page.waitForTimeout(300)
    await expect(modeBtn).toHaveClass(/active-live/)
    const modeText1 = await modeBtn.locator('.chip-status').textContent()
    expect(modeText1).toContain('实时')
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    await modeBtn.click()
    await page.waitForTimeout(300)
    await expect(modeBtn).toHaveClass(/active-planning/)
    const modeText2 = await modeBtn.locator('.chip-status').textContent()
    expect(modeText2).toContain('规划')
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
  })

  test('3.5 Case: Toolbar布局结构正确展示各字段', async ({ page }) => {
    await selectStationInSector(page, '小行星', '地球人')
    await expect(page.locator('.mode-toggle-chip')).toBeVisible({ timeout: 1000 })
    await expect(page.locator('.readonly-pill')).toBeVisible({ timeout: 500 })
    const sectorField = page.locator('.live-toolbar .toolbar-section .input-group').filter({ hasText: /^星区|Sector$/ }).first()
    await expect(sectorField).toBeVisible({ timeout: 500 })
    await expect(page.locator('.live-toolbar').locator('.count-pill').first()).toBeVisible({ timeout: 500 })
    await expect(page.locator('.race-select')).toBeVisible({ timeout: 500 })
  })

  test('3.6 Case: 星区字段点击弹出坐标popover', async ({ page }) => {
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    const sectorField = page.locator('.input-group').filter({ hasText: /星区|Sector/ }).first()
    await sectorField.click()
    await page.waitForTimeout(100)
    await expect(page.locator('.sector-popover')).toBeVisible({ timeout: 500 })
    const popoverContent = page.locator('.sector-popover .popover-content')
    const positionRows = popoverContent.locator('.position-row')
    await expect(positionRows).toHaveCount(3, { timeout: 500 })

    const xRow = positionRows.filter({ hasText: 'X' })
    const xValue = await xRow.locator('.position-value').textContent()
    expect(xValue).toBe('-39.5')

    const yRow = positionRows.filter({ hasText: 'Y' })
    const yValue = await yRow.locator('.position-value').textContent()
    expect(yValue).toBe('0')

    const zRow = positionRows.filter({ hasText: 'Z' })
    const zValue = await zRow.locator('.position-value').textContent()
    expect(zValue).toBe('8.8')
  })

  test('3.7 Case: 星区资源popover展示resources列表', async ({ page }) => {
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    const resourcesField = page.locator('.input-group').filter({ hasText: /星区资源|Sector Resources/ }).first()
    await resourcesField.click()
    await page.waitForTimeout(100)
    await expect(page.locator('.resources-popover')).toBeVisible({ timeout: 500 })
    await expect(page.locator('.resources-popover .popover-content')).toBeVisible({ timeout: 500 })
  })

  test('3.8 Case: 规划模式下控件可编辑', async ({ page }) => {
    await selectStationInSector(page, '小行星', '地球人')
    const raceSelect = page.locator('.race-select')
    await expect(raceSelect).toBeVisible({ timeout: 500 })
    await expect(raceSelect).toBeEnabled()
    const workforceBtn = page.locator('.toolbar-section .toggle-chip').filter({ hasText: /ON|OFF/ }).first()
    await expect(workforceBtn).toBeVisible({ timeout: 500 })
    const gapsBtn = page.locator('[data-testid="toggle-show-empire-gaps"]')
    await expect(gapsBtn).toBeVisible({ timeout: 500 })
    const initialText = await workforceBtn.locator('.chip-status').textContent()
    await workforceBtn.click()
    await page.waitForTimeout(100)
    const afterText = await workforceBtn.locator('.chip-status').textContent()
    expect(initialText).not.toBe(afterText)
  })

  test('3.9 Case: 实时模式下规划控件隐藏', async ({ page }) => {
    await selectStationInSector(page, '神圣眼光', 'PPW-916')
    await expect(page.locator('.race-select')).toBeHidden({ timeout: 500 })
    await expect(page.locator('[data-testid="toggle-show-empire-gaps"]')).toBeHidden({ timeout: 500 })
    const workforceBtn = page.locator('.toolbar-section .toggle-chip').filter({ hasText: /ON|OFF/ }).first()
    await expect(workforceBtn).toBeHidden({ timeout: 500 })
  })

  test('3.10 Case: 星区中转站已绑定的空间站不在tab列表显示', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationRWC = page.locator('.station-tab').filter({ hasText: 'RWC-785' })
    await expect(stationRWC).toBeVisible({ timeout: 3000 })

    const allStationTabs = await page.locator('.station-tab').allInnerTexts()
    const bhwStationTabs = allStationTabs.filter(text => text.includes('BHW-834'))
    expect(bhwStationTabs.length).toBe(0)
  })

  test('3.11 Case: 空间站tab显示正确的tag和factoryGroup属性', async ({ page }) => {
    const sectorTab = page.locator('.supply-tab').filter({ hasText: '阿尔忒弥斯的朦胧' })
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationRWC = page.locator('.station-tab').filter({ hasText: 'RWC-785' })
    await expect(stationRWC).toBeVisible({ timeout: 3000 })

    const tagAttr = await stationRWC.getAttribute('data-tag')
    expect(tagAttr).toBe('factory')

    const factoryGroupAttr = await stationRWC.getAttribute('data-factory-group')
    expect(factoryGroupAttr).toBe('shiptech')
  })
})
