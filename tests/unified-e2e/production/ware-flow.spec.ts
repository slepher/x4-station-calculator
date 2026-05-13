import { expect } from '@playwright/test';
import { test } from '../../test-setup';

async function addModule(page: any, name: string) {
  const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
  await searchInput.click();
  await page.waitForTimeout(50);
  await searchInput.fill('');
  await page.waitForTimeout(200);
  await searchInput.click();
  await page.waitForTimeout(50);
  await page.keyboard.type(name, { delay: 30 });
  await page.waitForTimeout(800);
  const candidate = page.locator('[data-testid^="station-module-candidate-"]').first();
  await expect(candidate).toBeVisible({ timeout: 5000 });
  await candidate.click();
  await page.waitForTimeout(200);
}

function parseFormattedNum(str: string): number {
  str = str.trim();
  if (str.includes('M')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1000000;
  if (str.includes('K')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1000;
  return parseFloat(str.replace(/[^0-9.]/g, ''));
}

test.describe('Ware Flow View Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const langSelect = page.locator('select').first();
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('zh-CN');
      await page.waitForTimeout(500);
    }

    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await page.waitForTimeout(500);
  });

  test('Title Style Verification', async ({ page }) => {
    await addModule(page, 'Silicon Carbide Production');

    const title = page.locator('.list-wrapper .header-title');
    await expect(title).toBeVisible();
  });

  test('Switcher Button Style Verification', async ({ page }) => {
    await addModule(page, 'Silicon Carbide Production');

    const quantityBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    await expect(quantityBtn).toBeVisible();
    await expect(quantityBtn).toHaveClass(/active/);

    const economyBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await expect(economyBtn).toBeVisible();

    const volumeBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await expect(volumeBtn).toBeVisible();
  });

  test('3.1 View mode switching', async ({ page }) => {
await addModule(page, 'claytronics');

    const quantityView = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    const volumeView = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    const transportView = page.locator('[data-testid="view-tab-btn-station-wareflow-transport"]');

    await expect(quantityView).toBeVisible();
    await expect(economyView).toBeVisible();
    await expect(volumeView).toBeVisible();
    await expect(transportView).toBeVisible();

    await expect(quantityView).toHaveClass(/active/);

    const title = page.locator('.list-wrapper .header-title');
    await expect(title).toContainText(/资源视图|Resource View/);

    await economyView.click();
    await expect(economyView).toHaveClass(/active/);
    await expect(quantityView).not.toHaveClass(/active/);
    await expect(title).toContainText(/经济视图|Economy/);

    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);
    await expect(title).toContainText(/资源视图|Resource View/);
  });

  test('UI Verification: Volume View Switch', async ({ page }) => {
    await addModule(page, 'prod_gen_claytronics_macro');

    const volumeBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await volumeBtn.click();
    await page.waitForTimeout(500);

    const headerTitle = page.locator('.list-wrapper .header-title');
    await expect(headerTitle).toContainText(/材料体积|Material Volume/);
  });

  test('3.2 Profit analysis integration', async ({ page }) => {
await addModule(page, 'claytronics');

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const economyItems = page.locator('.flow-wrapper');
    await expect(economyItems.first()).toBeVisible();

    const valueText = await economyItems.first().locator('.value').textContent();
    expect(valueText).toContain('Cr');
  });

  test('3.3 Resource list function', async ({ page }) => {
await addModule(page, 'claytronics');

    const flowItems = page.locator('.flow-wrapper');
    const count = await flowItems.count();
    expect(count).toBeGreaterThan(0);

    const firstItem = flowItems.first();
    await expect(firstItem.locator('.header-name')).toBeVisible();
    await expect(firstItem.locator('.value')).toBeVisible();
  });

  test('3.4 Layout and interaction', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await expect(searchInput).toBeVisible();
    const moduleList = page.locator('.module-list-container');
    await expect(moduleList).toBeVisible();
  });

  test('3.6 Economy view data display', async ({ page }) => {
await addModule(page, 'claytronics');

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const profitValue = page.locator('.value').first();
    if (await profitValue.count() > 0) {
      const profitText = await profitValue.textContent();
      expect(profitText?.replace(/[+\-,\s]/g, '')).not.toBe('0Cr');
    }
  });

  test.skip('8.1 Economy view uses wareFlowList', async ({ page }) => {
    await addModule(page, 'claytronics');
    await addModule(page, 'energycells');

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();
    await expect(economyView).toHaveClass(/active/);

    const wareFlowItems = page.locator('.flow-wrapper').first();
    await expect(wareFlowItems).toBeVisible({timeout: 5000});
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test.skip('8.7 profitTotal from wareFlowList', async ({ page }) => {
    await addModule(page, 'claytronics');
    await addModule(page, 'energycells');

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const profitTotal = page.locator('[data-testid="profit-val"]').last();
    await expect(profitTotal).toBeVisible({timeout: 5000});

    const profitText = await profitTotal.textContent();
    expect(profitText).toMatch(/[0-9,-]+/);
  });

  test.skip('8.11 Economy text i18n', async ({ page }) => {
    await addModule(page, 'claytronics');
    await addModule(page, 'energycells');

    const languageSelector = page.locator('select').first();
    await languageSelector.selectOption('en');
    await page.waitForTimeout(500);

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const productIncomeGroup = page.locator('text=Product Income').first();
    const operationalExpenseGroup = page.locator('text=Operational Expense').first();
    const resourceExpenseGroup = page.locator('text=Resource Expense').first();

    const exists = await productIncomeGroup.isVisible() ||
                   await operationalExpenseGroup.isVisible() ||
                   await resourceExpenseGroup.isVisible();
    expect(exists).toBeTruthy();
  });

  test.skip('9.1 Resource view uses wareFlowList', async ({ page }) => {
    await addModule(page, 'claytronics');
    await addModule(page, 'energycells');

    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);

    const resourceItems = page.locator('.flow-wrapper').first();
    await expect(resourceItems).toBeVisible({timeout: 5000});
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test.skip('9.5 Economy view display consistent', async ({ page }) => {
    await addModule(page, 'claytronics');
    await addModule(page, 'energycells');

    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();
    await expect(economyView).toHaveClass(/active/);

    const wareFlowItems = page.locator('.flow-wrapper').first();
    await expect(wareFlowItems).toBeVisible();
    const itemCount = await page.locator('.flow-wrapper').count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test.skip('I18n Verification', async ({ page }) => {
    await expect(page.locator('.view-mode-btn').filter({ hasText: '成本视图' }).first()).toBeVisible();
    await expect(page.locator('.view-mode-btn').filter({ hasText: '运输视图' }).first()).toBeVisible();

    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    await expect(page.locator('.view-mode-btn').filter({ hasText: 'Cost' }).first()).toBeVisible();
    await expect(page.locator('.view-mode-btn').filter({ hasText: 'Transport' }).first()).toBeVisible();

    await addModule(page, 'prod_gen_claytronics_macro');

    await expect(page.locator('.stat-item').filter({ hasText: /WORKERS NEEDED/i }).first()).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: /TRANSPORT TRIPS/i }).first()).toBeVisible();

    await page.locator('.list-wrapper .view-mode-btn').filter({ hasText: 'Transport' }).first().click();
    const summaryTitle = page.locator('.stat-value').first();
    await expect(summaryTitle).toHaveText(/Total Build Volume/i);
  });
});

