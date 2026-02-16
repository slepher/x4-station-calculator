import { test, expect } from '@playwright/test';

test.describe('Logic Flow Advanced Drag Feedback', () => {
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

  test('4.1 Visual: New Line Ghosting (Phantom Preview)', async ({ page }) => {
    const source = page.locator('.ware-card[data-ware-id="scanningarrays"]').first();
    await expect(source).toBeVisible();

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error('Source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const compactView = page.locator('.compact-view');
    await expect(compactView).toBeVisible({ timeout: 5000 });

    const newZone = compactView.locator('.compact-group').last();
    const newZoneBox = await newZone.boundingBox();
    if (!newZoneBox) throw new Error('New zone not found');

    await page.mouse.move(newZoneBox.x + newZoneBox.width / 2, newZoneBox.y + newZoneBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    const previewTitle = page.locator('span:has-text("Preview:")');
    await expect(previewTitle).toBeVisible({ timeout: 5000 });
    await expect(previewTitle).toContainText(/Scanning Array|扫描阵列/i);

    const headerResources = page.locator('.compact-group:has-text("Preview:") .flex.items-center [data-ware-id]');
    await expect(headerResources).toHaveCount(2);

    const phantomNode = page.locator('.compact-node.animate-pulse');
    await expect(phantomNode).toBeVisible();

    await page.mouse.up();
  });

  test('4.2 Visual: Real-time T0 Resource Header Updates', async ({ page }) => {
    await dragWareToTarget(page, 'siliconwafers', '.groups-list .drop-target');

    const source = page.locator('.ware-card[data-ware-id="microchips"]').first();
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error('Source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const compactGroup = page.locator('.compact-group').first();
    const targetBox = await compactGroup.boundingBox();
    if (!targetBox) throw new Error('Target not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    const initialRes = page.locator('.compact-group [data-ware-id="silicon"]');
    await expect(initialRes).toHaveCount(1);

    await page.mouse.up();
    await page.waitForTimeout(100);

    const hullSource = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    const hullSourceBox = await hullSource.boundingBox();
    if (!hullSourceBox) throw new Error('Hull parts source not found');

    await page.mouse.move(hullSourceBox.x + hullSourceBox.width / 2, hullSourceBox.y + hullSourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(hullSourceBox.x + hullSourceBox.width / 2 + 5, hullSourceBox.y + hullSourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);

    const pulsingResources = page.locator('.compact-group .flex.items-center [data-ware-id].animate-pulse');
    await expect(pulsingResources).toHaveCount(2);

    await page.mouse.up();
  });

  test('4.5 End-to-End: Final State Verification', async ({ page }) => {
    await test.step('Case A: Drag to existing group', async () => {
      await dragWareToTarget(page, 'scanningarrays', '.groups-list .drop-target');
      await dragWareToTarget(page, 'microchips', '.compact-group');

      const nodes = page.locator('.flow-node[data-ware-id="microchips"]');
      await expect(nodes).toBeVisible();

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);
    });

    await test.step('Case B: Drag to New Zone', async () => {
      const source = page.locator('.ware-card[data-ware-id="scanningarrays"]').first();
      await expect(source).toBeVisible();

      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const newZone = compactView.locator('.compact-group').last();
      const newZoneBox = await newZone.boundingBox();
      if (!newZoneBox) throw new Error('New zone not found');

      await page.mouse.move(newZoneBox.x + newZoneBox.width / 2, newZoneBox.y + newZoneBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      await page.mouse.up();
      await page.waitForTimeout(300);

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);
    });
  });

  test('4.6 T0 Ware Behavior: Non-draggable and No Preview', async ({ page }) => {
    const oreCard = page.locator('.ware-card[data-ware-id="ore"]');
    await expect(oreCard).toBeVisible();

    const resourcePreview = oreCard.locator('.resource-preview-container');
    await expect(resourcePreview).toBeHidden();

    const siliconWafersCard = page.locator('.ware-card[data-ware-id="siliconwafers"]');
    await siliconWafersCard.scrollIntoViewIfNeeded();
    await expect(siliconWafersCard).toBeVisible();
    await expect(siliconWafersCard.locator('.resource-preview-container')).toBeVisible();

    const oreBox = await oreCard.boundingBox();
    if (!oreBox) throw new Error('Ore card not found');

    await page.mouse.move(oreBox.x + oreBox.width / 2, oreBox.y + oreBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(oreBox.x + oreBox.width / 2 + 100, oreBox.y + oreBox.height / 2 + 100);
    await page.waitForTimeout(300);

    const compactView = page.locator('.compact-view');
    await expect(compactView).toHaveCount(0);

    await page.mouse.up();
  });

  test('4.7 Visual: Dependency-Follow Sorting', async ({ page }) => {
    await test.step('Case 1: Refined Metals first, then Silicon Wafers', async () => {
      await dragWareToTarget(page, 'refinedmetals', '.groups-list .drop-target');
      await dragWareToTarget(page, 'siliconwafers', '.compact-group');

      const source = page.locator('.ware-card[data-ware-id="energycells"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactGroup = page.locator('.compact-group').first();
      const targetBox = await compactGroup.boundingBox();
      if (!targetBox) throw new Error('Target not found');

      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      const resources1 = page.locator('.compact-group .flex.items-center [data-ware-id]');
      await expect(resources1).toHaveCount(2);
      const ids1 = await resources1.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
      expect(ids1).toEqual(['ore', 'silicon']);

      await page.mouse.up();
    });

    await test.step('Case 2: Silicon Wafers first, then Refined Metals', async () => {
      await page.evaluate(() => (window as any).logicFlowStore.groups = []);

      await dragWareToTarget(page, 'siliconwafers', '.groups-list .drop-target');
      await dragWareToTarget(page, 'refinedmetals', '.compact-group');

      const source = page.locator('.ware-card[data-ware-id="energycells"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactGroup = page.locator('.compact-group').first();
      const targetBox = await compactGroup.boundingBox();
      if (!targetBox) throw new Error('Target not found');

      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      const resources2 = page.locator('.compact-group .flex.items-center [data-ware-id]');
      await expect(resources2).toHaveCount(2);
      const ids2 = await resources2.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
      expect(ids2).toEqual(['silicon', 'ore']);

      await page.mouse.up();
    });
  });
});
