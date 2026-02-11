import { expect } from '@playwright/test';
import { test } from '../test-setup';

test.describe('Station Dashboard Volume View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dashboard-container');
    
    // Switch to Chinese for consistency with test tasks unless specified otherwise
    const langSelect = page.locator('.toolbar-panel select').first();
    if (await langSelect.isVisible()) {
      await langSelect.selectOption('zh-CN');
      await page.waitForTimeout(200);
    }

    // Reset via New button
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

  async function addModule(page: any, name: string) {
    const searchInput = page.locator('.search-input').first();
    await searchInput.click();
    await searchInput.fill(name);
    await page.waitForSelector('.results-popover .result-item', { state: 'visible' });
    await page.locator('.results-popover .result-item').first().click();
    await page.keyboard.press('Escape');
    await page.waitForSelector('.results-popover', { state: 'hidden' });
  }

  function parseFormattedNum(str: string): number {
    str = str.trim();
    if (str.includes('M')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1000000;
    if (str.includes('K')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1000;
    return parseFloat(str.replace(/[^0-9.]/g, ''));
  }

  test('UI Verification: Stats Bar Layout and Colors', async ({ page }) => {
    // Add a module to populate stats
    await addModule(page, 'prod_gen_claytronics_macro'); // Claytronics Production

    // Verify 2x3 Grid Layout (implicitly by checking existence of items)
    // Row 1
    await expect(page.locator('.stat-item').filter({ hasText: '建设总成本' }).first()).toBeVisible();
    
    const totalVolumeLabel = page.locator('.stat-item').filter({ hasText: '总体积' }).first();
    await expect(totalVolumeLabel).toBeVisible();
    const totalVolumeValue = totalVolumeLabel.locator('.stat-value');
    await expect(totalVolumeValue).toHaveClass(/text-blue-400/);

    const workersNeededLabel = page.locator('.stat-item').filter({ hasText: '工人需求' }).first();
    await expect(workersNeededLabel).toBeVisible();
    const workersNeededValue = workersNeededLabel.locator('.stat-value');
    await expect(workersNeededValue).toHaveClass(/text-emerald-400/);

    // Row 2
    await expect(page.locator('.stat-item').filter({ hasText: '建造总用时' }).first()).toBeVisible();
    
    const transportTripsLabel = page.locator('.stat-item').filter({ hasText: '运输船次' }).first();
    await expect(transportTripsLabel).toBeVisible();
    const transportTripsValue = transportTripsLabel.locator('.stat-value');
    await expect(transportTripsValue).toHaveClass(/text-blue-400/);
    
    await expect(page.locator('.stat-item').filter({ hasText: '工人效率' }).first()).toBeVisible();
  });

  test('UI Verification: Volume View Switch', async ({ page }) => {
    await addModule(page, 'prod_gen_claytronics_macro');

    // Debug buttons
    const buttons = await page.locator('.view-mode-btn').allInnerTexts();
    console.log('Available buttons:', buttons);

    // Click Volume View (Scoped to Dashboard)
    await page.locator('.dashboard-container .view-mode-btn').filter({ hasText: '空间' }).first().click();
    await page.waitForTimeout(500); // Wait for UI update

    // Verify list updates to volume (check for m³ unit)
    // The implementation might use "m³" in the text
    // We check the total-value in the header which is always visible
    const summaryValue = page.locator('.total-value').first(); 
    await expect(summaryValue).toContainText('m³');
    await expect(summaryValue).toHaveClass(/text-blue-400/);

    // Verify Summary Title
    const summaryTitle = page.locator('.variant-summary').first();
    await expect(summaryTitle).toHaveText(/材料总体积/);

    // Verify Summary Value matches Stats Bar Total Volume
    const statsVolume = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
    const summaryVolumeText = await summaryValue.innerText();
    
    const statsVolNum = parseFormattedNum(statsVolume);
    const summaryVolNum = parseFormattedNum(summaryVolumeText);
    
    // Allow small difference due to rounding in display
    expect(Math.abs(statsVolNum - summaryVolNum)).toBeLessThan(100); 

    // Verify Header Title updates dynamically
    // Scope to the dashboard container that has the view switcher
    const dashboard = page.locator('.dashboard-container').filter({ has: page.locator('.view-mode-btn', { hasText: '空间' }) }).first();
    const headerTitle = dashboard.locator('.header-title');
    await expect(headerTitle).toHaveText(/体积概览/); // ui.volume_overview
  });

  test('UI Verification: Footer Controls', async ({ page }) => {
    await addModule(page, 'prod_gen_claytronics_macro');
    
    // In Cost View (default)
    // Check if "Build Resource Price" label exists
    await expect(page.locator('.dashboard-footer').filter({ hasText: /建设资源价格/ })).toBeVisible();

    // Switch to Volume View
    await page.locator('.dashboard-container .view-mode-btn').filter({ hasText: '空间' }).first().click();

    // Verify Transport Capacity slider exists
    const transportSliderLabel = page.locator('.slider-label').filter({ hasText: /运输船运量/ });
    await expect(transportSliderLabel).toBeVisible();
    
    const transportSlider = page.locator('.dashboard-footer input[type="range"]').first(); // Assuming it's the first slider in footer now
    
    // Adjust slider
    // Default 62000. Let's change to something else.
    // Total Volume for 1 Claytronics Production?
    // We need to know the volume.
    // Let's get the volume first.
    const volumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
    const totalVolume = parseFormattedNum(volumeText);

    // Set slider to 10000
    // await transportSlider.fill('10000'); // Range input might not support fill
    
    // We must ensure the input event is dispatched properly.
    // Try to focus and type, or use a more robust evaluate
    await transportSlider.evaluate((el: HTMLInputElement) => {
        el.value = '10000';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Wait for the value to update in UI
    await expect(page.locator('.slider-header span').nth(1)).toContainText('10,000');
    await page.waitForTimeout(500);

    // Verify Trips
    const expectedTrips = Math.ceil(totalVolume / 10000);
    const tripsText = await page.locator('.stat-item').filter({ hasText: '运输船次' }).locator('.stat-value').innerText();
    expect(parseInt(tripsText)).toBe(expectedTrips);
  });

  test('Data Verification', async ({ page }) => {
    await addModule(page, 'prod_gen_claytronics_macro');
    
    const volumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
    const totalVolume = parseFormattedNum(volumeText);
    
    // Reset and add 2
    const newButton = page.locator('.btn-tool').filter({ hasText: /新建|New/ }).first();
    await newButton.click();
    const discardButton = page.locator('button').filter({ hasText: /丢弃并新建|Discard & New/ }).first();
    if (await discardButton.isVisible()) await discardButton.click();
    await page.waitForTimeout(200);

    await addModule(page, 'prod_gen_claytronics_macro');
    await addModule(page, 'prod_gen_claytronics_macro');
    
    const doubleVolumeText = await page.locator('.stat-item').filter({ hasText: '总体积' }).locator('.stat-value').innerText();
    const doubleVolume = parseFormattedNum(doubleVolumeText);

    // Volume should increase, but might not be exactly double due to fixed base costs (like Dock)
    expect(doubleVolume).toBeGreaterThan(totalVolume);
    // It should be less than double because the base volume (dock) is shared
    expect(doubleVolume).toBeLessThan(totalVolume * 2);
  });

  test('Persistence Verification', async ({ page }) => {
    await addModule(page, 'prod_gen_claytronics_macro');
    
    // Switch to Volume View
    await page.locator('.dashboard-container .view-mode-btn').filter({ hasText: '空间视图' }).first().click();
    
    // Change transport capacity
    const transportSlider = page.locator('.dashboard-footer input[type="range"]').first();
    
    // Ensure we are in volume view first
    await expect(transportSlider).toBeVisible();

    await transportSlider.evaluate((el: HTMLInputElement) => {
        el.value = '10000';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // Wait for update
    await expect(page.locator('.slider-header span').nth(1)).toContainText('10,000');
    await page.waitForTimeout(500);

    // Save Layout
    // Click Save As instead of Save to ensure dialog opens
    const saveAsButton = page.locator('.btn-tool').filter({ hasText: /另存为|Save As/ }).first();
    
    if (await saveAsButton.isVisible()) {
        await saveAsButton.click();
    } else {
        const saveButton = page.locator('.btn-tool').filter({ hasText: /保存|Save/ }).first();
        await expect(saveButton).toBeVisible();
        await saveButton.click();
    }
    
    // Handle Dialog
    // Use a more generic selector for the dialog overlay
    const dialog = page.locator('.fixed.inset-0').filter({ hasText: /保存|Save/ }).last();
    
    // Wait for dialog to appear
    try {
        await expect(dialog).toBeVisible({ timeout: 3000 });
        
        const nameInput = dialog.locator('input[type="text"]');
        if (await nameInput.isVisible()) {
             await nameInput.fill('Test Volume Layout');
        }
        
        // Click the primary action button (Save)
        // Look for the button with "Save" text inside the dialog
        const confirmButton = dialog.locator('button').filter({ hasText: /保存|Save/ }).last();
        await confirmButton.click();
        
        await page.waitForTimeout(500); // Wait for save to complete
    } catch (e) {
        console.log('Save dialog did not appear or interaction failed:', e);
    }

    // Reload Page
    await page.reload();
    await page.waitForSelector('.dashboard-container');

    // Switch to Volume View (might reset view mode but settings should persist)
    // Need to verify if the app remembers the view mode? Probably not.
    await page.locator('.dashboard-container .view-mode-btn').filter({ hasText: '空间视图' }).first().click();

    // Verify Slider Value
    const sliderValueLoc = page.locator('.slider-header span').nth(1);
    
    // Debug: print what we found
    try {
      await expect(sliderValueLoc).toContainText('10,000', { timeout: 10000 });
    } catch (e) {
      const val = await sliderValueLoc.innerText();
      console.log('Found slider value after reload:', val);
      throw e;
    }
  });

  test('I18n Verification', async ({ page }) => {
    // ZH-CN Verified in previous tests (default)
    await expect(page.locator('.view-mode-btn').filter({ hasText: '成本视图' }).first()).toBeVisible(); // Material -> Cost View
    await expect(page.locator('.view-mode-btn').filter({ hasText: '空间视图' }).first()).toBeVisible();

    // Switch to EN
    const langSelect = page.locator('.toolbar-panel select').first();
    await langSelect.selectOption('en');
    await page.waitForTimeout(500);

    await expect(page.locator('.view-mode-btn').filter({ hasText: 'Cost View' }).first()).toBeVisible();
    await expect(page.locator('.view-mode-btn').filter({ hasText: 'Volume' }).first()).toBeVisible();

    await addModule(page, 'prod_gen_claytronics_macro');
    // Case insensitive matching for safety
    await expect(page.locator('.stat-item').filter({ hasText: /WORKERS NEEDED/i }).first()).toBeVisible();
    await expect(page.locator('.stat-item').filter({ hasText: /TRANSPORT TRIPS/i }).first()).toBeVisible();
    // await expect(page.locator('.stat-item').filter({ hasText: /TOTAL BUILD VOLUME/i })).toBeVisible(); // This is in Summary, not Stats Bar necessarily with that label, Stats bar has TOTAL VOLUME
    
    // Switch to Volume View to check Summary Title
    await page.locator('.dashboard-container .view-mode-btn').filter({ hasText: 'Volume' }).first().click();
    const summaryTitle = page.locator('.variant-summary').first();
    await expect(summaryTitle).toHaveText(/Build Volume/i);
  });
});
