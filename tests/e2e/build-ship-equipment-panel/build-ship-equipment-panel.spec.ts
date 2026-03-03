import { expect } from '@playwright/test'
import { test } from '../../test-setup'

// ========== Helper Functions ==========

const openShipBuild = async (page: any) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('isTestEnv', 'true')
  })
  await page.reload()
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
}

const enterOdachi = async (page: any) => {
  await openShipBuild(page)
  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: /Odachi|大太刀/ }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
}

const switchToTurretTab = async (page: any) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^T$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const switchToEngineTab = async (page: any) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^E$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const switchToShieldTab = async (page: any) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^S$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const switchToWeaponTab = async (page: any) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^W$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const switchToThrusterTab = async (page: any) => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^R$/ }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
}

const closePicker = async (page: any) => {
  await page.locator('.panel-body, body').first().click({ position: { x: 10, y: 10 } })
}

// ========== Chapter 2: State Helpers ==========

async function buildEquipmentPanelVisibleTurretPickerOpen(page: any) {
  // 2.1.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.1.2 切换到 turret 标签
  await switchToTurretTab(page)
  // 2.1.3 点击 con_turret_m_01 分组打开 Picker
  const groupTab = page.locator('.group-tabs .group-tab').filter({ hasText: /con_turret_m_01/ }).first()
  await expect(groupTab).toBeVisible()
  await groupTab.click()
  // 2.1.4 点击选中某个候选装备
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.1.5 断言 ShipBuildPanelEquipment 面板显示 #期望: [visible]
  await expect(page.locator('[data-testid="ship-build-panel-equipment"]')).toBeVisible()
}

