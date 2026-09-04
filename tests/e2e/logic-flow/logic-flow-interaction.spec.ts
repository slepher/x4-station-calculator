import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { attemptWareDrag, dragWareToTarget, startWareDrag } from './helpers/dragLogicFlow';

test.describe('Logical Flow Integration Verification', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error(`Page Error: ${err.message}`);
    });

    await setupLogicFlow(page, 'clean');
  });

  test('2.1 Bug Fix: No Module Node for Weapon Components', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents');

    const nodes = page.locator('.flow-node');
    await expect(nodes.filter({ hasText: 'No Module' })).toHaveCount(0);
    
    const weaponNode = page.locator('.flow-node').filter({ hasText: /武器组件|Weapon/i });
    await expect(weaponNode).toBeVisible();
  });

  test('2.2 Bug Fix: Teladi Race Context Followed', async ({ page }) => {
    const teladiPill = page.locator('button').filter({ hasText: /TELADI/i });
    await teladiPill.click();
    await page.waitForTimeout(200);

    await dragWareToTarget(page, 'missilecomponents');

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
    
    await dragWareToTarget(page, 'hullparts');

    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount + 1);
  });

  test('2.5 Bug Fix: T0 Resource Not Draggable', async ({ page }) => {
    const oreCard = page.locator('.ware-card-wrapper[data-ware-id="ore"]').first();
    await expect(oreCard).toBeVisible();

    // 1. 静态属性检查 - T0 资源应该有锁定样式和属性
    await expect(oreCard).toHaveClass(/is-locked-tier/);
    await expect(oreCard).toHaveAttribute('data-tier', '0');
    // Vue 把 draggable="false" 渲染到 DOM 上时，属性值是字符串 "false"
    await expect(oreCard).toHaveAttribute('draggable', 'false');

    // T0 资源没有快速添加按钮
    const quickAddBtn = oreCard.locator('.ware-card-add-btn');
    await expect(quickAddBtn).toHaveCount(0);

    // 2. 动态交互测试 - 尝试拖拽 T0 资源
    const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);

    await attemptWareDrag(page, 'ore');

    // 3. 断言：数据没有发生变化（T0 资源没有被添加到规划区）
    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount);
  });

  test('2.6 Comparison: T1+ Resources Must Be Draggable', async ({ page }) => {
    // 对照组测试 - 确保 T1+ 资源可以正常拖拽
    const hullpartsCard = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible();

    // 1. 静态属性检查 - T1+ 资源应该有可拖拽样式和属性
    await expect(hullpartsCard).toHaveClass(/is-draggable-tier/);
    await expect(hullpartsCard).toHaveAttribute('data-tier', '2');
    await expect(hullpartsCard).toHaveAttribute('draggable', 'true');

    // 2. 动态交互测试 - 拖拽 T1+ 资源到新区域
    const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);

    await dragWareToTarget(page, 'hullparts');

    // 3. 断言：数据发生变化（T1+ 资源被添加到规划区）
    const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
    expect(finalGroupCount).toBe(initialGroupCount + 1);
  });

  test.describe('Compact View & Smart Insertion', () => {
    test('3.1 Logic: Compact View Appears on Drag', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts', 'new', { drop: false });
      const compactView = page.getByTestId('compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });
      await expect(compactView.locator('.compact-group').last()).toHaveClass(/border-blue-500\/50/);

      await page.mouse.up();
    });

    test('3.2 Logic: Smart Insertion Order (UI Check)', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');
      await dragWareToTarget(page, 'siliconwafers', 0);

      const nodes = page.locator('.flow-node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });

    test('3.3 Logic: Duplicate blocking and UI feedback', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');

      const { targetLocator: compactGroup } = await dragWareToTarget(page, 'hullparts', 0, { drop: false });

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
      });
      expect(status).toBe('duplicated');

      await page.mouse.up();
    });

    test('3.4 Visual: Drag Preview in Compact View', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');

      const { targetLocator: compactGroup } = await dragWareToTarget(page, 'weaponcomponents', 0, { drop: false });

      const previewNode = page.locator('.compact-node.bg-blue-500\\/20');
      await expect(previewNode).toBeVisible();
      await expect(previewNode).toContainText(/Weapon Component Production|武器部件产线/);
      await expect(compactGroup.locator('.compact-node[data-ware-id="hullparts"]')).toContainText(/Hull Part Production|船体部件产线/);

      await page.mouse.up();
    });
  });

  test.describe('Multi-Line Integration', () => {
    test('4.1 Logic: Create Multiple Lines', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');
      await dragWareToTarget(page, 'weaponcomponents');

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);
    });

    test('4.2 Logic: Drag to Existing Line', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');
      await dragWareToTarget(page, 'weaponcomponents', 0);

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
      await dragWareToTarget(page, 'hullparts');

      const connectionLines = page.locator('.connection-line');
      const count = await connectionLines.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Edge Cases', () => {
    test('5.1b Release outside target leaves groups and nodes unchanged', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');
      const before = await page.evaluate(() => (window as any).logicFlowStore.groups.map((g: any) => g.nodes.map((n: any) => n.wareId)));
      await startWareDrag(page, 'weaponcomponents');
      await page.mouse.move(50, 50, { steps: 10 });
      await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull();
      await page.mouse.up();
      await expect(page.getByTestId('compact-view')).toBeHidden();
      await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups.map((g: any) => g.nodes.map((n: any) => n.wareId)))).toEqual(before);
    });

    test('5.3 Empty group routes first nodes to the selected target', async ({ page }) => {
      await page.locator('.groups-list .drop-target').last().click();
      await page.locator('.groups-list .drop-target').last().click();
      await expect(page.locator('.production-group')).toHaveCount(2);
      await dragWareToTarget(page, 'hullparts', 1);
      await dragWareToTarget(page, 'weaponcomponents', 0);
      await expect(page.locator('.production-group').nth(1).locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(1);
      await expect(page.locator('.production-group').nth(0).locator('.flow-node[data-ware-id="weaponcomponents"]')).toHaveCount(1);
    });

    test('5.2 Drop on New Zone Creates Group', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);

      const nodes = page.locator('.flow-node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });
});
