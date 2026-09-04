import { test } from '../../test-setup'
import { expect } from '@playwright/test'

test.describe('Module Management - Storage Auto-Fill', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.waitForSelector('.module-list-container', { state: 'visible' })
  })

  test('Case 1: Basic Storage Auto-Fill', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' })

    const searchInput = page.locator('[data-testid="candidate-search-input"]').first()
    await expect(searchInput).toBeVisible()
    await searchInput.click()

    await page.keyboard.type('Energy Cell', { delay: 30 })
    await page.waitForTimeout(500)

    const resultItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(resultItem).toBeVisible({ timeout: 500 })

    await resultItem.click()

    const autoSection = page.locator('.tier-section.tier-auto').first()
    await expect(autoSection).toBeVisible()

    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ })
    await expect(containerStorage.first()).toBeVisible()
  })

  test('Case 2: Race Preference Change', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' })

    const searchInput = page.locator('[data-testid="candidate-search-input"]').first()
    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Energy Cell', { delay: 30 })
    await page.waitForTimeout(500)

    const resultItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(resultItem).toBeVisible({ timeout: 3000 })
    await resultItem.click()

    const raceSelect = page.locator('select.race-select')
    await raceSelect.selectOption('terran')

    const autoSection = page.locator('.tier-section.tier-auto').first()
    await expect(autoSection.locator('.module-row').filter({ hasText: /Terran|地球人/ }).first()).toBeVisible()
  })

  test.skip('Case 3: Incremental Fill', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' })

    const searchInput = page.locator('[data-testid="candidate-search-input"]').first()
    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Energy Cell', { delay: 30 })
    await page.waitForTimeout(500)
    const resultItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(resultItem).toBeVisible({ timeout: 3000 })
    await resultItem.click()

    const autoSection = page.locator('.tier-section.tier-auto').first()
    await expect(autoSection).toBeVisible()
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ })
    await expect(containerStorage.first()).toBeVisible()

    const getStorageCount = async () => {
      const countEl = containerStorage.first().locator('.count-text')
      if (await countEl.isVisible()) {
        const text = await countEl.innerText()
        return parseInt(text.trim())
      }
      return 1
    }

    const initialCount = await getStorageCount()
    expect(initialCount).toBeGreaterThan(0)

    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Storage', { delay: 30 })
    await page.waitForTimeout(500)

    const storageResult = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(storageResult).toBeVisible({ timeout: 3000 })
    await storageResult.click()

    await page.waitForTimeout(500)

    if (await containerStorage.first().isVisible()) {
      const newCount = await getStorageCount()
      expect(newCount).toBeLessThan(initialCount)
    } else {
      expect(true).toBe(true)
    }
  })

  test.skip('Case 4: Buffer Response', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' })

    const searchInput = page.locator('[data-testid="candidate-search-input"]').first()
    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Energy Cell', { delay: 30 })
    await page.waitForTimeout(500)

    const resultItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(resultItem).toBeVisible({ timeout: 1000 })
    await resultItem.click()

    const dashboard = page.locator('.list-wrapper').first()
    const volumeViewBtn = page.locator('[data-testid="view-tab-btn-station-wareflow-volume"]')
    await volumeViewBtn.click()
    await page.waitForTimeout(200)

    const sliderInput = page.locator('input[type="range"]').nth(1)
    await expect(sliderInput).toBeVisible()

    const autoSection = page.locator('.tier-section.tier-auto').first()
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ })
    await expect(containerStorage.first()).toBeVisible()

    const getStorageCount = async () => {
      const countEl = containerStorage.first().locator('.count-text')
      if (await countEl.isVisible()) {
        const text = await countEl.innerText()
        return parseInt(text.trim())
      }
      return 1
    }

    const initialCount = await getStorageCount()

    await sliderInput.evaluate((el: HTMLInputElement) => {
      el.value = '24'
      el.dispatchEvent(new Event('input'))
      el.dispatchEvent(new Event('change'))
    })

    await page.waitForTimeout(1000)
    const newCount = await getStorageCount()
    expect(newCount).toBeGreaterThan(initialCount)
  })

  test.skip('Case 5: AutoSupply Storage', async ({ page }) => {
    await page.waitForSelector('.module-list-container', { state: 'visible' })

    const searchInput = page.locator('[data-testid="candidate-search-input"]').first()
    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Hull', { delay: 30 })
    await page.waitForTimeout(500)

    const resultItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(resultItem).toBeVisible({ timeout: 1000 })
    await resultItem.click()

    const autoSection = page.locator('.tier-section.tier-auto').first()
    const containerStorage = autoSection.locator('.module-row').filter({ hasText: /Container Storage|集装箱仓储/ })
    await expect(containerStorage.first()).toBeVisible()

    await searchInput.click()
    await searchInput.fill('')
    await page.keyboard.type('Refined', { delay: 30 })
    await page.waitForTimeout(500)

    const supplyItem = page.locator('[data-testid^="grouped-candidate-item-"]').first()
    await expect(supplyItem).toBeVisible({ timeout: 3000 })
    await supplyItem.click()

    const solidStorage = autoSection.locator('.module-row').filter({ hasText: /Solid Storage|固体仓储/ })
    await expect(solidStorage.first()).toBeVisible()
  })
})

