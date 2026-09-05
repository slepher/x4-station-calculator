import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { attemptWareDrag, dragWareToTarget, getGroupIdForWare } from './helpers/dragLogicFlow';

test.describe('Logic Flow Advanced Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  test('4.1 Visual: New Line Ghosting (Phantom Preview)', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts', 'new', { drop: false });
    const compactView = page.getByTestId('compact-view');
    const newZone = compactView.locator('.compact-group').last();
    await page.waitForTimeout(200);

    const previewTitle = page.locator('.compact-group').last().locator('span.italic');
    await expect(previewTitle).toBeVisible({ timeout: 5000 });
    await expect(previewTitle).toContainText(/Hull Part Production|船体部件产线/);

    const headerResources = page.locator('.compact-group').last().locator('.flex.items-center [data-ware-id]');
    await expect(headerResources).toHaveCount(2);

    const phantomNode = page.locator('.compact-node.animate-pulse');
    await expect(phantomNode).toBeVisible();
    await expect(phantomNode).toContainText(/Hull Part Production|船体部件产线/);

    await page.mouse.up();
  });

  test('4.2 Visual: Real-time T0 Resource Header Updates', async ({ page }) => {
    await dragWareToTarget(page, 'siliconwafers');

    const groupId = await getGroupIdForWare(page, 'siliconwafers');
    const { targetLocator: compactGroup } = await dragWareToTarget(page, 'microchips', { groupId }, { drop: false });

    const initialRes = page.locator('.compact-group [data-ware-id="silicon"]');
    await expect(initialRes).toHaveCount(1);

    await page.mouse.up();
    await page.waitForTimeout(100);

    await dragWareToTarget(page, 'hullparts', { groupId }, { drop: false });

    const pulsingResources = page.locator('.compact-group .flex.items-center [data-ware-id].animate-pulse');
    await expect(pulsingResources).toHaveCount(2);

    await page.mouse.up();
  });

  test('4.5 End-to-End: Final State Verification', async ({ page }) => {
    await test.step('Case A: Drag to existing group', async () => {
      await dragWareToTarget(page, 'scanningarrays');
      const groupId = await getGroupIdForWare(page, 'scanningarrays');
      await dragWareToTarget(page, 'microchips', { groupId });

      const nodes = page.locator('.flow-node[data-ware-id="microchips"]');
      await expect(nodes).toBeVisible();

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);
    });

    await test.step('Case B: Drag to New Zone', async () => {
      await dragWareToTarget(page, 'scanningarrays', 'new', { drop: false });
      await page.waitForTimeout(200);

      await page.mouse.up();
      await page.waitForTimeout(300);

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);
    });
  });

  test('4.6 T0 Ware Behavior: Non-draggable and No Preview', async ({ page }) => {
    const oreCard = page.locator('.ware-card-wrapper[data-ware-id="ore"]');
    await expect(oreCard).toBeVisible();

    const resourcePreview = oreCard.locator('.resource-preview-container');
    await expect(resourcePreview).toBeHidden();

    const siliconWafersCard = page.locator('.ware-card-wrapper[data-ware-id="siliconwafers"]');
    await siliconWafersCard.scrollIntoViewIfNeeded();
    await expect(siliconWafersCard).toBeVisible();
    await expect(siliconWafersCard.locator('.resource-preview-container')).toBeVisible();

    await attemptWareDrag(page, 'ore');
  });

  test('4.7 Visual: Dependency-Follow Sorting - Refined Metals first', async ({ page }) => {
    await dragWareToTarget(page, 'refinedmetals');
    const groupId = await getGroupIdForWare(page, 'refinedmetals');
    await dragWareToTarget(page, 'siliconwafers', { groupId });

    await dragWareToTarget(page, 'energycells', { groupId }, { drop: false });
    const resources = page.locator('.compact-group .flex.items-center [data-ware-id]');
    await expect(resources).toHaveCount(2);
    const ids = await resources.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
    expect(ids).toEqual(['ore', 'silicon']);
    await page.mouse.up();
  });

  test('4.7 Visual: Dependency-Follow Sorting - Silicon Wafers first', async ({ page }) => {
    await dragWareToTarget(page, 'siliconwafers');
    const groupId = await getGroupIdForWare(page, 'siliconwafers');
    await dragWareToTarget(page, 'refinedmetals', { groupId });

    await dragWareToTarget(page, 'energycells', { groupId }, { drop: false });
    const resources = page.locator('.compact-group .flex.items-center [data-ware-id]');
    await expect(resources).toHaveCount(2);
    const ids = await resources.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
    expect(ids).toEqual(['silicon', 'ore']);
    await page.mouse.up();
  });
});
