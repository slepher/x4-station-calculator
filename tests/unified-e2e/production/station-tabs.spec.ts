import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('多空间站帝国规划 - 标签栏交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ 
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('标签切换测试', async ({ page }) => {
    const overviewTab = page.locator('.overview-tab')
    await expect(overviewTab).toBeVisible()
    
    await overviewTab.click()
    await expect(page.locator('.empire-overview')).toBeVisible()
    
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const stationTab = page.locator('.station-tab').first()
    await expect(stationTab).toBeVisible()
    
    await stationTab.click()
    await expect(page.locator('.main-layout')).toBeVisible()
  })

  test('新建分站测试', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    const initialCount = await page.locator('.station-tab').count()
    
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const newCount = await page.locator('.station-tab').count()
    expect(newCount).toBe(initialCount + 1)
    
    const newTab = page.locator('.station-tab').last()
    await expect(newTab).toHaveClass(/active/)
    
    await expect(page.locator('.main-layout')).toBeVisible()
  })

  test('分站菜单测试', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const stationTab = page.locator('.station-tab').first()
    await stationTab.click({ button: 'right' })
    
    await expect(page.locator('.context-menu')).toBeVisible()
    
    const deleteOption = page.locator('.context-menu .menu-item.danger')
    await expect(deleteOption).toBeVisible()
    
    await deleteOption.click()
    await expect(page.locator('.modal-backdrop')).toBeVisible()
  })
})

test.describe('多空间站帝国规划 - 动态工具栏', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ 
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('工具栏内容切换测试', async ({ page }) => {
    const overviewTab = page.locator('.overview-tab')
    await overviewTab.click()
    await expect(page.locator('.context-toolbar')).toBeVisible()
    await expect(page.locator('.ghost-input.w-64')).toBeVisible()
    
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    
    await expect(page.locator('.context-toolbar')).toBeVisible()
    await expect(page.locator('.toolbar-section')).toHaveCount(3)
  })

  test('工人运算开关测试', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const workforceBtn = page.locator('.toggle-chip').filter({ hasText: /👥|ON|OFF/ }).first()
    await expect(workforceBtn).toBeVisible()
    
    await workforceBtn.click()
    await page.waitForTimeout(100)
    
    await expect(workforceBtn).toHaveClass(/active-green/)
  })

  test('星区矿物选择测试', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    
    const mineralSelector = page.locator('.input-group').filter({ hasText: /资源|Resources/ })
    await expect(mineralSelector).toBeVisible()
    
    await mineralSelector.click()
    await page.waitForTimeout(100)
    
    await expect(page.locator('.mineral-popover')).toBeVisible()
    
    const mineralOption = page.locator('.mineral-option').first()
    await mineralOption.click()
  })
})

test.describe('多空间站帝国规划 - 数据迁移', () => {
  test('V1 数据迁移 E2E 测试', async ({ page }) => {
    await page.goto('/')
    
    await page.evaluate(() => {
      localStorage.clear()
      
      const v1Data = {
        version: 1,
        activeId: 'v1-station-1',
        list: [{
          id: 'v1-station-1',
          name: 'V1 Test Station',
          modules: [],
          settings: {
            sunlight: 100,
            useHQ: false,
            manualWorkforce: 0,
            workforcePercent: 100,
            workforceAuto: true,
            considerWorkforceForAutoFill: false,
            supplyWorkforceBonus: false,
            buyMultiplier: 0.5,
            sellMultiplier: 0.5,
            minersEnabled: false,
            internalSupply: false,
            racePreference: 'argon',
            resourceBufferHours: 1.0,
            primaryProductBufferHours: 12.0,
            secondaryProductBufferHours: 2.0,
            transportShipCapacity: 62000
          },
          lastUpdated: Date.now()
        }]
      }
      
      localStorage.setItem('x4_station_data', JSON.stringify(v1Data))
    })
    
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    
    const stationTab = page.locator('.station-tab').first()
    await expect(stationTab).toBeVisible()
    await expect(stationTab).toContainText('V1 Test Station')
    
    const v1KeyExists = await page.evaluate(() => {
      return localStorage.getItem('x4_station_data') !== null
    })
    expect(v1KeyExists).toBe(false)
    
    const v2KeyExists = await page.evaluate(() => {
      return localStorage.getItem('x4_empire_data') !== null
    })
    expect(v2KeyExists).toBe(true)
  })
})

