import { test } from '../../test-setup';
import { expect } from '@playwright/test';
import { setupLogicFlow } from './helpers/setupLogicFlow';
import { dragWareToTarget } from './helpers/dragLogicFlow';

test.describe('Logic Flow UI Adjust', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean');
  });

  test.describe('Tier 列宽度比例', () => {
    test('1.1 候选区 tier 列宽度比例测试', async ({ page }) => {
      const wareGrid = page.locator('.candidate-zone .ware-grid').first();
      await expect(wareGrid).toBeVisible();

      const columns = await wareGrid.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').map(Number.parseFloat)
      );
      expect(columns).toHaveLength(4);
      expect(columns[1] / columns[0]).toBeCloseTo(1.5, 3);
      expect(columns[2] / columns[0]).toBeCloseTo(1.5, 3);
      expect(columns[3] / columns[0]).toBeCloseTo(2, 3);
    });

    test('1.2 ProductionLineGroup tier 列宽度比例测试', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');

      const productionGroup = page.locator('.production-group').first();
      await expect(productionGroup).toBeVisible({ timeout: 5000 });

      const gridElement = productionGroup.locator('.grid').first();
      await expect(gridElement).toBeVisible({ timeout: 5000 });

      const gridClass = await gridElement.getAttribute('class');
      expect(gridClass).toContain('grid-cols-[2fr_3fr_3fr_4fr]');
    });

    test('1.3 紧凑区等宽布局测试', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts', 'new', { drop: false });
      const compactView = page.getByTestId('compact-view');
      await expect(compactView).toHaveClass(/grid-cols-4/);
      const compactGroup = compactView.locator('.compact-group').last();
      await expect(compactGroup).toHaveClass(/border-blue-500\/50/);

      await page.mouse.up();
    });
  });

  test.describe('间距调整', () => {
    test('2.1 候选区间距测试', async ({ page }) => {
      const wareGrid = page.locator('.candidate-zone .ware-grid').first();
      await expect(wareGrid).toBeVisible();

      const gridStyle = await wareGrid.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          gap: style.columnGap,
        };
      });
      
      expect(gridStyle.paddingLeft).toBe('16px');
      expect(gridStyle.paddingRight).toBe('32px');
      expect(gridStyle.gap).toBe('48px');
      await expect(page.locator('.candidate-zone .draggable-area').first()).toHaveCSS('margin-bottom', '6px');
    });

    test('2.2 规划区间距测试', async ({ page }) => {
      await dragWareToTarget(page, 'hullparts');

      const planningZone = page.locator('.planning-zone');
      await expect(planningZone).toBeVisible({ timeout: 5000 });
      await expect(planningZone).toHaveCSS('padding-left', '16px');
      await expect(planningZone).toHaveCSS('padding-right', '32px');
      await expect(planningZone).toHaveCSS('padding-top', '0px');
      await expect(planningZone).toHaveCSS('padding-bottom', '32px');
      await expect(page.locator('.production-group').first()).toHaveCSS('padding', '0px');
    });
  });

  test.describe('Ware Card 压缩率显示', () => {
    test('3.1 非 T0 ware-card 显示压缩率测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const compressionRate = t1PlusCard.locator('.compression-rate-container');
      await expect(compressionRate).toBeVisible();
      await expect(compressionRate.locator('.compression-rate-text')).toHaveText(/^\d+%\s*$/);
      await expect(compressionRate.locator('svg')).toHaveCount(1);
      const resourcePreview = t1PlusCard.locator('.resource-preview-container');
      const resourceBox = await resourcePreview.boundingBox();
      const compressionBox = await compressionRate.boundingBox();
      if (!resourceBox || !compressionBox) throw new Error('Compression/resource bounds unavailable');
      expect(compressionBox.x).toBeGreaterThanOrEqual(resourceBox.x + resourceBox.width);
    });

    test('3.2 压缩率颜色编码测试', async ({ page }) => {
      await expect(page.locator('.ware-card-wrapper[data-ware-id="refinedmetals"] .compression-rate-text'))
        .toHaveClass(/text-emerald-400/);
      await expect(page.locator('.ware-card-wrapper[data-ware-id="advancedelectronics"] .compression-rate-text'))
        .toHaveClass(/text-red-400/);
    });

    test('3.3 T0 ware-card 不显示压缩率测试', async ({ page }) => {
      const t0Card = page.locator('.ware-card-wrapper[data-tier="0"]').first();
      await expect(t0Card).toBeVisible({ timeout: 5000 });

      const compressionRate = t0Card.locator('.compression-rate-container');
      await expect(compressionRate).toHaveCount(0);
    });
  });

  test.describe('Ware Card Hover 展开', () => {
    test('4.1 非 T0 ware-card hover 显示+按钮测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const background = t1PlusCard.locator('.ware-card-bg').first();
      const before = await background.boundingBox();
      if (!before) throw new Error('Card background bounds unavailable');
      await t1PlusCard.hover();
      const quickAddBtn = t1PlusCard.locator('.ware-card-add-btn');
      await expect(quickAddBtn).toBeVisible();
      await expect.poll(async () => {
        const box = await background.boundingBox();
        return box ? box.width - before.width : Number.NaN;
      }).toBeCloseTo(32, 1);
      const after = await background.boundingBox();
      const button = await quickAddBtn.boundingBox();
      if (!after || !button) throw new Error('Expanded card bounds unavailable');
      expect(after.width - before.width).toBe(32);
      expect(button.x).toBeGreaterThanOrEqual(before.x + before.width);
      expect(button.x + button.width).toBeLessThanOrEqual(after.x + after.width);
      await expect(background).toHaveCSS('transition-duration', '0.3s');
    });

    test('4.2 Hover 时其他元素位置不变测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const wareName = t1PlusCard.locator('.ware-name');
      const nameBoxBefore = await wareName.boundingBox();
      const compressionBoxBefore = await t1PlusCard.locator('.compression-rate-container').boundingBox();
      const adjacent = t1PlusCard.locator('xpath=following-sibling::div[contains(@class, "ware-card-wrapper")][1]');
      await expect(adjacent).toHaveCount(1);
      const adjacentBoxBefore = await adjacent.boundingBox();
      if (!nameBoxBefore || !compressionBoxBefore || !adjacentBoxBefore) throw new Error('Pre-hover bounds unavailable');

      await t1PlusCard.hover();
      await expect(t1PlusCard.locator('.ware-card-add-btn')).toBeVisible();

      const nameBoxAfter = await wareName.boundingBox();
      const compressionBoxAfter = await t1PlusCard.locator('.compression-rate-container').boundingBox();
      const adjacentBoxAfter = await adjacent.boundingBox();
      if (!nameBoxAfter || !compressionBoxAfter || !adjacentBoxAfter) throw new Error('Post-hover bounds unavailable');
      expect(nameBoxAfter.x).toBe(nameBoxBefore.x);
      expect(nameBoxAfter.y).toBe(nameBoxBefore.y);
      expect(compressionBoxAfter.x).toBe(compressionBoxBefore.x);
      expect(compressionBoxAfter.y).toBe(compressionBoxBefore.y);
      expect(adjacentBoxAfter.x).toBe(adjacentBoxBefore.x);
      expect(adjacentBoxAfter.y).toBe(adjacentBoxBefore.y);
    });

    test('4.3 T0 ware-card hover 不显示+按钮测试', async ({ page }) => {
      const t0Card = page.locator('.ware-card-wrapper[data-tier="0"]').first();
      await expect(t0Card).toBeVisible({ timeout: 5000 });

      const background = t0Card.locator('.ware-card-bg').first();
      const before = await background.boundingBox();
      if (!before) throw new Error('T0 background bounds unavailable');
      await t0Card.hover();

      const quickAddBtn = t0Card.locator('.ware-card-add-btn');
      await expect(quickAddBtn).toHaveCount(0);
      const after = await background.boundingBox();
      if (!after) throw new Error('T0 post-hover bounds unavailable');
      expect(after.width).toBe(before.width);
    });
  });

  test.describe('T0 标签 Hover 消失', () => {
    test('5.1 T0 标签 hover 时消失测试', async ({ page }) => {
      const cardWithResource = page.locator('.ware-card-wrapper[data-ware-id="refinedmetals"]');
      await expect(cardWithResource).toHaveCount(1);

      const resourcePreview = cardWithResource.locator('.resource-preview-container');
      await expect(resourcePreview).toBeVisible();
      await expect(cardWithResource.locator('.resource-tag:visible').first()).toBeVisible();
      const name = cardWithResource.locator('.ware-name');
      await expect(name).toHaveText('精炼金属');

      await cardWithResource.hover();

      await expect(resourcePreview).toHaveCSS('opacity', '0');
      const nameSize = await name.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(nameSize.scrollWidth).toBeLessThanOrEqual(nameSize.clientWidth);
    });

    test('5.2 压缩率 hover 时保持显示测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const compressionRate = t1PlusCard.locator('.compression-rate-container');
      await t1PlusCard.hover();
      await expect(compressionRate).toBeVisible();
      await expect(compressionRate).toHaveCSS('opacity', '1');
    });
  });

  test.describe('新建规划区预览', () => {
    test('6.1 新建规划区预览位置测试', async ({ page }) => {
      for (const wareId of ['antimattercells', 'hullparts', 'advancedelectronics']) {
        await dragWareToTarget(page, wareId, 'new', { drop: false });
        const newZone = page.getByTestId('compact-view').locator('.compact-group').last();
        await expect(newZone).toHaveClass(/border-blue-500\/50/);
        const grid = newZone.locator('.compact-node-grid');
        const gridBox = await grid.boundingBox();
        const previewBox = await newZone.locator('.compact-node').first().boundingBox();
        if (!gridBox || !previewBox) throw new Error(`Preview for ${wareId} not found`);
        expect(previewBox.x).toBeGreaterThanOrEqual(gridBox.x - 8);
        expect(previewBox.x).toBeLessThan(gridBox.x + gridBox.width / 4);
        await page.mouse.up();
        await expect(page.getByTestId('compact-view')).toBeHidden();
      }
    });
  });
});
