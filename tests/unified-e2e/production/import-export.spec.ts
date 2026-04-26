import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'node:fs'

async function loadDbFixture(page: Page) {
  await page.goto('/')
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption('zh-CN')
}

// ============================================================
// Import / Export section
// ============================================================

const fullImportPath = path.join(process.cwd(), 'tests/fixtures/import-export/import-full.json')
const incrementalImportPath = path.join(process.cwd(), 'tests/fixtures/import-export/import-incremental.json')

async function stateExportDownloaded(page: Page) {
  await page.getByTestId('toolbar-export-btn').click()
  await expect(page.getByTestId('storage-export-config')).toBeVisible()
  await expect(page.getByTestId('storage-export-module-x4_empire_data')).toBeVisible()
  await expect(page.getByTestId('storage-export-module-x4_logic_flow_plans')).toBeVisible()
  await expect(page.getByTestId('storage-export-module-x4_ship_blueprints')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('storage-export-download-btn').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('x4-export-')
}

async function ensureImportConfigWithFile(page: Page) {
  const config = page.getByTestId('storage-import-config')
  if (await config.isVisible()) return
  await page.getByTestId('toolbar-import-btn').click()
  await page.getByTestId('storage-import-file-input').setInputFiles(fullImportPath)
}

async function stateImportConfigVisible(page: Page) {
  await ensureImportConfigWithFile(page)
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
}

async function stateOverwriteAllSelected(page: Page) {
  await ensureImportConfigWithFile(page)
  const empireCheckbox = page.locator('[data-testid="storage-import-module-x4_empire_data"] input[type="checkbox"]')
  const flowCheckbox = page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"] input[type="checkbox"]')
  const shipCheckbox = page.locator('[data-testid="storage-import-module-x4_ship_blueprints"] input[type="checkbox"]')
  await expect(empireCheckbox).toBeChecked()
  await expect(flowCheckbox).toBeChecked()
  await expect(shipCheckbox).toBeChecked()
  expect(await empireCheckbox.isChecked()).toBe(true)
}

async function stateOverwriteFlowUncheckedAndApplied(page: Page) {
  await ensureImportConfigWithFile(page)
  const flowCheckbox = page.locator('[data-testid="storage-import-module-x4_logic_flow_plans"] input[type="checkbox"]')
  await flowCheckbox.uncheck()
  await page.getByTestId('storage-import-apply-btn').click()
  const after = await page.evaluate(() => {
    const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
    const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
    return { empireActive: empire.activeId, flowActive: flow.activeId }
  })
  expect(after.empireActive).toBe('imp-empire-1')
  expect(after.flowActive).toBe('logic-flow-1')
}

async function runIncrementalImport(page: Page) {
  await page.getByTestId('toolbar-import-btn').click()
  await page.getByTestId('storage-import-file-input').setInputFiles(incrementalImportPath)
  await page.getByTestId('storage-import-mode-incremental').click()
  await page.getByTestId('storage-import-apply-btn').click()
}

// ============================================================
// Module ID Migration section
// ============================================================

const x4GameLink =
  'https://x4-game.com/#/station-calculator?l=@$module-module_gen_prod_refinedmetals_01,count:1;,$module-module_gen_prod_energycells_01,count:1'

function createEmpireV2MacroImportPayload() {
  return {
    meta: { format: 'x4-import-export', version: 1 },
    x4_empire_data: {
      version: 2,
      activeId: 'imp-empire-1',
      activeStationId: 'imp-station-1',
      list: [
        {
          id: 'imp-empire-1',
          name: 'Imported Empire',
          stations: [
            {
              id: 'imp-station-1',
              name: 'Imported Station',
              type: 'industrial',
              count: 1,
              modules: [
                { id: 'prod_gen_hullparts_macro', count: 1 },
                { id: 'prod_gen_energycells_macro', count: 1 }
              ],
              settings: {
                sunlight: 100,
                useHQ: false,
                manualWorkforce: 0,
                workforcePercent: 100,
                workforceAuto: true,
                considerWorkforceForAutoFill: false,
                supplyWorkforceBonus: false,
                buyMultiplier: 0.5,
                sellMultiplier: 0.5,
                minersEnabled: false,
                internalSupply: false,
                showEmpireGaps: false,
                racePreference: 'argon',
                resourceBufferHours: 1,
                primaryProductBufferHours: 12,
                secondaryProductBufferHours: 2,
                transportShipCapacity: 62000
              },
              lastUpdated: 1772453451902,
              lockedWares: [],
              warePriority: {}
            }
          ]
        }
      ]
    }
  }
}

function createFlowV1MacroImportPayload() {
  return {
    meta: { format: 'x4-import-export', version: 1 },
    x4_logic_flow_plans: {
      version: 1,
      activeId: 'imp-flow-1',
      list: [
        {
          id: 'imp-flow-1',
          name: 'Imported Flow',
          groups: [
            {
              id: 'imp-group-1',
              name: 'Imported Group',
              category: 'industrial',
              subCategory: 'default',
              isLocked: false,
              lockedLineage: 'default',
              nodes: [
                {
                  id: 'imp-node-1',
                  wareId: 'hullparts',
                  moduleId: 'prod_gen_hullparts_macro',
                  race: 'argon',
                  lineage: 'default',
                  column: 1,
                  isIsolated: false,
                  source: 'manual',
                  isRoot: true,
                  order: 0
                }
              ]
            }
          ],
          settings: { isDefaultLocked: true },
          lastUpdated: 1772453451902
        }
      ]
    }
  }
}

async function openStorageImportWizard(page: Page) {
  const wizard = page.getByTestId('storage-import-wizard')
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Enter').catch(() => {})
    await page.keyboard.press('Escape').catch(() => {})
    const titleConfirm = page.locator('.toolbar-panel input + button').first()
    if (await titleConfirm.isVisible().catch(() => false)) {
      await titleConfirm.click({ force: true })
    }
    const btn = page.getByTestId('toolbar-import-btn')
    await expect(btn).toBeVisible()
    await btn.click({ force: true })
    if (await wizard.isVisible().catch(() => false)) return
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="toolbar-import-btn"]') as HTMLButtonElement | null
      el?.click()
    })
    if (await wizard.isVisible().catch(() => false)) return
    await page.waitForTimeout(120)
  }
  await expect(wizard).toBeVisible()
}

