import { test } from '../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './logic-flow/helpers/setupLogicFlow';
import { dragWareToTarget } from './logic-flow/helpers/dragLogicFlow';

test.describe('Compact Drag View Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  test('Compact view toggles on drag start and end', async ({ page }) => {
    await dragWareToTarget(page, 'energycells', 'new', { drop: false });
    await expect(page.getByTestId('compact-view')).toBeVisible();
    await page.mouse.up();
    await expect(page.locator('.production-group')).toBeVisible();
    await expect(page.locator('[data-ware-id="energycells"]').first()).toBeVisible();
  });

  test('Drag ware to existing group in compact view', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts');
    await dragWareToTarget(page, 'energycells', 0);
    await expect(page.locator('.production-group .flow-node[data-ware-id="energycells"]')).toBeVisible();
  });
});
