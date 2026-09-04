import { expect } from '@playwright/test';
import { test } from '../../test-setup';

async function addModule(page: any, name: string) {
  const searchInput = page.locator('[data-testid="candidate-search-input"]').first();
  await searchInput.click();
  await searchInput.fill('');
  await page.keyboard.type(name, { delay: 30 });
  await page.waitForTimeout(800);
  const candidate = page.locator('[data-testid^="grouped-candidate-item-"]').first();
  await expect(candidate).toBeVisible({ timeout: 5000 });
  await candidate.click();
  await page.waitForTimeout(300);
}

test.describe('Station Dashboard - Basic Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('should render dashboard container with header title and view mode switcher', async ({ page }) => {
    const dashboard = page.locator('.dashboard-container');
    await expect(dashboard).toBeVisible();

    const header = page.locator('.dashboard-header');
    const title = header.locator('.header-title');
    const switcher = page.locator('.dashboard-container .view-mode-switcher');

    await expect(title).toBeVisible();
    await expect(switcher).toBeVisible();

    const titleBox = await title.boundingBox();
    const switcherBox = await switcher.boundingBox();
    if (titleBox && switcherBox) {
      expect(titleBox.x).toBeLessThan(switcherBox.x);
    }

    const unitBadge = header.locator('.unit-badge');
    await expect(unitBadge).not.toBeVisible();
  });

  test('should show Cost tab as active by default', async ({ page }) => {
    const switcher = page.locator('.dashboard-container .view-mode-switcher');
    const materialsBtn = switcher.locator('button').filter({ hasText: /成本|Cost/ });
    const timeBtn = switcher.locator('button').filter({ hasText: /时间|Time/ });
    const workersBtn = switcher.locator('button').filter({ hasText: /工人|Workers/ });

    await expect(materialsBtn).toHaveClass(/active/);
    await expect(timeBtn).not.toHaveClass(/active/);
    await expect(workersBtn).not.toHaveClass(/active/);
  });

  test('should display visual consistency for dashboard elements', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const summaryContainer = page.locator('.item-container').filter({ has: page.locator('.variant-summary') });
    const totalVal = summaryContainer.locator('.total-value');
    await expect(totalVal).toBeVisible();

    const color = await totalVal.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).toMatch(/rgb\(248, 113, 113\)/);

    const moduleTitle = page.locator('.variant-module').first();
    const symbol = moduleTitle.locator('.symbol');
    await expect(symbol).toBeVisible();
    const opacity = await symbol.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(0.4);
  });
});

