import { test, expect } from '@playwright/test';

test.describe('Logical Flow Integration Verification', () => {
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
  });

  const dragWareToNewZone = async (
    page: any, 
    wareId: string,
    options: { drop?: boolean } = {}
  ) => {
    const { drop = true } = options;
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

    if (drop) {
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    return { sourceBox, newZoneBox };
  };

  const dragWareToExistingGroup = async (
    page: any, 
    wareId: string,
    groupIndex: number = 0,
    options: { drop?: boolean } = {}
  ) => {
    const { drop = true } = options;
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

    if (drop) {
      await page.mouse.up();
      await page.waitForTimeout(300);
    }

    return { sourceBox, targetBox };
  };

  test('2.1 Bug Fix: No Module Node for Weapon Components', async ({ page }) => {
    await dragWareToNewZone(page, 'weaponcomponents');

    const nodes = page.locator('.flow-node');
    await expect(nodes.filter({ hasText: 'No Module' })).toHaveCount(0);
    
    const weaponNode = page.locator('.flow-node').filter({ hasText: /武器组件|Weapon/i });
    await expect(weaponNode).toBeVisible();
  });

  test('2.2 Bug Fix: Teladi Race Context Followed', async ({ page }) => {
    const teladiPill = page.locator('button').filter({ hasText: /TELADI/i });
    await teladiPill.click();
    await page.waitForTimeout(200);

    await dragWareToNewZone(page, 'missilecomponents');

    const teladianiumNode = page.locator('.flow-node').filter({ hasText: /泰拉迪合金|Teladianium/i });
    const refinedMetalsNode = page.locator('.flow-node').filter({ hasText: /精炼金属|Refined Metals/i });

    await expect(teladianiumNode).toBeVisible();
    await expect(refinedMetalsNode).toHaveCount(0);
  });

  test('2.3 Bug Fix: New Production Line Button Response', async ({ page }) => {
    const newBtn = page.locator('.groups-list .drop-target');
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    
    const groupTitle = page.locator('.production-group h3');
    await expect(groupTitle).toBeVisible();
  });

  test('2.4 Bug Fix: vuedraggable Crash (TypeError Check)', async ({ page }) => {
    const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    
    await dragWareToNewZone(page, 'hullparts');

    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount + 1);
  });

  test('2.5 Bug Fix: T0 Resource Not Draggable', async ({ page }) => {
    const oreCard = page.locator('.ware-card[data-ware-id="ore"]').first();
    await expect(oreCard).toBeVisible();

    // 1. 静态属性检查 - T0 资源应该有锁定样式和属性
    await expect(oreCard).toHaveClass(/is-locked-tier/);
    await expect(oreCard).toHaveAttribute('data-tier', '0');
    // Vue 把 draggable="false" 渲染到 DOM 上时，属性值是字符串 "false"
    await expect(oreCard).toHaveAttribute('draggable', 'false');

    // T0 资源没有快速添加按钮
    const quickAddBtn = oreCard.locator('.quick-add-btn');
    await expect(quickAddBtn).toHaveCount(0);

    // 2. 动态交互测试 - 尝试拖拽 T0 资源
    const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);

    const oreBox = await oreCard.boundingBox();
    if (!oreBox) throw new Error('Ore card not found');

    // 模拟鼠标拖拽操作
    await page.mouse.move(oreBox.x + oreBox.width / 2, oreBox.y + oreBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(oreBox.x + oreBox.width / 2 + 100, oreBox.y + oreBox.height / 2 + 100, { steps: 10 });
    await page.waitForTimeout(300);
    await page.mouse.up();

    // 3. 断言：数据没有发生变化（T0 资源没有被添加到规划区）
    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount);
  });

  test('2.6 Comparison: T1+ Resources Must Be Draggable', async ({ page }) => {
    // 对照组测试 - 确保 T1+ 资源可以正常拖拽
    const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible();

    // 1. 静态属性检查 - T1+ 资源应该有可拖拽样式和属性
    await expect(hullpartsCard).toHaveClass(/is-draggable-tier/);
    await expect(hullpartsCard).toHaveAttribute('data-tier', '2');
    await expect(hullpartsCard).toHaveAttribute('draggable', 'true');

    // 2. 动态交互测试 - 拖拽 T1+ 资源到新区域
    const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);

    await dragWareToNewZone(page, 'hullparts');

    // 3. 断言：数据发生变化（T1+ 资源被添加到规划区）
    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount + 1);
  });

  test.describe('Compact View & Smart Insertion', () => {
    test('3.1 Logic: Compact View Appears on Drag', async ({ page }) => {
      const source = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      await page.mouse.up();
    });

    test('3.2 Logic: Smart Insertion Order (UI Check)', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await dragWareToExistingGroup(page, 'siliconwafers', 0);

      const nodes = page.locator('.flow-node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });

    test('3.3 Logic: Duplicate blocking and UI feedback', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const source = page.locator('.ware-card[data-ware-id="hullparts"]').first();
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

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
      });
      expect(status).toBe('duplicated');

      await page.mouse.up();
    });

    test('3.4 Visual: Drag Preview in Compact View', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const source = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
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

      const previewNode = page.locator('.compact-node.bg-blue-500\\/20');
      await expect(previewNode).toBeVisible();

      await page.mouse.up();
    });
  });

  test.describe('Multi-Line Integration', () => {
    test('4.1 Logic: Create Multiple Lines', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await dragWareToNewZone(page, 'weaponcomponents');

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);
    });

    test('4.2 Logic: Drag to Existing Line', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');
      await dragWareToExistingGroup(page, 'weaponcomponents', 0);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return {
          nodeCount: group.nodes.length,
          hasWeapon: group.nodes.some((n: any) => n.wareId === 'weaponcomponents')
        };
      });
      expect(result.hasWeapon).toBe(true);
    });

    test('4.3 Visual: Connection Lines Between Nodes', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const connectionLines = page.locator('.connection-line');
      const count = await connectionLines.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Edge Cases', () => {
    test('5.1 Drag State Persists Until Mouse Up', async ({ page }) => {
      const source = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const isDragging = await page.evaluate(() => (window as any).logicFlowStore.isDragging);
      expect(isDragging).toBe(true);

      await page.mouse.up();
      await page.waitForTimeout(200);

      const isDraggingAfterUp = await page.evaluate(() => (window as any).logicFlowStore.isDragging);
      expect(isDraggingAfterUp).toBe(false);
    });

    test('5.2 Drop on New Zone Creates Group', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);

      const nodes = page.locator('.flow-node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });
});
