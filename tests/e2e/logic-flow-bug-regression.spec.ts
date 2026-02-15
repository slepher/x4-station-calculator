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

  async function performDragDrop(page: any, wareId: string, targetSelector: string, lineage: string = 'default') {
    await page.evaluate((args) => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.startDragging(args.wareId, args.lineage);
    }, { wareId, lineage });

    const wareCard = page.locator(`.ware-card[data-ware-id="${wareId}"]`).first();
    await expect(wareCard).toBeVisible({ timeout: 5000 });
    
    await wareCard.hover();
    await page.mouse.down();
    
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(100 + i * 50, 100 + i * 50, { steps: 5 });
      await page.waitForTimeout(30);
    }
    
    const target = page.locator(targetSelector).first();
    await expect(target).toBeVisible({ timeout: 5000 });
    
    const box = await target.boundingBox();
    if (!box) throw new Error(`Target ${targetSelector} not found`);
    
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.waitForTimeout(100);
    
    const groupId = await page.evaluate(() => {
      const logicFlow = (window as any).logicFlowStore;
      return logicFlow.groups[0]?.id;
    });
    
    await page.evaluate((gId) => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.hoveredGroupId = gId;
      console.log('[performDragDrop] Set hoveredGroupId to:', gId, 'Current value:', logicFlow.hoveredGroupId);
    }, groupId);
    
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  async function setupGroupWithNode(page: any, wareId: string, lineage: string = 'default') {
    await page.evaluate((args) => {
      const logicFlow = (window as any).logicFlowStore;
      logicFlow.clearAllGroups();
      const group = logicFlow.addGroup('industrial', args.lineage);
      logicFlow.expandUpstream(group.id, args.wareId, 'manual', args.lineage);
    }, { wareId, lineage });
    await page.waitForTimeout(200);
  }

  async function isolateNode(page: any, wareId: string) {
    await page.evaluate((wareId) => {
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
      await hullpartsCard.hover();
      await page.mouse.down();
      await page.mouse.move(300, 300, { steps: 5 });
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
    test('3.1 不同血统的同种产品应可共存 (真实拖拽)', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        logicFlow.addGroup('industrial', 'default');
      });
      await page.waitForTimeout(100);

      await performDragDrop(page, 'hullparts', '.compact-group', 'default');
      await page.waitForTimeout(200);

      const hullpartsCard = page.locator(`.ware-card[data-ware-id="hullparts"]`).first();
      await hullpartsCard.hover();
      await page.mouse.down();
      await page.mouse.move(300, 300, { steps: 5 });
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

      await performDragDrop(page, 'hullparts', '.compact-group', 'default');
      await page.waitForTimeout(200);

      const grapheneStatus = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const grapheneNode = group.nodes.find((n: any) => n.wareId === 'graphene');
        return { source: grapheneNode?.source, isAuto: grapheneNode?.isAuto };
      });
      expect(grapheneStatus.source).toBe('auto');

      await performDragDrop(page, 'graphene', '.compact-group', 'default');
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

      await performDragDrop(page, 'graphene', '.compact-group', 'default');
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
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      });

      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'teladi');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
      });
      await page.waitForTimeout(100);

      await isolateNode(page, 'hullparts');
      await page.waitForTimeout(200);

      await performDragDrop(page, 'hullparts', '.compact-group', 'default');
      await page.waitForTimeout(500);

      console.log('Test 8.1 Console messages:', consoleMessages.filter(m => m.includes('handleAddToExistingGroup') || m.includes('performDragDrop') || m.includes('isDropAllowed') || m.includes('handleAddFromDrop')));

      const debugInfo = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        return {
          groupsCount: logicFlow.groups.length,
          groups: logicFlow.groups.map((g: any) => ({
            id: g.id,
            nodesCount: g.nodes.length,
            isLocked: g.isLocked,
            lockedLineage: g.lockedLineage,
            lineage: g.lineage
          }))
        };
      });
      console.log('Test 8.1 Debug info after drag:', debugInfo);

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
    test('10.1 空规划组拖拽第一个节点 (真实拖拽)', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        logicFlow.addGroup('industrial', 'default');
      });
      await page.waitForTimeout(100);

      await performDragDrop(page, 'hullparts', '.compact-group', 'default');
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
        return {
          manualCount: group.nodes.filter((n: any) => n.source === 'manual' && !n.isIsolated).length,
          autoCount: group.nodes.filter((n: any) => n.source === 'auto' && !n.isIsolated).length,
          isolatedCount: group.nodes.filter((n: any) => n.isIsolated).length
        };
      });
      expect(result.manualCount).toBeGreaterThan(0);
      expect(result.autoCount).toBeGreaterThan(0);
      expect(result.isolatedCount).toBe(1);
    });

    test('10.4 删除最后一个 Manual 节点后组为空', async ({ page }) => {
      await setupGroupWithNode(page, 'hullparts', 'default');

      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const node = group.nodes.find((n: any) => n.wareId === 'hullparts');
        logicFlow.removeNode(group.id, node.id);
      });

      await page.waitForTimeout(100);

      const count = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group.nodes.length;
      });
      expect(count).toBe(0);
    });

    test('10.5 T0 资源在任何情况下都允许合并', async ({ page }) => {
      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.clearAllGroups();
        const group = logicFlow.addGroup('industrial', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'default');
        logicFlow.expandUpstream(group.id, 'hullparts', 'manual', 'teladi');
      });

      await page.waitForTimeout(100);

      const energyCellsCount = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return group.nodes.filter((n: any) => n.wareId === 'energycells').length;
      });
      expect(energyCellsCount).toBe(1);
    });

    test('10.6 锁定组的血统强制约束', async ({ page }) => {
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

    test('10.7 锁定组应使用 lockedLineage 添加节点 (Bug 9 回归)', async ({ page }) => {
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      });

      const agriButton = page.locator('button:has-text("Agri")').first();
      await expect(agriButton).toBeVisible({ timeout: 5000 });
      await agriButton.click();
      await page.waitForTimeout(200);

      const teladiButton = page.locator('button:has-text("Teladi")').first();
      await expect(teladiButton).toBeVisible({ timeout: 5000 });
      await teladiButton.click();
      await page.waitForTimeout(200);

      const teladiMedicalCard = page.locator('.ware-card[data-ware-id="medicalsupplies"]').first();
      await expect(teladiMedicalCard).toBeVisible({ timeout: 5000 });

      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.startDragging('medicalsupplies', 'teladi');
      });

      await teladiMedicalCard.hover();
      await page.mouse.down();
      
      const newZone = page.locator('.compact-group').last();
      await expect(newZone).toBeVisible({ timeout: 5000 });
      
      const box = await newZone.boundingBox();
      if (!box) throw new Error('New zone not found');
      
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      console.log('Console messages after first drop:', consoleMessages.filter(m => m.includes('handleAddFromDrop')));

      const groupAfterFirstDrop = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return {
          exists: !!group,
          nodesCount: group?.nodes?.length || 0,
          lineage: group?.lineage
        };
      });
      console.log('Group after first drop:', groupAfterFirstDrop);
      expect(groupAfterFirstDrop.exists).toBe(true);
      expect(groupAfterFirstDrop.nodesCount).toBeGreaterThan(0);

      await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        logicFlow.toggleGroupLock(group.id);
      });
      await page.waitForTimeout(100);

      const groupInfo = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        return {
          isLocked: group.isLocked,
          lockedLineage: group.lockedLineage,
          groupId: group.id
        };
      });
      expect(groupInfo.isLocked).toBe(true);
      expect(groupInfo.lockedLineage).toBe('teladi');

      const splitButton = page.locator('button:has-text("Split")').first();
      await expect(splitButton).toBeVisible({ timeout: 5000 });
      await splitButton.click();
      await page.waitForTimeout(200);

      const splitMedicalCard = page.locator('.ware-card[data-ware-id="medicalsupplies"]').first();
      await expect(splitMedicalCard).toBeVisible({ timeout: 5000 });

      await page.evaluate((gId) => {
        const logicFlow = (window as any).logicFlowStore;
        logicFlow.startDragging('medicalsupplies', 'split');
        logicFlow.hoveredGroupId = gId;
      }, groupInfo.groupId);

      await splitMedicalCard.hover();
      await page.mouse.down();
      
      const existingGroup = page.locator('.compact-group').first();
      await expect(existingGroup).toBeVisible({ timeout: 5000 });
      
      const existingBox = await existingGroup.boundingBox();
      if (!existingBox) throw new Error('Existing group not found');
      
      await page.mouse.move(existingBox.x + existingBox.width / 2, existingBox.y + existingBox.height / 2, { steps: 10 });
      await page.waitForTimeout(100);
      await page.mouse.up();
      await page.waitForTimeout(500);

      console.log('Console messages after second drop:', consoleMessages.filter(m => m.includes('handleAdd')));

      const result = await page.evaluate(() => {
        const logicFlow = (window as any).logicFlowStore;
        const group = logicFlow.groups[0];
        const medicalNodes = group.nodes.filter((n: any) => n.wareId === 'medicalsupplies');
        return {
          count: medicalNodes.length,
          lineages: medicalNodes.map((n: any) => n.lineage),
          sources: medicalNodes.map((n: any) => n.source)
        };
      });
      
      expect(result.count).toBe(1);
      expect(result.lineages[0]).toBe('teladi');
      expect(result.sources[0]).toBe('manual');
    });
  });
});