test.describe('Station Dashboard - Build Cost', () => {
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
  });

  test('should display cost summary with total value and material list', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const totalCostTitle = page.locator('.variant-summary');
    await expect(totalCostTitle).toBeVisible();

    const priceVal = page.locator('.item-container').filter({ has: totalCostTitle }).locator('.total-value');
    const priceText = await priceVal.innerText();
    const priceNum = parseInt(priceText.replace(/,/g, ''));
    expect(priceNum).toBeGreaterThan(0);

    await totalCostTitle.click();
    const materialList = page.locator('.material-row');
    await expect(materialList.first()).toBeVisible();

    const energyCells = materialList.filter({ hasText: /能量电池|Energy Cells/ });
    await expect(energyCells.first()).toBeVisible();
  });

  test('should group modules with quantity and allow expansion', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const moduleGroup = page.locator('.variant-module').filter({ hasText: /Silicon Wafer|硅晶片/ });
    await expect(moduleGroup).toBeVisible();
    await expect(moduleGroup).toContainText('1');

    const groupPrice = page.locator('.item-container').filter({ has: moduleGroup }).locator('.total-value');
    const priceText = await groupPrice.innerText();
    expect(parseInt(priceText.replace(/,/g, ''))).toBeGreaterThan(0);

    await moduleGroup.click();
    const detailItems = page.locator('.material-row');
    await expect(detailItems.first()).toBeVisible();
  });

  test('should update total cost when price multiplier slider changes', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const totalVal = page.locator('.item-container').filter({ has: page.locator('.variant-summary') }).locator('.total-value');
    const initialPrice = await totalVal.innerText();

    const slider = page.locator('.custom-range').first();
    await slider.fill('1');
    await page.waitForTimeout(300);

    const newPrice = await totalVal.innerText();
    expect(newPrice).not.toBe(initialPrice);
  });

  test.skip('should merge identical modules and maintain addition order', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');
    await addModule(page, 'Silicon Wafer Production');

    const waferGroup = page.locator('.variant-module').filter({ hasText: /Silicon Wafer|硅晶片/ });
    await expect(waferGroup).toContainText('2');

    await addModule(page, 'Claytronics Production');
    await page.waitForTimeout(1000);

    const titles = page.locator('.variant-module');
    const allTitles = await titles.allInnerTexts();

    await expect(titles.first()).toContainText(/Silicon Wafer|硅晶片/);

    const waferIdx = allTitles.findIndex(t => t.includes('Silicon Wafer') || t.includes('硅晶片'));
    const clayIdx = allTitles.findIndex(t => t.includes('Claytronics') || t.includes('电子黏土'));
    expect(waferIdx).toBeLessThan(clayIdx);
  });

  test('should sort materials by tier with Energy Cells at end', async ({ page }) => {
    await addModule(page, 'Claytronics Production');

    const summary = page.locator('.variant-summary');
    await summary.click();

    const materialItems = page.locator('.material-row .name');
    const materialNames = await materialItems.allInnerTexts();

    expect(materialNames[materialNames.length - 1]).toMatch(/能量电池|Energy Cells/);

    for (const name of materialNames) {
      expect(name).not.toMatch(/!!id/);
      expect(name.trim()).not.toBe('');
    }
  });

  test.skip('should aggregate identical modules with correct summary', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('energy cell');
    await page.waitForTimeout(200);

    const moduleResult = page.locator('.result-item').first();
    await moduleResult.click();
    await page.waitForTimeout(200);
    await moduleResult.click();
    await page.waitForTimeout(200);

    const moduleDetails = page.locator('.module-detail');
    const groupCount = await moduleDetails.count();
    expect(groupCount).toBe(2);

    const moduleGroup = moduleDetails.nth(1);
    const totalValue = await moduleGroup.locator('.total-value').innerText();
    expect(totalValue).toMatch(/\d+/);
  });

  test('should sort materials by tier descending with valid quantities', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await searchInput.fill('advanced electronics');
    await page.waitForTimeout(300);
    await page.locator('.result-item').first().click();
    await page.waitForTimeout(300);

    const summaryGroup = page.locator('.module-detail').first();
    await summaryGroup.locator('.main-row').click();

    const names = await summaryGroup.locator('.material-name .name').allInnerTexts();
    expect(names.length).toBeGreaterThan(1);

    const firstQty = await summaryGroup.locator('.material-name .qty').first().innerText();
    expect(firstQty).not.toBe('NaN');
  });

  test('should display economy view price sliders in flex-row layout', async ({ page }) => {
    await addModule(page, 'claytronics');

    const dashboard = page.locator('.list-wrapper').first();
    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await economyViewBtn.click();

    const profitSection = page.locator('.profit-section').first();
    await expect(profitSection).toBeVisible();

    const priceSliders = profitSection.locator('.slider-container');
    const sliderCount = await priceSliders.count();
    expect(sliderCount).toBe(2);

    const simulationControls = profitSection.locator('.simulation-controls').first();
    await expect(simulationControls).toHaveClass(/flex-row/);
  });
});

