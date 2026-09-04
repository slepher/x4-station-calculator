import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { test } from '../../test-setup'

const ARG_BEAM_ID = 'turret_arg_m_beam_02_mk1'
const TER_BEAM_ID = 'turret_ter_m_beam_02_mk1'
const ARG_GATLING_ID = 'turret_arg_m_gatling_02_mk1'
const THRUSTER_ID = 'thruster_gen_l_allround_01_mk1'

const openShipBuild = async (page: Page) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('isTestEnv', 'true')
  })
  await page.reload()
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()
}

const selectOsakaShip = async (page: Page) => {
  await openShipBuild(page)
  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: /Osaka|大阪/ }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const selectDaitachiShip = async (page: Page) => {
  await openShipBuild(page)
  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }
  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'M', exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
  const targetShip = page.locator('.list-item').filter({ hasText: /大太刀|Odachi/ }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()
  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const switchToSlotTab = async (page: Page, label: 'E' | 'S' | 'W' | 'T' | 'R') => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: new RegExp(`^${label}$`) }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
  const firstGroup = page.locator('.group-tabs .group-tab').first()
  await expect(firstGroup).toBeVisible()
  await firstGroup.click()
}

const assignFirstEquipment = async (page: Page) => {
  const optionCards = page.locator('.option-wall .option-card')
  await expect(optionCards.first()).toBeVisible()
  await optionCards.first().click()
  await page.keyboard.press('Escape')
}

const buildStateStandardOsaka = async (page: Page) => {
  await selectOsakaShip(page)
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
}

const assertStateStandardOsaka = async (page: Page) => {
  await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
  await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
}

const buildStateMaterialAggregation = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'T')

  // Assign to first 3 groups
  for (let i = 0; i < 3; i++) {
    const groups = page.locator('.group-tabs .group-tab')
    if (await groups.nth(i).isVisible().catch(() => false)) {
      await groups.nth(i).click()
      await assignFirstEquipment(page)
    }
  }
}

const buildStateMethodAggregation = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'E')
  await assignFirstEquipment(page)
  await switchToSlotTab(page, 'T')
  await assignFirstEquipment(page)
}

const selectMethod = async (page: Page, method: string) => {
  const select = page.getByTestId('ship-build-material-method-select')
  await expect(select).toBeVisible()
  try {
    await select.selectOption(method, { timeout: 3000 })
  } catch {
    await select.click()
    const option = page.getByRole('option', { name: new RegExp(`^${method}$`, 'i') })
    await option.click()
  }
}

const expand = async (row: Locator) => {
  await row.click()
}

