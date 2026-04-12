import { expect } from '@playwright/test';
import { test } from '../../test-setup';
// import { STATION_MOCK_DATA } from '../mock/station_mock_data';

test.describe('WareFlow UI Refactor', () => {
  test.beforeEach(async ({ page }) => {
    // 页面错误捕获已由 test-setup.ts 处理
    
    await page.goto('http://localhost:5173');
    
    // 确保环境干净
    await page.locator('button:has-text("New")').click();
    // 如果有未保存提示，点击确认
    const dialog = page.locator('.dialog-container');
    if (await dialog.isVisible()) {
      await page.locator('button:has-text("Discard")').click();
    }
  });

  test('Test Case 1: Title Style Verification', async ({ page }) => {
    // 1. 加载 WareFlow 仪表盘 (默认应该可见，或者需要添加模块触发)
    // 为了确保 dashboard 可见，我们添加一个模块
    const searchInput = page.locator('.search-input');
    await searchInput.click();
    await searchInput.fill('Silicon Carbide Production'); // Silicon Carbide Production
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    // 2. 检查标题元素
    // 注意：WareFlowDashboard 的标题类名也是 .header-title，需要通过父容器区分
    // 假设 WareFlowDashboard 在右侧或下方，我们通过特定文本定位
    const dashboard = page.locator('.list-wrapper').filter({ hasText: /Quantity|Overview/ });
    const title = dashboard.locator('.header-title');

    // 3. 验证样式
    // Playwright 无法直接验证 CSS class 的具体属性值，但可以验证 class 是否应用
    // 或者通过 evaluate 获取 computed style
    await expect(title).toBeVisible();
    
    const color = await title.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    // text-slate-100 is rgb(241, 245, 249)
    expect(color).toBe('rgb(241, 245, 249)');

    const fontWeight = await title.evaluate((el) => {
      return window.getComputedStyle(el).fontWeight;
    });
    // font-bold usually maps to 700
    expect(fontWeight).toBe('700');
  });

  test('Test Case 2: Switcher Button Style Verification', async ({ page }) => {
    // 1. 添加模块以显示 dashboard
    const searchInput = page.locator('.search-input');
    await searchInput.click();
    await searchInput.fill('Silicon Carbide Production');
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');

    const dashboard = page.locator('.list-wrapper').filter({ hasText: /Quantity|Overview/ });
    const switcher = dashboard.locator('.view-mode-switcher');
    
    // 2. 检查 "Quantity" 按钮 (默认激活)
    const quantityBtn = switcher.locator('button', { hasText: 'Quantity' });
    
    // 验证激活状态下的颜色 (text-sky-400 -> rgb(56, 189, 248))
    const activeColor = await quantityBtn.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(activeColor).toBe('rgb(56, 189, 248)');

    // 验证背景色 (bg-sky-500/20 -> sky-500 is rgb(14, 165, 233), 20% opacity)
    // computed style 通常返回 rgba
    const activeBg = await quantityBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(activeBg).toMatch(/rgba\(14, 165, 233, 0.2\)/);

    // 3. 检查 "Volume" 按钮 (非激活)
    const volumeBtn = switcher.locator('button', { hasText: 'Volume' });
    
    // 验证非激活文字颜色 (text-slate-500 -> rgb(100, 116, 139))
    const inactiveColor = await volumeBtn.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(inactiveColor).toBe('rgb(100, 116, 139)');

    // 4. 点击 "Volume" 按钮
    await volumeBtn.click();
    
    // 等待 CSS 过渡完成 (duration-200)
    await page.waitForTimeout(300);

    // 等待样式更新
    await expect(volumeBtn).toHaveCSS('color', 'rgb(56, 189, 248)');

    // 验证 Volume 变为激活
    const newActiveColor = await volumeBtn.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(newActiveColor).toBe('rgb(56, 189, 248)');

    // 验证 Quantity 变为非激活
    const newInactiveColor = await quantityBtn.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(newInactiveColor).toBe('rgb(100, 116, 139)');
  });
});
