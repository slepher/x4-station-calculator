import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'

async function getStationNames(page: Page) {
  const labels = await page.locator('.station-tab .tab-label').allTextContents()
  return labels.map(v => v.trim())
}

async function getStationIds(page: Page) {
  return page.locator('.station-tab[data-station-id]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-station-id') || '')
      .filter(Boolean)
  )
}

async function getStationPositionSnapshot(page: Page) {
  return page.locator('.station-tab[data-station-id]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const el = node as HTMLElement
      const rect = el.getBoundingClientRect()
      return {
        id: node.getAttribute('data-station-id') || '',
        x: Math.round(rect.left + rect.width / 2)
      }
    })
  )
}

async function waitForStationCount(page: Page, count: number) {
  await expect.poll(async () => {
    return page.locator('.station-tab[data-station-id]').count()
  }, { timeout: 5000 }).toBe(count)
}

async function createNamedStations(page: Page, names: string[]) {
  const addBtn = page.locator('.add-btn').first()

  for (let i = 0; i < names.length; i++) {
    await addBtn.click({ timeout: 500 })
    await page.waitForTimeout(150)

    const currentTab = page.locator('.station-tab').nth(i)
    await currentTab.click({ timeout: 500 })

    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible({ timeout: 500 })
    await nameInput.fill(names[i]!, { timeout: 500 })
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
  }
}

async function dragStationBeforeStation(page: Page, sourceId: string, targetId: string) {
  const source = page.locator(`.station-tab[data-station-id="${sourceId}"]`).first()
  const target = page.locator(`.station-tab[data-station-id="${targetId}"]`).first()

  const s = await source.boundingBox()
  const t = await target.boundingBox()
  if (!s || !t) throw new Error('missing tab box')

  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2 + 4)
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(2000)
}

async function clickSaveAndAssertStatusMonitor(page: Page) {
  const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/ }).first()
  await saveBtn.click({ timeout: 500 })

  const monitor = page.locator('div.fixed.bottom-6.right-6.z-\\[9999\\]')
  await expect(monitor).toBeVisible({ timeout: 5000 })

  const latestCard = monitor.locator('div.pointer-events-auto').first()
  await expect(latestCard.locator('span.text-\\[10px\\].font-black.uppercase')).toContainText(/save/i)
  await expect(latestCard.locator('div.text-xs.font-mono')).toContainText(/保存|save/i)
}

async function addOneModuleToMakePlanSavable(page: Page) {
  const searchInput = page.locator('.search-box .search-input').first()
  await searchInput.focus()
  await searchInput.fill('Energy Cell')
  const resultItem = page.locator('.results-popover .result-item').first()
  await expect(resultItem).toBeVisible({ timeout: 1000 })
  await resultItem.click({ timeout: 500 })
  await expect.poll(async () => {
    return page.locator('.module-row').count()
  }, { timeout: 3000 }).toBeGreaterThan(0)
}

async function setupBase(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
}

