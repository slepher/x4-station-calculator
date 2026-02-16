import { test, expect } from '@playwright/test';

test.describe('Vue Drag Test - Method Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
    });

    await page.goto('./?view=drag-test&test=true');
    
    await page.waitForFunction(() => {
      const store = (window as any).dragTestStore;
      return store !== undefined;
    }, { timeout: 10000 });
  });

  test.describe('Method A: dispatchEvent (Analysis)', () => {
    test('A.1 dispatchEvent does NOT trigger vuedraggable events', async ({ page }) => {
      await page.evaluate(() => {
        (window as any).dragTestStore.clearEventHistory();
      });

      const initialZoneACount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneAItems.length
      );

      await page.evaluate(() => {
        const sourceEl = document.querySelector('[data-item-id="item-1"]') as HTMLElement;
        const targetZone = document.querySelector('[data-zone-id="B"]') as HTMLElement;
        
        if (!sourceEl || !targetZone) {
          throw new Error('Elements not found');
        }

        const dataTransfer = new DataTransfer();
        dataTransfer.effectAllowed = 'all';
        dataTransfer.dropEffect = 'move';

        sourceEl.dispatchEvent(new DragEvent('dragstart', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        }));

        targetZone.dispatchEvent(new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        }));

        targetZone.dispatchEvent(new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        }));

        sourceEl.dispatchEvent(new DragEvent('dragend', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        }));
      });

      await page.waitForTimeout(100);

      const finalZoneACount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneAItems.length
      );

      const events = await page.evaluate(() => 
        (window as any).dragTestStore.getEventHistory()
      );

      expect(finalZoneACount).toBe(initialZoneACount);
      expect(events.length).toBe(0);

      console.log('FINDING: dispatchEvent does NOT trigger vuedraggable events');
      console.log('REASON: vuedraggable (SortableJS) does not listen to native DragEvents');
      console.log('SOLUTION: Must use Playwright mouse API or direct store manipulation');
    });
  });

  test.describe('Method B: Playwright Mouse API', () => {
    test('B.1 Real mouse drag triggers highlight and updates data', async ({ page }) => {
      const sourceItem = page.locator('[data-item-id="item-1"]');
      const targetZone = page.locator('[data-zone-id="B"]');

      await expect(sourceItem).toBeVisible();
      await expect(targetZone).toBeVisible();

      const sourceBox = await sourceItem.boundingBox();
      const targetBox = await targetZone.boundingBox();

      if (!sourceBox || !targetBox) {
        throw new Error('Could not get bounding boxes');
      }

      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2
      );
      await page.mouse.down();
      
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2 + 10,
        sourceBox.y + sourceBox.height / 2 + 10,
        { steps: 5 }
      );

      const isDragging = await page.evaluate(() => 
        (window as any).dragTestStore.isDragging
      );
      expect(isDragging).toBe(true);

      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2,
        { steps: 20 }
      );

      await page.waitForTimeout(100);

      await expect(targetZone).toHaveClass(/border-blue-500/);
      await expect(targetZone).toHaveClass(/bg-blue-500\/10/);

      const hoveredZone = await page.evaluate(() => 
        (window as any).dragTestStore.hoveredZoneId
      );
      expect(hoveredZone).toBe('B');

      await page.mouse.up();

      await page.waitForTimeout(200);

      const zoneBIds = await page.evaluate(() => 
        (window as any).dragTestStore.zoneBItems.map((i: any) => i.id)
      );
      expect(zoneBIds).toContain('item-1');

      const finalZoneBCount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneBItems.length
      );
      expect(finalZoneBCount).toBe(1);

      console.log('FINDING: Playwright Mouse API successfully triggers drag events');
      console.log('FINDING: Visual highlight works correctly during drag');
      console.log('FINDING: Data is correctly updated after drop');
    });
  });

  test.describe('Method C: Direct Store Manipulation (Recommended for E2E)', () => {
    test('C.1 Direct store manipulation for reliable testing', async ({ page }) => {
      const initialZoneACount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneAItems.length
      );
      const initialZoneBCount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneBItems.length
      );

      await page.evaluate(() => {
        const store = (window as any).dragTestStore;
        store.moveItem('item-1', 'B');
      });

      await page.waitForTimeout(50);

      const finalZoneACount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneAItems.length
      );
      const finalZoneBCount = await page.evaluate(() => 
        (window as any).dragTestStore.zoneBItems.length
      );

      expect(finalZoneACount).toBe(initialZoneACount - 1);
      expect(finalZoneBCount).toBe(initialZoneBCount + 1);

      console.log('FINDING: Direct store manipulation is the most reliable method for E2E testing');
    });

    test('C.2 Simulate drag state for visual testing', async ({ page }) => {
      await page.evaluate(() => {
        const store = (window as any).dragTestStore;
        store.startDragging('item-1');
      });

      const zoneB = page.locator('[data-zone-id="B"]');
      await expect(zoneB).toHaveClass(/border-blue-500/);

      await page.evaluate(() => {
        const store = (window as any).dragTestStore;
        store.enterZone('B');
      });

      await expect(zoneB).toHaveClass(/bg-blue-500\/10/);

      await page.evaluate(() => {
        const store = (window as any).dragTestStore;
        store.stopDragging();
      });
    });
  });
});

