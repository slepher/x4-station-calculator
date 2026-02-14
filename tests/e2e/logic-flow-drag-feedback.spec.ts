import { test, expect } from '@playwright/test';

test.describe('Logic Flow Advanced Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    // Inject test environment flag and pre-set view BEFORE navigation
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
      window.localStorage.setItem('x4_station_active_view', 'flow');
    });

    // Navigate with test=true to ensure store exposure
    await page.goto('./?test=true');
    
    // Ensure store is ready
    await page.waitForFunction(() => {
      const logicFlow = (window as any).logicFlowStore;
      const gameData = (window as any).gameDataStore;
      return logicFlow && gameData && gameData.isReady;
    }, { timeout: 20000 });
  });

  test('4.1 Visual: New Line Ghosting (Phantom Preview)', async ({ page }) => {
    // 1. Setup dragging state
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = [];
      logicFlow.isDragging = true;
      logicFlow.draggingWareId = 'scanningarrays'; // T2
    });

    // 2. Simulate hover over New Line zone
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.isHoveringNewZone = true;
    });

    // 3. Verify Preview Header
    // The text should be "Preview: Scanning Arrays" or similar
    const previewTitle = page.locator('span:has-text("Preview:")');
    await expect(previewTitle).toBeVisible({ timeout: 5000 });
    // Match English, Chinese, or raw ID (case insensitive)
    await expect(previewTitle).toContainText(/Scanning Arrays|扫描阵列|scanningarrays/i);

    // 4. Verify Preview Resources in Header
    // Use data-ware-id to find resources in the new zone preview
    const headerResources = page.locator('.compact-group:has-text("Preview:") .flex.items-center [data-ware-id]');
    // Scanning Arrays needs Refined Metals and Silicon Wafers (2 resources)
    await expect(headerResources).toHaveCount(2); 
  
    // 5. Verify Phantom Node in Grid
    const phantomNode = page.locator('.compact-node.animate-pulse');
    await expect(phantomNode).toBeVisible();
    // Scanning Arrays is Tier 2.
    // Grid Logic: 4 - Tier. 4 - 2 = 2.
    await expect(phantomNode).toHaveCSS('grid-column-start', '2'); 
  });

  test('4.2 Visual: Real-time T0 Resource Header Updates', async ({ page }) => {
    // 1. Setup existing group
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = [];
      const group = logicFlow.addGroup('industrial', 'default', 'Resource Test');
      logicFlow.expandUpstream(group.id, 'siliconwafers', 'manual'); // T1 -> Needs Silicon
      logicFlow.isDragging = true;
      logicFlow.draggingWareId = 'microchips'; // T2 -> Needs Silicon and Wafers
    });

    // 2. Verify initial resource (Silicon)
    const initialRes = page.locator('.compact-group [data-ware-id="silicon"]');
    await expect(initialRes).toHaveCount(1);

    // 3. Hover over group
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.hoveredGroupId = logicFlow.groups[0].id;
    });

    // 4. Verify new resource indicator (animate-pulse)
    // Microchips T0: Silicon
    // Wait for the pulse class which indicates new resources.
    // Since Silicon is already there, it won't be marked as new (unless the logic allows duplicates, which we handle by unique ID in store)
    // Actually, getFormattedResources uses `!originalResources[wareId]` to determine `isNew`.
    // If Silicon is already in originalResources, it won't be new.
    
    // Let's try dragging Hull Parts (needs Ore and Methane) over Silicon Wafers (needs Silicon)
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.draggingWareId = 'hullparts';
    });
    
    // We expect Ore and Methane to pulse in the header.
    // IMPORTANT: Exclude the phantom node in the grid which also pulses and has data-ware-id.
    // We target the header container specifically.
    const pulsingResources = page.locator('.compact-group .flex.items-center [data-ware-id].animate-pulse');
    await expect(pulsingResources).toHaveCount(2);
  });

  test('4.5 End-to-End: Final State Verification', async ({ page }) => {
    // Helper to perform drag and drop
    const dragAndDrop = async (wareId: string, targetSelector: string, drop: boolean = true) => {
      const source = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
      // Wait for source to be available
      await expect(source).toBeVisible();

      // Start Drag
      await source.hover();
      await page.mouse.down();
      
      // Move a bit to trigger drag start
      await page.mouse.move(200, 200);
      await page.waitForTimeout(200); // Allow Vue to update state (Compact View appears)

      // Find Target
      // Re-query target because DOM might have changed (Compact View)
      const target = page.locator(targetSelector).first();
      await expect(target).toBeVisible();

      const box = await target.boundingBox();
      if (box) {
        // Move to center of target
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300); // Wait for hover effects
      }

      if (drop) {
        await page.mouse.up();
        await page.waitForTimeout(500); // Wait for drop processing and view switch
      }
    };

    // Case A: Drag to existing group
    await test.step('Case A: Drag to existing group', async () => {
      // Setup: One group with Scanning Arrays
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.groups = [];
        const group = logicFlow.addGroup('industrial', 'default', 'Target Group');
        logicFlow.expandUpstream(group.id, 'scanningarrays', 'manual');
      });

      // Drag Microchips (T2) to the group
      // Target: The first compact group
      await dragAndDrop('microchips', '.compact-group');

      // Verify: Group has Microchips (in Standard View)
      // Note: Compact View is hidden after drop, so we check .flow-node
      const nodes = page.locator('.flow-node[data-ware-id="microchips"]');
      await expect(nodes).toBeVisible();
      
      // Verify: Still 1 group
      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);
    });

    // Case B: Drag to New Zone and release
    await test.step('Case B: Drag to New Zone', async () => {
      // In Compact View, the New Line zone is the LAST .compact-group
      // But we need to be careful with selectors.
      // Reset state first to ensure clean slate
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.groups = [];
        // Add one dummy group so we have a distinction between "Existing" and "New Zone"
        logicFlow.addGroup('industrial', 'default', 'Existing Group');
      });

      // Drag Scanning Arrays to New Zone
      // The New Zone is the 2nd .compact-group (index 1) or matches specific text
      await dragAndDrop('scanningarrays', '.compact-group:last-child');

      // Verify: New group created
      // We started with 1 group, now should have 2
      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);
    });
  });

  test('4.6 T0 Ware Behavior: Non-draggable and No Preview', async ({ page }) => {
    // 1. Locate a T0 ware (e.g., Ore)
    // Ore is Tier 0.
    const oreCard = page.locator('.ware-card[data-ware-id="ore"]');
    await expect(oreCard).toBeVisible();

    // 2. Verify No Resource Preview
    // The resource preview container should NOT exist for T0
    const resourcePreview = oreCard.locator('.resource-preview-container');
    await expect(resourcePreview).toBeHidden();

    // 3. Verify T1 ware HAS preview (e.g., Silicon Wafers)
    // We need to ensure it is scrolled into view as the list might be long
    const siliconWafersCard = page.locator('.ware-card[data-ware-id="siliconwafers"]');
    // Scroll container if needed
    await siliconWafersCard.scrollIntoViewIfNeeded();
    await expect(siliconWafersCard).toBeVisible();
    
    // Check HTML if needed
    // const html = await siliconWafersCard.innerHTML();
    // console.log('Silicon Wafers Card HTML:', html);

    await expect(siliconWafersCard.locator('.resource-preview-container')).toBeVisible();

    // 4. Verify Draggable Disabled
    // Attempt to drag Ore. LogicFlow should NOT enter dragging state.
    
    // Ensure initial state
    let isDragging = await page.evaluate(() => (window as any).logicFlowStore.isDragging);
    expect(isDragging).toBe(false);

    // Perform drag action
    await oreCard.hover();
    await page.mouse.down();
    await page.mouse.move(300, 300); // Move significantly
    await page.waitForTimeout(300);

    // Check state again
    isDragging = await page.evaluate(() => (window as any).logicFlowStore.isDragging);
    expect(isDragging).toBe(false); // Should remain false because dragging is disabled for T0
  });

  test('4.7 Visual: Dependency-Follow Sorting', async ({ page }) => {
    // Scenario: A (Refined Metals -> Ore), B (Silicon Wafers -> Silicon)
    // Case 1: A then B -> [Ore, Silicon]
    // Case 2: B then A -> [Silicon, Ore]

    // 1. Setup Case 1: Refined Metals first, then Silicon Wafers
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = [];
      const group = logicFlow.addGroup('industrial', 'default', 'Sorting Test 1');
      // Add Refined Metals (Tier 1)
      logicFlow.expandUpstream(group.id, 'refinedmetals', 'manual'); 
      // Add Silicon Wafers (Tier 1). Based on insertion logic (same tier added after), Order: A, B.
      logicFlow.expandUpstream(group.id, 'siliconwafers', 'manual');
      
      // Force dragging state to view Compact Header
      logicFlow.isDragging = true;
      logicFlow.hoveredGroupId = group.id;
    });

    // Verify Header Order: Ore, Silicon
    const resources1 = page.locator('.compact-group .flex.items-center [data-ware-id]');
    await expect(resources1).toHaveCount(2);
    const ids1 = await resources1.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
    expect(ids1).toEqual(['ore', 'silicon']);

    // 2. Setup Case 2: Silicon Wafers first, then Refined Metals
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.groups = [];
      const group = logicFlow.addGroup('industrial', 'default', 'Sorting Test 2');
      
      // Add Silicon Wafers (Tier 1)
      logicFlow.expandUpstream(group.id, 'siliconwafers', 'manual');
      // Add Refined Metals (Tier 1) -> Should be placed AFTER Silicon Wafers
      logicFlow.expandUpstream(group.id, 'refinedmetals', 'manual');

      logicFlow.isDragging = true;
      logicFlow.hoveredGroupId = group.id;
    });

    // Verify Header Order: Silicon, Ore
    const resources2 = page.locator('.compact-group .flex.items-center [data-ware-id]');
    await expect(resources2).toHaveCount(2);
    const ids2 = await resources2.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')));
    expect(ids2).toEqual(['silicon', 'ore']);
  });
});
