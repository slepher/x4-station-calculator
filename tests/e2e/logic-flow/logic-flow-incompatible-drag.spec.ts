import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { dragWareToTarget } from './helpers/dragLogicFlow';

test.describe('Logic Flow Incompatible Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  test('4.16 UI: Incompatible Drop Target Visibility (Unlocked Group)', async ({ page }) => {
    const defaultLock = page.locator('input[type="checkbox"]').first()
    await defaultLock.uncheck({ force: true })
    await dragWareToTarget(page, 'energycells');

    const spaceweedSource = page.locator('.ware-card-wrapper[data-ware-id="spaceweed"]').first();
    await spaceweedSource.scrollIntoViewIfNeeded();
    await expect(spaceweedSource).toBeVisible();

    await dragWareToTarget(page, 'spaceweed', 0, { expectedStatus: 'normal' });
    await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toBeVisible();
    await expect(page.locator('.compact-group').first()).not.toHaveClass(/border-red-600/);
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().check({ force: true })
    await dragWareToTarget(page, 'energycells');

    const beforeNodes = await page.locator('.flow-node').count();
    await dragWareToTarget(page, 'spaceweed', 0, { expectedStatus: 'rejected' });
    await expect(page.locator('.flow-node')).toHaveCount(beforeNodes);
  });
});