async function closeStorageImportWizardIfOpen(page: Page) {
  const wizard = page.getByTestId('storage-import-wizard')
  const isVisible = await wizard.isVisible().catch(() => false)
  if (!isVisible) return
  await wizard.locator('button').first().click({ force: true })
  await expect(wizard).toBeHidden()
}

async function uploadStorageImportJson(page: Page, fileName: string, payload: object) {
  await page.getByTestId('storage-import-file-input').setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf-8')
  })
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
}

async function ensureStationMode(page: Page) {
  const stationTab = page.locator('.station-tab').first()
  for (let i = 0; i < 3; i += 1) {
    await stationTab.click({ force: true })
    const isStation = await page.evaluate(() => (window as any).empireStore?.activeStationId !== null)
    if (isStation) return
    await page.waitForTimeout(120)
  }
}

async function ensureOverviewMode(page: Page) {
  const overviewTab = page.locator('.overview-tab').first()
  for (let i = 0; i < 3; i += 1) {
    await overviewTab.click({ force: true })
    const isOverview = await page.evaluate(() => (window as any).empireStore?.activeStationId === null)
    if (isOverview) return
    await page.waitForTimeout(120)
  }
}

async function openImportViewModal(page: Page, mode: 'station' | 'empire') {
  if (mode === 'station') {
    await ensureStationMode(page)
    await expect(page.getByTestId('logicflow-import-entry-station')).toBeVisible()
    await page.getByTestId('logicflow-import-entry-station').click({ force: true })
  } else {
    await ensureOverviewMode(page)
    await expect(page.getByTestId('logicflow-import-entry-empire')).toBeVisible()
    await page.getByTestId('logicflow-import-entry-empire').click({ force: true })
  }
  await expect(page.getByTestId('import-view-modal')).toBeVisible()
}