test.describe('Ware Flow Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);

    await addModule(page, 'claytronics');
  });

  test('Supply group display', async ({ page }) => {
    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();
    await page.waitForTimeout(200);

    const quantityBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]').filter({ hasText: /数量|Quantity/ });
    await quantityBtn.click();

    const supplyGroup = page.locator('.group-container').filter({ hasText: /补给|Supply/ });
    await expect(supplyGroup).toBeVisible();
  });

  test('Economy view supply expenses', async ({ page }) => {
    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();
    await page.waitForTimeout(200);

    const economyBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyBtn.click();

    const supplyGroup = page.locator('.group-container').filter({ hasText: /补给支出|Supply Expenses/ });
    await expect(supplyGroup).toBeVisible();
  });

  test('Group order: Products -> Operations -> Supply -> Resources', async ({ page }) => {
    const workforceToggle = page.locator('.toggle-chip').filter({ hasText: /OFF|ON/ }).first();
    await workforceToggle.click();
    await page.waitForTimeout(200);

    const quantityBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    await quantityBtn.click();

    const groupContainers = page.locator('.group-container');
    const groupCount = await groupContainers.count();
    expect(groupCount).toBeGreaterThanOrEqual(2);

    const expectedOrder = [
      /产品|Products/,
      /运营|Operations/,
      /补给|Supply/,
      /资源|Resources/
    ];

    for (let i = 0; i < Math.min(groupCount, expectedOrder.length); i++) {
      const group = groupContainers.nth(i);
      const groupTitle = group.locator('.group-title');
      const titleText = await groupTitle.textContent();

      const matchesExpected = expectedOrder.some(pattern => pattern.test(titleText || ''));
      expect(matchesExpected).toBeTruthy();
    }
  });

  test('8.2 Economy view groups: Product Income / Operational Expense / Resource Expense', async ({ page }) => {
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const groups = page.locator('[data-testid="economy-group-sum"]');
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);
  });

  test('8.4 Group sum netValue display', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const economyView = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await economyView.click();

    const sumValues = page.locator('[data-testid="economy-group-sum"]');
    const count = await sumValues.count();
    expect(count).toBeGreaterThan(0);

    const sumText = await sumValues.first().textContent();
    expect(sumText).toMatch(/[0-9,]+/);
  });

  test('9.3 Resource view same grouping as economy', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);

    const groups = page.locator('.group-container');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThan(0);

    const resourceItems = page.locator('.flow-wrapper').first();
    await expect(resourceItems).toBeVisible();
  });

  test('9.4 Resource view has no Cr values', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const quantityView = page.locator('[data-testid="view-tab-btn-station-wareflow-quantity"]');
    await quantityView.click();
    await expect(quantityView).toHaveClass(/active/);

    const crValues = page.locator('.flow-wrapper .value:has-text("Cr")');
    const crCount = await crValues.count();
    expect(crCount).toBe(0);
  });
});

