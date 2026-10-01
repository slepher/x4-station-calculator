import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const fullImport = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/import-export/import-full.json'), 'utf8'))
const incrementalImport = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/import-export/import-incremental.json'), 'utf8'))
const HULL = 'module_gen_prod_hullparts_01'
const ENERGY = 'module_gen_prod_energycells_01'
const REFINED = 'module_gen_prod_refinedmetals_01'
const importModal = (page: Page) => page.getByTestId('import-view-modal')

async function loadDbFixture(page: Page, mode: 'seeded' | 'legacy-flow-v2' = 'seeded') {
  await page.goto('/')
  const fixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const data = JSON.parse(JSON.stringify(fixture.default)); delete data.vsn
  data.x4_game_version = { version: '9.0', beta: false }
  if (mode === 'legacy-flow-v2') {
    // Actual V2 expanded fixture; the base db is already V3 and cannot reproduce migration by itself.
    const outputWares: Record<string, string> = {
      module_gen_prod_claytronics_01: 'claytronics', module_gen_prod_hullparts_01: 'hullparts',
      module_gen_prod_quantumtubes_01: 'quantumtubes', module_arg_prod_foodrations_01: 'foodrations',
      module_arg_prod_medicalsupplies_01: 'medicalsupplies'
    }
    const plan = data.x4_logic_flow_plans_v9.list.find((item: any) => item.id === 'logic-flow-1')
    plan.groups.forEach((group: any) => {
      group.nodes = group.nodes.map((node: any, index: number) => ({
        id: `${group.id}-legacy-${index}`, source: 'manual', race: 'argon', lineage: 'default',
        column: 2, isRoot: true, order: index,
        ...(node.module ? { moduleId: node.module, wareId: outputWares[node.module], isIsolated: false }
          : { wareId: node.isolated, isIsolated: true })
      }))
    })
    data.x4_logic_flow_plans_v9 = { version: 2, activeId: plan.id, list: [plan] }
    data.x4_empire_data_v9 = { version: 5, activeId: null, list: [] }
  }
  await page.evaluate(data => {
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)))
    localStorage.setItem('isTestEnv', 'true')
  }, data)
  await page.reload()
  await page.getByTestId('language-select').selectOption('zh-CN')
  await expect.poll(() => page.evaluate(() => (window as any).gameDataStore.currentVersion)).toBe('9.0')
}

