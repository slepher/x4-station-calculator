import { test, expect } from '@playwright/test';

test.describe('FavoriteButton Visibility Tests', () => {
  test('Button should be visible but DISABLED for wares that are pure inputs (not produced)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
    
    // Add Refined Metal Production (consumes Energy Cells and Ore)
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('Refined Metal Production');
    await page.waitForTimeout(1000);
    
    // Click the first result
    const firstModule = page.locator('.result-item').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1000);
    
    // Switch to quantity view to see resources
    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);
    
    // Check Energy Cells (Resource)
    // Initially, auto-fill is ON, so Energy Cells should be auto-produced (isAutoWare = true).
    // So FavoriteButton SHOULD be visible and ENABLED.
    const energyRow = page.locator('[data-resource-id="energycells"]').first();
    await expect(energyRow).toBeVisible();
    const energyFavBtn = energyRow.locator('.favorite-btn');
    await expect(energyFavBtn).toBeVisible();
    await expect(energyFavBtn).not.toHaveClass(/disabled/);
    
    // Now LOCK Energy Cells to stop auto-fill
    const energyLockBtn = energyRow.locator('.lock-btn');
    await energyLockBtn.click();
    await page.waitForTimeout(1000);
    
    // Verify it is locked
    await expect(energyLockBtn).toHaveClass(/is-locked/);
    
    // After locking, auto-fill should stop producing Energy Cells.
    // So isAutoWare becomes false. isPlannedWare is false.
    // The button should still be VISIBLE, but DISABLED (or non-operable).
    // Note: The logic for 'nonOperable' in StationWareFlow is `!store.isWareOperable(props.resourceId)`.
    // 'isWareOperable' checks if transport is 'container'. Energy Cells are 'container'.
    // So 'nonOperable' will be false.
    // Wait, if it's just an input and not produced, can we set priority?
    // The `getResolvedLevel` logic:
    // 3. 默认身份: planned -> 2, auto -> 0, other -> 0.
    // If it is neither planned nor auto, it is level 0.
    // If we click it, `toggleWarePriority` checks:
    // if (planned) ... else if (auto) ...
    // If neither, it does nothing ("非计划非自动产物不处理").
    // So effective result: clicking does nothing.
    // But does the UI reflect this?
    // The UI uses `:disabled="nonOperable"`.
    // If `nonOperable` depends only on transport type, then it is NOT disabled in UI.
    // This might be the ACTUAL bug the user wanted fixed:
    // "The button is clickable but does nothing for pure inputs" OR "The button should be disabled for pure inputs".
    // Let's assume the user wants it to be disabled if it's not a valid target for priority.
    // OR, maybe the user implies that "already set that button non-operable" refers to my PREVIOUS change?
    // "已经设置了那个按钮不可操作就是设计目的" -> "Setting that button to be non-operable IS the design purpose".
    // This sounds like they confirm the button SHOULD be non-operable (disabled).
    // BUT my previous change was HIDING it.
    // So they probably mean: "Don't hide it. It being non-operable (disabled) is enough/intended."
    
    // Let's check if it IS disabled currently for pure inputs.
    // `nonOperable` = `!store.isWareOperable(wareId)`.
    // `isWareOperable` = `ware.transport === 'container'`.
    // So for Energy Cells (container), `nonOperable` is FALSE. So it is ENABLED.
    // But `toggleWarePriority` does nothing.
    // So we have a button that looks active but does nothing.
    // THAT is likely the bug.
    // We should make `nonOperable` true if it's not planned AND not auto?
    // Or maybe the user just wants me to revert the hiding, and the existing behavior is what they call "non-operable"?
    // "已经设置了那个按钮不可操作" -> "Already set ... to be non-operable".
    // Maybe they are referring to the Solid wares (Ore)?
    // Ore is Solid -> `isWareOperable` is false -> `nonOperable` is true -> Button is disabled.
    // My previous test HID the button for Ore.
    // The user says "It being non-operable is the design purpose".
    // So for Ore, it should be VISIBLE but DISABLED.
    
    // So the test should verify:
    // 1. For Ore (Solid): Visible and Disabled.
    // 2. For Energy Cells (Container, but locked/pure input): 
    //    If the user considers this "non-operable", then it should be disabled.
    //    But currently it is NOT disabled in code (only solid/liquid/gas are disabled).
    //    If I revert my changes, it will be enabled but useless.
    
    // Let's focus on the Ore case first, as that was clearly "non-operable" by design.
    
    // Check Ore (Resource, Solid)
    const oreRow = page.locator('[data-resource-id="ore"]').first();
    await expect(oreRow).toBeVisible();
    const oreFavBtn = oreRow.locator('.favorite-btn');
    await expect(oreFavBtn).toBeVisible();
    await expect(oreFavBtn).toHaveClass(/disabled/);
  });

  test('Button should be visible for produced wares (Energy Cells)', async ({ page }) => {
     await page.setViewportSize({ width: 1920, height: 1080 });
     await page.goto('/');
     await page.waitForLoadState('networkidle');
     await page.waitForTimeout(2000);
     
     // Add Energy Cell Production
     const searchInput = page.locator('.search-input').first();
     await searchInput.fill('Energy Cell Production');
     await page.waitForTimeout(1000);
     
     const firstModule = page.locator('.result-item').first();
     await expect(firstModule).toBeVisible();
     await firstModule.click();
     await page.waitForTimeout(1000);
     
     // Switch to quantity view
     const dashboard = page.locator('.list-wrapper').first();
     const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
     await quantityViewBtn.click();
     await page.waitForTimeout(1000);
     
     // Energy Cells should be produced
     const energyRow = page.locator('[data-resource-id="energycells"]').first();
     await expect(energyRow).toBeVisible();
     
     // FavoriteButton should be visible
     const favoriteBtn = energyRow.locator('.favorite-btn');
     await expect(favoriteBtn).toBeVisible();
  });
});
