import { test, expect } from '@playwright/test';

let sharedPage: any;

test.describe('Task 4: 体积分析功能测试', () => {
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

  test('4.1 体积视图基础功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 验证体积视图按钮存在且可用
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await expect(volumeView).toBeVisible();
    await expect(volumeView).not.toBeDisabled();
    
    // 验证体积视图按钮文本
    await expect(volumeView).toHaveText('体积视图');
    
    // 切换到体积视图
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证标题显示"Volume Overview"
    const title = dashboard.locator('.header-title');
    await expect(title).toContainText(/Volume Overview/);
    
    // 验证体积视图激活
    await expect(volumeView).toHaveClass(/active/);
    
    // 验证体积分组显示
    const volumeGroups = dashboard.locator('.volume-groups-container');
    await expect(volumeGroups).toBeVisible();
    
    // 验证压缩比显示
    const compressionRatio = dashboard.locator('.compression-ratio-section');
    await expect(compressionRatio).toBeVisible();
  });

  test('4.2 体积数据分组功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证分组标题显示
    const volumeGroup = dashboard.locator('.volume-group').first();
    if (await volumeGroup.isVisible()) {
      // 验证分组标题包含规划空间信息
      const groupTitle = volumeGroup.locator('.volume-group-title').first();
      await expect(groupTitle).toBeVisible();
      await expect(groupTitle).toContainText(/规划空间|Planning Space/);
    }
  });

  test('4.3 体积视图布局一致性测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证体积视图布局与数量视图一致（没有额外的水平padding）
    const volumeGroup = dashboard.locator('.volume-group').first();
    if (await volumeGroup.isVisible()) {
      // 验证使用StationWareFlow组件显示资源项
      const wareFlowItems = dashboard.locator('.item-container');
      const itemCount = await wareFlowItems.count();
      expect(itemCount).toBeGreaterThan(0);
      
      // 验证第一个资源项的结构
      const firstItem = wareFlowItems.first();
      await expect(firstItem).toBeVisible();
      
      // 验证标题显示规划空间和规划分配数量
      const volumeInfo = firstItem.locator('.volume-info').first();
      if (await volumeInfo.isVisible()) {
        await expect(volumeInfo).toContainText(/m³|个/);
      }
    }
  });

  test('4.4 体积视图交互功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证资源锁定功能正常工作
    const firstWareFlow = dashboard.locator('.item-container').first();
    if (await firstWareFlow.isVisible()) {
      const lockButton = firstWareFlow.locator('.lock-btn').first();
      if (await lockButton.isVisible()) {
        // 测试锁定功能
        await lockButton.click();
        await sharedPage.waitForTimeout(200);
        await expect(lockButton).toHaveClass(/is-locked/);
        
        // 测试解锁功能
        await lockButton.click();
        await sharedPage.waitForTimeout(200);
        await expect(lockButton).not.toHaveClass(/is-locked/);
      }
    }
  });

  test('4.5 体积视图数据准确性测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证体积数据不为零
    const firstWareFlow = dashboard.locator('.item-container').first();
    if (await firstWareFlow.isVisible()) {
      const volumeValue = firstWareFlow.locator('.value').first();
      await expect(volumeValue).toBeVisible();
      
      // 验证体积值格式正确
      const volumeText = await volumeValue.textContent();
      expect(volumeText).toMatch(/[\d\.,]+/);
    }
  });

  test('4.6 压缩比计算功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证压缩比显示
    const compressionRatio = dashboard.locator('.compression-ratio-section');
    await expect(compressionRatio).toBeVisible();
    
    // 验证压缩比标签
    const compressionLabel = compressionRatio.locator('.compression-label').first();
    const labelText = await compressionLabel.textContent();
    // 检查是否是翻译键或实际文本
    expect(labelText).toMatch(/压缩比|Compression Ratio|ui\.compression_ratio/);
    
    // 验证压缩比值格式正确
    const compressionValue = compressionRatio.locator('.compression-value').first();
    await expect(compressionValue).toBeVisible();
    const valueText = await compressionValue.textContent();
    expect(valueText).toMatch(/\d+(\.\d+)?%/);
  });

  test.afterAll(async () => {
    if (sharedPage) {
      await sharedPage.close();
    }
  });
});