import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const SECOND_GAME_GUID = 'B41B8D56-C58D-4F66-8EAA-6F85BC614214'
const GAME_ARCHIVE_TIME = 667632.933
const SECOND_ARCHIVE_TIME = 1345095.294

async function waitForAppReady(page: Page) {
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 5000 })
}

async function ensureAutoGroupResult(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).liveStore?.autoGroupResult?.groups.length ?? 0), { timeout: 15000 }).toBeGreaterThan(0)
  return true
}

const HUB_SECTOR = 'cluster_100_sector001_macro'

function hubCard(page: Page) {
  return page.locator('.group-item').filter({ has: page.locator('.pill--anchor .pill-label').filter({ hasText: /^小行星带$/ }) })
}

async function readHub(page: Page) {
  return page.evaluate((sector) => (window as any).liveStore.autoGroupResult.groups.find(
    (group: any) => group.sectorMacro === sector
  ), HUB_SECTOR)
}

async function changeHubColor(page: Page, paletteIndex = -1) {
  await enterEditMode(page)
  const before = await readHub(page)
  await hubCard(page).locator('.color-chip').click()
  await page.locator('.preset-color').nth(paletteIndex).click()
  await expect.poll(async () => (await readHub(page)).color).not.toBe(before.color)
  return (await readHub(page)).color as string
}

async function waitForStores(page: Page) {
  await expect.poll(() => page.evaluate(() => Boolean((window as any).gameDataStore && (window as any).liveStore))).toBe(true)
}

async function readSavedBinding(page: Page) {
  await waitForStores(page)
  return page.evaluate((guid) => {
    const w = window as any
    const key = w.gameDataStore.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    return JSON.parse(localStorage.getItem(key)!).list.find((binding: any) => binding.gameGuid === guid)
  }, GAME_GUID)
}

async function openMapBinding(page: Page) {
  await page.locator('.auto-sector-bar .map-btn').click()
  await expect(page.locator('.auto-sector-group-map-panel--tabs')).toBeVisible()
}

async function confirmCurrentDraft(page: Page) {
  for (const option of await page.locator('.candidate-item--virtual').all()) await option.click()
  const button = page.locator('.auto-sector-bar .confirm-btn')
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.locator('.confirm-popup')).toBeHidden()
  await expect(button).toBeDisabled()
}

async function enterAutoSectorGroup(page: Page) {
  const ready = await ensureAutoGroupResult(page)
  expect(ready).toBe(true)
  const autoEntry = page.getByTestId('sidebar-auto-sector-group')
  await expect(autoEntry).toBeVisible({ timeout: 5000 })
  await autoEntry.click()
  await page.waitForTimeout(300)
  await expect(page.locator('.auto-sector-bar').first()).toBeVisible({ timeout: 5000 })
  return true
}

async function enterEditMode(page: Page) {
  const editBtn = page.getByRole('button', { name: /编辑|Edit/ })
  await expect(editBtn).toBeVisible({ timeout: 5000 })
  await editBtn.click()
  await page.waitForTimeout(300)
}

async function returnToDisplayMode(page: Page) {
  await page.getByTestId('sidebar-overview').click()
  await page.waitForTimeout(300)
}

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('[auto-sector-confirm]')) console.log(text)
  })
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await loadLiveBindingFixture(page)
})


async function readVirtualDrafts(page: Page) {
  await waitForStores(page)
  return page.evaluate(() => (window as any).liveStore.virtualStationDrafts)
}

async function deleteVirtualDraft(page: Page) {
  await page.getByRole('button', { name: '虚拟空间站', exact: true }).click()
  const row = page.locator('.virtual-row').filter({ hasText: '新建空间站' })
  await expect(row).toHaveCount(1)
  await row.locator('.virtual-delete').click()
  await expect(row).toHaveCount(0)
  await expect.poll(() => readVirtualDrafts(page)).toEqual([])
}

