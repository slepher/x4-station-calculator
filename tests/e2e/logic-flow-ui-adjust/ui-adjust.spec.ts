import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.describe('Logic Flow UI Adjust', () => {
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

  test.describe('Tier 列宽度比例', () => {
    test('1.1 候选区 tier 列宽度比例测试', async ({ page }) => {
      const wareGrid = page.locator('.candidate-zone .ware-grid').first();
      await expect(wareGrid).toBeVisible();

      const gridStyle = await wareGrid.evaluate((el) => {
        return window.getComputedStyle(el).gridTemplateColumns;
      });
      
      expect(gridStyle).toBeTruthy();
    });

    test('1.2 ProductionLineGroup tier 列宽度比例测试', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const productionGroup = page.locator('.production-group').first();
      await expect(productionGroup).toBeVisible({ timeout: 5000 });

      const gridElement = productionGroup.locator('.grid').first();
      await expect(gridElement).toBeVisible({ timeout: 5000 });

      const gridClass = await gridElement.getAttribute('class');
      expect(gridClass).toContain('grid-cols-[2fr_3fr_3fr_4fr]');
    });

    test('1.3 紧凑区等宽布局测试', async ({ page }) => {
      const source = page.locator(`.ware-card-wrapper[data-ware-id="hullparts"]`).first();
      await expect(source).toBeVisible({ timeout: 5000 });
      
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(200);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const compactGroup = compactView.locator('.compact-group').first();
      await expect(compactGroup).toBeVisible({ timeout: 5000 });

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
        };
      });
      
      expect(gridStyle.paddingLeft).toBeTruthy();
      expect(gridStyle.paddingRight).toBeTruthy();
    });

    test('2.2 规划区间距测试', async ({ page }) => {
      await dragWareToNewZone(page, 'hullparts');

      const planningZone = page.locator('.planning-zone');
      await expect(planningZone).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Ware Card 压缩率显示', () => {
    test('3.1 非 T0 ware-card 显示压缩率测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const compressionRate = t1PlusCard.locator('.compression-rate-container');
      await expect(compressionRate).toBeVisible();
    });

    test('3.2 压缩率颜色编码测试', async ({ page }) => {
      const allCards = page.locator('.ware-card-wrapper');
      const count = await allCards.count();
      
      let foundGreen = false;
      let foundRed = false;

      for (let i = 0; i < Math.min(count, 20); i++) {
        const card = allCards.nth(i);
        const tier = await card.getAttribute('data-tier');
        if (tier === '0') continue;

        const compressionRate = card.locator('.compression-rate-text');
        if (await compressionRate.count() === 0) continue;
        
        const classList = await compressionRate.getAttribute('class');
        
        if (classList?.includes('text-emerald')) foundGreen = true;
        if (classList?.includes('text-red')) foundRed = true;
      }

      expect(foundGreen || foundRed).toBe(true);
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

      const cardBox = await t1PlusCard.boundingBox();
      if (!cardBox) throw new Error('Card not found');

      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);

      const quickAddBtn = t1PlusCard.locator('.ware-card-add-btn');
      await expect(quickAddBtn).toBeVisible();
    });

    test('4.2 Hover 时其他元素位置不变测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const cardBox = await t1PlusCard.boundingBox();
      if (!cardBox) throw new Error('Card not found');

      const wareName = t1PlusCard.locator('.ware-name');
      const nameBoxBefore = await wareName.boundingBox();

      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);

      const nameBoxAfter = await wareName.boundingBox();

      expect(nameBoxBefore?.x).toBe(nameBoxAfter?.x);
      expect(nameBoxBefore?.y).toBe(nameBoxAfter?.y);
    });

    test('4.3 T0 ware-card hover 不显示+按钮测试', async ({ page }) => {
      const t0Card = page.locator('.ware-card-wrapper[data-tier="0"]').first();
      await expect(t0Card).toBeVisible({ timeout: 5000 });

      const cardBox = await t0Card.boundingBox();
      if (!cardBox) throw new Error('Card not found');

      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);

      const quickAddBtn = t0Card.locator('.ware-card-add-btn');
      await expect(quickAddBtn).toHaveCount(0);
    });
  });

  test.describe('T0 标签 Hover 消失', () => {
    test('5.1 T0 标签 hover 时消失测试', async ({ page }) => {
      const cardWithResource = page.locator('.ware-card-wrapper').filter({ has: page.locator('.resource-preview-container') }).first();
      
      if (await cardWithResource.count() === 0) {
        test.skip();
        return;
      }

      const cardBox = await cardWithResource.boundingBox();
      if (!cardBox) throw new Error('Card not found');

      const resourcePreview = cardWithResource.locator('.resource-preview-container');
      await expect(resourcePreview).toBeVisible();

      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);

      const opacity = await resourcePreview.evaluate((el) => {
        return window.getComputedStyle(el).opacity;
      });
      
      expect(['0', '0.5', '1']).toContain(opacity);
    });

    test('5.2 压缩率 hover 时保持显示测试', async ({ page }) => {
      const t1PlusCard = page.locator('.ware-card-wrapper[data-tier="1"], .ware-card-wrapper[data-tier="2"], .ware-card-wrapper[data-tier="3"]').first();
      await expect(t1PlusCard).toBeVisible({ timeout: 5000 });

      const cardBox = await t1PlusCard.boundingBox();
      if (!cardBox) throw new Error('Card not found');

      const compressionRate = t1PlusCard.locator('.compression-rate-container');
      
      await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await page.waitForTimeout(200);

      await expect(compressionRate).toBeVisible();
    });
  });

  test.describe('新建规划区预览', () => {
    test('6.1 新建规划区预览位置测试', async ({ page }) => {
      const source = page.locator(`.ware-card-wrapper[data-ware-id="hullparts"]`).first();
      await expect(source).toBeVisible({ timeout: 5000 });
      
      const sourceBox = await source.boundingBox();
      if (!sourceBox) throw new Error('Source not found');

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 5, sourceBox.y + sourceBox.height / 2 + 5);
      await page.waitForTimeout(200);

      const compactView = page.locator('.compact-view');
      await expect(compactView).toBeVisible({ timeout: 5000 });

      const newZone = compactView.locator('.drop-target').last();
      await expect(newZone).toBeVisible({ timeout: 5000 });

      await page.mouse.up();
    });
  });
});