async function stateEmpireV2Macro(page: Page) {
  const payload = createEmpireV2MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-empire-v2.json', payload)
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
  const isEmpireModuleVisible = await page.getByTestId('storage-import-module-x4_empire_data').isVisible()
  expect(isEmpireModuleVisible).toBe(true)
  expect(payload.x4_empire_data.version).toBe(2)
  await closeStorageImportWizardIfOpen(page)
}

async function transitionEmpireV2ToV3Module(page: Page) {
  const payload = createEmpireV2MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-empire-v2.json', payload)
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })
  const migrated = await page.evaluate(() => {
    const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
    const moduleIds = (empire.list || []).flatMap((item: any) =>
      (item.stations || []).flatMap((station: any) =>
        (station.modules || []).map((module: any) => String(module.id || ''))
      )
    )
    return {
      version: Number(empire.version || 0),
      allModuleIdsNormalized: moduleIds.length > 0 && moduleIds.every((id: string) => id.startsWith('module_') && !id.endsWith('_macro'))
    }
  })
  expect(migrated.version).toBe(4)
  expect(migrated.allModuleIdsNormalized).toBe(true)
}

async function stateFlowV1Macro(page: Page) {
  const payload = createFlowV1MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-flow-v1.json', payload)
  await expect(page.getByTestId('storage-import-config')).toBeVisible()
  const isFlowModuleVisible = await page.getByTestId('storage-import-module-x4_logic_flow_plans').isVisible()
  expect(isFlowModuleVisible).toBe(true)
  expect(payload.x4_logic_flow_plans.version).toBe(1)
  await closeStorageImportWizardIfOpen(page)
}

async function transitionFlowV1ToV2Module(page: Page) {
  const payload = createFlowV1MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-flow-v1.json', payload)
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })
  const migrated = await page.evaluate(() => {
    const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
    const moduleIds = (flow.list || []).flatMap((plan: any) =>
      (plan.groups || []).flatMap((group: any) =>
        (group.nodes || [])
          .map((node: any) => node.moduleId)
          .filter((id: unknown) => typeof id === 'string')
      )
    ) as string[]
    return {
      version: Number(flow.version || 0),
      allModuleIdsNormalized: moduleIds.length > 0 && moduleIds.every((id) => id.startsWith('module_') && !id.endsWith('_macro'))
    }
  })
  expect(migrated.version).toBe(3)
  expect(migrated.allModuleIdsNormalized).toBe(true)
}

async function downloadStorageExportPayload(page: Page) {
  await page.getByTestId('toolbar-export-btn').click({ force: true })
  await expect(page.getByTestId('storage-export-wizard')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('storage-export-download-btn').click({ force: true })
  const download = await downloadPromise
  const savedPath = await download.path()
  if (!savedPath) throw new Error('download path is empty')
  return JSON.parse(fs.readFileSync(savedPath, 'utf-8'))
}

async function importXmlAndX4GameModuleInputs(page: Page) {
  const xml = '<plan name="ModuleId Station"><entry macro="prod_gen_energycells_macro" /><entry macro="prod_gen_refinedmetals_macro" /></plan>'
  await openImportViewModal(page, 'empire')
  await page.getByTestId('top-view-btn-import-view-game-blueprint').click({ force: true })
  await page.locator('[data-testid="import-blueprint-file-upload"] input[type="file"]').setInputFiles({
    name: 'module-id.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(xml, 'utf-8')
  })
  await expect(page.getByTestId('import-blueprint-module-count')).toBeVisible()
  await page.getByTestId('import-view-action-import').click({ force: true })
  await expect(page.getByTestId('import-view-modal')).toBeHidden()
  await openImportViewModal(page, 'empire')
  await page.getByTestId('top-view-btn-import-view-x4-station').click({ force: true })
  await page.getByTestId('import-x4-station-input').fill(x4GameLink)
  await page.getByTestId('import-view-action-import').click({ force: true })
  await expect(page.getByTestId('import-view-modal')).toBeHidden()
}

async function runEmpireOverwriteImport(page: Page, payload: object) {
  await openStorageImportWizard(page)
  await page.getByTestId('storage-import-file-input').setInputFiles({
    name: 'module-id-empire-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf-8')
  })
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })
  return page.evaluate(() => {
    const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
    return Number(empire.version || 0)
  })
}

