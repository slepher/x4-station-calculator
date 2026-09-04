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
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('小行星聚合 flows:', panelContent?.substring(0, 800))
    
    const plannedWares = ['反物质转换器', '励磁线圈', '电子基质', '碳化硅', '金属微晶']
    const autoIndustryWares = ['等离子导体', '量子管', '石墨烯', '超流体冷却剂', '精炼金属', '硅晶片']
    
    const productsGroupCount = await wareflowPanel.locator('.flow-group').count()
    console.log('Flow group count:', productsGroupCount)
    
    const productsHeader = wareflowPanel.locator('.group-header').filter({ hasText: /产品|Products/i })
    const headerCount = await productsHeader.count()
    console.log('Products header count:', headerCount)
    
    if (headerCount > 0) {
      const productsHeaderText = await productsHeader.first().textContent()
      console.log('Products header text:', productsHeaderText)
      
      const productsGroup = productsHeader.first().locator('..')
      const productsContent = await productsGroup.textContent()
      console.log('Products group content:', productsContent?.substring(0, 500))
      
      for (const planned of plannedWares) {
        expect(productsContent).toContain(planned.substring(0, 4))
      }
      
      for (const auto of autoIndustryWares) {
        expect(productsContent).not.toContain(auto.substring(0, 4))
      }
    } else {
      console.log('Products header not found - checking panel content directly')
      
      const productsKeywordMatch = panelContent?.match(/产品([^运]*)/)
      if (productsKeywordMatch) {
        const productsPart = productsKeywordMatch[1]
        console.log('Products part extracted:', productsPart?.substring(0, 400))
        
        for (const planned of plannedWares) {
          expect(productsPart).toContain(planned.substring(0, 4))
        }
        
        for (const auto of autoIndustryWares) {
          expect(productsPart).not.toContain(auto.substring(0, 4))
        }
      }
    }
  })
  
  test('单个 station flows 显示原始数据（含 auto-industry surplus）', async ({ page }) => {
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const stationTabs = page.locator('[data-testid="sidebar-station"]')
    const stationCount = await stationTabs.count()
    expect(stationCount).toBe(3)
    
    const mgoTab = stationTabs.filter({ hasText: 'MGO-010' })
    await mgoTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('MGO-010 单站 flows（原始数据）:', panelContent?.substring(0, 600))
    
    const plannedWare = '励磁线圈'
    const autoIndustryWares = ['等离子导体', '量子管', '石墨烯', '超流体冷却剂']
    
    expect(panelContent).toContain(plannedWare.substring(0, 4))
    
    for (const autoWare of autoIndustryWares) {
      expect(panelContent).toContain(autoWare.substring(0, 4))
    }
    
    console.log('验证：单个 station 显示所有 flows（含 auto-industry surplus）')
  })
  
  test('小行星聚合 flows 详细快照（基准数据）', async ({ page }) => {
    await page.waitForTimeout(1000)
    
    const asteroidSupplyTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="186727eb-7c4a-c0e0-b20d-f17405fd3aa3"]')
    await expect(asteroidSupplyTab).toBeVisible({ timeout: 5000 })
    await asteroidSupplyTab.click()
    await page.waitForTimeout(500)
    
    const wareflowPanel = page.locator('.list-wrapper').filter({ hasText: /资源视图|Resource View/i })
    await expect(wareflowPanel).toBeVisible({ timeout: 2000 })
    
    const panelContent = await wareflowPanel.textContent()
    console.log('=== 小行星聚合 flows 完整快照 ===')
    console.log('Full content:', panelContent)
    
    expect(panelContent).toContain('反物质转换器+3,192.0')
    expect(panelContent).toContain('励磁线圈+2,100.0')
    expect(panelContent).toContain('电子基质+5,880.0')
    expect(panelContent).toContain('碳化硅+5,760.0')
    expect(panelContent).toContain('金属微晶+37,760.0')
    
    expect(panelContent).not.toContain('等离子导体')
    expect(panelContent).not.toContain('石墨烯')
    
    expect(panelContent).toContain('运营量子管-28.8')
    
    console.log('=== 基准快照验证完成（Products surplus + Operations） ===')
  })
})
