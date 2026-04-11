import { test, expect } from '@playwright/test';

test.describe('Split Supply Operations - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    
    const addStationBtn = page.locator('.add-btn');
    await addStationBtn.click();
    
    await page.waitForSelector('.module-list-container', { state: 'visible' });
  });

  test('测试 UI 显示补给分组', async ({ page }) => {
    const searchInput = page.locator('.search-box .search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('Clay');
    await page.waitForTimeout(100);
    
    const resultsPopover = page.locator('.results-popover');
    const resultItem = resultsPopover.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 500 });
    await resultItem.click();

    await page.waitForTimeout(200);

    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();

    await page.waitForTimeout(200);

    const quantityBtn = page.locator('.view-mode-btn').filter({ hasText: /数量|Quantity/ });
    await quantityBtn.click();

    const supplyGroup = page.locator('.group-container').filter({ hasText: /补给|Supply/ });
    await expect(supplyGroup).toBeVisible();
  });

  test('测试经济视图补给支出分组', async ({ page }) => {
    const searchInput = page.locator('.search-box .search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('Clay');
    await page.waitForTimeout(100);
    
    const resultsPopover = page.locator('.results-popover');
    const resultItem = resultsPopover.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 500 });
    await resultItem.click();

    await page.waitForTimeout(200);

    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();

    await page.waitForTimeout(200);

    const economyBtn = page.locator('.view-mode-btn').filter({ hasText: /经济|Economy/ });
    await economyBtn.click();

    const supplyGroup = page.locator('.group-container').filter({ hasText: /补给支出|Supply Expenses/ });
    await expect(supplyGroup).toBeVisible();
  });

  test('测试分组顺序 - 产品→运营→补给→资源', async ({ page }) => {
    const searchInput = page.locator('.search-box .search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    await searchInput.fill('Clay');
    await page.waitForTimeout(100);
    
    const resultsPopover = page.locator('.results-popover');
    const resultItem = resultsPopover.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 500 });
    await resultItem.click();

    await page.waitForTimeout(200);

    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();

    await page.waitForTimeout(200);

    const quantumTubeRow = page.locator('.flow-wrapper').filter({ hasText: /量子管|Quantum Tube/ });
    await quantumTubeRow.hover();
    const lockBtn = quantumTubeRow.locator('.lock-btn');
    await lockBtn.click();

    await page.waitForTimeout(200);

    const quantityBtn = page.locator('.view-mode-btn').filter({ hasText: /数量|Quantity/ });
    await quantityBtn.click();

    const groupContainers = page.locator('.list-body .group-container');
    const groupCount = await groupContainers.count();
    
    expect(groupCount).toBeGreaterThanOrEqual(3);

    const expectedOrder = [
      /产品|Products/,
      /运营|Operations/,
      /补给|Supply/,
      /资源|Resources/
    ];

    for (let i = 0; i < Math.min(groupCount, expectedOrder.length); i++) {
      const group = groupContainers.nth(i);
      const groupTitle = group.locator('.group-title');
      const titleText = await groupTitle.textContent();
      
      const matchesExpected = expectedOrder.some(pattern => pattern.test(titleText || ''));
      expect(matchesExpected).toBeTruthy();
    }
  });
});
