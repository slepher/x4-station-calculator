import { expect } from '@playwright/test';
import { test } from '../../test-setup';

test.describe('StationDashboard UI and Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dashboard-container');
    
    // 切换到中文以确保初始状态一致
    const langSelect = page.locator('.toolbar-panel select').first();
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('zh-CN');
      await page.waitForTimeout(200);
    }

    // 点击新建按钮获得干净的界面
    const newButton = page.locator('.btn-tool').filter({ hasText: /新建|New/ }).first();
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // 检查是否弹出保存对话框
      const discardButton = page.locator('button').filter({ hasText: /丢弃并新建|Discard & New/ }).first();
      if (await discardButton.isVisible()) {
        await discardButton.click();
      }
      await page.waitForTimeout(200);
    }
  });

  test('Test Case 1: StationDashboard 基础渲染验证', async ({ page }) => {
    const dashboard = page.locator('.dashboard-container');
    await expect(dashboard).toBeVisible();

    // 检查主标题栏布局
    const header = page.locator('.dashboard-header');
    const title = header.locator('.header-title');
    const switcher = page.locator('.dashboard-container .view-mode-switcher');
    
    await expect(title).toBeVisible();
    await expect(switcher).toBeVisible();
    
    // 验证标题在左，按钮在右 (通过位置判断)
    const titleBox = await title.boundingBox();
    const switcherBox = await switcher.boundingBox();
    if (titleBox && switcherBox) {
      expect(titleBox.x).toBeLessThan(switcherBox.x);
    }

    // 验证标题右侧没有 [Cr]
    const unitBadge = header.locator('.unit-badge');
    await expect(unitBadge).not.toBeVisible();

    // 验证视图按钮状态
    const materialsBtn = switcher.locator('button').filter({ hasText: /成本|Cost/ });
    const timeBtn = switcher.locator('button').filter({ hasText: /时间|Time/ });
    const workersBtn = switcher.locator('button').filter({ hasText: /工人|Workers/ });

    await expect(materialsBtn).toHaveClass(/active/);
    await expect(timeBtn).not.toHaveClass(/active/);
    await expect(workersBtn).not.toHaveClass(/active/);
  });

  test('Test Case 2: 建设费用汇总逻辑验证', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item');
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    // 检查“总建设费用”
    const totalCostTitle = page.locator('.variant-summary');
    await expect(totalCostTitle).toBeVisible();
    
    const priceVal = page.locator('.item-container').filter({ has: totalCostTitle }).locator('.total-value');
    const priceText = await priceVal.innerText();
    const priceNum = parseInt(priceText.replace(/,/g, ''));
    expect(priceNum).toBeGreaterThan(0);

    // 展开并验证清单
    await totalCostTitle.click();
    const materialList = page.locator('.material-row');
    await expect(materialList.first()).toBeVisible();
    
    // 验证包含必需材料 (能量电池)
    const energyCells = materialList.filter({ hasText: /能量电池|Energy Cells/ });
    await expect(energyCells.first()).toBeVisible();
  });

  test('Test Case 3: 模块拆解分组验证', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item');
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    // 检查是否存在以“模块名 x 数量”命名的独立分组
    const moduleGroup = page.locator('.variant-module').filter({ hasText: /Silicon Wafer|硅晶片/ });
    await expect(moduleGroup).toBeVisible();
    await expect(moduleGroup).toContainText('1');

    // 验证金额非零
    const groupPrice = page.locator('.item-container').filter({ has: moduleGroup }).locator('.total-value');
    const priceText = await groupPrice.innerText();
    expect(parseInt(priceText.replace(/,/g, ''))).toBeGreaterThan(0);

    // 展开验证
    await moduleGroup.click();
    const detailItems = page.locator('.material-row');
    await expect(detailItems.first()).toBeVisible();
  });

  test('Test Case 4: 价格倍率模拟联动验证', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item');
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    const totalVal = page.locator('.item-container').filter({ has: page.locator('.variant-summary') }).locator('.total-value');
    const initialPrice = await totalVal.innerText();

    // 移动滑块
    const slider = page.locator('.custom-range').first();
    await slider.fill('1'); // 设为最大
    await page.waitForTimeout(300);

    const newPrice = await totalVal.innerText();
    expect(newPrice).not.toBe(initialPrice);
  });

  test('Test Case 6: 模块合并与排序验证', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    
    // 添加两个同样的 Silicon Wafer
    await searchInput.click();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.results-popover', { state: 'hidden' }); // 确保关闭
    
    // 再次添加一个 Silicon Wafer
    await searchInput.click();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.results-popover', { state: 'hidden' });

    const waferGroup = page.locator('.variant-module').filter({ hasText: /Silicon Wafer|硅晶片/ });
    await expect(waferGroup).toContainText('2');

    // 添加一个 Tier 更高的模块 (Claytronics Tier 4)
    await searchInput.click();
    await searchInput.fill('Claytronics Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    // 等待渲染和可能的自动填充
    await page.waitForTimeout(1000);

    const titles = page.locator('.variant-module');
    const allTitles = await titles.allInnerTexts();
    console.log('All module titles:', allTitles);

    // 验证顺序：模块应保持添加顺序 (Silicon Wafer 首先添加，应排在第一)
    await expect(titles.first()).toContainText(/Silicon Wafer|硅晶片/);
    
    const waferIdx = allTitles.findIndex(t => t.includes('Silicon Wafer') || t.includes('硅晶片'));
    const clayIdx = allTitles.findIndex(t => t.includes('Claytronics') || t.includes('电子黏土'));
    expect(waferIdx).toBeLessThan(clayIdx);
  });

  test('Test Case 7: 材料 Tier 排序验证', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.click();
    await searchInput.fill('Claytronics Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    const summary = page.locator('.variant-summary');
    await summary.click();

    // 获取所有材料名称
    const materialItems = page.locator('.material-row .name');
    const materialNames = await materialItems.allInnerTexts();
    console.log('Material names:', materialNames);

    // 简单验证顺序：通常能量电池 (Tier 0) 在最后
    expect(materialNames[materialNames.length - 1]).toMatch(/能量电池|Energy Cells/);
    
    // 验证没有未翻译的 ID 或 !!id!! 格式
    for (const name of materialNames) {
      expect(name).not.toMatch(/!!id/);
      expect(name.trim()).not.toBe('');
    }
  });

  test('Test Case 8: i18n 完整性验证', async ({ page }) => {
    // 先添加一个模块以便看到 Dashboard 内容
    const searchInput = page.locator('.search-input').first();
    await searchInput.click();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    // 验证 UI 文本
    const switcher = page.locator('.dashboard-container .view-mode-switcher');
    await expect(switcher).toContainText('Cost');
    await expect(switcher).toContainText('Time');
    await expect(switcher).toContainText('Workers');
// 验证 Summary
    const summary = page.locator('.variant-summary');
    await expect(summary).toContainText(/Total Build Cost/i);

    // 验证游戏数据 i18n
    const moduleTitle = page.locator('.variant-module').first();
    const titleText = await moduleTitle.innerText();
    expect(titleText).not.toMatch(/!!id/);
    expect(titleText).toContain('Silicon Wafer'); // 验证英文名

    // 验证没有 ui. 前缀
    await expect(page.locator('body')).not.toContainText(/ui\./);
  });

  test('Test Case 9: UI 视觉一致性验证 (StationDashboard)', async ({ page }) => {
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('Silicon Wafer Production');
    await page.waitForSelector('.results-popover .result-item');
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    // 验证颜色 (通过检查 computed style)
    const summaryContainer = page.locator('.item-container').filter({ has: page.locator('.variant-summary') });
    const totalVal = summaryContainer.locator('.total-value');
    await expect(totalVal).toBeVisible();
    
    const color = await totalVal.evaluate((el) => window.getComputedStyle(el).color);
    // red-400 is roughly rgb(248, 113, 113)
    expect(color).toMatch(/rgb\(248, 113, 113\)/);

    const moduleTitle = page.locator('.variant-module').first();
    const symbol = moduleTitle.locator('.symbol');
    await expect(symbol).toBeVisible();
    const opacity = await symbol.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(0.4);
  });
});
