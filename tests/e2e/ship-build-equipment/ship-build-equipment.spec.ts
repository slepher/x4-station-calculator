import { expect } from '@playwright/test'
import { test } from '../../test-setup'

type ShipStateConfig = {
  classLabel: 'M' | 'L'
  racePattern: RegExp
  shipPattern: RegExp
}

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
  await expect(page.getByTestId('ship-build-filters')).toBeVisible()
}

const enterShipState = async (page: any, config: ShipStateConfig) => {
  await openShipBuild(page)

  const changeShip = page.getByRole('button', { name: /Change Ship|更换飞船/ })
  if (await changeShip.isVisible().catch(() => false)) {
    await changeShip.click()
  }

  await page.getByTestId('ship-build-filter-class').getByRole('button', { name: config.classLabel, exact: true }).click()
  await page.getByTestId('ship-build-filter-race').getByRole('button', { name: config.racePattern }).click()

  const targetShip = page.locator('.list-item').filter({ hasText: config.shipPattern }).first()
  await expect(targetShip).toBeVisible()
  await targetShip.click()

  await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
}

const enterOdachiState = async (page: any) => {
  await enterShipState(page, {
    classLabel: 'M',
    racePattern: /terran/i,
    shipPattern: /Odachi|大太刀/
  })
}

const enterOsakaState = async (page: any) => {
  await enterShipState(page, {
    classLabel: 'L',
    racePattern: /terran/i,
    shipPattern: /Osaka|大阪/
  })
}

const enterHeronState = async (page: any) => {
  await enterShipState(page, {
    classLabel: 'L',
    racePattern: /teladi/i,
    shipPattern: /Heron|苍鹭/
  })
}

const switchToSlotTab = async (page: any, label: 'E' | 'S' | 'W' | 'T') => {
  const slotTypeBtn = page.locator('.left-rail .slot-type-btn').filter({ hasText: new RegExp(`^${label}$`) }).first()
  await expect(slotTypeBtn).toBeVisible()
  await slotTypeBtn.click()
  const firstGroup = page.locator('.group-tabs .group-tab').first()
  await expect(firstGroup).toBeVisible()
  await firstGroup.click()
}

const openTurretGroupByLabel = async (page: any, groupLabel: string) => {
  await switchToSlotTab(page, 'T')
  const target = page.locator('.group-tabs .group-tab').filter({ hasText: new RegExp(`^${groupLabel}$`) }).first()
  await expect(target).toBeVisible()
  await target.click()
}

