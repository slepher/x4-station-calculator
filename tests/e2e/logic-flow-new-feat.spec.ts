import { test, expect } from '@playwright/test';

test.describe('Logic Flow New Features', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error(`Page Error: ${err.message}`);
    });

    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
      window.localStorage.setItem('x4_station_active_view', 'flow');
    });

    await page.goto('./?test=true');
    
    await page.waitForFunction(() => {
      const logicFlow = (window as any).logicFlowStore;
      const gameData = (window as any).gameDataStore;
      const station = (window as any).stationStore;
      return logicFlow && gameData && gameData.isReady && station && station.isReady;
    }, { timeout: 20000 });

    await expect(page.locator('.candidate-zone')).toBeVisible({ timeout: 15000 });
    
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
  });

  const dragWareToNewZone = async (page: any, wareId: string) => {
    const source = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
    await expect(source).toBeVisible();

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error(`Source ware ${wareId} not found`);

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
  };

  const dragWareToExistingGroup = async (page: any, wareId: string, groupIndex: number = 0) => {
    const source = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
    await expect(source).toBeVisible();

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error(`Source ware ${wareId} not found`);

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const compactView = page.locator('.compact-view');
    await expect(compactView).toBeVisible({ timeout: 5000 });

    const targetGroup = compactView.locator('.compact-group').nth(groupIndex);
    const targetBox = await targetGroup.boundingBox();
    if (!targetBox) throw new Error('Target group not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(300);
  };

  test.describe('Bug Regression Tests', () => {
    test('Setup: Check hullparts node count', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const manualNodeCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group?.nodes.filter((n: any) => n.source === 'manual').length || 0;
      });
      
      console.log(`hullparts manual node count: ${manualNodeCount}`);
      expect(manualNodeCount).toBe(1);
    });

    test('BUG: Drag then move away then release should NOT add ware', async ({ page }) => {
      
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(initialGroupCount).toBe(1);
      
      const initialManualNodeCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group?.nodes.filter((n: any) => n.source === 'manual').length || 0;
      });
      console.log(`Initial manual node count: ${initialManualNodeCount}`);

      const source = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
      await expect(source).toBeVisible();

      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source ware not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const targetGroup = compactView.locator('.compact-group').first();
      const targetBox = await targetGroup.boundingBox();
      if (!targetBox) throw new Error('Target group not found');

      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      const isDragging = await page.evaluate(() => (window as any).logicFlowStore.isDragging);
      expect(isDragging).toBe(true);

      await page.mouse.move(50, 50, { steps: 10 });
      await page.waitForTimeout(300);

      const isHoveringAfterLeave = await page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId === null);
      expect(isHoveringAfterLeave).toBe(true);

      await page.mouse.up();
      await page.waitForTimeout(300);

      const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      const finalManualNodeCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group?.nodes.filter((n: any) => n.source === 'manual').length || 0;
      });
      console.log(`Final manual node count: ${finalManualNodeCount}`);
      
      expect(finalGroupCount).toBe(initialGroupCount);
      expect(finalManualNodeCount).toBe(initialManualNodeCount);
    });
  });

  test.describe('Production Line Title Editing', () => {
    test('Test 1: Title Edit Interaction - Click to Edit', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await expect(groupTitle).toBeVisible();
      
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await expect(editInput).toBeVisible();
      await expect(editInput).toBeFocused();
      
      const confirmBtn = page.locator('.production-group button').filter({ has: page.locator('svg path[d*="M5 13l4"]') }).first();
      await expect(confirmBtn).toBeVisible();
    });

    test('Test 2: Title Confirm Edit', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('我的产线');
      await editInput.press('Enter');
      await page.waitForTimeout(100);
      
      const updatedTitle = page.locator('.production-group h3').first();
      await expect(updatedTitle).toHaveText('我的产线');
      
      const customName = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return logicFlow.groups[0]?.customName;
      });
      expect(customName).toBe('我的产线');
    });

    test('Test 3: Title Cancel Edit - Blur', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      const originalTitle = await groupTitle.textContent();
      
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('Modified Title');
      
      await page.locator('.production-group > div').first().click({ position: { x: 10, y: 5 } });
      await page.waitForTimeout(100);
      
      const revertedTitle = page.locator('.production-group h3').first();
      await expect(revertedTitle).toHaveText(originalTitle || '');
    });

    test('Test 4: Empty Title Reversion', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('');
      await editInput.press('Enter');
      await page.waitForTimeout(100);
      
      const revertedTitle = page.locator('.production-group h3').first();
      await expect(revertedTitle).not.toBeEmpty();
    });

    test('Test 5: Custom Title Not Auto Updated', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('我的产线');
      await editInput.press('Enter');
      await page.waitForTimeout(100);
      
      await dragWareToExistingGroup(page, 'weaponcomponents', 0);
      await page.waitForTimeout(300);
      
      const finalTitle = page.locator('.production-group h3').first();
      await expect(finalTitle).toHaveText('我的产线');
    });
  });

  test.describe('Upstream/Downstream Highlight Chain', () => {
    test('Test 6: Upstream Trace to T0', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const t3Node = page.locator('.flow-node').filter({ hasText: /武器组件|Weapon/i }).first();
      await t3Node.hover();
      await page.waitForTimeout(200);
      
      const highlightedCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return logicFlow.highlightedNodeIds.size;
      });
      expect(highlightedCount).toBeGreaterThan(1);
      
      const hasEnergyCells = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        if (!group) return false;
        for (const nodeId of logicFlow.highlightedNodeIds) {
          const node = group.nodes.find((n: any) => n.id === nodeId);
          if (node && node.wareId === 'energycells') return true;
        }
        return false;
      });
      expect(hasEnergyCells).toBe(false);
    });

    test('Test 7: Downstream Trace to T3', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const t0Node = page.locator('.flow-node').filter({ hasText: /矿石|Ore|硅晶片|Silicon/i }).first();
      await t0Node.hover();
      await page.waitForTimeout(200);
      
      const highlightedCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return logicFlow.highlightedNodeIds.size;
      });
      expect(highlightedCount).toBeGreaterThan(1);
    });

    test('Test 8: Middle Tier Bidirectional Trace', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const t2Node = page.locator('.flow-node').filter({ hasText: /精炼金属|Refined/i }).first();
      if (await t2Node.count() > 0) {
        await t2Node.hover();
        await page.waitForTimeout(200);
        
        const highlightedCount = await page.evaluate(() => {
          const logicFlow = (window as any).logicFlowStore;
          return logicFlow.highlightedNodeIds.size;
        });
        expect(highlightedCount).toBeGreaterThan(1);
      }
    });

    test('Test 9: Leave Node Clears Highlight', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const node = page.locator('.flow-node').first();
      await node.hover();
      await page.waitForTimeout(200);
      
      const highlightedDuringHover = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return logicFlow.highlightedNodeIds.size;
      });
      expect(highlightedDuringHover).toBeGreaterThan(0);
      
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      
      const highlightedAfterLeave = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return logicFlow.highlightedNodeIds.size;
      });
      expect(highlightedAfterLeave).toBe(0);
    });

    test('Test 9.1: Isolated Node Highlight', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const result = await page.evaluate(async () => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        if (!group) return { hasIsolated: false };
        
        const isolatedNode = group.nodes.find((n: any) => n.isIsolated);
        return {
          hasIsolated: !!isolatedNode,
          isolatedWareId: isolatedNode?.wareId
        };
      });
      
      if (result.hasIsolated && result.isolatedWareId) {
        const isolatedNode = page.locator('.flow-node.isolated').first();
        if (await isolatedNode.count() > 0) {
          await isolatedNode.hover();
          await page.waitForTimeout(200);
          
          const highlightedCount = await page.evaluate(() => {
            const logicFlow = (window as any).logicFlowStore;
            return logicFlow.highlightedNodeIds.size;
          });
          expect(highlightedCount).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  test.describe('View Switch Button Position', () => {
    test('Test 15: Button Position Verification', async ({ page }) => {
      const langSelector = page.locator('select').first();
      await expect(langSelector).toBeVisible();
      
      const langSelectorBox = await langSelector.boundingBox();
      if (!langSelectorBox) throw new Error('Language selector not found');
      
      const flowBtn = page.getByRole('button', { name: /逻辑|Logic/i });
      await expect(flowBtn).toBeVisible();
      
      const flowBtnBox = await flowBtn.boundingBox();
      if (!flowBtnBox) throw new Error('Flow button not found');
      
      expect(flowBtnBox.x + flowBtnBox.width).toBeLessThanOrEqual(langSelectorBox.x + 5);
    });

    test('Test 16: View Switch Functionality', async ({ page }) => {
      const quantityBtn = page.getByRole('button', { name: /量化|Quantified/i });
      await expect(quantityBtn).toBeVisible();
      
      await quantityBtn.click();
      await page.waitForTimeout(500);
      
      const flowBtn = page.getByRole('button', { name: /逻辑|Logical/i });
      await flowBtn.click();
      await page.waitForTimeout(500);
      
      const candidateZone = page.locator('.candidate-zone');
      await expect(candidateZone).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Compact Mode & Preview Custom Title', () => {
    test('Test 17: Compact Mode Shows Custom Title', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('我的产线');
      await editInput.press('Enter');
      await page.waitForTimeout(100);

      const source = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });
      
      const compactTitle = compactView.locator('.compact-group span.truncate').first();
      await expect(compactTitle).toHaveText('我的产线');
      
      await page.mouse.up();
    });

    test('Test 18: T0 Resources Fully Displayed', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const source = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });
      
      const t0Resources = compactView.locator('[data-ware-id]');
      const count = await t0Resources.count();
      expect(count).toBeGreaterThan(0);
      
      await page.mouse.up();
    });

    test('Test 19: Preview Menu Title Abbreviation', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await editInput.fill('这是一个非常长的自定义产线标题');
      await editInput.press('Enter');
      await page.waitForTimeout(100);
      
      const source = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });
      
      const compactTitle = compactView.locator('.compact-group span.truncate').first();
      const titleText = await compactTitle.textContent();
      expect(titleText).toContain('这是一个非常长的');
      
      await page.mouse.up();
    });
  });

  test.describe('Visual Tests', () => {
    test('Test 10: Edit Mode UI Consistency', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editInput = page.locator('.production-group input').first();
      await expect(editInput).toBeVisible();
      await expect(editInput).toHaveClass(/bg-slate-700/);
      await expect(editInput).toHaveClass(/border/);
      
      const confirmBtn = page.locator('.production-group button').filter({ has: page.locator('svg path[d*="M5 13l4"]') }).first();
      await expect(confirmBtn).toHaveClass(/text-green-400/);
    });

    test('Test 11: Edit Mode Height Stability', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(300);
      
      const groupHeader = page.locator('.production-group > div').first();
      const initialBox = await groupHeader.boundingBox();
      const initialHeight = initialBox?.height;
      
      const groupTitle = page.locator('.production-group h3').first();
      await groupTitle.click();
      await page.waitForTimeout(100);
      
      const editingBox = await groupHeader.boundingBox();
      const editingHeight = editingBox?.height;
      
      expect(Math.abs((editingHeight || 0) - (initialHeight || 0))).toBeLessThan(5);
    });

    test('Test 12: Container Highlight Style', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const node = page.locator('.flow-node').first();
      await node.hover();
      await page.waitForTimeout(200);
      
      const highlightedNode = page.locator('.flow-node.highlighted').first();
      if (await highlightedNode.count() > 0) {
        await expect(highlightedNode).toHaveClass(/ring-2|border-blue/);
      }
    });

    test('Test 13: Connection Highlight Style', async ({ page }) => {
      await dragWareToNewZone(page, 'weaponcomponents');
      await page.waitForTimeout(300);
      
      const node = page.locator('.flow-node').first();
      await node.hover();
      await page.waitForTimeout(200);
      
      const highlightedConnection = page.locator('.highlighted-connection').first();
      if (await highlightedConnection.count() > 0) {
        await expect(highlightedConnection).toBeAttached();
      }
    });
  });
});