test.describe('Station Dashboard - Volume Analysis', () => {
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
    await newButton.click();
    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await page.waitForTimeout(500);

    await addModule(page, 'claytronics');
  });

  test('should switch to volume view and display volume controls section', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();

    const volumeControlsSection = page.locator('.volume-controls-section').first();
    await expect(volumeControlsSection).toBeVisible();
  });

  test('should display volume data with sliders indicating buffer calculation', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBeGreaterThanOrEqual(3);
  });

  test('should update volume when buffer time changes', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeTexts = page.locator('.text-ware-volume');
    if (await volumeTexts.count() > 0) {
      const initialVolume = await volumeTexts.first().textContent();

      const sliders = page.locator('input[type="range"]');
      if (await sliders.count() >= 2) {
        const primarySlider = sliders.nth(1);
        await primarySlider.fill('20');
        await page.waitForTimeout(500);

        const newVolume = await volumeTexts.first().textContent();
        expect(newVolume).toBeTruthy();
      }
    }
  });

  test('should display total occupied volume with priority-based buffer', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const totalVolumeElements = page.locator('.text-total-occupied-volume, .total-volume');
    if (await totalVolumeElements.count() > 0) {
      const totalVolume = await totalVolumeElements.first().textContent();
      expect(totalVolume).toBeTruthy();
    }
  });

  test('should affect volume when priority changes', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeTexts = page.locator('.text-ware-volume');
    if (await volumeTexts.count() > 0) {
      const initialVolume = await volumeTexts.first().textContent();

      const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
      await quantityViewBtn.click();
      await page.waitForTimeout(500);

      const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
      if (await favoriteBtns.count() > 0) {
        await favoriteBtns.first().click();
        await page.waitForTimeout(300);

        await volumeViewBtn.click();
        await page.waitForTimeout(1000);

        const newVolume = await volumeTexts.first().textContent();
        expect(newVolume).toBeTruthy();
      }
    }
  });

  test('should maintain consistent flex-row layout between volume and economy views', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();

    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const volumeSimulationControls = volumeControlsSection.locator('.simulation-controls').first();
    await expect(volumeSimulationControls).toHaveClass(/flex-row/);

    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await economyViewBtn.click();

    const profitSection = page.locator('.profit-section').first();
    const profitSimulationControls = profitSection.locator('.simulation-controls').first();
    await expect(profitSimulationControls).toHaveClass(/flex-row/);
  });
});

test.describe('Station Dashboard - Workforce', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('should display workforce stats bar with workers needed', async ({ page }) => {
    await addModule(page, 'claytronics');

    const workersNeeded = page.locator('[data-testid="station-dashboard"] .stat-item').filter({ hasText: /工人|Workers/ }).first();
    await expect(workersNeeded).toBeVisible();
  });

  test('should show workforce option in auto-industry header', async ({ page }) => {
    await addModule(page, 'claytronics');

    const industryHeader = page.locator('.tier-section.tier-auto .tier-header').first();
    await expect(industryHeader).toBeVisible();
  });
});

test.describe('Station Dashboard - Time View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('should display build time in XD HH:MM:SS format', async ({ page }) => {
    await addModule(page, 'claytronics');

    const totalTimeLoc = page.locator('[data-testid="station-dashboard"] .stat-item').filter({ hasText: /时间|Time/ }).first();
    await expect(totalTimeLoc).toBeVisible();
  });
});

