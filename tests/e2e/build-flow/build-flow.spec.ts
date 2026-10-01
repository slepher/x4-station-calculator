import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { setupLogicFlow } from '../logic-flow/helpers/setupLogicFlow'

const SOURCE_ID = 'build-flow-source:lf-1-g1:hullparts'
const TARGET_ID = 'build-flow-target:line:lf-1-g1:hullparts'
const ASSIGNMENT = {
  wareId: 'hullparts',
  sourceGroupId: 'lf-1-g1',
  targetType: 'line-build-material',
  targetGroupId: 'lf-1-g1',
}

const source = (page: Page) => page.locator(`[data-tag-id="${SOURCE_ID}"]`)
const target = (page: Page) => page.locator(`[data-tag-id="${TARGET_ID}"]`)
const menu = (page: Page) => page.locator('.build-flow-menu')
const solidEdges = (page: Page) => page.locator('.build-flow-edge-layer path:not([stroke-dasharray])')

async function state(page: Page) {
  return page.evaluate(() => {
    const store = (window as any).logicFlowStore
    return {
      cards: store.buildFlowLineCards.map((card: any) => card.groupId),
      groups: store.buildFlowGroups.map((group: any) => ({
        groupKey: group.groupKey,
        cards: group.lineCards.map((card: any) => card.groupId),
      })),
      assignments: store.buildFlowAssignments,
      archived: store.archivedBuildFlowGroupIds,
    }
  })
}

async function bindFromSourceMenu(page: Page) {
  await source(page).locator('.source-tag-segment-add').click()
  await expect(menu(page)).toBeVisible()
  const destination = menu(page).getByRole('button', { name: 'E1-S1', exact: true })
  await expect(destination).toHaveCount(1)
  await destination.click()
  await expect(menu(page)).toBeHidden()
  await expect.poll(() => state(page).then(value => value.assignments)).toEqual([ASSIGNMENT])
  await expect(target(page).locator('.target-tag-unbind')).toBeVisible()
  await expect(solidEdges(page)).toHaveCount(1)
}

async function saveAndReload(page: Page) {
  await page.getByTestId('toolbar-save-btn').click()
  await expect(page.getByTestId('dialog-backdrop')).toHaveCount(0)
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
  await expect.poll(() => page.evaluate(() => ({
    version: (window as any).gameDataStore?.currentVersion,
    activeId: (window as any).logicFlowStore?.savedPlans.activeId,
  })), { timeout: 15000 }).toEqual({ version: '9.0', activeId: 'logic-flow-1' })
  await page.getByTestId('language-select').selectOption('zh-CN')
  await page.getByTestId('top-view-btn-flow').click()
  await expect(page.locator('.build-flow-zone')).toBeVisible()
}

test.describe('build-flow current behavior', () => {
  test('clean plan has no derived build-flow zone', async ({ page }) => {
    await setupLogicFlow(page, 'clean')
    await expect(page.locator('.build-flow-zone')).toHaveCount(0)
    expect(await state(page)).toEqual({ cards: [], groups: [], assignments: [], archived: [] })
  })

  test.describe('seeded logic-flow-1', () => {
    test.beforeEach(async ({ page }) => {
      await setupLogicFlow(page, 'seeded')
    })

    test('derives the exact current source and target card', async ({ page }) => {
      await expect(page.locator('.build-flow-group')).toHaveCount(1)
      await expect(page.locator('.build-flow-line-card')).toHaveCount(1)
      await expect(source(page)).toBeVisible()
      await expect(target(page)).toBeVisible()
      expect(await state(page)).toEqual({
        cards: ['lf-1-g1'],
        groups: [{ groupKey: 'lf-1-g1', cards: ['lf-1-g1'] }],
        assignments: [],
        archived: [],
      })
    })

    test('menu binding and unbinding update the exact target and edge', async ({ page }) => {
      await bindFromSourceMenu(page)
      await target(page).locator('.target-tag-unbind').click()
      await expect.poll(() => state(page).then(value => value.assignments)).toEqual([])
      await expect(target(page).locator('.target-tag-unbind')).toHaveCount(0)
      await expect(solidEdges(page)).toHaveCount(0)
    })

    test('real drag binds the exact source and target', async ({ page }) => {
      await source(page).dragTo(target(page))
      await expect.poll(() => state(page).then(value => value.assignments)).toEqual([ASSIGNMENT])
      await expect(target(page).locator('.target-tag-unbind')).toBeVisible()
      await expect(solidEdges(page)).toHaveCount(1)
    })

    test('binding persists for the same saved plan after reload', async ({ page }) => {
      await bindFromSourceMenu(page)
      await saveAndReload(page)
      expect((await state(page)).assignments).toEqual([ASSIGNMENT])
      const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans_v9') || 'null'))
      expect(persisted.activeId).toBe('logic-flow-1')
      expect(persisted.list.find((plan: any) => plan.id === 'logic-flow-1').buildFlow).toEqual({
        assignments: [ASSIGNMENT],
        archivedGroupIds: [],
      })
      await expect(target(page).locator('.target-tag-unbind')).toBeVisible()
      await expect(solidEdges(page)).toHaveCount(1)
    })

    test('archive persists the exact current card identity', async ({ page }) => {
      const card = page.locator('.build-flow-line-card').filter({ has: target(page) })
      await card.locator('.archive-btn').click()
      await expect(target(page)).toHaveCount(0)
      expect(await state(page)).toEqual({
        cards: [],
        groups: [],
        assignments: [],
        archived: ['lf-1-g1'],
      })
      await expect(page.locator('.build-flow-zone')).toHaveCount(0)
      await page.getByTestId('toolbar-save-btn').click()
      await expect(page.getByTestId('dialog-backdrop')).toHaveCount(0)
      await page.reload()
      await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
      await expect.poll(() => state(page).then(value => value.archived), { timeout: 15000 }).toEqual(['lf-1-g1'])
      const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('x4_logic_flow_plans_v9') || 'null'))
      expect(persisted.list.find((plan: any) => plan.id === 'logic-flow-1').buildFlow).toEqual({
        assignments: [],
        archivedGroupIds: ['lf-1-g1'],
      })
      await page.getByTestId('language-select').selectOption('zh-CN')
      await page.getByTestId('top-view-btn-flow').click()
      await expect(page.locator('.build-flow-zone')).toHaveCount(0)
    })
  })
})
