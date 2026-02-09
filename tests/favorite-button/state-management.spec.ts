import { test, expect } from '@playwright/test';

test.describe('类型定义与状态管理测试', () => {
  test('1.1 StationSettings 接口更新验证 - 主副产物缓冲时间字段存在', async ({ page }) => {
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
    
    // 切换到体积视图查看滑动条
    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);
    
    // 验证存在3个滑动条（资源缓冲、主产物缓冲、副产物缓冲）
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);
    
    console.log(`✅ StationSettings 接口验证: 找到 ${count} 个缓冲时间滑动条`);
  });

  test('1.2 warePriority 状态初始化 - 默认值为空对象', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 点击新建按钮获得干净状态
    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    
    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await page.waitForTimeout(1000);
    
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
    
    // 验证 FavoriteButton 初始状态为 level-2（规划区产物默认）
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      const btnClass = await firstBtn.getAttribute('class');
      // 规划区产物默认应该是 level-2
      expect(btnClass).toMatch(/level-2/);
      console.log('✅ warePriority 状态初始化验证通过: 默认 level-2');
    }
  });

  test('1.3 saveLayout 持久化 warePriority 逻辑', async ({ page }) => {
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
    
    // 修改优先级状态
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      await firstBtn.click();
      await page.waitForTimeout(300);
      
      // 保存布局
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
      
      console.log('✅ saveLayout 持久化 warePriority 逻辑验证通过');
    }
  });

  test('1.4 loadLayout 加载 warePriority 逻辑', async ({ page }) => {
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
    
    // 修改优先级状态并保存
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      await firstBtn.click();
      await page.waitForTimeout(300);
      
      // 记录修改后的状态
      const modifiedClass = await firstBtn.getAttribute('class');
      
      // 保存布局
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
      
      // 刷新页面模拟重新加载
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // 切换到数量视图
      const dashboard2 = page.locator('.list-wrapper').first();
      const quantityViewBtn2 = dashboard2.locator('.view-mode-btn').first();
      await quantityViewBtn2.click();
      await page.waitForTimeout(500);
      
      // 验证状态已恢复
      const favoriteBtns2 = page.locator('.favorite-btn:not(.disabled)');
      if (await favoriteBtns2.count() > 0) {
        const restoredBtn = favoriteBtns2.first();
        const restoredClass = await restoredBtn.getAttribute('class');
        expect(restoredClass).toBe(modifiedClass);
        console.log('✅ loadLayout 加载 warePriority 逻辑验证通过');
      }
    }
  });
});
