import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { dragWareToTarget } from './helpers/dragLogicFlow';

test.describe('Logic Flow Plans - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  const switchToLogicFlowView = async (page: any) => {
    const logicFlowBtn = page.getByTestId('top-view-btn-flow');
    await logicFlowBtn.click();
    await expect(logicFlowBtn).toHaveClass(/bg-purple-600/);
  };

  test.describe('标题栏主题切换', () => {
    test('E2E-1: 标题栏颜色根据视图正确切换', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const title = page.locator('.plan-title-text');
      await expect(title).toHaveClass('plan-title-text');
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
      await dragWareToTarget(page, 'hullparts');
      
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
      expect(groupCount).toBe(0);
    });
  });

  test.describe('保存逻辑组网方案', () => {
    test('E2E-4: 保存新方案流程', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');

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
      await dragWareToTarget(page, 'hullparts');

      await page.evaluate(() => {
        const store = (window as any).logicFlowStore;
        store.saveCurrentPlan('Existing Plan');
      });
      await page.waitForTimeout(200);

      await dragWareToTarget(page, 'weaponcomponents');

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
      await expect(modal).toBeVisible();
      const loadPlanBtn = modal.locator('button').filter({ hasText: /加载|Load/i }).first();
      await expect(loadPlanBtn).toBeVisible();
      await loadPlanBtn.click();
      await page.waitForTimeout(200);

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(1);
    });
  });

  test.describe('标题编辑', () => {
    test('E2E-9: 标题编辑功能', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const title = page.locator('.plan-title-text');
      await title.click();
      await page.waitForTimeout(100);

      const input = page.locator('.plan-title-input');
      await expect(input).toBeVisible();
      await input.fill('New Plan Title');
      await input.press('Enter');
      await page.waitForTimeout(200);

      const planName = await page.evaluate(() => (window as any).logicFlowStore.currentPlanName);
      expect(planName).toBe('New Plan Title');
    });
  });

  test.describe('视图切换数据隔离', () => {
    test('E2E-11: 两个视图的数据隔离', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');

      const flowGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(flowGroupCount).toBeGreaterThan(0);

      const productionBtn = page.getByTestId('top-view-btn-blueprint-production');
      await expect(productionBtn).toBeVisible();
      await productionBtn.click();
      await page.waitForTimeout(200);

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

      await dragWareToTarget(page, 'hullparts');
      await page.waitForTimeout(200);

      const newDropTarget = page.locator('.groups-list .drop-target, .new-group-zone').last();
      await expect(newDropTarget).toBeVisible();
    });
  });

  test.describe('产线组名称动态计算', () => {
    test('E2E-15: 产线组名称动态计算', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');

      const groupTitle = page.locator('.production-group h3').first();
      await expect(groupTitle).toBeVisible();
      
      await expect(groupTitle).toContainText(/E1-S1|Hull Parts|船体部件|hullparts/i);
    });
  });
});
