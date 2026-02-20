import { test } from '../../test-setup';
import { expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 });
});

const createNewEmpire = async (page: any) => {
  const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first();
  await newBtn.click();
  await page.waitForTimeout(100);
};

const addStation = async (page: any) => {
  const addStationBtn = page.locator('.station-tab-bar-container .add-btn').first();
  await addStationBtn.click();
  await page.waitForTimeout(150);
};

const selectStationByIndex = async (page: any, index: number) => {
  const stationTab = page.locator('.station-tab').nth(index);
  await stationTab.waitFor({ state: 'visible', timeout: 500 });
  await stationTab.click();
  await page.waitForTimeout(150);
};

const addModuleToStation = async (page: any, moduleName: string) => {
  const searchInput = page.locator('.search-box .search-input');
  await searchInput.click();
  await searchInput.fill(moduleName);
  await page.waitForTimeout(100);
  const resultItem = page.locator('.results-popover .result-item').first();
  await expect(resultItem).toBeVisible({ timeout: 500 });
  await resultItem.click();
};

const toggleByLabel = async (page: any, label: RegExp) => {
  if (label.source.includes('显示缺口') || label.source.includes('Show Gaps')) {
    const toggle = page.locator('[data-testid="toggle-show-empire-gaps"]');
    await toggle.waitFor({ state: 'visible', timeout: 500 });
    await toggle.click();
    return;
  }
  const group = page.locator('.input-group').filter({ hasText: label }).first();
  const toggle = group.locator('.toggle-chip');
  await toggle.click();
};

const lockWare = async (page: any, wareId: string) => {
  const flowRow = page.locator(`.flow-wrapper[data-resource-id="${wareId}"]`).first();
  await expect(flowRow).toBeVisible({ timeout: 500 });
  const lockBtn = flowRow.locator('.lock-btn');
  await lockBtn.click();
};

const setModuleCount = async (page: any, moduleName: RegExp, count: number) => {
  const row = page.locator('.module-row').filter({ hasText: moduleName }).first();
  await expect(row).toBeVisible({ timeout: 500 });
  const input = row.locator('.x4-num-input');
  await input.fill(String(count));
};

const togglePriority = async (page: any, wareId: string) => {
  const flowRow = page.locator(`.flow-wrapper[data-resource-id="${wareId}"]`).first();
  await flowRow.hover();
  const favBtn = flowRow.locator('.favorite-btn');
  await expect(favBtn).toBeVisible({ timeout: 500 });
  await favBtn.click();
};

const getViewSwitcher = (page: any, wrapper?: any) => {
  if (wrapper) {
    return wrapper.locator('.view-mode-switcher').first();
  }
  return page.locator('.view-mode-switcher').filter({ hasText: /经济|Economy/i }).first();
};
const getListWrapper = (page: any) => page.locator('.list-wrapper').filter({ has: getViewSwitcher(page) }).first();

const getOperationsGroup = (page: any) => page.locator('.empire-gap-group').filter({ hasText: /帝国运营|Empire Operations/i });
const getSupplyGroup = (page: any) => page.locator('.empire-gap-group').filter({ hasText: /帝国补给|Empire Supply/i });

const switchToResourceView = async (page: any, wrapper?: any) => {
  const btn = getViewSwitcher(page, wrapper).locator('.view-mode-btn').nth(0);
  await btn.click();
  await expect(btn).toHaveClass(/active/);
};

const switchToEconomyView = async (page: any, wrapper?: any) => {
  const btn = getViewSwitcher(page, wrapper).locator('.view-mode-btn').nth(1);
  await btn.click();
  await expect(btn).toHaveClass(/active/);
};

const switchToVolumeView = async (page: any, wrapper?: any) => {
  const btn = getViewSwitcher(page, wrapper).locator('.view-mode-btn').nth(2);
  await btn.click();
  await expect(btn).toHaveClass(/active/);
};

const setupStationAWithClay = async (page: any) => {
  await addStation(page);
  await selectStationByIndex(page, 0);
  await addModuleToStation(page, 'Clay');
  await toggleByLabel(page, /工人运算|Workforce/i);
  await lockWare(page, 'quantumtubes');
};

const setupStationAWithClayAndHullParts = async (page: any) => {
  await addStation(page);
  await selectStationByIndex(page, 0);
  await addModuleToStation(page, 'Clay');
  await addModuleToStation(page, 'Hull');
  await toggleByLabel(page, /工人运算|Workforce/i);
  await lockWare(page, 'quantumtubes');
};

const setupStationB = async (page: any) => {
  await addStation(page);
  await selectStationByIndex(page, 1);
};

const enableShowGaps = async (page: any) => {
  await toggleByLabel(page, /显示缺口|Show Gaps/i);
};

