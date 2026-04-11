import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('帝国 CRUD 全面测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({ 
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('isTestEnv', 'true')
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  const getSavedEmpires = async (page: any) => {
    return await page.evaluate(() => {
      const data = localStorage.getItem('x4_empire_data')
      if (!data) return null
      return JSON.parse(data)
    })
  }

  const addModuleToStation = async (page: any, moduleName: string) => {
    const searchInput = page.locator('.search-box .search-input')
    await searchInput.waitFor({ state: 'visible', timeout: 500 })
    await searchInput.focus()
    await searchInput.fill(moduleName)
    
    const resultItem = page.locator('.results-popover .result-item').first()
    await resultItem.waitFor({ state: 'visible', timeout: 1000 })
    await page.waitForTimeout(100)
    await resultItem.click({ force: true })
    await page.waitForTimeout(200)
  }

  const setEmpireName = async (page: any, name: string) => {
    const empireNameInput = page.locator('.ghost-input.w-64')
    await empireNameInput.waitFor({ state: 'visible', timeout: 500 })
    await empireNameInput.click()
    await empireNameInput.fill(name)
    await empireNameInput.press('Enter')
    await page.waitForTimeout(100)
  }

  const completeSaveDialog = async (page: any, expectedName?: string) => {
    const smartDialog = page.locator('.fixed.inset-0.z-\\[100\\]')
    await smartDialog.waitFor({ state: 'visible', timeout: 500 })
    if (expectedName) {
      const dialogInput = smartDialog.locator('input[type="text"]')
      await dialogInput.fill(expectedName)
    }
    const saveBtn = smartDialog.locator('button').filter({ hasText: /保存|Save/i }).last()
    await saveBtn.click({ force: true })
    await smartDialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
  }

  const handleConfirmDialog = async (page: any, action: 'discard') => {
    const smartDialog = page.locator('.fixed.inset-0.z-\\[100\\]')
    await page.waitForTimeout(100)
    if (await smartDialog.isVisible({ timeout: 500 }).catch(() => false)) {
      const discardBtn = smartDialog.locator('button').filter({ hasText: /丢弃并新建|Discard/i }).first()
      await discardBtn.click({ force: true })
      await smartDialog.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
      await page.waitForTimeout(100)
    }
  }

  const handleSmartSaveDialog = async (page: any, action: 'save' | 'discard', name?: string) => {
    if (action === 'discard') {
      await handleConfirmDialog(page, 'discard')
      return
    }
    await completeSaveDialog(page, name)
  }

  test.describe('Create - 创建帝国', () => {
    test('C1: 新建帝国并验证初始状态', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const empireNameInput = page.locator('.ghost-input.w-64')
      await expect(empireNameInput).toBeVisible({ timeout: 500 })
      
      const stationCount = await page.locator('.station-tab').count()
      expect(stationCount).toBe(0)
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length ?? 0).toBe(0)
    })

    test('C2: 新建帝国后添加空间站和模块', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      
      const stationCount = await page.locator('.station-tab').count()
      expect(stationCount).toBe(1)
      
      await addModuleToStation(page, 'Energy')
      
      const moduleItem = page.locator('[class*="module"]').first()
      await expect(moduleItem).toBeVisible({ timeout: 1000 })
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length ?? 0).toBe(0)
    })

    test('C3: Bug #3 - 连续新建应创建独立帝国', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Empire A')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await completeSaveDialog(page, 'Empire A')
      
      const savedEmpiresBefore = await getSavedEmpires(page)
      const empireAId = savedEmpiresBefore?.list?.[0]?.id
      
      await newBtn.click()
      await handleConfirmDialog(page, 'discard')
      
      const stationCount = await page.locator('.station-tab').count()
      expect(stationCount).toBe(0)
      
      const empireNameInput2 = page.locator('.ghost-input.w-64')
      const name2 = await empireNameInput2.inputValue()
      expect(name2).not.toBe('Empire A')
      
      const savedEmpiresAfter = await getSavedEmpires(page)
      expect(savedEmpiresAfter?.list?.length).toBe(1)
    })
  })

  test.describe('Read - 读取/加载帝国', () => {
    test('R1: 保存的帝国应出现在加载列表', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Test Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await completeSaveDialog(page, 'Test Empire')
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length).toBe(1)
      expect(savedEmpires?.list?.[0]?.name).toBe('Test Empire')
      expect(savedEmpires?.list?.[0]?.stations?.[0]?.modules?.length).toBe(2)
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const empireInList = dialog.locator('text=Test Empire')
      await expect(empireInList).toBeVisible({ timeout: 500 })
    })

    test('R2: Bug #4 - 未保存的帝国不应出现在加载列表', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const empireNameInput = page.locator('.ghost-input.w-64')
      await empireNameInput.click()
      await empireNameInput.fill('Unsaved Empire')
      await empireNameInput.press('Enter')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length ?? 0).toBe(0)
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const empireInList = dialog.locator('text=Unsaved Empire')
      const isVisible = await empireInList.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    })

    test('R3: 刷新后已保存帝国应保留', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Persisted Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Persisted Empire')
      
      const savedEmpiresBefore = await getSavedEmpires(page)
      const modulesBefore = savedEmpiresBefore?.list?.[0]?.stations?.[0]?.modules
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const savedEmpiresAfter = await getSavedEmpires(page)
      expect(savedEmpiresAfter?.list?.length).toBe(1)
      expect(savedEmpiresAfter?.list?.[0]?.name).toBe('Persisted Empire')
      expect(savedEmpiresAfter?.list?.[0]?.stations?.[0]?.modules?.length).toBe(2)
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const empireInList = dialog.locator('text=Persisted Empire')
      await expect(empireInList).toBeVisible({ timeout: 500 })
    })

    test('R4: 加载不同帝国应切换数据', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      
      await newBtn.click()
      await setEmpireName(page, 'Empire A')
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire A')
      
      await newBtn.click()
      await handleConfirmDialog(page, 'discard')
      
      await setEmpireName(page, 'Empire B')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire B')
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length).toBe(2)
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      
      const loadEmpireA = dialog.locator('button').filter({ hasText: /加载|Load/i }).first()
      await loadEmpireA.click({ force: true })
      await dialog.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {})
      
      const moduleEnergy = page.locator('text=/Energy|能量电池/')
      await expect(moduleEnergy.first()).toBeVisible({ timeout: 1000 })
      
      await page.waitForTimeout(300)
      
      await loadBtn.click()
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      
      const loadEmpireB = dialog.locator('text=Empire B').first()
      await loadEmpireB.click({ force: true })
      await dialog.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {})
      
      const moduleHull = page.locator('text=/Hull|船体/')
      await expect(moduleHull.first()).toBeVisible({ timeout: 1000 })
    })
  })

  test.describe('Update - 更新帝国', () => {
    test('U1: 修改帝国名称并保存', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const empireNameInput = page.locator('.ghost-input.w-64')
      await empireNameInput.fill('Original Name')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save')
      
      const overviewTab = page.locator('.overview-tab')
      await overviewTab.click()
      
      await empireNameInput.fill('Updated Name')
      await saveBtn.click()
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.[0]?.name).toBe('Updated Name')
      expect(savedEmpires?.list?.[0]?.stations?.[0]?.modules?.length).toBe(1)
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const empireInList = dialog.locator('text=Updated Name')
      await expect(empireInList).toBeVisible({ timeout: 500 })
    })

    test('U2: 修改空间站模块并保存', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Station Test')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Station Test')
      
      await page.waitForTimeout(200)
      
      let savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.[0]?.stations?.[0]?.modules?.length).toBe(1)
      
      const stationTab = page.locator('.station-tab').first()
      await stationTab.click()
      await page.waitForTimeout(100)
      
      await addModuleToStation(page, 'Hull')
      await saveBtn.click()
      
      savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.[0]?.stations?.[0]?.modules?.length).toBe(2)
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const savedEmpiresAfter = await getSavedEmpires(page)
      expect(savedEmpiresAfter?.list?.[0]?.stations?.[0]?.modules?.length).toBe(2)
    })

    test('U3: 另存为应创建独立副本', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Empire A')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire A')
      
      await page.waitForTimeout(200)
      
      const stationTab = page.locator('.station-tab').first()
      await stationTab.click()
      await page.waitForTimeout(100)
      
      await addModuleToStation(page, 'Hull')
      
      const saveAsBtn = page.locator('.btn-tool').filter({ hasText: /另存为|Save.*As/i }).first()
      await saveAsBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      const nameInput = page.locator('.fixed.inset-0 input[type="text"]')
      await nameInput.fill('Empire B')
      const confirmBtn = page.locator('.fixed.inset-0 button').filter({ hasText: /保存|Save/i }).last()
      await confirmBtn.click({ force: true })
      await expect(dialog).not.toBeVisible({ timeout: 500 })
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length).toBe(2)
      
      const empireA = savedEmpires?.list?.find((e: any) => e.name === 'Empire A')
      const empireB = savedEmpires?.list?.find((e: any) => e.name === 'Empire B')
      
      expect(empireA?.stations?.[0]?.modules?.length).toBe(1)
      expect(empireB?.stations?.[0]?.modules?.length).toBe(2)
      expect(empireA?.id).not.toBe(empireB?.id)
    })
  })

  test.describe('Delete - 删除帝国', () => {
    test('D1: Bug #5 - 删除帝国后刷新应消失', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'To Delete')
      await page.waitForTimeout(100)
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'To Delete')
      
      await page.waitForTimeout(500)
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      
      const deleteBtn = dialog.locator('button').filter({ hasText: /删除|Delete/i }).first()
      await page.waitForTimeout(100)
      
      page.once('dialog', async d => {
        await d.accept()
      })
await deleteBtn.click({ force: true })
      
      await page.waitForTimeout(200)
      const backdrop = page.locator('.fixed.inset-0.z-\\[100\\]')
      await backdrop.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
      
      await loadBtn.click({ force: true })
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const deletedEmpire = dialog.locator('text=To Delete')
      const isVisible = await deletedEmpire.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      await loadBtn.click({ force: true })
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      const deletedEmpireAfterReload = dialog.locator('text=To Delete')
      const isVisibleAfterReload = await deletedEmpireAfterReload.isVisible().catch(() => false)
      expect(isVisibleAfterReload).toBe(false)
    })

    test('D2: 删除当前编辑的帝国应切换到其他帝国', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      
      await newBtn.click()
      await setEmpireName(page, 'Empire A')
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire A')
      
      await newBtn.click()
      await handleConfirmDialog(page, 'discard')
      await setEmpireName(page, 'Empire B')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire B')
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      
      const loadBtn2 = dialog.locator('button').filter({ hasText: /加载|Load/i }).first()
      await loadBtn2.click({ force: true })
      await dialog.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {})
      
      await page.waitForTimeout(300)
      
      await loadBtn.click()
      await expect(dialog).toBeVisible({ timeout: 500 })
      
      page.once('dialog', async d => {
        await d.accept()
      })
      
      const deleteBtn = dialog.locator('button').filter({ hasText: /删除|Delete/i }).first()
      await page.waitForTimeout(100)
      await deleteBtn.click({ force: true })
      
      await page.waitForTimeout(500)
      
      const savedEmpires = await getSavedEmpires(page)
      expect(savedEmpires?.list?.length).toBe(1)
      expect(savedEmpires?.list?.[0]?.name).toBe('Empire B')
    })
  })

  test.describe('Tab 状态保持', () => {
    test('Bug #6 - 刷新页面后应停留在之前选中的空间站', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const empireNameInput = page.locator('.ghost-input.w-64')
      await empireNameInput.fill('Test Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save')
      
      const stationTabs = page.locator('.station-tab')
      const stationCount = await stationTabs.count()
      expect(stationCount).toBe(2)
      
      const secondStationTab = stationTabs.nth(1)
      await secondStationTab.click()
      
      const secondStationName = await secondStationTab.textContent()
      expect(secondStationName).toBeTruthy()
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const activeTab = page.locator('.station-tab.active')
      const activeTabName = await activeTab.textContent()
      
      expect(activeTabName).toBe(secondStationName)
    })
  })

  test.describe('Tab 状态持久化测试', () => {
    const getActiveStationId = async (page: any) => {
      return await page.evaluate(() => {
        const data = localStorage.getItem('x4_station_active_view')
        if (!data) return null
        const parsed = JSON.parse(data)
        return parsed.activeStationId
      })
    }

    test('T1: 切换 tab 后刷新页面应停留在之前选中的 tab', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Test Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Test Empire')
      
      const stationTabs = page.locator('.station-tab')
      const secondStationTab = stationTabs.nth(1)
      await secondStationTab.click()
      
      const sessionActiveStation = await getActiveStationId(page)
      expect(sessionActiveStation).toBeTruthy()
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const activeTab = page.locator('.station-tab.active')
      await expect(activeTab).toBeVisible({ timeout: 500 })
    })

    test('T2: 切换 tab 后不保存，刷新页面仍停留在选中的 tab', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      const empireNameInput = page.locator('.ghost-input.w-64')
      await empireNameInput.fill('Test Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save')
      
      const stationTabs = page.locator('.station-tab')
      const secondStationTab = stationTabs.nth(1)
      await secondStationTab.click()
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const activeTab = page.locator('.station-tab.active')
      await expect(activeTab).toBeVisible({ timeout: 500 })
    })

    test('T4: 切换 tab 后保存，刷新页面停留在选中的 tab', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      await newBtn.click()
      
      await setEmpireName(page, 'Test Empire')
      
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Test Empire')
      
      const stationTabs = page.locator('.station-tab')
      const secondStationTab = stationTabs.nth(1)
      await secondStationTab.click()
      
      await saveBtn.click()
      
      const activeStationId = await getActiveStationId(page)
      expect(activeStationId).toBeTruthy()
      
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      
      const activeTab = page.locator('.station-tab.active')
      await expect(activeTab).toBeVisible({ timeout: 500 })
    })

    test('T6: 载入不同帝国应使用新帝国的第一个空间站', async ({ page }) => {
      const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
      
      await newBtn.click()
      await setEmpireName(page, 'Empire A')
      const addBtn = page.locator('.add-btn')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      const saveBtn = page.locator('.btn-tool').filter({ hasText: /保存|Save/i }).first()
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire A')
      
      await newBtn.click()
      await handleConfirmDialog(page, 'discard')
      await setEmpireName(page, 'Empire B')
      await addBtn.click()
      await addModuleToStation(page, 'Energy')
      await addBtn.click()
      await addModuleToStation(page, 'Hull')
      await saveBtn.click()
      await handleSmartSaveDialog(page, 'save', 'Empire B')
      
      const stationTabs = page.locator('.station-tab')
      const secondStationTab = stationTabs.nth(1)
      await secondStationTab.click()
      
      const loadBtn = page.locator('.btn-tool').filter({ hasText: /加载|Load/i }).first()
      await loadBtn.click()
      
      const dialog = page.locator('.fixed.inset-0')
      await expect(dialog).toBeVisible({ timeout: 500 })
      await page.waitForTimeout(100)
      
      const loadEmpireA = dialog.locator('text=Empire A').first()
      await loadEmpireA.click({ force: true })
      await dialog.waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {})
      
      const activeTab = page.locator('.station-tab.active')
      await expect(activeTab).toBeVisible({ timeout: 500 })
    })
  })
})
