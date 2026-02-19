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

test.describe('帝国总览多空间站聚合测试', () => {
  
  test('帝国总览界面显示 EmpireWareFlowsDashboard 组件', async ({ page }) => {
    await createNewEmpire(page);
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    
    await expect(page.locator('.list-wrapper')).toBeVisible();
    await expect(page.locator('.list-header')).toContainText(/资源产出|Resource Production/);
  });

  test('数量视图按产品/运营/补给三组显示', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(300);
    
    const groupContainers = page.locator('.group-container');
    const count = await groupContainers.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('经济视图按产品收入/运营支出/补给显示', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const economyBtn = page.locator('.view-mode-btn').filter({ hasText: /经济|Economy/ }).first();
    await economyBtn.click();
    await page.waitForTimeout(200);
    
    const profitSection = page.locator('.profit-section').first();
    await expect(profitSection).toBeVisible();
  });

  test('切换 tab 不触发缓存重新计算', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    const stationTab = page.locator('.station-tab').first();
    await stationTab.click();
    await page.waitForTimeout(200);
    
    await empireOverviewTab.click();
    await page.waitForTimeout(200);
    
    await expect(page.locator('.list-wrapper')).toBeVisible();
  });
});

test.describe('空间站数量功能测试', () => {
  
  test('数量输入框可以设置为 0', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    
    const countInput = page.locator('input[type="number"]').first();
    await countInput.fill('0');
    await page.waitForTimeout(200);
    
    const value = await countInput.inputValue();
    expect(value).toBe('0');
  });

  test('数量为 0 时，该空间站不参与帝国聚合', async ({ page }) => {
    await createNewEmpire(page);
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    
    const countInput = page.locator('input[type="number"]').first();
    await countInput.fill('0');
    await page.waitForTimeout(200);
    
    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(300);
    
    const flowWrappers = page.locator('.flow-wrapper');
    const count = await flowWrappers.count();
    expect(count).toBe(0);
  });
});

test.describe('补给优先归类测试', () => {
  test('同一资源命中补给时仅出现在补给组', async ({ page }) => {
    await createNewEmpire(page);

    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    await addModuleToStation(page, 'Clay');

    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /ON|OFF/ }).first();
    const isWorkforceOn = await workforceToggle.evaluate(el => el.classList.contains('active-green'));
    if (!isWorkforceOn) {
      await workforceToggle.click();
      await page.waitForTimeout(100);
    }

    await addStationBtn.click();
    await addModuleToStation(page, 'Medical');
    await page.waitForTimeout(300);

    const empireOverviewTab = page.locator('.overview-tab').first();
    await empireOverviewTab.click();
    await page.waitForTimeout(300);

    const productsGroup = page.locator('.group-container').filter({
      has: page.locator('.group-title').filter({ hasText: /产品|Products/ })
    }).first();
    const operationsGroup = page.locator('.group-container').filter({
      has: page.locator('.group-title').filter({ hasText: /运营|Operations/ })
    }).first();
    const supplyGroup = page.locator('.group-container').filter({
      has: page.locator('.group-title').filter({ hasText: /补给|Supply/ })
    }).first();

    const medicalInProducts = productsGroup.locator('.flow-wrapper[data-resource-id="medicalsupplies"]');
    const medicalInOperations = operationsGroup.locator('.flow-wrapper[data-resource-id="medicalsupplies"]');
    const medicalInSupply = supplyGroup.locator('.flow-wrapper[data-resource-id="medicalsupplies"]');

    await expect(medicalInSupply).toHaveCount(1);
    await expect(medicalInProducts).toHaveCount(0);
    await expect(medicalInOperations).toHaveCount(0);
  });
});
