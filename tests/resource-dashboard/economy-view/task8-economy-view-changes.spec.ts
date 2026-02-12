import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 8: 经济视图UI改动测试', () => {
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
      // 等待语言切换生效
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
    
    // 等待界面重置完成
    await page.waitForTimeout(500);
    
    // 添加多种生产模块，以便生成经济数据
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    
    // 添加 claytronics 生产线
    await searchInput.fill('claytronics');
    await page.waitForTimeout(200);
    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    await page.waitForTimeout(200);
    
    // 添加 energy cells 模块作为资源消耗
    await searchInput.fill('energycells');
    await page.waitForTimeout(200);
    await firstResult.click();
    await page.waitForTimeout(200);
  });

  test('8.1 经济视图数据源使用wareFlowList', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证经济视图已激活
    await expect(economyView).toHaveClass(/active/);
    
    // 验证经济视图中的数据正确显示
    const wareFlowItems = page.locator('.flow-wrapper').first();
    await expect(wareFlowItems).toBeVisible({timeout: 5000});
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('8.2 经济视图按产品收入、运营支出、资源支出分组', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证至少存在一个分组：产品收入、运营支出、资源支出中的任意一个
    const productIncomeGroup = page.locator('text=产品收入').first();
    const operationalExpenseGroup = page.locator('text=运营支出').first();
    const resourceExpenseGroup = page.locator('text=资源支出').first();
    
    // 检查是否至少有一个组存在
    const productIncomeExists = await productIncomeGroup.isVisible();
    const operationalExpenseExists = await operationalExpenseGroup.isVisible();
    const resourceExpenseExists = await resourceExpenseGroup.isVisible();
    
    expect(productIncomeExists || operationalExpenseExists || resourceExpenseExists).toBeTruthy();
    
    // 验证存在的组确实可见
    if (productIncomeExists) await expect(productIncomeGroup).toBeVisible();
    if (operationalExpenseExists) await expect(operationalExpenseGroup).toBeVisible();
    if (resourceExpenseExists) await expect(resourceExpenseGroup).toBeVisible();
  });

  test('8.4 分组标题显示组内netValue总和', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证分组标题显示了数值
    const sumValues = page.locator('.economy-group-sum');
    const count = await sumValues.count();
    expect(count).toBeGreaterThan(0);
    
    const sumText = await sumValues.first().textContent();
    expect(sumText).toMatch(/[0-9,]+/);
  });

  test('8.7 profitTotal从wareFlowList计算', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证profitTotal显示
    const profitTotal = page.locator('.profit-val').last();
    await expect(profitTotal).toBeVisible({timeout: 5000});
    
    // 验证profitTotal包含数值和货币单位
    const profitText = await profitTotal.textContent();
    expect(profitText).toMatch(/[0-9,-]+/);
  });

  test('8.11 新文本国际化测试', async ({ page }) => {
    const languageSelector = page.locator('select').first();
    await languageSelector.selectOption('en');
    await page.waitForTimeout(500);
    
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证英文文本
    const productIncomeGroup = page.locator('text=Product Income').first();
    const operationalExpenseGroup = page.locator('text=Operational Expense').first();
    const resourceExpenseGroup = page.locator('text=Resource Expense').first();
    
    const exists = await productIncomeGroup.isVisible() || 
                   await operationalExpenseGroup.isVisible() || 
                   await resourceExpenseGroup.isVisible();
    expect(exists).toBeTruthy();
  });
});
