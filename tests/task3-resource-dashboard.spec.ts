import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

let sharedPage: Page;

test.describe('Task 3: 统一资源仪表盘和视图模式切换测试', () => {
  test.beforeAll(async ({ browser }) => {
    // 创建共享的页面实例
    sharedPage = await browser.newPage();
    await sharedPage.setViewportSize({ width: 1920, height: 1080 });
    // 访问应用首页
    await sharedPage.goto('/x4-station-calculator/');
    
    // 等待应用加载完成
    await sharedPage.waitForSelector('.module-list-container', { timeout: 10000 });
    
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
    await newButton.click();
    
    // 检查是否弹出保存对话框，如果有则选择丢弃并新建
    const discardButton = sharedPage.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    
    // 等待界面重置完成
    await sharedPage.waitForTimeout(500);
    
    // 添加一个生产模块，以便生成资源数据
    const searchInput = sharedPage.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('claytronics');
    
    // 等待搜索结果
    await sharedPage.waitForTimeout(200);
    
    // 点击搜索结果中的第一个模块
    const firstResult = sharedPage.locator('.result-item').first();
    await firstResult.click();
    
    // 等待模块添加完成
    await sharedPage.waitForTimeout(200);
  });

  test.afterAll(async () => {
    // 测试结束后关闭共享页面
    if (sharedPage) {
      await sharedPage.close();
    }
  });

  test('3.1 视图模式切换功能测试', async () => {
    // 查找资源仪表盘组件
    const dashboard = sharedPage.locator('.list-wrapper').first();
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
    
    // 验证体积视图按钮禁用状态
    await expect(volumeView).toBeDisabled();
    
    // 切换回数量视图
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);
    await expect(title).toContainText(/资源产出概览|Resource Production Overview/);
  });

  test('3.2 利润分析集成测试', async () => {
    // 切换到经济视图
    const dashboard = sharedPage.locator('.list-wrapper').first();
    const economyView = dashboard.locator('.view-mode-btn').nth(2);
    await economyView.click();
    
    // 验证利润分析部分显示
    const profitSection = dashboard.locator('.profit-section');
    await expect(profitSection).toBeVisible();
    
    // 验证价格滑块存在
    const buySlider = dashboard.locator('text=/原材料价格|Resource Price/').first();
    const sellSlider = dashboard.locator('text=/产品价格|Product Price/').first();
    await expect(buySlider).toBeVisible();
    await expect(sellSlider).toBeVisible();
    
    // 验证利润数据显示
    const profitDetails = dashboard.locator('.profit-details');
    await expect(profitDetails).toBeVisible();
    
    // 验证收入、支出、总利润显示
    const productionLabel = dashboard.locator('text=/总产值|Production/');
    const expensesLabel = dashboard.locator('text=/运营支出|Expenses/');
    const profitLabel = dashboard.locator('text=/预计每小时利润|Profit/');
    
    await expect(productionLabel).toBeVisible();
    await expect(expensesLabel).toBeVisible();
    await expect(profitLabel).toBeVisible();
    
    // 验证数值格式（应该包含数字和货币单位）
    const profitValue = dashboard.locator('.profit-value').last();
    const profitText = await profitValue.textContent();
    expect(profitText).toMatch(/[0-9,]+\s*Cr/);
  });

  test('3.3 资源列表功能测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 验证资源列表显示
    const resourceList = dashboard.locator('.list-body');
    await expect(resourceList).toBeVisible();
    
    // 验证资源项存在（实际可能有多个资源项）
    const resourceItems = dashboard.locator('.item-container');
    await expect(resourceItems).not.toHaveCount(0); // 至少有一个资源项
    
    // 验证资源名称显示
    const resourceName = resourceItems.first().locator('.name');
    await expect(resourceName).toBeVisible();
    
    // 验证数值显示
    const resourceValue = resourceItems.first().locator('.value');
    await expect(resourceValue).toBeVisible();
    
    // 验证锁定按钮存在
    const lockButton = resourceItems.first().locator('.lock-btn');
    await expect(lockButton).toBeVisible();
    
    // 测试资源项展开功能（尝试不同的点击策略）
    const mainRow = resourceItems.first().locator('.main-row');
    
    // 方法1：先hover再点击
    await mainRow.hover();
    await sharedPage.waitForTimeout(500);
    
    // 方法2：使用更精确的点击位置
    const box = await mainRow.boundingBox();
    if (box) {
      await sharedPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await mainRow.click({ force: true });
    }
    
    await sharedPage.waitForTimeout(1000);
    
    // 检查点击后的状态
    console.log('点击后main-row类名:', await mainRow.getAttribute('class'));
    
    // 验证明细列表显示（增加超时时间）
    const detailList = resourceItems.first().locator('.list-box');
    await expect(detailList).toBeVisible({ timeout: 2000 });
    
    // 测试锁定功能
    await lockButton.click();
    await expect(lockButton).toHaveClass(/is-locked/);
    
    // 再次点击解锁
    await lockButton.click();
    await expect(lockButton).not.toHaveClass(/is-locked/);
  });

  test('3.4 界面布局和交互测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 验证三区间布局
    const header = dashboard.locator('.list-header');
    await expect(header).toBeVisible();
    
    const titleSection = header.locator('.header-title');
    const rightGroup = header.locator('.header-right-group');
    const viewSwitcher = header.locator('.view-mode-switcher');
    const badge = header.locator('.header-badge');
    
    await expect(titleSection).toBeVisible();
    await expect(rightGroup).toBeVisible();
    await expect(viewSwitcher).toBeVisible();
    await expect(badge).toBeVisible();
    
    // 验证按钮样式
    const quantityButton = viewSwitcher.locator('.view-mode-btn').nth(0);
    await expect(quantityButton).toHaveCSS('background-color', /rgba\(245, 158, 11|rgb\(245, 158, 11\)/); // 琥珀色
    
    // 验证按钮悬停效果
    await quantityButton.hover();
    await sharedPage.waitForTimeout(200);
    
    // 验证按钮文本内容
    await expect(quantityButton).toHaveText('数量视图');

    const volumeButton = viewSwitcher.locator('.view-mode-btn').nth(1);
    await expect(volumeButton).toHaveText('体积视图');
    
    const economyButton = viewSwitcher.locator('.view-mode-btn').nth(2);
    await expect(economyButton).toHaveText('经济视图');
    
    for (let i = 0; i < 5; i++) {
      await quantityButton.click();
      await sharedPage.waitForTimeout(100);
      await economyButton.click();
      await sharedPage.waitForTimeout(100);
    }
    
    // 验证最终状态正确
    await expect(economyButton).toHaveClass(/active/);
    await expect(quantityButton).not.toHaveClass(/active/);
  });

  test('3.5 国际化支持测试', async () => {
    // 查找语言选择器
    const languageSelector = sharedPage.locator('select').first();
    
    if (await languageSelector.isVisible()) {
      const dashboard = sharedPage.locator('.list-wrapper').first();
      
      // 验证当前是中文界面
      const title = dashboard.locator('.header-title');
      await expect(title).toContainText('资源产出概览');
      
      const badge = dashboard.locator('.header-badge');
      await expect(badge).toContainText('每小时流量');
      
      // 验证中文按钮提示信息
      const quantityView = dashboard.locator('.view-mode-btn').nth(0);
      const volumeView = dashboard.locator('.view-mode-btn').nth(1);
      const economyView = dashboard.locator('.view-mode-btn').nth(2);
      
      await expect(quantityView).toHaveText('数量视图');
      await expect(volumeView).toHaveText('体积视图');
      await expect(economyView).toHaveText('经济视图');
      
      // 切换到英文
      await languageSelector.selectOption('en');
      await sharedPage.waitForTimeout(500);
      
      // 验证英文标题
      await expect(title).toContainText('Resource Production Overview');
      
      // 验证英文标签
      await expect(badge).toContainText('Hourly Rate');
      
      // 验证英文按钮文本内容
      await expect(quantityView).toHaveText('Quantity View');
      await expect(volumeView).toHaveText('Volume View');
      await expect(economyView).toHaveText('Economy View');
      
      // 切换回中文
      await languageSelector.selectOption('zh-CN');
      await sharedPage.waitForTimeout(500);
      
      // 验证中文标题
      await expect(title).toContainText('资源产出概览');
      await expect(badge).toContainText('每小时流量');
      
      // 验证中文按钮文本内容
      await expect(quantityView).toHaveText('数量视图');
      await expect(volumeView).toHaveText('体积视图');
      await expect(economyView).toHaveText('经济视图');
    }
  });

  test('3.6 经济视图数据展示测试', async () => {
    const dashboard = sharedPage.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到经济视图
    const economyView = dashboard.locator('.view-mode-btn').nth(2);
    await economyView.click();
    await sharedPage.waitForTimeout(500);
    
    // 验证经济视图标题
    const title = dashboard.locator('.header-title');
    await expect(title).toContainText(/经济分析|Economic Overview/);
    
    // 验证资源项显示经济数据（净价值而不是净产量）
    const resourceItems = dashboard.locator('.item-container');
    await expect(resourceItems).not.toHaveCount(0);
    
    // 验证第一个资源项显示净价值数据
    const firstItem = resourceItems.first();
    const valueDisplay = firstItem.locator('.value');
    await expect(valueDisplay).toBeVisible();
    
    // 验证显示的是货币单位（CREDITS）而不是产量单位
    const valueText = await valueDisplay.textContent();
    expect(valueText).toMatch(/[+-]?\d+/); // 应该显示正负数字
    
    // 验证展开后显示产出消耗明细
    const mainRow = firstItem.locator('.main-row');
    await mainRow.evaluate((node) => {
      node.click();
    });
    await sharedPage.waitForTimeout(500);
    
    const detailList = firstItem.locator('.list-box');
    await expect(detailList).toBeVisible();
    
    // 验证明细项显示经济数据
    const detailItems = detailList.locator('.list-item');
    await expect(detailItems).not.toHaveCount(0);
  });

  test('3.7 空状态测试', async () => {
    // 创建一个空的测试环境
    const newButton = sharedPage.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    
    const discardButton = sharedPage.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    
    await sharedPage.waitForTimeout(500);
    
    const dashboard = sharedPage.locator('.list-wrapper').first();
    
    // 验证空状态显示
    const emptyContainer = dashboard.locator('.empty-container');
    await expect(emptyContainer).toBeVisible();
    
    const emptyText = emptyContainer.locator('.empty-main-text');
    await expect(emptyText).toContainText(/暂无活跃生产周期|No active production/);
    
    const hintText = emptyContainer.locator('.empty-sub-text');
    await expect(hintText).toContainText(/请添加生产模块以查看数据|Add modules to view data/);
  });
});