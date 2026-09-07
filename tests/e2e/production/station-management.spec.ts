import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'

async function getStationNames(page: Page) {
  const labels = await page.locator('[data-testid="sidebar-station"] .sidebar-item-label').allTextContents()
  return labels.map(v => v.trim())
}

async function getStationIds(page: Page) {
  return page.getByTestId('sidebar-station').evaluateAll(nodes => nodes.map(node => {
    const id = node.getAttribute('data-station-id')
    if (!id) throw new Error('Station has no identity')
    return id
  }))
}

async function waitForStationCount(page: Page, count: number) {
  await expect(page.getByTestId('sidebar-station')).toHaveCount(count)
}

async function createNamedStations(page: Page, names: string[]) {
  for (const name of names) {
    await page.getByTestId('sidebar-add-station').click()
    const input = page.locator('.ghost-input.w-32').first()
    await input.fill(name)
    await input.press('Tab')
    await expect(page.getByTestId('sidebar-station').last()).toContainText(name)
  }
}

async function dragStationBeforeStation(page: Page, sourceId: string, targetId: string) {
  const source = page.locator('[data-testid="sidebar-station"][data-station-id="' + sourceId + '"]')
  const target = page.locator('[data-testid="sidebar-station"][data-station-id="' + targetId + '"]')
  const s = await source.boundingBox()
  const t = await target.boundingBox()
  if (!s || !t) throw new Error('Missing station box')
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + s.height / 2, { steps: 5 })
  await expect(source).toHaveClass(/sortable-chosen/)
  // Move outside the list first so intermediate stations cannot consume the drop hover.
  const outsideX = s.x + s.width + 80
  await page.mouse.move(outsideX, s.y + s.height / 2, { steps: 10 })
  await expect(source).toHaveClass(/sortable-ghost/)
  await page.mouse.move(outsideX, t.y + 2, { steps: 20 })
  await page.mouse.move(t.x + t.width / 2, t.y + 2, { steps: 20 })
  await expect.poll(async () => {
    const sourceBox = await source.boundingBox()
    const targetBox = await target.boundingBox()
    if (!sourceBox || !targetBox) throw new Error('Missing drag hover box')
    return sourceBox.y < targetBox.y
  }).toBe(true)
  await page.mouse.up()
  await expect(source).not.toHaveClass(/sortable-chosen|sortable-ghost/)
}

async function cancelStationDrag(page: Page, sourceId: string) {
  const source = page.locator('[data-testid="sidebar-station"][data-station-id="' + sourceId + '"]')
  const box = await source.boundingBox()
  if (!box) throw new Error('Missing station box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2, { steps: 5 })
  await expect(source).toHaveClass(/sortable-chosen/)
  // Leave horizontally without hovering a different station in the vertical list.
  await page.mouse.move(box.x + box.width + 150, box.y + box.height / 2, { steps: 20 })
  await expect(source).toHaveClass(/sortable-ghost/)
  await page.mouse.up()
  await expect(source).not.toHaveClass(/sortable-chosen|sortable-ghost/)
}

async function readSavedEmpire(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('x4_empire_data_v9')
    if (!raw) throw new Error('Missing saved empire storage')
    const state = JSON.parse(raw)
    const empire = state.list.find((item: { id: string }) => item.id === state.activeId)
    if (!empire) throw new Error('Missing active saved empire')
    return empire as { id: string, name: string, stations: Array<{ id: string, name: string, modules: Array<{ id: string, count: number }> }> }
  })
}

async function saveNewEmpire(page: Page, name: string) {
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await expect(dialog).toBeVisible()
  await dialog.locator('.dialog-input').fill(name)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(async () => (await readSavedEmpire(page)).name).toBe(name)
  const saved = await readSavedEmpire(page)
  await expect.poll(() => getStationIds(page)).toEqual(saved.stations.map(station => station.id))
  return saved
}

async function addEnergyCellModule(page: Page) {
  await page.getByTestId('candidate-search-input').fill('Energy Cell')
  await page.getByTestId('grouped-candidate-item-module_gen_prod_energycells_01').click()
  await expect(page.locator('.tier-section').first().locator('.module-row')).toHaveCount(1)
}

async function setupBase(page: Page) {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await page.goto('/')
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  dbData.x4_game_version = { version: '9.0', beta: false }
  dbData.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.locator('[data-testid="sidebar-station"][data-station-id]')).toHaveCount(1)
}

