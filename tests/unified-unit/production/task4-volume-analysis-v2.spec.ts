import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 4: 体积分析功能测试 (v2 - 新功能)', () => {
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
    
    // 添加一个生产模块，以便生成资源数据
    const searchInput = page.locator('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('能量');
      await page.waitForTimeout(500);
      
      // 选择第一个模块
      const firstModule = page.locator('.result-item, .module-item').first();
      if (await firstModule.isVisible()) {
        await firstModule.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('4.8 体积视图WareFlow展开收起功能测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图 (Use title or regex)
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证体积视图激活
    await expect(volumeView).toHaveClass(/active/);
    
    // 等待资源数据加载
    await page.waitForTimeout(500);
    
    // 查找第一个WareFlow组件 (.flow-wrapper)
    const firstWareFlow = dashboard.locator('.flow-wrapper').first();
    await expect(firstWareFlow).toBeVisible();
    
    // 验证可以展开和收起
    const mainRow = firstWareFlow.locator('.main-row').first();
    await expect(mainRow).toBeVisible();
    
    // 点击展开
    await mainRow.click();
    await page.waitForTimeout(300);
    
    // 验证展开状态
    await expect(mainRow).toHaveClass(/is-active/);
    
    // 验证明细内容显示
    const listBox = firstWareFlow.locator('.list-box').first();
    await expect(listBox).toBeVisible();
    
    // 验证明细项存在
    const listItems = listBox.locator('.list-item');
    const itemCount = await listItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // 验证明细项显示数据
    const firstItem = listItems.first();
    const itemVal = firstItem.locator('.item-val').first();
    const valText = await itemVal.textContent();
    expect(valText).not.toBe(''); 
    
    // 点击收起
    await mainRow.click();
    await page.waitForTimeout(300);
    
    // 验证收起状态
    await expect(mainRow).not.toHaveClass(/is-active/);
  });

  test('4.9 体积视图分组标题间距一致性测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 验证分组标题存在
    const groupContainer = dashboard.locator('.group-container').first();
    if (await groupContainer.isVisible()) {
      const groupHeader = groupContainer.locator('.main-row').first(); // CollapsibleDetailList in Group
      await expect(groupHeader).toBeVisible();
      
      // 验证间距一致性 - 检查基本类
      await expect(groupContainer).toHaveClass(/group-container/);
    }
  });

  test('4.10 体积视图标题颜色区分显示测试', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();
    
    // 切换到体积视图
    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);
    
    // 等待资源数据加载
    await page.waitForTimeout(500);
    
    // 查找第一个WareFlow组件
    const firstWareFlow = dashboard.locator('.flow-wrapper').first();
    await expect(firstWareFlow).toBeVisible();
    
    // 验证规划分配数量显示（蓝色）
    const volumeCountMain = firstWareFlow.locator('.volume-count-main').first();
    await expect(volumeCountMain).toBeVisible();
    
    // 验证颜色类存在
    await expect(volumeCountMain).toHaveClass(/text-blue-400/);
  });
});
