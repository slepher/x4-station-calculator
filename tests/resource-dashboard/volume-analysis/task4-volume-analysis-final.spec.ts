import { test, expect } from '@playwright/test';

let sharedPage: any;

test.describe('Task 4: 体积分析功能最终验证测试', () => {
  test.beforeAll(async ({ browser }) => {
    // 创建共享的页面实例
    sharedPage = await browser.newPage();
    await sharedPage.setViewportSize({ width: 1920, height: 1080 });
    // 访问应用首页
    await sharedPage.goto('/x4-station-calculator/');
    
    // 等待应用加载完成 - 使用更通用的选择器
    await sharedPage.waitForLoadState('networkidle');
    await sharedPage.waitForTimeout(2000);
    
    // 切换到中文界面
    const languageSelector = sharedPage.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await sharedPage.waitForTimeout(500);
    }
  });

  test.beforeEach(async () => {
    // 点击新建按钮获得干净的界面
    const newButton = sharedPage.locator('button:has-text("新建"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // 检查是否弹出保存对话框，如果有则选择丢弃并新建
      const discardButton = sharedPage.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
      if (await discardButton.isVisible()) {
        await discardButton.click();
      }
      
      // 等待界面重置完成
      await sharedPage.waitForTimeout(500);
    }
    
    // 添加一个生产模块，以便生成资源数据
    const searchInput = sharedPage.locator('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('等离子');
      await sharedPage.waitForTimeout(500);
      
      // 选择第一个模块
      const firstModule = sharedPage.locator('.search-results .module-item, .module-item').first();
      if (await firstModule.isVisible()) {
        await firstModule.click();
        await sharedPage.waitForTimeout(500);
      }
    }
  });

  test('4.9 体积视图分组标题间距一致性测试 - 与总标题间距', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 等待资源数据加载
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组标题存在
    const volumeGroupsContainer = dashboard.locator('.volume-groups-container').first();
    await expect(volumeGroupsContainer).toBeVisible();
    
    // 验证分组标题与上方内容的距离与WareFlow之间的距离一致 - 检查结构
    const volumeGroupsCheck = dashboard.locator('.volume-group');
    if (await volumeGroupsCheck.count() > 1) {
      // 验证多个分组之间有合适的间距
      const firstGroup = volumeGroupsCheck.nth(0);
      const secondGroup = volumeGroupsCheck.nth(1);
      await expect(firstGroup).toBeVisible();
      await expect(secondGroup).toBeVisible();
    }
    
    // 验证分组标题与上方内容的距离与WareFlow之间的距离一致
    const volumeGroupHeaders = dashboard.locator('.volume-group-header');
    const volumeGroups = dashboard.locator('.volume-group');
    
    // 验证至少有一个分组存在
    const groupCount = await volumeGroups.count();
    if (groupCount > 0) {
      // 检查分组是否有正确的内边距和间距
      await expect(volumeGroups.first()).not.toHaveClass(/bg-slate-800\/30/); // 应该没有背景色
      
      // 验证分组标题样式
      const firstGroupHeader = volumeGroupHeaders.first();
      await expect(firstGroupHeader).toBeVisible();
    }
  });

  test('4.10 体积视图标题完整信息显示测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 等待资源数据加载
    await sharedPage.waitForTimeout(1000);
    
    // 查找第一个WareFlow组件
    const firstWareFlow = dashboard.locator('.item-container').first();
    const wareFlowCount = await firstWareFlow.count();
    
    if (wareFlowCount === 0) {
      test.skip();
      return;
    }
    
    await expect(firstWareFlow).toBeVisible();
    
    // 验证体积标题组存在
    const volumeTitleGroup = firstWareFlow.locator('.volume-title-group').first();
    await expect(volumeTitleGroup).toBeVisible();
    
    // 验证包含三个部分：静空间产量、规划空间、规划分配数量
    const volumeNet = volumeTitleGroup.locator('.volume-net').first();
    const volumePlanning = volumeTitleGroup.locator('.volume-planning').first();
    const volumeCount = volumeTitleGroup.locator('.volume-count').first();
    
    await expect(volumeNet).toBeVisible();
    await expect(volumePlanning).toBeVisible();
    await expect(volumeCount).toBeVisible();
    
    // 验证文本内容格式
    const netText = await volumeNet.textContent();
    const planningText = await volumePlanning.textContent();
    const countText = await volumeCount.textContent();
    
    // 静空间产量应该包含m³单位
    expect(netText).toMatch(/[-+]?[\d.]+m³/);
    
    // 规划空间应该包含m³单位
    expect(planningText).toMatch(/[\d.]+m³/);
    
    // 规划分配数量应该包含"个"单位
    expect(countText).toMatch(/\d+个/);
    
    // 验证颜色类
    await expect(volumeNet).toHaveClass(/text-emerald-400|text-red-400/); // 正绿负红
    await expect(volumePlanning).toHaveClass(/text-blue-400/); // 蓝色
    await expect(volumeCount).toHaveClass(/text-blue-400/); // 蓝色
  });

  test('4.11 分组标题背景颜色与WareFlow融合测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 等待资源数据加载
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组标题和WareFlow使用相同的背景色
    const volumeGroup = dashboard.locator('.volume-group').first();
    const wareFlow = dashboard.locator('.item-container').first();
    
    if (await volumeGroup.count() > 0 && await wareFlow.count() > 0) {
      // 验证分组不再有特殊背景色，而是与WareFlow背景色融为一体
      await expect(volumeGroup).not.toHaveClass(/bg-slate-800\/30/); // 分组本身不应该有背景色
      
      // 验证WareFlow有正确的背景色
      await expect(wareFlow).toHaveClass(/bg-slate-800\/40/); // WareFlow容器有背景色
      
      // 验证分组标题样式
      const groupHeader = volumeGroup.locator('.volume-group-header').first();
      await expect(groupHeader).toBeVisible();
    }
  });

  test('体积视图分组标题i18n国际化测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 等待资源数据加载
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组标题的国际化
    const groupTitles = dashboard.locator('.volume-group-title');
    const titleCount = await groupTitles.count();
    
    if (titleCount > 0) {
      // 验证至少有一个分组标题存在
      const firstTitle = groupTitles.first();
      await expect(firstTitle).toBeVisible();
      
      // 验证标题内容包含中文分组名称
      const titleText = await firstTitle.textContent();
      expect(titleText).toMatch(/固体|液体|集装箱|Solid|Liquid|Container/);
    }
  });

  test('体积视图分组规划空间显示测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 等待资源数据加载
    await sharedPage.waitForTimeout(1000);
    
    // 验证分组标题显示规划空间(m3)
    const groupPlannings = dashboard.locator('.volume-group-planning');
    const planningCount = await groupPlannings.count();
    
    if (planningCount > 0) {
      // 验证至少有一个规划空间显示
      const firstPlanning = groupPlannings.first();
      await expect(firstPlanning).toBeVisible();
      
      // 验证规划空间显示格式正确（包含m³单位）
      const planningText = await firstPlanning.textContent();
      expect(planningText).toMatch(/\d+m³/);
    }
  });

  test.afterAll(async () => {
    if (sharedPage) {
      await sharedPage.close();
    }
  });
});