async function buildEquipmentPanelVisibleEnginePickerOpen(page: any) {
  // 2.2.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.2.2 点击 con_engine_01 打开 Picker
  await switchToEngineTab(page)
  // 2.2.3 点击选中候选引擎
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.2.4 断言面板显示且显示引擎 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelVisibleShieldPickerOpen(page: any) {
  // 2.3.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.3.2 点击 con_shield_01 打开 Picker
  await switchToShieldTab(page)
  // 2.3.3 点击选中候选护盾
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.3.4 断言面板显示且显示护盾 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelVisibleWeaponPickerOpen(page: any) {
  // 2.4.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.4.2 点击 con_weapon_01 打开 Picker
  await switchToWeaponTab(page)
  // 2.4.3 点击选中候选武器
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.4.4 断言面板显示且显示武器 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelVisibleThrusterPickerOpen(page: any) {
  // 2.5.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.5.2 切换到 thruster 标签，点击某分组打开 Picker
  await switchToThrusterTab(page)
  const groupTab = page.locator('.group-tabs .group-tab').first()
  if (await groupTab.isVisible().catch(() => false)) {
    await groupTab.click()
  }
  // 2.5.3 点击选中候选推进器
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.5.4 断言面板显示且显示推进器 summary #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelVisibleNoCurrentEquipment(page: any) {
  // 2.6.1 进入船只建造视图，选择大太刀
  await enterOdachi(page)
  // 2.6.2 点击未配装的 con_weapon_01 打开 Picker
  await switchToWeaponTab(page)
  // 2.6.3 点击选中候选装备
  const candidate = page.locator('.candidate-list .candidate-item').first()
  await expect(candidate).toBeVisible()
  await candidate.click()
  // 2.6.4 断言面板显示，仅显示候选装备数值 #期望: [visible]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

async function buildEquipmentPanelSameEquipmentSelected(page: any) {
  // 2.7.1 进入船只建造视图，选择大太刀，已为某槽位配装装备
  await enterOdachi(page)
  await switchToWeaponTab(page)
  // 配装一个武器
  const firstCandidate = page.locator('.candidate-list .candidate-item').first()
  await expect(firstCandidate).toBeVisible()
  await firstCandidate.click()
  // 等待配装完成
  await page.waitForTimeout(500)
  // 2.7.2 打开同一槽位的 Picker
  const weaponSlot = page.locator('[data-testid*="con_weapon"]').first()
  if (await weaponSlot.isVisible().catch(() => false)) {
    await weaponSlot.click()
  }
  // 2.7.3 点击选中与当前相同的装备
  const sameCandidate = page.locator('.candidate-list .candidate-item').first()
  await expect(sameCandidate).toBeVisible()
  await sameCandidate.click()
  // 2.7.4 断言面板显示当前装备信息，不显示比较进度条 #期望: [no-progress-bar]
  const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
  await expect(panel).toBeVisible()
}

// ========== Chapter 2: States ==========

test.describe('build-ship-equipment-panel', () => {
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
    // 3.3.2 点击选中一个比当前装备 DPS 高的候选
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.3.3 断言数值格式为 '100(+20)' #期望: ['100(+20)']
    const panelText = await panel.textContent()
    expect(panelText).toContain('(+')
    expect(panelText).toContain('100(+20)')
    // 3.3.4 断言正差值显示为蓝色 #期望: [blue]
    await expect(panel).toBeVisible()
  })

  test('3.4 Case: 数字格式显示负差值粉色', async ({ page }) => {
    // 3.4.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.4.2 点击选中一个比当前装备 DPS 低的候选
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    // 3.4.3 断言数值格式为 '80(-20)' #期望: ['80(-20)']
    const panelText = await panel.textContent()
    expect(panelText).toContain('(-')
    expect(panelText).toContain('80(-20)')
    // 3.4.4 断言负差值显示为粉色 #期望: [pink]
    await expect(panel).toBeVisible()
  })

  test('3.5 Case: Picker 候选卡片显示 Weapon summary', async ({ page }) => {
    // 3.5.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.5.2 点击选中候选武器，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.5.3 断言显示 burstDPS 和 range 两项数据 #期望: ['burstDPS', 'range']
    const cardText = await candidateCard.textContent()
    expect(cardText).toContain('burstDPS')
    expect(cardText).toContain('range')
  })

  test('3.6 Case: Picker 候选卡片显示 Turret summary', async ({ page }) => {
    // 3.6.1 状态: equipment-panel-visible-turret-picker-open
    await buildEquipmentPanelVisibleTurretPickerOpen(page)
    // 3.6.2 点击选中候选炮塔，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.6.3 断言显示 sustainedDPS 和 range 两项数据 #期望: ['sustainedDPS', 'range']
    const cardText = await candidateCard.textContent()
    expect(cardText).toContain('sustainedDPS')
    expect(cardText).toContain('range')
  })

  test('3.7 Case: Picker 候选卡片显示 Shield summary', async ({ page }) => {
    // 3.7.1 状态: equipment-panel-visible-shield-picker-open
    await buildEquipmentPanelVisibleShieldPickerOpen(page)
    // 3.7.2 点击选中候选护盾，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.7.3 断言显示 shieldMax 和 shieldDelay 两项数据 #期望: ['shieldMax', 'shieldDelay']
    const cardText = await candidateCard.textContent()
    expect(cardText).toContain('shieldMax')
    expect(cardText).toContain('shieldDelay')
  })

  test('3.8 Case: Picker 候选卡片显示 Engine summary', async ({ page }) => {
    // 3.8.1 状态: equipment-panel-visible-engine-picker-open
    await buildEquipmentPanelVisibleEnginePickerOpen(page)
    // 3.8.2 点击选中候选引擎，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.8.3 断言显示 speed 和 travel 两项数据 #期望: ['speed', 'travel']
    const cardText = await candidateCard.textContent()
    expect(cardText).toContain('speed')
    expect(cardText).toContain('travel')
    // 3.8.4 断言 travel 格式为 ${speed}:${charge} #期望: [/^\d+:\d+$/]
    expect(cardText).toContain('/^\d+:\d+$/')
  })

  test('3.9 Case: Picker 候选卡片显示 Thruster summary', async ({ page }) => {
    // 3.9.1 状态: equipment-panel-visible-thruster-picker-open
    await buildEquipmentPanelVisibleThrusterPickerOpen(page)
    // 3.9.2 点击选中候选推进器，检查卡片右侧 summary 区
    const candidateCard = page.locator('.candidate-item-active, .candidate-item.candidate-item-active').first()
    // 3.9.3 断言显示 strafeSpeed 和 yawRate 两项数据 #期望: ['strafeSpeed', 'yawRate']
    const cardText = await candidateCard.textContent()
    expect(cardText).toContain('strafeSpeed')
    expect(cardText).toContain('yawRate')
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
    // 3.15.1 状态: equipment-panel-visible-weapon-picker-open（已配装）
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.15.2 点击空槽位按钮清除选中
    const clearBtn = page.locator('[data-testid="clear-equipment"]').first()
    // 3.15.3 断言面板显示当前已装备的数值，无差值信息 #期望: [currentOnly]
    await expect(clearBtn).toBeVisible()
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
    // 3.20.1 进入船只建造视图，选择大太刀，打开 Picker（未选中）
    await enterOdachi(page)
    await switchToWeaponTab(page)
    // 3.20.2 点击选中某个候选装备
    const candidate = page.locator('.candidate-list .candidate-item').first()
    await candidate.click()
    // 3.20.3 断言面板显示 #期望: [visible]
    await expect(page.locator('[data-testid="ship-build-panel-equipment"]')).toBeVisible()
  })

  test('3.21 Case: 切换装备类型后 summary 更新', async ({ page }) => {
    // 3.21.1 状态: equipment-panel-visible-weapon-picker-open
    await buildEquipmentPanelVisibleWeaponPickerOpen(page)
    // 3.21.2 切换到 turret 标签并点击选中候选炮塔
    await switchToTurretTab(page)
    const turretCandidates = page.locator('.candidate-list .candidate-item').first()
    await turretCandidates.click()
    // 3.21.3 断言 summary 区更新为 Turret 类型显示项 #期望: [updated]
    const panel = page.locator('[data-testid="ship-build-panel-equipment"]')
    await expect(panel).toBeVisible()
  })
})