test.describe('Vue Drag Test - Drop Status Classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
    });

    await page.goto('./?view=drag-test&test=true');
    
    await page.waitForFunction(() => {
      const store = (window as any).dragTestStore;
      return store !== undefined;
    }, { timeout: 10000 });
  });

  test('S.1 Normal status - drag to empty zone', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
    });

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).toHaveClass(/border-blue-500/);
  });

  test('S.2 Duplicated status - drag existing item', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.moveItem('item-1', 'B');
      store.startDragging('item-1');
    });

    await page.waitForTimeout(50);

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).toHaveClass(/border-red-500/);

    const statusLabel = page.locator('.status-label');
    await expect(statusLabel).toContainText('Duplicated');
  });

  test('S.3 Auto status - drag to auto placeholder', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.addAutoItem('item-1', 'Item 1 (Auto)', 'B');
      store.startDragging('item-1');
    });

    await page.waitForTimeout(50);

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).not.toHaveClass(/border-red-500/);

    const statusLabel = page.locator('.status-label');
    await expect(statusLabel).toContainText(/Auto|Manual/);
  });

  test('S.4 Isolate status - drag to isolated placeholder', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.addIsolatedItem('item-2', 'Item 2 (Isolated)', 'B');
      store.startDragging('item-2');
    });

    await page.waitForTimeout(50);

    const statusLabel = page.locator('.status-label');
    await expect(statusLabel).toContainText(/Isolate|Connect/);
  });

  test('S.5 Locked status - drag matching lineage', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.setZoneBLocked(true, 'terran');
      store.startDragging('item-4');
    });

    await page.waitForTimeout(50);

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).toHaveClass(/border-amber-500/);
  });

  test('S.6 Rejected status - drag non-matching lineage', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.setZoneBLocked(true, 'terran');
      store.startDragging('item-5');
    });

    await page.waitForTimeout(50);

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).toHaveClass(/border-red-600/);

    const statusLabel = page.locator('.status-label');
    await expect(statusLabel).toContainText('Rejected');
  });
});

test.describe('Vue Drag Test - Hover and Rollback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
    });

    await page.goto('./?view=drag-test&test=true');
    
    await page.waitForFunction(() => {
      const store = (window as any).dragTestStore;
      return store !== undefined;
    }, { timeout: 10000 });
  });

  test('H.1 Hover enter/leave detection', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).dragTestStore.clearEventHistory();
    });

    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
      store.enterZone('B');
      store.leaveZone('B');
      store.stopDragging();
    });

    await page.waitForTimeout(50);

    const events = await page.evaluate(() => 
      (window as any).dragTestStore.getEventHistory()
    );

    const eventTypes = events.map((e: any) => e.type);
    expect(eventTypes).toContain('dragenter');
    expect(eventTypes).toContain('dragleave');
    expect(eventTypes).not.toContain('drop');
  });

  test('H.2 Cancel drag operation', async ({ page }) => {
    const initialZoneACount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneAItems.length
    );

    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
      store.enterZone('B');
      store.stopDragging();
    });

    await page.waitForTimeout(50);

    const finalZoneACount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneAItems.length
    );

    expect(finalZoneACount).toBe(initialZoneACount);
  });

  test('H.3 Visual feedback on hover', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
    });

    const zoneB = page.locator('[data-zone-id="B"]');
    await expect(zoneB).toHaveClass(/border-blue-500/);

    await page.evaluate(() => {
      (window as any).dragTestStore.stopDragging();
    });
  });
});

