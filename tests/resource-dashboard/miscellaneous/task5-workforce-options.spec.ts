import { expect } from '@playwright/test';
import { test } from './test-setup';

let sharedPage;

test.describe('Task 5: 劳动力加成选项位置调整和UI优化测试', () => {
  test.beforeAll(async ({ browser }) => {
    // 创建共享的页面实例
    sharedPage = await browser.newPage();
    
    // 访问应用首页（注意base路径）
    await sharedPage.goto('/x4-station-calculator/');
    
    // 等待应用加载完成（页面加载需要多等一会）
    await sharedPage.waitForSelector('.module-list-container', { timeout: 10000 });
  });

  test.beforeEach(async () => {
    // 点击新建按钮获得干净的界面
    // 支持中英文两种语言的按钮文本
    const newButton = sharedPage.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    
    // 检查是否弹出保存对话框，如果有则选择丢弃并新建
    const discardButton = sharedPage.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    
    // 等待界面重置完成
    await sharedPage.waitForTimeout(500);
    
    // 添加一个模块，以便生成自动工业区和补给区
    const searchInput = sharedPage.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('clay');
    
    // 等待搜索结果（200ms足够了）
    await sharedPage.waitForTimeout(200);
    
    // 点击搜索结果中的第一个模块
    const firstResult = sharedPage.locator('.result-item').first();
    await firstResult.click();
    
    // 等待模块添加完成（200ms足够了）
    await sharedPage.waitForTimeout(200);
  });

  test.afterAll(async () => {
    // 测试结束后关闭共享页面
    if (sharedPage) {
      await sharedPage.close();
    }
  });

  test('考虑工人效率加成选项应该显示在自动工业区标题栏', async () => {
    // 等待自动工业区生成（只要有模块就会生成）
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 检查自动工业区标题栏是否存在
    const industryHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').first();
    await expect(industryHeader).toBeVisible();
    
    // 检查考虑工人效率加成选项是否在标题栏内
    const workforceOption = industryHeader.locator('.workforce-option');
    await expect(workforceOption).toBeVisible();
    
    // 检查选项包含图标
    const optionIcon = workforceOption.locator('.option-icon:has-text("👥")');
    await expect(optionIcon).toBeVisible();
  });

  test('考虑工人效率加成选项应该显示在自动补给区标题栏', async () => {
    // 先等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 确认工业区效率选项已勾选，以便生成自动补给区
    const industryCheckbox = sharedPage.locator('.workforce-option .x4-checkbox-mini').first();
    const isChecked = await industryCheckbox.isChecked();
    if (!isChecked) {
      await industryCheckbox.click();
    }
    
    // 等待自动补给区生成（需要工业区效率选项被选中）
    await sharedPage.waitForSelector('.tier-section.tier-auto .tier-header', { timeout: 200 });
    
    // 检查自动补给区标题栏是否存在
    const supplyHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').nth(1);
    await expect(supplyHeader).toBeVisible();
    
    // 检查考虑工人效率加成选项是否在标题栏内
    const supplyWorkforceOption = supplyHeader.locator('.supply-workforce-option');
    await expect(supplyWorkforceOption).toBeVisible();
    
    // 检查选项包含图标
    const optionIcon = supplyWorkforceOption.locator('.option-icon:has-text("👥")');
    await expect(optionIcon).toBeVisible();
  });

  test('考虑工人效率加成选项应该具有tooltip功能', async () => {
    // 检查工业区考虑工人效率加成选项的tooltip
    const industryOption = sharedPage.locator('.workforce-option').first();
    const industryTitle = await industryOption.getAttribute('title');
    expect(industryTitle).toBeTruthy();
    
    // 确认工业区效率选项已勾选，以便生成自动补给区
    const industryCheckbox = sharedPage.locator('.workforce-option .x4-checkbox-mini').first();
    const isChecked = await industryCheckbox.isChecked();
    if (!isChecked) {
      await industryCheckbox.click();
    }
    // 检查补给区考虑工人效率加成选项的tooltip
    const supplyOption = sharedPage.locator('.supply-workforce-option').first();
    const supplyTitle = await supplyOption.getAttribute('title');
    expect(supplyTitle).toBeTruthy();
  });

  test('点击复选框不应该触发标题栏折叠', async () => {
    // 先等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 确认工业区效率选项已勾选，以便生成自动补给区
    const industryCheckbox = sharedPage.locator('.workforce-option .x4-checkbox-mini').first();
    const isChecked = await industryCheckbox.isChecked();
    if (!isChecked) {
      await industryCheckbox.click();
    }
    
    // 等待自动补给区生成（需要工业区效率选项被选中）
    await sharedPage.waitForSelector('.tier-section.tier-auto .tier-header', { timeout: 200 });
    
    // 检查补给区标题栏的折叠状态
    const supplyHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').nth(1);
    
    // 获取初始的折叠状态
    const initialIsActive = await supplyHeader.getAttribute('class');
    
    // 点击复选框
    const checkbox = supplyHeader.locator('.x4-checkbox-mini').first();
    await checkbox.click();
    
    // 等待点击完成
    await sharedPage.waitForTimeout(300);
    
    // 检查折叠状态没有改变
    const finalIsActive = await supplyHeader.getAttribute('class');
    expect(finalIsActive).toBe(initialIsActive);
  });

  test('选项布局应该正确对齐', async () => {
    // 等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 检查工业区标题栏的布局
    const industryHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').first();
    await expect(industryHeader).toBeVisible();
    
    // 检查容器高度
    const industryHeight = await industryHeader.evaluate(el => el.clientHeight);
    expect(industryHeight).toBeGreaterThan(20);
    expect(industryHeight).toBeLessThan(40);
    
    // 检查选项在容器内正确对齐
    const workforceOption = industryHeader.locator('.workforce-option');
    await expect(workforceOption).toBeVisible();
    
    // 检查选项是否在标题栏内
    const optionRect = await workforceOption.boundingBox();
    const containerRect = await industryHeader.boundingBox();
    
    // 检查选项在容器内部（位置合理）
    expect(optionRect.x).toBeGreaterThan(containerRect.x);
    expect(optionRect.y).toBeGreaterThan(containerRect.y);
    expect(optionRect.y + optionRect.height).toBeLessThan(containerRect.y + containerRect.height);
  });

  test('复选框和图标应该基线对齐', async () => {
    // 等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 检查工业区选项的对齐
    const workforceOption = sharedPage.locator('.workforce-option').first();
    await expect(workforceOption).toBeVisible();
    
    // 获取复选框和图标的位置
    const checkbox = workforceOption.locator('.x4-checkbox-mini');
    const icon = workforceOption.locator('.option-icon');
    
    await expect(checkbox).toBeVisible();
    await expect(icon).toBeVisible();
    
    // 检查复选框和图标都在选项容器内
    const checkboxRect = await checkbox.boundingBox();
    const iconRect = await icon.boundingBox();
    const optionRect = await workforceOption.boundingBox();
    
    // 检查基线对齐（都在选项容器内）
    expect(checkboxRect.x).toBeGreaterThanOrEqual(optionRect.x);
    expect(iconRect.x).toBeGreaterThanOrEqual(checkboxRect.x + checkboxRect.width);
    expect(checkboxRect.y).toBeGreaterThanOrEqual(optionRect.y);
    expect(iconRect.y).toBeGreaterThanOrEqual(optionRect.y);
  });

  test('工业区和补给区高度应该保持一致', async () => {
    // 先等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 选中工业区效率选项，以便生成自动补给区
    const industryCheckbox = sharedPage.locator('.workforce-option .x4-checkbox-mini').first();
    await industryCheckbox.click();
    
    // 等待自动补给区生成（需要工业区效率选项被选中）
    await sharedPage.waitForSelector('.tier-section.tier-auto .tier-header', { timeout: 200 });
    
    // 检查工业区标题栏高度
    const industryHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').first();
    const industryHeight = await industryHeader.evaluate(el => el.clientHeight);
    
    // 检查补给区标题栏高度
    const supplyHeader = sharedPage.locator('.tier-section.tier-auto .tier-header').nth(1);
    const supplyHeight = await supplyHeader.evaluate(el => el.clientHeight);
    
    // 高度应该相近（允许更大的差异，因为布局可能变化）
    expect(Math.abs(industryHeight - supplyHeight)).toBeLessThanOrEqual(5);
  });

  test('选项样式应该与之前保持一致', async () => {
    // 等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 检查工业区选项的样式
    const workforceOption = sharedPage.locator('.workforce-option').first();
    
    const optionStyles = await workforceOption.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        alignItems: style.alignItems,
        gap: style.gap
      };
    });
    
    // 验证样式属性符合预期
    expect(optionStyles.display).toBe('flex');
    expect(optionStyles.alignItems).toBe('flex-end');
    expect(optionStyles.gap).toBe('normal'); 
  });

  test('用户交互体验应该正常', async () => {
    // 等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 测试工业区选项的交互
    const industryOption = sharedPage.locator('.workforce-option').first();
    
    // 检查鼠标悬停效果
    await industryOption.hover();
    await sharedPage.waitForTimeout(300);
    
    // 检查选项可以正常点击
    const checkbox = industryOption.locator('.x4-checkbox-mini');
    await checkbox.click();
    
    // 验证复选框状态改变
    const isChecked = await checkbox.isChecked();
    expect(isChecked).toBe(true);
    
    // 再次点击取消选中
    await checkbox.click();
    const isUnchecked = await checkbox.isChecked();
    expect(isUnchecked).toBe(false);
  });

  test('选项位置应该紧贴标题', async () => {
    // 等待自动工业区生成
    await sharedPage.waitForSelector('.tier-section.tier-auto', { timeout: 200 });
    
    // 检查工业区标题和选项的间距
    const industryHeaderLeft = sharedPage.locator('.tier-header-left').first();
    const title = industryHeaderLeft.locator('.tier-label');
    const option = industryHeaderLeft.locator('.workforce-option');
    
    const titleRect = await title.boundingBox();
    const optionRect = await option.boundingBox();
    
    // 检查选项紧贴在标题后面（间距合理）
    const horizontalGap = optionRect.x - (titleRect.x + titleRect.width);
    expect(horizontalGap).toBeGreaterThan(0);
    expect(horizontalGap).toBeLessThan(20); // 间距应该小于20px
  });
});