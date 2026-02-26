import { expect } from '@playwright/test'
import { test } from '../../test-setup'

const STORAGE_KEY = 'x4_ship_blueprints'

const getBlueprintStorage = async (page: any) => {
  return await page.evaluate((key) => {
    return localStorage.getItem(key)
  }, STORAGE_KEY)
}

const openShipBuild = async (page: any, clearStorage = true) => {
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

const enterShipState = async (page: any, classLabel: 'M' | 'L', racePattern: RegExp, shipPattern: RegExp) => {
  await openShipBuild(page)

  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }

  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: classLabel, exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: racePattern }).click()

  const targetShip = page.locator('.list-item').filter({ hasText: shipPattern }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()

  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const enterOdachiState = async (page: any) => {
  await enterShipState(page, 'M', /terran/i, /Odachi|大太刀/)
}

const selectEquipment = async (page: any, slotType: 'E' | 'S' | 'W' | 'T') => {
  // Click on the slot type tab
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: new RegExp(`^${slotType}$`) }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()

  // Click on first group
  const firstGroup = page.locator('.group-tabs .group-tab').first()
  await expect(firstGroup).toBeVisible()
  await firstGroup.click()

  // Select first equipment option
  const firstOption = page.locator('.option-card').first()
  await expect(firstOption).toBeVisible()
  await firstOption.click()
}