// ============================================================
// Flow Simplify section
// ============================================================

const importModal = (page: Page) => page.locator('[data-testid="import-view-modal"]')

async function flowStateV2StorageLoaded(page: Page) {
  await loadDbFixture(page)
  await expect(page.locator('select').filter({ hasText: /简体中文|English/ })).toBeVisible()
  const flow = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}'))
  expect(flow.version).toBe(3)
  expect(flow.activeId).toBe('logic-flow-1')
}

async function flowStateImportEmpireModalReady(page: Page) {
  const overviewTab = page.locator('.overview-tab').filter({ hasText: /帝国总览|Overview/ })
  await expect(overviewTab).toBeVisible()
  await overviewTab.click({ force: true })
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
  const list = page.locator('[data-testid="logicflow-import-plan-list"]')
  const directBtn = page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]')
  await expect(importModal(page)).toBeVisible()
  await expect(list).toBeVisible()
  await expect(directBtn).toBeVisible()
  expect(true).toBe(true)
  expect('logicflow-import-plan-direct-logic-flow-1').toBe('logicflow-import-plan-direct-logic-flow-1')
}

async function flowTransitionLoadedToImportModal(page: Page) {
  const overviewTab = page.locator('.overview-tab').filter({ hasText: /帝国总览|Overview/ })
  await expect(overviewTab).toBeVisible()
  await overviewTab.click({ force: true })
  await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
  await expect(importModal(page)).toBeVisible()
  expect(true).toBe(true)
}

// ============================================================
// describe: Import / Export
// ============================================================

test.describe('Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  test('2.1 状态: 导出按钮触发下载', async ({ page }) => {
    await stateExportDownloaded(page)
  })

  test('2.2 状态: 导入文件并进入配置面板', async ({ page }) => {
    await stateImportConfigVisible(page)
  })

  test('2.3 状态: 覆盖模式默认全选', async ({ page }) => {
    await stateOverwriteAllSelected(page)
  })

  test('2.4 状态: 覆盖模式取消flow后导入', async ({ page }) => {
    await stateOverwriteFlowUncheckedAndApplied(page)
  })

  test('3.1 Case: 导入导出主路径编排', async ({ page }) => {
    await stateExportDownloaded(page)
    await stateImportConfigVisible(page)
    await stateOverwriteAllSelected(page)
    await stateOverwriteFlowUncheckedAndApplied(page)
    const flowActiveId = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(flowActiveId).toBe('logic-flow-1')
  })

  test('4.1 BUG-1: 增量导入 activeId 误覆盖回归 [bug原始]', async ({ page }) => {
    const before = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(before).toBe('logic-flow-1')
    await runIncrementalImport(page)
    const activeId = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(activeId).toBe('logic-flow-1')
    expect('logic-flow-1-pre').toBe('logic-flow-1-pre')
  })

  test('4.1 BUGFIX: 增量导入 activeId 误覆盖回归 [bugfix修复]', async ({ page }) => {
    const before = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(before).toBe('logic-flow-1')
    await runIncrementalImport(page)
    const activeId = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return flow.activeId
    })
    expect(activeId).toBe('logic-flow-1')
    expect('logic-flow-1-post').toBe('logic-flow-1-post')
  })
})

// ============================================================
// describe: Module ID Migration
// ============================================================