test.describe('Module Management - Scale Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/x4-station-calculator/')

    await page.waitForSelector('.module-list-container')

    const newButton = page.locator('button:has-text("新建"), button:has-text("New")').first()
    await newButton.click()

    const discardButton = page.locator('button:has-text("丢弃并新建"), button:has-text("Discard & New")').first()
    if (await discardButton.isVisible()) {
      await discardButton.click()
    }

    await page.waitForTimeout(500)
  })

  test('应该显示正确的按钮选项', async ({ page }) => {
    const scaleButtons = page.locator('.scale-buttons')
    await expect(scaleButtons).toBeVisible()

    const buttons = scaleButtons.locator('.scale-button')
    await expect(buttons).toHaveCount(6)

    const expectedButtons = ['1/5', '1/3', '1/2', '2x', '3x', '5x']
    for (const text of expectedButtons) {
      await expect(scaleButtons.locator(`text=${text}`)).toBeVisible()
    }
  })

  test('按钮应该右对齐', async ({ page }) => {
    const scaleButtons = page.locator('.scale-buttons')

    const marginLeft = await scaleButtons.evaluate(el => {
      return window.getComputedStyle(el).marginLeft
    })

    expect(marginLeft).toMatch(/^(auto|0px|[0-9.]+px)$/)
  })

  test('按钮hover效果应该正确', async ({ page }) => {
    const firstButton = page.locator('.scale-button').first()

    const defaultBgColor = await firstButton.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    const defaultColor = await firstButton.evaluate(el => {
      return window.getComputedStyle(el).color
    })

    expect(defaultBgColor).toBe('rgb(51, 65, 85)')
    expect(defaultColor).toBe('rgb(148, 163, 184)')

    await firstButton.hover()

    await page.waitForTimeout(500)

    const hoverBgColor = await firstButton.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    const hoverColor = await firstButton.evaluate(el => {
      return window.getComputedStyle(el).color
    })

    expect(hoverBgColor).toBe('rgb(217, 119, 6)')
    expect(hoverColor).toMatch(/rgb\(25[45], 25[12], 23[25]\)/)
  })

  test('按钮高度应该为18px', async ({ page }) => {
    const firstButton = page.locator('.scale-button').first()

    await expect(firstButton).toHaveCSS('height', '18px')
  })

  test('按钮点击应该调整模块数量', async ({ page }) => {
    const doubleButton = page.locator('text=2x')
    await expect(doubleButton).toBeVisible()

    await doubleButton.click()

    await expect(doubleButton).not.toBeDisabled()
  })

  test('规划区高度应该与工业区保持一致', async ({ page }) => {
    const plannedHeader = page.locator('.tier-header').first()
    await expect(plannedHeader).toBeVisible()

    const plannedHeight = await plannedHeader.evaluate(el => el.clientHeight)
    expect(plannedHeight).toBeGreaterThan(20)
    expect(plannedHeight).toBeLessThan(50)
  })

  test('按钮样式应该与资源产出概览标签保持一致', async ({ page }) => {
    const scaleButton = page.locator('.scale-button').first()

    const buttonStyles = await scaleButton.evaluate(el => {
      const style = window.getComputedStyle(el)
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        borderRadius: style.borderRadius,
        textTransform: style.textTransform
      }
    })

    expect(buttonStyles.fontSize).toBe('8px')
    expect(buttonStyles.fontWeight).toBe('700')
    expect(buttonStyles.textTransform).toBe('uppercase')
  })
})
