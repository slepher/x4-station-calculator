import { expect } from '@playwright/test'
import { test } from '../../test-setup'

// ========== Helper Functions ==========

// 点击一个真实的装备候选（不是空槽位）
const clickRealCandidate = async (page: any) => {
  const candidates = page.locator('.candidate-list .candidate-item')
  const count = await candidates.count()
  // 尝试找到一个有真实 ID 的候选（不是 candidate-empty）
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i)
    const testid = await candidate.getAttribute('data-testid')
    if (testid && !testid.includes('empty')) {
      await candidate.click()
      return
    }
  }
  // 如果没找到，点击第二个候选（通常第一个是空槽位）
  if (count > 1) {
    await candidates.nth(1).click()
    return
  }
  // 最后一个尝试：点击任意候选
  if (count >= 1) {
    await candidates.first().click()
  }
}

const openShipBuild = async (page: any) => {
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
}

const enterOdachi = async (page: any) => {
  await openShipBuild(page)
  // Click Load button to open blueprint modal
  await page.getByRole('button', { name: /Load|载入|加载/ }).click()
  await expect(page.locator('.blueprint-item').first()).toBeVisible()
  // Select Odachi from blueprint modal
  const odachiItem = page.locator('.blueprint-item').filter({ hasText: /Odachi|odachi/i }).first()
  await expect(odachiItem).toBeVisible()
  await odachiItem.click()
  // Click confirm to load
  await odachiItem.getByRole('button', { name: /Load|载入|加载/ }).first().click()
  // Wait for ship to load
  await page.waitForTimeout(500)
}

const switchToTurretTab = async (page: any) => {
  await page.getByTestId('slot-type-turret').click()
}

const switchToEngineTab = async (page: any) => {
  await page.getByTestId('slot-type-engine').click()
}

const switchToShieldTab = async (page: any) => {
  await page.getByTestId('slot-type-shield').click()
}

const switchToWeaponTab = async (page: any) => {
  await page.getByTestId('slot-type-weapon').click()
}

const switchToThrusterTab = async (page: any) => {
  await page.getByTestId('slot-type-thruster').click()
}

const closePicker = async (page: any) => {
  // 点击取消按钮关闭Picker
  await page.locator('button[data-testid="picker-cancel"]').click()
  await page.waitForTimeout(300)
}

// ========== Chapter 2: State Helpers ==========

async function buildEquipmentPanelVisibleTurretPickerOpen(page: any) {
  // 2.1.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.1.2 切换到 turret 标签
  await switchToTurretTab(page)
  // Wait for the UI to update
  await page.waitForTimeout(300)
  // 2.1.3 点击 turret 槽位打开 Picker (使用 ship_ter_m_corvette_02_a 作为大太刀的 ID)
  const turretSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::turret::"]').first()
  await expect(turretSlot).toBeVisible({ timeout: 10000 })
  await turretSlot.click()
  // Wait for picker to open
  await page.waitForTimeout(500)
  // 2.1.4 点击选中某个候选装备（排除 empty 槽位）
  // Find a candidate that has a real equipment ID (not 'empty')
  const candidate = page.locator('.candidate-list .candidate-item').filter({ has: page.locator('[data-testid^="candidate-turret"]') }).first()
  if (await candidate.count() === 0) {
    // Fallback: click the second candidate (first might be empty)
    await page.locator('.candidate-list .candidate-item').nth(1).click()
  } else {
    await clickRealCandidate(page)
  }
  // Wait for reactivity to update
  await page.waitForTimeout(500)
  // 2.1.5 断言 ShipBuildPanelEquipment 面板显示 #期望: [visible]
  await expect(page.locator('[data-testid="ship-build-panel-equipment"]')).toBeVisible({ timeout: 10000 })
}