async function readStorage(page: Page, key: string) {
  return page.evaluate(key => {
    const value = localStorage.getItem(key)
    if (value === null) throw new Error(`Missing storage ${key}`)
    return JSON.parse(value)
  }, key)
}
async function openStorageImport(page: Page, payload = fullImport, name = 'import.json') {
  await page.getByTestId('toolbar-import-btn').click()
  await expect(page.getByTestId('storage-import-wizard')).toBeVisible()
  await page.getByTestId('storage-import-file-input').setInputFiles({
    name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload), 'utf8')
  })
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
}
async function applyStorageImport(page: Page) {
  // Apply is asynchronous and explicitly reloads the page. Wait for that navigation before reading persistence.
  await Promise.all([
    page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }),
    page.getByTestId('storage-import-apply-btn').click()
  ])
  await page.waitForLoadState('domcontentloaded')
  await expect(page.getByTestId('storage-import-wizard')).toHaveCount(0)
  await expect(page.getByTestId('language-select')).toBeVisible()
}
async function closeStorageImport(page: Page) {
  await page.getByTestId('storage-import-wizard').getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByTestId('storage-import-wizard')).toBeHidden()
}
async function downloadExport(page: Page, fileName?: string) {
  await page.getByTestId('toolbar-export-btn').click()
  await expect(page.getByTestId('storage-export-config')).toBeVisible()
  for (const module of ['x4_empire_data', 'x4_logic_flow_plans', 'x4_ship_blueprints']) {
    await expect(page.getByTestId(`storage-export-module-${module}`)).toBeVisible()
  }
  if (fileName !== undefined) await page.getByTestId('storage-export-filename-input').fill(fileName)
  const pending = page.waitForEvent('download')
  await page.getByTestId('storage-export-download-btn').click()
  const download = await pending
  const location = await download.path()
  expect(location).not.toBeNull()
  const payload = JSON.parse(fs.readFileSync(location!, 'utf8'))
  await expect(page.getByTestId('storage-export-wizard')).toBeHidden()
  return { payload, filename: download.suggestedFilename() }
}
function expectCurrentExport(payload: any) {
  expect(payload).toMatchObject({ format: 'x4-import-export', version: 1, game_vsn: '9.0', beta: false })
  expect(payload.data.x4_empire_data.version).toBe(5)
  expect(payload.data.x4_logic_flow_plans.version).toBe(3)
  expect(payload.data.x4_ship_blueprints.version).toBe(5)
}
async function expectOverwriteSelections(page: Page) {
  for (const module of ['x4_empire_data', 'x4_logic_flow_plans', 'x4_ship_blueprints']) {
    await expect(page.getByTestId(`storage-import-module-${module}`).getByRole('checkbox')).toBeChecked()
  }
}
async function overwriteWithoutFlow(page: Page) {
  const before = await readStorage(page, 'x4_logic_flow_plans_v9')
  await page.getByTestId('storage-import-module-x4_logic_flow_plans').getByRole('checkbox').uncheck()
  await applyStorageImport(page)
  const empire = await readStorage(page, 'x4_empire_data_v9')
  expect(empire.activeId).toBe('imp-empire-1')
  expect(empire.list).toHaveLength(1)
  expect(empire.list[0].stations[0].modules).toEqual([{ id: HULL, count: 1 }])
  expect(await readStorage(page, 'x4_logic_flow_plans_v9')).toEqual(before)
}
async function incremental(page: Page) {
  await openStorageImport(page, incrementalImport, 'incremental.json')
  await page.getByTestId('storage-import-mode-incremental').click()
  await applyStorageImport(page)
}
function empireV2Payload() {
  const empire = JSON.parse(JSON.stringify(fullImport.x4_empire_data))
  empire.list[0].stations[0].modules = [{ id: 'prod_gen_hullparts_macro', count: 1 }, { id: 'prod_gen_energycells_macro', count: 1 }]
  return { meta: { format: 'x4-import-export', version: 1 }, x4_empire_data: empire }
}
function flowV1Payload() {
  return {
    meta: { format: 'x4-import-export', version: 1 },
    x4_logic_flow_plans: {
      version: 1, activeId: 'imp-flow-1', list: [{
        id: 'imp-flow-1', name: 'Imported Flow', settings: { isDefaultLocked: true }, lastUpdated: 1772453451902,
        groups: [{ id: 'imp-group-1', name: 'Imported Group', category: 'industrial', subCategory: 'default', isLocked: false, lockedLineage: 'default', nodes: [{
          id: 'imp-node-1', wareId: 'hullparts', moduleId: 'prod_gen_hullparts_macro', race: 'argon', lineage: 'default',
          column: 2, isIsolated: false, source: 'manual', isRoot: true, order: 0
        }] }]
      }]
    }
  }
}
async function importEmpireV2(page: Page) {
  await openStorageImport(page, empireV2Payload(), 'empire-v2.json')
  await applyStorageImport(page)
  const state = await readStorage(page, 'x4_empire_data_v9')
  expect(state.version).toBe(5)
  expect(state.activeId).toBe('imp-empire-1')
  expect(state.list).toHaveLength(1)
  expect(state.list[0].name).toBe('Imported Empire')
  expect(state.list[0].stations[0]).toMatchObject({ id: 'imp-station-1', name: 'Imported Station', modules: [{ id: HULL, count: 1 }, { id: ENERGY, count: 1 }] })
  return state
}
async function importFlowV1(page: Page) {
  await openStorageImport(page, flowV1Payload(), 'flow-v1.json')
  await applyStorageImport(page)
  const state = await readStorage(page, 'x4_logic_flow_plans_v9')
  expect(state.version).toBe(3)
  expect(state.activeId).toBe('imp-flow-1')
  expect(state.list).toHaveLength(1)
  expect(state.list[0].groups[0].nodes).toEqual([{ module: HULL }])
  return state
}
async function openOverviewImport(page: Page) {
  await page.getByTestId('sidebar-overview').click()
  await page.getByTestId('logicflow-import-entry-empire').click()
  await expect(importModal(page)).toBeVisible()
}
async function activeStations(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as any).blueprintStore?.activeEmpire != null)).toBe(true)
  return page.evaluate(() => (window as any).blueprintStore.activeEmpire.stations)
}
async function saveNewEmpire(page: Page, name: string) {
  await page.getByTestId('toolbar-save-btn').click()
  const dialog = page.getByTestId('dialog-backdrop')
  await expect(dialog).toBeVisible()
  await dialog.locator('.dialog-input').fill(name)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test.describe('Import/Export', () => {
  test.beforeEach(async ({ page }) => { await loadDbFixture(page) })
  test('2.1 状态: 导出按钮触发下载', async ({ page }) => {
    const { payload, filename } = await downloadExport(page)
    expect(filename).toMatch(/^x4-export-9\.0-.*\.json$/)
    expectCurrentExport(payload)
    expect(payload.data.x4_empire_data.list.map((item: any) => item.id)).toEqual(['empire-1', 'empire-2', 'empire-3'])
  })
  test('2.2 状态: 导入文件并进入配置面板', async ({ page }) => {
    await openStorageImport(page)
    await expect(page.getByTestId('storage-import-mode-overwrite')).toBeVisible()
    await expect(page.getByTestId('storage-import-mode-incremental')).toBeVisible()
    await expectOverwriteSelections(page)
  })
  test('2.3 状态: 覆盖模式默认全选', async ({ page }) => { await openStorageImport(page); await expectOverwriteSelections(page) })
  test('2.4 状态: 覆盖模式取消flow后导入', async ({ page }) => { await openStorageImport(page); await overwriteWithoutFlow(page) })
  test('3.1 Case: 导入导出主路径编排', async ({ page }) => {
    const exported = await downloadExport(page, 'M7.4-roundtrip')
    expect(exported.filename).toBe('M7.4-roundtrip.json'); expectCurrentExport(exported.payload)
    await openStorageImport(page); await expectOverwriteSelections(page); await overwriteWithoutFlow(page)
    const next = await downloadExport(page)
    expectCurrentExport(next.payload)
    expect(next.payload.data.x4_empire_data.activeId).toBe('imp-empire-1')
    expect(next.payload.data.x4_empire_data.list[0].stations[0].modules).toEqual([{ id: HULL, count: 1 }])
    expect(next.payload.data.x4_logic_flow_plans).toEqual(exported.payload.data.x4_logic_flow_plans)
  })
  test('4.1 BUG-1: 增量导入 activeId 误覆盖回归 [bug原始]', async ({ page }) => {
    const before = await readStorage(page, 'x4_logic_flow_plans_v9')
    await incremental(page)
    const after = await readStorage(page, 'x4_logic_flow_plans_v9')
    expect(after.activeId).toBe('logic-flow-1')
    expect(after.list).toHaveLength(before.list.length + 1)
    expect(after.list.find((plan: any) => plan.id === 'logic-flow-1')).toEqual(before.list.find((plan: any) => plan.id === 'logic-flow-1'))
    const added = after.list.find((plan: any) => plan.name === 'Duplicate Flow Id')
    expect(added.id).not.toBe('logic-flow-1')
    expect(added.groups[0].id).not.toBe('lf-1-g1')
    expect(added.groups[0].nodes).toEqual([{ isolated: 'energycells' }])
  })
  test('4.1 BUGFIX: 增量导入 activeId 误覆盖回归 [bugfix修复]', async ({ page }) => {
    await incremental(page)
    const flow = await readStorage(page, 'x4_logic_flow_plans_v9'), empire = await readStorage(page, 'x4_empire_data_v9')
    expect(flow.activeId).toBe('logic-flow-1'); expect(empire.activeId).toBe('empire-1')
    expect(flow.list).toHaveLength(4); expect(empire.list).toHaveLength(4)
    expect(new Set(flow.list.map((x: any) => x.id)).size).toBe(4)
    expect(new Set(empire.list.map((x: any) => x.id)).size).toBe(4)
    const added = empire.list.find((x: any) => x.name === 'Duplicate Empire Id')
    expect(added.id).not.toBe('empire-1')
    expect(added.stations[0].id).not.toBe('empire-1-station-1')
    expect(added.stations[0].modules).toEqual([{ id: 'module_gen_prod_claytronics_01', count: 1 }])
  })
})

test.describe('Module ID Migration', () => {
  test.beforeEach(async ({ page }) => { await loadDbFixture(page) })
  test('2.1 状态: empire-v2-macro', async ({ page }) => {
    const payload = empireV2Payload(); expect(payload.x4_empire_data.version).toBe(2)
    await openStorageImport(page, payload)
    await expect(page.getByTestId('storage-import-module-x4_empire_data').getByRole('checkbox')).toBeChecked()
    await closeStorageImport(page)
  })
  test('2.2 切换: empire-v2-macro -> empire-v3-module', async ({ page }) => { await importEmpireV2(page) })
  test('2.3 状态: flow-v1-macro', async ({ page }) => {
    const payload = flowV1Payload(); expect(payload.x4_logic_flow_plans.version).toBe(1)
    await openStorageImport(page, payload)
    await expect(page.getByTestId('storage-import-module-x4_logic_flow_plans').getByRole('checkbox')).toBeChecked()
    await closeStorageImport(page)
  })
  test('2.4 切换: flow-v1-macro -> flow-v2-module', async ({ page }) => { await importFlowV1(page) })
  test('3.1 Case: 导入 Empire 旧版本后自动迁移到最新', async ({ page }) => {
    const imported = await importEmpireV2(page)
    await page.reload()
    expect(await readStorage(page, 'x4_empire_data_v9')).toEqual(imported)
  })
  test('3.2 Case: 导入 Flow 旧版本后自动迁移到最新', async ({ page }) => {
    const imported = await importFlowV1(page)
    await page.reload()
    expect(await readStorage(page, 'x4_logic_flow_plans_v9')).toEqual(imported)
  })
  test('3.3 Case: 导出总是输出最新版本', async ({ page }) => {
    await importEmpireV2(page)
    const { payload } = await downloadExport(page)
    expectCurrentExport(payload)
    expect(payload.data.x4_empire_data.list[0].stations[0].modules).toEqual([{ id: HULL, count: 1 }, { id: ENERGY, count: 1 }])
  })
  test('3.4 Case: XML 与 x4-game 输入统一归一 module id', async ({ page }) => {
    const beforeIds = (await activeStations(page)).map((station: any) => station.id)
    await openOverviewImport(page)
    await page.getByTestId('top-view-btn-import-view-game-blueprint').click()
    await page.locator('[data-testid="import-blueprint-file-upload"] input').setInputFiles({ name: 'module-id.xml', mimeType: 'text/xml', buffer: Buffer.from('<plan name="ModuleId Station"><entry macro="prod_gen_energycells_macro"/><entry macro="prod_gen_refinedmetals_macro"/></plan>') })
    await expect(page.getByTestId('import-blueprint-module-count')).toContainText('2')
    await page.getByTestId('import-view-action-import').click(); await expect(importModal(page)).toBeHidden()
    await openOverviewImport(page)
    await page.getByTestId('top-view-btn-import-view-x4-station').click()
    await page.getByTestId('import-x4-station-input').fill('https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1')
    await page.getByTestId('import-view-action-import').click(); await expect(importModal(page)).toBeHidden()
    const added = (await activeStations(page)).filter((station: any) => !beforeIds.includes(station.id))
    expect(added).toHaveLength(2)
    expect(added[0].name).toBe('ModuleId Station')
    for (const station of added) expect([...station.modules].sort((a: any, b: any) => a.id.localeCompare(b.id))).toEqual([{ id: ENERGY, count: 1 }, { id: REFINED, count: 1 }])
    await page.getByTestId('toolbar-save-btn').click()
    await expect.poll(async () => (await readStorage(page, 'x4_empire_data_v9')).list.find((e: any) => e.id === 'empire-1').stations.length).toBe(beforeIds.length + 2)
    await page.reload()
    const restored = (await activeStations(page)).filter((station: any) => !beforeIds.includes(station.id))
    expect(restored).toEqual(added)
  })
  test('4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级 [bug原始]', async ({ page }) => { await importEmpireV2(page) })
  test('4.1 BUGFIX: 导入旧版本 JSON 后 Empire 版本未升级 [bugfix修复]', async ({ page }) => {
    await importEmpireV2(page)
    const exported = await downloadExport(page)
    expect(exported.payload.data.x4_empire_data.version).toBe(5)
  })
})

const expectedFlowGroups = [
  [{ module: 'module_gen_prod_claytronics_01' }, { module: HULL }, { isolated: 'quantumtubes' }],
  [{ module: 'module_gen_prod_quantumtubes_01' }],
  [{ module: 'module_arg_prod_foodrations_01' }, { module: 'module_arg_prod_medicalsupplies_01' }]
]
async function expectMigratedFlow(page: Page) {
  const state = await readStorage(page, 'x4_logic_flow_plans_v9')
  expect(state.version).toBe(3); expect(state.activeId).toBe('logic-flow-1')
  expect(state.list).toHaveLength(1)
  expect(state.list[0].groups.map((group: any) => group.nodes)).toEqual(expectedFlowGroups)
}
async function openFlowImport(page: Page) {
  await openOverviewImport(page)
  await expect(page.getByTestId('logicflow-import-plan-list')).toBeVisible()
  await expect(page.getByTestId('logicflow-import-plan-direct-logic-flow-1')).toBeVisible()
}
async function importFlowStations(page: Page) {
  await openFlowImport(page)
  await page.getByTestId('logicflow-import-plan-direct-logic-flow-1').click()
  await expect(importModal(page)).toBeHidden()
  await expect(page.getByTestId('logicflow-import-warning-modal')).toHaveCount(0)
  await expect(page.getByTestId('sidebar-station')).toHaveCount(3)
  const stations = await activeStations(page)
  expect(stations.map((station: any) => station.name)).toEqual(['E1-S1', 'E1-S2', 'E1-S3'])
  expect(stations.map((station: any) => station.modules)).toEqual([
    [{ id: 'module_gen_prod_claytronics_01', count: 1 }, { id: HULL, count: 1 }],
    [{ id: 'module_gen_prod_quantumtubes_01', count: 1 }],
    [{ id: 'module_arg_prod_foodrations_01', count: 1 }, { id: 'module_arg_prod_medicalsupplies_01', count: 1 }]
  ])
  expect(stations.map((station: any) => station.lockedWares)).toEqual([['quantumtubes'], [], []])
  return stations
}
test.describe('Flow Simplify', () => {
  test.beforeEach(async ({ page }) => { await loadDbFixture(page, 'legacy-flow-v2') })
  test('2.1 状态: flow-v2-storage-loaded', async ({ page }) => { await expectMigratedFlow(page) })
  test('2.2 状态: flow-import-empire-modal-ready', async ({ page }) => { await openFlowImport(page) })
  test('2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready', async ({ page }) => { await expectMigratedFlow(page); await openFlowImport(page) })
  test('3.1 Case: V2 flow 数据加载后自动迁移为 V3 极简节点结构', async ({ page }) => {
    await expectMigratedFlow(page); await openFlowImport(page)
    await expect(page.getByTestId('logicflow-import-plan-item-logic-flow-1')).toContainText('3')
  })
  test('3.2 Case: Empire 导入 flow 时最小节点结构仍可直接导入', async ({ page }) => { await importFlowStations(page) })
  test('4.1 BUG-001: V2 节点加载后仍保留旧字段导致 V3 迁移不完整', async ({ page }) => {
    await expectMigratedFlow(page)
    await page.reload(); await expectMigratedFlow(page)
    const { payload } = await downloadExport(page)
    expect(payload.data.x4_logic_flow_plans.list[0].groups.map((group: any) => group.nodes)).toEqual(expectedFlowGroups)
  })
  test('4.2 BUG-002: Empire 导入 flow 时忽略 isolated 节点的锁定货物映射', async ({ page }) => {
    await importFlowStations(page)
    await saveNewEmpire(page, 'M7.4 Imported Flow')
    await page.reload()
    const stations = await activeStations(page)
    expect(stations.map((station: any) => station.name)).toEqual(['E1-S1', 'E1-S2', 'E1-S3'])
    expect(stations.map((station: any) => station.lockedWares)).toEqual([['quantumtubes'], [], []])
  })
})