async function loadBinding(page: Page, name: string) {
  await page.getByTestId('toolbar-load-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await dialog.locator('.group').filter({ hasText: name }).getByRole('button', { name: '加载绑定', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test.describe('M2.1 当前共享草案事务', () => {
  test('3.4/5.5 等分候选 trade gate 阻止确认，真实选择后保存', async ({ page }) => {
    await loadLiveBindingFixture(page, {
      transformSave: save => {
        if (save.meta.guid !== GAME_GUID) return save
        const sector = save.sectors[HUB_SECTOR]
        const station = sector.player_stations['KXN-018']
        return { ...save, sectors: { ...save.sectors, [HUB_SECTOR]: {
          ...sector, player_stations: { ...sector.player_stations, 'M2-TIE': { ...station, code: 'M2-TIE' } }
        } } }
      }
    })
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    await changeHubColor(page)
    const confirm = page.locator('.auto-sector-bar .confirm-btn')
    await expect(confirm).toBeDisabled()
    await expect(page.locator('.confirm-popup')).toBeHidden()
    expect(await readSavedBinding(page)).toEqual(saved)
    for (const option of await page.locator('.candidate-item--virtual').all()) await option.click()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.locator('.confirm-popup')).toBeHidden()
    await expect(confirm).toBeDisabled()
    expect((await readSavedBinding(page)).appliedAutoGroupArchiveTime).toBe(GAME_ARCHIVE_TIME)
  })

  test('3.4/3.6 未决分配 popup 取消不保存，再次确认进入已保存态', async ({ page }) => {
    await page.evaluate(({guid, time, sector}) => {
      const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives','save_bindings')
      const state = JSON.parse(localStorage.getItem(key)!)
      const binding = state.list.find((binding: any) => binding.gameGuid === guid)
      binding.appliedAutoGroupArchiveTime = time
      binding.groups = binding.groups.filter((group: any) => group.sectorMacro === sector)
      binding.groups[0].jumpRange = 0
      binding.groups[0].coverageSectorMacros = []
      binding.groups[0].connectedGroupIds = []
      localStorage.setItem(key, JSON.stringify(state))
    }, {guid: GAME_GUID, time: GAME_ARCHIVE_TIME, sector: HUB_SECTOR})
    await page.reload()
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    await changeHubColor(page, 0)
    await expect.poll(() => page.locator('.card-uncertain').count()).toBeGreaterThan(0)
    const confirm = page.locator('.auto-sector-bar .confirm-btn')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    const popup = page.locator('.confirm-popup')
    await expect(popup).toBeVisible()
    await popup.locator('.confirm-popup-button--secondary').click()
    await expect(popup).toBeHidden()
    expect(await readSavedBinding(page)).toEqual(saved)
    await confirm.click()
    await expect(popup).toBeVisible()
    await popup.locator('.confirm-popup-button--primary').click()
    await expect(popup).toBeHidden()
    await expect(confirm).toBeDisabled()
    expect((await readSavedBinding(page)).appliedAutoGroupArchiveTime).toBe(GAME_ARCHIVE_TIME)
    await expect(page.locator('.group-item--new')).toHaveCount(0)
  })

  test('4.4 coverage 丢失保留未分组 virtual，Reset 恢复归属', async ({ page }) => {
    await page.evaluate(({guid, time, sector}) => {
      const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives','save_bindings')
      const state = JSON.parse(localStorage.getItem(key)!)
      const binding = state.list.find((binding: any) => binding.gameGuid === guid)
      binding.appliedAutoGroupArchiveTime = time
      binding.groups = binding.groups.filter((group: any) => group.sectorMacro === sector)
      binding.groups[0].connectedGroupIds = []
      binding.stationPlans.find((plan: any) => plan.id === 'f36126e5-7798-ed14-3c03-938b961efa0b').sectorMacro = 'cluster_106_sector001_macro'
      localStorage.setItem(key, JSON.stringify(state))
    }, {guid: GAME_GUID, time: GAME_ARCHIVE_TIME, sector: HUB_SECTOR})
    await page.reload()
    await enterAutoSectorGroup(page)
    expect((await readVirtualDrafts(page))[0].groupId).toBe(HUB_SECTOR)
    await openMapBinding(page)
    await enterEditMode(page)
    await hubCard(page).locator('.jump-input').fill('0')
    await expect.poll(async () => (await readVirtualDrafts(page))[0].groupId).toBeNull()
    await page.getByRole('button', {name:'虚拟空间站', exact:true}).click()
    await expect(page.locator('.virtual-group--ungrouped .virtual-row')).toHaveCount(1)
    await page.getByRole('button', {name:'重置', exact:true}).click()
    await expect.poll(async () => (await readVirtualDrafts(page))[0].groupId).toBe(HUB_SECTOR)
  })

  test('1.1-1.3/2.1/2.4/3.2 三态与 sidebar 保留修改并恢复菜单', async ({ page }) => {
    const overview = page.locator('.main-layout').filter({ has: page.locator('.overview-left-panel') })
    await expect(overview.locator(':scope > div')).toHaveCount(3)
    await expect(overview.locator(':scope > div').nth(0)).toHaveClass(/lg:col-span-3/)
    await expect(overview.locator(':scope > div').nth(1)).toHaveClass(/lg:col-span-4/)
    await expect(overview.locator(':scope > div').nth(2)).toHaveClass(/lg:col-span-5/)
    const entry = page.getByTestId('sidebar-auto-sector-group')
    await expect(entry).not.toHaveClass(/disabled/)
    await expect(entry.locator('.sidebar-recalc-dot')).toBeVisible()
    const initial = await readVirtualDrafts(page)
    expect(initial.map((draft: any) => draft.id)).toEqual(['f36126e5-7798-ed14-3c03-938b961efa0b'])
    expect(initial[0].saveStationCode).toBeUndefined()
    await enterAutoSectorGroup(page)
    await expect(page.locator('.columns-layout > .column')).toHaveCount(3)
    await expect(page.locator('.trade-station-list')).toBeVisible()
    await expect(page.locator('.generate-card')).toBeHidden()
    const color = await changeHubColor(page)
    await expect(page.getByRole('button', { name: '退出', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '查看', exact: true }).click()
    await expect(hubCard(page).locator('.color-chip')).toBeDisabled()
    await page.getByRole('button', { name: '重算', exact: true }).click()
    await expect(page.locator('.generate-card')).toBeVisible()
    await page.getByRole('button', { name: '查看', exact: true }).click()
    await returnToDisplayMode(page)
    await enterAutoSectorGroup(page)
    expect((await readHub(page)).color).toBe(color)
    expect(await readVirtualDrafts(page)).toEqual(initial)
    await page.reload()
    await expect(page.locator('.auto-sector-bar')).toBeVisible()
    expect(await page.evaluate(() => (window as any).activeViewStore.activeBindingWorkbench)).toBe('auto-sector-group')
    expect((await readHub(page)).color).not.toBe(color)
  })

  test('2.2/4.1/4.2/5.1 Live Map 双向共享颜色与 virtual 删除草案', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    const color = await changeHubColor(page)
    await openMapBinding(page)
    expect((await readHub(page)).color).toBe(color)
    await expect(hubCard(page).locator('.color-chip')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await enterEditMode(page)
    await hubCard(page).locator('.color-chip').click()
    await page.locator('.preset-color').first().click()
    const mapColor = (await readHub(page)).color
    expect(mapColor).not.toBe(color)
    await deleteVirtualDraft(page)
    expect(await readSavedBinding(page)).toEqual(saved)
    await page.getByTestId('top-view-btn-live-production').click()
    await enterAutoSectorGroup(page)
    expect((await readHub(page)).color).toBe(mapColor)
    expect(await readVirtualDrafts(page)).toEqual([])
    await openMapBinding(page)
    await page.getByRole('button', { name: '虚拟空间站', exact: true }).click()
    await expect(page.locator('.virtual-row')).toHaveCount(0)
    await page.reload()
    expect((await readSavedBinding(page)).stationPlans.some((plan: any) => plan.id === 'f36126e5-7798-ed14-3c03-938b961efa0b')).toBe(true)
  })

  test('2.3 binding context 切换丢弃旧草案，删除当前 binding 清空详情入口', async ({ page }) => {
    // Fixture initialization only; subsequent activation and deletion use public UI.
    await page.evaluate(({guid}) => {
      const game = (window as any).gameDataStore
      const key = game.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
      const state = JSON.parse(localStorage.getItem(key)!)
      state.list.push({gameGuid: guid, bindingName: 'M2 Context B', selectedArchiveTime: null, groups: [], stationPlans: [], updatedAt: 1})
      localStorage.setItem(key, JSON.stringify(state))
    }, {guid: SECOND_GAME_GUID})
    await page.reload()
    await enterAutoSectorGroup(page)
    const original = await readHub(page)
    await changeHubColor(page)
    await loadBinding(page, 'M2 Context B')
    await expect.poll(() => page.evaluate(() => (window as any).activeViewStore.activeBinding)).toBe(SECOND_GAME_GUID)
    expect(await page.evaluate(() => (window as any).saveStore.selectedArchive.meta.time)).toBe(SECOND_ARCHIVE_TIME)
    expect(await readVirtualDrafts(page)).toEqual([])
    await loadBinding(page, 'slepher')
    await expect.poll(async () => (await readHub(page)).color).toBe(original.color)
    expect(await page.evaluate(() => (window as any).saveStore.selectedArchive.meta.time)).toBe(GAME_ARCHIVE_TIME)
    await page.getByTestId('toolbar-load-btn').click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByTestId('dialog-backdrop').locator('.group').filter({hasText: 'M2 Context B'}).getByRole('button', {name:'删除', exact:true}).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByTestId('dialog-backdrop').locator('.group').filter({hasText: 'slepher'}).getByRole('button', {name:'删除', exact:true}).click()
    await page.reload()
    await expect(page.getByTestId('sidebar-auto-sector-group')).toHaveClass(/disabled/)
    expect(await page.evaluate(() => (window as any).activeViewStore.activeBinding)).toBeNull()
    expect(await page.evaluate(() => (window as any).liveStore.autoGroupResult)).toBeNull()
  })

  test('2.3 同 GUID archive time UI 切换重新初始化唯一 draft', async ({ page }) => {
    const patch = await import('./fixtures/context-switch-save.patch.json', { with: { type: 'json' } })
    await loadLiveBindingFixture(page, {
      transformSaves: saves => {
        const source = saves.find(save => save.meta.guid === GAME_GUID)
        if (!source) throw new Error('G1 fixture missing')
        return [...saves, {...source, meta: {...source.meta, ...patch.default.$merge.meta}}]
      }, initialArchiveId: GAME_GUID + '_' + GAME_ARCHIVE_TIME
    })
    await page.evaluate(({guid, time}) => {
      const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives','save_bindings')
      const state = JSON.parse(localStorage.getItem(key)!)
      state.list.find((binding: any) => binding.gameGuid === guid).selectedArchiveTime = time
      localStorage.setItem(key, JSON.stringify(state))
    }, {guid: GAME_GUID, time: GAME_ARCHIVE_TIME})
    await page.reload()
    await waitForAppReady(page)
    await expect.poll(() => page.evaluate(() => (window as any).saveStore.selectedArchive?.meta.time)).toBe(GAME_ARCHIVE_TIME)
    await enterAutoSectorGroup(page)
    const color = await changeHubColor(page)
    await page.getByTestId('top-view-btn-maps').click()
    await page.getByTestId('map-save-panel-tab').click()
    await page.getByTestId('map-save-panel').locator('.save-item').filter({hasText:'M2 later'}).locator('.save-info').click()
    await expect.poll(() => page.evaluate(() => (window as any).saveStore.selectedArchive.meta.time)).toBe(700000)
    await expect.poll(async () => (await readHub(page)).color).not.toBe(color)
    expect(await page.evaluate(() => (window as any).activeViewStore.activeBinding)).toBe(GAME_GUID)
  })
  test('3.1 显式计算', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    const baseline = await page.evaluate(() => (window as any).liveStore.calcBaselinePillState)
    await page.getByRole('button', { name: '重算', exact: true }).click()
    await expect(page.locator('.generate-card')).toBeVisible()
    await page.locator('.generate-card .param-field').filter({ hasText: '交易站' }).locator('select').selectOption('20000000')
    await page.getByRole('button', { name: '重新计算', exact: true }).click()
    await expect(page.locator('.generate-card')).toBeHidden()
    await expect(page.getByRole('button', { name: '查看', exact: true })).toHaveClass(/active/)
    expect(await page.evaluate(() => (window as any).liveStore.prefThreshold)).toBe(20000000)
    expect(await readSavedBinding(page)).toEqual(saved)
    expect(await page.evaluate(() => (window as any).liveStore.calcBaselinePillState)).toEqual(baseline)
    await expect.poll(() => page.locator('.group-item').count()).toBeGreaterThan(0)
  })

  test('3.3 重置', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    const original = await readHub(page)
    const virtualBefore = await page.evaluate(() => (window as any).liveStore.virtualStationDrafts)
    const baseline = await page.evaluate(() => (window as any).liveStore.calcBaselinePillState)
    const color = await changeHubColor(page)
    await page.getByRole('button', { name: '重算', exact: true }).click()
    await page.locator('.generate-card .param-field').filter({ hasText: '交易站' }).locator('select').selectOption('20000000')
    await expect.poll(() => page.evaluate(() => (window as any).liveStore.prefThreshold)).toBe(20000000)
    await page.getByRole('button', { name: '重置', exact: true }).click()
    await expect.poll(async () => (await readHub(page)).color).toBe(original.color)
    expect((await readHub(page)).color).not.toBe(color)
    expect((await readHub(page)).sectorMacro).toBe(HUB_SECTOR)
    expect(await readSavedBinding(page)).toEqual(saved)
    expect(await page.evaluate(() => (window as any).liveStore.prefThreshold)).toBe(20000000)
    expect(await page.evaluate(() => (window as any).liveStore.calcBaselinePillState)).toEqual(baseline)
    expect(await page.evaluate(() => (window as any).liveStore.virtualStationDrafts)).toEqual(virtualBefore)
    expect(await page.evaluate(() => ({
      guid: (window as any).activeViewStore.activeBinding,
      time: (window as any).saveStore.selectedArchive.meta.time
    }))).toEqual({ guid: GAME_GUID, time: GAME_ARCHIVE_TIME })
  })

  test('3.5 确认成功', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const color = await changeHubColor(page)
    const draftGroups = await page.evaluate(() => (window as any).liveStore.autoGroupResult.groups.map((group: any) => ({
      sectorMacro: group.sectorMacro,
      coverage: [...group.coverageSectorMacros].sort(),
      connections: [...group.connectedGroupIds].sort(),
      color: group.color,
      jumpRange: group.jumpRange
    })))
    await confirmCurrentDraft(page)
    const saved = await readSavedBinding(page)
    expect(saved.appliedAutoGroupArchiveTime).toBe(GAME_ARCHIVE_TIME)
    expect(saved.groups.find((group: any) => group.sectorMacro === HUB_SECTOR).color).toBe(color)
    expect(saved.groups.every((group: any) => !Object.hasOwn(group, 'id'))).toBe(true)
    expect(saved.groups.map((group: any) => ({
      sectorMacro: group.sectorMacro,
      coverage: group.coverageSectorMacros.map((sector: any) => sector.ref).sort(),
      connections: [...group.connectedGroupIds].sort(),
      color: group.color,
      jumpRange: group.jumpRange
    }))).toEqual(draftGroups)
    expect(await page.evaluate(() => (window as any).activeViewStore.activeBindingWorkbench)).toBe('auto-sector-group')
    await page.reload()
    await expect(page.locator('.auto-sector-bar')).toBeVisible()
    expect((await readSavedBinding(page)).groups).toEqual(saved.groups)
    expect((await readHub(page)).color).toBe(color)
  })

  test('5.2 防止 handleColorChange 直接写入持久化 binding', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    const color = await changeHubColor(page)
    expect(await readSavedBinding(page)).toEqual(saved)
    await page.reload()
    await enterAutoSectorGroup(page)
    expect(await readSavedBinding(page)).toEqual(saved)
    expect((await readHub(page)).color).not.toBe(color)
  })


  test('4.3 重算保留未确认 virtual 删除内容', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    await openMapBinding(page)
    await deleteVirtualDraft(page)
    await page.getByRole('button', {name:'枢纽', exact:true}).click()
    await page.getByRole('button', {name:'重算', exact:true}).click()
    await page.getByRole('button', {name:'重新计算', exact:true}).click()
    await expect(page.locator('.generate-card')).toBeHidden()
    expect(await readVirtualDrafts(page)).toEqual([])
    expect(await readSavedBinding(page)).toEqual(saved)
  })

  test('3.3/5.3 Reset 同时恢复 virtual 与颜色草案', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const before = await readVirtualDrafts(page)
    const original = await readHub(page)
    await changeHubColor(page)
    await openMapBinding(page)
    await deleteVirtualDraft(page)
    await page.getByRole('button', {name:'重置', exact:true}).click()
    await expect.poll(() => readVirtualDrafts(page)).toEqual(before)
    expect((await readHub(page)).color).toBe(original.color)
  })

  test('4.5 virtual 删除确认仅移除无 saveStationCode 计划并持久化', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const before = await page.evaluate(() => (window as any).saveBindingStore.activeBinding.stationPlans.filter((plan: any) => plan.saveStationCode))
    await openMapBinding(page)
    await deleteVirtualDraft(page)
    await page.getByTestId('top-view-btn-live-production').click()
    await enterAutoSectorGroup(page)
    await confirmCurrentDraft(page)
    const saved = await readSavedBinding(page)
    expect(saved.stationPlans.filter((plan: any) => !plan.saveStationCode)).toEqual([])
    const content = (plans: any[]) => plans.map(({saveStationCode, name, modules, settings}) => ({saveStationCode, name, modules, settings}))
    expect(content(saved.stationPlans)).toEqual(content(before))
    await page.reload()
    expect(await readVirtualDrafts(page)).toEqual([])
    expect((await readSavedBinding(page)).stationPlans).toEqual(saved.stationPlans)
  })

  test('5.4 normalizeState 保留新增字段与迁移 sectorMacro 引用', async ({ page }) => {
    const patch = await import('./fixtures/normalize-fields-db.patch.json', {with:{type:'json'}})
    await page.evaluate((fixture) => {
      const key = (window as any).gameDataStore.getStorageKey('save_archives').replace('save_archives','save_bindings')
      localStorage.setItem(key, JSON.stringify({version:1,list:fixture.$append['x4_save_bindings.list']}))
    }, patch.default)
    await page.reload()
    await enterAutoSectorGroup(page)
    const binding = await page.evaluate(() => (window as any).saveBindingStore.activeBinding)
    expect(binding.appliedAutoGroupArchiveTime).toBe(1345095294)
    expect(binding.prefJumpRange).toBe(2)
    expect(binding.bridgeSearchJumpRange).toBe(5)
    expect(binding.prefThreshold).toBe(500)
    expect(binding.groups.every((group: any) => !Object.hasOwn(group,'id'))).toBe(true)
    expect(binding.stationPlans.find((plan: any) => plan.id==='KXN-018').groupId).toBe(HUB_SECTOR)
    expect(binding.groups.find((group: any) => group.sectorMacro===HUB_SECTOR).connectedGroupIds).toEqual(['cluster_48_sector001_macro'])
  })

  test('当前公开导航：auto-sector-group 与 transit/station 工作台按显式选择切换', async ({ page }) => {
    await enterAutoSectorGroup(page)
    await expect(page.locator('.auto-sector-bar')).toBeVisible()
    expect(await page.evaluate(() => ({
      workbench: (window as any).activeViewStore.activeBindingWorkbench,
      station: (window as any).activeViewStore.activeStationId
    }))).toEqual({ workbench: 'auto-sector-group', station: null })

    const sector = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await sector.click()
    await expect(page.locator('[data-testid="transit-hub-build-panel"]')).toBeVisible()
    await expect(sector).toHaveClass(/active/)
    expect(await page.evaluate(() => ({
      workbench: (window as any).activeViewStore.activeBindingWorkbench,
      station: (window as any).activeViewStore.activeStationId
    }))).toEqual({ workbench: 'station', station: 'transit:cluster_100_sector001_macro' })

    const station = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(station).toBeVisible()
    await station.click()
    await expect(page.locator('[data-testid="station-dashboard"]')).toBeVisible()
    await expect(station).toHaveClass(/active/)
    expect(await page.evaluate(() => ({
      workbench: (window as any).activeViewStore.activeBindingWorkbench,
      station: (window as any).activeViewStore.activeStationId
    }))).toEqual({ workbench: 'station', station: 'KXN-018' })
  })

  test('4.5 Map pointer 创建并移动 virtual，确认后刷新恢复', async ({ page }) => {
    await enterAutoSectorGroup(page)
    const saved = await readSavedBinding(page)
    await openMapBinding(page)
    await page.getByRole('button', {name:'虚拟空间站', exact:true}).click()
    await page.locator('.virtual-group').filter({has: page.locator('.virtual-row').filter({hasText:'新建空间站'})}).locator('.virtual-group-title').click()
    const target = page.locator('.sector-hover-target[data-map-sector-id="cluster_100_sector001_macro"] .sector-polygon')
    await expect(target).toBeVisible()
    async function drag(source: import('@playwright/test').Locator, fraction: number) {
      const box = await source.boundingBox()
      const end = await target.boundingBox()
      expect(box).not.toBeNull()
      expect(end).not.toBeNull()
      const point = {x: end!.x + end!.width * fraction, y: end!.y + end!.height * .6}
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.mouse.down()
      await page.mouse.move(box!.x + box!.width / 2 + 12, box!.y + box!.height / 2, {steps:4})
      await expect(source).toHaveClass(/dragging/)
      await page.mouse.move(point.x, point.y, {steps:20})
      await expect(page.locator('.placement-preview--binding')).toBeVisible()
      await page.mouse.up()
    }
    await drag(page.locator('.free-station-item--virtual'), .65)
    await expect.poll(async () => (await readVirtualDrafts(page)).length).toBe(2)
    const created = (await readVirtualDrafts(page)).find((draft: any) => draft.id !== 'f36126e5-7798-ed14-3c03-938b961efa0b')
    expect(created).toMatchObject({name:'新空间站', type:'industrial', modules:[], groupId:HUB_SECTOR, sectorMacro:HUB_SECTOR})
    expect(created.saveStationCode).toBeUndefined()
    await drag(page.locator('.virtual-row').filter({has:page.locator('.virtual-name').filter({hasText:/^新空间站$/})}), .35)
    const moved = (await readVirtualDrafts(page)).find((draft: any) => draft.id === created.id)
    expect(moved.position).not.toEqual(created.position)
    expect(moved.groupId).toBe(HUB_SECTOR)
    expect((await readVirtualDrafts(page)).length).toBe(2)
    expect(await readSavedBinding(page)).toEqual(saved)
    await page.getByTestId('top-view-btn-live-production').click()
    await enterAutoSectorGroup(page)
    await confirmCurrentDraft(page)
    expect((await readSavedBinding(page)).stationPlans.find((plan: any) => plan.id===created.id).position).toEqual(moved.position)
    await page.reload()
    await waitForAppReady(page)
    expect((await readVirtualDrafts(page)).find((draft: any) => draft.id===created.id).position).toEqual(moved.position)
  })

})
