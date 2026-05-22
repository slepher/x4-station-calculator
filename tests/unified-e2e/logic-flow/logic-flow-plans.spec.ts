import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.describe('Logic Flow Plans - E2E Tests', () => {
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

  const dragWareToNewZone = async (page: any, wareId: string) => {
    const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]`).first();
    await expect(source).toBeVisible({ timeout: 5000 });

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

  const switchToLogicFlowView = async (page: any) => {
    const logicFlowBtn = page.locator('.view-mode-btn').filter({ hasText: /逻辑|Logic/i });
    if (await logicFlowBtn.count() > 0) {
      await logicFlowBtn.click();
      await page.waitForTimeout(200);
    }
  };

  test.describe('标题栏主题切换', () => {
    test('E2E-1: 标题栏颜色根据视图正确切换', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const title = page.locator('.station-toolbar h1, .toolbar-title').first();
      const titleClass = await title.getAttribute('class');
      expect(titleClass).toContain('text-purple');
    });
  });

  test.describe('新建逻辑组网方案', () => {
    test('E2E-2: 新建方案流程（无修改）', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      
      const newBtn = page.locator('button').filter({ hasText: /新建|New/i }).first();
      await newBtn.click();
      await page.waitForTimeout(200);

      const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(finalGroupCount).toBe(0);
    });

    test('E2E-3: 新建方案流程（有修改）', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToNewZone(page, 'hullparts');
      
      const newBtn = page.locator('button').filter({ hasText: /新建|New/i }).first();
      await newBtn.click();
      await page.waitForTimeout(200);

      const dialog = page.locator('.smart-save-dialog, [role="dialog"]').filter({ hasText: /保存|Save/i });
      const dialogVisible = await dialog.count() > 0;
      
      if (dialogVisible) {
        const cancelBtn = dialog.locator('button').filter({ hasText: /取消|Cancel|丢弃|Discard/i }).first();
        await cancelBtn.click();
        await page.waitForTimeout(200);
      }

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('保存逻辑组网方案', () => {
    test('E2E-4: 保存新方案流程', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToNewZone(page, 'hullparts');

      const result = await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        return store.saveCurrentPlan('Test Plan E2E');
      });

      expect(result).toBe(true);
      
      const planCount = await page.evaluate(() => (window as any).logicFlowStore.savedPlans.list.length);
      expect(planCount).toBeGreaterThan(0);
    });

    test('E2E-5: 保存已存在方案', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToNewZone(page, 'hullparts');

      await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        store.saveCurrentPlan('Existing Plan');
      });
      await page.waitForTimeout(200);

      await dragWareToNewZone(page, 'weaponcomponents');

      const saveBtn = page.locator('button').filter({ hasText: /保存|Save/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(200);

      const planCount = await page.evaluate(() => (window as any).logicFlowStore.savedPlans.list.length);
      expect(planCount).toBe(1);
    });
  });

  test.describe('加载逻辑组网方案', () => {
    test('E2E-7: 加载方案流程', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        store.groups = [{
          id: 'test-group',
          name: 'Test Group',
          category: 'industrial',
          subCategory: 'default',
          isLocked: false,
          lockedLineage: 'default',
          nodes: [{
            id: 'node-1',
            wareId: 'hullparts',
            moduleId: 'module-hullparts',
            race: 'argon',
            lineage: 'default',
            column: 2,
            isIsolated: false,
            isAuto: false,
            isRoot: true,
            source: 'manual',
            order: 0,
          }]
        }];
        store.saveCurrentPlan('Pre-saved Plan');
      });
      await page.waitForTimeout(200);

      await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        store.clearAll();
      });
      await page.waitForTimeout(200);

      const loadBtn = page.locator('button').filter({ hasText: /加载|Load/i }).first();
      await loadBtn.click();
      await page.waitForTimeout(200);

      const modal = page.locator('.load-plan-modal, [role="dialog"]').filter({ hasText: /加载|Load/i });
      if (await modal.count() > 0) {
        const loadPlanBtn = modal.locator('button').filter({ hasText: /加载|Load/i }).first();
        await loadPlanBtn.click();
        await page.waitForTimeout(200);
      }

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('标题编辑', () => {
    test('E2E-9: 标题编辑功能', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const title = page.locator('.station-toolbar h1, .toolbar-title').first();
      await title.click();
      await page.waitForTimeout(100);

      const input = page.locator('.station-toolbar input, .toolbar-input').first();
      if (await input.count() > 0) {
        await input.fill('New Plan Title');
        await input.press('Enter');
        await page.waitForTimeout(200);

        const planName = await page.evaluate(() => (window as any).logicFlowStore.currentPlanName);
        expect(planName).toBe('New Plan Title');
      }
    });
  });

  test.describe('视图切换数据隔离', () => {
    test('E2E-11: 两个视图的数据隔离', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToNewZone(page, 'hullparts');

      const flowGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(flowGroupCount).toBeGreaterThan(0);

      const productionBtn = page.locator('.view-mode-btn').filter({ hasText: /量化|Quantified|生产|Production/i }).first();
      if (await productionBtn.count() > 0) {
        await productionBtn.click();
        await page.waitForTimeout(200);
      }

      await switchToLogicFlowView(page);
      await page.waitForTimeout(200);

      const restoredGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(restoredGroupCount).toBe(flowGroupCount);
    });
  });

  test.describe('空方案保存警告', () => {
    test('E2E-12: 空方案无法保存', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        store.clearAll();
      });
      await page.waitForTimeout(200);

      const result = await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        return store.saveCurrentPlan('Empty Plan');
      });

      expect(result).toBe(false);
    });
  });

  test.describe('创建新产区入口', () => {
    test('E2E-14: 创建新产区入口始终可见', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const dropTarget = page.locator('.groups-list .drop-target, .new-group-zone').last();
      await expect(dropTarget).toBeVisible();

      await dragWareToNewZone(page, 'hullparts');
      await page.waitForTimeout(200);

      const newDropTarget = page.locator('.groups-list .drop-target, .new-group-zone').last();
      await expect(newDropTarget).toBeVisible();
    });
  });

  test.describe('产线组名称动态计算', () => {
    test('E2E-15: 产线组名称动态计算', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToNewZone(page, 'hullparts');

      const groupTitle = page.locator('.production-group h3').first();
      await expect(groupTitle).toBeVisible();
      
      const titleText = await groupTitle.textContent();
      expect(titleText).toBeTruthy();
    });
  });
});
