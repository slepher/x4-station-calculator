import { test, expect } from '@playwright/test';

test.describe('FavoriteButton 集成测试', () => {
  test('4.1 完整工作流测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 添加模块
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);
    
    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);
    
    // 切换到数量视图
    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);
    
    // 验证 FavoriteButton 存在
    const favoriteBtns = page.locator('.favorite-btn');
    expect(await favoriteBtns.count()).toBeGreaterThan(0);
    
    console.log('✅ 完整工作流测试通过');
  });
});
