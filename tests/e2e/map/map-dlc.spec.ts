import { test, expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'
import type { Locator } from '@playwright/test'

// Helper functions for Chapter 2 states and transitions

async function openSettingsModal(page: Page) {
  // 2.x.x 点击右上角设置按钮打开设置面板（直接打开DLC设置模态框）
  await page.getByTestId('settings-button').click()
}

async function closeSettingsModalWithConfirm(page: Page) {
  // 2.x.x 点击保存按钮关闭设置模态框
  await page.getByTestId('dlc-settings-save').click()
  // 等待地图重新渲染
  await page.waitForTimeout(500)
}

async function closeSettingsModalWithoutSave(page: Page) {
  // 2.x.x 点击关闭按钮关闭设置模态框
  await page.getByTestId('dlc-settings-close').click()
  // 等待地图重新渲染
  await page.waitForTimeout(500)
}

async function loadDbFixture(page: Page) {
  await page.goto('/')
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
}

async function openLiveMapSavePanel(page: Page) {
  await loadLiveBindingFixture(page, {
    transformSaves: (saves) => saves.filter((save) => save.meta.filename === 'save_009'),
    initialArchiveId: 'B41B8D56-C58D-4F66-8EAA-6F85BC614214_1345095.294'
  })
  await page.getByTestId('top-view-btn-maps').click()
  await page.getByTestId('settings-button').click()
  const enforce = page.getByTestId('dlc-settings-enforce-toggle')
  if (!(await enforce.isChecked())) await enforce.click()
  const dlcCheckboxes = await page.locator('[data-testid^="dlc-settings-item-"]').all()
  for (const checkbox of dlcCheckboxes) {
    const testId = await checkbox.getAttribute('data-testid')
    const checked = await checkbox.isChecked()
    if (testId === 'dlc-settings-item-base' && !checked) await checkbox.click()
    if (testId !== 'dlc-settings-item-base' && checked) await checkbox.click()
  }
  await page.getByTestId('dlc-settings-save').click()
  await page.getByTestId('map-save-panel-tab').click()
  const panel = page.getByTestId('map-save-panel')
  await expect(panel).toBeVisible()
  return panel
}

async function openLivePlayerStations(page: Page) {
  const panel = await openLiveMapSavePanel(page)
  const currentArchive = panel.locator('.save-item').filter({ hasText: 'save_009' })
  await expect(currentArchive).toHaveCount(1)
  const poiButton = currentArchive.locator('[data-testid="save-time-poi"], [data-testid="save-time-poi-active"]')
  await expect(poiButton).toHaveCount(1)
  await poiButton.click()
  const playerStations = panel.locator('.category-item').filter({ hasText: /玩家空间站|Player stations/i })
  await expect(playerStations).toHaveCount(1)
  await playerStations.click()
  return panel
}

// 2.1 状态: 地图界面
async function buildMapInterface(page: Page) {
  // 2.1.1 在首页，点击 Sector Map 进入地图
  await page.goto('/')
  // 2.1.2 等待 gameData 加载完成
  await page.waitForFunction(() => {
    const win = window as any
    return win.gameDataStore?.isReady === true
  }, { timeout: 30000 })
  await page.getByRole('button', { name: /Sector Map|星区地图/ }).click()
  // 2.1.3 等待地图 SVG 渲染完成
  await page.waitForSelector('[data-testid="map-svg-canvas"]')
  // 2.1.4 检查地图视口可见且显示 cluster 多边形
  await expect(page.getByTestId('map-viewport')).toBeVisible()
  // 2.1.5 验证 cluster 多边形渲染完成且可见
  const clusters = await page.locator('polygon[data-cluster-id]').count()
  expect(clusters).toBeGreaterThan(0) // 期望:[cluster 多边形显示]
}

// 2.2 状态: 地图界面DLC限制关
async function buildMapInterfaceDlcOff(page: Page) {
  // 2.2.1 点击右上角设置按钮打开设置面板
  // 2.2.2 DLC 设置模态框直接打开
  await openSettingsModal(page)
  // 2.2.3 关闭 enforceDlcActivation 开关如已开启
  const toggle = page.getByTestId('dlc-settings-enforce-toggle')
  const isChecked = await toggle.isChecked()
  if (isChecked) {
    await toggle.click()
  }
  // 2.2.4 取消 Split DLC 激活以测试虚线边框
  const splitCheckbox = page.getByTestId('dlc-settings-item-ego_dlc_split')
  if (await splitCheckbox.isChecked()) {
    await splitCheckbox.click()
  }
  // 2.2.5 点击保存按钮关闭设置模态框
  await closeSettingsModalWithConfirm(page)
  // 2.2.6 验证未激活 DLC cluster 仍可见
  await expect(page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"]')).toHaveCount(1)
}

// 2.3 状态: 地图界面DLC限制开
async function buildMapInterfaceDlcOn(page: Page) {
  // 2.3.1-2.3.3 打开设置模态框并开启 enforceDlcActivation
  await openSettingsModal(page)
  const toggle = page.getByTestId('dlc-settings-enforce-toggle')
  const isChecked = await toggle.isChecked()
  if (!isChecked) {
    await toggle.click()
  }
  // 2.3.4 在 DLC 列表中仅勾选 base，取消勾选其他所有 DLC
  const dlcCheckboxes = await page.locator('[data-testid^="dlc-settings-item-"]').all()
  for (const checkbox of dlcCheckboxes) {
    const testId = await checkbox.getAttribute('data-testid')
    const isChecked = await checkbox.isChecked()
    if (testId === 'dlc-settings-item-base' && !isChecked) {
      await checkbox.click()
    } else if (testId !== 'dlc-settings-item-base' && isChecked) {
      await checkbox.click()
    }
  }
  // 2.3.5 点击保存按钮关闭设置模态框
  await closeSettingsModalWithConfirm(page)
  // 2.3.6 验证未激活 DLC cluster 与 sector 已消失
  await expect(page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"]')).toHaveCount(0)
  await expect(page.locator('polygon.sector-polygon[data-sector-id^="cluster_400"]')).toHaveCount(0)
}

// 2.4 切换: DLC限制关 -> DLC限制开
async function transitionDlcOffToOn(page: Page) {
  // 2.4.1 状态已处于地图界面DLC限制关
  // 2.4.2-2.4.4 打开设置并开启 enforceDlcActivation，仅保留 base DLC
  await openSettingsModal(page)
  const toggle = page.getByTestId('dlc-settings-enforce-toggle')
  await toggle.click()
  // 仅勾选 base，取消勾选其他所有 DLC
  const dlcCheckboxes = await page.locator('[data-testid^="dlc-settings-item-"]').all()
  for (const checkbox of dlcCheckboxes) {
    const testId = await checkbox.getAttribute('data-testid')
    const isChecked = await checkbox.isChecked()
    if (testId === 'dlc-settings-item-base' && !isChecked) {
      await checkbox.click()
    } else if (testId !== 'dlc-settings-item-base' && isChecked) {
      await checkbox.click()
    }
  }
  // 2.4.5 点击保存按钮关闭设置模态框
  await closeSettingsModalWithConfirm(page)
  // 2.4.6 验证未激活 DLC cluster 从地图中消失
  await page.waitForTimeout(500)
  const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"]')
  await expect(cluster408).toHaveCount(0) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形不存在]
}

// 2.5 切换: DLC限制开 -> DLC限制关
async function transitionDlcOnToOff(page: Page) {
  // 2.5.1 状态已处于地图界面DLC限制开
  // 2.5.2-2.5.4 打开设置并关闭 enforceDlcActivation
  await openSettingsModal(page)
  const toggle = page.getByTestId('dlc-settings-enforce-toggle')
  await toggle.click()
  // 2.5.3 取消 Split DLC 激活以测试虚线边框
  const splitCheckbox = page.getByTestId('dlc-settings-item-ego_dlc_split')
  if (await splitCheckbox.isChecked()) {
    await splitCheckbox.click()
  }
  // 2.5.5 点击保存按钮关闭设置模态框
  await closeSettingsModalWithConfirm(page)
  // 2.5.6 验证未激活 DLC cluster 在地图中显示且带虚线边框
  await page.waitForTimeout(500)
  const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"][stroke-dasharray="6,4"]')
  await expect(cluster408).toHaveCount(1) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]
}

// Chapter 2 tests
test.describe('2 E2E 标准状态与状态迁移', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  // 2.1 状态: 地图界面
  test('2.1 状态: 地图界面', async ({ page }) => {
    await buildMapInterface(page)
  })

  // 2.2 状态: 地图界面DLC限制关
  test('2.2 状态: 地图界面DLC限制关', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    await expect(page.locator('polygon.cluster-polygon[data-cluster-id]')).toHaveCount(21)
    await expect(page.locator('polygon.sector-polygon[data-sector-id]')).toHaveCount(152)
  })

  // 2.3 状态: 地图界面DLC限制开
  test('2.3 状态: 地图界面DLC限制开', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    await expect(page.locator('polygon.cluster-polygon[data-cluster-id]')).toHaveCount(12)
    await expect(page.locator('polygon.sector-polygon[data-sector-id]')).toHaveCount(76)
  })

  // 2.4 切换: DLC限制关 -> DLC限制开
  test('2.4 切换: DLC限制关 -> DLC限制开', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    await transitionDlcOffToOn(page)
  })

  // 2.5 切换: DLC限制开 -> DLC限制关
  test('2.5 切换: DLC限制开 -> DLC限制关', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    await transitionDlcOnToOff(page)
  })
})

