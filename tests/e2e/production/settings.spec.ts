import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'

async function setupStation(page: Page) {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default))
  delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByTestId('sidebar-add-station').click()
  await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
}

async function addModule(page: Page, id: string) {
  await page.getByTestId('candidate-search-input').fill(id)
  await page.getByTestId('grouped-candidate-item-' + id).click()
}

async function saveNewEmpire(page: Page, name: string) {
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await expect(dialog).toBeVisible()
  await dialog.locator('.dialog-input').fill(name)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function savedStation(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('x4_empire_data_v9')
    if (!raw) throw new Error('No saved empire state')
    const state = JSON.parse(raw)
    const empire = state.list.find((item: { id: string }) => item.id === state.activeId)
    if (!empire || empire.stations.length !== 1) throw new Error('Expected one active saved station')
    return empire.stations[0]
  })
}

async function setHours(page: Page, label: string, hours: number) {
  const slider = page.locator('.slider-container').filter({ has: page.getByText(label, { exact: true }) }).locator('input[type="range"]')
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < hours; i++) await slider.press('ArrowRight')
  await expect(slider).toHaveValue(String(hours))
}

const energyFlow = (page: Page) => page.locator('[data-testid="flow-wrapper"][data-resource-id="energycells"]')
const energyStar = (page: Page) => energyFlow(page).locator('.favorite-btn')
const volumeEnergy = (page: Page) => page.locator('.allocation-view .flow-wrapper').filter({ has: page.locator('.header-name[title="能量电池"]') })
const slider = (page: Page, label: string) => page.locator('.slider-container').filter({ has: page.getByText(label, { exact: true }) }).locator('input[type="range"]')

async function quantity(page: Page) {
  await page.getByTestId('view-tab-btn-station-wareflow-quantity').click()
  await expect(energyStar(page)).toBeVisible()
}

async function volume(page: Page) {
  await page.getByTestId('view-tab-btn-station-wareflow-volume').click()
  await expect(page.locator('.volume-controls-section input[type="range"]')).toHaveCount(3)
}

async function readPriority(page: Page) {
  return page.evaluate(() => (window as any).blueprintStore.activeEmpire.stations[0].warePriority)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await setupStation(page)
  await addModule(page, 'module_gen_prod_energycells_01')
  await quantity(page)
})

test.describe('StationSettings Interface', () => {
  test('1.1 StationSettings 接口更新验证 - 主副产物缓冲时间字段存在', async ({ page }) => {
    await volume(page)
    await expect(slider(page, '资源缓冲时间')).toHaveValue('1')
    await expect(slider(page, '主产物缓冲时间')).toHaveValue('12')
    await expect(slider(page, '副产物缓冲时间')).toHaveValue('2')
  })
})

test.describe('WarePriority Initialization', () => {
  test('1.2 warePriority 状态初始化 - 默认值为空对象', async ({ page }) => {
    expect(await readPriority(page)).toEqual({})
    await expect(energyStar(page)).toHaveClass(/level-2/)
  })
})

test.describe('WarePriority Persistence', () => {
  test('1.3 saveLayout 持久化 warePriority 逻辑', async ({ page }) => {
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-1/)
    await saveNewEmpire(page, 'Priority Save')
    expect((await savedStation(page)).warePriority).toEqual({ energycells: 1 })
  })

  test('1.4 loadLayout 加载 warePriority 逻辑', async ({ page }) => {
    await energyStar(page).click()
    await saveNewEmpire(page, 'Priority Load')
    const stationId = (await savedStation(page)).id
    await page.getByTestId('toolbar-new-btn').click()
    await expect(page.getByTestId('sidebar-station')).not.toHaveAttribute('data-station-id', stationId)
    await page.getByTestId('toolbar-load-btn').click()
    const dialog = page.getByTestId('dialog-backdrop')
    await expect(dialog).toContainText('Priority Load')
    await dialog.getByTestId('load-empire-btn').click()
    await expect(page.getByTestId('sidebar-station')).toHaveAttribute('data-station-id', stationId)
    await page.getByTestId('sidebar-station').click()
    await quantity(page)
    await expect(energyStar(page)).toHaveClass(/level-1/)
    expect(await readPriority(page)).toEqual({ energycells: 1 })
  })

  test('2.2 优先级状态持久化测试', async ({ page }) => {
    await energyStar(page).click()
    await saveNewEmpire(page, 'Priority Reload')
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await quantity(page)
    await expect(energyStar(page)).toHaveClass(/level-1/)
    expect(await readPriority(page)).toEqual({ energycells: 1 })
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-2/)
  })
})