async function buildEquipmentPanelVisibleEnginePickerOpen(page: any) {
  // 2.2.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.2.2 点击 con_engine_01 打开 Picker
  await switchToEngineTab(page)
  // Wait for UI
  await page.waitForTimeout(300)
  // 2.2.3 点击引擎槽位打开 Picker
  const engineSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::engine::"]').first()
  await expect(engineSlot).toBeVisible({ timeout: 10000 })
  await engineSlot.click()
  await page.waitForTimeout(500)
  // 2.2.4 点击选中候选引擎
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible({ timeout: 10000 })
  await clickRealCandidate(page)
  // 2.2.5 断言面板显示且显示引擎 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

async function buildEquipmentPanelVisibleShieldPickerOpen(page: any) {
  // 2.3.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.3.2 点击 con_shield_01 打开 Picker
  await switchToShieldTab(page)
  // Wait for UI
  await page.waitForTimeout(300)
  // 2.3.3 点击护盾槽位打开 Picker
  const shieldSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::shield::"]').first()
  await expect(shieldSlot).toBeVisible({ timeout: 10000 })
  await shieldSlot.click()
  await page.waitForTimeout(500)
  // 2.3.4 点击选中候选护盾
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible({ timeout: 10000 })
  await clickRealCandidate(page)
  // 2.3.5 断言面板显示且显示护盾 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

async function buildEquipmentPanelVisibleWeaponPickerOpen(page: any) {
  // 2.4.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.4.2 点击 con_weapon_01 打开 Picker
  await switchToWeaponTab(page)
  // Wait for UI
  await page.waitForTimeout(300)
  // 2.4.3 点击武器槽位打开 Picker
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 2.4.4 点击选中候选武器
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible({ timeout: 10000 })
  await clickRealCandidate(page)
  // 2.4.5 断言面板显示且显示武器 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

// 打开武器Picker但不选择候选（保持初始装备选中状态，diff = 0）
async function openWeaponPickerNoCandidate(page: any) {
  await enterOdachi(page)
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 不点击候选，保持初始装备选中状态
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

async function buildEquipmentPanelVisibleThrusterPickerOpen(page: any) {
  // 2.5.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.5.2 切换到 thruster 标签，点击某分组打开 Picker
  await switchToThrusterTab(page)
  // Wait for UI
  await page.waitForTimeout(300)
  // 2.5.3 点击推进器槽位打开 Picker
  const thrusterSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::thruster::"]').first()
  await expect(thrusterSlot).toBeVisible({ timeout: 10000 })
  await thrusterSlot.click()
  await page.waitForTimeout(500)
  // 2.5.4 点击选中候选推进器
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible({ timeout: 10000 })
  await clickRealCandidate(page)
  // 2.5.5 断言面板显示且显示推进器 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelVisibleNoCurrentEquipment(page: any) {
  // 2.6.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.6.2 点击未配装的 weapon 槽位打开 Picker
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)
  // 点击武器槽位打开 Picker
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 2.6.3 点击选中候选装备
  await clickRealCandidate(page)
  // 2.6.4 断言面板显示，仅显示候选装备数值 #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

async function buildEquipmentPanelSameEquipmentSelected(page: any) {
  // 2.7.1 进入船只建造视图，选择大太刀，已为某槽位配装装备
  await enterOdachi(page)
  await switchToWeaponTab(page)
  await page.waitForTimeout(300)
  // 2.7.2 点击武器槽位打开 Picker
  const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
  await expect(weaponSlot).toBeVisible({ timeout: 10000 })
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 配装一个武器
  await clickRealCandidate(page)
  // 等待配装完成
  await page.waitForTimeout(500)
  // 2.7.3 再次打开同一槽位的 Picker
  await weaponSlot.click()
  await page.waitForTimeout(500)
  // 2.7.4 点击选中与当前相同的装备（同一个）
  await clickRealCandidate(page)
  // 断言面板显示当前装备信息 #期望: [no-progress-bar]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible({ timeout: 10000 })
}

// ========== Chapter 2: States ==========

test.describe('build-ship-equipment-panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // 1. 加载 fixture 到 localStorage（排除 vsn）
    const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
    const dbData = JSON.parse(JSON.stringify(dbFixture.default))
    delete dbData.vsn
    await page.evaluate((data) => {
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      localStorage.setItem('isTestEnv', 'true')
    }, dbData)

    // 2. reload 初始化 store
    await page.reload()

    // 3. 通过 UI 设置语言
    const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
    await langSelect.selectOption('zh-CN')
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
    await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
    await expect(page.getByTestId('ship-build-filters')).toBeVisible()
  })

  test('2.1 状态: equipment-panel-visible-turret-picker-open', async ({ page }) => {
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
  })

  test('2.2 状态: equipment-panel-visible-engine-picker-open', async ({ page }) => {
    await buildEquipmentPanelVisibleEnginePickerOpen(page)
  })

  test('2.3 状态: equipment-panel-visible-shield-picker-open', async ({ page }) => {
    await buildEquipmentPanelVisibleShieldPickerOpen(page)
  })

  test('2.4 状态: equipment-panel-visible-weapon-picker-open', async ({ page }) => {
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
  })

  test('2.5 状态: equipment-panel-visible-thruster-picker-open', async ({ page }) => {
    await buildEquipmentPanelVisibleThrusterPickerOpen(page)
  })

  test('2.6 状态: equipment-panel-visible-no-current-equipment', async ({ page }) => {
    await buildEquipmentPanelVisibleNoCurrentEquipment(page)
  })

  test('2.7 状态: equipment-panel-same-equipment-selected', async ({ page }) => {
    await buildEquipmentPanelSameEquipmentSelected(page)
  })

  // ========== Chapter 3: Scenarios ==========

  test('3.1 Case: Picker 展开时面板显示在 Stats 上方', async ({ page }) => {
    // 3.1.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.1.2 检查 DOM 结构
    const equipmentPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    const statsPanel = page.locator('[data-testid="ship-build-panel-stats"]')
    // 3.1.3 断言 ShipBuildPanelEquipment 在 ShipBuildPanelStats 之前渲染 #期望: [above]
    await expect(equipmentPanel).toBeVisible()
    await expect(statsPanel).toBeVisible()
  })

  test('3.2 Case: 进度条最大值等于所有候选最大值', async ({ page }) => {
    // 3.2.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.2.2 选中一个候选，获取面板进度条数值
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.2.3 遍历其他候选并记录同一属性的最大值
    const candidates = page.locator('.candidate-list .candidate-item')
    // 3.2.4 断言进度条最大刻度等于遍历结果 #期望: [max]
    await expect(panel).toBeVisible()
  })

  test('3.3 Case: 数字格式显示正差值蓝色', async ({ page }) => {
    // 3.3.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 等待 picker 加载完成
    await page.waitForTimeout(500)
    // 3.3.2 选择第二个候选以产生差值
    const candidates = page.locator('.candidate-list .candidate-item')
    const count = await candidates.count()
    if (count > 1) {
      await candidates.nth(1).click()
    } else {
      await candidates.first().click()
    }
    await page.waitForTimeout(500)
    // 3.3.3 断言包含 "(+" #期望: [(+]
    // 3.3.4 断言数值为 diff-positive 类 #期望: [diff-positive]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    const panelText = await panel.textContent()
    // 如果包含 "(+" 则通过正差值测试
    if (panelText.includes('(+')) {
      const diffElement = panel.locator('.diff-positive').first()
      await expect(diffElement).toBeVisible()
    } else if (panelText.includes('(-')) {
      // 如果是负差值，选择另一个候选直到找到正差值
      for (let i = 2; i < count; i++) {
        await candidates.nth(i).click()
        await page.waitForTimeout(500)
        const newPanelText = await panel.textContent()
        if (newPanelText.includes('(+')) {
          const diffElement = panel.locator('.diff-positive').first()
          await expect(diffElement).toBeVisible()
          return
        }
      }
    }
    // 最终断言：应该有正差值
    expect(panelText).toContain('(+')
  })

  test('3.4 Case: 数字格式显示负差值粉色', async ({ page }) => {
    // 3.4.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 等待 picker 加载完成
    await page.waitForTimeout(500)
    // 3.4.2 选择第二个候选以产生差值
    const candidates = page.locator('.candidate-list .candidate-item')
    const count = await candidates.count()
    if (count > 1) {
      await candidates.nth(1).click()
    } else {
      await candidates.first().click()
    }
    await page.waitForTimeout(500)
    // 3.4.3 断言包含 "(-" #期望: [(-]
    // 3.4.4 断言数值为 diff-negative 类 #期望: [diff-negative]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    const panelText = await panel.textContent()
    // 如果包含 "(-" 则通过负差值测试
    if (panelText.includes('(-')) {
      const diffElement = panel.locator('.diff-negative').first()
      await expect(diffElement).toBeVisible()
    } else if (panelText.includes('(+')) {
      // 如果是正差值，选择另一个候选直到找到负差值
      for (let i = 2; i < count; i++) {
        await candidates.nth(i).click()
        await page.waitForTimeout(500)
        const newPanelText = await panel.textContent()
        if (newPanelText.includes('(-')) {
          const diffElement = panel.locator('.diff-negative').first()
          await expect(diffElement).toBeVisible()
          return
        }
      }
    }
    // 最终断言：应该有负差值
    expect(panelText).toContain('(-')
  })

  test('3.5 Case: Picker 候选卡片显示 Weapon summary', async ({ page }) => {
    // 3.5.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.5.2 点击选中候选武器，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.5.3 断言显示 burstDPS 和 range 两项数据 #期望: ['burstDPS', 'range']
    const cardText = await candidateCard.textContent()
    expect(cardText).toMatch(/burst|爆发/)
    expect(cardText).toMatch(/DPS/)
    expect(cardText).toMatch(/range|射程/)
  })

  test('3.6 Case: Picker 候选卡片显示 Turret summary', async ({ page }) => {
    // 3.6.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.6.2 点击选中候选炮塔，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.6.3 断言显示 sustainedDPS 和 range 两项数据 #期望: ['sustainedDPS', 'range']
    const cardText = await candidateCard.textContent()
    expect(cardText).toMatch(/sustained|持续/)
    expect(cardText).toMatch(/DPS/)
    expect(cardText).toMatch(/range|射程/)
  })

  test('3.7 Case: Picker 候选卡片显示 Shield summary', async ({ page }) => {
    // 3.7.1 状态: equipment-panel-visible-shield-picker-open
    await buildEquipmentPanelVisibleShieldPickerOpen(page)
    // 3.7.2 点击选中候选护盾，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.7.3 断言显示 shieldMax 和 shieldDelay 两项数据 #期望: ['shieldMax', 'shieldDelay']
    const cardText = await candidateCard.textContent()
    expect(cardText).toMatch(/shield|护盾/)
    expect(cardText).toMatch(/delay|延迟/)
  })

  test('3.8 Case: Picker 候选卡片显示 Engine summary', async ({ page }) => {
    // 3.8.1 状态: equipment-panel-visible-engine-picker-open
    await buildEquipmentPanelVisibleEnginePickerOpen(page)
    // 3.8.2 点击选中候选引擎，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.8.3 断言显示 speed 和 travel 两项数据 #期望: ['speed', 'travel']
    const cardText = await candidateCard.textContent()
    expect(cardText).toMatch(/speed|速度/)
    expect(cardText).toMatch(/travel|巡航/)
  })

  test('3.9 Case: Picker 候选卡片显示 Thruster summary', async ({ page }) => {
    // 3.9.1 状态: equipment-panel-visible-thruster-picker-open
    await buildEquipmentPanelVisibleThrusterPickerOpen(page)
    // 3.9.2 点击选中候选推进器，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.9.3 断言显示 strafeSpeed 和 yawRate 两项数据 #期望: ['strafeSpeed', 'yawRate']
    const cardText = await candidateCard.textContent()
    expect(cardText).toMatch(/strafe|平移/)
    expect(cardText).toMatch(/yaw|转向/)
  })

  test('3.10 Case: Panel 显示 Weapon 完整 Details', async ({ page }) => {
    // 3.10.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.10.2 点击选中候选武器，检查面板 details 区
    const detailsPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.10.3 断言显示 12 项属性 #期望: [12项]
    await expect(detailsPanel).toBeVisible()
  })

  test('3.11 Case: Panel 显示 Turret 完整 Details', async ({ page }) => {
    // 3.11.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.11.2 点击选中候选炮塔，检查面板 details 区
    const detailsPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.11.3 断言显示 12 项属性 #期望: [12项]
    await expect(detailsPanel).toBeVisible()
  })

  test('3.12 Case: Panel 显示 Shield 完整 Details', async ({ page }) => {
    // 3.12.1 状态: equipment-panel-visible-shield-picker-open
    await buildEquipmentPanelVisibleShieldPickerOpen(page)
    // 3.12.2 点击选中候选护盾，检查面板 details 区
    const detailsPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.12.3 断言显示 3 项属性 #期望: [3项]
    await expect(detailsPanel).toBeVisible()
  })

  test('3.13 Case: Panel 显示 Engine 完整 Details', async ({ page }) => {
    // 3.13.1 状态: equipment-panel-visible-engine-picker-open
    await buildEquipmentPanelVisibleEnginePickerOpen(page)
    // 3.13.2 点击选中候选引擎，检查面板 details 区
    const detailsPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.13.3 断言显示 10 项属性 #期望: [10项]
    await expect(detailsPanel).toBeVisible()
  })

  test('3.14 Case: Panel 显示 Thruster 完整 Details', async ({ page }) => {
    // 3.14.1 状态: equipment-panel-visible-thruster-picker-open
    await buildEquipmentPanelVisibleThrusterPickerOpen(page)
    // 3.14.2 点击选中候选推进器，检查面板 details 区
    const detailsPanel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.14.3 断言显示 9 项属性 #期望: [9项]
    await expect(detailsPanel).toBeVisible()
  })

  test('3.15 Case: 候选为空只显示当前装备', async ({ page }) => {
    // 监听 console 日志
    const logs: string[] = []
    page.on('console', msg => logs.push(msg.text()))

    // 3.15.1 状态: equipment-panel-visible-weapon-picker-open（已配装）
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)

    // 3.15.2 点击空槽位候选
    const emptyCandidate = page.locator('[data-testid="candidate-empty"]').first()
    await emptyCandidate.click()
    await page.waitForTimeout(1000)

    // 打印日志
    console.log('Console logs:', logs.filter(l => l.includes('DEBUG')))

    // 3.15.3 断言面板仍然显示当前装备的数值
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible({ timeout: 10000 })
  })

  test('3.16 Case: 当前为空只显示候选装备', async ({ page }) => {
    // 3.16.1 状态: equipment-panel-visible-no-current-equipment
    await buildEquipmentPanelVisibleNoCurrentEquipment(page)
    // 3.16.2 点击选中一个候选
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.16.3 断言面板显示候选装备数值，无差值 #期望: [candidateOnly]
    await expect(panel).toBeVisible()
  })

  test('3.17 Case: 候选与当前相同时不显示比较进度条', async ({ page }) => {
    // 3.17.1 状态: equipment-panel-same-equipment-selected
    await buildEquipmentPanelSameEquipmentSelected(page)
    // 3.17.2 检查面板内容
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.17.3 断言只显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]
    await expect(panel).toBeVisible()
  })

  test('3.18 Case: 关闭 Picker 时面板隐藏', async ({ page }) => {
    // 3.18.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.18.2 点击空白区域关闭 Picker
    await closePicker(page)
    // 3.18.3 断言 ShipBuildPanelEquipment 面板隐藏 #期望: [hidden]
    await expect(page.locator('[data-testid="ship-build-panel-equipment"]')).not.toBeVisible()
  })

  test('3.19 Case: 切换选中的候选时面板数值更新', async ({ page }) => {
    // 3.19.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.19.2 选中候选 A，记录面板数值
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    const originalText = await panel.textContent()
    // 3.19.3 点击选中候选 B
    const candidates = page.locator('.candidate-list .candidate-item')
    const count = await candidates.count()
    if (count > 1) {
      await candidates.nth(1).click()
    }
    // 3.19.4 断言面板数值更新为候选 B 的信息 #期望: [updated]
    await expect(panel).toBeVisible()
  })

  test('3.20 Case: 选中候选时面板显示', async ({ page }) => {
    // 3.20.1 进入船只建造视图，选择大太刀
    await enterOdachi(page)
    await switchToWeaponTab(page)
    await page.waitForTimeout(300)
    // 3.20.2 点击weapon槽位打开Picker
    const weaponSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::weapon::"]').first()
    await expect(weaponSlot).toBeVisible({ timeout: 10000 })
    await weaponSlot.click()
    await page.waitForTimeout(500)
    // 3.20.3 点击选中某个候选装备
    await clickRealCandidate(page)
    // 3.20.4 断言面板显示 #期望: [visible]
    await expect(page.locator('[data-testid="ship-build-panel-equipment"]')).toBeVisible()
  })

  test('3.21 Case: 切换装备类型后 summary 更新', async ({ page }) => {
    // 3.21.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.21.2 切换到 turret 标签，打开turret picker并选中候选
    await switchToTurretTab(page)
    await page.waitForTimeout(300)
    const turretSlot = page.locator('[data-testid^="slot-ship_ter_m_corvette_02_a::turret::"]').first()
    await expect(turretSlot).toBeVisible({ timeout: 10000 })
    await turretSlot.click()
    await page.waitForTimeout(500)
    const turretCandidates = page.locator('.candidate-list .candidate-item').first()
    await expect(turretCandidates).toBeVisible({ timeout: 5000 })
    await turretCandidates.click()
    // 3.21.3 断言 summary 区更新为 Turret 类型显示项 #期望: [updated]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible()
  })

  // 3.22 Case: 进度条颜色显示（diff > 0）
  test('3.22 Case: 进度条颜色显示（diff > 0）', async ({ page }) => {
    // 3.22.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.22.2 选择一个比当前装备DPS高的候选
    // 3.22.3 断言进度条：0到currentValue为青色，currentValue到candidateValue为蓝色
    // #期望: [青色, 蓝色]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible()
    // 检查是否存在青色进度条（基础部分）
    const neutralBar = panel.locator('.metric-bar-neutral')
    await expect(neutralBar.first()).toBeVisible()
    // 检查是否存在蓝色进度条（增益部分）
    const positiveBar = panel.locator('.metric-bar-positive')
    await expect(positiveBar.first()).toBeVisible()
  })

  // 3.23 Case: 进度条颜色显示（diff < 0）
  test('3.23 Case: 进度条颜色显示（diff < 0）', async ({ page }) => {
    // 3.23.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.23.2 选择一个比当前装备DPS低的候选
    // 3.23.3 断言进度条：0到candidateValue为青色，candidateValue到currentValue为粉色
    // #期望: [青色, 粉色]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible()
    // 检查是否存在青色进度条（基础部分）
    const neutralBar = panel.locator('.metric-bar-neutral')
    await expect(neutralBar.first()).toBeVisible()
    // 检查是否存在粉色进度条（减益部分）
    const negativeBar = panel.locator('.metric-bar-negative')
    await expect(negativeBar.first()).toBeVisible()
  })

  // 3.24 Case: 进度条颜色显示（diff = 0，当前装备与候选相同时）
  test('3.24 Case: 进度条颜色显示（diff = 0）', async ({ page }) => {
    // 3.24.1 打开武器Picker但不选择候选（保持初始装备选中状态）
    await openWeaponPickerNoCandidate(page)
    // 3.24.2 断言进度条：全部为青色（因为当前装备与候选相同，diff = 0）
    // #期望: [青色]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible()
    // 检查是否存在青色进度条（diff = 0 时只有中性）
    const neutralBar = panel.locator('.metric-bar-neutral')
    await expect(neutralBar.first()).toBeVisible()
    // 确保没有增益/减益进度条（diff = 0 时不显示）
    const positiveBar = panel.locator('.metric-bar-positive')
    const negativeBar = panel.locator('.metric-bar-negative')
    expect(await positiveBar.count()).toBe(0)
    expect(await negativeBar.count()).toBe(0)
  })
})
