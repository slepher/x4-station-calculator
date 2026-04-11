import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('Task 5: 劳动力加成选项位置调整和UI优化测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用首页
    await page.goto('/x4-station-calculator/');
    
    // 等待应用加载完成
    await page.waitForSelector('.module-list-container', { timeout: 10000 });

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
    
    // 添加一个模块，以便生成自动工业区和补给区
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('clay');
    
    // 等待搜索结果
    await page.waitForTimeout(200);
    
    // 点击搜索结果中的第一个模块
    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    
    // 等待模块添加完成
    await page.waitForTimeout(500);
  });

  test('考虑工人效率加成选项应该显示在自动工业区标题栏', async ({ page }) => {
    // 等待自动工业区生成
    const industryHeader = page.locator('.tier-section.tier-auto .tier-header').first();
    await expect(industryHeader).toBeVisible();
    
    // 检查考虑工人效率加成选项是否在标题栏内
    const workforceOption = industryHeader.locator('.workforce-option');
    await expect(workforceOption).toBeVisible();
    
    // 检查选项包含图标 (Unicode emoji may vary in representation, using part of text)
    const optionIcon = workforceOption.locator('.option-icon');
    await expect(optionIcon).toBeVisible();
    const iconText = await optionIcon.textContent();
    expect(iconText).toContain('👥');
  });

  test('考虑工人效率加成选项应该显示在自动补给区标题栏', async ({ page }) => {
    // 确认工业区效率选项已勾选，以便生成自动补给区
    const industryCheckbox = page.locator('.workforce-option input[type="checkbox"]').first();
    const isChecked = await industryCheckbox.isChecked();
    if (!isChecked) {
      await industryCheckbox.click();
    }
    
    // 等待自动补给区生成 (nth(1) refers to Supply tier)
    const supplyHeader = page.locator('.tier-section.tier-auto .tier-header').nth(1);
    await expect(supplyHeader).toBeVisible();
    
    // 检查考虑工人效率加成选项是否在标题栏内
    const supplyWorkforceOption = supplyHeader.locator('.supply-workforce-option');
    await expect(supplyWorkforceOption).toBeVisible();
    
    // 检查选项包含图标
    const optionIcon = supplyWorkforceOption.locator('.option-icon');
    await expect(optionIcon).toBeVisible();
    const iconText = await optionIcon.textContent();
    expect(iconText).toContain('👥');
  });

  test('考虑工人效率加成选项应该具有tooltip功能', async ({ page }) => {
    // 检查工业区考虑工人效率加成选项的tooltip
    const industryOption = page.locator('.workforce-option').first();
    const industryTitle = await industryOption.getAttribute('title');
    expect(industryTitle).toBeTruthy();
    
    // 勾选以生成补给区
    const industryCheckbox = page.locator('.workforce-option input[type="checkbox"]').first();
    if (!await industryCheckbox.isChecked()) {
      await industryCheckbox.click();
    }

    // 检查补给区考虑工人效率加成选项的tooltip
    const supplyOption = page.locator('.supply-workforce-option').first();
    await expect(supplyOption).toBeVisible();
    const supplyTitle = await supplyOption.getAttribute('title');
    expect(supplyTitle).toBeTruthy();
  });

  test('点击复选框不应该触发标题栏折叠', async ({ page }) => {
    // 勾选以生成补给区
    const industryCheckbox = page.locator('.workforce-option input[type="checkbox"]').first();
    if (!await industryCheckbox.isChecked()) {
      await industryCheckbox.click();
    }
    
    const supplyHeader = page.locator('.tier-section.tier-auto .tier-header').nth(1);
    await expect(supplyHeader).toBeVisible();
    
    // 获取初始的折叠状态 (class name usually contains active/collapsed)
    const initialClass = await supplyHeader.getAttribute('class');
    
    // 点击复选框 (use the label or the checkbox itself)
    const checkbox = supplyHeader.locator('input[type="checkbox"]').first();
    await checkbox.click();
    
    // 等待点击完成
    await page.waitForTimeout(300);
    
    // 检查折叠状态没有改变 (class should remain the same)
    const finalClass = await supplyHeader.getAttribute('class');
    expect(finalClass).toBe(initialClass);
  });

  test('选项布局应该正确对齐', async ({ page }) => {
    const industryHeader = page.locator('.tier-section.tier-auto .tier-header').first();
    await expect(industryHeader).toBeVisible();
    
    // 检查容器高度
    const industryHeight = await industryHeader.evaluate(el => el.clientHeight);
    expect(industryHeight).toBeGreaterThan(20);
    expect(industryHeight).toBeLessThan(40);
    
    // 检查选项在容器内正确对齐
    const workforceOption = industryHeader.locator('.workforce-option');
    await expect(workforceOption).toBeVisible();
    
    const optionRect = await workforceOption.boundingBox();
    const containerRect = await industryHeader.boundingBox();
    
    expect(optionRect).not.toBeNull();
    expect(containerRect).not.toBeNull();

    if (optionRect && containerRect) {
      expect(optionRect.x).toBeGreaterThan(containerRect.x);
      expect(optionRect.y).toBeGreaterThan(containerRect.y);
      expect(optionRect.y + optionRect.height).toBeLessThan(containerRect.y + containerRect.height + 5); // Allow small margin
    }
  });
});