test.describe('帝国缺口显示', () => {
  test('帝国缺口明细显示数量x名称结构', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);
    await setupStationB(page);
    await enableShowGaps(page);
    await switchToResourceView(page);

    const opsGapGroup = getOperationsGroup(page);
    const flow = opsGapGroup.locator('.flow-wrapper[data-resource-id="quantumtubes"]').first();
    await expect(flow).toBeVisible({ timeout: 500 });
    await flow.locator('.main-row').click();

    await expect(flow.locator('.item-name .qty').first()).toBeVisible({ timeout: 500 });
    await expect(flow.locator('.item-name .symbol').first()).toContainText('x');
    await expect(flow.locator('.item-name .name').first()).toBeVisible({ timeout: 500 });
  });

  test('空间站帝国资源区域标题显示且不显示每小时流量标签', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);
    await setupStationB(page);
    await enableShowGaps(page);

    const wrapper = getListWrapper(page);
    await expect(wrapper.locator('.header-title')).toContainText(/资源视图|Resource View/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);

    await switchToEconomyView(page, wrapper);
    await expect(wrapper.locator('.header-title')).toContainText(/经济视图|Economy/);
    await expect(wrapper.locator('.header-badge')).toHaveCount(0);
  });

  test('显示缺口开关', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);

    const toggle = page.locator('[data-testid="toggle-show-empire-gaps"]');
    await expect(toggle).not.toHaveClass(/active-green/);
    await enableShowGaps(page);
    await expect(toggle).toHaveClass(/active-green/);

    await switchToResourceView(page);

    const opsGapGroup = getOperationsGroup(page);
    const supplyGapGroup = getSupplyGroup(page);
    await expect(opsGapGroup).toBeVisible({ timeout: 500 });
    await expect(supplyGapGroup).toBeVisible({ timeout: 500 });
    await expect(opsGapGroup.locator('.flow-wrapper[data-resource-id="quantumtubes"]')).toBeVisible({ timeout: 500 });
    await expect(supplyGapGroup.locator('.flow-wrapper[data-resource-id="foodrations"]')).toBeVisible({ timeout: 500 });
    await expect(supplyGapGroup.locator('.flow-wrapper[data-resource-id="medicalsupplies"]')).toBeVisible({ timeout: 500 });
  });

  test('缺口分组仅在资源视图显示', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);

    const wrapper = getListWrapper(page);
    await expect(wrapper.locator('.empire-gap-group').first()).toBeVisible({ timeout: 500 });

    await switchToVolumeView(page, wrapper);
    await expect(wrapper.locator('.empire-gap-group')).toHaveCount(0);

    await switchToResourceView(page, wrapper);
    await expect(wrapper.locator('.empire-gap-group').first()).toBeVisible({ timeout: 500 });

    await switchToEconomyView(page, wrapper);
    await expect(wrapper.locator('.empire-gap-group')).toHaveCount(0);
  });

  test('点击 + 按钮添加模块', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);

    const opsGapGroup = getOperationsGroup(page);
    await expect(opsGapGroup).toBeVisible({ timeout: 500 });

    const gapRow = opsGapGroup.locator('.flow-wrapper[data-resource-id="quantumtubes"]');
    const addBtn = gapRow.locator('.add-btn');
    await addBtn.click();

    const plannedModule = page.locator('.module-row .module-name').filter({ hasText: /Quantum|量子管/i }).first();
    await expect(plannedModule).toBeVisible({ timeout: 500 });

    await setModuleCount(page, /Quantum|量子管/i, 100);
    await expect(gapRow).toBeVisible({ timeout: 500 });
  });

  test('缺口分组显示顺序', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);
    await addModuleToStation(page, 'Clay');
    await toggleByLabel(page, /工人运算|Workforce/i);
    await lockWare(page, 'microchips');

    await switchToResourceView(page);

    const groupTitles = await page.locator('.list-body .group-title').allTextContents();

    const findIndex = (pattern: RegExp, excludeEmpire = false) => groupTitles.findIndex((title) => {
      if (!pattern.test(title)) {
        return false;
      }
      if (!excludeEmpire) {
        return true;
      }
      return !/帝国|Empire/i.test(title);
    });

    const opsIndex = findIndex(/帝国运营|Empire Operations/i);
    const supplyIndex = findIndex(/帝国补给|Empire Supply/i);
    const productsIndex = findIndex(/产品|Products/i, true);
    const operationsIndex = findIndex(/运营|Operations/i, true);
    const supplyGroupIndex = findIndex(/补给|Supply/i, true);
    const resourcesIndex = findIndex(/资源|Resources/i, true);

    expect(opsIndex).toBeGreaterThanOrEqual(0);
    expect(supplyIndex).toBeGreaterThanOrEqual(0);
    expect(productsIndex).toBeGreaterThanOrEqual(0);
    expect(operationsIndex).toBeGreaterThanOrEqual(0);
    expect(supplyGroupIndex).toBeGreaterThanOrEqual(0);
    expect(resourcesIndex).toBeGreaterThanOrEqual(0);
    expect(opsIndex).toBeLessThan(supplyIndex);
    if (productsIndex >= 0) {
      expect(supplyIndex).toBeLessThan(productsIndex);
    }
    if (operationsIndex >= 0 && productsIndex >= 0) {
      expect(productsIndex).toBeLessThan(operationsIndex);
    }
    if (supplyGroupIndex >= 0 && operationsIndex >= 0) {
      expect(operationsIndex).toBeLessThan(supplyGroupIndex);
    }
    if (resourcesIndex >= 0 && supplyGroupIndex >= 0) {
      expect(supplyGroupIndex).toBeLessThan(resourcesIndex);
    }
  });

  test('无缺口时不显示缺口分组', async ({ page }) => {
    await createNewEmpire(page);

    await addStation(page);
    await selectStationByIndex(page, 0);

    await setupStationB(page);
    await enableShowGaps(page);
    await switchToResourceView(page);

    await expect(page.locator('.empire-gap-group')).toHaveCount(0);
  });

  test('关闭工人运算后补给缺口消失', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);
    await switchToResourceView(page);

    const supplyGapGroup = getSupplyGroup(page);
    await expect(supplyGapGroup).toBeVisible({ timeout: 500 });

    await selectStationByIndex(page, 0);
    await toggleByLabel(page, /工人运算|Workforce/i);

    await selectStationByIndex(page, 1);
    await switchToResourceView(page);
    await expect(supplyGapGroup).not.toBeVisible();

    const opsGapGroup = getOperationsGroup(page);
    await expect(opsGapGroup).toBeVisible({ timeout: 500 });
  });

  test('帝国运营优先级过滤', async ({ page }) => {
    await createNewEmpire(page);

    await addStation(page);
    await selectStationByIndex(page, 0);
    await addStation(page);
    await selectStationByIndex(page, 1);
    await addModuleToStation(page, 'Energy Cell');
    await switchToResourceView(page);
    await togglePriority(page, 'energycells');
    await enableShowGaps(page);

    const opsGapGroup = getOperationsGroup(page);
    await expect(opsGapGroup).toBeVisible({ timeout: 500 });
    await expect(opsGapGroup.locator('.flow-wrapper[data-resource-id="energycells"]')).toBeVisible({ timeout: 500 });
  });

  test('帝国补给显示负净值和零净值项', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);
    await switchToResourceView(page);

    const supplyGroup = getSupplyGroup(page);
    await expect(supplyGroup).toBeVisible({ timeout: 500 });

    await expect(supplyGroup.locator('.flow-wrapper[data-resource-id="foodrations"]')).toBeVisible({ timeout: 500 });
    await expect(supplyGroup.locator('.flow-wrapper[data-resource-id="medicalsupplies"]')).toBeVisible({ timeout: 500 });
  });

  test('帝国运营排序', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClayAndHullParts(page);

    await setupStationB(page);
    await addModuleToStation(page, 'Hull');
    await enableShowGaps(page);

    const opsGroup = getOperationsGroup(page);
    const quantumRow = opsGroup.locator('.flow-wrapper[data-resource-id="quantumtubes"]');
    await quantumRow.locator('.add-btn').click();

    const ids = await opsGroup.locator('.flow-wrapper').evaluateAll(nodes =>
      nodes.map(node => node.getAttribute('data-resource-id') || '')
    );
    const names = await opsGroup.locator('.flow-wrapper .header-name').allTextContents();

    const tierMap: Record<string, number> = {
      hullparts: 3,
      quantumtubes: 2,
      microchips: 2,
      clay: 1
    };

    const items = ids.map((id, index) => ({
      id,
      name: (names[index] || id).trim(),
      tier: tierMap[id]
    })).filter(item => item.tier !== undefined);

    expect(items.length).toBeGreaterThan(1);

    const sorted = [...items].sort((a, b) => {
      const tierDiff = b.tier - a.tier;
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });

    expect(items.map(item => item.id)).toEqual(sorted.map(item => item.id));
  });

  test('帝国补给转正后在规划内仍显示', async ({ page }) => {
    await createNewEmpire(page);
    await setupStationAWithClay(page);

    await setupStationB(page);
    await enableShowGaps(page);
    await switchToResourceView(page);

    const supplyGroup = getSupplyGroup(page);
    const supplyRow = supplyGroup.locator('.flow-wrapper[data-resource-id="foodrations"]');
    await supplyRow.locator('.add-btn').click();
    await setModuleCount(page, /Food Ration|食物配给/i, 100);

    await expect(supplyGroup.locator('.flow-wrapper[data-resource-id="foodrations"]')).toBeVisible({ timeout: 500 });
  });
});
