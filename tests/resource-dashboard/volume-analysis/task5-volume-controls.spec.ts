import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 5: 体积控件功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/x4-station-calculator/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // 切换到中文界面
    const languageSelector = page.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await page.waitForLoadState('networkidle');
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
    await searchInput.fill('claytronics');
    await page.waitForTimeout(200);
    
    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    await page.waitForTimeout(200);
  });

  test('5.1 体积视图滑动条控件存在性测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图 (Quantity: 0, Economy: 1, Volume: 2)
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();
    
    // 验证体积控件存在
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    await expect(volumeControlsSection).toBeVisible();
    
    // 验证滑动条存在
    const sliders = volumeControlsSection.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBeGreaterThanOrEqual(2);
    
    // 验证标签文本
    const sectionText = await volumeControlsSection.textContent();
    expect(sectionText).toMatch(/资源缓冲时间|Resource Buffer Hours/);
    expect(sectionText).toMatch(/主产物缓冲时间|Primary Product Buffer Hours/);
  });

  test('5.3 滑动条步长和范围测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();
    
    // 获取滑动条元素
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const sliders = volumeControlsSection.locator('input[type="range"]');
    
    // 检查滑动条数量 (现在有 3 个: 资源, 主产物, 副产物)
    const sliderCount = await sliders.count();
    expect(sliderCount).toBe(3);
    
    // 检查第一个滑动条的属性（资源缓冲时间）
    const resourceSlider = sliders.first();
    await expect(resourceSlider).toHaveAttribute('min', '0');
    await expect(resourceSlider).toHaveAttribute('max', '24');
  });

  test('5.4 经济视图滑动条布局测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到经济视图
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await economyViewBtn.click();
    
    // 验证经济控件存在
    const profitSection = page.locator('.profit-section').first();
    await expect(profitSection).toBeVisible();
    
    // 验证价格滑动条存在
    const priceSliders = profitSection.locator('.slider-container');
    const sliderCount = await priceSliders.count();
    expect(sliderCount).toBe(2);
    
    // 检查是否水平排列
    const simulationControls = profitSection.locator('.simulation-controls').first();
    await expect(simulationControls).toHaveClass(/flex-row/);
  });

  test('5.5 体积控件与经济控件布局一致性测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();
    
    // 检查体积控件布局
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const volumeSimulationControls = volumeControlsSection.locator('.simulation-controls').first();
    await expect(volumeSimulationControls).toHaveClass(/flex-row/);
    
    // 切换到经济视图
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await economyViewBtn.click();
    
    // 检查经济控件布局
    const profitSection = page.locator('.profit-section').first();
    const profitSimulationControls = profitSection.locator('.simulation-controls').first();
    await expect(profitSimulationControls).toHaveClass(/flex-row/);
  });
});