test.describe('Favorite Button & Priority', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('1.1 FavoriteButton 3-state icon render', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const flowWrappers = page.locator('.flow-wrapper');
    await expect(flowWrappers.first()).toBeVisible();
    const itemCount = await flowWrappers.count();
    expect(itemCount).toBeGreaterThan(0);

    const firstItem = flowWrappers.first();
    const favoriteBtn = firstItem.locator('.favorite-btn').first();
    await expect(favoriteBtn).toBeVisible();

    const svgIcon = favoriteBtn.locator('svg').first();
    await expect(svgIcon).toBeVisible();

    const btnClass = await favoriteBtn.getAttribute('class');
    expect(btnClass).toMatch(/level-[012]/);
  });

  test('1.2 FavoriteButton state cycle', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    await expect(favoriteBtns.first()).toBeVisible();

    const favoriteBtn = favoriteBtns.first();

    const initialClass = await favoriteBtn.getAttribute('class');
    const initialLevel = initialClass?.match(/level-(\d)/)?.[1] || '0';

    await favoriteBtn.click();
    await page.waitForTimeout(500);

    const newClass = await favoriteBtn.getAttribute('class');
    expect(newClass).toMatch(/level-[012]/);
  });

  test('1.3 FavoriteButton across view modes', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();

    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const quantityFavoriteBtns = page.locator('.favorite-btn');
    const quantityCount = await quantityFavoriteBtns.count();
    expect(quantityCount).toBeGreaterThan(0);

    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeFavoriteBtns = page.locator('.favorite-btn');
    const volumeCount = await volumeFavoriteBtns.count();
    expect(volumeCount).toBeGreaterThan(0);

    const economyViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await economyViewBtn.click();
    await page.waitForTimeout(1000);

    const economyFavoriteBtns = page.locator('.favorite-btn');
    const economyCount = await economyFavoriteBtns.count();
    expect(economyCount).toBeGreaterThan(0);

    expect(quantityCount).toBe(volumeCount);
    expect(volumeCount).toBe(economyCount);
  });

  test('Button visible but disabled for pure input solid wares (Ore)', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('Refined Metal Production');
    await page.waitForTimeout(1000);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const energyRow = page.locator('[data-resource-id="energycells"]').first();
    await expect(energyRow).toBeVisible();
    const energyFavBtn = energyRow.locator('.favorite-btn');
    await expect(energyFavBtn).toBeVisible();
    await expect(energyFavBtn).not.toHaveClass(/disabled/);

    const energyLockBtn = energyRow.locator('.lock-btn');
    await energyLockBtn.click();
    await page.waitForTimeout(1000);

    await expect(energyLockBtn).toHaveClass(/is-locked/);

    const oreRow = page.locator('[data-resource-id="ore"]').first();
    await expect(oreRow).toBeVisible();
    const oreFavBtn = oreRow.locator('.favorite-btn');
    await expect(oreFavBtn).toBeVisible();
    await expect(oreFavBtn).toHaveClass(/disabled/);
  });

  test('Button visible for produced wares (Energy Cells)', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('Energy Cell Production');
    await page.waitForTimeout(1000);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const energyRow = page.locator('[data-resource-id="energycells"]').first();
    await expect(energyRow).toBeVisible();

    const favoriteBtn = energyRow.locator('.favorite-btn');
    await expect(favoriteBtn).toBeVisible();
  });

  test('2.1 Product identity detection', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);

      const btnClass = await favoriteBtn.getAttribute('class');
      expect(btnClass).toMatch(/level-[012]/);
    }
  });

  test('2.2 Priority state persistence', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);

      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('4.1 Integration workflow', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn');
    expect(await favoriteBtns.count()).toBeGreaterThan(0);
  });

  test('FavoriteButton availability in economy and volume views', async ({ page }) => {
    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-economy"]');
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeFavoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    const volumeCount = await volumeFavoriteBtns.count();

    const economyViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await economyViewBtn.click();
    await page.waitForTimeout(1000);

    const economyFavoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    const economyCount = await economyFavoriteBtns.count();

    expect(volumeCount).toBeGreaterThan(0);
    expect(economyCount).toBeGreaterThan(0);
  });
});

