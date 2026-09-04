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
      await expect(title).toHaveClass(/text-purple-400/);
    });
  });

  test.describe('新建逻辑组网方案', () => {
    test('E2E-2: 新建方案流程（无修改）', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const initialGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      
      const newBtn = page.getByTestId('toolbar-new-btn');
      await newBtn.click();
      await page.waitForTimeout(200);

      const finalGroupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(finalGroupCount).toBe(0);
    });

    test('E2E-3: 新建方案流程（有修改）', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');
      
      const newBtn = page.getByTestId('toolbar-new-btn');
      await newBtn.click();

      const dialog = page.locator('.smart-save-dialog, [role="dialog"]').filter({ hasText: /保存|Save/i });
      await expect(dialog).toBeVisible();
      const cancelBtn = dialog.locator('button').filter({ hasText: /取消|Cancel/i }).first();
      await cancelBtn.click();

      const groupCount = await page.evaluate(() => (window as any).logicFlowStore.groups.length);
      expect(groupCount).toBe(0);
    });
  });

  test.describe('保存逻辑组网方案', () => {
    test('E2E-4: 保存新方案流程', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');

      await page.getByTestId('toolbar-save-btn').click();
      await expect(page.locator('.smart-save-dialog, [role="dialog"]')).toBeVisible();
      await expect(page.locator('.smart-save-dialog, [role="dialog"]')).toContainText(/保存|Save/i);
    });

    test('E2E-5: 保存已存在方案', async ({ page }) => {
      await switchToLogicFlowView(page);
      await dragWareToTarget(page, 'hullparts');

      await page.getByTestId('toolbar-save-as-btn').click();
      const saveAs = page.locator('.smart-save-dialog, [role="dialog"]');
      await expect(saveAs).toBeVisible();
      const nameInput = saveAs.locator('input').first();
      await nameInput.fill('Existing Plan');
      await saveAs.getByRole('button', { name: /保存|Save/i }).last().click();

      await dragWareToTarget(page, 'weaponcomponents');

      await page.getByTestId('toolbar-save-btn').click();

      const planCount = await page.evaluate(() => (window as any).logicFlowStore.savedPlans.list.length);
      expect(planCount).toBe(1);
    });
  });

  test.describe('加载逻辑组网方案', () => {
    test('E2E-7: 加载方案流程', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      await setupLogicFlow(page, 'seeded');
      await page.getByTestId('toolbar-new-btn').click();
      await expect(page.locator('.production-group')).toHaveCount(0);

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
      
      await page.getByTestId('toolbar-save-btn').click();
      await expect(page.locator('.status-message, [role="alert"]')).toContainText(/无法保存|cannot save|empty/i);
    });
  });

  test.describe('创建新产区入口', () => {
    test('E2E-14: 创建新产区入口始终可见', async ({ page }) => {
      await switchToLogicFlowView(page);
      
      const dropTarget = page.locator('.groups-list .drop-target').last();
      await expect(dropTarget).toBeVisible();

      await dragWareToTarget(page, 'hullparts');
      await page.waitForTimeout(200);

      const newDropTarget = page.locator('.groups-list .drop-target').last();
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
