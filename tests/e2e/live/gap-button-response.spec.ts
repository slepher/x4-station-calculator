import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

test.describe('Gap 按钮响应性验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)

    await page.evaluate(() => {
      const gameDataStore = (window as any).gameDataStore
      const saveArchivesKey = gameDataStore.getStorageKey('save_archives')
      const bindingsKey = saveArchivesKey.replace('save_archives', 'save_bindings')
      const bindings = JSON.parse(localStorage.getItem(bindingsKey) || '{}')
      const stationPlans = bindings.list[0].stationPlans
      const stationA = stationPlans.find((station: { id: string }) => station.id === 'MGO-010')
      stationA.modules = [{ id: 'module_gen_prod_claytronics_01', count: 1 }]
      stationA.lockedWares = ['quantumtubes']
      localStorage.setItem(bindingsKey, JSON.stringify(bindings))
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 2000 })
    await page.waitForTimeout(300)

    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.waitForTimeout(200)
  })

  test('新建空间站缺口: 点击量子管 + 按钮后数据应变化', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const modeBtn = page.locator('.mode-toggle-chip')
    await expect(modeBtn).toBeVisible({ timeout: 2000 })
    const modeClass = await modeBtn.getAttribute('class')
    if (modeClass && modeClass.includes('active-live')) {
      await modeBtn.click()
      await page.waitForTimeout(500)
    }
    await expect(modeBtn).toHaveClass(/active-planning/)

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="f36126e5-7798-ed14-3c03-938b961efa0b"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const gapToggle = page.locator('[data-testid="toggle-show-empire-gaps"]')
    await expect(gapToggle).toBeVisible({ timeout: 2000 })
    await gapToggle.click()
    await page.waitForTimeout(300)

    const opsSection = page.locator('.empire-gap-group').filter({ hasText: /星区运营|Sector Operations/i })
    await expect(opsSection).toBeVisible({ timeout: 2000 })

    const quantumTubes = opsSection.locator('[data-testid="flow-wrapper"][data-resource-id="quantumtubes"]')
    await expect(quantumTubes).toBeVisible({ timeout: 2000 })

    const beforeText = await quantumTubes.locator('.value').textContent()
    const beforeValue = parseFloat(beforeText?.replace(/[+\s,]/g, '') || '0')

    const addBtn = quantumTubes.locator('[data-testid="add-btn"]')
    await expect(addBtn).toBeVisible({ timeout: 2000 })
    await expect(addBtn).toBeEnabled()
    await addBtn.click()
    await page.waitForTimeout(500)

    const afterText = await quantumTubes.locator('.value').textContent()
    const afterValue = parseFloat(afterText?.replace(/[+\s,]/g, '') || '0')

    expect(afterValue).not.toBe(beforeValue)
  })
})
