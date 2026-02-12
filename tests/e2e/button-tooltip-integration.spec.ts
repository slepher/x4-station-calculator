import { test, expect } from '@playwright/test';

test.describe('Button Tooltip Integration', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));
    
    // Inject test environment flag before page load
    await page.addInitScript(() => {
        (window as any).isTestEnv = true;
    });
    
    await page.goto('/');

    // Check environment
    const debug = await page.evaluate(() => ({
        hasStore: !!(window as any).store,
        hasPinia: !!(window as any).__pinia,
        // isDev: import.meta.env.DEV // Cannot serialize import.meta
    }));
    console.log('[Test Debug]', debug);
    
    // Wait for the app to be mounted and store to be ready
    await page.waitForFunction(() => (window as any).store && (window as any).store.isReady);
    
    // Clear existing data and add specific modules for testing
    await page.evaluate(() => {
      const store = (window as any).store;
      store.clearAll();
      
      // Add Solar Power Plant (produces Energy Cells) - Planned Ware
      const solarId = Object.keys(store.modules).find(id => id.includes('energycells'));
      if (solarId) {
        store.addModule(solarId, 1);
      }
    });
    
    // Wait for the UI to update
    await page.waitForSelector('.list-body .group-container .flow-wrapper', { timeout: 5000 });
  });

  test('Tooltip persistence on click', async ({ page }) => {
    // Find the favorite button for Energy Cells
    const flowItem = page.locator('.list-body .group-container .flow-wrapper').first();
    const favButton = flowItem.locator('.favorite-btn');
    
    await expect(favButton).toBeVisible();

    // 1. Hover to show tooltip
    await favButton.hover();
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]');
    await expect(tooltip).toBeVisible();

    // 2. Click and verify tooltip stays (hideOnClick: false)
    await favButton.click();
    await page.waitForTimeout(300); 
    await expect(tooltip).toBeVisible();
    
    // 3. Move mouse away to ensure it hides (standard hover behavior)
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await expect(tooltip).not.toBeVisible();
  });

  test('Lock button tooltip persistence', async ({ page }) => {
    const flowItem = page.locator('.list-body .group-container .flow-wrapper').first();
    const lockButton = flowItem.locator('.lock-btn');
    
    await expect(lockButton).toBeVisible();

    await lockButton.hover();
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]');
    await expect(tooltip).toBeVisible();
    
    await lockButton.click();
    await page.waitForTimeout(300);
    await expect(tooltip).toBeVisible();
    
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await expect(tooltip).not.toBeVisible();
  });

  test('Tooltip Layout and Content Filtering', async ({ page }) => {
    const flowItem = page.locator('.list-body .group-container .flow-wrapper').first();
    const favButton = flowItem.locator('.favorite-btn');
    
    await favButton.hover();
    const tooltip = page.locator('.tippy-box[data-theme~="x4"]');
    
    // Check for grid layout
    const firstRow = tooltip.locator('.priority-tooltip-row').first();
    await expect(firstRow).toHaveCSS('display', 'grid');
    
    // Check for 4 columns
    await expect(firstRow.locator('.icon-cell')).toBeVisible();
    await expect(firstRow.locator('.label-cell')).toBeVisible();
    await expect(firstRow.locator('.hours-cell')).toBeVisible();
    await expect(firstRow.locator('.desc-cell')).toBeVisible();

    // Check filtering: Energy Cells is a "Planned Ware" -> Available Levels [1, 2]
    // Tooltip should NOT show Level 0 row ("No Demand")
    await expect(tooltip.locator('.priority-tooltip-row')).toHaveCount(2);
    
    // Verify content of hours (Simplified display)
    const hoursText = await firstRow.locator('.hours-cell').innerText();
    expect(hoursText).toMatch(/\d+(\.\d+)?h/);
    expect(hoursText).not.toContain('+');
  });
  
  test('Pure Consumption Resource Interaction', async ({ page }) => {
     await page.evaluate(() => {
        const store = (window as any).store;
        store.clearAll();
        // Add module that consumes Ore (e.g. Refined Metals)
        const oreConsumer = Object.values(store.modules).find((m: any) => m.inputs && m.inputs.ore);
        if (oreConsumer) {
            store.addModule((oreConsumer as any).id, 1);
        }
     });
     
     // Wait for UI update
     await page.waitForTimeout(1000); // Give it a moment to render
     
     // Find Ore item. It should be in Resources group.
     const oreItem = page.locator('.flow-wrapper', { hasText: 'Ore' }).first();
     
     await expect(oreItem).toBeVisible({ timeout: 5000 });
     
     const favButton = oreItem.locator('.favorite-btn');
     
     // Verify it is functionally disabled
     await expect(favButton).toHaveClass(/disabled/);
     
     // Verify CSS: cursor-default
     await expect(favButton).toHaveCSS('cursor', 'default');
     
     // Verify opacity is NOT 0.3 (should be closer to 1)
     const opacity = await favButton.evaluate((el) => window.getComputedStyle(el).opacity);
     expect(parseFloat(opacity)).toBeGreaterThan(0.5);
     
     // Verify Tooltip appears
     await favButton.hover();
     const tooltip = page.locator('.tippy-box');
     await expect(tooltip).toBeVisible();
     
     // Verify Tooltip content: Only "No Demand" (Level 0)
     await expect(tooltip).toContainText('No Demand');
     // Should NOT contain "Primary"
     await expect(tooltip).not.toContainText('Primary');
  });
});
