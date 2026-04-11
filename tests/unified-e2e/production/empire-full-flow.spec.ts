import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({ 
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
});

async function createNewEmpire(page: any) {
  const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first();
  await newBtn.click();
  await page.waitForTimeout(100);
}

async function addModuleToStation(page: any, moduleName: string) {
  const searchInput = page.locator('.search-box .search-input');
  await searchInput.focus();
  await searchInput.fill(moduleName);
  
  const resultItem = page.locator('.results-popover .result-item').first();
  await expect(resultItem).toBeVisible({ timeout: 500 });
  await resultItem.click();
}

test.describe('帝国总览多空间站聚合完整流程', () => {
  
  test('添加三个空间站并验证帝国总览分组', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Clay');
    
    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /ON|OFF/ }).first();
    const isWorkforceOn = await workforceToggle.evaluate(el => el.classList.contains('active-green'))
    if (!isWorkforceOn) {
      await workforceToggle.click();
      await page.waitForTimeout(100);
    }
    
    const quantumTubeFlow = page.locator('.flow-wrapper').filter({ hasText: /量子管|Quantum Tube/ }).first();
    if (await quantumTubeFlow.isVisible()) {
      await quantumTubeFlow.hover();
      await page.waitForTimeout(50);
      const lockBtn = quantumTubeFlow.locator('.lock-btn').first();
      if (await lockBtn.isVisible()) {
        await lockBtn.click();
        await page.waitForTimeout(100);
      }
    }
    
    await addStationBtn.click();
    await addModuleToStation(page, 'Hull Part');
    
    await addStationBtn.click();
    await addModuleToStation(page, 'Hull Part');
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    await expect(page.locator('.list-wrapper')).toBeVisible();
    
    const productsGroup = page.locator('.group-container').filter({ hasText: /产品|Products/ });
    const operationsGroup = page.locator('.group-container').filter({ hasText: /运营|Operations/ });
    const supplyGroup = page.locator('.group-container').filter({ hasText: /补给|Supply/ });
    
    const productsCount = await productsGroup.locator('.flow-wrapper').count();
    const operationsCount = await operationsGroup.locator('.flow-wrapper').count();
    const supplyCount = await supplyGroup.locator('.flow-wrapper').count();
    
    console.log(`Products: ${productsCount}, Operations: ${operationsCount}, Supply: ${supplyCount}`);
    
    expect(productsCount).toBe(2);
    expect(operationsCount).toBe(1);
    expect(supplyCount).toBe(2);
    
    const claytronicsInProducts = productsGroup.locator('.flow-wrapper').filter({ hasText: /电子黏土|Claytronics/ });
    const hullpartsInProducts = productsGroup.locator('.flow-wrapper').filter({ hasText: /船体部件|Hull Parts/ });
    
    await expect(claytronicsInProducts.first()).toBeVisible();
    await expect(hullpartsInProducts.first()).toBeVisible();
    
    const quantumTubesInOperations = operationsGroup.locator('.flow-wrapper').filter({ hasText: /量子管|Quantum Tube/ });
    await expect(quantumTubesInOperations.first()).toBeVisible();
    
    const foodrationsInSupply = supplyGroup.locator('.flow-wrapper').filter({ hasText: /食物配给|Food Rations/ });
    const medicalSuppliesInSupply = supplyGroup.locator('.flow-wrapper').filter({ hasText: /医疗物资|Medical Supplies/ });
    
    await expect(foodrationsInSupply.first()).toBeVisible();
    await expect(medicalSuppliesInSupply.first()).toBeVisible();
  });

  test('点击物品展开明细显示各空间站贡献', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const flowWrapper = page.locator('.flow-wrapper').first();
    if (await flowWrapper.isVisible()) {
      await flowWrapper.locator('.main-row').click();
      await page.waitForTimeout(100);
      
      const listBox = page.locator('.list-box');
      if (await listBox.isVisible()) {
        const listItems = listBox.locator('.list-item');
        const itemCount = await listItems.count();
        expect(itemCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('经济视图显示利润汇总', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const economyBtn = page.locator('.view-mode-btn').filter({ hasText: /经济|Economy/ }).first();
    await economyBtn.click();
    await page.waitForTimeout(100);
    
    const profitSection = page.locator('.profit-section').first();
    await expect(profitSection).toBeVisible();
    
    const profitValue = page.locator('.profit-val').first();
    await expect(profitValue).toBeVisible();
  });

  test('空间站数量为0时不参与聚合', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const flowCountBefore = await page.locator('.flow-wrapper').count();
    expect(flowCountBefore).toBeGreaterThan(0);
    
    const stationTab = page.locator('.station-tab').first();
    await stationTab.click();
    await page.waitForTimeout(100);
    
    const countInput = page.locator('input[type="number"]').first();
    await countInput.fill('0');
    await page.waitForTimeout(100);
    
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const flowCountAfter = await page.locator('.flow-wrapper').count();
    expect(flowCountAfter).toBe(0);
  });

  test('空间站数量大于1时数据翻倍', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const flowWrapper = page.locator('.flow-wrapper').first();
    let originalValue = '0';
    if (await flowWrapper.isVisible()) {
      const valueElement = flowWrapper.locator('.value').first();
      originalValue = await valueElement.textContent() || '0';
    }
    
    const stationTab = page.locator('.station-tab').first();
    await stationTab.click();
    await page.waitForTimeout(100);
    
    const countInput = page.locator('input[type="number"]').first();
    await countInput.fill('2');
    await page.waitForTimeout(100);
    
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    if (await flowWrapper.isVisible()) {
      const valueElement = flowWrapper.locator('.value').first();
      const newValue = await valueElement.textContent() || '0';
      
      const originalNum = parseFloat(originalValue.replace(/[^0-9.-]/g, ''));
      const newNum = parseFloat(newValue.replace(/[^0-9.-]/g, ''));
      
      expect(Math.abs(newNum)).toBeCloseTo(Math.abs(originalNum * 2), 0);
    }
  });
});
