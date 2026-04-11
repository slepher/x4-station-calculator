import { test, expect } from '@playwright/test';

test.describe('Logic Flow Incompatible Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
      window.localStorage.setItem('x4_station_active_view', 'flow');
    });

    await page.goto('./?test=true');
    
    await page.waitForFunction(() => {
      const logicFlow = (window as any).logicFlowStore;
      const gameData = (window as any).gameDataStore;
      return logicFlow && gameData && gameData.isReady;
    }, { timeout: 20000 });

    await expect(page.locator('.candidate-zone')).toBeVisible({ timeout: 15000 });
  });

  const dragWareToTarget = async (
    page: any, 
    wareId: string, 
    targetSelector: string,
    options: { drop?: boolean; hoverOnly?: boolean } = {}
  ) => {
    const { drop = true, hoverOnly = false } = options;
    const source = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
    await expect(source).toBeVisible();

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error(`Source ware ${wareId} not found`);

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const target = page.locator(targetSelector).first();
    await expect(target).toBeVisible({ timeout: 5000 });

    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error(`Target ${targetSelector} not found`);

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    if (hoverOnly) {
      return { sourceBox, targetBox };
    }

    if (drop) {
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    return { sourceBox, targetBox };
  };

  test('4.16 UI: Incompatible Drop Target Visibility (Unlocked Group)', async ({ page }) => {
    await dragWareToTarget(page, 'energycells', '.groups-list .drop-target');

    const spaceweedSource = page.locator('.ware-card[data-ware-id="spaceweed"]').first();
    await spaceweedSource.scrollIntoViewIfNeeded();
    await expect(spaceweedSource).toBeVisible();

    const sourceBox = await spaceweedSource.boundingBox();
    if (!sourceBox) throw new Error('Spaceweed source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const compactGroup = page.locator('.compact-group').first();
    const targetBox = await compactGroup.boundingBox();
    if (!targetBox) throw new Error('Target not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    await expect(compactGroup).toHaveClass(/opacity-20/);
    await expect(compactGroup).toHaveClass(/grayscale/);
    await expect(compactGroup).toHaveClass(/pointer-events-none/);
    await expect(compactGroup).toHaveClass(/border-transparent/);

    await expect(compactGroup).not.toHaveClass(/border-red-600/);

    await page.mouse.up();
  });

  test('4.17 UI: Locked Group Conflict Feedback (Locked Group)', async ({ page }) => {
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.isDefaultLocked = true;
    });

    await dragWareToTarget(page, 'energycells', '.groups-list .drop-target');

    const group = page.locator('.compact-group').first();
    await expect(group).toBeVisible();
    await expect(group).toHaveClass(/border-amber-500\/50/);

    const hullpartsSource = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await hullpartsSource.scrollIntoViewIfNeeded();
    await expect(hullpartsSource).toBeVisible();

    const sourceBox = await hullpartsSource.boundingBox();
    if (!sourceBox) throw new Error('Hullparts source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
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
