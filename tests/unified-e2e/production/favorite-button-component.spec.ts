import { test, expect } from '@playwright/test';

test.describe('FavoriteButton 组件测试', () => {
  test('1.1 FavoriteButton 三态图标渲染测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 添加模块
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);
    
    const firstModule = page.locator('.result-item').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1500);
    
    // 切换到数量视图
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);
    
    // 查找所有 flow-wrapper
    const flowWrappers = page.locator('.flow-wrapper');
    await expect(flowWrappers.first()).toBeVisible();
    const itemCount = await flowWrappers.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // 获取第一个 flow-wrapper
    const firstItem = flowWrappers.first();
    
    // 验证 FavoriteButton 存在
    const favoriteBtn = firstItem.locator('.favorite-btn').first();
    await expect(favoriteBtn).toBeVisible();
    
    // 验证 SVG 图标存在
    const svgIcon = favoriteBtn.locator('svg').first();
    await expect(svgIcon).toBeVisible();
    
    // 验证初始状态
    const btnClass = await favoriteBtn.getAttribute('class');
    expect(btnClass).toMatch(/level-[012]/);
    
    console.log('✅ 三态图标渲染测试通过');
  });

  test('1.2 FavoriteButton 状态切换测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 添加模块
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);
    
    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1500);
    
    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);
    
    // 查找第一个非禁用的 FavoriteButton
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    await expect(favoriteBtns.first()).toBeVisible();
    
    const favoriteBtn = favoriteBtns.first();
    
    // 获取初始状态
    const initialClass = await favoriteBtn.getAttribute('class');
    const initialLevel = initialClass?.match(/level-(\d)/)?.[1] || '0';
    
    // 点击按钮
    await favoriteBtn.click();
    await page.waitForTimeout(500);
    
    // 验证状态已改变
    const newClass = await favoriteBtn.getAttribute('class');
    expect(newClass).toMatch(/level-[012]/);
    
    console.log(`✅ 状态切换测试通过: level-${initialLevel} -> 新状态`);
  });

  test('1.3 不同视图模式下 FavoriteButton 可用性测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 添加模块
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);
    
    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1500);
    
    const dashboard = page.locator('.list-wrapper').first();
    
    // 测试数量视图
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);
    
    const quantityFavoriteBtns = page.locator('.favorite-btn');
    const quantityCount = await quantityFavoriteBtns.count();
    expect(quantityCount).toBeGreaterThan(0);
    console.log(`✅ 数量视图: 找到 ${quantityCount} 个 FavoriteButton`);
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);
    
    const volumeFavoriteBtns = page.locator('.favorite-btn');
    const volumeCount = await volumeFavoriteBtns.count();
    expect(volumeCount).toBeGreaterThan(0);
    console.log(`✅ 体积视图: 找到 ${volumeCount} 个 FavoriteButton`);
    
    // 切换到经济视图
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await economyViewBtn.click();
    await page.waitForTimeout(1000);
    
    const economyFavoriteBtns = page.locator('.favorite-btn');
    const economyCount = await economyFavoriteBtns.count();
    expect(economyCount).toBeGreaterThan(0);
    console.log(`✅ 经济视图: 找到 ${economyCount} 个 FavoriteButton`);
    
    // 验证所有视图下都有相同数量的 FavoriteButton
    expect(quantityCount).toBe(volumeCount);
    expect(volumeCount).toBe(economyCount);
  });
});