test.describe('多空间站帝国规划 - 分站视图数据绑定', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ 
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('分站数据隔离测试', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    
    await addBtn.click()
    await page.waitForTimeout(200)
    const station1Tab = page.locator('.station-tab').first()
    
    await addBtn.click()
    await page.waitForTimeout(200)
    const station2Tab = page.locator('.station-tab').last()
    
    await station1Tab.click()
    await page.waitForTimeout(100)
    
    const activeAfterClick1 = await station1Tab.evaluate(el => el.classList.contains('active'))
    expect(activeAfterClick1).toBe(true)
    
    await station2Tab.click()
    await page.waitForTimeout(100)
    
    const activeAfterClick2 = await station2Tab.evaluate(el => el.classList.contains('active'))
    expect(activeAfterClick2).toBe(true)
    
    const activeAfterClick1b = await station1Tab.evaluate(el => el.classList.contains('active'))
    expect(activeAfterClick1b).toBe(false)
  })
})

test.describe('多空间站帝国规划 - 标签拖拽重排', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  const addStations = async (page: any, count: number) => {
    const addBtn = page.locator('.add-btn')
    for (let i = 0; i < count; i++) {
      await addBtn.click()
      await page.waitForTimeout(120)
    }
  }

  const getStationOrder = async (page: any) => {
    return await page.locator('.station-tab').evaluateAll((els: Element[]) =>
      els.map((el) => (el as HTMLElement).dataset.stationId || '')
    )
  }

  const dragStationTab = async (page: any, fromIndex: number, toIndex: number) => {
    const source = page.locator('.station-tab').nth(fromIndex)
    const target = page.locator('.station-tab').nth(toIndex)

    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) {
      throw new Error('missing station tab bounding box')
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(2000)
  }

  const dragWithRetry = async (page: any, fromIndex: number, toIndex: number) => {
    const initialOrder = await getStationOrder(page)
    for (let attempt = 0; attempt < 3; attempt++) {
      await dragStationTab(page, fromIndex, toIndex)
      const currentOrder = await getStationOrder(page)
      if (currentOrder.join('|') !== initialOrder.join('|')) return
    }
    throw new Error('drag did not change station order after 3 attempts')
  }

  const getSavedEmpires = async (page: any) => {
    return await page.evaluate(() => {
      const data = localStorage.getItem('x4_empire_data')
      if (!data) return null
      return JSON.parse(data)
    })
  }

  test('标签拖拽重排成功', async ({ page }) => {
    await addStations(page, 3)
    const beforeOrder = await getStationOrder(page)
    expect(beforeOrder).toHaveLength(3)

    await dragWithRetry(page, 2, 0)

    const afterOrder = await getStationOrder(page)
    expect(afterOrder).toHaveLength(3)
    expect(afterOrder[0]).toBe(beforeOrder[2])
    expect(afterOrder.join('|')).not.toBe(beforeOrder.join('|'))
  })

  test('帝国总览固定首位', async ({ page }) => {
    await addStations(page, 3)
    await dragWithRetry(page, 2, 0)

    const firstTabClasses = await page.locator('.tabs-scroll-area > .tab-item').first().getAttribute('class')
    expect(firstTabClasses || '').toContain('overview-tab')
  })

  test('保存并刷新后顺序保持', async ({ page }) => {
    await addStations(page, 3)
    await dragWithRetry(page, 2, 0)
    const orderBeforeSave = await getStationOrder(page)

    const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
    await saveBtn.click()
    await page.waitForTimeout(200)

    const savedEmpires = await getSavedEmpires(page)
    const savedOrder = (savedEmpires?.list?.[0]?.stations ?? []).map((s: { id: string }) => s.id)
    expect(savedOrder).toEqual(orderBeforeSave)

    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

    const orderAfterReload = await getStationOrder(page)
    expect(orderAfterReload).toEqual(orderBeforeSave)
  })

  test('取消拖拽不改变顺序', async ({ page }) => {
    await addStations(page, 3)
    const beforeOrder = await getStationOrder(page)

    const source = page.locator('.station-tab').nth(2)
    const sourceBox = await source.boundingBox()
    if (!sourceBox) {
      throw new Error('missing source station tab bounding box')
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 40, sourceBox.y + sourceBox.height / 2 + 120, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const afterOrder = await getStationOrder(page)
    expect(afterOrder).toEqual(beforeOrder)
  })
})
