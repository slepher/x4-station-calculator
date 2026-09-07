import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { setupLogicFlow } from '../logic-flow/helpers/setupLogicFlow'
import { dragWareToTarget } from '../logic-flow/helpers/dragLogicFlow'

type Mode = 'station' | 'logicFlow' | 'ship-build'
const ENERGY = 'module_gen_prod_energycells_01'
const dialog = (page: Page) => page.getByTestId('dialog-backdrop')
const success = (page: Page) => page.locator('.border-l-4.border-emerald-500')

async function loadFixture(page: Page, ship = false) {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default)); delete data.vsn
  data.x4_game_version = { version: ship ? '9.0' : '8.0', beta: false }
  if (ship) data.x4_ship_blueprints_v9 = { version: 5, activeShipId: null, activeBlueprintId: null, ships: [] }
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
}

test.beforeEach(async ({ page }, info) => {
  if (info.title.includes('logicFlow-')) await setupLogicFlow(page, 'clean')
  else await loadFixture(page, info.title.includes('ship-build-'))
})

async function addEnergy(page: Page) {
  await page.getByTestId('candidate-search-input').fill(ENERGY)
  await page.getByTestId(`grouped-candidate-item-${ENERGY}`).click()
}
async function equip(page: Page, type: 'engine' | 'shield') {
  await page.getByTestId(`slot-type-${type}`).click()
  await page.getByTestId('ship-build-panel-fit').locator('.slot-row').first().click()
  const id = type === 'engine' ? 'engine_arg_m_allround_01_mk1' : 'shield_arg_m_standard_01_mk1'
  await page.getByTestId(`candidate-${id}`).click()
  await page.getByTestId('picker-confirm').click()
}
async function submitName(page: Page, name: string) {
  await expect(dialog(page)).toBeVisible()
  await dialog(page).locator('.dialog-input').fill(name)
  await dialog(page).getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog(page)).toBeHidden()
}
async function state(page: Page, mode: Mode) {
  return page.evaluate(mode => {
    const w = window as any
    if (mode === 'station') {
      const s = w.blueprintStore
      return { dirty: s.isDirty, activeId: s.savedEmpires.activeId, list: s.savedEmpires.list,
        content: s.activeEmpire.stations.map((station: any) => station.modules) }
    }
    if (mode === 'logicFlow') {
      const s = w.logicFlowStore
      return { dirty: s.isDirty, activeId: s.savedPlans.activeId, list: s.savedPlans.list,
        content: s.groups.map((group: any) => group.nodes.filter((node: any) => node.source === 'manual').map((node: any) => node.wareId)) }
    }
    const s = w.shipBuildStore
    return { dirty: s.isDirty, activeId: s.savedBlueprints.activeBlueprintId,
      list: s.savedBlueprints.ships.flatMap((ship: any) => ship.blueprints),
      content: s.blueprint === null ? [] : s.blueprint.connections.flatMap((connection: any) => connection.group.map((group: any) => ({ slot_type: connection.slot_type, ...group }))) }
  }, mode)
}
async function prepare(page: Page, mode: Mode, dirty: boolean, fresh: boolean) {
  if (mode === 'station') {
    await page.getByTestId('toolbar-new-btn').click()
    await expect(page.getByTestId('sidebar-station')).toHaveCount(1)
    await page.getByTestId('sidebar-station').click()
    if (!fresh || dirty) await addEnergy(page)
  } else if (mode === 'logicFlow') {
    if (!fresh || dirty) await dragWareToTarget(page, 'hullparts', 'new')
  } else {
    await page.getByTestId('top-view-btn-ship-build').click()
    await page.getByTestId('ship-build-filter-class-btn-ship_m').click()
    await page.getByTestId('ship-build-filter-race-btn-terran').click()
    await page.getByTestId('ship-build-ship-name').filter({ hasText: /^大太刀$/ }).click()
    await page.getByTestId('ship-build-confirm-ship').click()
    await expect(page.getByTestId('ship-build-panel-fit')).toBeVisible()
    if (!fresh || dirty) await equip(page, 'engine')
  }
  if (!fresh) {
    await page.getByTestId('toolbar-save-btn').click()
    await submitName(page, `M15 seed ${mode}`)
    if (dirty) {
      if (mode === 'station') await addEnergy(page)
      else if (mode === 'logicFlow') await dragWareToTarget(page, 'quantumtubes', 'new')
      else await equip(page, 'shield')
    }
  }
  await expect.poll(async () => {
    const current = await state(page, mode)
    return { dirty: current.dirty, fresh: current.activeId === null }
  }).toEqual({ dirty, fresh })
  const current = await state(page, mode)
  if (mode === 'station') expect(current.content).toEqual([[...(!fresh || dirty ? [{ id: ENERGY, count: !fresh && dirty ? 2 : 1 }] : [])]])
  if (mode === 'logicFlow') expect(current.content).toEqual(!fresh && dirty ? [['hullparts'], ['quantumtubes']] : !fresh || dirty ? [['hullparts']] : [])
  if (mode === 'ship-build' && (!fresh || dirty)) {
    expect(current.content).toEqual(expect.arrayContaining([expect.objectContaining({ equipment_id: 'engine_arg_m_allround_01_mk1', count: 1 })]))
  }
  // Remove preparation notifications through the visible close controls, isolating this action's toast.
  while (await success(page).count()) await success(page).first().getByRole('button').click()
}

