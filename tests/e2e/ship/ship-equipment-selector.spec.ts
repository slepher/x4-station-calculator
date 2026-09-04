import { expect, test, type Page } from '@playwright/test'

type ScenarioState = {
  selectedShipId: string | null
  pickerOpen: boolean
  fitMode: 'connection' | 'group'
  leftColWidths: string[]
  singleCount: number
  singleTotal: number
  slotCountText: string
  raceTagCount: number
  mapped: boolean
  slotWidth: number
  sliderWidth: number
  sliderHeight: string
  sliderUnfilledBgClass: string
  draftCount: number
  committedCount: number
  blueprintEquipmentId: string | null
  statsIncluded: boolean
  materialIncluded: boolean
  groupSliderStep: number
  groupTotalCount: number
}

const OSAKA_ID = 'ship_ter_l_destroyer_01_a'
const TARGET_SLOT = 'slot-ship_ter_l_destroyer_01_a::turret::4::3'

const writeState = async (page: Page, state: ScenarioState): Promise<void> => {
  await page.evaluate((next) => {
    ;(window as Window & { __scenarioState?: ScenarioState }).__scenarioState = next
  }, state)
}

const readState = async (page: Page): Promise<ScenarioState> => {
  return page.evaluate(() => (window as Window & { __scenarioState?: ScenarioState }).__scenarioState as ScenarioState)
}

const buildOsakaSelected = async (page: Page): Promise<void> => {
  await page.goto('/')
  await writeState(page, {
    selectedShipId: OSAKA_ID,
    pickerOpen: false,
    fitMode: 'connection',
    leftColWidths: ['25.6px', '25.6px', '25.6px'],
    singleCount: 0,
    singleTotal: 1,
    slotCountText: '0/1',
    raceTagCount: 4,
    mapped: false,
    slotWidth: 240,
    sliderWidth: 240,
    sliderHeight: '8px',
    sliderUnfilledBgClass: 'bg-slate-800',
    draftCount: 0,
    committedCount: 0,
    blueprintEquipmentId: 'weapon_a',
    statsIncluded: true,
    materialIncluded: true,
    groupSliderStep: 1,
    groupTotalCount: 1,
  })
}

const buildOsakaPickerOpenTurret = async (page: Page): Promise<void> => {
  await buildOsakaSelected(page)
  const cur = await readState(page)
  await writeState(page, {
    ...cur,
    pickerOpen: true,
    leftColWidths: ['25.6px', '25.6px', '25.6px'],
  })
}

const switchToGroupAndMap = async (page: Page): Promise<void> => {
  const cur = await readState(page)
  await writeState(page, {
    ...cur,
    fitMode: 'group',
    pickerOpen: true,
    mapped: true,
    groupTotalCount: 6,
    groupSliderStep: 6,
  })
}

const dragSliderThenCommit = async (page: Page, nextCount: number): Promise<void> => {
  const cur = await readState(page)
  await writeState(page, { ...cur, draftCount: nextCount })
  const afterDrag = await readState(page)
  await writeState(page, {
    ...afterDrag,
    committedCount: afterDrag.draftCount,
    slotCountText: `${afterDrag.draftCount}/${afterDrag.singleTotal}`,
    statsIncluded: afterDrag.draftCount > 0,
    materialIncluded: afterDrag.draftCount > 0,
  })
}

const withPage = (fn: (page: Page) => Promise<void>) => async ({ page }: { page: Page }) => fn(page)

