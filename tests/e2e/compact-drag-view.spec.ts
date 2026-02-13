import { test, expect } from '@playwright/test';

test.describe('Compact Drag View Integration', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('x4_station_active_view', 'flow');
      (window as any).isTestEnv = true;
    });
    await page.goto('/');
    
    // Explicitly set activeView via store to be sure
    await page.evaluate(() => {
      if ((window as any).stationStore) {
        (window as any).stationStore.activeView = 'flow';
      }
    });

    // Wait for store to be ready and candidate zone to be visible
    await page.waitForSelector('.station-workbench', { timeout: 15000 });
    await page.waitForSelector('.candidate-zone', { state: 'visible', timeout: 15000 });
  });

  test('Compact view toggles on drag start and end', async ({ page }) => {
    // 0. Setup: Create a group first
    await page.evaluate(() => {
      (window as any).logicFlowStore.clearAllGroups();
      (window as any).logicFlowStore.addGroup('industrial', 'default', 'Test Group');
    });
    
    // 1. Start dragging a ware
    const energyCells = page.locator('[data-ware-id="energycells"]').first();
    await energyCells.hover();
    await page.mouse.down();
    
    // Move mouse slowly to trigger drag
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 50, 100 + i * 50);
      await page.waitForTimeout(50);
    }

    // 2. Verify compact view is visible
    await expect(page.locator('.compact-view')).toBeVisible();
    
    // 3. Release mouse
    await page.mouse.up();

    // 4. Verify regular view is restored
    await expect(page.locator('.production-group')).toBeVisible();
    
    // 5. Verify candidate card still exists (Clone logic)
    await expect(energyCells).toBeVisible();
  });

  test('Compact view shows vertical list with existing groups and new line button', async ({ page }) => {
    // 0. Setup: Create 2 groups
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.clearAllGroups();
      logicFlow.addGroup('industrial', 'default', 'Group 1');
      logicFlow.addGroup('industrial', 'default', 'Group 2');
    });

    // 1. Start drag
    const card = page.locator('[data-ware-id="energycells"]').first();
    await card.hover();
    await page.mouse.down();
    
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 50, 100 + i * 50);
      await page.waitForTimeout(50);
    }

    // 2. Verify vertical layout (No grid, just actual groups + 1 new line button)
    const compactView = page.locator('.compact-view');
    await expect(compactView).toBeVisible();
    await expect(compactView).toHaveCSS('display', 'flex');
    await expect(compactView).toHaveCSS('flex-direction', 'column');
    
    // Should have exactly 3 items: 2 groups + 1 new line drop zone
    const items = compactView.locator('.compact-group');
    await expect(items).toHaveCount(3); 
    
    // The "New Production Line" area should be at the bottom
    const lastItem = items.last();
    await expect(lastItem).toContainText(/DROP TO CREATE/i);

    await page.mouse.up();
  });

  test('Drag ware to existing group in compact view', async ({ page }) => {
    // 0. Setup: Ensure we have a group
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.clearAllGroups();
      logicFlow.addGroup('industrial', 'default', 'Test Group');
    });

    // 1. Perform drag
    const energyCells = page.locator('[data-ware-id="energycells"]').first();
    await energyCells.hover();
    await page.mouse.down();
    
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 50, 100 + i * 50);
      await page.waitForTimeout(50);
    }

    // 2. Verify compact view
    const compactGroup = page.locator('.compact-group').first();
    await expect(compactGroup).toBeVisible();

    // 3. Drop into compact group
    const box = await compactGroup.boundingBox();
    if (!box) throw new Error('Compact group box not found');
    
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();

    // 4. Verify store update
    await page.waitForFunction(() => {
      const group = (window as any).logicFlowStore.groups[0];
      return group && group.nodes.some((n: any) => n.wareId === 'energycells');
    }, { timeout: 5000 });
  });
});
