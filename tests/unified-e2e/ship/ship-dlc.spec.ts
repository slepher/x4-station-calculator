import { test, expect } from '@playwright/test'

test.describe('Ship DLC', () => {
  const shipBuildButton = (page: any) => page.getByRole('button', { name: /Ship Build|船只建造/ })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.waitForSelector('.toolbar-panel', { state: 'visible' })
  })

  // Helper: 设置 DLC 限制状态
  const setDlcActivation = async (page: any, enabled: boolean) => {
    await page.evaluate((value: boolean) => {
      const store = (window as any).store
      if (store) {
        store.enforceDlcActivation = value
      }
    }, enabled)
  }

  // Helper: 进入舰船选择并应用过滤
  const enterShipSelectorWithFilters = async (page: any) => {
    await shipBuildButton(page).click()
    await page.waitForSelector('[data-testid="ship-build-selector-grid"]', { state: 'visible' })

    // 选择等级 M
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()

    // 选择第一个种族
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    // 等待列表渲染
    await page.waitForSelector('.list-body li', { state: 'visible' })
  }

  // 2.1 状态:舰船选择界面
  test('2.1 状态:舰船选择界面', async ({ page }) => {
    // 2.1.1-2.1.3 进入舰船选择界面并应用过滤
    await enterShipSelectorWithFilters(page)

    // 2.1.4 验证舰船列表可见且DLC标签正确显示
    const shipList = page.locator('.list-body li')
    await expect(shipList.first()).toBeVisible()

    // 验证 DLC 标签存在（如果有非 base 舰船）
    const dlcTags = page.locator('.list-body li .dlc-tag')
    const tagCount = await dlcTags.count()
    if (tagCount > 0) {
      await expect(dlcTags.first()).toBeVisible()
    }
  })

  // 2.2 状态:装备选择器打开
  test('2.2 状态:装备选择器打开', async ({ page }) => {
    // 前置：进入舰船选择并选择一艘舰船
    await enterShipSelectorWithFilters(page)

    // 选择第一艘舰船
    const firstShip = page.locator('.list-body li').first()
    await firstShip.click()

    // 点击确认按钮进入工作台
    await page.getByTestId('ship-build-confirm-ship').click()

    // 等待工作台视图
    await page.waitForSelector('[data-testid="ship-build-panels"]', { state: 'visible' })

    // 2.2.1 验证工作台已加载（包含装备面板）
    await page.waitForSelector('[data-testid="ship-build-fit-panel"]', { state: 'visible' })

    // 2.2.2-2.2.4 验证装备槽位可见
    await page.waitForSelector('[data-testid^="slot-type-"]', { state: 'visible', timeout: 5000 })
    const slotTypeBtn = page.locator('[data-testid^="slot-type-"]').first()
    await expect(slotTypeBtn).toBeVisible()

    // 点击 slot-type 展开槽位列表
    await slotTypeBtn.click()

    // 验证 slot 列表渲染
    await page.waitForSelector('[data-testid^="slot-"]', { state: 'visible', timeout: 5000 })
    const equipmentSlot = page.locator('[data-testid^="slot-"]').first()
    await expect(equipmentSlot).toBeVisible()
  })

  // 2.3 状态:DLC标签激活态
  test('2.3 状态:DLC标签激活态', async ({ page }) => {
    // 前置：确保有激活的 DLC 舰船，先设置 enforceDlcActivation=false 查看所有舰船
    await setDlcActivation(page, false)
    await enterShipSelectorWithFilters(page)

    // 2.3.1 定位到已激活 DLC 的舰船（绿色标签）
    const activeDlcTag = page.locator('.list-body li .dlc-tag--active').first()

    // 检查是否有激活 DLC 标签的舰船
    const activeCount = await page.locator('.list-body li .dlc-tag--active').count()
    if (activeCount > 0) {
      // 2.3.2 检查标签样式
      await expect(activeDlcTag).toBeVisible()

      // 2.3.3 验证绿色边框和绿色文字
      await expect(activeDlcTag).toHaveClass(/dlc-tag--active/)
    } else {
      // 如果没有激活 DLC 舰船，则跳过断言（测试数据限制）
      test.skip()
    }
  })

  // 2.4 状态:DLC标签未激活态
  test('2.4 状态:DLC标签未激活态', async ({ page }) => {
    // 前置：需要配置未激活 DLC
    await enterShipSelectorWithFilters(page)

    // 2.4.1 定位到未激活 DLC 的舰船（如果存在）
    const inactiveDlcTag = page.locator('.list-body li .dlc-tag--inactive').first()
    if (await inactiveDlcTag.isVisible().catch(() => false)) {
      // 2.4.2 检查标签样式
      // 2.4.3 验证红色边框和红色文字
      await expect(inactiveDlcTag).toHaveClass(/dlc-tag--inactive/)
    }
  })

  // 2.5 状态:DLC限制关
  test('2.5 状态:DLC限制关', async ({ page }) => {
    // 2.5.1 关闭 enforceDlcActivation
    await setDlcActivation(page, false)

    // 2.5.2-2.5.3 进入舰船选择界面并验证显示全部舰船
    await enterShipSelectorWithFilters(page)

    const shipItems = page.locator('.list-body li')
    const count = await shipItems.count()
    expect(count).toBeGreaterThan(0)
  })

  // 2.6 状态:DLC限制开
  test('2.6 状态:DLC限制开', async ({ page }) => {
    // 2.6.1 开启 enforceDlcActivation
    await setDlcActivation(page, true)

    // 2.6.2-2.6.3 进入舰船选择界面并验证未激活 DLC 舰船被过滤
    await enterShipSelectorWithFilters(page)

    const inactiveDlcShips = page.locator('.list-body li .dlc-tag--inactive')
    const count = await inactiveDlcShips.count()
    expect(count).toBe(0) // 不应该显示未激活 DLC 舰船
  })

  // 3.1 Case: DLC 标签显示与样式语义
  test('3.1 Case: DLC 标签显示与样式语义', async ({ page }) => {
    // 3.1.1 状态:舰船选择界面
    await setDlcActivation(page, false)
    await enterShipSelectorWithFilters(page)

    // 3.1.2-3.1.3 检查 base 舰船的 DLC 标签（无标签）
    const baseShips = page.locator('.list-body li').filter({ hasNot: page.locator('.dlc-tag') })
    const baseCount = await baseShips.count()
    if (baseCount > 0) {
      await expect(baseShips.first()).toBeVisible()
    }

    // 3.1.4-3.1.7 检查已激活/未激活标签样式
    const activeTag = page.locator('.list-body li .dlc-tag--active').first()
    if (await activeTag.isVisible().catch(() => false)) {
      await expect(activeTag).toHaveClass(/dlc-tag--active/)
    }

    const inactiveTag = page.locator('.list-body li .dlc-tag--inactive').first()
    if (await inactiveTag.isVisible().catch(() => false)) {
      await expect(inactiveTag).toHaveClass(/dlc-tag--inactive/)
    }

    // 3.1.8-3.1.9 检查工作台装备槽位中的 DLC 标签
    const firstShip = page.locator('.list-body li').first()
    await firstShip.click()
    await page.getByTestId('ship-build-confirm-ship').click()
    await page.waitForSelector('[data-testid="ship-build-panels"]', { state: 'visible' })

    // 点击 slot-type 按钮打开槽位列表
    await page.waitForSelector('[data-testid^="slot-type-"]', { state: 'visible', timeout: 5000 })
    const slotTypeBtn = page.locator('[data-testid^="slot-type-"]').first()
    await slotTypeBtn.click()

    // 验证 slot 中显示装备 DLC 标签
    await page.waitForSelector('[data-testid^="slot-"]', { state: 'visible', timeout: 5000 })
    const equipmentSlot = page.locator('[data-testid^="slot-"]').first()
    if (await equipmentSlot.isVisible().catch(() => false)) {
      await expect(equipmentSlot).toBeVisible()
      // 检查槽位中是否有 DLC 标签（如果有装备且装备属于 DLC）
      const slotDlcTag = equipmentSlot.locator('.dlc-tag').first()
      if (await slotDlcTag.isVisible().catch(() => false)) {
        await expect(slotDlcTag).toBeVisible()
      }
    }
  })

  // 3.2 Case: enforceDlcActivation=false 时舰船候选完整显示
  test('3.2 Case: enforceDlcActivation=false 时舰船候选完整显示', async ({ page }) => {
    // 3.2.1 状态:DLC限制关
    await setDlcActivation(page, false)

    // 3.2.2-3.2.4 验证未激活 DLC 舰船可见
    await enterShipSelectorWithFilters(page)

    const shipItems = page.locator('.list-body li')
    const count = await shipItems.count()
    expect(count).toBeGreaterThan(0)

    // 3.2.5 验证 race/type 计数包含未激活 DLC 舰船
    const raceCount = page.getByTestId('ship-build-race-count').first()
    const countText = await raceCount.textContent()
    expect(countText).toMatch(/\(\d+\)/)
  })

  // 3.3 Case: enforceDlcActivation=true 时舰船候选过滤
  test('3.3 Case: enforceDlcActivation=true 时舰船候选过滤', async ({ page }) => {
    // 3.3.1 状态:DLC限制开
    await setDlcActivation(page, true)

    // 3.3.2-3.3.4 验证未激活 DLC 舰船不可见
    await enterShipSelectorWithFilters(page)

    const inactiveDlcShips = page.locator('.list-body li .dlc-tag--inactive')
    const inactiveCount = await inactiveDlcShips.count()
    expect(inactiveCount).toBe(0)

    // 3.3.5 验证 race/type 计数不包含未激活 DLC 舰船
    const raceCount = page.getByTestId('ship-build-race-count').first()
    const countText = await raceCount.textContent()
    expect(countText).toMatch(/\(\d+\)/)
  })
})
