import { test } from '../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './logic-flow/helpers/setupLogicFlow';

test.describe('Compact Drag View Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
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
      await page.mouse.move(100 + i * 50, 100 + i * 50, { steps: 5 });
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
      await page.mouse.move(100 + i * 50, 100 + i * 50, { steps: 5 });
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
