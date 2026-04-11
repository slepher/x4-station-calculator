import fs from 'node:fs'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import { test } from '../../test-setup'

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

async function loadDbFixture(page: Page) {
  const dbFixture = await import('../../fixtures/db.json', { with: { type: 'json' } })
  const dbData = JSON.parse(JSON.stringify(dbFixture.default))
  delete dbData.vsn

  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
}

async function setLanguageByUi(page: Page) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ }).first()
  await langSelect.selectOption('zh-CN')
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
  // 2.1.1 预置仅含旧 macro id 的 Empire 导入文件
  const payload = createEmpireV2MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-empire-v2.json', payload)

  // 2.1.2 打开 storage-import 流程并完成文件解析
  await expect(page.getByTestId('storage-import-config')).toBeVisible()

  // 2.1.3 解析后 `storage-import-module-x4_empire_data` 可见，且导入样例 JSON 的 `x4_empire_data.version` 为 2 #期望: [true, 2]
  const isEmpireModuleVisible = await page.getByTestId('storage-import-module-x4_empire_data').isVisible()
  expect(isEmpireModuleVisible).toBe(true)
  expect(payload.x4_empire_data.version).toBe(2)

  await closeStorageImportWizardIfOpen(page)
}

async function transitionEmpireV2ToV3Module(page: Page) {
  const payload = createEmpireV2MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-empire-v2.json', payload)

  // 2.2.1 在覆盖模式执行 Empire 导入
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })

  // 2.2.2 读取 `x4_empire_data` 并检查版本与模块 ID
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

  // 2.2.3 导入后版本升级为 3 且模块 ID 为 module id #期望: [3, true]
  expect(migrated.version).toBe(3)
  expect(migrated.allModuleIdsNormalized).toBe(true)
}

async function stateFlowV1Macro(page: Page) {
  // 2.3.1 预置仅含旧 macro id 的 Flow 导入文件
  const payload = createFlowV1MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-flow-v1.json', payload)

  // 2.3.2 打开 storage-import 流程并勾选 Flow 模块
  await expect(page.getByTestId('storage-import-config')).toBeVisible()

  // 2.3.3 解析后 `storage-import-module-x4_logic_flow_plans` 可见，且导入样例 JSON 的 `x4_logic_flow_plans.version` 为 1 #期望: [true, 1]
  const isFlowModuleVisible = await page.getByTestId('storage-import-module-x4_logic_flow_plans').isVisible()
  expect(isFlowModuleVisible).toBe(true)
  expect(payload.x4_logic_flow_plans.version).toBe(1)

  await closeStorageImportWizardIfOpen(page)
}

async function transitionFlowV1ToV2Module(page: Page) {
  const payload = createFlowV1MacroImportPayload()
  await openStorageImportWizard(page)
  await uploadStorageImportJson(page, 'module-id-flow-v1.json', payload)

  // 2.4.1 在覆盖模式执行 Flow 导入
  await page.getByTestId('storage-import-mode-overwrite').click({ force: true })
  await page.getByTestId('storage-import-apply-btn').click({ force: true })

  // 2.4.2 读取 `x4_logic_flow_plans` 并检查版本与节点 moduleId
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

  // 2.4.3 导入后版本升级为 2 且节点 moduleId 为 module id #期望: [2, true]
  expect(migrated.version).toBe(2)
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

test.describe('module-id e2e mapping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await loadDbFixture(page)
    await page.reload()
    await setLanguageByUi(page)
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

  test('2.4 切换: flow-v1-macro -> flow-v2-module', async ({ page }) => {
    await stateFlowV1Macro(page)
    await transitionFlowV1ToV2Module(page)
  })

  test('3.1 Case: 导入 Empire 旧版本后自动迁移到最新', async ({ page }) => {
    // 3.1.1 状态: empire-v2-macro
    await stateEmpireV2Macro(page)
    // 3.1.2 切换: empire-v2-macro -> empire-v3-module
    await transitionEmpireV2ToV3Module(page)
    // 3.1.3 执行导入后校验站点模块列表中不存在 `_macro` 后缀 ID #期望: [0]
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

  test('3.2 Case: 导入 Flow 旧版本后自动迁移到最新', async ({ page }) => {
    // 3.2.1 状态: flow-v1-macro
    await stateFlowV1Macro(page)
    // 3.2.2 切换: flow-v1-macro -> flow-v2-module
    await transitionFlowV1ToV2Module(page)
    // 3.2.3 执行导入后校验节点 moduleId 不含 `_macro` 后缀 #期望: [0]
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

  test('3.3 Case: 导出总是输出最新版本', async ({ page }) => {
    // 3.3.1 切换: empire-v2-macro -> empire-v3-module
    await stateEmpireV2Macro(page)
    await transitionEmpireV2ToV3Module(page)
    // 3.3.2 先导入旧版本数据再执行导出
    const exported = await downloadStorageExportPayload(page)
    // 3.3.3 校验导出 JSON 中 Empire 与 Flow 版本为最新 #期望: [3, 2]
    expect(exported.data?.x4_empire_data?.version).toBe(3)
    expect(exported.data?.x4_logic_flow_plans?.version).toBe(2)
  })

  test('3.4 Case: XML 与 x4-game 输入统一归一 module id', async ({ page }) => {
    // 3.4.1 状态: empire-v2-macro
    await stateEmpireV2Macro(page)

    // 3.4.2 分别导入 XML macro 输入与 x4-game module 输入
    await importXmlAndX4GameModuleInputs(page)

    // 3.4.3 校验写入站点模块 ID 均为 module id #期望: [true]
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
})
