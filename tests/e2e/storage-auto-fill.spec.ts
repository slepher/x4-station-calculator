import { test, expect } from '@playwright/test';

test.describe('Storage Auto-Fill Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state
    await page.goto('/');
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    await page.reload();
    // Disable animations for speed
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.waitForSelector('.module-list-container', { state: 'visible' });
  });

  test('Case 1: Basic Storage Auto-Fill', async ({ page }) => {
    // Wait for the application to load
    await page.waitForSelector('.module-list-container', { state: 'visible' });
    
    // 1. Add Energy Cell Production
    const searchInput = page.locator('input.search-input').first();
    await expect(searchInput).toBeVisible();
    await searchInput.click();
    
    // Explicitly focus and dispatch focus event to ensure isFocused=true
    await searchInput.evaluate(e => {
        e.focus();
        e.dispatchEvent(new Event('focus'));
    });
    
    await searchInput.fill('Energy Cell');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    await page.waitForTimeout(100);
    
    // Wait for results to appear
    const resultItem = page.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 500 });
    
    // Click the first production module result
    await resultItem.click();

    // 2. Check for Auto Storage (Container) in Auto Industry section
    // The storage should appear in the ".tier-section.tier-auto"
    const autoSection = page.locator('.tier-section.tier-auto').first();
    await expect(autoSection).toBeVisible();

    // Look for L Container Storage within this section
    // StationPlanningItem uses .module-row, checking for text
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ });
    await expect(containerStorage.first()).toBeVisible();
  });

  test('Case 2: Race Preference Change', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' });

    // 1. Add a module first to trigger auto-fill
    const searchInput = page.locator('input.search-input').first();
    await searchInput.click();
    await searchInput.fill('Energy Cell');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    await page.waitForTimeout(100);
    
    const resultItem = page.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 1000 });
    await resultItem.click();

    // 2. Change Race Preference
    // The race selector is in the tier header of Auto Industry
    const raceSelect = page.locator('select.race-select');
    await raceSelect.selectOption('terran');

    // 3. Check for Terran Storage
    const autoSection = page.locator('.tier-section.tier-auto').first();
    await expect(autoSection.locator('.module-row').filter({ hasText: /Terran|地球人/ }).first()).toBeVisible();
  });

  test('Case 3: Incremental Fill', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' });

    // 1. Add Energy Cells to trigger auto-fill
    const searchInput = page.locator('input.search-input').first();
    await searchInput.click();
    await searchInput.fill('Energy Cell');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    await page.waitForTimeout(100);
    const resultItem = page.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 1000 });
    await resultItem.click();

    // 2. Get initial Auto Storage count
    // Wait for auto section
    const autoSection = page.locator('.tier-section.tier-auto').first();
    await expect(autoSection).toBeVisible();
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ });
    await expect(containerStorage.first()).toBeVisible();
    
    // Helper to get count from the module item
    const getStorageCount = async () => {
       const countEl = containerStorage.first().locator('.count-text');
       if (await countEl.isVisible()) {
           const text = await countEl.innerText();
           return parseInt(text.trim());
       }
       // If count badge is not visible, it means count is 1
       return 1;
    };

    const initialCount = await getStorageCount();
    expect(initialCount).toBeGreaterThan(0);

    // 3. Add Manual Storage (Container Storage L)
    // Clear search and search for storage
    await searchInput.click();
    await searchInput.press('Control+A');
    await searchInput.press('Backspace');
    await searchInput.fill('Storage'); // Broad search
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    
    // Pick the first result (likely Container Storage S or L)
    const storageResult = page.locator('.result-item').first();
    await expect(storageResult).toBeVisible({ timeout: 2000 }); // Search latency
    await storageResult.click();

    // 4. Verify Auto Storage count decreases (or disappears if fully covered)
    // Wait a bit for reactivity
    await page.waitForTimeout(500);
    
    if (await containerStorage.first().isVisible()) {
        const newCount = await getStorageCount();
        expect(newCount).toBeLessThan(initialCount);
    } else {
        // Disappeared means 0, which is less than initialCount
        expect(true).toBe(true);
    }
  });

  test('Case 4: Buffer Response', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' });

    // 1. Add Energy Cells
    const searchInput = page.locator('input.search-input').first();
    await searchInput.click();
    await searchInput.fill('Energy Cell');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    await page.waitForTimeout(100);
    
    const resultItem = page.locator('.result-item').first();
    await expect(resultItem).toBeVisible({ timeout: 1000 });
    await resultItem.click();

    // 2. Switch to Volume View to see Sliders
    // Located in StationOutputPanel usually, button logic from buffer-logic.spec.ts
    const dashboard = page.locator('.list-wrapper').first(); // Assuming list-wrapper contains the buttons
    // We might need to be more specific if .list-wrapper is ambiguous
    // Try finding the button by title or icon if possible, but index 2 is Volume (0:Qty, 1:Eco, 2:Vol)
    const volumeViewBtn = page.locator('.view-mode-btn').nth(2); 
    await volumeViewBtn.click();
    await page.waitForTimeout(200);

    // 3. Locate Primary Product Buffer Slider
    // Text matching can be flaky due to case/layout, so we use the input type directly.
    // Order: Resource(0), Primary Product(1), Secondary Product(2)
    const sliderInput = page.locator('input[type="range"]').nth(1);
    await expect(sliderInput).toBeVisible();
    
    // 4. Get initial storage count
    // Switch back to Module List? No, Auto Storage is in Planning Panel (Left/Top), Sliders in Output Panel (Right/Bottom)
    // StationPlanningPanel is always visible.
    const autoSection = page.locator('.tier-section.tier-auto').first();
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ });
    await expect(containerStorage.first()).toBeVisible();
    
    const getStorageCount = async () => {
       const countEl = containerStorage.first().locator('.count-text');
       if (await countEl.isVisible()) {
           const text = await countEl.innerText();
           return parseInt(text.trim());
       }
       return 1;
    };
    
    const initialCount = await getStorageCount();

    // 5. Increase Buffer (e.g. to max)
    await sliderInput.evaluate((el: HTMLInputElement) => {
        el.value = '24'; // Max
        el.dispatchEvent(new Event('input'));
        el.dispatchEvent(new Event('change'));
    });

    // 6. Verify Storage Count Increases
    await page.waitForTimeout(1000); // Wait for debounced calculation
    const newCount = await getStorageCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('Case 5: AutoSupply Storage', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' });

    // 1. Add Hull Parts Production (needs Refined Metals, Graphene, Energy Cells)
    const searchInput = page.locator('input.search-input').first();
    await searchInput.click();
    await searchInput.fill('Hull');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    await page.waitForTimeout(500); // Wait for search debounce and render

    const resultItem = page.locator('.result-item').first();   
    await expect(resultItem).toBeVisible({ timeout: 1000 });   
    await resultItem.click();

    // 2. Enable Auto Workforce & Internal Supply
    // These are usually in StationToolbar or Settings
    // For this test, we assume default settings or use sliders if needed.
    // However, storage auto-fill for supply depends on "complete chain" or explicit supply.
    // If we just added Hull Parts, we have demand for Refined Metals etc.
    // Auto-fill should provide Container Storage for them.
    
    // Check if Container Storage is present
    const autoSection = page.locator('.tier-section.tier-auto').first();
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ });
    await expect(containerStorage.first()).toBeVisible();
    
    // 3. Add Supply Module (Refined Metals)
    await searchInput.click();
    await searchInput.press('Control+A');
    await searchInput.press('Backspace');
    await searchInput.fill('Refined');
    await searchInput.evaluate(e => e.dispatchEvent(new Event('input')));
    
    const supplyItem = page.locator('.result-item').first();
    await expect(supplyItem).toBeVisible({ timeout: 2000 });
    await supplyItem.click();
    
    // 4. Verify Storage might change (depending on volume balance)
    // Refined Metals is Solid? No, Container. Ore is Solid.
    // Refined Metals takes Ore (Solid) + Energy (Container). Produces Refined Metals (Container).
    // Hull Parts takes Refined Metals (Container) + Graphene (Container) + Energy (Container).
    // So everything is Container except Ore.
    
    // If we add Refined Metals module, we now need Ore storage (Solid).
    // So Solid Storage should appear in Auto Fill.
    
    const solidStorage = autoSection.locator('.module-row').filter({ hasText: /Solid Storage|固体仓储/ });
    await expect(solidStorage.first()).toBeVisible();
  });
});