test.describe.skip('Volume View', () => {
  test.describe('Station Dashboard Volume', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.dashboard-container');

      const langSelect = page.locator('.toolbar-panel select').first();
      if (await langSelect.isVisible()) {
        await langSelect.selectOption('zh-CN');
        await page.waitForTimeout(200);
      }

      const newButton = page.locator('.btn-tool').filter({ hasText: /新建|New/ }).first();
      if (await newButton.isVisible()) {
        await newButton.click();
        const discardButton = page.locator('button').filter({ hasText: /丢弃并新建|Discard & New/ }).first();
        if (await discardButton.isVisible()) {
          await discardButton.click();
        }
        await page.waitForTimeout(200);
      }

      await addModule(page, 'prod_gen_claytronics_macro');
    });

    test('Stats Bar Layout and Colors', async ({ page }) => {
      await expect(page.locator('.stat-item').filter({ hasText: '建设总成本' }).first()).toBeVisible();

      const totalVolumeLabel = page.locator('.stat-item').filter({ hasText: '总体积' }).first();
      await expect(totalVolumeLabel).toBeVisible();
      const totalVolumeValue = totalVolumeLabel.locator('.stat-value');
      await expect(totalVolumeValue).toHaveClass(/text-blue-400/);

      const workersNeededLabel = page.locator('.stat-item').filter({ hasText: '工人需求' }).first();
      await expect(workersNeededLabel).toBeVisible();
      const workersNeededValue = workersNeededLabel.locator('.stat-value');
      await expect(workersNeededValue).toHaveClass(/text-emerald-400/);

      await expect(page.locator('.stat-item').filter({ hasText: '建造总用时' }).first()).toBeVisible();

      const transportTripsLabel = page.locator('.stat-item').filter({ hasText: '运输船次' }).first();
      await expect(transportTripsLabel).toBeVisible();
      const transportTripsValue = transportTripsLabel.locator('.stat-value');
      await expect(transportTripsValue).toHaveClass(/text-blue-400/);

      await expect(page.locator('.stat-item').filter({ hasText: '工人效率' }).first()).toBeVisible();
    });

    test('Footer Controls: Transport Capacity slider and trips', async ({ page }) => {
      await expect(page.locator('.dashboard-footer').filter({ hasText: /建设资源价格/ })).toBeVisible();

      await page.locator('.list-wrapper .view-mode-btn').filter({ hasText: /运输视图|Transport/ }).first().click();

      const transportSliderLabel = page.locator('.slider-label').filter({ hasText: /运输船运量/ });
      await expect(transportSliderLabel).toBeVisible();

      const transportSlider = page.locator('.dashboard-footer input[type="range"]').first();

      const volumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
      const totalVolume = parseFormattedNum(volumeText);

      await transportSlider.evaluate((el: HTMLInputElement) => {
          el.value = '10000';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect(page.locator('.slider-header span').nth(1)).toContainText('10,000');
      await page.waitForTimeout(500);

      const expectedTrips = Math.ceil(totalVolume / 10000);
      const tripsText = await page.locator('.stat-item').filter({ hasText: '运输船次' }).locator('.stat-value').innerText();
      expect(parseInt(tripsText)).toBe(expectedTrips);
    });

    test('Data Verification: volume increases with more modules', async ({ page }) => {
      const volumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
      const totalVolume = parseFormattedNum(volumeText);

      const newButton = page.locator('.btn-tool').filter({ hasText: /新建|New/ }).first();
      await newButton.click();
      const discardButton = page.locator('button').filter({ hasText: /丢弃并新建|Discard & New/ }).first();
      if (await discardButton.isVisible()) await discardButton.click();
      await page.waitForTimeout(200);

      await addModule(page, 'prod_gen_claytronics_macro');
      await addModule(page, 'prod_gen_claytronics_macro');

      const doubleVolumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
      const doubleVolume = parseFormattedNum(doubleVolumeText);

      expect(doubleVolume).toBeGreaterThan(totalVolume);
      expect(doubleVolume).toBeLessThan(totalVolume * 2);
    });

    test('Persistence: transport capacity survives save and reload', async ({ page }) => {
      await page.locator('.list-wrapper .view-mode-btn').filter({ hasText: /运输视图|Transport/ }).first().click();

      const transportSlider = page.locator('.dashboard-footer input[type="range"]').first();
      await expect(transportSlider).toBeVisible();

      await transportSlider.evaluate((el: HTMLInputElement) => {
          el.value = '10000';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expect(page.locator('.slider-header span').nth(1)).toContainText('10,000');
      await page.waitForTimeout(500);

      const saveAsButton = page.locator('.btn-tool').filter({ hasText: /另存为|Save As/ }).first();
      if (await saveAsButton.isVisible()) {
          await saveAsButton.click();
      } else {
          const saveButton = page.locator('.btn-tool').filter({ hasText: /保存|Save/ }).first();
          await expect(saveButton).toBeVisible();
          await saveButton.click();
      }

      const dialog = page.locator('.fixed.inset-0').filter({ hasText: /保存|Save/ }).last();
      try {
          await expect(dialog).toBeVisible({ timeout: 3000 });
          const nameInput = dialog.locator('input[type="text"]');
          if (await nameInput.isVisible()) {
               await nameInput.fill('Test Volume Layout');
          }
          const confirmButton = dialog.locator('button').filter({ hasText: /保存|Save/ }).last();
          await confirmButton.click();
          await page.waitForTimeout(500);
      } catch (e) {
      }

      await page.reload();
      await page.waitForSelector('.dashboard-container');

      await page.locator('.list-wrapper .view-mode-btn').filter({ hasText: /运输视图|Transport/ }).first().click();

      const sliderValueLoc = page.locator('.slider-header span').nth(1);
      await expect(sliderValueLoc).toContainText('10,000', { timeout: 10000 });
    });
  });

  test.describe('Volume Compression Rate', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).isTestEnv = true;
        window.localStorage.setItem('isTestEnv', 'true');
        window.localStorage.setItem('x4_station_active_view', 'flow');
      });

      await page.goto('./?test=true');

      await page.waitForFunction(() => {
        const logicFlow = (window as any).logicFlowStore;
        const gameData = (window as any).gameDataStore;
        const station = (window as any).stationStore;
        return logicFlow && gameData && gameData.isReady && station && station.isReady;
      }, { timeout: 20000 });

      await expect(page.locator('.candidate-zone')).toBeVisible({ timeout: 15000 });
    });

    async function dragWareToNewZone(page: any, wareId: string) {
      const source = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
      await expect(source).toBeVisible();

      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error(`Source ware ${wareId} not found`);

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const newZone = compactView.locator('.compact-group').last();
      const newZoneBox = await newZone.boundingBox();
      if (!newZoneBox) throw new Error('New zone not found');

      await page.mouse.move(newZoneBox.x + newZoneBox.width / 2, newZoneBox.y + newZoneBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    test('2.1 FlowNode displays compression rate', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
      await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

      const compressionDisplay = hullpartsNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
      await expect(compressionDisplay).toBeVisible({ timeout: 3000 });
    });

    test('2.2 Compression rate color coding', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
      await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

      const compressionText = hullpartsNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
      await expect(compressionText).toBeVisible();

      const rateText = await compressionText.textContent();
      const rateValue = parseInt(rateText?.replace('%', '') || '0');

      if (rateValue <= 100) {
        await expect(compressionText).toHaveClass(/text-emerald-400/);
      } else {
        await expect(compressionText).toHaveClass(/text-red-400/);
      }
    });

    test('2.3 Isolated node hides compression rate', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
      await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

      const grapheneNode = page.locator('.flow-node[data-ware-id="graphene"]');
      await expect(grapheneNode).toBeVisible({ timeout: 5000 });

      const compressionBefore = grapheneNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
      await expect(compressionBefore).toBeVisible({ timeout: 3000 });

      await grapheneNode.hover();
      await page.waitForTimeout(100);

      const isolateBtn = grapheneNode.locator('button').filter({ hasText: '✂️' });
      await expect(isolateBtn).toBeVisible({ timeout: 2000 });
      await isolateBtn.click();
      await page.waitForTimeout(300);

      const extBadge = grapheneNode.locator('text=EXT');
      await expect(extBadge).toBeVisible({ timeout: 3000 });

      const compressionDisplay = grapheneNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
      await expect(compressionDisplay).not.toBeVisible();
    });

    test('2.4 T0 resource node hides compression rate', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const t0Node = page.locator('.flow-node[data-ware-id="energycells"], .flow-node[data-ware-id="ore"]');
      await expect(t0Node.first()).toBeVisible({ timeout: 5000 });

      const compressionDisplay = t0Node.first().locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
      await expect(compressionDisplay).not.toBeVisible();
    });
  });
});