// Chapter 3 tests
test.describe('3 E2E 测试场景', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  // 3.1 Case: enforceDlcActivation=false 时显示全部 cluster
  test('3.1 Case: enforceDlcActivation=false 时显示全部 cluster', async ({ page }) => {
    // 3.1.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.1.2-3.1.4 验证未激活 DLC cluster 存在且有虚线边框
    const cluster408Dashed = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"][stroke-dasharray="6,4"]')
    await expect(cluster408Dashed).toHaveCount(1) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]
    // 3.1.5 验证已激活 DLC cluster 无边框虚线
    const cluster01 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_01_macro"]')
    await expect(cluster01).toHaveCount(1) // 期望:[Cluster_01_macro cluster 多边形存在且无边框虚线]
    await expect(cluster01).not.toHaveAttribute('stroke-dasharray', '6,4')
    await expect(page.locator('polygon.sector-polygon[data-sector-id]')).toHaveCount(152)
  })

  // 3.2 Case: enforceDlcActivation=true 时过滤未激活 DLC cluster
  test('3.2 Case: enforceDlcActivation=true 时过滤未激活 DLC cluster', async ({ page }) => {
    // 3.2.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.2.2-3.2.4 验证未激活 DLC cluster 不存在
    const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"]')
    await expect(cluster408).toHaveCount(0) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形不存在]
    // 3.2.5 验证未激活 DLC sector 不存在 (Cluster_400 is single-sector, no cluster-polygon)
    const sector400 = page.locator('polygon.sector-polygon[data-sector-id^="cluster_400"]')
    await expect(sector400).toHaveCount(0) // 期望:[Cluster_400 sector 多边形不存在]
    await expect(page.locator('polygon.sector-polygon[data-sector-id]')).toHaveCount(76)
  })

  // 3.3 Case: 星门连接到被过滤 cluster 时保持显示
  test('3.3 Case: 星门连接到被过滤 cluster 时保持显示', async ({ page }) => {
    // 3.3.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.3.2-3.3.3 验证星门路径存在
    const gatePath = page.locator('line.gate-path[data-gate-line-id="cluster_15_macro:cluster_15_sector002_macro:connection_clustergate015to408<->cluster_408_macro:cluster_408_sector001_macro:connection_clustergate408to015"]')
    await expect(gatePath).toHaveCount(1)
    await expect(gatePath).toHaveAttribute('stroke', '#e5e7eb')
    await expect(gatePath).not.toHaveAttribute('stroke-dasharray')
  })

  // 3.4 Case: 位于未激活 DLC cluster 的空间站地址标红
  test('3.4 Case: 位于未激活 DLC cluster 的空间站地址标红', async ({ page }) => {
    const panel = await openLivePlayerStations(page)
    const inactive = panel.locator('.poi-item').filter({ hasText: 'UFM-908' })
    await expect(inactive).toHaveCount(1)
    const inactiveGroup = panel.locator('.poi-group').filter({ hasText: 'UFM-908' })
    const inactiveHeader = inactiveGroup.locator(':scope > .group-header')
    await expect(inactiveHeader).toBeVisible()
    await expect(inactiveHeader).toHaveCSS('color', 'rgb(239, 68, 68)')
  })

  // 3.5 Case: 位于已激活 DLC cluster 的空间站地址正常显示
  test('3.5 Case: 位于已激活 DLC cluster 的空间站地址正常显示', async ({ page }) => {
    const panel = await openLivePlayerStations(page)
    const active = panel.locator('.poi-item').filter({ hasText: 'CEM-776' })
    await expect(active).toHaveCount(1)
    const activeGroup = panel.locator('.poi-group').filter({ hasText: 'CEM-776' })
    const activeHeader = activeGroup.locator(':scope > .group-header')
    await expect(activeHeader).toBeVisible()
    await expect(activeHeader).not.toHaveCSS('color', 'rgb(239, 68, 68)')
  })

  // 3.6 Case: enforceDlcActivation=false 时资源统计包含全部 sector
  test('3.6 Case: enforceDlcActivation=false 时资源统计包含全部 sector', async ({ page }) => {
    // 3.6.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.6.2-3.6.3 打开资源筛选面板并选择 Ore
    await page.getByTestId('map-resource-panel-tab').click()
    await page.waitForTimeout(300)
    await page.getByTestId('map-resource-tag-ore').click()
    // 3.6.4-3.6.6 验证资源筛选面板显示结果
    const resultList = page.getByTestId('map-resource-simple-candidate-list')
    await expect(resultList).toBeVisible()
    await expect(page.locator('.simple-panel .candidate-count')).toHaveText('90')
  })

  // 3.7 Case: enforceDlcActivation=true 时资源统计过滤未激活 DLC sector
  test('3.7 Case: enforceDlcActivation=true 时资源统计过滤未激活 DLC sector', async ({ page }) => {
    // 3.7.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.7.2-3.7.3 打开资源筛选面板并选择 Ore
    await page.getByTestId('map-resource-panel-tab').click()
    await page.waitForTimeout(300)
    await page.getByTestId('map-resource-tag-ore').click()
    // 3.7.4-3.7.6 验证资源筛选面板显示结果
    const resultList = page.getByTestId('map-resource-simple-candidate-list')
    await expect(resultList).toBeVisible()
    await expect(page.locator('.simple-panel .candidate-count')).toHaveText('53')
    await expect(page.locator('[data-testid^="map-resource-candidate-cluster_401_"]')).toHaveCount(0)
  })

  // 3.8 Case: 过滤后剩余 cluster 位置保持稳定
  test('3.8 Case: 过滤后剩余 cluster 位置保持稳定', async ({ page }) => {
    // 3.8.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.8.2-3.8.3 记录 cluster 位置（使用 cluster-polygon 外边框）
    const cluster01 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_01_macro"]')
    await expect(cluster01).toHaveCount(1)
    const points1 = await cluster01.getAttribute('points')
    // 3.8.4 切换: DLC限制关 -> DLC限制开
    await transitionDlcOffToOn(page)
    // 3.8.5-3.8.6 验证位置保持不变
    const points2 = await cluster01.getAttribute('points')
    expect(points2).toBe(points1) // 期望:[cluster 位置保持不变]
  })

  // 3.9 Case: DLC 设置变化后地图同步刷新
  test('3.9 Case: DLC 设置变化后地图同步刷新', async ({ page }) => {
    // 3.9.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.9.2 记录 cluster 数量 N1
    const n1 = await page.locator('polygon[data-cluster-id]').count()
    expect(n1).toBe(325)
    // 3.9.3-3.9.4 切换并记录 N2
    await transitionDlcOffToOn(page)
    const n2 = await page.locator('polygon[data-cluster-id]').count()
    expect(n2).toBe(164)
    // 3.9.5 验证 N2 < N1
    expect(n2).toBeLessThan(n1) // 期望:[cluster 多边形数量 N2 小于 N1]
    // 3.9.6-3.9.7 切换回并记录 N3
    await transitionDlcOnToOff(page)
    const n3 = await page.locator('polygon[data-cluster-id]').count()
    // 3.9.8 验证 N3 等于 N1
    expect(n3).toBe(325) // 期望:[固定 polygon 集合恢复为 325]
  })

  // 3.10 Case: 多 sector cluster 边距显示正常
  test('3.10 Case: 多 sector cluster 边距显示正常', async ({ page }) => {
    // 3.10.1 状态: 地图界面
    await buildMapInterface(page)
    // 3.10.2-3.10.3 验证多 sector cluster sector 数量
    const sectors = page.locator('polygon.sector-polygon[data-cluster-id="cluster_01_macro"]')
    await expect(sectors).toHaveCount(3)
    const geometry = await sectors.evaluateAll((nodes) => nodes.map((node) => {
      const box = (node as SVGGraphicsElement).getBBox()
      const points = Array.from((node as SVGPolygonElement).points).map((point) => ({ x: point.x, y: point.y }))
      return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, points }
    }))
    expect(geometry.every(({ box }) => box.width > 0 && box.height > 0)).toBe(true)
    for (let i = 0; i < geometry.length; i += 1) {
      for (let j = i + 1; j < geometry.length; j += 1) {
        const a = geometry[i]!.points
        const b = geometry[j]!.points
        const edgeAxes = (points: typeof a) => points.map((point, index) => {
          const next = points[(index + 1) % points.length]!
          return { x: next.y - point.y, y: point.x - next.x }
        })
        const axes = [...edgeAxes(a), ...edgeAxes(b)]
        const separated = axes.some((axis) => {
          const project = (points: typeof a) => points.map((point) => point.x * axis.x + point.y * axis.y)
          const pa = project(a)
          const pb = project(b)
          return Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)
        })
        expect(separated).toBe(true)
      }
    }
    // 3.10.4-3.10.5 验证单 sector cluster
    const singleSector = page.locator('polygon.sector-polygon[data-cluster-id="cluster_04_macro"]').first()
    await expect(page.locator('polygon.sector-polygon[data-cluster-id="cluster_04_macro"]')).toHaveCount(2)
    const singleBox = await singleSector.evaluate((node) => {
      const box = (node as SVGGraphicsElement).getBBox()
      return { width: box.width, height: box.height }
    })
    expect(singleBox.width).toBeGreaterThan(0)
    expect(singleBox.height).toBeGreaterThan(0)
    const singleCluster = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_04_macro"]')
    await expect(singleCluster).toHaveCount(1)
    const clusterBox = await singleCluster.evaluate((node) => {
      const box = (node as SVGGraphicsElement).getBBox()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    const sectorBox = await singleSector.evaluate((node) => {
      const box = (node as SVGGraphicsElement).getBBox()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    expect(clusterBox.x).toBeLessThanOrEqual(sectorBox.x)
    expect(clusterBox.y).toBeLessThanOrEqual(sectorBox.y)
    expect(clusterBox.x + clusterBox.width).toBeGreaterThanOrEqual(sectorBox.x + sectorBox.width)
    expect(clusterBox.y + clusterBox.height).toBeGreaterThanOrEqual(sectorBox.y + sectorBox.height)
  })

  // 3.11 Case: 虚线边框样式对齐
  test('3.11 Case: 虚线边框样式对齐', async ({ page }) => {
    // 3.11.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.11.2-3.11.3 验证虚线边框样式对齐
    const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="cluster_408_macro"]')
    const clusterDash = await cluster408.getAttribute('stroke-dasharray')
    expect(clusterDash).toBe('6,4')
    // 期望:[Cluster_408_macro (Split DLC) 虚线模式为 "6,4"]
  })

  // 3.12 Case: 空间站搜索功能在 DLC 过滤下正常
  test('3.12 Case: 空间站搜索功能在 DLC 过滤下正常', async ({ page }) => {
    const panel = await openLivePlayerStations(page)
    const search = panel.locator('.poi-search-control input.search-input')
    await expect(search).toHaveCount(1)
    await search.fill('energy cells')
    const suggestion = panel.locator('.poi-search-control .suggestion-item').first()
    await expect(suggestion).toBeVisible()
    await expect(suggestion).toHaveText(/Energy Cells|能量电池/i)
    await suggestion.click()
    const selectedFacet = panel.locator('.poi-search-control .search-tag .tag-label')
    await expect(selectedFacet).toHaveCount(1)
    await expect(selectedFacet).toHaveText(/Energy Cells|能量电池/i)
    await expect(panel.locator('.poi-item').filter({ hasText: 'CEM-776' })).toHaveCount(1)
    await expect(panel.locator('.poi-item').filter({ hasText: 'UFM-908' })).toHaveCount(0)
  })

  // 3.13 Case: i18n 语言切换后地图正常显示
  test('3.13 Case: i18n 语言切换后地图正常显示', async ({ page }) => {
    // 3.13.1 状态: 地图界面
    await buildMapInterface(page)
    // 3.13.2-3.13.3 切换为中文并验证
    await page.getByTestId('language-select').selectOption('zh-CN')
    await page.waitForTimeout(500)
    // 验证地图仍然可见
    await expect(page.getByTestId('map-viewport')).toBeVisible()
    // 期望:[地图在中文环境下正常显示]
    // 3.13.4-3.13.5 切换为英文并验证
    await page.getByTestId('language-select').selectOption('en')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('map-viewport')).toBeVisible()
    // 期望:[地图在英文环境下正常显示]
  })

  // 3.14 Case: 星区搜索功能在 DLC 过滤下正常
  test('3.14 Case: 星区搜索功能在 DLC 过滤下正常', async ({ page }) => {
    // 3.14.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.14.2-3.14.3 验证搜索框可用
    await expect(page.getByTestId('map-sector-search-input')).toBeVisible()
    // 3.14.4-3.14.5 搜索已激活 DLC sector
    await page.getByTestId('map-sector-search-input').fill('Grand Exchange I')
    const results = page.getByTestId('map-sector-search-popover')
    await expect(results).toBeVisible()
    await expect(results.locator('[data-testid^="map-sector-search-result-"]')).toHaveCount(3)
    await expect(results.locator('[data-testid="map-sector-search-result-cluster_01_sector001_macro"]')).toHaveCount(1)
    await expect(results.locator('[data-testid="map-sector-search-result-cluster_01_sector002_macro"]')).toHaveCount(1)
    await expect(results.locator('[data-testid="map-sector-search-result-cluster_01_sector003_macro"]')).toHaveCount(1)
    await expect(results.locator('[data-testid^="map-sector-search-result-cluster_400_"]')).toHaveCount(0)
  })

  // 3.15 Case: 切换 DLC 限制后资源筛选同步更新
  test('3.15 Case: 切换 DLC 限制后资源筛选同步更新', async ({ page }) => {
    // 3.15.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.15.2-3.15.3 打开资源筛选
    await page.getByTestId('map-resource-panel-tab').click()
    await page.waitForTimeout(300)
    await expect(page.getByTestId('map-resource-simple-candidate-list')).toBeVisible()
    await expect(page.locator('.simple-panel .candidate-count')).toHaveText('152')
    await page.getByTestId('map-resource-tag-ore').click()
    await expect(page.locator('.simple-panel .candidate-count')).toHaveText('90')
    // 3.15.7-3.15.9 切换回并验证面板仍然可见
    await transitionDlcOffToOn(page)
    await expect(page.getByTestId('map-resource-simple-candidate-list')).toBeVisible()
    await expect(page.locator('.simple-panel .candidate-count')).toHaveText('53')
    await expect(page.locator('[data-testid^="map-resource-candidate-cluster_401_"]')).toHaveCount(0)
  })
})