async function matrix(page: Page, mode: Mode, action: string, dirty: boolean, fresh: boolean) {
  await prepare(page, mode, dirty, fresh)
  const before = await state(page, mode)
  const empty = fresh && !dirty && mode !== 'station'
  await page.getByTestId(action === 'NEW' ? 'toolbar-new-btn' : action === 'SAVE' ? 'toolbar-save-btn' : 'toolbar-save-as-btn').click()
  if (empty && action !== 'NEW') {
    // The accepted empty guard takes precedence over requiresSaveAs in every controller.
    await expect(dialog(page)).toBeHidden()
    await expect(page.locator('.border-l-4.border-amber-500')).toHaveCount(1)
    expect(await state(page, mode)).toEqual(before)
    await expect(success(page)).toHaveCount(0)
    return
  }
  if (action === 'NEW') {
    if (dirty) {
      await expect(dialog(page)).toBeVisible()
      await expect(dialog(page).getByRole('button', { name: '丢弃并新建', exact: true })).toBeVisible()
      if (fresh && mode !== 'ship-build') await expect(dialog(page).locator('.dialog-input')).toBeVisible()
      else await expect(dialog(page).locator('.dialog-input')).toBeHidden()
      // Exercise the actual discard branch; original matrix also requires this affordance.
      await dialog(page).getByRole('button', { name: '丢弃并新建', exact: true }).click()
    }
    await expect(dialog(page)).toBeHidden()
    await expect.poll(async () => {
      const after = await state(page, mode)
      return { activeId: after.activeId, dirty: after.dirty, content: after.content }
    }).toEqual({ activeId: null, dirty: false, content: mode === 'station' ? [[]] : [] })
    expect((await state(page, mode)).list).toEqual(before.list)
    await expect(success(page)).toHaveCount(0)
    return
  }
  const createsCopy = action === 'SAVE_AS' || fresh
  const name = `M15 ${mode} ${action} ${dirty} ${fresh}`
  if (createsCopy) await submitName(page, name)
  else await expect(dialog(page)).toBeHidden()
  const after = await state(page, mode)
  expect(after.dirty).toBe(false)
  expect(after.content).toEqual(before.content)
  if (createsCopy) {
    expect(after.list).toHaveLength(before.list.length + 1)
    expect(before.list.map((item: any) => item.id)).not.toContain(after.activeId)
    expect(after.list.find((item: any) => item.id === after.activeId).name).toBe(name)
    expect(after.list.filter((item: any) => item.id !== after.activeId)).toEqual(before.list)
  } else {
    expect(after.activeId).toBe(before.activeId)
    expect(after.list).toHaveLength(before.list.length)
    if (!dirty) expect(after.list).toEqual(before.list)
  }
  await expect(success(page)).toHaveCount(createsCopy || dirty ? 1 : 0)
  // Read the persisted payload independently of live store flags, then reload its exact active identity.
  const key = mode === 'station' ? 'x4_empire_data' : mode === 'logicFlow' ? 'x4_logic_flow_plans' : 'x4_ship_blueprints_v9'
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key)
  expect(mode === 'ship-build' ? persisted.activeBlueprintId : persisted.activeId).toBe(after.activeId)
  expect(mode === 'ship-build' ? persisted.ships.flatMap((ship: any) => ship.blueprints) : persisted.list).toEqual(after.list)
  if (mode === 'station') console.log('[M15.1 save identity]', await page.evaluate(() => ({
    persistedId: JSON.parse(localStorage.getItem('x4_empire_data')!).activeId,
    viewId: (window as any).activeViewStore.activeEmpireId,
    activeStationId: (window as any).blueprintStore.activeStationId,
    stationIds: (window as any).blueprintStore.activeEmpire.stations.map((s: any) => s.id)
  })))
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  if (mode === 'logicFlow') await page.getByTestId('top-view-btn-flow').click()
  if (mode === 'ship-build') await page.getByTestId('top-view-btn-ship-build').click()
  await expect.poll(async () => (await state(page, mode)).activeId).toBe(after.activeId)
  expect((await state(page, mode)).content).toEqual(before.content)
}

