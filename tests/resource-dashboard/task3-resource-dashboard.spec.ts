import { expect } from '@playwright/test';
import { test } from '../test-setup';

test.describe('Task 3: 统一资源仪表盘和视图模式切换测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    // 访问应用首页
    await page.goto('/x4-station-calculator/');
    
    // 等待应用加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
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
    
    // 等待界面重置完成
    await page.waitForTimeout(500);
    
    // 添加一个生产模块，以便生成资源数据
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('claytronics');
    
    // 等待搜索结果
    await page.waitForTimeout(200);
    
    // 点击搜索结果中的第一个模块
    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    
    // 等待模块添加完成
    await page.waitForTimeout(200);
  });

  test('3.1 视图模式切换功能测试', async ({ page }) => {
    // 查找资源仪表盘组件
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 验证三个视图模式切换按钮的文本和提示信息
    const quantityView = dashboard.locator('.view-mode-btn').nth(0);
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    const economyView = dashboard.locator('.view-mode-btn').nth(2);
    
    await expect(quantityView).toBeVisible();
    await expect(volumeView).toBeVisible();
    await expect(economyView).toBeVisible();
    
    // 验证按钮内容（使用翻译后的文本）
    await expect(quantityView).toHaveText('数量视图');
    await expect(volumeView).toHaveText('体积视图');
    await expect(economyView).toHaveText('经济视图');
    
    // 验证默认显示数量视图
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证标题显示"资源产出概览"
    const title = dashboard.locator('.header-title');
    await expect(title).toContainText(/资源产出概览|Resource Production Overview/);
    
    // 切换到经济视图
    await economyView.click();
    
    // 验证经济视图激活
    await expect(economyView).toHaveClass(/active/);
    await expect(quantityView).not.toHaveClass(/active/);
    
    // 验证标题更新为"经济分析"
    await expect(title).toContainText(/经济分析|Economic Overview/);
    
    // 切换回数量视图
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);
    await expect(title).toContainText(/资源产出概览|Resource Production Overview/);
  });

  test('3.2 利润分析集成测试', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(2);
    await economyView.click();
    
    // 验证经济分析表格存在
    const economyTable = page.locator('.economy-table-container');
    await expect(economyTable).toBeVisible();
    
    // 验证包含核心列：Ware, Hourly Profit, Min Investment 等
    const headers = economyTable.locator('th');
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toContain('资源');
    expect(headerTexts).some(text => text.includes('每小时利润'));
  });

  test('3.3 资源列表功能测试', async ({ page }) => {
    // 验证资源列表项存在
    const flowItems = page.locator('.flow-wrapper');
    const count = await flowItems.count();
    expect(count).toBeGreaterThan(0);
    
    // 验证第一个资源项包含必要信息
    const firstItem = flowItems.first();
    await expect(firstItem.locator('.ware-name')).toBeVisible();
    await expect(firstItem.locator('.net-rate')).toBeVisible();
  });

  test('3.4 界面布局和交互测试', async ({ page }) => {
    // 验证搜索框功能
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible();
    
    // 验证模块列表容器
    const moduleList = page.locator('.module-list-container');
    await expect(moduleList).toBeVisible();
  });

  test('3.5 国际化支持测试', async ({ page }) => {
    const languageSelector = page.locator('select').first();
    
    // 切换到英文
    await languageSelector.selectOption('en-US');
    await page.waitForTimeout(500);
    
    const dashboard = page.locator('.list-wrapper').first();
    const title = dashboard.locator('.header-title');
    await expect(title).toContainText(/Resource Production Overview/);
    
    // 切换回中文
    await languageSelector.selectOption('zh-CN');
    await page.waitForTimeout(500);
    await expect(title).toContainText(/资源产出概览/);
  });

  test('3.6 经济视图数据展示测试', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(2);
    await economyView.click();
    
    // 验证利润数据不为零（因为添加了模块）
    const profitCells = page.locator('.profit-cell');
    if (await profitCells.count() > 0) {
      const profitText = await profitCells.first().textContent();
      expect(profitText).not.toBe('0');
    }
  });

  test('3.8 体积分析功能测试', async ({ page }) => {
    // 切换到体积视图
    const dashboard = page.locator('.list-wrapper').first();
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    
    // 验证体积分析容器存在
    const volumeContainer = page.locator('.volume-analysis-container');
    await expect(volumeContainer).toBeVisible();
  });
});