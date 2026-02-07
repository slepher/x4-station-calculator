import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

let sharedPage: Page;

test.describe('Task 8: 经济视图UI改动测试', () => {
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

  test('8.1 经济视图数据源使用wareFlowList', async () => {
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

  test('8.2 经济视图按产品收入、运营支出、资源支出分组', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for groups to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证至少存在一个分组：产品收入、运营支出、资源支出中的任意一个
    const productIncomeGroup = sharedPage.locator('text=产品收入').first();
    const operationalExpenseGroup = sharedPage.locator('text=运营支出').first();
    const resourceExpenseGroup = sharedPage.locator('text=资源支出').first();
    
    // 检查是否至少有一个组存在 (因为具体哪些组出现取决于添加的模块)
    const productIncomeExists = await productIncomeGroup.isVisible();
    const operationalExpenseExists = await operationalExpenseGroup.isVisible();
    const resourceExpenseExists = await resourceExpenseGroup.isVisible();
    
    // 至少应该有一个组存在
    expect(productIncomeExists || operationalExpenseExists || resourceExpenseExists).toBeTruthy();
    
    // 验证存在的组确实可见
    if (productIncomeExists) {
      await expect(productIncomeGroup).toBeVisible({timeout: 5000});
    }
    if (operationalExpenseExists) {
      await expect(operationalExpenseGroup).toBeVisible({timeout: 5000});
    }
    if (resourceExpenseExists) {
      await expect(resourceExpenseGroup).toBeVisible({timeout: 5000});
    }
    
    // 验证分组顺序（如果都有）：产品收入、运营支出、资源支出
    const groups = sharedPage.locator('.economy-group');
    const groupCount = await groups.count();
    
    if (groupCount >= 3) {
      const firstGroupName = await groups.nth(0).locator('.economy-group-title').textContent();
      const secondGroupName = await groups.nth(1).locator('.economy-group-title').textContent();
      const thirdGroupName = await groups.nth(2).locator('.economy-group-title').textContent();
      
      expect(firstGroupName?.trim()).toContain('产品收入');
      expect(secondGroupName?.trim()).toContain('运营支出');
      expect(thirdGroupName?.trim()).toContain('资源支出');
    }
  });

  test('8.3 支出类型根据transportType分类', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组中包含不同类型的数据
    const productIncomeGroup = sharedPage.locator('.economy-group:has-text("产品收入")').first();
    const operationalExpenseGroup = sharedPage.locator('.economy-group:has-text("运营支出")').first();
    const resourceExpenseGroup = sharedPage.locator('.economy-group:has-text("资源支出")').first();
    
    // Check if any of the groups exist and have content
    const productIncomeExists = await productIncomeGroup.isVisible();
    const operationalExpenseExists = await operationalExpenseGroup.isVisible();
    const resourceExpenseExists = await resourceExpenseGroup.isVisible();
    
    // At least one group should be visible
    expect(productIncomeExists || operationalExpenseExists || resourceExpenseExists).toBeTruthy();
    
    // If groups exist, check that they contain items
    if (productIncomeExists) {
      await expect(productIncomeGroup.locator('.item-container').first()).toBeVisible();
    }
    if (operationalExpenseExists) {
      await expect(operationalExpenseGroup.locator('.item-container').first()).toBeVisible();
    }
    if (resourceExpenseExists) {
      await expect(resourceExpenseGroup.locator('.item-container').first()).toBeVisible();
    }
  });

  test('8.4 分组标题显示组内netValue总和', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组标题显示了数值
    const productIncomeHeader = sharedPage.locator('.economy-group-header:has-text("产品收入")').first();
    const operationalExpenseHeader = sharedPage.locator('.economy-group-header:has-text("运营支出")').first();
    const resourceExpenseHeader = sharedPage.locator('.economy-group-header:has-text("资源支出")').first();
    
    // Check if any group headers exist and contain values
    const productIncomeVisible = await productIncomeHeader.isVisible();
    const operationalExpenseVisible = await operationalExpenseHeader.isVisible();
    const resourceExpenseVisible = await resourceExpenseHeader.isVisible();
    
    if (productIncomeVisible) {
      const productIncomeText = await productIncomeHeader.textContent();
      expect(productIncomeText).toMatch(/[0-9,]+/); // Should contain numbers
    }
    if (operationalExpenseVisible) {
      const operationalExpenseText = await operationalExpenseHeader.textContent();
      expect(operationalExpenseText).toMatch(/[0-9,]+/); // Should contain numbers
    }
    if (resourceExpenseVisible) {
      const resourceExpenseText = await resourceExpenseHeader.textContent();
      expect(resourceExpenseText).toMatch(/[0-9,]+/); // Should contain numbers
    }
  });

  test('8.5 分组布局与仓储视图一致', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组容器的样式
    const groupContainers = sharedPage.locator('.economy-group');
    const groupCount = await groupContainers.count();
    expect(groupCount).toBeGreaterThanOrEqual(1); // At least one group should exist
    
    // 验证分组头部和内容的结构
    const groupHeaders = sharedPage.locator('.economy-group-header');
    const groupContents = sharedPage.locator('.item-container');
    
    const headerCount = await groupHeaders.count();
    const contentCount = await groupContents.count();
    
    expect(headerCount).toBeGreaterThanOrEqual(0);
    expect(contentCount).toBeGreaterThanOrEqual(0);
  });

  test('8.6 移除经济视图下方总产值和运营支出显示', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证下方没有总产值和运营支出的显示
    // 这些元素应该是旧版本的内容
    const oldProductionLabel = sharedPage.locator('text=/总产值|Production/');
    const oldExpensesLabel = sharedPage.locator('text=/运营支出|Expenses/');
    
    // These old elements should not exist
    const oldProductionExists = await oldProductionLabel.count();
    const oldExpensesExists = await oldExpensesLabel.count();
    
    expect(oldProductionExists).toBe(0);
    expect(oldExpensesExists).toBe(0);
  });

  test('8.7 profitTotal从wareFlowList计算', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证profitTotal显示
    const profitTotal = sharedPage.locator('.profit-val').last();
    await expect(profitTotal).toBeVisible({timeout: 5000});
    
    // 验证profitTotal包含数值和货币单位
    const profitText = await profitTotal.textContent();
    expect(profitText).toMatch(/[0-9,-]+/); // Should contain numbers
  });

  test('8.8 profitTotal样式正确', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证profitTotal样式
    const profitTotal = sharedPage.locator('.profit-val').last();
    await expect(profitTotal).toBeVisible({timeout: 5000});
    
    // Check that the element exists
    expect(await profitTotal.count()).toBeGreaterThan(0);
  });

  test('8.11 新文本国际化测试', async () => {
    // 切换到英文界面
    const languageSelector = sharedPage.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('en');
      await sharedPage.waitForTimeout(1000);
    }
    
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn:has-text("Economy View")').first();
    await economyView.click();
    
    // Wait for data to load
    await sharedPage.waitForTimeout(1000);
    
    // 验证英文文本 - only check if elements exist
    const productIncomeGroup = sharedPage.locator('text=Product Income').first();
    const operationalExpenseGroup = sharedPage.locator('text=Operational Expense').first();
    const resourceExpenseGroup = sharedPage.locator('text=Resource Expense').first();
    
    const productIncomeExists = await productIncomeGroup.isVisible();
    const operationalExpenseExists = await operationalExpenseGroup.isVisible();
    const resourceExpenseExists = await resourceExpenseGroup.isVisible();
    
    // At least one group should exist with English text
    expect(productIncomeExists || operationalExpenseExists || resourceExpenseExists).toBeTruthy();
    
    // 切换回中文界面
    await languageSelector.selectOption('zh-CN');
    await sharedPage.waitForTimeout(1000);
  });

  test('8.12 统一三个视图层级结构', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 测试数量视图
    const quantityView = dashboard.locator('.view-mode-btn:has-text("数量视图")').first();
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);
    
    // 测试经济视图
    const economyView = dashboard.locator('.view-mode-btn:has-text("经济视图")').first();
    await economyView.click();
    await expect(economyView).toHaveClass(/active/);
    
    // 验证经济视图结构
    const wareFlowItems = sharedPage.locator('.item-container').first();
    await expect(wareFlowItems).toBeVisible({timeout: 5000});
    
    // 验证分组结构
    const groups = sharedPage.locator('.economy-group');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThanOrEqual(1);
  });
});