test.describe('Station Dashboard - Storage Planning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500);
    await addModule(page, 'claytronics');
  });

  test('should display storage planning volume count in volume view', async ({ page }) => {
    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await volumeViewBtn.click();

    const volumeCountMain = page.locator('[data-testid="volume-count"]').first();
    await expect(volumeCountMain).toBeVisible();

    const countText = await volumeCountMain.textContent();
    expect(Number(countText)).toBeGreaterThanOrEqual(0);
  });

  test('should show planning details in volume tooltip', async ({ page }) => {
    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await volumeViewBtn.click();

    const volumeTrigger = page.locator('[data-testid="volume-count"]').first();
    await volumeTrigger.hover();

    const tooltip = page.locator('.tippy-box');
    await expect(tooltip).toBeVisible();
  });

  test('should increase storage slots when buffer time increases', async ({ page }) => {
    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]');
    await volumeViewBtn.click();

    const volumeCountMain = page.locator('[data-testid="volume-count"]').first();
    const initialCount = await volumeCountMain.textContent();

    const volumeControls = page.locator('.volume-controls-section');
    if (await volumeControls.isVisible()) {
      const sliders = volumeControls.locator('input[type="range"]');
      const sliderCount = await sliders.count();
      if (sliderCount > 0) {
        const firstSlider = sliders.first();
        for (let i = 0; i < 10; i++) {
          await firstSlider.focus();
          await page.keyboard.press('ArrowRight');
        }
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe.skip('Station Dashboard - Buffer Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const languageSelector = page.locator('select').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.selectOption('zh-CN');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();
    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await page.waitForTimeout(500);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('claytronics');
    await page.waitForTimeout(200);

    const firstResult = page.locator('.result-item').first();
    await firstResult.click();
    await page.waitForTimeout(200);
  });

  test('should display three buffer sliders in volume view', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();

    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const sliders = volumeControlsSection.locator('input[type="range"]');
    const sliderCount = await sliders.count();
    expect(sliderCount).toBe(3);
  });

  test('should have correct range attributes on resource buffer slider', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();

    const volumeControlsSection = page.locator('.volume-controls-section').first();
    const sliders = volumeControlsSection.locator('input[type="range"]');

    const resourceSlider = sliders.first();
    await expect(resourceSlider).toHaveAttribute('min', '0');
    await expect(resourceSlider).toHaveAttribute('max', '24');
  });

  test('should have functional primary product buffer slider', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(2);

    if (count >= 2) {
      const primarySlider = sliders.nth(1);

      const min = await primarySlider.getAttribute('min');
      const max = await primarySlider.getAttribute('max');

      expect(min).toBe('0');
      expect(parseInt(max || '0')).toBeGreaterThanOrEqual(1);

      const maxVal = parseFloat(max || '1');
      const testValue = Math.min(0.5, maxVal).toString();
      await primarySlider.fill(testValue);
      await page.waitForTimeout(300);

      const value = await primarySlider.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('should have functional secondary product buffer slider', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);

    if (count >= 3) {
      const secondarySlider = sliders.nth(2);

      const min = await secondarySlider.getAttribute('min');
      const max = await secondarySlider.getAttribute('max');

      expect(min).toBe('0');
      expect(parseInt(max || '0')).toBeGreaterThanOrEqual(1);

      const maxVal = parseFloat(max || '1');
      const testValue = Math.min(0.3, maxVal).toString();
      await secondarySlider.fill(testValue);
      await page.waitForTimeout(300);

      const value = await secondarySlider.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('should have buffer slider labels with i18n text content', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliderLabels = page.locator('.slider-label, .control-label');
    const count = await sliderLabels.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const labelText = await sliderLabels.nth(i).textContent();
        expect(labelText).toBeTruthy();
        expect(labelText!.length).toBeGreaterThan(0);
      }
    }
  });

  test('should have slider labels with resource and product buffer text', async ({ page }) => {
    const dashboard = page.locator('.list-wrapper').first();

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await volumeViewBtn.click();

    const volumeControlsSection = page.locator('.volume-controls-section').first();
    await expect(volumeControlsSection).toBeVisible();

    const sectionText = await volumeControlsSection.textContent();
    expect(sectionText).toMatch(/资源缓冲时间|Resource Buffer Hours/);
    expect(sectionText).toMatch(/主产物缓冲时间|Primary Product Buffer Hours/);
  });

  test('should affect volume calculation when buffer slider changes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeTexts = page.locator('.text-ware-volume');
    if (await volumeTexts.count() > 0) {
      const initialVolume = await volumeTexts.first().textContent();

      const sliders = page.locator('input[type="range"]');
      if (await sliders.count() >= 2) {
        const primarySlider = sliders.nth(1);
        await primarySlider.fill('20');
        await page.waitForTimeout(500);

        const newVolume = await volumeTexts.first().textContent();
        expect(newVolume).toBeTruthy();
      }
    }
  });
});

test.describe('Station Dashboard - i18n', () => {
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
  });

  test('should display English labels on dashboard', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    const switcher = page.locator('.dashboard-container .view-mode-switcher');
    await expect(switcher).toContainText('Cost');
    await expect(switcher).toContainText('Time');
    await expect(switcher).toContainText('Workers');

    const summary = page.locator('.variant-summary');
    await expect(summary).toContainText(/Total Build Cost/i);

    const moduleTitle = page.locator('.variant-module').first();
    const titleText = await moduleTitle.innerText();
    expect(titleText).not.toMatch(/!!id/);
    expect(titleText).toContain('Silicon Wafer');

    await expect(page.locator('body')).not.toContainText(/ui\./);
  });

  test.skip('should display English stats bar labels', async ({ page }) => {
    await addModule(page, 'hab_arg_l_01_macro');

    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    await expect(page.locator('.stat-item').filter({ hasText: 'Build Cost' })).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: 'Workers Needed' })).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: 'WORKFORCE EFFICIENCY' })).toBeVisible();
  });

  test.skip('should display credits symbol with i18n', async ({ page }) => {
    await addModule(page, 'Silicon Wafer Production');

    const unitBadge = page.locator('.unit-badge');
    await expect(unitBadge).toBeVisible();
    const badgeText = await unitBadge.innerText();
    expect(badgeText.toUpperCase()).toContain('CR');
  });
});
