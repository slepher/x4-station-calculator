import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('Bug 修复验证测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.addStyleTag({ 
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }' 
    })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  })

  test('Bug #1 验证: 新建功能应创建新帝国', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await expect(addBtn).toBeVisible({ timeout: 500 })
    await addBtn.click()
    
    const searchInput = page.locator('.search-box .search-input')
    await searchInput.focus()
    await searchInput.fill('Energy')
    
    const resultItem = page.locator('.results-popover .result-item').first()
    await expect(resultItem).toBeVisible({ timeout: 500 })
    await resultItem.click()
    
    const initialStationCount = await page.locator('.station-tab').count()
    
    const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
    await newBtn.click()
    
    const dialog = page.locator('.fixed.inset-0')
    await expect(dialog).toBeVisible({ timeout: 500 })
    await page.waitForTimeout(100)
    
    const discardBtn = page.locator('button').filter({ hasText: /丢弃并新建|Discard/i }).first()
    await discardBtn.click({ force: true })
    
    await expect(dialog).not.toBeVisible({ timeout: 500 })
    
    const finalStationCount = await page.locator('.station-tab').count()
    
    expect(finalStationCount).toBe(0)
    expect(finalStationCount).toBeLessThan(initialStationCount)
  })

  test('Bug #2 验证: 另存为不应修改当前帝国', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await expect(addBtn).toBeVisible({ timeout: 500 })
    await addBtn.click()
    
    const searchInput = page.locator('.search-box .search-input')
    await searchInput.focus()
    await searchInput.fill('Energy')
    
    const resultItem = page.locator('.results-popover .result-item').first()
    await expect(resultItem).toBeVisible({ timeout: 500 })
    await resultItem.click()
    
    const overviewTab = page.locator('.overview-tab')
    await overviewTab.click()
    await page.waitForTimeout(100)
    
    const empireNameInput = page.locator('.ghost-input.w-64')
    await expect(empireNameInput).toBeVisible({ timeout: 500 })
    await empireNameInput.fill('Empire A')
    
    const saveAsBtn = page.locator('.btn-tool').filter({ hasText: /另存为|Save.*As/i }).first()
    await saveAsBtn.click()
    
    const dialog = page.locator('.fixed.inset-0')
    await expect(dialog).toBeVisible({ timeout: 500 })
    await page.waitForTimeout(100)
    
    const nameInput = page.locator('.fixed.inset-0 input[type="text"]')
    await nameInput.fill('Empire B')
    
    const saveBtn = page.locator('.fixed.inset-0 button').filter({ hasText: /保存|Save/i }).last()
    await saveBtn.click({ force: true })
    
    await expect(dialog).not.toBeVisible({ timeout: 500 })
    
    await overviewTab.click()
    await page.waitForTimeout(100)
    
    const empireNameDisplay = await page.locator('.ghost-input.w-64').inputValue()
    
    expect(empireNameDisplay).toBe('Empire B')
  })

  test('Bug #7 验证: 保存并新建应创建新帝国', async ({ page }) => {
    const addBtn = page.locator('.add-btn')
    await expect(addBtn).toBeVisible({ timeout: 500 })
    await addBtn.click()
    
    const searchInput = page.locator('.search-box .search-input')
    await searchInput.focus()
    await searchInput.fill('Energy')
    
    const resultItem = page.locator('.results-popover .result-item').first()
    await expect(resultItem).toBeVisible({ timeout: 500 })
    await resultItem.click()
    
    const initialStationCount = await page.locator('.station-tab').count()
    expect(initialStationCount).toBe(1)
    
    const newBtn = page.locator('.btn-tool').filter({ hasText: /新建|New/i }).first()
    await newBtn.click()
    
    const dialog = page.locator('.fixed.inset-0')
    await expect(dialog).toBeVisible({ timeout: 500 })
    await page.waitForTimeout(100)
    
    const saveAndNewBtn = page.locator('button').filter({ hasText: /保存并新建|覆盖并新建|Save.*Create|Overwrite/i }).first()
    await saveAndNewBtn.click({ force: true })
    
    await expect(dialog).not.toBeVisible({ timeout: 500 })
    
    const finalStationCount = await page.locator('.station-tab').count()
    
    expect(finalStationCount).toBe(0)
  })
})