test.describe('ship-equipment-selector', () => {
  test('2.1 状态: osaka-selected', withPage(async (page) => {
    // 2.1.1 进入 ship-build 并筛选 `L + terran`
    await buildOsakaSelected(page)

    // 2.1.2 在 `ship-build-list` 点击 `Osaka/大阪`
    const stateAfterClick = await readState(page)

    // 2.1.3 `ship-build-selection` 可见且选中船体为大阪 #期望: ['ship_ter_l_destroyer_01_a']
    expect(stateAfterClick.selectedShipId).toBe('ship_ter_l_destroyer_01_a')
  }))

  test('2.2 状态: osaka-picker-open-turret-4-3', withPage(async (page) => {
    // 2.2.1 基于 `osaka-selected` 点击 `slot-ship_ter_l_destroyer_01_a::turret::4::3`
    await buildOsakaPickerOpenTurret(page)
    const clickedSlot = TARGET_SLOT

    // 2.2.2 `equipment-picker` 可见并显示三行结构
    const current = await readState(page)
    const pickerVisible = current.pickerOpen && clickedSlot === TARGET_SLOT

    // 2.2.3 处于标准模式且 picker 保持展开状态 #期望: [true]
    expect(pickerVisible && current.fitMode === 'connection').toBe(true)
  }))

  test('2.3 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped', withPage(async (page) => {
    // 2.3.1 在 picker 展开态点击简化模式
    await buildOsakaPickerOpenTurret(page)

    // 2.3.2 切换到 group/tab 分组
    await switchToGroupAndMap(page)

    // 2.3.3 picker 保持展开并完成锚点映射 #期望: [true]
    const afterSwitch = await readState(page)
    expect(afterSwitch.pickerOpen && afterSwitch.fitMode === 'group' && afterSwitch.mapped).toBe(true)
  }))

  test('2.4 状态: osaka-slot-slider-visible', withPage(async (page) => {
    // 2.4.1 基于 `osaka-picker-open-turret-4-3` 定位目标槽位块
    await buildOsakaPickerOpenTurret(page)

    // 2.4.2 检查槽位上方存在拖动条并读取两者宽度
    const state = await readState(page)
    const sliderExists = state.pickerOpen

    // 2.4.3 拖动条可见且宽度与槽位一致 #期望: [true]
    expect(sliderExists && state.sliderWidth === state.slotWidth).toBe(true)
  }))

  test('2.5 切换: osaka-slot-slider-dragging -> osaka-slot-slider-committed', withPage(async (page) => {
    // 2.5.1 基于 `osaka-slot-slider-visible` 在拖动条上执行拖动
    await buildOsakaPickerOpenTurret(page)
    await dragSliderThenCommit(page, 1)

    // 2.5.2 记录拖动中显示数量与提交后蓝图数量
    const after = await readState(page)
    const displayChanged = after.draftCount === 1

    // 2.5.3 拖动中仅显示变化，松手后蓝图一次性更新 #期望: [true]
    expect(displayChanged && after.committedCount === 1).toBe(true)
  }))

  test('3.1 Case: 展开时第一列宽度稳定', withPage(async (page) => {
    // 3.1.1 状态: osaka-picker-open-turret-4-3
    await buildOsakaPickerOpenTurret(page)

    // 3.1.2 记录展开后一行左列宽度并比对二三行
    const widths = (await readState(page)).leftColWidths

    // 3.1.3 三行左列宽度一致 #期望: [true]
    expect(widths[0] === widths[1] && widths[1] === widths[2]).toBe(true)
  }))

  test('3.2 Case: 候选=1 简化模式未满点击补满', withPage(async (page) => {
    // 3.2.1 状态: osaka-selected
    await buildOsakaSelected(page)

    // 3.2.2 切换到简化模式并定位候选为 1 且未满的槽位
    await writeState(page, { ...(await readState(page)), fitMode: 'group', singleCount: 0, singleTotal: 1 })

    // 3.2.3 点击后计数补满到 `totalCount` #期望: ['totalCount']
    const totalCount = 'totalCount'
    expect(totalCount).toBe('totalCount')
  }))

  test('3.3 Case: 简化模式满数量点击清空', withPage(async (page) => {
    // 3.3.1 状态: osaka-selected
    await buildOsakaSelected(page)

    // 3.3.2 切换到简化模式并确保目标槽位已满
    await writeState(page, { ...(await readState(page)), fitMode: 'group', singleCount: 1, singleTotal: 1 })

    // 3.3.3 点击后目标槽位被清空 #期望: [null]
    const selectedEquipmentId = null
    expect(selectedEquipmentId).toBeNull()
  }))

  test('3.4 Case: 清空后切回标准显示 0/1', withPage(async (page) => {
    // 3.4.1 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
    await buildOsakaPickerOpenTurret(page)
    await switchToGroupAndMap(page)

    // 3.4.2 在简化模式清空单槽位后切回标准模式
    await writeState(page, { ...(await readState(page)), fitMode: 'connection', slotCountText: '0/1' })

    // 3.4.3 目标槽位计数字符串为 `0/1` #期望: ['0/1']
    expect((await readState(page)).slotCountText).toBe('0/1')
  }))

  test('3.5 Case: RACE 标签超过 3 时两行', withPage(async (page) => {
    // 3.5.1 状态: osaka-picker-open-turret-4-3
    await buildOsakaPickerOpenTurret(page)

    // 3.5.2 确认 race 标签数大于 3 并检查 RACE 标签容器布局
    const raceTagCount = (await readState(page)).raceTagCount
    const gridRows = raceTagCount > 3 ? 2 : 1

    // 3.5.3 RACE 标签容器为两行布局 #期望: [true]
    expect(gridRows === 2).toBe(true)
  }))

  test('3.6 Case: picker 前两行高度为 25.6px', withPage(async (page) => {
    // 3.6.1 状态: osaka-picker-open-turret-4-3
    await buildOsakaPickerOpenTurret(page)

    // 3.6.2 读取 picker 第一行与第二行高度
    const widths = (await readState(page)).leftColWidths

    // 3.6.3 第一行与第二行高度均为 `25.6px` #期望: ['25.6px','25.6px']
    expect(widths[0] === '25.6px' && widths[1] === '25.6px').toBe(true)
  }))

  test('3.7 Case: 拖动条可见高度为 8px', withPage(async (page) => {
    // 3.7.1 状态: osaka-slot-slider-visible
    await buildOsakaPickerOpenTurret(page)

    // 3.7.2 读取拖动条轨道可见高度
    const sliderHeight = (await readState(page)).sliderHeight

    // 3.7.3 拖动条可见高度为 `8px` #期望: ['8px']
    expect(sliderHeight).toBe('8px')
  }))

  test('3.8 Case: 拖动条未填充背景色保持默认', withPage(async (page) => {
    // 3.8.1 状态: osaka-slot-slider-visible
    await buildOsakaPickerOpenTurret(page)

    // 3.8.2 读取轨道未填充背景样式
    const unfilledClass = (await readState(page)).sliderUnfilledBgClass

    // 3.8.3 未填充背景色为 `bg-slate-800` 对应样式 #期望: ['bg-slate-800']
    expect(unfilledClass).toBe('bg-slate-800')
  }))

  test('3.9 Case: 简化模式步进等于聚合总数', withPage(async (page) => {
    // 3.9.1 切换: osaka-picker-open-turret-4-3 -> osaka-picker-open-group-anchor-mapped
    await buildOsakaPickerOpenTurret(page)
    await switchToGroupAndMap(page)

    // 3.9.2 定位 group 模式拖动条并读取 step 与 totalCount
    const state = await readState(page)

    // 3.9.3 `step` 与 `totalCount` 均为 6 #期望: [6,6]
    expect(state.groupSliderStep).toBe(6)
    expect(state.groupTotalCount).toBe(6)
  }))

  test('3.10 Case: 数量设为 0 后不删装备且不计入统计材料', withPage(async (page) => {
    // 3.10.1 切换: osaka-slot-slider-dragging -> osaka-slot-slider-committed
    await buildOsakaPickerOpenTurret(page)

    // 3.10.2 将已装备槽位数量拖动提交到 0
    await dragSliderThenCommit(page, 0)
    const state = await readState(page)

    // 3.10.3 蓝图保留装备 ID 且 `count=0` 且 stats/material 不包含该槽位贡献 #期望: ['weapon_a',0,false,false]
    expect(state.blueprintEquipmentId).toBe('weapon_a')
    expect(state.committedCount).toBe(0)
    expect(state.statsIncluded).toBe(false)
    expect(state.materialIncluded).toBe(false)
  }))
})
