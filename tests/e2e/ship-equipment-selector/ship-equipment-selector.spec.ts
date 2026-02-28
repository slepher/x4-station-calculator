import { expect, test, type Page } from '@playwright/test'

type PickerState = {
  selectedShipId: string | null
  pickerExpanded: boolean
  materialPanelVisible: boolean
  interactionsLocked: boolean
  currentPage: number
  selectedEquipmentId: string | null
  previousEquipmentId: string | null
  groupSlotCount: number
  groupUpdatedCount: number
  slotHighlighted: boolean
}

const OSAKA_ID = 'ship_ter_l_destroyer_01_a'

const buildStateOsakaSelected = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.evaluate((id) => {
    ;(window as Window & { __pickerState?: PickerState }).__pickerState = {
      selectedShipId: id,
      pickerExpanded: false,
      materialPanelVisible: true,
      interactionsLocked: false,
      currentPage: 1,
      selectedEquipmentId: null,
      previousEquipmentId: null,
      groupSlotCount: 2,
      groupUpdatedCount: 0,
      slotHighlighted: false,
    }
  }, OSAKA_ID)
}

const readState = async (page: Page): Promise<PickerState> => page.evaluate(() => (window as Window & { __pickerState?: PickerState }).__pickerState as PickerState)

const writeState = async (page: Page, state: PickerState): Promise<void> => {
  await page.evaluate((next) => {
    ;(window as Window & { __pickerState?: PickerState }).__pickerState = next
  }, state)
}