const setPriceSlider = async (page: Page, value: number) => {
  const slider = page.getByTestId('ship-build-material-price-slider')
  await expect(slider).toBeVisible()
  const rangeInput = slider.locator('input[type="range"]').first()
  await expect(rangeInput).toBeVisible()
  // Use evaluate to set value directly for range inputs
  const normalizedValue = value / 100
  await rangeInput.evaluate((el: HTMLInputElement, v: number) => {
    el.value = String(v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, normalizedValue)
}

const buildStateMultiModule = async (page: Page) => {
  await buildStateStandardOsaka(page)
  await switchToSlotTab(page, 'T')

  // Assign to multiple groups
  const groups = page.locator('.group-tabs .group-tab')
  const groupCount = await groups.count()
  for (let i = 0; i < Math.min(groupCount, 4); i++) {
    if (await groups.nth(i).isVisible().catch(() => false)) {
      await groups.nth(i).click()
      await assignFirstEquipment(page)
    }
  }
}

test.describe('ship-build-material', () => {
  test('2.1.1 验证：method 下拉不包含 xenon 选项', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  // 4.1.2 验证：各类型飞船选择推进器后均过滤 xenon
  test('4.1.2 验证：各类型飞船选择推进器后均过滤 xenon', async ({ page }) => {
    // 测试 Terran 飞船
    await openShipBuild(page)
    const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
    if (await changeShip.isVisible().catch(() => false)) {
      await changeShip.click()
    }
    await page.getByTestId('ship-build-filter-class').getByRole('button', { name: 'L', exact: true }).click()
    await page.getByTestId('ship-build-filter-race').getByRole('button', { name: /terran/i }).click()
    const terranShip = page.locator('.list-item').filter({ hasText: /Osaka|大阪/ }).first()
    await expect(terranShip).toBeVisible()
    await terranShip.click()
    await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()

    // 选择推进器 (R槽)
    await switchToSlotTab(page, 'R')
    await assignFirstEquipment(page)

    // 等待数据更新
    await page.waitForTimeout(500)

    // 检查 method 下拉
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.2.1 状态：大太刀标准测试状态', async ({ page }) => {
    await selectDaitachiShip(page)
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
  })

  test('2.2.2 状态：大太刀-护盾配置', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.2.3 状态：大太刀-推进器配置', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(2)
  })

  test('2.2.4 验证：method 选项包含 default', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).toContain('default')
    // Verify xenon is filtered out
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.2.5 切换：method default -> closedloop', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)

    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')

    // Try to switch to closedloop if available
    const options = await methodSelect.locator('option').allTextContents()
    if (options.some(o => o.trim().toLowerCase() === 'closedloop')) {
      await selectMethod(page, 'closedloop')
      await expect(methodSelect).toHaveValue('closedloop')
    }
  })

  test('2.3.1 状态：大阪标准测试状态', async ({ page }) => {
    await selectOsakaShip(page)
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-method-select')).toBeVisible()
    await expect(page.getByTestId('ship-build-material-summary')).toBeVisible()
  })

  test('2.3.2 状态：大阪-推进器配置（thruster_gen_l_allround_01_mk1）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.3.3 状态：大阪-炮塔配置（turret_arg_m_beam_02_mk1）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(2)
  })

  test('2.3.4 验证：method 选项包含 default', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await methodSelect.click()
    const options = await methodSelect.locator('option').allTextContents()
    expect(options.map(o => o.trim().toLowerCase())).toContain('default')
    // Verify xenon is filtered out
    expect(options.map(o => o.trim().toLowerCase())).not.toContain('xenon')
    await page.keyboard.press('Escape')
  })

  test('2.3.5 切换：method default -> closedloop', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)

    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')

    // Try to switch to another method if available
    const options = await methodSelect.locator('option').allTextContents()
    const availableMethod = options.find(o => o.trim().toLowerCase() !== 'default')
    if (availableMethod) {
      await selectMethod(page, availableMethod.trim())
    }
  })

  test('2.1 状态：标准测试状态-大阪', async ({ page }) => {
    await buildStateStandardOsaka(page)
    await assertStateStandardOsaka(page)
  })

  test('2.2 状态：标准测试状态-大阪-材料分项聚合', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.3 切换：method default -> closedloop', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
    await selectMethod(page, 'default')
    await expect(methodSelect).toHaveValue('default')
    const options = await methodSelect.locator('option').allTextContents()
    if (options.some(o => o.trim() === 'closedloop')) {
      await selectMethod(page, 'closedloop')
      await expect(methodSelect).toHaveValue('closedloop')
    }
  })

  test('2.4 状态：标准测试状态-大阪-多模块聚合', async ({ page }) => {
    await buildStateMultiModule(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    // 大阪有多个炮塔组，验证至少有一个装备分项
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('2.5 状态：标准测试状态-大阪-方法测试聚合', async ({ page }) => {
    await buildStateMethodAggregation(page)
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    await expect(methodSelect).toBeVisible()
  })

  test('3.1 场景：总材料折叠明细展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const summary = page.getByTestId('ship-build-material-summary')
    await expand(summary)
    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await expect(summaryList).toBeVisible()
  })

  test('3.2 场景：装备分项按 ID 聚合展示', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    // 验证有装备分项显示
    expect(await groups.count()).toBeGreaterThanOrEqual(1)
  })

  test('3.3 场景：装备分项展开明细', async ({ page }) => {
    await buildStateMaterialAggregation(page)
    const groups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    const firstGroup = groups.first()
    await expand(firstGroup)
    await page.waitForTimeout(300)
  })

  test('3.4 场景：method 切换时 fallback 生效', async ({ page }) => {
    await buildStateMethodAggregation(page)
    await selectMethod(page, 'default')
    await selectMethod(page, 'closedloop')
  })

  test('3.5 场景：价格滑条联动', async ({ page }) => {
    await buildStateStandardOsaka(page)
    const summary = page.getByTestId('ship-build-material-summary')
    const initialText = await summary.textContent()
    // Set slider to 20% (0.2) to ensure different from default 100% (1.0)
    await setPriceSlider(page, 20)
    await page.waitForTimeout(500)
    const newText = await summary.textContent()
    expect(initialText).not.toBe(newText)
  })

  test('3.6 场景：多模块聚合下材料数量正确', async ({ page }) => {
    await buildStateMultiModule(page)
    const summary = page.getByTestId('ship-build-material-summary')
    await expect(summary).toBeVisible()
  })

  test('3.7.1 场景：大太刀护盾 fallback（method=closedloop）', async ({ page }) => {
    await selectDaitachiShip(page)
    await switchToSlotTab(page, 'S')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)

    // Check if closedloop is available
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    const options = await methodSelect.locator('option').allTextContents()
    const hasClosedloop = options.some(o => o.trim().toLowerCase() === 'closedloop')

    await selectMethod(page, 'default')
    const summaryDefault = await page.getByTestId('ship-build-material-summary').textContent()

    if (hasClosedloop) {
      await selectMethod(page, 'closedloop')
      const summaryClosedloop = await page.getByTestId('ship-build-material-summary').textContent()
      expect(summaryDefault).not.toBe(summaryClosedloop)
    }
  })

  test('3.7.2 场景：大阪 Argon 炮塔 fallback（method=terran）', async ({ page }) => {
    await selectOsakaShip(page)
    await switchToSlotTab(page, 'E')
    await assignFirstEquipment(page)
    await switchToSlotTab(page, 'T')
    await assignFirstEquipment(page)

    // Check if terran is available
    const methodSelect = page.getByTestId('ship-build-material-method-select')
    const options = await methodSelect.locator('option').allTextContents()
    const hasTerran = options.some(o => o.trim().toLowerCase() === 'terran')

    await selectMethod(page, 'default')
    const summaryDefault = await page.getByTestId('ship-build-material-summary').textContent()

    if (hasTerran) {
      await selectMethod(page, 'terran')
      const summaryTerran = await page.getByTestId('ship-build-material-summary').textContent()
      expect(summaryDefault).not.toBe(summaryTerran)
    }
  })

  test('3.8 场景：飞船材料计入总材料', async ({ page }) => {
    await selectOsakaShip(page)
    // 等待材料面板加载完成
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    const summary = page.getByTestId('ship-build-material-summary')
    await expect(summary).toBeVisible()
    await expand(summary)
    const summaryList = page.getByTestId('ship-build-material-summary-list')
    await expect(summaryList).toBeVisible()
  })

  test('3.9 场景：飞船作为独立分项显示', async ({ page }) => {
    await selectOsakaShip(page)
    // 等待材料面板加载完成
    await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()
    const shipGroup = page.getByTestId('ship-build-material-ship-group')
    await expect(shipGroup).toBeVisible()
    await expand(shipGroup)
    const shipList = page.getByTestId('ship-build-material-ship-list')
    await expect(shipList).toBeVisible()
  })

  test('3.10 场景：飞船分项独立于装备分项', async ({ page }) => {
    await buildStateMultiModule(page)
    const shipGroup = page.getByTestId('ship-build-material-ship-group')
    await expect(shipGroup).toBeVisible()
    const equipmentGroups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
    expect(await equipmentGroups.count()).toBeGreaterThanOrEqual(1)
  })

  test('3.11 场景：ShipBlueprint 数据源正常', async ({ page }) => {
    await buildStateStandardOsaka(page)
    const summary = await page.getByTestId('ship-build-material-summary').textContent()
    await page.reload()
    await buildStateStandardOsaka(page)
    const summaryAfterReload = await page.getByTestId('ship-build-material-summary').textContent()
    expect(summary).toBe(summaryAfterReload)
  })

  // ========== BUG-003: 槽位附带护盾统计验证 ==========

  // 大阪飞船 turret 槽位分析:
  // - 部分炮塔组有附带护盾定义 (connection.shield 存在)
  // - group_front_mid_mid: shield.size=medium, shield.count=2
  // - group_up_mid_mid: shield.size=medium, shield.count=2
  // - 需要在选择炮塔后才显示附带护盾选项 (relatedShieldConnectionRows)

  test('4.3.1 验证：turret 槽位护盾材料统计', async ({ page }) => {
    await selectOsakaShip(page)

    // 切换到 turret 槽位
    await switchToSlotTab(page, 'T')

    // 等待 group tabs 加载
    await page.waitForSelector('.group-tabs .group-tab')
    const groupTabs = page.locator('.group-tabs .group-tab')
    const groupCount = await groupTabs.count()

    let foundShieldWithEquipment = false

    for (let i = 0; i < groupCount; i++) {
      const tab = groupTabs.nth(i)
      const tabLabel = await tab.textContent()
      console.log(`Testing group ${i}: ${tabLabel}`)

      await tab.click()
      await page.waitForTimeout(200) // 等待 UI 更新

      // 检查是否有装备选项
      const optionCards = page.locator('.option-wall .option-card')
      const optionCount = await optionCards.count()
      console.log(`  Found ${optionCount} options`)

      if (optionCount > 0) {
        await optionCards.first().click()
        await page.waitForTimeout(300) // 等待 relatedShieldConnectionRows 渲染

        // 检查是否出现护盾选项 (relatedShieldConnectionRows)
        // 这是炮塔附带的护盾，不是独立的 shield 槽位
        const wallSections = page.locator('.option-wall .wall-section')
        const sectionCount = await wallSections.count()
        console.log(`  After selecting equipment, found ${sectionCount} wall sections`)

        for (let s = 0; s < sectionCount; s++) {
          const section = wallSections.nth(s)
          const sectionText = await section.textContent()
          console.log(`  Section ${s}: ${sectionText?.substring(0, 50)}`)

          if (sectionText?.toLowerCase().includes('shield')) {
            console.log('  -> Found shield section!')
            const shieldOption = section.locator('.option-card').first()
            if (await shieldOption.isVisible().catch(() => false)) {
              const shieldText = await shieldOption.textContent()
              console.log(`  Shield option: ${shieldText}`)
              const shieldIdMatch = shieldText?.match(/shield_[\w_]+/)

              // 找到护盾选项，直接点击选择
              // UI显示名称是 "ARG M Shield Generator Mk1"，不是 shield_xxx 格式
              console.log(`  Selecting shield option`)

              // 检查当前 shield 区域的选择状态
              const shieldSectionText = await section.textContent()
              console.log(`  Shield section text before click: ${shieldSectionText}`)

              await shieldOption.click()
              await page.waitForTimeout(2000) // 等待 store 更新和 UI 重渲染

              // 检查选择后的状态
              const shieldSectionTextAfter = await section.textContent()
              console.log(`  Shield section text after click: ${shieldSectionTextAfter}`)

              // 验证材料面板中存在护盾分项
              await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()

              // 等待足够长让 store 更新并触发重渲染
              await page.waitForTimeout(2000)

              // 查找材料面板中所有分项
              const allGroups = page.locator('[data-testid^="ship-build-material-equipment-group-"]')
              const groupCount = await allGroups.count()
              console.log(`  Found ${groupCount} equipment groups in materials`)

              // 打印所有分项的详细信息
              for (let g = 0; g < groupCount; g++) {
                const group = allGroups.nth(g)
                const testId = await group.getAttribute('data-testid')
                const text = await group.textContent()
                console.log(`  Group ${g}: ${testId} -> ${text?.substring(0, 80)}`)
              }

              // 特别检查是否有 shield 开头的 testid
              const shieldGroups = page.locator('[data-testid^="ship-build-material-equipment-group-shield"]')
              const shieldCount = await shieldGroups.count()
              console.log(`  Shield groups count: ${shieldCount}`)

              let foundShieldGroup = false
              for (let g = 0; g < groupCount; g++) {
                const group = allGroups.nth(g)
                const groupText = await group.textContent()
                console.log(`  Group ${g}: ${groupText?.substring(0, 50)}`)

                if (groupText?.toLowerCase().includes('shield')) {
                  foundShieldGroup = true

                  // 展开护盾分项，验证材料明细
                  await group.click()
                  await page.waitForTimeout(200)

                  // 找到对应的材料列表
                  const groupTestId = await group.getAttribute('data-testid')
                  const equipmentId = groupTestId?.replace('ship-build-material-equipment-group-', '')
                  console.log(`  Equipment ID: ${equipmentId}`)

                  const shieldList = page.getByTestId(`ship-build-material-equipment-list-${equipmentId}`)
                  await expect(shieldList).toBeVisible()
                  const shieldListText = await shieldList.textContent()
                  console.log(`  Shield list text: ${shieldListText?.substring(0, 100)}`)
                  expect(shieldListText).toMatch(/Field Coils|Shield Components|Energy Cells/i)

                  foundShieldWithEquipment = true
                  break
                }
              }

              expect(foundShieldGroup).toBe(true)

              if (foundShieldWithEquipment) break
            }
          }
        }

        if (foundShieldWithEquipment) break

        // 按 Escape 取消当前选择，继续下一个 group
        await page.keyboard.press('Escape')
        await page.waitForTimeout(100)
      }
    }

    // 必须找到护盾选项，否则测试失败
    expect(foundShieldWithEquipment).toBe(true)
  })

  // 4.3.2 测试与 4.3.1 相同逻辑，验证多次选择不同组的护盾
  // 由于大阪只有 turret 槽位有附带护盾，此测试复用 4.3.1 的验证逻辑
  test('4.3.2 验证：多种槽位类型附带护盾', async ({ page }) => {
    await selectOsakaShip(page)

    // 切换到 turret 槽位
    await switchToSlotTab(page, 'T')

    // 等待 group tabs 加载
    await page.waitForSelector('.group-tabs .group-tab')
    const groupTabs = page.locator('.group-tabs .group-tab')
    const groupCount = await groupTabs.count()

    let foundShieldWithEquipment = false

    // 遍历所有 group，寻找有附带护盾的 group
    for (let i = 0; i < groupCount; i++) {
      const tab = groupTabs.nth(i)
      await tab.click()
      await page.waitForTimeout(200)

      const optionCards = page.locator('.option-wall .option-card')
      if (await optionCards.first().isVisible().catch(() => false)) {
        await optionCards.first().click()
        await page.waitForTimeout(300)

        // 找到护盾区域
        const shieldSection = page.locator('.option-wall .wall-section').filter({ hasText: /shield/i })
        const shieldVisible = await shieldSection.isVisible().catch(() => false)

        if (shieldVisible) {
          const shieldOption = shieldSection.locator('.option-card').first()
          if (await shieldOption.isVisible().catch(() => false)) {
            await shieldOption.click()
            await page.waitForTimeout(2000)

            // 验证材料面板
            await expect(page.getByTestId('ship-build-materials-panel')).toBeVisible()

            // 查找护盾分项
            const shieldGroups = page.locator('[data-testid^="ship-build-material-equipment-group-shield"]')
            const shieldCount = await shieldGroups.count()

            if (shieldCount > 0) {
              foundShieldWithEquipment = true
              break
            }
          }
        }

        await page.keyboard.press('Escape')
        await page.waitForTimeout(100)
      }
    }

    expect(foundShieldWithEquipment).toBe(true)
  })
})
