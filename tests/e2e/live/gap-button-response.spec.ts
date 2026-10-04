import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'
import { getSidebarTransit } from './helpers/sidebarNavigation'

test.describe('Gap 按钮响应性验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('新建空间站缺口: 点击量子管 + 按钮后数据应变化', async ({ page }) => {
    const sourceSectorTab = await getSidebarTransit(page, 'cluster_715_sector001_macro')
    await expect(sourceSectorTab).toBeVisible({ timeout: 5000 })
    await sourceSectorTab.locator('.sidebar-nav').click()

    const sourceStationTab = page.locator('[data-testid="sidebar-station"][data-station-id="RWC-785"]')
    await expect(sourceStationTab).toBeVisible({ timeout: 5000 })
    await sourceStationTab.click()

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    await expect(modeBtn).toHaveClass(/active-planning/)

    const claytronicsRow = page.locator('.module-row').filter({ hasText: /电子黏土|Claytronics/ }).first()
    await expect(claytronicsRow).toBeVisible({ timeout: 2000 })
    const claytronicsCount = claytronicsRow.locator('input[type="number"]')
    await claytronicsCount.fill('100')
    await claytronicsCount.press('Tab')
    await expect(claytronicsCount).toHaveValue('100')

    const sectorTab = await getSidebarTransit(page, 'cluster_100_sector001_macro')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.locator('.sidebar-nav').click()

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="f36126e5-7798-ed14-3c03-938b961efa0b"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()

    const gapToggle = page.locator('[data-testid="toggle-show-empire-gaps"]')
    await expect(gapToggle).toBeVisible({ timeout: 2000 })
    await gapToggle.click()

    const opsSection = page.locator('.empire-gap-group').filter({ hasText: /星区运营|Sector Operations/i })
    await expect(opsSection).toBeVisible({ timeout: 2000 })

    const quantumTubes = opsSection.locator('[data-testid="flow-wrapper"][data-resource-id="quantumtubes"]')
    await expect(quantumTubes).toBeVisible({ timeout: 2000 })

    const beforeText = await quantumTubes.locator('.value').textContent()
    const beforeValue = parseFloat(beforeText?.replace(/[+\s,]/g, '') || '0')
    expect(beforeValue).toBeLessThan(0)

    const addBtn = quantumTubes.locator('[data-testid="add-btn"]')
    const plannedQuantum = page.locator('.module-row--draggable').filter({ has: page.locator('.module-name-text').filter({ hasText: /^量子管产线$/ }) })
    await expect(plannedQuantum).toHaveCount(0)
    const otherPlans = await page.evaluate(() => (window as any).saveBindingStore.activeBinding.stationPlans.filter((p: any) => p.id !== 'f36126e5-7798-ed14-3c03-938b961efa0b'))
    await expect(addBtn).toBeVisible({ timeout: 2000 })
    await expect(addBtn).toBeEnabled()
    await addBtn.click()

    const afterText = await quantumTubes.locator('.value').textContent()
    const afterValue = parseFloat(afterText?.replace(/[+\s,]/g, '') || '0')

    expect(afterValue).toBeGreaterThan(beforeValue)
    await expect(plannedQuantum.locator('input')).toHaveValue('1')
    expect(await page.evaluate(() => (window as any).saveBindingStore.activeBinding.stationPlans.filter((p: any) => p.id !== 'f36126e5-7798-ed14-3c03-938b961efa0b'))).toEqual(otherPlans)
    await quantumTubes.locator('.remove-btn').click()
    await expect(plannedQuantum).toHaveCount(0)
    await expect(quantumTubes.locator('.value')).toHaveText(beforeText!)
    await expect(quantumTubes.locator('.remove-btn')).toBeDisabled()
  })
})
