import { expect } from '@playwright/test'
import { test } from '../../test-setup'

// Helper: 点击空候选槽
const clickEmptyCandidate = async (page: any) => {
  const candidates = page.locator('.candidate-list .candidate-item')
  const count = await candidates.count()
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i)
    const testid = await candidate.getAttribute('data-testid')
    if (testid && testid.includes('empty')) {
      await candidate.click()
      return
    }
  }
  if (count > 0) {
    await candidates.first().click()
  }
}

// Helper: 选择大太刀（加载 fixture，有装备）
const enterOdachi = async (page: any) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()
  const odachiItem = page.locator('.blueprint-item').filter({ hasText: /Odachi|odachi/i }).first()
  await expect(odachiItem).toBeVisible()
  await odachiItem.click()
  await odachiItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()
  await page.waitForTimeout(500)
}

// Helper: 选择大太刀（使用 Change Ship 流程，槽位为空）
const enterOdachiEmpty = async (page: any) => {
  // 1. 先进入 ship-build（会加载 fixture 中的数据）
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()

  // 2. 点击 Change Ship 返回列表
  await page.getByRole('button', { name: /Change Ship|更换飞船/ }).click()
  await expect(page.getByTestId('ship-build-list')).toBeVisible()

  // 3. 筛选 M + terran
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()

  // 4. 重新选择大太刀（会创建新的空槽位配置）
  const odachiItem = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/i }).first()
  await expect(odachiItem).toBeVisible()
  await odachiItem.click()
  await page.waitForTimeout(500)
}

// Helper: 切换到 weapon 标签
const switchToWeaponTab = async (page: any) => {
  const weaponTab = page.locator('[data-testid="slot-type-weapon"]')
  await expect(weaponTab).toBeVisible({ timeout: 10000 })
  await weaponTab.click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')

  // 1. 加载 fixture
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)

  // 2. reload
  await page.reload()

  // 3. 设置语言
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
})

// 4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化
test('4.1 BUG-001: 点击槽位打开Picker后material未隐藏且宽度未变化 - 修复前', async ({ page }) => {
  // 4.1.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)

  // 4.1.2 点击任一空槽位打开 Picker
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)

  // 点击武器槽位打开 Picker（不选装备，保持空槽位状态）
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)

  // 4.1.3 修复前：断言 Picker 宽度为 col-span-4（未变化）
  // #期望: ['col-span-4']
  const fitPanel = page.locator('[data-testid="ship-build-panel-fit"]')
  const fitPanelClass = await fitPanel.getAttribute('class')
  expect(fitPanelClass).toContain('col-span-4')

  // 4.1.4 修复前：断言 Material 面板仍显示
  // #期望: [visible]
  const materialPanel = page.locator('[data-testid="ship-build-panel-materials"]')
  await expect(materialPanel).toBeVisible()
})

// 4.2 BUG-002: 选择空候选槽后PanelEquipment不显示
test('4.2 BUG-002: 选择空候选槽后PanelEquipment不显示', async ({ page }) => {
  // 4.2.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 4.2.2 确保某槽位已有装备（如weapon槽位有武器）
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)
  // 4.2.3 点击该槽位打开Picker
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 4.2.4 选择空候选槽（取消装备）
  await clickEmptyCandidate(page)
  await page.waitForTimeout(300)
  // 4.2.5 修复前：断言PanelEquipment面板不显示 #期望: [hidden]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).not.toBeVisible()
})

// 4.3 BUG-003: 无装备槽位打开Picker后候选槽无法点击
test('4.3 BUG-003: 无装备槽位打开Picker后候选槽无法点击', async ({ page }) => {
  // 4.3.1 使用 Change Ship 流程选择大太刀（槽位为空）
  await enterOdachiEmpty(page)
  // 4.3.2 选择一个没有装备的槽位
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)
  // 找一个没有装备的槽位
  const weaponSlots = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]')
  const slotCount = await weaponSlots.count()
  let targetSlot = weaponSlots.nth(slotCount - 1)
  await expect(targetSlot).toBeVisible({ timeout: 10000 })
  await targetSlot.click()
  await page.waitForTimeout(500)
  // 4.3.4 点击候选列表中的候选槽
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible({ timeout: 10000 })
  await candidate.click()
  await page.waitForTimeout(300)
  // 4.3.5 修复前：断言PanelEquipment面板不显示 #期望: [hidden]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).not.toBeVisible()
})

// Helper: 切换到 engine 标签
const switchToEngineTab = async (page: any) => {
  const engineTab = page.locator('[data-testid="slot-type-engine"]')
  await expect(engineTab).toBeVisible({ timeout: 10000 })
  await engineTab.click()
}

// 4.4 BUG-004: 空候选槽数值为0时样式显示错误
test('4.4 BUG-004: 空候选槽数值为0时样式显示错误', async ({ page }) => {
  // 4.4.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 4.4.2 选择修改引擎（engine槽位）
  await switchToEngineTab(page)
  await page.waitForTimeout(300)
  // 4.4.3 点击引擎槽位打开Picker
  const engineSlots = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]')
  const slotCount = await engineSlots.count()
  const targetSlot = engineSlots.nth(0)
  await expect(targetSlot).toBeVisible({ timeout: 10000 })
  await targetSlot.click()
  await page.waitForTimeout(500)
  // 4.4.4 选择空候选槽（取消装备）
  await clickEmptyCandidate(page)
  await page.waitForTimeout(300)
  // 4.4.5 修复前：断言巡航加力时间显示为绿色 #期望: [green]
  // 查找 boostDuration 行（巡航加力时间）
  const boostDurationRow = page.locator('.stats-row').filter({ hasText: /巡航加力时间|boost duration/i }).first()
  await expect(boostDurationRow).toBeVisible({ timeout: 5000 })
  // 检查数值显示是否为绿色 (diff-neutral class，在 stats-value 内的 span 元素)
  const valueElement = boostDurationRow.locator('.stats-value > span').first()
  await expect(valueElement).toHaveClass(/diff-neutral/)
})

// 4.5 BUG-005: 空槽位选择新引擎后属性值为0时样式显示错误
test('4.5 BUG-005: 空槽位选择新引擎后属性值为0时样式显示错误', async ({ page }) => {
  // 4.5.1 进入船只建造视图，使用 Change Ship 选择大太刀（确保槽位为空）
  await enterOdachiEmpty(page)
  // 4.5.2 切换到引擎标签
  await switchToEngineTab(page)
  await page.waitForTimeout(300)
  // 4.5.3 点击引擎槽位打开Picker
  const engineSlots = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]')
  const targetSlot = engineSlots.nth(0)
  await expect(targetSlot).toBeVisible({ timeout: 10000 })
  await targetSlot.click()
  await page.waitForTimeout(500)
  // 4.5.4 选择一个非空引擎（候选）
  await clickRealCandidate(page)
  await page.waitForTimeout(300)
  // 4.5.5 修复前：断言巡航加力时间显示为绿色 #期望: [green]
  const boostDurationRow = page.locator('.stats-row').filter({ hasText: /巡航加力时间|boost duration/i }).first()
  await expect(boostDurationRow).toBeVisible({ timeout: 5000 })
  const valueElement = boostDurationRow.locator('.stats-value > span').first()
  await expect(valueElement).toHaveClass(/diff-neutral/)
})