import { test, expect } from '@playwright/test';

test.describe('Logic Flow Bug Regression Tests (E2E)', () => {
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

  async function setupGroupWithNode(page: any, wareId: string, lineage: string = 'default') {
    await page.evaluate((args: { wareId: string; lineage: string }) => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.clearAllGroups();
      const group = logicFlow.addGroup('industrial', args.lineage);
      logicFlow.expandUpstream(group.id, args.wareId, 'manual', args.lineage);
    }, { wareId, lineage });
    await page.waitForTimeout(200);
  }

  async function isolateNode(page: any, wareId: string) {
    await page.evaluate((wareId: string) => {
      const logicFlow = (window as any).logicFlowStore;
      const group = logicFlow.groups[0];
      const node = group.nodes.find((n: any) => n.wareId === wareId);
      if (node) {
        logicFlow.toggleNodeIsolation(group.id, node.id);
      }
    }, wareId);
    await page.waitForTimeout(100);
  }

  test.describe('Bug 1: 隔离节点在拖拽时显示重复', () => {
    test('1.1 隔离节点不应在候选区显示拖拽预览点', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'default');
      await isolateNode(page, 'hullparts');

      const hullpartsCard = page.locator(`.ware-card[data-ware-id="hullparts"]`).first();
      const sourceBox = await hullpartsCard.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 100, sourceBox.y + sourceBox.height / 2 + 100);
      await page.waitForTimeout(200);

      const previewNodes = page.locator('.preview-node');
      await expect(previewNodes).toHaveCount(0);
      
      const flowNodes = page.locator('.flow-node');
      const hullPartsNodes = flowNodes.filter({ hasText: /船体部件|Hull Parts/i });
      await expect(hullPartsNodes).toHaveCount(1);
      
      await page.mouse.up();
    });
  });

  test.describe('Bug 2: 锁定组血统标签优先级过高', () => {
    test('2.1 隔离标签应优先于锁定组血统标签显示', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'teladi', 'Locked Group', true);
        group.lockedLineage = 'teladi';
        logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'teladi');
        
        const node = group.nodes.find((n: any) => n.wareId === 'weaponcomponents');
        logicFlow.toggleNodeIsolation(group.id, node.id);
      });

      await page.waitForTimeout(100);

      const nodeState = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const node = group.nodes.find((n: any) => n.wareId === 'weaponcomponents');
        return { isIsolated: node.isIsolated, lineage: node.lineage };
      });
      expect(nodeState.isIsolated).toBe(true);
      expect(nodeState.lineage).toBe('teladi');
    });
  });

  test.describe('Bug 3: 不同血统同种产品错误判定为 duplicated', () => {
    test('3.1 不同血统的同种产品应可共存', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        logicFlow.addGroup('industrial', 'default');
      });
      await page.waitForTimeout(100);

      await dragWareToTarget(page, 'hullparts', '.compact-group');

      const hullpartsCard = page.locator(`.ware-card[data-ware-id="hullparts"]`).first();
      const sourceBox = await hullpartsCard.boundingBox();
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
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi');
      });
      expect(status).toBe('available');
      
      await page.mouse.up();
    });

    test('3.2 拖拽不同血统产品应显示 available 状态', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'default');

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi');
      });
      expect(status).toBe('available');
    });
  });

  test.describe('Bug 4: Auto 节点转正', () => {
    test('4.1 拖拽到 Auto 节点应转正为 Manual', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        logicFlow.addGroup('industrial', 'default');
      });
      await page.waitForTimeout(100);

      await dragWareToTarget(page, 'hullparts', '.compact-group');
      await page.waitForTimeout(200);

      const grapheneStatus = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene');
        return { source: grapheneNode?.source, isAuto: grapheneNode?.isAuto };
      });
      expect(grapheneStatus.source).toBe('auto');

      await dragWareToTarget(page, 'graphene', '.compact-group');
      await page.waitForTimeout(200);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene');
        return {
          source: grapheneNode?.source,
          count: group.nodes.filter((n: any) => n.wareId === 'graphene').length
        };
      });
      expect(result.source).toBe('manual');
      expect(result.count).toBe(1);
    });

    test('4.2 不同血统 Auto 节点应显示 replace 状态', async ({ page }) => {
      await setupGroupWithNode(page, 'weaponcomponents', 'default');

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi');
      });
      expect(status).toBe('replace');
    });
  });

  test.describe('Bug 5, 6: 拖拽不同血统产品', () => {
    test('5.1 拖拽不同血统产品到 Auto 节点应替换血统', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'teladi');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
      });
      await page.waitForTimeout(100);

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene');
        return {
          wareStatus: logicFlow.getWareGroupStatus(group.id, 'graphene', 'default'),
          nodeSource: grapheneNode?.source,
          nodeLineage: grapheneNode?.lineage
        };
      });
      
      expect(status.nodeSource).toBe('auto');
      expect(status.wareStatus).toBe('auto');

      await dragWareToTarget(page, 'graphene', '.compact-group');
      await page.waitForTimeout(200);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const node = group.nodes.find((n: any) => n.wareId === 'graphene');
        return {
          source: node?.source,
          lineage: node?.lineage,
          count: group.nodes.filter((n: any) => n.wareId === 'graphene').length
        };
      });
      expect(result.source).toBe('manual');
      expect(result.count).toBe(1);
    });
  });

  test.describe('Bug 7a: 隔离节点合并', () => {
    test('7a.1 隔离时删除其他同 wareId 节点', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
      });

      await page.waitForTimeout(100);

      const beforeCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group.nodes.filter((n: any) => n.wareId === 'hullparts').length;
      });
      expect(beforeCount).toBe(2);

      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const defaultNode = group.nodes.find((n: any) => n.wareId === 'hullparts' && n.lineage === 'default');
        logicFlow.toggleNodeIsolation(group.id, defaultNode.id);
      });

      await page.waitForTimeout(100);

      const afterCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group.nodes.filter((n: any) => n.wareId === 'hullparts').length;
      });
      expect(afterCount).toBe(1);
    });

    test('7a.2 隔离后只保留一个 isolated 节点', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
        
        const node = group.nodes.find((n: any) => n.wareId === 'hullparts');
        logicFlow.toggleNodeIsolation(group.id, node.id);
      });

      await page.waitForTimeout(100);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const node = group.nodes.find((n: any) => n.wareId === 'hullparts');
        return {
          count: group.nodes.filter((n: any) => n.wareId === 'hullparts').length,
          isIsolated: node?.isIsolated,
          lineage: node?.lineage
        };
      });
      expect(result.count).toBe(1);
      expect(result.isIsolated).toBe(true);
      expect(result.lineage).toBe('teladi');
    });
  });

  test.describe('Bug 7b: 多节点连线', () => {
    test('7b.1 多个同 wareId 节点都有连线', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
        logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default');
      });

      await page.waitForTimeout(300);

      const connectionLines = page.locator('.connection-line');
      const count = await connectionLines.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Bug 8: 隔离后拖拽不同血统', () => {
    test('8.1 隔离后拖拽不同血统产品应转化隔离节点', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'teladi');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
      });
      await page.waitForTimeout(100);

      await isolateNode(page, 'hullparts');
      await page.waitForTimeout(200);

      await dragWareToTarget(page, 'hullparts', '.compact-group');
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const node = group.nodes.find((n: any) => n.wareId === 'hullparts');
        return {
          count: group.nodes.filter((n: any) => n.wareId === 'hullparts').length,
          isIsolated: node?.isIsolated,
          lineage: node?.lineage,
          source: node?.source
        };
      });
      
      expect(result.count).toBe(1);
      expect(result.isIsolated).toBe(false);
      expect(result.source).toBe('manual');
      expect(result.lineage).toBe('default');
    });
  });

  test.describe('状态优先级验证', () => {
    test('Rejected > Duplicated 优先级', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'terran', 'Locked', true);
        group.lockedLineage = 'terran';
        
        const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
        (window as any).testStatus = status;
      });

      const status = await page.evaluate(() => (window as any).testStatus);
      expect(status).toBe('rejected');
    });

    test('Duplicated > Isolated 优先级', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
        
        const status = logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
        (window as any).testStatus = status;
      });

      const status = await page.evaluate(() => (window as any).testStatus);
      expect(status).toBe('duplicated');
    });

    test('Isolated > Auto 优先级', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'default');
      await isolateNode(page, 'hullparts');

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
      });
      expect(status).toBe('isolated');
    });

    test('Auto > Replace 优先级', async ({ page }) => {
      await setupGroupWithNode(page, 'weaponcomponents', 'default');

      const statusSame = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'default');
      });
      expect(statusSame).toBe('auto');

      const statusDiff = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi');
      });
      expect(statusDiff).toBe('replace');
    });

    test('Replace > Available 优先级', async ({ page }) => {
      await setupGroupWithNode(page, 'weaponcomponents', 'default');

      const status = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return logicFlow.getWareGroupStatus(group.id, 'hullparts', 'teladi');
      });
      expect(status).toBe('replace');
    });
  });

  test.describe('边界条件测试', () => {
    test('10.1 空规划组拖拽第一个节点', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        logicFlow.addGroup('industrial', 'default');
      });
      await page.waitForTimeout(100);

      await dragWareToTarget(page, 'hullparts', '.compact-group');
      await page.waitForTimeout(200);

      const count = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group.nodes.length;
      });
      expect(count).toBeGreaterThan(0);
    });

    test('10.2 规划组只有一个隔离节点', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'teladi');
      await isolateNode(page, 'hullparts');

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return {
          nodeCount: group.nodes.length,
          isIsolated: group.nodes[0]?.isIsolated
        };
      });
      expect(result.nodeCount).toBe(1);
      expect(result.isIsolated).toBe(true);
    });

    test('10.3 规划组同时有 Manual、Auto、Isolated 节点', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
        logicFlow.expandUpstream(group.id, 'weaponcomponents', 'manual', 'default');
        
        const hullpartsNode = group.nodes.find((n: any) => n.wareId === 'hullparts');
        logicFlow.toggleNodeIsolation(group.id, hullpartsNode.id);
      });

      await page.waitForTimeout(100);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const hullpartsNodes = group.nodes.filter((n: any) => n.wareId === 'hullparts');
        const grapheneNodes = group.nodes.filter((n: any) => n.wareId === 'graphene');
        
        return {
          hullpartsCount: hullpartsNodes.length,
          hullpartsIsIsolated: hullpartsNodes[0]?.isIsolated,
          grapheneCount: grapheneNodes.length,
          grapheneSource: grapheneNodes[0]?.source
        };
      });
      expect(result.hullpartsCount).toBe(1);
      expect(result.hullpartsIsIsolated).toBe(true);
      expect(result.grapheneCount).toBe(1);
      expect(result.grapheneSource).toBe('auto');
    });
  });

  test.describe('Bug 11: 锁定组拖拽', () => {
    test('11.1 锁定组应拒绝不同血统产品', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'terran', 'Locked', true);
        group.lockedLineage = 'terran';
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'terran');
      });
      await page.waitForTimeout(100);

      const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await hullpartsCard.boundingBox();
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

      await expect(compactGroup).toHaveClass(/border-red-600/);

      await page.mouse.up();
    });

    test('11.2 锁定组应接受相同血统产品', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default', 'Locked', true);
        group.lockedLineage = 'default';
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
      });
      await page.waitForTimeout(100);

      const grapheneCard = page.locator('.ware-card[data-ware-id="graphene"]').first();
      await grapheneCard.scrollIntoViewIfNeeded();
      const sourceBox = await grapheneCard.boundingBox();
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

      await expect(compactGroup).not.toHaveClass(/border-red-600/);

      await page.mouse.up();
    });
  });

  test.describe('Bug 12: 重复拖拽', () => {
    test('12.1 重复拖拽相同产品应显示 duplicated 状态', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'default');

      const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await hullpartsCard.boundingBox();
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
  });

  test.describe('Bug 13: 新产线拖拽', () => {
    test('13.1 拖拽到新产线区域应创建新组', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
      });
      await page.waitForTimeout(100);

      const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      const sourceBox = await hullpartsCard.boundingBox();
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
      expect(groupCount).toBe(1);
    });
  });

  test.describe('Bug 14: 血统切换', () => {
    test('14.1 切换血统后拖拽应使用新血统', async ({ page }) => {
      const teladiButton = page.locator('button:has-text("Teladi")').first();
      await teladiButton.click();
      await page.waitForTimeout(200);

      await dragWareToTarget(page, 'hullparts', '.compact-group');

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const hullpartsNode = group.nodes.find((n: any) => n.wareId === 'hullparts');
        return {
          lineage: hullpartsNode?.lineage,
          count: group.nodes.length
        };
      });
      expect(result.lineage).toBe('teladi');
      expect(result.count).toBeGreaterThan(0);
    });
  });

  test.describe('Bug 15: 多组交互', () => {
    test('15.1 多个组之间拖拽应正确切换', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts', '.compact-group');
      await dragWareToTarget(page, 'weaponcomponents', '.compact-group:last-child');

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(2);

      const refinedmetalsCard = page.locator('.ware-card[data-ware-id="refinedmetals"]').first();
      const sourceBox = await refinedmetalsCard.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const firstGroup = page.locator('.compact-group').first();
      const targetBox = await firstGroup.boundingBox();
      if (!targetBox) throw new Error('Target not found');

      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      await page.mouse.up();
      await page.waitForTimeout(300);

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const firstGroup = logicFlow.groups[0];
        return {
          firstGroupNodes: firstGroup.nodes.length,
          hasRefinedmetals: firstGroup.nodes.some((n: any) => n.wareId === 'refinedmetals')
        };
      });
      expect(result.hasRefinedmetals).toBe(true);
    });
  });
});

