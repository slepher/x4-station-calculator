import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})

test.describe('Sector Flow Filter', () => {
  test('小行星星区聚合 flows 应只显示三个 station 的 planned ware 作为 surplus', async ({ page }) => {
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: '资源视图' })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('小行星聚合 flows:', panelContent?.substring(0, 800))
    
    // Fixture facts: the three stations in this sector plan these five products;
    // effective planned modules also contribute energy cells in live planning.
    const productsGroup = wareflowPanel.locator('.group-container').filter({ hasText: '产品' })
    await expect(productsGroup).toHaveCount(1)

    const expectedIds = [
      'antimatterconverters', 'fieldcoils', 'computronicsubstrate',
      'siliconcarbide', 'energycells', 'metallicmicrolattice', 'quantumtubes'
    ]
    const actualIds = await productsGroup.locator('[data-resource-id]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-resource-id')).filter((id): id is string => id !== null)
    )
    expect(actualIds.sort()).toEqual(expectedIds.sort())

    const expectedValues: Record<string, string> = {
      antimatterconverters: '+3,192.0',
      fieldcoils: '+2,100.0',
      computronicsubstrate: '+5,880.0',
      siliconcarbide: '+5,760.0',
      energycells: '+254,100.0',
      metallicmicrolattice: '+37,760.0',
      quantumtubes: '+0.0'
    }
    for (const [resourceId, value] of Object.entries(expectedValues)) {
      await expect(productsGroup.locator(`[data-resource-id="${resourceId}"] .value`)).toHaveText(value)
    }
  })
  
  test('单个 station flows 显示原始数据（含 auto-industry surplus）', async ({ page }) => {
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const stationCount = await stationTabs.count()
    expect(stationCount).toBe(3)
    
    const mgoTab = stationTabs.filter({ hasText: 'MGO-010' })
    await mgoTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: '资源视图' })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('MGO-010 单站 flows（原始数据）:', panelContent?.substring(0, 600))
    const expectedStationProducts: Record<string, string> = {
      fieldcoils: '+1,050.0',
      energycells: '+33,060.0',
      plasmaconductors: '+112.0',
      graphene: '+672.0',
      superfluidcoolant: '+305.0'
    }
    const productsGroup = wareflowPanel.locator('.group-container').filter({ hasText: '产品' })
    await expect(productsGroup).toHaveCount(1)
    expect(await productsGroup.locator('[data-resource-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-resource-id')))).toEqual(Object.keys(expectedStationProducts))
    for (const [resourceId, value] of Object.entries(expectedStationProducts)) {
      await expect(productsGroup.locator(`[data-resource-id="${resourceId}"] .value`)).toHaveText(value)
    }

    const expectedStationOperations: Record<string, string> = {
      quantumtubes: '-258.0'
    }
    const operationsGroup = wareflowPanel.locator('.group-container').filter({ hasText: '运营' })
    await expect(operationsGroup).toHaveCount(1)
    expect(await operationsGroup.locator('[data-resource-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-resource-id')))).toEqual(Object.keys(expectedStationOperations))
    for (const [resourceId, value] of Object.entries(expectedStationOperations)) {
      await expect(operationsGroup.locator(`[data-resource-id="${resourceId}"] .value`)).toHaveText(value)
    }
  })
  
  test('小行星聚合 flows 详细快照（基准数据）', async ({ page }) => {
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: '资源视图' })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('=== 小行星聚合 flows 完整快照 ===')
    console.log('Full content:', panelContent)
    
    const productsGroup = wareflowPanel.locator('.group-container').filter({ hasText: '产品' })
    await expect(productsGroup).toHaveCount(1)
    const expectedIds = [
      'antimatterconverters', 'fieldcoils', 'computronicsubstrate',
      'siliconcarbide', 'energycells', 'metallicmicrolattice', 'quantumtubes'
    ]
    const actualIds = await productsGroup.locator('[data-resource-id]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-resource-id')).filter((id): id is string => id !== null)
    )
    expect(actualIds.sort()).toEqual(expectedIds.sort())
    for (const [resourceId, value] of Object.entries({
      antimatterconverters: '+3,192.0',
      fieldcoils: '+2,100.0',
      computronicsubstrate: '+5,880.0',
      siliconcarbide: '+5,760.0',
      energycells: '+254,100.0',
      metallicmicrolattice: '+37,760.0',
      quantumtubes: '+0.0'
    })) {
      await expect(productsGroup.locator(`[data-resource-id="${resourceId}"] .value`)).toHaveText(value)
    }
    await expect(wareflowPanel.locator('[data-resource-id="quantumtubes"]')).toHaveCount(1)
    await expect(wareflowPanel.locator('.group-container').filter({ hasText: '运营' }).locator('[data-resource-id="quantumtubes"]')).toHaveCount(0)
    
    console.log('=== 基准快照验证完成（Products surplus + Operations） ===')
  })
})