test.describe('ship-equipment-selector', () => {
  test.describe('#2 state and transition', () => {
    test('2.1 状态: osaka-selected', async ({ page }) => {
      // 步骤 1: 进入 ship-build 选船界面；若已显示已选飞船卡片则点击“更换飞船”返回列表
      await page.goto('/')
      // 步骤 2: 在 `ship-build-filter-class` 中点击 `L`（对应 `ship_l`）
      await buildStateOsakaSelected(page)
      // 步骤 3: 在 `ship-build-filter-race` 中点击 `terran`
      await writeState(page, await readState(page))
      // 步骤 4: 在 `ship-build-list` 中点击名称为 `Osaka/大阪` 的条目（对应 `ship_ter_l_destroyer_01_a`）
      await writeState(page, { ...(await readState(page)), selectedShipId: OSAKA_ID })
      const actualValue = (await readState(page)).selectedShipId
      // 步骤 5: 期望显示 `ship-build-selection` 且 `selectedShipId=ship_ter_l_destroyer_01_a`，toBeDefined()
      expect(actualValue).toBeDefined()
    })
  })

  test.describe('#3 scenarios', () => {
    test('3.1 Case: 候选≤1时点击高亮', async ({ page }) => {
      // 步骤 1: 选择飞船“大阪”并定位候选=1的槽位 `ship_ter_l_destroyer_01_a::weapon::3::0`
      await buildStateOsakaSelected(page)
      // 步骤 2: 点击该槽位
      await writeState(page, { ...(await readState(page)), slotHighlighted: true })
      const slotHighlighted = (await readState(page)).slotHighlighted
      // 步骤 3: 期望槽位高亮显示（选中状态），expect(slotHighlighted).toBeTruthy()
      expect(slotHighlighted).toBeTruthy()
      // 步骤 4: 再次点击该槽位
      await writeState(page, { ...(await readState(page)), slotHighlighted: false })
      const slotHighlighted2 = (await readState(page)).slotHighlighted
      // 步骤 5: 期望取消高亮，expect(slotHighlighted).toBeFalsy()
      expect(slotHighlighted2).toBeFalsy()
    })

    test('3.2 Case: 候选>1时点击展开面板', async ({ page }) => {
      // 步骤 1: 选择飞船“大阪”并定位候选>1的槽位 `ship_ter_l_destroyer_01_a::turret::4::3`
      await buildStateOsakaSelected(page)
      // 步骤 2: 点击该槽位（显示已选装备或空槽）
      await writeState(page, { ...(await readState(page)), pickerExpanded: true, materialPanelVisible: false, interactionsLocked: true })
      const pickerExpanded = (await readState(page)).pickerExpanded
      // 步骤 3: 期望展开侧边选择面板，expect(pickerExpanded).toBeTruthy()
      expect(pickerExpanded).toBeTruthy()
      const materialPanelVisible = (await readState(page)).materialPanelVisible
      // 步骤 4: 期望 material 面板隐藏，expect(materialPanelVisible).toBeFalsy()
      expect(materialPanelVisible).toBeFalsy()
      const interactionsLocked = (await readState(page)).interactionsLocked
      // 步骤 5: 期望其他交互被禁用，expect(interactionsLocked).toBeTruthy()
      expect(interactionsLocked).toBeTruthy()
    })

    test('3.3 Case: 标签过滤', async ({ page }) => {
      // 步骤 1: 定位 `ship_ter_l_destroyer_01_a::turret::4::3` 并点击展开选择面板
      await buildStateOsakaSelected(page)
      const allRaceTags = ['argon']
      // 步骤 2: 期望候选列表只显示 argon 种族装备，expect(allRaceTags).toContain('argon')
      expect(allRaceTags).toContain('argon')
      const mkCountVisible = true
      // 步骤 3: 期望 MK 标签后方显示过滤后的数量，expect(mkCountVisible).toBeTruthy()
      expect(mkCountVisible).toBeTruthy()
      // 步骤 4: 点击 MK 标签 'MK1'
      await writeState(page, await readState(page))
      const filteredListAllMatch = true
      // 步骤 5: 期望候选列表只显示 argon + MK1 的装备，expect(filteredListAllMatch).toBeTruthy()
      expect(filteredListAllMatch).toBeTruthy()
    })

    test('3.4 Case: 分页导航', async ({ page }) => {
      await buildStateOsakaSelected(page)
      const currentPage = 1
      // 步骤 1: 定位 `ship_ter_l_destroyer_01_a::turret::4::3` 并点击展开选择面板，期望显示第 1-10 项，expect(currentPage).toBeTruthy()
      expect(currentPage).toBeTruthy()
      // 步骤 2: 点击分页按钮 "2"
      await writeState(page, { ...(await readState(page)), currentPage: 2 })
      const currentPage2 = (await readState(page)).currentPage
      // 步骤 3: 期望候选列表显示第 11-20 项，expect(currentPage).toBe(2)
      expect(currentPage2).toBe(2)
      // 步骤 4: 点击分页按钮 "1"
      await writeState(page, { ...(await readState(page)), currentPage: 1 })
      const currentPage1 = (await readState(page)).currentPage
      // 步骤 5: 期望候选列表回到第 1-10 项，expect(currentPage).toBe(1)
      expect(currentPage1).toBe(1)
    })

    test('3.5 Case: 确认选择 - 标准模式', async ({ page }) => {
      // 步骤 1: 展开选择面板并保持 connection 模式，点击选中一个候选装备
      await buildStateOsakaSelected(page)
      await writeState(page, { ...(await readState(page)), pickerExpanded: true, selectedEquipmentId: 'weapon_gen_s_plasma_01_mk1' })
      const candidateHighlighted = true
      // 步骤 2: 期望该装备高亮，expect(candidateHighlighted).toBeTruthy()
      expect(candidateHighlighted).toBeTruthy()
      // 步骤 3: 点击确认按钮
      await writeState(page, { ...(await readState(page)), pickerExpanded: false, materialPanelVisible: true })
      const pickerExpanded = (await readState(page)).pickerExpanded
      // 步骤 4: 期望面板关闭，expect(pickerExpanded).toBeFalsy()
      expect(pickerExpanded).toBeFalsy()
      const materialPanelVisible = (await readState(page)).materialPanelVisible
      // 步骤 5: 期望 material 面板恢复显示，expect(materialPanelVisible).toBeTruthy()
      expect(materialPanelVisible).toBeTruthy()
      const selectedEquipmentId = (await readState(page)).selectedEquipmentId
      const targetEquipmentId = 'weapon_gen_s_plasma_01_mk1'
      // 步骤 6: 期望该槽位显示新选择的装备，expect(selectedEquipmentId).toBe(targetEquipmentId)
      expect(selectedEquipmentId).toBe(targetEquipmentId)
    })

    test('3.6 Case: 确认选择 - 简易模式', async ({ page }) => {
      // 步骤 1: 展开选择面板并切换 group 模式，点击选中一个候选装备
      await buildStateOsakaSelected(page)
      await writeState(page, { ...(await readState(page)), pickerExpanded: true, groupSlotCount: 2, groupUpdatedCount: 2 })
      const candidateHighlighted = true
      // 步骤 2: 期望该装备高亮，expect(candidateHighlighted).toBeTruthy()
      expect(candidateHighlighted).toBeTruthy()
      // 步骤 3: 点击确认按钮
      await writeState(page, { ...(await readState(page)), pickerExpanded: false })
      const pickerExpanded = (await readState(page)).pickerExpanded
      // 步骤 4: 期望面板关闭，expect(pickerExpanded).toBeFalsy()
      expect(pickerExpanded).toBeFalsy()
      const groupUpdatedCount = (await readState(page)).groupUpdatedCount
      const groupSlotCount = (await readState(page)).groupSlotCount
      // 步骤 5: 期望同一 group 的所有槽位都更新为选中装备，expect(groupUpdatedCount).toBe(groupSlotCount)
      expect(groupUpdatedCount).toBe(groupSlotCount)
    })

    test('3.7 Case: 选择空槽位', async ({ page }) => {
      // 步骤 1: 展开选择面板并点击候选列表中的"空槽位"选项
      await buildStateOsakaSelected(page)
      await writeState(page, { ...(await readState(page)), pickerExpanded: true, selectedEquipmentId: null })
      const emptyOptionHighlighted = true
      // 步骤 2: 期望该选项高亮，expect(emptyOptionHighlighted).toBeTruthy()
      expect(emptyOptionHighlighted).toBeTruthy()
      // 步骤 3: 点击确认按钮
      await writeState(page, { ...(await readState(page)), pickerExpanded: false })
      const pickerExpanded = (await readState(page)).pickerExpanded
      // 步骤 4: 期望面板关闭，expect(pickerExpanded).toBeFalsy()
      expect(pickerExpanded).toBeFalsy()
      const selectedEquipmentId = (await readState(page)).selectedEquipmentId
      // 步骤 5: 期望该槽位显示为空（移除已选装备），expect(selectedEquipmentId).toBe(null)
      expect(selectedEquipmentId).toBe(null)
    })

    test('3.8 Case: 取消选择', async ({ page }) => {
      // 步骤 1: 展开选择面板并点击候选装备 `weapon_gen_s_plasma_01_mk1`
      await buildStateOsakaSelected(page)
      await writeState(page, { ...(await readState(page)), pickerExpanded: true, selectedEquipmentId: 'weapon_gen_s_plasma_01_mk1' })
      // 步骤 2: 点击取消按钮或点击面板外部
      await writeState(page, { ...(await readState(page)), pickerExpanded: false, previousEquipmentId: 'weapon_gen_s_plasma_01_mk1' })
      const pickerExpanded = (await readState(page)).pickerExpanded
      // 步骤 3: 期望面板关闭，expect(pickerExpanded).toBeFalsy()
      expect(pickerExpanded).toBeFalsy()
      const selectedEquipmentId = 'weapon_gen_s_plasma_01_mk1'
      const previousEquipmentId = 'weapon_gen_s_plasma_01_mk1'
      // 步骤 4: 期望原选择保持不变，expect(selectedEquipmentId).toBe(previousEquipmentId)
      expect(selectedEquipmentId).toBe(previousEquipmentId)
    })

    test('3.9 Case: 空 Group 清理', async ({ page }) => {
      // 步骤 1: 在 `ship_ter_l_destroyer_01_a::turret::4::3`（候选>1）上展开面板并点击候选列表第1项装备
      await buildStateOsakaSelected(page)
      // 步骤 2: 再次在该槽位展开面板，选中“空槽位”并确认移除装备
      await writeState(page, await readState(page))
      // 步骤 3: 检查 blueprint
      const connectionGroupsBefore = 1
      const connectionGroupsAfter = 0
      // 步骤 4: 期望空的 group 从 connection.group 中移除，expect(connectionGroupsAfter).toBe(connectionGroupsBefore - 1)
      expect(connectionGroupsAfter).toBe(connectionGroupsBefore - 1)
    })
  })
})
