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

    const sourceBox = await spaceweedSource.boundingBox();
    if (!sourceBox) throw new Error('Spaceweed source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2, { steps: 5 });
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5, { steps: 5 });
    await page.waitForTimeout(100);

    const compactGroup = page.locator('.compact-group').first();
    const targetBox = await compactGroup.boundingBox();
    if (!targetBox) throw new Error('Target not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
    await expect(compactGroup).toHaveClass(/border-red-600/);
    await expect(compactGroup.getByTestId('rejected-label')).toBeVisible();

    await page.mouse.up();
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    await dragWareToTarget(page, 'energycells');

    const group = page.locator('.compact-group').first();
    await expect(group).toBeVisible();
    await expect(group).toHaveClass(/border-amber-500\/50/);

    const hullpartsSource = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]').first();
    await hullpartsSource.scrollIntoViewIfNeeded();
    await expect(hullpartsSource).toBeVisible();

    const sourceBox = await hullpartsSource.boundingBox();
    if (!sourceBox) throw new Error('Hullparts source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2, { steps: 5 });
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5, { steps: 5 });
    await page.waitForTimeout(100);

    const targetBox = await group.boundingBox();
    if (!targetBox) throw new Error('Target not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    await expect(group).toHaveClass(/border-red-600/);
    await expect(group).toHaveClass(/bg-red-900\/10/);

    await expect(group).not.toHaveClass(/opacity-20/);
    await expect(group).not.toHaveClass(/grayscale/);

    const rejectedLabel = group.locator('[data-testid="rejected-label"]');
    await expect(rejectedLabel).toBeVisible();
    await expect(rejectedLabel).toContainText(/Rejected|拒绝|🚫/i);

    await page.mouse.up();
  });
});
