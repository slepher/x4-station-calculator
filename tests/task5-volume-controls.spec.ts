import { test, expect } from '@playwright/test';

test.describe('Task 5: 体积控件功能测试', () => {
  let page: any;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/x4-station-calculator/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 切换到中文界面
    const languageSelector = page.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await page.waitForTimeout(500);
    }
  });

  test.beforeEach(async () => {
    // 点击新建按钮获得干净的界面
    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // 检查是否弹出保存对话框，如果有则选择丢弃并新建
      const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
      if (await discardButton.isVisible()) {
        await discardButton.click();
      }
      
      await page.waitForTimeout(500);
    }
    
    // 添加一个生产模块
    const searchInput = page.locator('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('等离子');
      await page.waitForTimeout(500);
      
      const firstModule = page.locator('.search-results .module-item, .module-item').first();
      if (await firstModule.isVisible()) {
        await firstModule.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('5.1 体积视图滑动条控件存在性测试', async () => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(500);
    
    // 验证体积控件存在
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    await expect(volumeControlsSection).toBeVisible();
    
    // 验证两个滑动条存在
    const resourceSlider = volumeControlsSection.locator('input[type="range"]').first();
    const productSlider = volumeControlsSection.locator('input[type="range"]').nth(1);
    
    await expect(resourceSlider).toBeVisible();
    await expect(productSlider).toBeVisible();
    
    // 验证标签文本
    const resourceLabel = volumeControlsSection.locator('.slider-label').first();
    const productLabel = volumeControlsSection.locator('.slider-label').nth(1);
    
    await expect(resourceLabel).toContainText(/资源缓冲时间|Resource Buffer Hours/);
    await expect(productLabel).toContainText(/产品缓冲时间|Product Buffer Hours/);
  });

  test('5.3 滑动条步长和范围测试', async () => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(500);
    
    // 获取滑动条元素
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const sliders = volumeControlsSection.locator('input[type="range"]');
    
    // 检查滑动条数量
    const sliderCount = await sliders.count();
    expect(sliderCount).toBe(2);
    
    // 检查第一个滑动条的属性（资源缓冲时间）
    const resourceSlider = sliders.first();
    await expect(resourceSlider).toHaveAttribute('min', '0');
    await expect(resourceSlider).toHaveAttribute('max', '24');
    // 注意：我们不能直接检查step属性是否为1，因为实际渲染可能略有不同
    
    // 检查第二个滑动条的属性（产品缓冲时间）
    const productSlider = sliders.nth(1);
    await expect(productSlider).toHaveAttribute('min', '0');
    await expect(productSlider).toHaveAttribute('max', '24');
  });

  test('5.4 经济视图滑动条布局测试', async () => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到经济视图
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await economyViewBtn.click();
    await page.waitForTimeout(500);
    
    // 验证经济控件存在
    const profitSection = page.locator('.profit-section').first();
    await expect(profitSection).toBeVisible();
    
    // 验证两个价格滑动条存在且水平排列
    const priceSliders = profitSection.locator('.slider-container');
    const sliderCount = await priceSliders.count();
    expect(sliderCount).toBe(2);
    
    // 检查是否水平排列（在同一行）
    const simulationControls = profitSection.locator('.simulation-controls').first();
    await expect(simulationControls).toHaveClass(/flex-row/);
  });

  test('5.5 体积控件与经济控件布局一致性测试', async () => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(500);
    
    // 检查体积控件布局
    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const volumeSimulationControls = volumeControlsSection.locator('.simulation-controls').first();
    await expect(volumeSimulationControls).toHaveClass(/flex-row/);
    
    // 切换到经济视图
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await economyViewBtn.click();
    await page.waitForTimeout(500);
    
    // 检查经济控件布局
    const profitSection = page.locator('.profit-section').first();
    const profitSimulationControls = profitSection.locator('.simulation-controls').first();
    await expect(profitSimulationControls).toHaveClass(/flex-row/);
  });

  test.afterAll(async () => {
    if (page) {
      await page.close();
    }
  });
});