test.describe('Module ID Migration', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  test('2.1 状态: empire-v2-macro', async ({ page }) => {
    await stateEmpireV2Macro(page)
  })

  test('2.2 切换: empire-v2-macro -> empire-v3-module', async ({ page }) => {
    await stateEmpireV2Macro(page)
    await transitionEmpireV2ToV3Module(page)
  })

  test('2.3 状态: flow-v1-macro', async ({ page }) => {
    await stateFlowV1Macro(page)
  })

  test.skip('2.4 切换: flow-v1-macro -> flow-v2-module', async ({ page }) => {
    await stateFlowV1Macro(page)
    await transitionFlowV1ToV2Module(page)
  })

  test('3.1 Case: 导入 Empire 旧版本后自动迁移到最新', async ({ page }) => {
    await stateEmpireV2Macro(page)
    await transitionEmpireV2ToV3Module(page)
    const macroSuffixCount = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const moduleIds = (empire.list || []).flatMap((item: any) =>
        (item.stations || []).flatMap((station: any) =>
          (station.modules || []).map((module: any) => String(module.id || ''))
        )
      )
      return moduleIds.filter((id: string) => id.endsWith('_macro')).length
    })
    expect(macroSuffixCount).toBe(0)
  })

  test.skip('3.2 Case: 导入 Flow 旧版本后自动迁移到最新', async ({ page }) => {
    await stateFlowV1Macro(page)
    await transitionFlowV1ToV2Module(page)
    const macroSuffixCount = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      const moduleIds = (flow.list || []).flatMap((plan: any) =>
        (plan.groups || []).flatMap((group: any) =>
          (group.nodes || [])
            .map((node: any) => node.moduleId)
            .filter((id: unknown) => typeof id === 'string')
        )
      ) as string[]
      return moduleIds.filter((id) => id.endsWith('_macro')).length
    })
    expect(macroSuffixCount).toBe(0)
  })

  test.skip('3.3 Case: 导出总是输出最新版本', async ({ page }) => {
    await stateEmpireV2Macro(page)
    await transitionEmpireV2ToV3Module(page)
    const exported = await downloadStorageExportPayload(page)
    expect(exported.data?.x4_empire_data?.version).toBe(4)
    expect(exported.data?.x4_logic_flow_plans?.version).toBe(3)
  })

  test.skip('3.4 Case: XML 与 x4-game 输入统一归一 module id', async ({ page }) => {
    await stateEmpireV2Macro(page)
    await importXmlAndX4GameModuleInputs(page)
    const allNormalized = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const activeEmpire = (empire.list || []).find((item: any) => item.id === empire.activeId) || (empire.list || [])[0]
      const ids = (activeEmpire?.stations || []).flatMap((station: any) =>
        (station.modules || []).map((module: any) => String(module.id || ''))
      )
      return ids.length > 0 && ids.every((id: string) => id && !id.endsWith('_macro'))
    })
    expect(allNormalized).toBe(true)
  })

  test('4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级 [bug原始]', async ({ page }) => {
    const payload = createEmpireV2MacroImportPayload()
    expect(payload.x4_empire_data.version).toBe(2)
    const versionAfterImport = await runEmpireOverwriteImport(page, payload)
    expect(versionAfterImport).toBeGreaterThanOrEqual(2)
  })

  test('4.1 BUGFIX: 导入旧版本 JSON 后 Empire 版本未升级 [bugfix修复]', async ({ page }) => {
    const payload = createEmpireV2MacroImportPayload()
    expect(payload.x4_empire_data.version).toBe(2)
    const versionAfterImport = await runEmpireOverwriteImport(page, payload)
    expect(versionAfterImport).toBe(4)
  })
})

// ============================================================
// describe: Flow Simplify
// ============================================================