test.describe('Station Tab Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await setupBase(page)
  })

  test('标签切换测试', async ({ page }) => {
    const stationTab = page.locator('[data-testid="sidebar-station"]').first()
    await expect(stationTab).toBeVisible()
    await stationTab.click()
    await expect(page.locator('.main-layout')).toBeVisible()

    const addBtn = page.getByTestId('sidebar-add-station')
    await addBtn.click()
    await page.waitForTimeout(200)

    const newStationTab = page.locator('[data-testid="sidebar-station"]').last()
    await expect(newStationTab).toBeVisible()
    await newStationTab.click()
    await expect(page.locator('.main-layout')).toBeVisible()
  })

  test('新建分站测试', async ({ page }) => {
    const addBtn = page.getByTestId('sidebar-add-station')
    const initialCount = await page.locator('[data-testid="sidebar-station"]').count()

    await addBtn.click()
    await page.waitForTimeout(200)

    const newCount = await page.locator('[data-testid="sidebar-station"]').count()
    expect(newCount).toBe(initialCount + 1)

    const newTab = page.locator('[data-testid="sidebar-station"]').last()
    await expect(newTab).toHaveClass(/active/)

    await expect(page.locator('.main-layout')).toBeVisible()
  })

  test('分站菜单测试', async ({ page }) => {
    const addBtn = page.getByTestId('sidebar-add-station')
    await addBtn.click()
    await page.waitForTimeout(200)

    const stationTab = page.locator('[data-testid="sidebar-station"]').first()
    await stationTab.click({ button: 'right' })

    await expect(page.getByTestId('sidebar-context-menu')).toBeVisible()

    const deleteOption = page.getByTestId('sidebar-menu-delete')
    await expect(deleteOption).toBeVisible()

    await deleteOption.click()
    await expect(page.getByTestId('sidebar-delete-dialog')).toBeVisible()
  })

  test('工具栏内容切换测试', async ({ page }) => {
    const stationTab = page.locator('[data-testid="sidebar-station"]').first()
    await stationTab.click()
    await expect(page.locator('.context-toolbar')).toBeVisible()

    const addBtn = page.getByTestId('sidebar-add-station')
    await addBtn.click()
    await page.waitForTimeout(200)

    await expect(page.locator('.context-toolbar')).toBeVisible()
  })

  test('工人运算开关测试', async ({ page }) => {
    const addBtn = page.getByTestId('sidebar-add-station')
    await addBtn.click()
    await page.waitForTimeout(200)

    const workforceBtn = page.locator('.toggle-chip').filter({ hasText: /👥|ON|OFF/ }).first()
    await expect(workforceBtn).toBeVisible()

    await workforceBtn.click()
    await page.waitForTimeout(100)

    await expect(workforceBtn).toHaveClass(/active-green/)
  })

  test('星区矿物选择测试', async ({ page }) => {
    const addBtn = page.getByTestId('sidebar-add-station')
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
    const addBtn = page.getByTestId('sidebar-add-station')
    await addBtn.click()
    await page.waitForTimeout(200)
    await addBtn.click()
    await page.waitForTimeout(200)

    const tabs = page.locator('[data-testid="sidebar-station"]')
    await expect(tabs).toHaveCount(3)

    await tabs.nth(0).click()
    await expect(tabs.nth(0)).toHaveClass(/active/)

    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveClass(/active/)
    await expect(tabs.nth(0)).not.toHaveClass(/active/)
  })

  test('分站数据隔离测试', async ({ page }) => {
    const addBtn = page.getByTestId('sidebar-add-station')

    await addBtn.click()
    await page.waitForTimeout(200)
    const station1Tab = page.locator('[data-testid="sidebar-station"]').first()

    await addBtn.click()
    await page.waitForTimeout(200)
    const station2Tab = page.locator('[data-testid="sidebar-station"]').last()

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
    await setupBase(page)
  })

  test('标签拖拽重排成功', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const [first, alpha, beta] = await getStationIds(page)
    const activeId = await page.locator('[data-testid="sidebar-station"].active').getAttribute('data-station-id')
    await dragStationBeforeStation(page, beta!, first!)
    await expect.poll(() => getStationIds(page)).toEqual([beta, first, alpha])
    await expect(page.locator('[data-testid="sidebar-station"].active')).toHaveAttribute('data-station-id', activeId!)
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.activeEmpire.stations.map((s: { id: string }) => s.id))).toEqual([beta, first, alpha])
  })

  test('标签拖拽后第一个标签是空间站', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const ids = await getStationIds(page)
    await dragStationBeforeStation(page, ids[2]!, ids[0]!)
    await expect(page.getByTestId('sidebar-station').first()).toHaveAttribute('data-station-id', ids[2]!)
  })

  test('保存并刷新后顺序保持', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const saved = await saveNewEmpire(page, 'Order Empire')
    const [first, alpha, beta] = saved.stations.map(station => station.id)
    const expected = [beta, first, alpha]
    await dragStationBeforeStation(page, beta!, first!)
    await expect.poll(() => getStationIds(page)).toEqual(expected)
    await page.getByTestId('toolbar-save-btn').click()
    await expect.poll(async () => (await readSavedEmpire(page)).stations.map(station => station.id)).toEqual(expected)
    await page.reload()
    await expect.poll(() => getStationIds(page)).toEqual(expected)
    expect((await readSavedEmpire(page)).id).toBe(saved.id)
  })

  test('取消拖拽不改变顺序', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta', 'Gamma'])
    const before = await getStationIds(page)
    await cancelStationDrag(page, before[2]!)
    await expect.poll(() => getStationIds(page)).toEqual(before)
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.activeEmpire.stations.map((s: { id: string }) => s.id))).toEqual(before)
  })
})

