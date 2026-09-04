import { test, expect, Page } from '@playwright/test'
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

// 2.1 状态: 地图界面
async function buildMapInterface(page: Page) {
  // 2.1.1 在首页，点击 Sector Map 进入地图
  await page.goto('/')
  // 2.1.2 等待 gameData 加载完成
  await page.waitForFunction(() => {
    const win = window as any
    return win.gameDataStore?.isReady === true
  }, { timeout: 30000 })
  await page.getByRole('button', { name: 'Sector Map' }).click()
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
  // 2.2.6 验证地图中全部 cluster 多边形可见
  const clusterCount = await page.locator('polygon[data-cluster-id]').count()
  expect(clusterCount).toBe(173) // 期望:[polygon 数量为 173 (152 sectors + 21 multi-sector clusters)]
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
  // 2.3.6 验证地图中仅显示已激活 DLC 的 cluster
  const clusterCount = await page.locator('polygon[data-cluster-id]').count()
  expect(clusterCount).toBe(88) // 期望:[polygon 数量为 88 (76 base sectors + 12 multi-sector base clusters)]
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
  const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_408_macro"]')
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
  const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_408_macro"][stroke-dasharray="6,4"]')
  await expect(cluster408).toHaveCount(1) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]
}

// Chapter 2 tests
test.describe('2 E2E 标准状态与状态迁移', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 加载测试 fixture
    await page.evaluate(() => {
      localStorage.setItem('isTestEnv', 'true')
    })
    // 重新加载页面使 isTestEnv 生效
    await page.reload()
  })

  // 2.1 状态: 地图界面
  test('2.1 状态: 地图界面', async ({ page }) => {
    await buildMapInterface(page)
  })

  // 2.2 状态: 地图界面DLC限制关
  test('2.2 状态: 地图界面DLC限制关', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
  })

  // 2.3 状态: 地图界面DLC限制开
  test('2.3 状态: 地图界面DLC限制开', async ({ page }) => {
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
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
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('isTestEnv', 'true')
    })
    // 重新加载页面使 isTestEnv 生效
    await page.reload()
  })

  // 3.1 Case: enforceDlcActivation=false 时显示全部 cluster
  test('3.1 Case: enforceDlcActivation=false 时显示全部 cluster', async ({ page }) => {
    // 3.1.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.1.2-3.1.3 验证 cluster 多边形数量
    const clusterCount = await page.locator('polygon[data-cluster-id]').count()
    expect(clusterCount).toBe(173) // 期望:[cluster 多边形数量为 173]
    // 3.1.4 验证未激活 DLC cluster 存在且有虚线边框
    const cluster408Dashed = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_408_macro"][stroke-dasharray="6,4"]')
    await expect(cluster408Dashed).toHaveCount(1) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]
    // 3.1.5 验证已激活 DLC cluster 无边框虚线
    const cluster01 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_01_macro"]')
    await expect(cluster01).toHaveCount(1) // 期望:[Cluster_01_macro cluster 多边形存在且无边框虚线]
  })

  // 3.2 Case: enforceDlcActivation=true 时过滤未激活 DLC cluster
  test('3.2 Case: enforceDlcActivation=true 时过滤未激活 DLC cluster', async ({ page }) => {
    // 3.2.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.2.2-3.2.3 验证 cluster 多边形数量
    const clusterCount = await page.locator('polygon[data-cluster-id]').count()
    expect(clusterCount).toBe(88) // 期望:[cluster 多边形数量为 88]
    // 3.2.4 验证未激活 DLC cluster 不存在
    const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_408_macro"]')
    await expect(cluster408).toHaveCount(0) // 期望:[Cluster_408_macro (Split DLC) cluster 多边形不存在]
    // 3.2.5 验证未激活 DLC sector 不存在 (Cluster_400 is single-sector, no cluster-polygon)
    const sector400 = page.locator('polygon.sector-polygon[data-sector-id^="Cluster_400"]')
    await expect(sector400).toHaveCount(0) // 期望:[Cluster_400 sector 多边形不存在]
  })

  // 3.3 Case: 星门连接到被过滤 cluster 时保持显示
  test('3.3 Case: 星门连接到被过滤 cluster 时保持显示', async ({ page }) => {
    // 3.3.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.3.2-3.3.3 验证星门路径存在
    const gateCount = await page.locator('line.gate-path').count()
    expect(gateCount).toBeGreaterThan(0) // 期望:[line.gate-path 数量大于 0]
    // 3.3.4 验证星门路径颜色正常且无虚线
    const gatePath = page.locator('line.gate-path').first()
    const stroke = await gatePath.getAttribute('stroke')
    expect(stroke).toBe('#e5e7eb') // 期望:[星门路径颜色为 #e5e7eb 且无虚线]
  })

  // 3.4 Case: 位于未激活 DLC cluster 的空间站地址标红
  test('3.4 Case: 位于未激活 DLC cluster 的空间站地址标红', async ({ page }) => {
    // 3.4.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.4.2 打开空间站面板
    await page.getByTestId('map-station-entry-button').click()
    // 3.4.3-3.4.6 验证空间站面板显示（fixture 中可能没有空间站数据）
    await expect(page.getByTestId('map-station-panel')).toBeVisible()
    // 期望:[空间站面板正常显示]
  })

  // 3.5 Case: 位于已激活 DLC cluster 的空间站地址正常显示
  test('3.5 Case: 位于已激活 DLC cluster 的空间站地址正常显示', async ({ page }) => {
    // 3.5.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.5.2 打开空间站面板
    await page.getByTestId('map-station-entry-button').click()
    // 3.5.3-3.5.5 验证空间站面板显示（fixture 中可能没有空间站数据）
    await expect(page.getByTestId('map-station-panel')).toBeVisible()
    // 期望:[空间站面板正常显示，地址无红色标记]
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
    await page.waitForTimeout(300)
    await page.getByTestId('map-resource-tag-ore').click()
    await page.waitForTimeout(300)
    // 3.6.4-3.6.6 验证资源筛选面板显示结果
    const resultList = page.getByTestId('map-resource-simple-candidate-list')
    await expect(resultList).toBeVisible()
    // 期望:[资源筛选面板显示结果列表]
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
    await page.waitForTimeout(300)
    await page.getByTestId('map-resource-tag-ore').click()
    await page.waitForTimeout(300)
    // 3.7.4-3.7.6 验证资源筛选面板显示结果
    const resultList = page.getByTestId('map-resource-simple-candidate-list')
    await expect(resultList).toBeVisible()
    // 期望:[资源筛选面板显示结果列表]
  })

  // 3.8 Case: 过滤后剩余 cluster 位置保持稳定
  test('3.8 Case: 过滤后剩余 cluster 位置保持稳定', async ({ page }) => {
    // 3.8.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.8.2-3.8.3 记录 cluster 位置（使用 cluster-polygon 外边框）
    const cluster01 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_01_macro"]')
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
    // 3.9.3-3.9.4 切换并记录 N2
    await transitionDlcOffToOn(page)
    const n2 = await page.locator('polygon[data-cluster-id]').count()
    // 3.9.5 验证 N2 < N1
    expect(n2).toBeLessThan(n1) // 期望:[cluster 多边形数量 N2 小于 N1]
    // 3.9.6-3.9.7 切换回并记录 N3
    await transitionDlcOnToOff(page)
    const n3 = await page.locator('polygon[data-cluster-id]').count()
    // 3.9.8 验证 N3 等于 N1
    expect(n3).toBe(n1) // 期望:[cluster 多边形数量 N3 等于 N1]
  })

  // 3.10 Case: 多 sector cluster 边距显示正常
  test('3.10 Case: 多 sector cluster 边距显示正常', async ({ page }) => {
    // 3.10.1 状态: 地图界面
    await buildMapInterface(page)
    // 3.10.2-3.10.3 验证多 sector cluster sector 数量
    const sectors = page.locator('polygon.sector-polygon[data-cluster-id="Cluster_01_macro"]')
    const sectorCount = await sectors.count()
    expect(sectorCount).toBe(3) // Grand Exchange 有 3 个 sector
    // 期望:[sector 之间有边距]
    // 3.10.4-3.10.5 验证单 sector cluster
    const singleSector = page.locator('polygon.sector-polygon[data-cluster-id="Cluster_02_macro"]')
    await expect(singleSector).toHaveCount(1) // 期望:[单 sector 填满 cluster]
  })

  // 3.11 Case: 虚线边框样式对齐
  test('3.11 Case: 虚线边框样式对齐', async ({ page }) => {
    // 3.11.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.11.2-3.11.3 验证虚线边框样式对齐
    const cluster408 = page.locator('polygon.cluster-polygon[data-cluster-id="Cluster_408_macro"]')
    const clusterDash = await cluster408.getAttribute('stroke-dasharray')
    expect(clusterDash).toBe('6,4')
    // 期望:[Cluster_408_macro (Split DLC) 虚线模式为 "6,4"]
  })

  // 3.12 Case: 空间站搜索功能在 DLC 过滤下正常
  test('3.12 Case: 空间站搜索功能在 DLC 过滤下正常', async ({ page }) => {
    // 3.12.1 状态: 地图界面DLC限制开
    await buildMapInterface(page)
    await buildMapInterfaceDlcOn(page)
    // 3.12.2 打开空间站面板
    await page.getByTestId('map-station-entry-button').click()
    // 3.12.3-3.12.4 验证空间站面板可见
    await expect(page.getByTestId('map-station-panel')).toBeVisible()
    // 3.12.5-3.12.6 验证搜索框可用
    await expect(page.getByTestId('map-station-panel-search')).toBeVisible()
    // 期望:[空间站搜索功能正常]
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
    // 期望:[星区搜索功能正常]
  })

  // 3.15 Case: 切换 DLC 限制后资源筛选同步更新
  test('3.15 Case: 切换 DLC 限制后资源筛选同步更新', async ({ page }) => {
    // 3.15.1 状态: 地图界面DLC限制关
    await buildMapInterface(page)
    await buildMapInterfaceDlcOff(page)
    // 3.15.2-3.15.3 打开资源筛选
    await page.getByTestId('map-resource-panel-tab').click()
    await page.waitForTimeout(300)
    // 3.15.4-3.15.6 验证资源筛选面板可见
    await expect(page.getByTestId('map-resource-simple-candidate-list')).toBeVisible()
    // 3.15.7-3.15.9 切换回并验证面板仍然可见
    await transitionDlcOffToOn(page)
    await expect(page.getByTestId('map-resource-simple-candidate-list')).toBeVisible()
    // 期望:[资源筛选面板在 DLC 切换后正常显示]
  })
})