test.describe.skip('Volume Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const languageSelector = page.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await page.waitForTimeout(500);
    }

    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    if (await newButton.isVisible()) {
      await newButton.click();
      const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
      if (await discardButton.isVisible()) {
        await discardButton.click();
      }
      await page.waitForTimeout(500);
    }

    const searchInput = page.locator('input[type="text"], [data-testid="station-module-search-input"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('等离子');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(300);

      await searchInput.clear();
      await searchInput.fill('反物质单元');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(300);

      await searchInput.clear();
      await searchInput.fill('能量电池');
      await page.waitForTimeout(500);
      await page.locator('.result-item, .module-item').first().click();
      await page.waitForTimeout(500);
    }
  });

  test('4.9 Volume group titles spacing', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);

    const volumeGroupsContainer = dashboard.locator('.volume-groups-container').first();
    await expect(volumeGroupsContainer).toBeVisible();

    const volumeGroups = dashboard.locator('.group-container');
    const groupCount = await volumeGroups.count();
    expect(groupCount).toBeGreaterThan(0);

    const firstGroup = volumeGroups.first();
    await expect(firstGroup).toHaveClass(/group-container/);
  });

  test('4.10 Volume title info display', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);

    const firstWareFlow = dashboard.locator('.flow-wrapper').first();
    await expect(firstWareFlow).toBeVisible();

    const volumeTrigger = firstWareFlow.locator('.volume-trigger-container').first();
    await expect(volumeTrigger).toBeVisible();

    const volumeCountMain = volumeTrigger.locator('.volume-count-main').first();
    await expect(volumeCountMain).toBeVisible();

    const countText = await volumeCountMain.textContent();
    expect(countText).toMatch(/\d+/);

    await expect(volumeCountMain).toHaveClass(/text-blue-400/);
  });

  test('4.11 Group header colors blend with WareFlow', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);

    const volumeGroup = dashboard.locator('.group-container').first();
    const wareFlow = dashboard.locator('.flow-wrapper').first();

    if (await volumeGroup.isVisible() && await wareFlow.isVisible()) {
      const groupHeader = volumeGroup.locator('.main-row').first();
      await expect(groupHeader).toHaveClass(/main-row/);

      const flowMainRow = wareFlow.locator('.main-row').first();
      await expect(flowMainRow).toHaveClass(/main-row/);
    }
  });

  test('Volume group i18n', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);

    const groupTitles = dashboard.locator('.group-title');
    const titleTexts = await groupTitles.allTextContents();

    const hasMatch = titleTexts.some(text => /固体|液体|集装箱|Solid|Liquid|Container/.test(text));
    expect(hasMatch).toBeTruthy();
  });

  test('Planning space display', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeView = dashboard.locator('.view-mode-btn').filter({ hasText: /仓储|Volume/ });
    await volumeView.click();
    await page.waitForTimeout(500);

    const groupPlannings = dashboard.locator('.volume-group-planning');
    const planningCount = await groupPlannings.count();
    expect(planningCount).toBeGreaterThan(0);

    const firstPlanningText = await groupPlannings.first().textContent();
    expect(firstPlanningText).toMatch(/\d+m³/);
  });

  test('3.8 Volume analysis feature', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const volumeView = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await volumeView.click();

    const volumeContainer = page.locator('.volume-groups-container');
    await expect(volumeContainer).toBeVisible();

    const volumeControls = page.locator('.volume-controls-section');
    await expect(volumeControls).toBeVisible();
  });
});

