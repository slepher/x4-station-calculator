import { test, expect } from '@playwright/test';

test.describe('Volume Compression Rate Display', () => {
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
    await page.waitForTimeout(500);
  };

  test('2.1 FlowNode 显示压缩率测试', async ({ page }) => {
    await dragWareToNewZone(page, 'hullparts');

    const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
    await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

    const compressionDisplay = hullpartsNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
    await expect(compressionDisplay).toBeVisible({ timeout: 3000 });
  });

  test('2.2 压缩率颜色编码测试', async ({ page }) => {
    await dragWareToNewZone(page, 'hullparts');

    const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
    await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

    const compressionText = hullpartsNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
    await expect(compressionText).toBeVisible();

    const rateText = await compressionText.textContent();
    const rateValue = parseInt(rateText?.replace('%', '') || '0');

    if (rateValue <= 100) {
      await expect(compressionText).toHaveClass(/text-emerald-400/);
    } else {
      await expect(compressionText).toHaveClass(/text-red-400/);
    }
  });

  test('2.3 isolated 节点不显示压缩率测试', async ({ page }) => {
    await dragWareToNewZone(page, 'hullparts');

    const hullpartsNode = page.locator('.flow-node[data-ware-id="hullparts"]');
    await expect(hullpartsNode).toBeVisible({ timeout: 5000 });

    const grapheneNode = page.locator('.flow-node[data-ware-id="graphene"]');
    await expect(grapheneNode).toBeVisible({ timeout: 5000 });

    const compressionBefore = grapheneNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
    await expect(compressionBefore).toBeVisible({ timeout: 3000 });

    await grapheneNode.hover();
    await page.waitForTimeout(100);

    const isolateBtn = grapheneNode.locator('button').filter({ hasText: '✂️' });
    await expect(isolateBtn).toBeVisible({ timeout: 2000 });
    await isolateBtn.click();
    await page.waitForTimeout(300);

    const extBadge = grapheneNode.locator('text=EXT');
    await expect(extBadge).toBeVisible({ timeout: 3000 });

    const compressionDisplay = grapheneNode.locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
    await expect(compressionDisplay).not.toBeVisible();
  });

  test('2.4 T0 资源节点不显示压缩率测试', async ({ page }) => {
    await dragWareToNewZone(page, 'hullparts');

    const t0Node = page.locator('.flow-node[data-ware-id="energycells"], .flow-node[data-ware-id="ore"]');
    await expect(t0Node.first()).toBeVisible({ timeout: 5000 });

    const compressionDisplay = t0Node.first().locator('.text-\\[7px\\]').filter({ hasText: /\d+%/ });
    await expect(compressionDisplay).not.toBeVisible();
  });
});
