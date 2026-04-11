import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
});

const createNewEmpire = async (page: any) => {
  const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first();
  await newBtn.click();
  await page.waitForTimeout(100);
};

const addModuleToStation = async (page: any, moduleName: string) => {
  const searchInput = page.locator('.search-box .search-input');
  await searchInput.focus();
  await searchInput.fill(moduleName);
  const resultItem = page.locator('.results-popover .result-item').first();
  await expect(resultItem).toBeVisible({ timeout: 500 });
  await resultItem.click();
};

test.describe('empire-view-ui-change', () => {
  test('帝国总览去标签与标题后缀验证', async ({ page }) => {
    await createNewEmpire(page);

    const addStationBtn = page.locator('.add-btn').first();
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);

    await page.locator('.overview-tab').first().click();
    await page.waitForTimeout(200);

    const wrapper = page.locator('.list-wrapper').first();
    await expect(wrapper.locator('.header-title')).toContainText(/资源视图|Resource View/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);

    await wrapper.locator('.view-mode-btn').filter({ hasText: /经济|Economy/ }).first().click();
    await page.waitForTimeout(200);
    await expect(wrapper.locator('.header-title')).toContainText(/经济视图|Economy/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);
  });

  test('空间站帝国资源区域去标签与标题后缀验证', async ({ page }) => {
    await createNewEmpire(page);

    const addStationBtn = page.locator('.station-tab-bar-container .add-btn').first();
    await addStationBtn.click();
    await addModuleToStation(page, 'Clay');
    await page.waitForTimeout(200);
    await addStationBtn.click();
    await page.waitForTimeout(200);

    const stationTab = page.locator('.station-tab').nth(1);
    await expect(stationTab).toBeVisible({ timeout: 500 });
    await stationTab.click();
    await page.waitForTimeout(100);

    const showGaps = page.locator('[data-testid="toggle-show-empire-gaps"]');
    await showGaps.click();
    await page.waitForTimeout(100);

    const wrapper = page.locator('.list-wrapper').filter({ has: page.locator('.view-mode-switcher').filter({ hasText: /经济|Economy/i }).first() }).first();
    await expect(wrapper.locator('.header-title')).toContainText(/资源视图|Resource View/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);

    await wrapper.locator('.view-mode-btn').filter({ hasText: /经济|Economy/ }).first().click();
    await page.waitForTimeout(200);
    await expect(wrapper.locator('.header-title')).toContainText(/经济视图|Economy/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);
  });

  test('帝国明细站点数量样式一致性验证', async ({ page }) => {
    await createNewEmpire(page);

    const addStationBtn = page.locator('.add-btn').first();
    await addStationBtn.click();
    await addModuleToStation(page, 'Energy');
    await page.waitForTimeout(200);
    await page.locator('input[type="number"]').first().fill('2');
    await page.waitForTimeout(200);

    await page.locator('.overview-tab').first().click();
    await page.waitForTimeout(200);

    const overviewWrapper = page.locator('.list-wrapper').first();
    await overviewWrapper.locator('.flow-wrapper .main-row').first().click();
    await expect(overviewWrapper.locator('.item-name .qty').first()).toContainText('2');
    await expect(overviewWrapper.locator('.item-name .symbol').first()).toContainText('x');
    await expect(overviewWrapper.locator('.item-name .name').first()).toBeVisible();
  });
});