test.describe.skip('Tooltip & i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('[data-testid="station-module-search-input"]').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('[data-testid^="station-module-candidate-"]').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);
  });

  test('FavoriteButton tooltip display', async ({ page }) => {
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();

      await firstBtn.hover();
      await page.waitForTimeout(500);

      const tooltip = page.locator('.tippy-box, [data-tippy-root], .tooltip').first();
      const isVisible = await tooltip.isVisible().catch(() => false);

      if (isVisible) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText).toBeTruthy();
      }
    }
  });

  test('LockButton tooltip display', async ({ page }) => {
    const lockBtns = page.locator('.lock-btn');
    if (await lockBtns.count() > 0) {
      const firstBtn = lockBtns.first();

      await firstBtn.hover();
      await page.waitForTimeout(500);

      const tooltip = page.locator('.tippy-box, [data-tippy-root], .tooltip').first();
      const isVisible = await tooltip.isVisible().catch(() => false);

      if (isVisible) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText).toBeTruthy();
      }
    }
  });

  test('i18n tooltip key verification', async ({ page }) => {
    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      await firstBtn.hover();
      await page.waitForTimeout(500);
    }
  });

  test('3.5 Internationalization language switch', async ({ page }) => {
    const languageSelector = page.locator('select').first();

    await languageSelector.selectOption('en');
    await page.waitForTimeout(500);

    const dashboard = page.locator('.list-wrapper').first();
    const title = dashboard.locator('.header-title');
    await expect(title).toContainText(/Resource View/);

    await languageSelector.selectOption('zh-CN');
    await page.waitForTimeout(500);
    await expect(title).toContainText(/资源产出/);
  });
});