async function openImport(page: Page, dirty: boolean) {
  if (dirty) {
    await page.getByTestId('sidebar-station').first().click()
    await addEnergy(page)
    await expect.poll(() => page.evaluate(() => (window as any).blueprintStore.isDirty)).toBe(true)
  }
  await page.getByTestId('sidebar-overview').click()
  await page.getByTestId('logicflow-import-entry-empire').click()
  await expect(page.getByTestId('import-view-modal')).toBeVisible()
  await expect(page.getByTestId('logicflow-import-plan-list')).toBeVisible()
}
async function confirmImport(page: Page) {
  await page.getByTestId('logicflow-import-plan-direct-logic-flow-1').click()
  await expect(page.getByTestId('import-view-modal')).toBeVisible()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: '保存并导入', exact: true })).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: '放弃并导入', exact: true })).toBeVisible()
  await expect(dialog(page).locator('.dialog-input')).toBeHidden()
}
async function finishImport(page: Page, save: boolean) {
  const before = await state(page, 'station')
  await dialog(page).getByRole('button', { name: save ? '保存并导入' : '放弃并导入', exact: true }).click()
  await expect(page.getByTestId('import-view-modal')).toBeHidden()
  await expect(dialog(page)).toBeHidden()
  await expect(page.getByRole('button', { name: '保存并导入', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '放弃并导入', exact: true })).toHaveCount(0)
  const stations = await page.evaluate(() => (window as any).blueprintStore.activeEmpire.stations)
  expect(stations.map((s: any) => s.name)).toEqual(['E1-S1', 'E1-S2', 'E1-S3'])
  expect(stations.map((s: any) => s.modules)).toEqual([
    [{ id: 'module_gen_prod_claytronics_01', count: 1 }, { id: 'module_gen_prod_hullparts_01', count: 1 }],
    [{ id: 'module_gen_prod_quantumtubes_01', count: 1 }],
    [{ id: 'module_arg_prod_foodrations_01', count: 1 }, { id: 'module_arg_prod_medicalsupplies_01', count: 1 }]
  ])
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_empire_data')!))
  expect(persisted.list).toHaveLength(before.list.length)
  const original = persisted.list.find((item: any) => item.id === before.activeId)
  if (save) expect(original.stations.map((s: any) => s.modules)).toEqual(before.content)
  else expect(persisted.list).toEqual(before.list)
  await expect(success(page)).toHaveCount(save ? 1 : 0)
}

test("2.1 状态: import-view-modal-open-on-empire", async ({ page }) => {
  await openImport(page, false)
})