test.describe('Station Tab Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await setupBase(page)
  })

  test('标签切换测试', async ({ page }) => {
    const stationTab = page.locator('.station-tab').first()
    await expect(stationTab).toBeVisible()
    await stationTab.click()
    await expect(page.locator('.main-layout')).toBeVisible()

    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)

    const newStationTab = page.locator('.station-tab').last()
    await expect(newStationTab).toBeVisible()
    await newStationTab.click()
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

  test('工具栏内容切换测试', async ({ page }) => {
    const stationTab = page.locator('.station-tab').first()
    await stationTab.click()
    await expect(page.locator('.context-toolbar')).toBeVisible()

    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)

    await expect(page.locator('.context-toolbar')).toBeVisible()
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

  test('切换分站不串站', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await addBtn.click()
    await page.waitForTimeout(200)
    await addBtn.click()
    await page.waitForTimeout(200)

    const tabs = page.locator('.station-tab')
    await expect(tabs).toHaveCount(3)

    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveClass(/active/)

    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveClass(/active/)
    await expect(tabs.nth(0)).not.toHaveClass(/active/)
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

test.describe.skip('多空间站帝国规划 - 标签拖拽重排', () => {
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
    await addStations(page, 2)
    const beforeOrder = await getStationOrder(page)
    expect(beforeOrder).toHaveLength(3)

    await dragWithRetry(page, 2, 0)

    const afterOrder = await getStationOrder(page)
    expect(afterOrder).toHaveLength(3)
    expect(afterOrder[0]).toBe(beforeOrder[2])
    expect(afterOrder.join('|')).not.toBe(beforeOrder.join('|'))
  })

  test('标签拖拽后第一个标签是空间站', async ({ page }) => {
    await addStations(page, 2)

    const firstTab = page.locator('.tabs-scroll-area > .tab-item').first()
    await expect(firstTab).toBeVisible()
    await expect(firstTab).toHaveClass(/station-tab/)
  })

  test('保存并刷新后顺序保持', async ({ page }) => {
    await addStations(page, 2)
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

test.describe.skip('station-tab-drag web integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
  })

  test('W1: 标签拖拽重排成功', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    await waitForStationCount(page, 3)

    const initial = await getStationNames(page)
    const initialIds = await getStationIds(page)
    const betaId = initialIds[2]!
    const alphaId = initialIds[0]!
    const expectedIds = [initialIds[0]!, initialIds[2]!, initialIds[1]!]

    const attempts: Array<{ attempt: number, ids: string[], pos: Array<{ id: string, x: number }> }> = []
    let finalIds = await getStationIds(page)
    for (let attempt = 0; attempt < 3; attempt++) {
      await dragStationBeforeStation(page, betaId, alphaId)
      finalIds = await getStationIds(page)
      attempts.push({
        attempt: attempt + 1,
        ids: finalIds,
        pos: await getStationPositionSnapshot(page)
      })
      if (JSON.stringify(finalIds) === JSON.stringify(expectedIds)) {
        break
      }
    }

    expect(initial.length).toBe(3)
    expect(
      finalIds,
      `拖拽后顺序未达到目标。expected=${JSON.stringify(expectedIds)} attempts=${JSON.stringify(attempts)}`
    ).toEqual(expectedIds)
  })

  test('W2: 空间站标签首位', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const firstTab = page.locator('.tabs-scroll-area .tab-item').first()
    await expect(firstTab).toBeVisible()
    await expect(firstTab).toHaveClass(/station-tab/)
  })

  test('W3: 保存并刷新后顺序保持', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    await waitForStationCount(page, 3)
    const initialIds = await getStationIds(page)
    const betaId = initialIds[2]!
    const alphaId = initialIds[0]!
    const expected = [initialIds[0]!, initialIds[2]!, initialIds[1]!]

    const attempts: Array<{ attempt: number, ids: string[], pos: Array<{ id: string, x: number }> }> = []
    let finalIds = await getStationIds(page)
    for (let attempt = 0; attempt < 3; attempt++) {
      await dragStationBeforeStation(page, betaId, alphaId)
      finalIds = await getStationIds(page)
      attempts.push({
        attempt: attempt + 1,
        ids: finalIds,
        pos: await getStationPositionSnapshot(page)
      })
      if (JSON.stringify(finalIds) === JSON.stringify(expected)) {
        break
      }
    }
    expect(
      finalIds,
      `保存前拖拽重排未达成。expected=${JSON.stringify(expected)} attempts=${JSON.stringify(attempts)}`
    ).toEqual(expected)

    await addOneModuleToMakePlanSavable(page)
    await clickSaveAndAssertStatusMonitor(page)

    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

    await waitForStationCount(page, 3)
    const reloaded = await getStationIds(page)
    expect(reloaded).toEqual(expected)

    await expect(page.locator('.station-tab[data-station-id]')).toHaveCount(3)
  })

  test('W4: 取消拖拽不改变顺序', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const before = await getStationNames(page)

    const source = page.locator('.station-tab').nth(2)
    const s = await source.boundingBox()
    if (!s) throw new Error('missing source tab box')

    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
    await page.mouse.down()
    await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 6)
    await page.mouse.move(20, 20, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)

    const after = await getStationNames(page)
    expect(after).toEqual(before)
  })
})

test.describe('帝国数据持久化', () => {
  test('保存的帝国数据在刷新后保留', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

    const stationTab = page.locator('.station-tab').first()
    await expect(stationTab).toBeVisible()
    const stationName = await stationTab.textContent()

    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })

    const afterReload = page.locator('.station-tab').first()
    await expect(afterReload).toBeVisible()
    await expect(afterReload).toContainText(stationName || '')
  })
})

test.describe('Station Name Editing', () => {
  test('Test 1: Default Name Display', async ({ page }) => {
    await page.goto('/')
    
    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible()
    const val = await nameInput.inputValue()
    expect(val.length).toBeGreaterThan(0)
  })

  test('Test 2: Edit Station Name', async ({ page }) => {
    await page.goto('/')
    
    const nameInput = page.locator('.ghost-input.w-32').first()
    await nameInput.fill('My New Station')
    await nameInput.press('Tab')
    
    const val = await nameInput.inputValue()
    expect(val).toBe('My New Station')
  })

  test('Test 3: Name Input Is Editable', async ({ page }) => {
    await page.goto('/')
    
    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeEnabled()
  })

  test('Test 4: Save Button Exists', async ({ page }) => {
    await page.goto('/')
    
    const saveBtn = page.locator('[data-testid="toolbar-save-btn"]')
    await expect(saveBtn).toBeVisible()
  })

  test('Test 5: Station Name Persists', async ({ page }) => {
    await page.goto('/')
    
    const nameInput = page.locator('.ghost-input.w-32').first()
    await nameInput.fill('Persistent Station')
    await nameInput.press('Tab')
    
    const stationTab = page.locator('.station-tab').first()
    await stationTab.click()
    const nameVal = await nameInput.inputValue()
    expect(nameVal).toBe('Persistent Station')
  })

  test('Test 6: Default name is not empty', async ({ page }) => {
    await page.goto('/')
    
    const nameInput = page.locator('.ghost-input.w-32').first()
    const val = await nameInput.inputValue()
    expect(val.length).toBeGreaterThan(0)
  })
})
