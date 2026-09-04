import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { dragWareToTarget } from './helpers/dragLogicFlow';

test.describe('Logic Flow Incompatible Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  test('4.16 UI: Incompatible Drop Target Visibility (Unlocked Group)', async ({ page }) => {
    await dragWareToTarget(page, 'energycells');

    const spaceweedSource = page.locator('.ware-card-wrapper[data-ware-id="spaceweed"]').first();
    await spaceweedSource.scrollIntoViewIfNeeded();
    await expect(spaceweedSource).toBeVisible();

    await dragWareToTarget(page, 'spaceweed', 0, { expectRejected: true });
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    await dragWareToTarget(page, 'energycells');

    const group = page.locator('.compact-group').first();
    await expect(group).toBeVisible();
    await expect(group).toHaveClass(/border-amber-500\/50/);

    const hullpartsSource = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]').first();
    await hullpartsSource.scrollIntoViewIfNeeded();
    await expect(hullpartsSource).toBeVisible();

    await dragWareToTarget(page, 'hullparts', 0, { drop: false, expectRejected: true });
    await expect(group).toHaveClass(/bg-red-900\/10/);

    await expect(group).not.toHaveClass(/opacity-20/);
    await expect(group).not.toHaveClass(/grayscale/);

    const rejectedLabel = group.locator('[data-testid="rejected-label"]');
    await expect(rejectedLabel).toBeVisible();
    await expect(rejectedLabel).toContainText(/Rejected|拒绝|🚫/i);

    await page.mouse.up();
  });
});
