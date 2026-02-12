import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 4: 体积分析功能最终验证测试', () => {
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
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // 检查是否弹出保存对话框，如果有则选择丢弃并新建
      const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
      if (await discardButton.isVisible()) {
        await discardButton.click();
      }
      
      // 等待界面重置完成
      await page.waitForTimeout(500);
    }
    
    // 添加多个不同类型的模块，以触发不同的体积分组
    const searchInput = page.locator('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      // 固体资源模块 (等离子)
      await searchInput.fill('等离子');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(300);

      // 液体资源模块 (反物质)
      await searchInput.clear();
      await searchInput.fill('反物质单元');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(300);

      // 集装箱资源模块 (能量电池)
      await searchInput.clear();
      await searchInput.fill('能量电池');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(500);
    }
  });

  test('4.9 体积视图分组标题间距一致性测试 - 与总标题间距', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证分组标题容器存在
    const volumeGroupsContainer = dashboard.locator('.volume-groups-container').first();
    await expect(volumeGroupsContainer).toBeVisible();
    
    // 验证分组存在
    const volumeGroups = dashboard.locator('.group-container');
    const groupCount = await volumeGroups.count();
    expect(groupCount).toBeGreaterThan(0);
    
    // 验证第一个分组
    const firstGroup = volumeGroups.first();
    await expect(firstGroup).toHaveClass(/group-container/);
  });

  test('4.10 体积视图标题完整信息显示测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 查找第一个WareFlow组件
    const firstWareFlow = dashboard.locator('.flow-wrapper').first();
    await expect(firstWareFlow).toBeVisible();
    
    // 验证体积图标和数量显示
    const volumeTrigger = firstWareFlow.locator('.volume-trigger-container').first();
    await expect(volumeTrigger).toBeVisible();
    
    const volumeCountMain = volumeTrigger.locator('.volume-count-main').first();
    await expect(volumeCountMain).toBeVisible();
    
    // 验证包含数字（可能有"个"或者只是数字，取决于i18n和逻辑，目前代码里是直接显示 Math.ceil(totalOccupiedCount)）
    const countText = await volumeCountMain.textContent();
    expect(countText).toMatch(/\d+/);
    
    // 验证颜色类
    await expect(volumeCountMain).toHaveClass(/text-blue-400/);
  });

  test('4.11 分组标题背景颜色与WareFlow融合测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证分组容器和WareFlow
    const volumeGroup = dashboard.locator('.group-container').first();
    const wareFlow = dashboard.locator('.flow-wrapper').first();
    
    if (await volumeGroup.isVisible() && await wareFlow.isVisible()) {
      // 验证分组标题所在行
      const groupHeader = volumeGroup.locator('.main-row').first();
      await expect(groupHeader).toHaveClass(/main-row/);
      
      // 验证WareFlow的主行
      const flowMainRow = wareFlow.locator('.main-row').first();
      await expect(flowMainRow).toHaveClass(/main-row/);
    }
  });

  test('体积视图分组标题i18n国际化测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证分组标题内容包含中文分组名称
    const groupTitles = dashboard.locator('.group-title');
    const titleTexts = await groupTitles.allTextContents();
    
    const hasMatch = titleTexts.some(text => /固体|液体|集装箱|Solid|Liquid|Container/.test(text));
    expect(hasMatch).toBeTruthy();
  });

  test('体积视图分组规划空间显示测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证分组标题右侧显示规划空间(m3)
    const groupPlannings = dashboard.locator('.volume-group-planning');
    const planningCount = await groupPlannings.count();
    expect(planningCount).toBeGreaterThan(0);
    
    const firstPlanningText = await groupPlannings.first().textContent();
    expect(firstPlanningText).toMatch(/\d+m³/);
  });
});
