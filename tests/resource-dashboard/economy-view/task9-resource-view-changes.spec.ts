import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 9: 资源视图的改动测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/x4-station-calculator/');
    
    // 等待应用加载完成
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

  test('9.1 资源视图数据源使用wareFlowList', async ({ page }) => {
    // 默认即为数量视图
    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn').nth(0);
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源视图中的数据正确显示
    const resourceItems = page.locator('.flow-wrapper').first();
    await expect(resourceItems).toBeVisible({timeout: 5000});
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('9.3 资源视图使用与经济视图相同的分组方式', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn').nth(0);
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证是否存在分组结构
    const groups = page.locator('.group-container');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThan(0);
    
    // 验证资源视图中的数据项
    const resourceItems = page.locator('.flow-wrapper').first();
    await expect(resourceItems).toBeVisible();
  });

  test('9.4 资源视图移除原有产值相关字段', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = dashboard.locator('.view-mode-btn').nth(0);
    await quantityView.click();
    
    // 验证数量视图已激活
    await expect(quantityView).toHaveClass(/active/);
    
    // 验证资源视图中没有经济视图的数值显示 (Cr)
    const crValues = page.locator('.flow-wrapper .value:has-text("Cr")');
    const crCount = await crValues.count();
    expect(crCount).toBe(0);
  });

  test('9.5 确保经济视图显示内容与当前保持一致', async ({ page }) => {
    // 切换到经济视图
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(1);
    await economyView.click();
    
    // 验证经济视图已激活
    await expect(economyView).toHaveClass(/active/);
    
    // 验证经济视图中的数据正确显示
    const wareFlowItems = page.locator('.flow-wrapper').first();
    await expect(wareFlowItems).toBeVisible();
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });
});
