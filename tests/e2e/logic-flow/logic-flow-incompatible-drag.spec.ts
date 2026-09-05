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

    await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
    await page.locator('.race-btn').filter({ hasText: /泰拉迪|Teladi/i }).click()
    const spaceweedSource = page.locator('.ware-card-wrapper[data-ware-id="spaceweed"]:visible').first();
    await spaceweedSource.scrollIntoViewIfNeeded();
    await expect(spaceweedSource).toBeVisible();

    const groupId = await page.evaluate(() => (window as any).logicFlowStore.groups[0]?.id)
    expect(groupId).toBeTruthy()
    await dragWareToTarget(page, 'spaceweed', { groupId }, { expectedStatus: 'normal' });
    await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toBeVisible();
    await expect(page.locator('.compact-group').first()).not.toHaveClass(/border-red-600/);
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().check({ force: true })
    await dragWareToTarget(page, 'energycells');

    await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
    await page.locator('.race-btn').filter({ hasText: /泰拉迪|Teladi/i }).click()
    const beforeNodes = await page.locator('.flow-node').count();
    const groupId = await page.evaluate(() => (window as any).logicFlowStore.groups[0]?.id)
    expect(groupId).toBeTruthy()
    await dragWareToTarget(page, 'spaceweed', { groupId }, { expectedStatus: 'rejected' });
    await expect(page.locator('.flow-node')).toHaveCount(beforeNodes);
  });
});
