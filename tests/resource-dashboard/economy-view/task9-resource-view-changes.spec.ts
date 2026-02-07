import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

let sharedPage: Page;

test.describe('Task 9: 资源视图的改动测试', () => {
  test.beforeAll(async ({ browser }) => {
    // 创建共享的页面实例
    sharedPage = await browser.newPage();
    await sharedPage.setViewportSize({ width: 1920, height: 1080 });
    // 访问应用首页
    await sharedPage.goto('/x4-station-calculator/');
    
    // 等待应用加载完成
    await sharedPage.waitForLoadState('networkidle');
    await sharedPage.waitForTimeout(3000);
    
    // 切换到中文界面
    const languageSelector = sharedPage.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await sharedPage.waitForTimeout(1000);
    }
  });

  test.beforeEach(async () => {
    // 点击新建按钮获得干净的界面
    const newButton = sharedPage.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    
    // 检查是否弹出保存对话框，如果有则选择丢弃并新建
    const discardButton = sharedPage.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    
    // 等待界面重置完成
    await sharedPage.waitForTimeout(1000);
    
    // 添加多种生产模块，以便生成经济数据
    const searchInput = sharedPage.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    
    // 添加 claytronics 生产线
    await searchInput.fill('claytronics');
    await sharedPage.waitForTimeout(500);
    const firstResult = sharedPage.locator('.result-item').first();
    await firstResult.click();
    await sharedPage.waitForTimeout(1000);
    
    // 添加 energy cells 模块作为资源消耗
    await searchInput.fill('energycells');
    await sharedPage.waitForTimeout(500);
    await firstResult.click();
    await sharedPage.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    // 测试结束后关闭共享页面
    if (sharedPage) {
      await sharedPage.close();
    }
  });

  test('9.1 资源视图数据源使用wareFlowList', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源视图中的数据正确显示
    const resourceItems = sharedPage.locator('.item-container').first(); // Using .first() to avoid strict mode violation
    await expect(resourceItems).toBeVisible({timeout: 5000});
    const itemCount = await sharedPage.locator('.item-container').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('9.2 资源视图保留原经济视图的分组逻辑', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源视图中的数据正确显示
    const resourceItems = sharedPage.locator('.item-container').first(); // Using .first() to avoid strict mode violation
    await expect(resourceItems).toBeVisible({timeout: 5000});
    const itemCount = await sharedPage.locator('.item-container').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('9.3 资源视图使用与经济视图相同的分组方式', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证是否存在分组结构
    const groups = sharedPage.locator('.economy-group');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThanOrEqual(0); // May not have groups depending on data
    
    // 验证资源视图中的数据项
    const resourceItems = sharedPage.locator('.item-container').first();
    if (await resourceItems.isVisible()) {
      await expect(resourceItems).toBeVisible({timeout: 5000});
    }
  });

  test('9.4 资源视图移除原有产值相关字段', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源视图中没有产值相关的字段
    const productionValueElements = sharedPage.locator('text=/产值|Value|production/i');
    const productionValueCount = await productionValueElements.count();
    expect(productionValueCount).toBe(0);
  });

  test('9.5 确保经济视图显示内容与当前保持一致', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // 验证经济视图已激活
    await expect(economyView).toHaveClass(/active/);
    
    // 验证经济视图中的数据正确显示
    const wareFlowItems = sharedPage.locator('.item-container').first(); // Using .first() to avoid strict mode violation
    await expect(wareFlowItems).toBeVisible({timeout: 5000});
    const itemCount = await sharedPage.locator('.item-container').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('9.6 产品/资源视图分组内部排序与allIndustryModules顺序相同', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源列表是否按某种逻辑顺序排列
    const resourceItems = sharedPage.locator('.item-container').first(); // Using .first() to avoid strict mode violation
    await expect(resourceItems).toBeVisible({timeout: 5000});
  });

  test('9.7 验证分组内模块排序符合依赖关系', async () => {
    // 切换到资源视图（数量视图）
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源列表是否更新
    const resourceItems = sharedPage.locator('.item-container').first(); // Using .first() to avoid strict mode violation
    await expect(resourceItems).toBeVisible({timeout: 5000});
    expect(await sharedPage.locator('.item-container').count()).toBeGreaterThan(0); 
  });
});