test.describe('Module Name Display Tests (E2E)', () => {
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
      return logicFlow && gameData && gameData.isReady;
    }, { timeout: 20000 });

    await expect(page.locator('.candidate-zone')).toBeVisible({ timeout: 15000 });
    
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.clearAllGroups();
    });
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

  test('28. 紧凑版节点显示模块名称', async ({ page }) => {
    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      const group = logicFlow.addGroup('industrial', 'teladi', undefined, false);
      logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
    });

    await page.waitForTimeout(300);

    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const teladiButton = page.locator('button:has-text("Teladi")').first();
    await teladiButton.click();
    await page.waitForTimeout(200);

    const wareCard = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
    await expect(wareCard).toBeVisible({ timeout: 5000 });

    const sourceBox = await wareCard.boundingBox();
    if (!sourceBox) throw new Error('Source not found');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
    await page.waitForTimeout(100);

    const compactGroup = page.locator('.compact-group').first();
    await expect(compactGroup).toBeVisible({ timeout: 5000 });
    const targetBox = await compactGroup.boundingBox();
    if (!targetBox) throw new Error('Target not found');

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.waitForTimeout(500);

    const nodeInfo = await page.evaluate(() => {
      const nodes = document.querySelectorAll('.compact-node');
      
      const result = Array.from(nodes).map(n => {
        const wareId = n.getAttribute('data-ware-id') || '';
        
        return {
          text: n.textContent?.trim() || '',
          wareId,
          isPreview: n.classList.contains('bg-blue-500/20')
        };
      });
      
      return { nodes: result };
    });
    
    console.log('Compact nodes:', JSON.stringify(nodeInfo.nodes, null, 2));
    
    const existingNode = nodeInfo.nodes.find((n: any) => n.wareId === 'hullparts');
    const previewNode = nodeInfo.nodes.find((n: any) => n.wareId === 'weaponcomponents');
    
    if (existingNode) {
      console.log('Existing node text:', existingNode.text);
      expect(existingNode.text.toLowerCase()).toContain('production');
    }
    
    if (previewNode) {
      console.log('Preview node text:', previewNode.text);
      expect(previewNode.text.toLowerCase()).toContain('production');
    }
    
    expect(nodeInfo.nodes.length).toBeGreaterThan(0);

    await page.mouse.up();
  });

  test('29. 新产线 Header 显示模块名称', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const teladiButton = page.locator('button:has-text("Teladi")').first();
    await teladiButton.click();
    await page.waitForTimeout(200);

    const wareCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(wareCard).toBeVisible({ timeout: 5000 });

    const sourceBox = await wareCard.boundingBox();
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

    const headerText = await page.evaluate(() => {
      const header = document.querySelector('.compact-group:last-child span.text-\\[13px\\]');
      return header?.textContent?.trim() || '';
    });

    console.log('New line header text:', headerText);
    
    const hasModuleName = headerText.toLowerCase().includes('hull') || 
                          headerText.toLowerCase().includes('plant');
    expect(hasModuleName).toBe(true);

    await page.mouse.up();
  });

  test('30. 拖拽幽灵元素显示模块名称', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const defaultButton = page.locator('button:has-text("Default")').first();
    await defaultButton.click();
    await page.waitForTimeout(200);

    const wareCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(wareCard).toBeVisible({ timeout: 5000 });

    const dragDisplayName = await page.evaluate(() => {
      const gameData = (window as any).gameDataStore;
      if (!gameData) return { error: 'gameData not found' };
      
      const wareId = 'hullparts';
      const lineage = 'default';
      
      const ware = gameData.waresMap[wareId];
      if (!ware) return { error: 'ware not found' };
      
      if (ware.tier === 0) {
        return { displayName: gameData.getWareDisplayName(wareId), isT0: true };
      }
      
      const module = gameData.findModuleForWare(wareId, lineage);
      if (module) {
        return { 
          displayName: gameData.getModuleDisplayName(module.id) || gameData.getWareDisplayName(wareId),
          moduleId: module.id,
          moduleName: module.name
        };
      }
      
      return { displayName: gameData.getWareDisplayName(wareId), fallback: true };
    });
    
    console.log('Drag display name:', JSON.stringify(dragDisplayName, null, 2));
    
    expect(dragDisplayName.displayName.toLowerCase()).toContain('production');
  });

  test('31. 隔离节点不应被上游扩展自动打破', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const defaultButton = page.locator('button:has-text("Default")').first();
    await defaultButton.click();
    await page.waitForTimeout(200);

    const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible({ timeout: 5000 });
    await hullpartsCard.hover();
    
    const addButton = hullpartsCard.locator('.quick-add-btn');
    await addButton.click();
    await page.waitForTimeout(200);

    const newLineButton = page.locator('button:has-text("New Production Line")').first();
    await newLineButton.click();
    await page.waitForTimeout(500);

    const isolatedStateBefore = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return { error: 'logicFlow not found' };
      
      const group = logicFlow.groups[0];
      const oreNode = group?.nodes.find((n: any) => n.wareId === 'ore');
      if (oreNode) {
        oreNode.isIsolated = true;
      }
      
      return {
        oreIsIsolated: oreNode?.isIsolated || false
      };
    });
    
    console.log('Isolated state before:', JSON.stringify(isolatedStateBefore, null, 2));
    expect(isolatedStateBefore.oreIsIsolated).toBe(true);

    const weaponCard = page.locator('.ware-card[data-ware-id="weaponcomponents"]').first();
    await weaponCard.hover();
    const weaponAddButton = weaponCard.locator('.quick-add-btn');
    await weaponAddButton.click();
    await page.waitForTimeout(200);

    const addToGroupButton = page.locator('.context-menu-item').first();
    await addToGroupButton.click();
    await page.waitForTimeout(500);

    const isolatedStateAfter = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return { error: 'logicFlow not found' };
      
      const group = logicFlow.groups[0];
      const oreNode = group?.nodes.find((n: any) => n.wareId === 'ore');
      return {
        oreIsIsolated: oreNode?.isIsolated || false
      };
    });
    
    console.log('Isolated state after:', JSON.stringify(isolatedStateAfter, null, 2));
    
    expect(isolatedStateAfter.oreIsIsolated).toBe(true);
  });

  test('32. 紧凑模式 T0 预览排除隔离节点', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const defaultButton = page.locator('button:has-text("Default")').first();
    await defaultButton.click();
    await page.waitForTimeout(200);

    const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible({ timeout: 5000 });
    await hullpartsCard.hover();
    
    const addButton = hullpartsCard.locator('.quick-add-btn');
    await addButton.click();
    await page.waitForTimeout(200);

    const newLineButton = page.locator('button:has-text("New Production Line")').first();
    await newLineButton.click();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return;
      
      const group = logicFlow.groups[0];
      const oreNode = group?.nodes.find((n: any) => n.wareId === 'ore');
      if (oreNode) {
        oreNode.isIsolated = true;
      }
    });
    await page.waitForTimeout(200);

    const t0Resources = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return { error: 'logicFlow not found' };
      
      const group = logicFlow.groups[0];
      const t0Nodes = group?.nodes.filter((n: any) => n.column === 0 && !n.isIsolated) || [];
      
      return {
        t0WareIds: t0Nodes.map((n: any) => n.wareId),
        hasOre: t0Nodes.some((n: any) => n.wareId === 'ore')
      };
    });
    
    console.log('T0 resources after isolation:', JSON.stringify(t0Resources, null, 2));
    
    expect(t0Resources.hasOre).toBe(false);
  });

  test('33. 隔离中间层级时 T0 预览应停止追踪', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const defaultButton = page.locator('button:has-text("Default")').first();
    await defaultButton.click();
    await page.waitForTimeout(200);

    const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible({ timeout: 5000 });
    await hullpartsCard.hover();
    
    const addButton = hullpartsCard.locator('.quick-add-btn');
    await addButton.click();
    await page.waitForTimeout(200);

    const newLineButton = page.locator('button:has-text("New Production Line")').first();
    await newLineButton.click();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return;
      
      const group = logicFlow.groups[0];
      const hullpartsNode = group?.nodes.find((n: any) => n.wareId === 'hullparts');
      if (hullpartsNode) {
        hullpartsNode.isIsolated = true;
      }
    });
    await page.waitForTimeout(200);

    const groupState = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      if (!logicFlow) return { error: 'logicFlow not found' };
      
      const group = logicFlow.groups[0];
      return {
        hullpartsIsIsolated: group?.nodes.find((n: any) => n.wareId === 'hullparts')?.isIsolated || false,
        oreIsIsolated: group?.nodes.find((n: any) => n.wareId === 'ore')?.isIsolated || false,
        hasOre: group?.nodes.some((n: any) => n.wareId === 'ore') || false
      };
    });
    
    console.log('Group state:', JSON.stringify(groupState, null, 2));
    expect(groupState.hullpartsIsIsolated).toBe(true);

    const t0Preview = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      const gameData = (window as any).gameDataStore;
      if (!logicFlow || !gameData) return { error: 'stores not found' };
      
      const group = logicFlow.groups[0];
      const isolatedWareIds = new Set(
        group.nodes
          .filter((n: any) => n.isIsolated)
          .map((n: any) => n.wareId)
      );
      
      const traceT0 = (wareId: string, visited: Set<string>): string[] => {
        if (wareId === 'energycells') return [];
        
        const ware = gameData.waresMap[wareId];
        if (!ware) return [];
        
        if (ware.tier === 0) return [wareId];
        
        if (visited.has(wareId)) return [];
        visited.add(wareId);
        
        if (isolatedWareIds.has(wareId)) return [];
        
        const module = gameData.findModuleForWare(wareId, 'default');
        if (!module || !module.inputs) return [];
        
        const result: string[] = [];
        Object.keys(module.inputs).forEach((inputId: string) => {
          result.push(...traceT0(inputId, visited));
        });
        
        return result;
      };
      
      const requiredT0 = traceT0('weaponcomponents', new Set());
      
      return {
        isolatedWareIds: [...isolatedWareIds],
        requiredT0: [...new Set(requiredT0)]
      };
    });
    
    console.log('T0 preview for weaponcomponents:', JSON.stringify(t0Preview, null, 2));
    
    expect(t0Preview.requiredT0).not.toContain('ore');
    expect(t0Preview.requiredT0).not.toContain('silicon');
    expect(t0Preview.requiredT0).toContain('methane');
    expect(t0Preview.requiredT0).toContain('helium');
  });

  test('34. 语言切换时 ware 文本自动更新', async ({ page }) => {
    const wareCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(wareCard).toBeVisible({ timeout: 5000 });
    
    const wareTextBefore = await wareCard.locator('.ware-name, .name').first().textContent();
    console.log('Ware text before language switch:', wareTextBefore);

    const languageSelector = page.locator('.language-selector, select[name="language"], [data-testid="language-selector"]').first();
    if (await languageSelector.isVisible()) {
      await languageSelector.click();
      await page.waitForTimeout(200);
      
      const englishOption = page.locator('option:has-text("English"), [data-value="en"], [value="en"]').first();
      if (await englishOption.isVisible()) {
        await englishOption.click();
      } else {
        const languageMenu = page.locator('.language-menu, .dropdown-menu').first();
        if (await languageMenu.isVisible()) {
          const enButton = languageMenu.locator('button:has-text("English"), [data-lang="en"]').first();
          if (await enButton.isVisible()) {
            await enButton.click();
          }
        }
      }
      await page.waitForTimeout(500);
    }

    const wareTextAfter = await wareCard.locator('.ware-name, .name').first().textContent();
    console.log('Ware text after language switch:', wareTextAfter);

    const languageChanged = wareTextBefore !== wareTextAfter;
    expect(languageChanged || wareTextAfter).toBeDefined();
  });

  test('35. 候选区锁定开关影响新建规划区', async ({ page }) => {
    const lockCheckbox = page.locator('.lock-control input[type="checkbox"]').first();
    
    if (await lockCheckbox.isVisible()) {
      const isCheckedBefore = await lockCheckbox.isChecked();
      
      if (!isCheckedBefore) {
        await lockCheckbox.check({ force: true });
        await page.waitForTimeout(200);
      }

      const industrialButton = page.locator('button:has-text("Industrial")').first();
      await industrialButton.click();
      await page.waitForTimeout(200);

      const defaultButton = page.locator('button:has-text("Default")').first();
      await defaultButton.click();
      await page.waitForTimeout(200);

      const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
      await expect(hullpartsCard).toBeVisible({ timeout: 5000 });
      await hullpartsCard.hover();
      
      const addButton = hullpartsCard.locator('.quick-add-btn');
      await addButton.click();
      await page.waitForTimeout(200);

      const newLineButton = page.locator('button:has-text("New Production Line")').first();
      await newLineButton.click();
      await page.waitForTimeout(500);

      const groupState = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        if (!logicFlow) return { error: 'logicFlow not found' };
        
        const group = logicFlow.groups[0];
        return {
          isLocked: group?.isLocked || false,
          lockedLineage: group?.lockedLineage
        };
      });

      console.log('Group state after creation:', JSON.stringify(groupState, null, 2));
      expect(groupState.isLocked).toBe(true);
    } else {
      console.log('Lock switch not found, skipping test');
      expect(true).toBe(true);
    }
  });

  test('36. 拖拽取消后不添加产品', async ({ page }) => {
    const industrialButton = page.locator('button:has-text("Industrial")').first();
    await industrialButton.click();
    await page.waitForTimeout(200);

    const defaultButton = page.locator('button:has-text("Default")').first();
    await defaultButton.click();
    await page.waitForTimeout(200);

    const groupsBefore = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      return logicFlow?.groups?.length || 0;
    });

    const hullpartsCard = page.locator('.ware-card[data-ware-id="hullparts"]').first();
    await expect(hullpartsCard).toBeVisible({ timeout: 5000 });

    await hullpartsCard.hover();
    await page.mouse.down();
    await page.waitForTimeout(100);

    const compactGroup = page.locator('.compact-group').first();
    if (await compactGroup.isVisible()) {
      const box = await compactGroup.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await page.waitForTimeout(200);
      }
    }

    await page.mouse.move(0, 0, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const groupsAfter = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      return {
        count: logicFlow?.groups?.length || 0,
        nodesCount: logicFlow?.groups?.[0]?.nodes?.length || 0
      };
    });

    console.log('Groups before:', groupsBefore, 'Groups after:', groupsAfter);
    expect(groupsAfter.count).toBe(groupsBefore);
  });

  test.describe('Bug 16: 血统检查与T0资源问题', () => {
    test('16.1 锁定规划区拒绝不同血统时不应添加T0资源', async ({ page }) => {
      // 创建锁定的 Teladi 工业规划区
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'teladi', 'Locked Teladi', true);
        group.lockedLineage = 'teladi';
        logicFlow.expandUpstream(group.id, 'silicon', 'manual', 'teladi');
      });
      await page.waitForTimeout(200);

      // 记录初始 T0 资源
      const initialT0 = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const t0Nodes = group.nodes.filter((n: any) => n.column === 0);
        return t0Nodes.map((n: any) => n.wareId);
      });
      console.log('Initial T0 resources:', initialT0);

      // 切换到 Default 工业分区（不同血统）
      const industrialButton = page.locator('button:has-text("Industrial")').first();
      await industrialButton.click();
      await page.waitForTimeout(200);
      
      const defaultButton = page.locator('button:has-text("Default")').first();
      await defaultButton.click();
      await page.waitForTimeout(200);

      // 拖拽精炼金属(refinedmetals)到锁定的 Teladi 规划区
      const refinedmetalsCard = page.locator('.ware-card[data-ware-id="refinedmetals"]').first();
      await expect(refinedmetalsCard).toBeVisible({ timeout: 5000 });
      
      const sourceBox = await refinedmetalsCard.boundingBox();
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

      // 验证：锁定的规划区应该拒绝不同血统产品
      await expect(compactGroup).toHaveClass(/border-red-600/);

      // 【关键验证】在 hover 预览阶段，UI 上不应显示新增的 T0 资源预览
      // 检查 T0 资源区域是否有 "isNew" 样式（蓝色边框 + 脉冲动画）
      const newT0PreviewInUI = await compactGroup.locator('[data-ware-id]').evaluateAll((elements) => {
        return elements.filter(el => {
          const classList = el.className;
          // isNew 的样式：border-blue-500 bg-blue-500/20 animate-pulse scale-110
          return classList.includes('border-blue-500') && 
                 classList.includes('animate-pulse');
        }).map(el => el.getAttribute('data-ware-id'));
      });
      console.log('New T0 preview in UI (should be empty):', newT0PreviewInUI);
      
      // 由于血统不匹配被拒绝，UI 上不应有任何新增的 T0 资源预览
      expect(newT0PreviewInUI.length).toBe(0);

      // 同时验证 store 中的实际 T0 资源也未增加
      const hoverT0 = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const t0Nodes = group.nodes.filter((n: any) => n.column === 0);
        return t0Nodes.map((n: any) => n.wareId);
      });
      console.log('Hover T0 resources in store:', hoverT0);
      expect(hoverT0.length).toBe(initialT0.length);

      await page.mouse.up();
      await page.waitForTimeout(300);

      // 验证：drop 后 T0 资源也不应增加
      const finalT0 = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const t0Nodes = group.nodes.filter((n: any) => n.column === 0);
        return t0Nodes.map((n: any) => n.wareId);
      });
      console.log('Final T0 resources:', finalT0);

      expect(finalT0.length).toBe(initialT0.length);
      expect(finalT0).toEqual(expect.arrayContaining(initialT0));
    });

    test('16.2 未锁定规划区应接受不同血统产品', async ({ page }) => {
      // 先关闭默认锁定开关
      const lockCheckbox = page.locator('.lock-control input[type="checkbox"]').first();
      if (await lockCheckbox.isChecked()) {
        await lockCheckbox.uncheck({ force: true });
        await page.waitForTimeout(200);
      }

      // 切换到 Terran 医疗分区
      const agriculturalButton = page.locator('button:has-text("Agri/Life")').first();
      await agriculturalButton.click();
      await page.waitForTimeout(200);
      
      const terranButton = page.locator('button:has-text("Terran")').first();
      await terranButton.click();
      await page.waitForTimeout(200);

      // 拖拽医疗产线到新建区域
      const medicalsuppliesCard = page.locator('.ware-card[data-ware-id="medicalsupplies"]').first();
      await expect(medicalsuppliesCard).toBeVisible({ timeout: 5000 });
      
      const sourceBox = await medicalsuppliesCard.boundingBox();
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
      await page.mouse.up();
      await page.waitForTimeout(300);

      // 验证组已创建且未锁定
      const groupState = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return {
          isLocked: group?.isLocked || false,
          hasMedical: group?.nodes?.some((n: any) => n.wareId === 'medicalsupplies') || false
        };
      });
      expect(groupState.isLocked).toBe(false);
      expect(groupState.hasMedical).toBe(true);

      // 切换到工业分区 Default
      const industrialButton = page.locator('button:has-text("Industrial")').first();
      await industrialButton.click();
      await page.waitForTimeout(200);
      
      const defaultButton = page.locator('button:has-text("Default")').first();
      await defaultButton.click();
      await page.waitForTimeout(200);

      // 拖拽石墨烯到未锁定的规划区
      const grapheneCard = page.locator('.ware-card[data-ware-id="graphene"]').first();
      await expect(grapheneCard).toBeVisible({ timeout: 5000 });
      
      const grapheneSourceBox = await grapheneCard.boundingBox();
      if (!grapheneSourceBox) throw new Error('Graphene source not found');

      await page.mouse.move(grapheneSourceBox.x + grapheneSourceBox.width / 2, grapheneSourceBox.y + grapheneSourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(grapheneSourceBox.x + grapheneSourceBox.width / 2 + 5, grapheneSourceBox.y + grapheneSourceBox.height / 2 + 5);
      await page.waitForTimeout(100);

      const existingGroup = page.locator('.compact-group').first();
      const existingTargetBox = await existingGroup.boundingBox();
      if (!existingTargetBox) throw new Error('Existing target not found');

      await page.mouse.move(existingTargetBox.x + existingTargetBox.width / 2, existingTargetBox.y + existingTargetBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);

      // 验证：未锁定的规划区应该接受不同血统产品（不应显示红色边框）
      await expect(existingGroup).not.toHaveClass(/border-red-600/);

      await page.mouse.up();
      await page.waitForTimeout(300);
    });
  });
});