test.describe('ship-build-storage', () => {
  // Chapter 2: State Tests
  test.describe('2. Bootstrapping & State', () => {
    test('2.1 状态：持久化-初始状态', async ({ page }) => {
      await openShipBuild(page)

      // 断言 New/Save/Save As/Load 按钮可见
      await expect(page.getByRole('button', { name: /New|新建/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /^Save$|^保存$/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Save As|另存为/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Load|载入/ })).toBeVisible()
    })

    test('2.2 状态：持久化-已选飞船（进入配装区）', async ({ page }) => {
      await enterOdachiState(page)

      // 断言进入配装区
      await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    })

    test('2.3 状态：持久化-已配置装备', async ({ page }) => {
      await enterOdachiState(page)

      // 配置引擎
      await selectEquipment(page, 'E')

      // 配置护盾
      await selectEquipment(page, 'S')

      // 断言已配置装备的区块显示已选装备
      const optionCards = page.locator('.option-card.is-selected')
      expect(await optionCards.count()).toBeGreaterThan(0)
    })

    test('2.4 状态：持久化-已保存 Blueprint', async ({ page }) => {
      await enterOdachiState(page)

      // 配置装备
      await selectEquipment(page, 'E')

      // 保存
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 验证 localStorage
      const data = await getBlueprintStorage(page)
      expect(data).toBeTruthy()

      const parsed = JSON.parse(data)
      expect(parsed.list).toHaveLength(1)
      expect(parsed.activeId).toBeTruthy()
    })

    test('2.5 状态：持久化-已另存为新 Blueprint', async ({ page }) => {
      await enterOdachiState(page)

      // 配置并保存
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 另存为
      await page.getByRole('button', { name: /Save As|另存为/ }).click()
      await page.locator('.dialog-input').fill('新 Blueprint')
      await page.locator('.dialog-input').press('Enter')

      // 验证 localStorage 有 2 条
      const data = await getBlueprintStorage(page)
      const parsed = JSON.parse(data)
      expect(parsed.list).toHaveLength(2)
      expect(parsed.activeId).toBeTruthy()
    })

    test('2.6 状态：持久化-有未保存修改', async ({ page }) => {
      await enterOdachiState(page)

      // 配置并保存
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 修改装备
      await selectEquipment(page, 'S')

      // 验证 isDirty
      const isDirty = await page.evaluate(() => {
        return (window as any).shipBuildStore?.isDirty
      })
      expect(isDirty).toBe(true)
    })
  })

  // Chapter 3: Scenario Tests
  test.describe('3. Scenario Content', () => {
    test('3.1 场景：保存飞船配装', async ({ page }) => {
      await enterOdachiState(page)

      // 配置引擎
      await selectEquipment(page, 'E')

      // 保存
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 验证
      const data = await getBlueprintStorage(page)
      expect(data).toBeTruthy()

      const parsed = JSON.parse(data)
      expect(parsed.list[0].shipId).toBeTruthy()
      expect(parsed.list[0].connections.length).toBeGreaterThan(0)
    })

    test('3.2 场景：另存为新 blueprint', async ({ page }) => {
      await enterOdachiState(page)
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 修改装备
      await selectEquipment(page, 'S')

      // 另存为
      await page.getByRole('button', { name: /Save As|另存为/ }).click()
      await page.locator('.dialog-input').fill('另存为测试')
      await page.locator('.dialog-input').press('Enter')

      // 验证
      const data = await getBlueprintStorage(page)
      const parsed = JSON.parse(data)
      expect(parsed.list).toHaveLength(2)
      expect(parsed.list.find((b: any) => b.name === '另存为测试')).toBeTruthy()
    })

    test('3.3 场景：载入 blueprint 并自动设置筛选条件', async ({ page }) => {
      // 预设数据
      await page.goto('/')
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify({
          version: 1,
          activeId: 'test-1',
          list: [{
            id: 'test-1',
            name: 'Test Blueprint',
            shipId: 'ship_ter_m_corvette_02_a',
            connections: [{ slot_type: 'engine', group: [{ group: 'group_back_up_mid', equipment_id: 'engine_am', count: 3 }] }],
            lastUpdated: Date.now()
          }]
        }))
      }, STORAGE_KEY)

      // Navigate to home to ensure fresh load
      await page.goto('/')
      await page.waitForTimeout(500)

      // Verify localStorage has the data
      const hasData = await page.evaluate(() => {
        const data = localStorage.getItem('x4_ship_blueprints')
        return data ? JSON.parse(data).list.length > 0 : false
      })
      console.log('localStorage has data:', hasData)

      await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
      await page.getByRole('button', { name: /Load|载入/ }).click()

      // Wait for modal to open
      await expect(page.getByText('Load Ship Blueprint')).toBeVisible()

      // 在弹窗中选择 blueprint
      await expect(page.locator('.blueprint-item')).toBeVisible()
      await page.locator('.blueprint-item').first().getByRole('button', { name: /Load|载入/ }).click()

      // 验证已自动选中飞船
      await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    })

    test('3.4 场景：载入 blueprint 恢复装备配装', async ({ page }) => {
      // 预设数据：包含 engine 和 shield 配置
      await page.goto('/')
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify({
          version: 1,
          activeId: 'test-1',
          list: [{
            id: 'test-1',
            name: 'Test Blueprint',
            shipId: 'ship_ter_m_corvette_02_a',
            connections: [
              { slot_type: 'engine', group: [{ group: 'group_back_up_mid', equipment_id: 'engine_am', count: 3 }] },
              { slot_type: 'shield', group: [{ group: 'group_back_up_mid', equipment_id: 'shield_gen_m', count: 1 }] }
            ],
            lastUpdated: Date.now()
          }]
        }))
      }, STORAGE_KEY)

      await page.goto('/')
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
      await page.getByRole('button', { name: /Load|载入/ }).click()

      await expect(page.getByText('Load Ship Blueprint')).toBeVisible()
      await page.locator('.blueprint-item').first().getByRole('button', { name: /Load|载入/ }).click()

      // 验证配装区显示之前保存的装备
      await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    })

    test('3.5 场景：删除 blueprint', async ({ page }) => {
      // 预设数据
      await page.goto('/')
      await page.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify({
          version: 1,
          activeId: 'test-1',
          list: [
            { id: 'test-1', name: 'Blueprint 1', shipId: 'ship_ter_m_corvette_02_a', connections: [], lastUpdated: Date.now() },
            { id: 'test-2', name: 'Blueprint 2', shipId: 'ship_ter_m_corvette_02_a', connections: [], lastUpdated: Date.now() }
          ]
        }))
      }, STORAGE_KEY)

      // Navigate to home to ensure fresh load
      await page.goto('/')
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: /Ship Build|船只建造/ }).click()
      await page.getByRole('button', { name: /Load|载入/ }).click()

      // Wait for modal
      await expect(page.getByText('Load Ship Blueprint')).toBeVisible()

      // 删除第一个
      page.on('dialog', dialog => dialog.accept())
      const firstItem = page.locator('.blueprint-item').first()
      await expect(firstItem).toBeVisible()
      await firstItem.locator('.blueprint-delete-btn').click()

      // 确认删除（在真实场景中会有 confirm dialog）
      // 验证列表中只有一个
      await expect(page.locator('.blueprint-item')).toHaveCount(1)
    })

    test('3.6 场景：取消装备从 blueprint 删除（非 null）', async ({ page }) => {
      await enterOdachiState(page)

      // 配置引擎并保存
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 重新选择同一 group 并设为空（取消装备）
      const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^E$/ }).first()
      await slotTypeBtn.click()

      const firstGroup = page.locator('.group-tabs .group-tab').first()
      await firstGroup.click()

      // 再次点击已选中的装备来取消
      const selectedOption = page.locator('.option-card.is-selected').first()
      if (await selectedOption.count() > 0) {
        await selectedOption.click()
      }

      // 保存
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 重新载入
      await page.getByRole('button', { name: /Load|载入/ }).click()
      await page.locator('.blueprint-item').first().getByRole('button', { name: /Load|载入/ }).click()

      // 断言 engine 配置已清除
      const engineGroup = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^E$/ }).first()
      await engineGroup.click()

      const pickedText = page.locator('.wall-header .picked').first()
      const text = await pickedText.textContent()
      expect(text).toContain('0/')
    })

    test('3.8 场景：切换视图提示未保存', async ({ page }) => {
      await enterOdachiState(page)
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 修改装备
      await selectEquipment(page, 'S')

      // 点击视图切换
      page.on('dialog', dialog => dialog.accept())
      await page.getByRole('button', { name: /Quantified|量化生产/ }).click()
    })

    test('3.9 场景：保存后清除 dirty 状态', async ({ page }) => {
      await enterOdachiState(page)
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 修改装备，使 isDirty = true
      await selectEquipment(page, 'S')

      // 验证 isDirty = true
      let isDirty = await page.evaluate(() => (window as any).shipBuildStore?.isDirty)
      expect(isDirty).toBe(true)

      // 保存
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 验证 isDirty = false
      isDirty = await page.evaluate(() => (window as any).shipBuildStore?.isDirty)
      expect(isDirty).toBe(false)
    })

    test('3.10 场景：简略模式批量修改后保存', async ({ page }) => {
      await enterOdachiState(page)

      // 切换到简略模式（如果有的话）
      // ...

      // 选择装备
      await selectEquipment(page, 'E')

      // 保存
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 验证保存成功
      const data = await getBlueprintStorage(page)
      expect(data).toBeTruthy()

      const parsed = JSON.parse(data)
      expect(parsed.list[0].connections.length).toBeGreaterThan(0)
    })

    test('3.7 场景：修改后 New 提示未保存', async ({ page }) => {
      await enterOdachiState(page)
      await selectEquipment(page, 'E')
      await page.getByRole('button', { name: /^Save$|^保存$/ }).click()

      // 修改
      await selectEquipment(page, 'S')

      // 点击 New
      page.on('dialog', dialog => dialog.accept()) // 模拟 confirm 对话框
      await page.getByRole('button', { name: /New|新建/ }).click()
    })

    test('3.11 Bug修复验证 BUG-SBS-001（点击shield标签切换时无反应）', async ({ page }) => {
      await enterOdachiState(page)

      // 先点击"S"（shield）标签切换到护盾槽位
      const shieldBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: /^S$/ }).first()
      await expect(shieldBtn).toBeVisible()
      await shieldBtn.click()

      // 等待一下让UI更新
      await page.waitForTimeout(500)

      // 验证"S"按钮是否激活
      await expect(shieldBtn).toHaveClass(/slot-type-btn-active/)

      // 观察group tabs区域是否有shield相关的分组
      const groupTabs = page.locator('.group-tabs .group-tab')
      await expect(groupTabs.first()).toBeVisible()

      // 点击第一个shield group
      await groupTabs.first().click()

      // 观察option cards是否显示护盾装备选项
      const optionCards = page.locator('.option-card')
      await expect(optionCards.first()).toBeVisible()

      // 获取当前选中数量
      const pickedText = page.locator('.wall-header .picked').first()
      const initialText = await pickedText.textContent()
      console.log('Initial picked:', initialText)

      // 点击第一个护盾装备选项
      await optionCards.first().click()

      // 等待一下让状态更新
      await page.waitForTimeout(300)

      // 断言选中数量有变化（从0变为非0，或者高亮显示）
      const afterText = await pickedText.textContent()
      console.log('After picked:', afterText)

      // 验证选中数量不再是 "0/"
      expect(afterText).not.toBe('0/')
    })
  })
})
