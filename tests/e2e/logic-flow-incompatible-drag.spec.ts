import { test, expect } from '@playwright/test';

test.describe('Logic Flow Incompatible Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG]')) {
        console.log(`PAGE CONSOLE: ${msg.text()}`);
      }
    });
    // Inject test environment flag and pre-set view BEFORE navigation
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
      window.localStorage.setItem('x4_station_active_view', 'flow');
    });

    // Navigate with test=true to ensure store exposure
    await page.goto('./?test=true');
    
    // Ensure store is ready
    await page.waitForFunction(() => {
      const logicFlow = (window as any).logicFlowStore;
      const gameData = (window as any).gameDataStore;
      return logicFlow && gameData && gameData.isReady;
    }, { timeout: 20000 });
  });

  test('4.16 UI: Incompatible Drop Target Visibility (Unlocked Group)', async ({ page }) => {
    // 1. Create an Industrial group (default)
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = [];
      logicFlow.addGroup('industrial', 'default', 'Industrial Group');
    });

    // 2. Simulate dragging an Agricultural item (Spaceweed)
    // Spaceweed is typically agricultural and incompatible with industrial groups
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.isDragging = true;
      logicFlow.draggingWareId = 'spaceweed'; 
    });

    // 3. Verify the Industrial group is visually disabled/hidden
    const group = page.locator('.compact-group').first();
    await expect(group).toBeVisible();
    
    // Check for the specific classes that indicate it's disabled/hidden
    await expect(group).toHaveClass(/opacity-20/);
    await expect(group).toHaveClass(/grayscale/);
    await expect(group).toHaveClass(/pointer-events-none/);
    await expect(group).toHaveClass(/border-transparent/);

    // Verify it does NOT have the red error border
    await expect(group).not.toHaveClass(/border-red-600/);
    
    // Verify the "Rejected" label is NOT visible (since the whole group is dimmed, we might not show the label explicitly or it might be there but the user ignores it because it's dimmed. 
    // Actually, the code logic for label is: v-if="isRejected(...)". 
    // Since it IS rejected, the label WILL be in the DOM.
    // But the group container itself is dimmed.
    // The requirement was "not appear as valid drop targets".
    // The user didn't explicitly say "hide the rejected label", but the visual style `opacity-20` handles the "dimmed" part.
    // Let's verify the label is present (as per code) but the container is dimmed.
    const rejectedLabel = group.locator('[data-testid="rejected-label"]');
    await expect(rejectedLabel).toBeVisible(); 
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    // 1. Setup: Create a locked industrial group (Terran)
    const storeState = await page.evaluate(async () => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = []; // Clear existing groups
      // Use the isLocked parameter in addGroup
      const group = logicFlow.addGroup('industrial', 'terran', 'Terran Group', true);
      
      // Wait for Vue to process the state change
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        id: group.id,
        isLocked: group.isLocked,
        numGroups: logicFlow.groups.length
      };
    });
    console.log('STORE STATE AFTER ADD:', storeState);

    // 2. Get group locator and verify locked state is rendered BEFORE dragging
    const group = page.locator('.compact-group').first();
    await expect(group).toBeVisible();
    // A locked (but not yet rejected) group should have an amber border. This wait is critical for sync.
    await expect(group).toHaveClass(/border-amber-500\/50/);

    // 3. Start dragging an incompatible ware (Hull Parts - Commonwealth)
    await page.evaluate(async () => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.isDragging = true;
      logicFlow.draggingWareId = 'hullparts';
      // Wait for Vue
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // 4. Verify the Group shows RED rejection border
    await expect(group).toBeVisible();

    // Check for the red border classes
    await expect(group).toHaveClass(/border-red-600/);
    await expect(group).toHaveClass(/bg-red-900\/10/);

    // Verify it does NOT have the dimmed classes
    await expect(group).not.toHaveClass(/opacity-20/);
    await expect(group).not.toHaveClass(/grayscale/);

    // Verify "Rejected" label is visible
    const rejectedLabel = group.locator('[data-testid="rejected-label"]');
    await expect(rejectedLabel).toBeVisible();
    await expect(rejectedLabel).toContainText(/Rejected|拒绝|🚫/i);
  });
});
