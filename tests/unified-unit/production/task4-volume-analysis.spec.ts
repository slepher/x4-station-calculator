import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 4: 体积分析功能测试', () => {
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
    
    // 添加一个生产模块，以便生成资源数据
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('claytronics');
    await page.waitForTimeout(200);
    
    // 点击搜索结果中的第一个模块
    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    await page.waitForTimeout(200);
  });

  test('4.1 体积视图基础功能测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 验证体积视图按钮存在且可用 (Quantity: 0, Economy: 1, Volume: 2)
    const volumeView = dashboard.locator('.view-mode-btn').nth(2);
    await expect(volumeView).toBeVisible();
    
    // 验证体积视图按钮文本 (zh-CN: 仓储视图)
    await expect(volumeView).toHaveText(/仓储视图|Volume View/);
    
    // 切换到体积视图
    await volumeView.click();
    
    // 验证体积视图激活
    await expect(volumeView).toHaveClass(/active/);
    
    // 验证体积分组容器显示
    const volumeGroups = page.locator('.volume-groups-container');
    await expect(volumeGroups).toBeVisible();
  });

  test('4.2 体积数据分组功能测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(2);
    await volumeView.click();
    
    // 验证分组标题显示 (容器/固体/液体)
    const groupTitle = page.locator('.group-title').first();
    await expect(groupTitle).toBeVisible();
  });

  test('4.3 体积视图布局一致性测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(2);
    await volumeView.click();
    
    // 验证使用 flow-wrapper 显示资源项
    const wareFlowItems = page.locator('.flow-wrapper');
    const itemCount = await wareFlowItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // 验证数值显示 (体积视图中使用 .volume-count-main)
    const valueText = await wareFlowItems.first().locator('.volume-count-main').textContent();
    expect(valueText).toMatch(/[\d\.,]+/);
  });

  test('4.4 体积视图交互功能测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(2);
    await volumeView.click();
    
    // 验证资源锁定功能正常工作
    const firstWareFlow = page.locator('.flow-wrapper').first();
    const lockButton = firstWareFlow.locator('.lock-btn');
    
    // 测试锁定功能
    await lockButton.click();
    await expect(lockButton).toHaveClass(/is-locked/);
    
    // 测试解锁功能
    await lockButton.click();
    await expect(lockButton).not.toHaveClass(/is-locked/);
  });
});
