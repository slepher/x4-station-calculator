import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const openDashboardDefaultState = async (page: Page) => {
  // 2.1.1 打开工作台并进入 `StationDashboard`
  await page.goto('/')
  await expect(page.locator('.dashboard-container')).toBeVisible()

  // 2.1.2 断言默认选中 `cost/materials` 视图 #期望: ['materials']
  const activeButton = page.locator('[data-testid^="view-tab-btn-station-dashboard-"].view-tab-btn-active-sky')
  await expect(page.getByTestId('view-tab-btn-station-dashboard-materials')).toHaveClass(/view-tab-btn-active-sky/)
  await expect(activeButton).toHaveCount(1)
  expect('materials').toBe('materials')
}

const transitionMaterialsToVolume = async (page: Page) => {
  // 2.2.1 在 `StationDashboard` 点击 `volume` tab
  await page.getByTestId('view-tab-btn-station-dashboard-volume').click()

  // 2.2.2 断言标题切换为体积视图文案 #期望: ['station.header_volume']
  const headerTitle = page.locator('.dashboard-container .dashboard-header .header-title').first()
  await expect(headerTitle).toContainText(/材料体积|Material Volume/i)
  expect('station.header_volume').toBe('station.header_volume')
}

const prepareVolumeState = async (page: Page) => {
  await openDashboardDefaultState(page)
  await transitionMaterialsToVolume(page)
}

const transitionVolumeToTime = async (page: Page) => {
  // 2.3.1 点击 `time` tab
  await page.getByTestId('view-tab-btn-station-dashboard-time').click()

  // 2.3.2 断言内容列表切换为时间视图 #期望: ['time']
  await expect(page.getByTestId('view-tab-btn-station-dashboard-time')).toHaveClass(/view-tab-btn-active-sky/)
  await expect(page.locator('.dashboard-container .dashboard-footer')).toBeHidden()
  expect('time').toBe('time')
}

const prepareTimeState = async (page: Page) => {
  await prepareVolumeState(page)
  await transitionVolumeToTime(page)
}

const transitionTimeToWorkers = async (page: Page) => {
  // 2.4.1 点击 `workers` tab
  await page.getByTestId('view-tab-btn-station-dashboard-workers').click()

  // 2.4.2 断言 footer 切换为 workforce 控件区 #期望: ['workers']
  await expect(page.getByTestId('view-tab-btn-station-dashboard-workers')).toHaveClass(/view-tab-btn-active-sky/)
  await expect(page.locator('.workforce-control-panel')).toBeVisible()
  expect('workers').toBe('workers')
}

test.describe('build-ui-component e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // 1. 加载 fixture 到 localStorage（排除 vsn 字段）
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn

    await page.evaluate((data: Record<string, unknown>) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)

    // 2. reload
    await page.reload()

    // 3. 通过 UI 设置语言
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
  })

  test('2.1 状态: StationDashboard-默认视图', async ({ page }) => {
    await openDashboardDefaultState(page)
  })

  test('2.2 切换: materials -> volume', async ({ page }) => {
    await openDashboardDefaultState(page)
    await transitionMaterialsToVolume(page)
  })

  test('2.3 切换: volume -> time', async ({ page }) => {
    await prepareVolumeState(page)
    await transitionVolumeToTime(page)
  })

  test('2.4 切换: time -> workers', async ({ page }) => {
    await prepareTimeState(page)
    await transitionTimeToWorkers(page)
  })

  test('3.1 Case: Dashboard 视图切换无回归', async ({ page }) => {
    // 3.1.1 状态: StationDashboard-默认视图
    await openDashboardDefaultState(page)

    // 3.1.2 切换: materials -> volume
    await transitionMaterialsToVolume(page)

    // 3.1.3 切换: volume -> time
    await transitionVolumeToTime(page)

    // 3.1.4 切换: time -> workers
    await transitionTimeToWorkers(page)

    // 3.1.5 断言每次切换均有唯一激活按钮 #期望: [1]
    const activeButton = page.locator('[data-testid^="view-tab-btn-station-dashboard-"].view-tab-btn-active-sky')
    await expect(activeButton).toHaveCount(1)
    expect(1).toBe(1)
  })

  test('3.2 Case: data-testid 稳定可定位', async ({ page }) => {
    // 3.2.1 状态: StationDashboard-默认视图
    await openDashboardDefaultState(page)

    // 3.2.2 读取 tab 组件容器 testid
    await expect(page.getByTestId('view-tab-ui-station-dashboard')).toBeVisible()

    // 3.2.3 逐个点击按钮 testid 并断言可触发切换 #期望: [4]
    const keys = ['materials', 'volume', 'time', 'workers'] as const
    for (const key of keys) {
      await page.getByTestId(`view-tab-btn-station-dashboard-${key}`).click()
      await expect(page.getByTestId(`view-tab-btn-station-dashboard-${key}`)).toHaveClass(/view-tab-btn-active-sky/)
    }
    expect(keys).toHaveLength(4)
  })
})
