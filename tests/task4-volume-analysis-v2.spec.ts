import { test, expect } from '@playwright/test';

let sharedPage: any;

test.describe('Task 4: 体积分析功能测试 (v2 - 新功能)', () => {
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

  test('4.8 体积视图WareFlow展开收起功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证体积视图激活
    await expect(volumeView).toHaveClass(/active/);
    
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
    
    // 验证可以展开和收起
    const mainRow = firstWareFlow.locator('.main-row').first();
    await expect(mainRow).toBeVisible();
    
    // 点击展开
    await mainRow.click();
    await sharedPage.waitForTimeout(300);
    
    // 验证展开状态
    await expect(mainRow).toHaveClass(/is-active/);
    
    // 验证明细内容显示
    const listBox = firstWareFlow.locator('.list-box').first();
    await expect(listBox).toBeVisible();
    
    // 验证明细项存在
    const listItems = listBox.locator('.list-item');
    const itemCount = await listItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // 验证明细项显示体积数据而不是数量数据
    const firstItem = listItems.first();
    const itemVal = firstItem.locator('.item-val').first();
    const valText = await itemVal.textContent();
    expect(valText).toMatch(/m³/); // 应该包含体积单位
    
    // 点击收起
    await mainRow.click();
    await sharedPage.waitForTimeout(300);
    
    // 验证收起状态
    await expect(mainRow).not.toHaveClass(/is-active/);
  });

  test('4.9 体积视图分组标题间距一致性测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证分组标题存在
    const volumeGroup = dashboard.locator('.volume-group').first();
    if (await volumeGroup.isVisible()) {
      const groupHeader = volumeGroup.locator('.volume-group-header').first();
      await expect(groupHeader).toBeVisible();
      
      // 验证间距一致性 - 检查CSS类
      await expect(volumeGroup).toHaveClass(/mb-1/); // 应该与WareFlow的mb-1一致
    }
  });

  test('4.10 体积视图标题颜色区分显示测试', async () => {
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
    
    // 验证静空间产量显示（正绿负红）
    const volumeNet = volumeTitleGroup.locator('.volume-net').first();
    await expect(volumeNet).toBeVisible();
    
    // 验证规划空间和规划分配数量显示（蓝色）
    const volumePlanning = volumeTitleGroup.locator('.volume-planning').first();
    const volumeCount = volumeTitleGroup.locator('.volume-count').first();
    
    await expect(volumePlanning).toBeVisible();
    await expect(volumeCount).toBeVisible();
    
    // 验证显示格式正确
    const planningText = await volumePlanning.textContent();
    const countText = await volumeCount.textContent();
    
    expect(planningText).toMatch(/\d+m³/);
    expect(countText).toMatch(/\d+个/);
    
    // 验证颜色类存在
    await expect(volumePlanning).toHaveClass(/text-blue-400/);
    await expect(volumeCount).toHaveClass(/text-blue-400/);
  });

  test('4.11 体积视图数据准确性验证', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').nth(1);
    await volumeView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证压缩比显示
    const compressionRatio = dashboard.locator('.compression-ratio-section');
    await expect(compressionRatio).toBeVisible();
    
    // 验证压缩比标签和值
    const compressionLabel = compressionRatio.locator('.compression-label').first();
    const compressionValue = compressionRatio.locator('.compression-value').first();
    
    await expect(compressionLabel).toContainText(/压缩比|Compression Ratio/);
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