test("2.2 状态: empire-import-smartsave-open", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
})

test("2.3 切换: empire-import-smartsave-open -> empire-import-finished-after-save", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, true)
})

test("2.4 切换: empire-import-smartsave-open -> empire-import-finished-after-discard", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, false)
})

test("3.1 Case: station-NEW-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'NEW', true, true)
})

test("3.2 Case: station-NEW-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'NEW', true, false)
})

test("3.3 Case: station-NEW-non-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'NEW', false, true)
})

test("3.4 Case: station-NEW-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'NEW', false, false)
})

test("3.15 Case: logicFlow-NEW-non-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'NEW', false, true)
})

test("3.16 Case: logicFlow-NEW-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'NEW', false, false)
})

test("3.27 Case: ship-build-NEW-non-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'NEW', false, true)
})

test("3.28 Case: ship-build-NEW-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'NEW', false, false)
})

test("3.25 Case: ship-build-NEW-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'NEW', true, true)
})

test("3.26 Case: ship-build-NEW-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'NEW', true, false)
})

test("3.29 Case: ship-build-SAVE-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE', true, true)
})

test("3.30 Case: ship-build-SAVE-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE', true, false)
})

test("3.31 Case: ship-build-SAVE-non-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE', false, true)
})

test("3.32 Case: ship-build-SAVE-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE', false, false)
})

test("3.33 Case: ship-build-SAVE_AS-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE_AS', true, true)
})

test("3.34 Case: ship-build-SAVE_AS-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE_AS', true, false)
})

test("3.35 Case: ship-build-SAVE_AS-non-dirty-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE_AS', false, true)
})

test("3.36 Case: ship-build-SAVE_AS-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'ship-build', 'SAVE_AS', false, false)
})

test("3.37 Case: import-open-empire-entry", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
})

test("3.38 Case: import-save-path-close-modal", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, true)
})

test("3.39 Case: import-discard-path-close-modal", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, false)
})

test("3.40 Case: import-open-and-close-without-submit", async ({ page }) => {
  const before = await state(page, 'station')
  await openImport(page, false)
  await page.getByTestId('import-view-modal').getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByTestId('import-view-modal')).toBeHidden()
  expect(await state(page, 'station')).toEqual(before)
})

test("3.41 Case: import-save-path-hide-actions", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, true)
})

test("3.42 Case: import-discard-path-hide-actions", async ({ page }) => {
  await openImport(page, true)
  await confirmImport(page)
  await finishImport(page, false)
})

test("3.5 Case: station-SAVE-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE', true, true)
})

test("3.6 Case: station-SAVE-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE', true, false)
})

test("3.7 Case: station-SAVE-non-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE', false, true)
})

test("3.8 Case: station-SAVE-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE', false, false)
})

test("3.9 Case: station-SAVE_AS-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE_AS', true, true)
})

test("3.10 Case: station-SAVE_AS-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE_AS', true, false)
})

test("3.11 Case: station-SAVE_AS-non-dirty-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE_AS', false, true)
})

test("3.12 Case: station-SAVE_AS-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'station', 'SAVE_AS', false, false)
})

test("3.13 Case: logicFlow-NEW-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'NEW', true, true)
})

test("3.14 Case: logicFlow-NEW-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'NEW', true, false)
})

test("3.17 Case: logicFlow-SAVE-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE', true, true)
})

test("3.18 Case: logicFlow-SAVE-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE', true, false)
})

test("3.19 Case: logicFlow-SAVE-non-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE', false, true)
})

test("3.20 Case: logicFlow-SAVE-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE', false, false)
})

test("3.21 Case: logicFlow-SAVE_AS-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE_AS', true, true)
})

test("3.22 Case: logicFlow-SAVE_AS-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE_AS', true, false)
})

test("3.23 Case: logicFlow-SAVE_AS-non-dirty-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE_AS', false, true)
})

test("3.24 Case: logicFlow-SAVE_AS-non-dirty-non-new", async ({ page }) => {
  await matrix(page, 'logicFlow', 'SAVE_AS', false, false)
})
