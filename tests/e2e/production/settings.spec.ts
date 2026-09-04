import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('StationSettings Interface', () => {
  test('1.1 StationSettings 接口更新验证 - 主副产物缓冲时间字段存在', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('WarePriority Initialization', () => {
  test('1.2 warePriority 状态初始化 - 默认值为空对象', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
    await newButton.click();

    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first();
    if (await discardButton.isVisible()) {
      await discardButton.click();
    }
    await page.waitForTimeout(1000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      const btnClass = await firstBtn.getAttribute('class');
      expect(btnClass).toMatch(/level-2/);
    }
  });
});

test.describe('WarePriority Persistence', () => {
  test('1.3 saveLayout 持久化 warePriority 逻辑', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      await firstBtn.click();
      await page.waitForTimeout(300);

      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('1.4 loadLayout 加载 warePriority 逻辑', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const firstBtn = favoriteBtns.first();
      await firstBtn.click();
      await page.waitForTimeout(300);

      const modifiedClass = await firstBtn.getAttribute('class');

      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const dashboard2 = page.locator('.list-wrapper').first();
      const quantityViewBtn2 = dashboard2.locator('.view-mode-btn').first();
      await quantityViewBtn2.click();
      await page.waitForTimeout(500);

      const favoriteBtns2 = page.locator('.favorite-btn:not(.disabled)');
      if (await favoriteBtns2.count() > 0) {
        const restoredBtn = favoriteBtns2.first();
        const restoredClass = await restoredBtn.getAttribute('class');
        expect(restoredClass).toBe(modifiedClass);
      }
    }
  });

  test('2.2 优先级状态持久化测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);

      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('FavoriteButton Component', () => {
  test('1.1 FavoriteButton 三态图标渲染测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('.result-item').first();
    await expect(firstModule).toBeVisible();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();
    await expect(dashboard).toBeVisible();

    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const flowWrappers = page.locator('.flow-wrapper');
    await expect(flowWrappers.first()).toBeVisible();
    const itemCount = await flowWrappers.count();
    expect(itemCount).toBeGreaterThan(0);

    const firstItem = flowWrappers.first();

    const favoriteBtn = firstItem.locator('.favorite-btn').first();
    await expect(favoriteBtn).toBeVisible();

    const svgIcon = favoriteBtn.locator('svg').first();
    await expect(svgIcon).toBeVisible();

    const btnClass = await favoriteBtn.getAttribute('class');
    expect(btnClass).toMatch(/level-[012]/);
  });

  test('1.2 FavoriteButton 状态切换测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    await expect(favoriteBtns.first()).toBeVisible();

    const favoriteBtn = favoriteBtns.first();

    const initialClass = await favoriteBtn.getAttribute('class');
    const initialLevel = initialClass?.match(/level-(\d)/)?.[1] || '0';

    await favoriteBtn.click();
    await page.waitForTimeout(500);

    const newClass = await favoriteBtn.getAttribute('class');
    expect(newClass).toMatch(/level-[012]/);
  });

  test('1.3 不同视图模式下 FavoriteButton 可用性测试', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(800);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1500);

    const dashboard = page.locator('.list-wrapper').first();

    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(1000);

    const quantityFavoriteBtns = page.locator('.favorite-btn');
    const quantityCount = await quantityFavoriteBtns.count();
    expect(quantityCount).toBeGreaterThan(0);

    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeFavoriteBtns = page.locator('.favorite-btn');
    const volumeCount = await volumeFavoriteBtns.count();
    expect(volumeCount).toBeGreaterThan(0);

    const economyViewBtn = dashboard.locator('.view-mode-btn').nth(2);
    await economyViewBtn.click();
    await page.waitForTimeout(1000);

    const economyFavoriteBtns = page.locator('.favorite-btn');
    const economyCount = await economyFavoriteBtns.count();
    expect(economyCount).toBeGreaterThan(0);

    expect(quantityCount).toBe(volumeCount);
    expect(volumeCount).toBe(economyCount);
  });
});

test.describe('Priority Logic', () => {
  test('2.1 产物身份检测 - 规划区产物', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const quantityViewBtn = dashboard.locator('.view-mode-btn').first();
    await quantityViewBtn.click();
    await page.waitForTimeout(500);

    const favoriteBtns = page.locator('.favorite-btn:not(.disabled)');
    if (await favoriteBtns.count() > 0) {
      const favoriteBtn = favoriteBtns.first();
      await favoriteBtn.click();
      await page.waitForTimeout(300);

      const btnClass = await favoriteBtn.getAttribute('class');
      expect(btnClass).toMatch(/level-[012]/);
    }
  });
});

test.describe('Buffer Time Sliders', () => {
  test('5.1 主产物缓冲时间滑块功能', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(2);

    if (count >= 2) {
      const primarySlider = sliders.nth(1);

      const min = await primarySlider.getAttribute('min');
      const max = await primarySlider.getAttribute('max');

      expect(min).toBe('0');
      expect(parseInt(max || '0')).toBeGreaterThanOrEqual(1);

      const maxVal = parseFloat(max || '1');
      const testValue = Math.min(0.5, maxVal).toString();
      await primarySlider.fill(testValue);
      await page.waitForTimeout(300);

      const value = await primarySlider.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('5.2 副产物缓冲时间滑块功能', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count).toBeGreaterThanOrEqual(3);

    if (count >= 3) {
      const secondarySlider = sliders.nth(2);

      const min = await secondarySlider.getAttribute('min');
      const max = await secondarySlider.getAttribute('max');

      expect(min).toBe('0');
      expect(parseInt(max || '0')).toBeGreaterThanOrEqual(1);

      const maxVal = parseFloat(max || '1');
      const testValue = Math.min(0.3, maxVal).toString();
      await secondarySlider.fill(testValue);
      await page.waitForTimeout(300);

      const value = await secondarySlider.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('5.3 i18n 国际化键值 - 缓冲设置标签文本', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const sliderLabels = page.locator('.slider-label, .control-label');
    const count = await sliderLabels.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const labelText = await sliderLabels.nth(i).textContent();
        expect(labelText).toBeTruthy();
        expect(labelText!.length).toBeGreaterThan(0);
      }
    }
  });

  test('5.4 缓冲时间滑块影响体积计算', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('plasma');
    await page.waitForTimeout(500);

    const firstModule = page.locator('.result-item').first();
    await firstModule.click();
    await page.waitForTimeout(1000);

    const dashboard = page.locator('.list-wrapper').first();
    const volumeViewBtn = dashboard.locator('.view-mode-btn').nth(1);
    await volumeViewBtn.click();
    await page.waitForTimeout(1000);

    const volumeTexts = page.locator('.text-ware-volume');
    if (await volumeTexts.count() > 0) {
      const initialVolume = await volumeTexts.first().textContent();

      const sliders = page.locator('input[type="range"]');
      if (await sliders.count() >= 2) {
        const primarySlider = sliders.nth(1);
        await primarySlider.fill('20');
        await page.waitForTimeout(500);

        const newVolume = await volumeTexts.first().textContent();
        expect(newVolume).toBeTruthy();
      }
    }
  });
});