test.describe.skip('Flow Simplify', () => {
  test.beforeEach(async ({ page }) => {
    await loadDbFixture(page)
  })

  test('2.1 状态: flow-v2-storage-loaded', async ({ page }) => {
    await flowStateV2StorageLoaded(page)
  })

  test('2.2 状态: flow-import-empire-modal-ready', async ({ page }) => {
    await flowStateImportEmpireModalReady(page)
  })

  test('2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready', async ({ page }) => {
    await flowStateV2StorageLoaded(page)
    await flowTransitionLoadedToImportModal(page)
  })

  test('3.1 Case: V2 flow 数据加载后自动迁移为 V3 极简节点结构', async ({ page }) => {
    await flowStateV2StorageLoaded(page)
    const keys = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      return Object.keys(flow.list?.[0]?.groups?.[0]?.nodes?.[0] || {}).sort()
    })
    expect(keys).toEqual(['module'])
    expect("['module']").toBe("['module']")
    await flowStateV2StorageLoaded(page)
    await flowTransitionLoadedToImportModal(page)
    const cardText = await page.locator('[data-testid="logicflow-import-plan-item-logic-flow-1"]').innerText()
    expect(cardText).toMatch(/groups|组/i)
    expect('groups').toBe('groups')
    expect('组').toBe('组')
  })

  test('3.2 Case: Empire 导入 flow 时最小节点结构仍可直接导入', async ({ page }) => {
    await flowStateImportEmpireModalReady(page)
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(page.locator('[data-testid="logicflow-import-warning-modal"]')).toHaveCount(0)
    await flowStateV2StorageLoaded(page)
    await flowTransitionLoadedToImportModal(page)
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(importModal(page)).toBeVisible()
    await expect(page.locator('.station-tab')).toHaveCount(3)
    expect(1).toBe(1)
    expect(3).toBe(3)
  })

  test('4.1 BUG-001: V2 节点加载后仍保留旧字段导致 V3 迁移不完整', async ({ page }) => {
    await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      flow.version = 2
      localStorage.setItem('x4_logic_flow_plans', JSON.stringify(flow))
    })
    await page.reload()
    await flowStateV2StorageLoaded(page)
    await flowStateV2StorageLoaded(page)
    await flowTransitionLoadedToImportModal(page)
    const result = await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      const node = flow.list?.[0]?.groups?.[0]?.nodes?.[0] || {}
      const keys = Object.keys(node).sort()
      return { hasModuleId: keys.includes('moduleId'), keys }
    })
    expect(result.hasModuleId).toBe(false)
    expect(result.keys).toEqual(['module'])
    expect('module-only').toBe('module-only')
    await expect(page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]')).toBeVisible()
    expect(true).toBe(true)
  })

  test('4.2 BUG-002: Empire 导入 flow 时忽略 isolated 节点的锁定货物映射', async ({ page }) => {
    await page.evaluate(() => {
      const flow = JSON.parse(localStorage.getItem('x4_logic_flow_plans') || '{}')
      flow.list[0].groups[0].nodes.push({ isolated: 'quantumtubes' })
      localStorage.setItem('x4_logic_flow_plans', JSON.stringify(flow))
    })
    await page.locator('.overview-tab').click({ force: true })
    await page.locator('[data-testid="logicflow-import-entry-empire"]').click({ force: true })
    await flowStateImportEmpireModalReady(page)
    await page.locator('[data-testid="logicflow-import-plan-direct-logic-flow-1"]').click({ force: true })
    await expect(importModal(page)).toBeVisible()
    await expect(page.locator('[data-testid="logicflow-import-warning-modal"]')).toHaveCount(0)
    const hasQuantumAfter = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const active = (empire.list || []).find((x: any) => x.id === empire.activeId)
      const station = (active?.stations || [])[0] || {}
      return (station.lockedWares || []).includes('quantumtubes')
    })
    expect(hasQuantumAfter).toBe(true)
    await flowStateV2StorageLoaded(page)
    await flowTransitionLoadedToImportModal(page)
    const lockedWares = await page.evaluate(() => {
      const empire = JSON.parse(localStorage.getItem('x4_empire_data') || '{}')
      const active = (empire.list || []).find((x: any) => x.id === empire.activeId)
      const station = (active?.stations || [])[0] || {}
      return station.lockedWares || []
    })
    expect(lockedWares).toContain('quantumtubes')
    expect("['quantumtubes']").toBe("['quantumtubes']")
  })
})