test.describe('ship-build-equipment', () => {
  test('2.1 状态：标准测试状态-大太刀', async ({ page }) => {
    await enterOdachiState(page)
    await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    await expect(page.getByTestId('ship-build-panel-stats')).toBeVisible()
    await expect(page.getByTestId('ship-build-panel-materials')).toBeVisible()
  })

  test('2.4 状态：标准模式默认激活', async ({ page }) => {
    await enterOdachiState(page)
    const modeTabs = page.locator('.mode-tabs .mode-tab')
    await expect(modeTabs.nth(0)).toHaveClass(/active/)
  })

  test('2.5 状态：标准测试状态-大太刀-炮塔标签', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.option-wall .wall-section').first()).toBeVisible()
  })

  test('2.6 状态：标准测试状态-大太刀-简化模式', async ({ page }) => {
    await enterOdachiState(page)
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toHaveClass(/active/)
  })

  test('2.7 切换：标准模式->简化模式', async ({ page }) => {
    await enterOdachiState(page)
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toHaveClass(/active/)
  })

  test('2.8 切换：简化模式->标准模式', async ({ page }) => {
    await enterOdachiState(page)
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toHaveClass(/active/)
    await page.locator('.mode-tabs .mode-tab').nth(0).click()
    await expect(page.locator('.mode-tabs .mode-tab').nth(0)).toHaveClass(/active/)
  })

  test('3.2 场景：标准模式逐 connection group 分配', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')

    const optionCards = page.locator('.option-wall .option-card')
    await expect(optionCards.first()).toBeVisible()
    await optionCards.first().click()

    const secondGroup = page.locator('.group-tabs .group-tab').nth(1)
    await expect(secondGroup).toBeVisible()
    await secondGroup.click()

    const secondGroupCards = page.locator('.option-wall .option-card')
    await expect(secondGroupCards.first()).toBeVisible()
    await secondGroupCards.first().click()

    await expect(page.locator('.option-wall .option-card-active').first()).toBeVisible()
  })

  test('3.3 场景：大太刀 advanced 配装基线', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'E')
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
    await switchToSlotTab(page, 'S')
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
    await switchToSlotTab(page, 'W')
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
  })

  test('3.4 场景：简化模式按 group 批量分配', async ({ page }) => {
    await enterOdachiState(page)
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await switchToSlotTab(page, 'T')
    const optionCards = page.locator('.option-wall .option-card')
    await expect(optionCards.first()).toBeVisible()
    await optionCards.first().click()
    await expect(page.locator('.option-wall .option-card-active').first()).toBeVisible()
  })

  test('3.1 场景：Bug修复验证 BUG-001（主槽位+从属护盾不再误触发冲突）', async ({ page }) => {
    await enterOsakaState(page)
    await openTurretGroupByLabel(page, 'M1')
    const sections = page.locator('.option-wall .wall-section')
    await expect(sections).toHaveCount(2)

    await sections.nth(0).locator('.option-card').first().click()
    await sections.nth(1).locator('.option-card').first().click()

    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toBeEnabled()
  })

  test('3.5 场景：同一标签内同时提供主槽位与护盾选择', async ({ page }) => {
    await enterOsakaState(page)
    await openTurretGroupByLabel(page, 'M1')

    const sections = page.locator('.option-wall .wall-section')
    await expect(sections).toHaveCount(2)
    await expect(sections.nth(0).locator('.option-card').first()).toBeVisible()
    await expect(sections.nth(1).locator('.option-card').first()).toBeVisible()

    await sections.nth(0).locator('.option-card').first().click()
    await sections.nth(1).locator('.option-card').first().click()
    await expect(page.locator('.option-wall .option-card-active')).toHaveCount(2)
  })

  test('3.6 场景：候选过滤符合 type + size + slotTags(ALL-match)', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')

    const filterCheck = await page.evaluate(() => {
      const store = (window as any).shipBuildStore
      const row = store.connectionRows.find((item: any) => item.slotType === 'turret' && Array.isArray(item.tags) && item.tags.length > 0)
      if (!row) return null
      const normalize = (tags: any[]) => tags.map((tag) => String(tag).toLowerCase())
      const required = normalize(row.tags)
      const mismatched = row.options
        .filter((opt: any) => {
          const optionTags = new Set(normalize(Array.isArray(opt.tags) ? opt.tags : []))
          return !required.every((tag) => optionTags.has(tag))
        })
        .map((opt: any) => opt.id)
      return {
        required,
        optionCount: row.options.length,
        mismatched
      }
    })

    expect(filterCheck).toBeTruthy()
    expect(filterCheck!.optionCount).toBeGreaterThan(0)
    expect(filterCheck!.mismatched).toEqual([])
    await expect(page.locator('.compatibility-line.tags')).not.toContainText(/hittable|unhittable/i)
  })

  test('3.7 场景：hittable/unhittable 按普通 slotTags 参与 ALL 匹配', async ({ page }) => {
    await enterOsakaState(page)
    await openTurretGroupByLabel(page, 'M1')

    const specialTagRows = await page.evaluate(() => {
      const store = (window as any).shipBuildStore
      const normalize = (tags: any[]) => tags.map((tag) => String(tag).toLowerCase())
      const rows = store.connectionRows.filter(
        (row: any) =>
          row.slotType === 'turret' &&
          Array.isArray(row.tags) &&
          row.tags.some((tag: any) => ['hittable', 'unhittable'].includes(String(tag).toLowerCase())) &&
          Array.isArray(row.options) &&
          row.options.length > 0
      )
      return rows.map((row: any) => {
        const connectionTags = new Set(normalize(row.tags))
        const mismatched = row.options
          .filter((opt: any) => {
            const optionTags = normalize(Array.isArray(opt.tags) ? opt.tags : [])
            return !optionTags.every((tag) => connectionTags.has(tag))
          })
          .map((opt: any) => opt.id)
        return {
          connectionKey: row.connectionKey,
          required: Array.from(connectionTags),
          optionCount: row.options.length,
          mismatched
        }
      })
    })

    expect(specialTagRows.length).toBeGreaterThan(0)
    for (const rowCheck of specialTagRows) {
      expect(rowCheck.optionCount).toBeGreaterThan(0)
      expect(rowCheck.mismatched).toEqual([])
    }
    await expect(page.locator('.compatibility-line.tags')).not.toContainText(/hittable|unhittable/i)
  })

  test('3.8 场景：hittable 与 unhittable 不互相匹配', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    const cardNames = page.locator('.option-wall .wall-section').first().locator('.card-name')
    await expect(cardNames.filter({ hasText: /laser.*04/i })).toHaveCount(0)
  })

  test('3.9 场景：shield 不使用 integrated 特例', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'S')
    await expect(page.locator('.compatibility-line.tags')).not.toContainText(/integrated/i)
  })

  test('3.10 场景：候选视图名称标准化', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    await expect(page.getByText(/Nebula|Hangar|Tactical/i)).toHaveCount(0)
  })

  test('3.11 场景：装备名称在标准/简化模式一致', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    const firstName = await page.locator('.option-wall .option-card .card-name').first().innerText()
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.option-wall .option-card .card-name').first()).toContainText(firstName)
  })

  test('3.13 场景：候选卡片不显示图片占位', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.option-wall .option-card img')).toHaveCount(0)
  })

  test('3.12 场景：noplayerblueprint=true 不参与候选', async ({ page }) => {
    await enterOsakaState(page)
    await openTurretGroupByLabel(page, 'M1')
    const optionIds = await page.evaluate(() => {
      const store = (window as any).shipBuildStore
      const row = store.connectionRows.find((item: any) => item.slotType === 'turret' && item.groupName === 'group_back_down_mid')
      return row ? row.options.map((opt: any) => opt.id) : []
    })
    expect(optionIds).not.toContain('turret_xen_m_beam_02_mk1')
  })

  test('3.14 场景：mock-简化模式同 size 不同 tags 拆分标签', async ({ page }) => {
    await enterOdachiState(page)
    await page.evaluate(() => {
      const store = (window as any).shipBuildStore
      store.setMockTagPatch({
        targetShipId: 'ship_ter_m_corvette_02_a',
        slotType: 'turret',
        connections: {
          'ship_ter_m_corvette_02_a::turret::4::0': {
            groupName: 'con_turret_m_01',
            size: 'medium',
            tags: ['advanced', 'combat', 'unhittable']
          },
          'ship_ter_m_corvette_02_a::turret::4::1': {
            groupName: 'con_turret_m_02',
            size: 'medium',
            tags: ['advanced', 'combat', 'missile']
          }
        }
      })
    })
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.group-tabs .group-tab').filter({ hasText: /^M1$/ })).toHaveCount(1)
    await expect(page.locator('.group-tabs .group-tab').filter({ hasText: /^M2$/ })).toHaveCount(1)
  })

  test('3.15 场景：护盾统计不跨父槽位串组', async ({ page }) => {
    await enterOsakaState(page)
    await page.locator('.mode-tabs .mode-tab').nth(1).click()
    await switchToSlotTab(page, 'T')
    const pickedValues = page.locator('.option-wall .wall-section .picked')
    await expect(pickedValues).toHaveCount(2)
    await expect(pickedValues.nth(0)).toContainText('/')
    await expect(pickedValues.nth(1)).toContainText('/')
  })

  test('3.16 场景：大阪高炮塔数量分组稳定', async ({ page }) => {
    await enterOsakaState(page)
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.group-tabs .group-tab')).toHaveCount(9)
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
  })

  test('3.17 场景：苍鹭筛选链路与配装可见性', async ({ page }) => {
    await enterHeronState(page)
    await switchToSlotTab(page, 'T')
    await expect(page.locator('.option-wall .option-card').first()).toBeVisible()
  })

  test('3.18 场景：同类型多装备导致简化切换置灰', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    const firstSectionCards = page.locator('.option-wall .wall-section').first().locator('.option-card')
    await expect(firstSectionCards.first()).toBeVisible()
    await firstSectionCards.nth(0).click()

    const secondGroup = page.locator('.group-tabs .group-tab').nth(1)
    await secondGroup.click()
    const secondSectionCards = page.locator('.option-wall .wall-section').first().locator('.option-card')
    await expect(secondSectionCards.nth(1)).toBeVisible()
    await secondSectionCards.nth(1).click()

    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toBeDisabled()
  })

  test('3.19 场景：冲突解除后恢复切换', async ({ page }) => {
    await enterOdachiState(page)
    await switchToSlotTab(page, 'T')
    const firstGroupCards = page.locator('.option-wall .option-card')
    await firstGroupCards.nth(0).click()

    const secondGroup = page.locator('.group-tabs .group-tab').nth(1)
    await secondGroup.click()
    const secondGroupCards = page.locator('.option-wall .option-card')
    await secondGroupCards.nth(0).click()

    await expect(page.locator('.mode-tabs .mode-tab').nth(1)).toBeEnabled()
  })
})
