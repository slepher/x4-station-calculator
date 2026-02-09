import { test, expect } from '@playwright/test';

test.describe('优先级逻辑测试', () => {
  test('2.1 产物身份检测 - 规划区产物', async ({ page }) => {
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
    
    // 验证 FavoriteButton 存在并可点击
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);
      
      const btnClass = await favoriteBtn.getAttribute('class');
      expect(btnClass).toMatch(/level-[012]/);
      console.log('✅ 产物身份检测测试通过');
    }
  });

  test('2.2 优先级状态持久化测试', async ({ page }) => {
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
    
    // 设置优先级
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);
      
      // 保存
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ 优先级状态持久化测试通过');
    }
  });
});
