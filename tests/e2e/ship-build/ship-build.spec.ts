import { test, expect } from '@playwright/test'

test.describe('Ship Build View', () => {
  const shipBuildButton = (page: any) => page.getByRole('button', { name: /Ship Build|船只建造/ })
  const productionButton = (page: any) => page.getByRole('button', { name: /Quantified|量化生产/ })

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

  test('状态：船只建造视图', async ({ page }) => {
    await shipBuildButton(page).click()
    await expect(page.getByTestId('ship-build-filters')).toBeVisible()
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)

    const newBtn = page.getByRole('button', { name: /New|新建/ })
    const saveBtn = page.getByRole('button', { name: /^Save$|^保存$/ })
    const loadBtn = page.getByRole('button', { name: /Load|加载/ })
    await expect(newBtn).toHaveClass(/btn-emerald/)
    await expect(saveBtn).toHaveClass(/btn-green/)
    await expect(loadBtn).toHaveClass(/btn-emerald/)
  })

  test('切换：量化生产->船只建造', async ({ page }) => {
    await productionButton(page).click()
    await shipBuildButton(page).click()
    await expect(page.getByTestId('ship-build-filters')).toBeVisible()
  })

  test('场景：未选择 class 不显示列表', async ({ page }) => {
    await shipBuildButton(page).click()
    await expect(page.getByTestId('ship-build-list-empty')).toBeVisible()
  })

  test('场景：未选择 race/type 不显示列表', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    await expect(page.getByTestId('ship-build-list-empty')).toBeVisible()
  })

  test('场景：选择 class + race 显示列表', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.getByRole('button', { name: /terran/i }).click()

    const listItems = page.locator('.list-item')
    await expect(listItems.first()).toBeVisible()
  })

  test('场景：选择 class + type 显示列表', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    const listItems = page.locator('.list-item')
    await expect(listItems.first()).toBeVisible()
  })

  test('场景：race + type 同时选择取交集', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.getByRole('button', { name: /terran/i }).click()
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    const listItems = page.locator('.list-item')
    const count = await listItems.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i += 1) {
      const text = await listItems.nth(i).innerText()
      expect(text).toContain('terran')
      expect(text.toLowerCase()).not.toContain('teladi')
    }
  })

  test('场景：type 选项随 class 联动', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'S' }).click()
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await expect(typeFilter.getByRole('button', { name: /Destroyer/i })).toHaveCount(0)
  })

  test('场景：飞船名称本地化展示', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.getByRole('button', { name: /terran/i }).click()

    const shipName = page.getByTestId('ship-build-ship-name').first()
    await expect(shipName).toBeVisible()
    await expect(shipName).not.toHaveText('')
  })

  test('场景：race 标签显示计数', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const typeFilter = page.getByTestId('ship-build-filter-type')
    await typeFilter.locator('button').first().click()

    const raceButton = page.getByTestId('ship-build-filter-race').locator('button').first()
    await expect(raceButton).toContainText(/\(\d+\)/)
  })

  test('场景：type 标签显示计数', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const typeButton = page.getByTestId('ship-build-filter-type').locator('button').first()
    await expect(typeButton).toContainText(/\(\d+\)/)
  })

  test('场景：筛选与结果 4:6 布局', async ({ page }) => {
    await shipBuildButton(page).click()
    const panelBody = page.getByTestId('ship-build-filters').locator('.panel-body')
    const filterCol = panelBody.locator(':scope > div').first()
    const resultCol = panelBody.locator(':scope > div').nth(1)

    const filterBox = await filterCol.boundingBox()
    const resultBox = await resultCol.boundingBox()
    expect(filterBox).not.toBeNull()
    expect(resultBox).not.toBeNull()
    if (filterBox && resultBox) {
      const ratio = filterBox.width / (filterBox.width + resultBox.width)
      expect(ratio).toBeGreaterThan(0.34)
      expect(ratio).toBeLessThan(0.46)
    }
  })

  test('场景：结果区 3 列固定宽度', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const items = page.locator('.list-item')
    await expect(items.first()).toBeVisible()
    const count = await items.count()
    if (count >= 3) {
      const box1 = await items.nth(0).boundingBox()
      const box2 = await items.nth(1).boundingBox()
      const box3 = await items.nth(2).boundingBox()
      expect(box1 && box2 && box3).toBeTruthy()
      if (box1 && box2 && box3) {
        expect(Math.abs(box1.width - box2.width)).toBeLessThan(6)
        expect(Math.abs(box2.width - box3.width)).toBeLessThan(6)
        expect(box1.height).toBeLessThan(100)
      }
    }
  })

  test('场景：列表单选与选择展示', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const items = page.locator('.list-item')
    const firstItem = items.first()
    const firstName = await firstItem.locator('[data-testid=\"ship-build-ship-name\"]').innerText()
    await firstItem.click()
    const selection = page.locator('.selection-expanded')
    await expect(selection).toBeVisible()
    await expect(selection).toContainText(firstName)
  })

  test('场景：选择区切换与更换', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()

    const items = page.locator('.list-item')
    await items.first().click()

    await expect(page.locator('.selection-expanded')).toBeVisible()
    await expect(page.getByTestId('ship-build-list')).toHaveCount(0)

    await page.getByRole('button', { name: /Change Ship|更换飞船/ }).click()
    await expect(page.getByTestId('ship-build-list')).toBeVisible()
  })

  test('场景：下方三列显示规则', async ({ page }) => {
    await shipBuildButton(page).click()
    await expect(page.getByTestId('ship-build-panels')).toHaveCount(0)

    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()
    await page.locator('.list-item').first().click()

    await expect(page.getByTestId('ship-build-panels')).toBeVisible()
  })

  test('场景：已选详情高度自适应', async ({ page }) => {
    await shipBuildButton(page).click()
    const classFilter = page.getByTestId('ship-build-filter-class')
    await classFilter.getByRole('button', { name: 'M' }).click()
    const raceFilter = page.getByTestId('ship-build-filter-race')
    await raceFilter.locator('button').first().click()
    await page.locator('.list-item').first().click()

    const selection = page.locator('.selection-expanded')
    await expect(selection).toBeVisible()
    const style = await selection.getAttribute('style')
    expect(style || '').not.toContain('72px')
  })
})