test.describe('station-tab-drag web integration', () => {
  test.beforeEach(async ({ page }) => setupBase(page))

  test('W1: 标签拖拽重排成功', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const ids = await getStationIds(page)
    await dragStationBeforeStation(page, ids[2]!, ids[1]!)
    await expect.poll(() => getStationIds(page)).toEqual([ids[0], ids[2], ids[1]])
    await expect.poll(() => getStationNames(page)).toEqual(['新建空间站', 'Beta', 'Alpha'])
  })

  test('W2: 空间站标签首位', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    await waitForStationCount(page, 3)
    await expect(page.getByTestId('sidebar-station').first()).toContainText('新建空间站')
    await expect(page.getByTestId('sidebar-overview')).toBeVisible()
  })

  test('W3: 保存并刷新后顺序保持', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    await addEnergyCellModule(page)
    const saved = await saveNewEmpire(page, 'Named Order Empire')
    const ids = saved.stations.map(station => station.id)
    const expected = [ids[0], ids[2], ids[1]]
    await dragStationBeforeStation(page, ids[2]!, ids[1]!)
    await expect.poll(() => getStationIds(page)).toEqual(expected)
    await page.getByTestId('toolbar-save-btn').click()
    await expect.poll(async () => (await readSavedEmpire(page)).stations.map(station => station.id)).toEqual(expected)
    await page.reload()
    await expect.poll(() => getStationIds(page)).toEqual(expected)
    await expect.poll(() => getStationNames(page)).toEqual(['新建空间站', 'Beta', 'Alpha'])
    const restored = await readSavedEmpire(page)
    expect(restored.id).toBe(saved.id)
    expect(restored.stations.find(station => station.id === ids[2])!.modules).toEqual([{ id: 'module_gen_prod_energycells_01', count: 1 }])
  })

  test('W4: 取消拖拽不改变顺序', async ({ page }) => {
    await createNamedStations(page, ['Alpha', 'Beta'])
    const beforeIds = await getStationIds(page)
    const beforeNames = ['新建空间站', 'Alpha', 'Beta']
    await expect.poll(() => getStationNames(page)).toEqual(beforeNames)
    await cancelStationDrag(page, beforeIds[2]!)
    await expect.poll(() => getStationIds(page)).toEqual(beforeIds)
    await expect.poll(() => getStationNames(page)).toEqual(beforeNames)
  })
})

test.describe('帝国数据持久化', () => {
  test.beforeEach(async ({ page }) => setupBase(page))

  test('保存的帝国数据在刷新后保留', async ({ page }) => {
    const input = page.locator('.ghost-input.w-32').first()
    await input.fill('Persistent Station')
    await input.press('Tab')
    const saved = await saveNewEmpire(page, 'Persistent Empire')
    expect(saved.stations.map(station => station.name)).toEqual(['Persistent Station'])
    await page.reload()
    await expect.poll(() => getStationIds(page)).toEqual([saved.stations[0]!.id])
    await expect.poll(() => getStationNames(page)).toEqual(['Persistent Station'])
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.activeEmpire.id)).toBe(saved.id)
    await page.getByTestId('sidebar-station').click()
    await expect(page.locator('.ghost-input.w-32').first()).toHaveValue('Persistent Station')
  })
})

test.describe('Station Name Editing', () => {
  test.beforeEach(async ({ page }) => setupBase(page))

  test('Test 1: Default Name Display', async ({ page }) => {
    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible()
    const val = await nameInput.inputValue()
    expect(val.length).toBeGreaterThan(0)
  })

  test('Test 2: Edit Station Name', async ({ page }) => {
    const nameInput = page.locator('.ghost-input.w-32').first()
    await nameInput.fill('My New Station')
    await nameInput.press('Tab')
    
    const val = await nameInput.inputValue()
    expect(val).toBe('My New Station')
  })

  test('Test 3: Name Input Is Editable', async ({ page }) => {
    const nameInput = page.locator('.ghost-input.w-32').first()
    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeEnabled()
  })

  test('Test 4: Save Button Exists', async ({ page }) => {
    const saveBtn = page.locator('[data-testid="toolbar-save-btn"]')
    await expect(saveBtn).toBeVisible()
  })

  test('Test 5: Station Name Persists', async ({ page }) => {
    const nameInput = page.locator('.ghost-input.w-32').first()
    await nameInput.fill('Persistent Station')
    await nameInput.press('Tab')
    
    const stationTab = page.locator('[data-testid="sidebar-station"]').first()
    await stationTab.click()
    const nameVal = await nameInput.inputValue()
    expect(nameVal).toBe('Persistent Station')
  })

  test('Test 6: Default name is not empty', async ({ page }) => {
    const nameInput = page.locator('.ghost-input.w-32').first()
    const val = await nameInput.inputValue()
    expect(val.length).toBeGreaterThan(0)
  })
})
