import { test, expect } from '@playwright/test';

test.describe('Task 6: 仓储规划数据显示测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/x4-station-calculator/');
    await page.waitForLoadState('networkidle');
    
    // 切换到中文界面
    const languageSelector = page.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await page.waitForTimeout(500);
    }

    // 点击新建按钮获得干净的界面
    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    
    // 检查是否弹出保存对话框，如果有则选择丢弃并新建
    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    
    await page.waitForTimeout(500);
    
    // 添加一个生产模块
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('能量');
    await page.waitForTimeout(500);
    
    const firstModule = page.locator('.result-item, .module-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);
  });

  test('6.1 验证体积视图显示仓储规划主数据', async ({ page }) => {
    // 切换到体积视图 (Use title or index)
    const volumeViewBtn = page.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeViewBtn.click();
    
    // 检查是否有显示规划数量的元素 (.volume-count-main)
    const volumeCountMain = page.locator('.volume-count-main').first();
    await expect(volumeCountMain).toBeVisible();
    
    const countText = await volumeCountMain.textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(0);
  });

  test('6.2 验证体积视图 Tooltip 包含详细规划数据', async ({ page }) => {
    // 切换到体积视图
    const volumeViewBtn = page.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeViewBtn.click();
    
    // Hover 触发 tooltip
    const volumeTrigger = page.locator('.volume-trigger-container').first();
    await volumeTrigger.hover();
    
    // 等待 tooltip 出现
    const tooltip = page.locator('.tippy-box');
    await expect(tooltip).toBeVisible();
    
    // 检查 tooltip 内部的网格布局和数据
    const tooltipGrid = tooltip.locator('.volume-tooltip-grid');
    await expect(tooltipGrid).toBeVisible();
    
    // 检查特定的标签
    await expect(tooltipGrid).toContainText(/吞吐容量|Net Volume/);
    await expect(tooltipGrid).toContainText(/占用容量|Planned Volume/);
    await expect(tooltipGrid).toContainText(/规划数量|Planned Slots/);
  });

  test('6.3 验证仓储规划数据受体积控件影响', async ({ page }) => {
    // 切换到体积视图
    const volumeViewBtn = page.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeViewBtn.click();
    
    const volumeCountMain = page.locator('.volume-count-main').first();
    const initialCount = await volumeCountMain.textContent();
    
    // 查找滑动条
    const sliders = page.locator('.volume-controls-section input[type="range"]');
    await expect(sliders).toHaveCount(3); // 应该有3个滑动条 (Resource, Primary, Secondary)
    
    const firstSlider = sliders.first();
    
    // 增加缓冲时间
    for (let i = 0; i < 10; i++) {
        await firstSlider.focus();
        await page.keyboard.press('ArrowRight');
    }
    
    await page.waitForTimeout(500);
    
    const updatedCount = await volumeCountMain.textContent();
    // 增加缓冲时间应该导致规划槽位增加或保持不变
    expect(Number(updatedCount)).toBeGreaterThanOrEqual(Number(initialCount));
  });
});