test.describe('Vue Drag Test - Store State Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
    });

    await page.goto('./?view=drag-test&test=true');
    
    await page.waitForFunction(() => {
      const store = (window as any).dragTestStore;
      return store !== undefined;
    }, { timeout: 10000 });
  });

  test('ST.1 Initial state verification', async ({ page }) => {
    const zoneACount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneAItems.length
    );
    const zoneBCount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneBItems.length
    );

    expect(zoneACount).toBe(5);
    expect(zoneBCount).toBe(0);
  });

  test('ST.2 Move item updates both zones', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.moveItem('item-1', 'B');
    });

    const zoneAItemIds = await page.evaluate(() => 
      Array.from((window as any).dragTestStore.zoneAItemIds)
    );
    const zoneBItemIds = await page.evaluate(() => 
      Array.from((window as any).dragTestStore.zoneBItemIds)
    );

    expect(zoneAItemIds).not.toContain('item-1');
    expect(zoneBItemIds).toContain('item-1');
  });

  test('ST.3 Reset state clears all', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.moveItem('item-1', 'B');
      store.moveItem('item-2', 'B');
      store.resetState();
    });

    const zoneACount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneAItems.length
    );
    const zoneBCount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneBItems.length
    );
    const eventsCount = await page.evaluate(() => 
      (window as any).dragTestStore.events.length
    );

    expect(zoneACount).toBe(5);
    expect(zoneBCount).toBe(0);
    expect(eventsCount).toBe(0);
  });

  test('ST.4 Duplicated item is rejected', async ({ page }) => {
    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.moveItem('item-1', 'B');
    });

    const success = await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      return store.moveItem('item-1', 'B');
    });

    expect(success).toBe(false);

    const zoneBCount = await page.evaluate(() => 
      (window as any).dragTestStore.zoneBItems.length
    );
    expect(zoneBCount).toBe(1);
  });
});

test.describe('Vue Drag Test - Event Sequence', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).isTestEnv = true;
      window.localStorage.setItem('isTestEnv', 'true');
    });

    await page.goto('./?view=drag-test&test=true');
    
    await page.waitForFunction(() => {
      const store = (window as any).dragTestStore;
      return store !== undefined;
    }, { timeout: 10000 });
  });

  test('E.1 Successful drop event sequence', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).dragTestStore.clearEventHistory();
    });

    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
      store.enterZone('B');
      store.moveItem('item-1', 'B');
      store.stopDragging();
    });

    const events = await page.evaluate(() => 
      (window as any).dragTestStore.getEventHistory()
    );

    const eventTypes = events.map((e: any) => e.type);
    
    expect(eventTypes[0]).toBe('dragstart');
    expect(eventTypes).toContain('dragenter');
    expect(eventTypes).toContain('drop');
    expect(eventTypes[eventTypes.length - 1]).toBe('dragend');
  });

  test('E.2 Cancelled drag event sequence', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).dragTestStore.clearEventHistory();
    });

    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
      store.stopDragging();
    });

    const events = await page.evaluate(() => 
      (window as any).dragTestStore.getEventHistory()
    );

    const eventTypes = events.map((e: any) => e.type);
    
    expect(eventTypes).toEqual(['dragstart', 'dragend']);
    expect(eventTypes).not.toContain('drop');
  });

  test('E.3 Hover and leave event sequence', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).dragTestStore.clearEventHistory();
    });

    await page.evaluate(() => {
      const store = (window as any).dragTestStore;
      store.startDragging('item-1');
      store.enterZone('B');
      store.leaveZone('B');
      store.stopDragging();
    });

    const events = await page.evaluate(() => 
      (window as any).dragTestStore.getEventHistory()
    );

    const eventTypes = events.map((e: any) => e.type);
    
    expect(eventTypes).toContain('dragenter');
    expect(eventTypes).toContain('dragleave');
    expect(eventTypes).not.toContain('drop');
  });
});