test.describe('FavoriteButton Component', () => {
  test('1.1 FavoriteButton 三态图标渲染测试', async ({ page }) => {
    await addModule(page, 'module_gen_prod_hullparts_01')
    const oreStar = page.locator('[data-testid="flow-wrapper"][data-resource-id="ore"] .favorite-btn')
    await expect(oreStar).toHaveClass(/level-0/)
    await expect(oreStar.locator('svg')).toHaveAttribute('fill', 'none')
    await expect(energyStar(page)).toHaveClass(/level-2/)
    await expect(energyStar(page).locator('svg')).toHaveAttribute('fill', 'currentColor')
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-1/)
    await expect(energyStar(page).locator('linearGradient')).toHaveCount(1)
  })

  test('1.2 FavoriteButton 状态切换测试', async ({ page }) => {
    await expect(energyStar(page)).toHaveClass(/level-2/)
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-1/)
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-2/)
  })

  test('1.3 不同视图模式下 FavoriteButton 可用性测试', async ({ page }) => {
    await expect(energyStar(page)).toHaveCount(1)
    await energyStar(page).click()
    await expect(energyStar(page)).toHaveClass(/level-1/)
    await volume(page)
    await expect(volumeEnergy(page).locator('.favorite-btn')).toHaveCount(1)
    await expect(volumeEnergy(page).locator('.favorite-btn')).toHaveClass(/level-1/)
    await volumeEnergy(page).locator('.favorite-btn').click()
    await expect(volumeEnergy(page).locator('.favorite-btn')).toHaveClass(/level-2/)
    await page.getByTestId('view-tab-btn-station-wareflow-economy').click()
    await expect(energyStar(page)).toHaveCount(1)
    await expect(energyStar(page)).toHaveClass(/level-2/)
  })
})

test.describe('Priority Logic', () => {
  test('2.1 产物身份检测 - 规划区产物', async ({ page }) => {
    await addModule(page, 'module_gen_prod_hullparts_01')
    const hullStar = page.locator('[data-testid="flow-wrapper"][data-resource-id="hullparts"] .favorite-btn')
    const grapheneStar = page.locator('[data-testid="flow-wrapper"][data-resource-id="graphene"] .favorite-btn')
    await expect(hullStar).toHaveClass(/level-2/)
    await expect(grapheneStar).toHaveClass(/level-0/)
    await hullStar.click()
    await expect(hullStar).toHaveClass(/level-1/)
    await grapheneStar.click()
    await expect(grapheneStar).toHaveClass(/level-1/)
    await grapheneStar.click()
    await expect(grapheneStar).toHaveClass(/level-0/)
  })
})

test.describe('Buffer Time Sliders', () => {
  test('5.1 主产物缓冲时间滑块功能', async ({ page }) => {
    await volume(page)
    await expect(slider(page, '主产物缓冲时间')).toHaveAttribute('min', '0')
    await expect(slider(page, '主产物缓冲时间')).toHaveAttribute('max', '24')
    await setHours(page, '主产物缓冲时间', 8)
    await expect(volumeEnergy(page).locator('.recommended-count')).toHaveText('84,000')
    await saveNewEmpire(page, 'Primary Buffer')
    expect((await savedStation(page)).settings.primaryProductBufferHours).toBe(8)
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await volume(page)
    await expect(slider(page, '主产物缓冲时间')).toHaveValue('8')
  })

  test('5.2 副产物缓冲时间滑块功能', async ({ page }) => {
    await energyStar(page).click()
    await volume(page)
    await expect(slider(page, '副产物缓冲时间')).toHaveAttribute('min', '0')
    await expect(slider(page, '副产物缓冲时间')).toHaveAttribute('max', '24')
    await setHours(page, '副产物缓冲时间', 4)
    await expect(volumeEnergy(page).locator('.recommended-count')).toHaveText('42,000')
    await saveNewEmpire(page, 'Secondary Buffer')
    expect((await savedStation(page)).settings.secondaryProductBufferHours).toBe(4)
    await page.reload()
    await page.getByTestId('sidebar-station').click()
    await volume(page)
    await expect(slider(page, '副产物缓冲时间')).toHaveValue('4')
    await expect(volumeEnergy(page).locator('.favorite-btn')).toHaveClass(/level-1/)
  })

  test('5.3 i18n 国际化键值 - 缓冲设置标签文本', async ({ page }) => {
    await volume(page)
    await expect(page.locator('.volume-controls-section .slider-label')).toHaveText(['资源缓冲时间', '主产物缓冲时间', '副产物缓冲时间'])
    await page.getByTestId('language-select').selectOption('en')
    await expect(page.locator('.volume-controls-section .slider-label')).toHaveText(['Resource Buffer Hours', 'Primary Product Buffer Hours', 'Secondary Product Buffer Hours'])
  })

  test('5.4 缓冲时间滑块影响体积计算', async ({ page }) => {
    await volume(page)
    // 10,500 cells per hour × 1m³ per cell; no resource consumption or workforce bonus.
    await expect(volumeEnergy(page).locator('.recommended-count')).toHaveText('126,000')
    await setHours(page, '主产物缓冲时间', 20)
    await expect(volumeEnergy(page).locator('.recommended-count')).toHaveText('210,000')
    await setHours(page, '主产物缓冲时间', 0)
    await expect(volumeEnergy(page).locator('.recommended-count')).toHaveText('0')
  })
})
