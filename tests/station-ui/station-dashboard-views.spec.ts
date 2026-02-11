import { expect } from '@playwright/test';
import { test } from '../test-setup';

test.describe('StationDashboard Views and Logic', () => {
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

  async function addModule(page: any, name: string) {
    const searchInput = page.locator('.search-input').first();
    await searchInput.click();
    await searchInput.fill(name);
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.results-popover', { state: 'hidden' });
  }

  test('Test 1: Stats Bar 准确性验证', async ({ page }) => {
    // 添加一个有工人需求和容量的组合
    await addModule(page, 'hab_arg_l_01_macro');
    await addModule(page, 'prod_gen_energycells_macro');
    
    // 1. 价格联动
    const totalPriceLoc = page.locator('.stat-item').filter({ hasText: '建设总成本' }).locator('.stat-value');
    await expect(totalPriceLoc).toBeVisible({ timeout: 10000 });
    const initialPrice = await totalPriceLoc.innerText();
    
    const slider = page.locator('.custom-range').first();
    await slider.fill('1'); // 设为最大 (150%)
    await page.waitForTimeout(500);
    const maxPrice = await totalPriceLoc.innerText();
    expect(maxPrice).not.toBe(initialPrice);

    // 1.1 总需求验证
    const totalNeededLoc = page.locator('.stat-item').filter({ hasText: '工人需求' }).locator('.stat-value');
    await expect(totalNeededLoc).toBeVisible();
    const neededText = await totalNeededLoc.innerText();
    expect(parseInt(neededText.replace(/,/g, ''))).toBeGreaterThan(0);
    
    // 2. 时间验证
    const totalTimeLoc = page.locator('.stat-item').filter({ hasText: '建造总用时' }).locator('.stat-value');
    const timeText = await totalTimeLoc.innerText();
    expect(timeText).toMatch(/\d{2}:\d{2}:\d{2}/);

    // 3. 效率验证
    // 切换到工人视图
    await page.locator('.view-mode-btn').filter({ hasText: '工人' }).click();
    
    const efficiencyLoc = page.locator('.stat-item').filter({ hasText: '工人效率' }).locator('.stat-value');
    
    // 调整劳动力滑动条
    // 先关闭自动计算以启用滑动条
    const autoCalcLabel = page.locator('.dashboard-footer .auto-toggle');
    await autoCalcLabel.click();
    await page.waitForTimeout(300);

    const workforceSlider = page.locator('.dashboard-footer .range-slider').first();
    // 设为 0%
    await workforceSlider.evaluate((el: HTMLInputElement) => {
      el.value = '0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    expect(await efficiencyLoc.innerText()).toBe('0%');

    // 设为 100%
    await workforceSlider.evaluate((el: HTMLInputElement) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    expect(await efficiencyLoc.innerText()).toBe('100%');
  });

  test('Test 2: 工人视图专项测试', async ({ page }) => {
    // 使用 PHQ 联动测试
    // 切换到工人视图
    await page.locator('.view-mode-btn').filter({ hasText: '工人' }).click();
    
    // 1. 控制面板可见性
    const footer = page.locator('.dashboard-footer');
    await expect(footer.locator('.range-slider')).toBeVisible();
    
    // 2. PHQ 联动
    const phqCheckbox = page.locator('.dashboard-footer label').filter({ hasText: '包含总部' }).locator('input');
    await phqCheckbox.check();
    await page.waitForTimeout(300);

    // 展开劳动力平衡明细 (使用 variant-summary 寻找)
    const summaryHeader = page.locator('.variant-summary');
    await expect(summaryHeader).toBeVisible({ timeout: 10000 });
    await summaryHeader.click();
    await page.waitForTimeout(500);

    // 检查 PHQ 的 200 人需求 (使用游戏文本 {20102,2011} -> 总部)
    await expect(page.locator('.material-row').filter({ hasText: '总部' }).locator('..').locator('.material-value')).toContainText('200');

    // 3. 展开颜色验证
    const phqRow = page.locator('.material-row').filter({ hasText: '总部' });
    const phqNeed = phqRow.locator('..').locator('.material-value');
    await expect(phqNeed).toHaveClass(/text-red-500/);
  });

  test('Test 3: 时间视图专项测试', async ({ page }) => {
    // 添加很多模块以增加时间
    for(let i=0; i<3; i++) {
        await addModule(page, 'prod_gen_claytronics_macro');
    }
    
    // 切换到时间视图
    await page.locator('.view-mode-btn').filter({ hasText: '时间' }).click();
    
    // 1. 格式化验证
    const totalTimeLoc = page.locator('.stat-item').filter({ hasText: '建造总用时' }).locator('.stat-value');
    const timeText = await totalTimeLoc.innerText();
    
    // 验证 XD HH:MM:SS 或 HH:MM:SS 格式
    expect(timeText).toMatch(/(\d+D\s)?\d{2}:\d{2}:\d{2}/);

    // 2. 展开逻辑
    const moduleRow = page.locator('.variant-module').first();
    await moduleRow.click();
    const buildTimeRow = page.locator('.material-row').filter({ hasText: '建造时间' });
    await expect(buildTimeRow).toBeVisible();
  });

  test('Test 4 & 5: 数据源一致性及劳动力管理集成验证', async ({ page }) => {
    await addModule(page, 'hab_arg_l_01_macro');
    await addModule(page, 'prod_gen_siliconwafers_macro');
    
    // 切换到工人视图
    await page.locator('.view-mode-btn').filter({ hasText: '工人' }).click();
    
    // 先关闭自动计算以启用滑动条
    const autoCalcLabel = page.locator('.dashboard-footer .auto-toggle');
    await autoCalcLabel.click();
    await page.waitForTimeout(300);

    // 验证滑动条联动 Stats Bar
    const workforceSlider = page.locator('.dashboard-footer .range-slider').first();
    const efficiencyLoc = page.locator('.stat-item').filter({ hasText: '工人效率' }).locator('.stat-value');
    
    await workforceSlider.evaluate((el: HTMLInputElement) => {
      el.value = '10';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const lowEffText = await efficiencyLoc.innerText();
    const lowEff = parseFloat(lowEffText);
    
    await workforceSlider.evaluate((el: HTMLInputElement) => {
      el.value = '80';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const highEffText = await efficiencyLoc.innerText();
    const highEff = parseFloat(highEffText);
    
    expect(highEff).toBeGreaterThan(lowEff);
  });

  test('Test 6: 英文模式下的 i18n 验证', async ({ page }) => {
    // 切换到英文
    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    await addModule(page, 'hab_arg_l_01_macro');

    // 检查 Stats Bar 标签
    await expect(page.locator('.stat-item').filter({ hasText: 'Build Cost' })).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: 'Workers Needed' })).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: 'WORKFORCE EFFICIENCY' })).toBeVisible();
  });
});
