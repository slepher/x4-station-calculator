import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { attemptWareDrag, dragWareToTarget, expectDragIdle, getGroupIdForWare, startWareDrag } from './helpers/dragLogicFlow'

const node = (page: Page, ware: string) => page.locator(`.flow-node[data-ware-id="${ware}"]`)
const groups = (page: Page) => page.evaluate(() => (window as any).logicFlowStore.groups)
async function expectManual(page: Page, groupId: string, wareId: string, moduleId: string, lineage = 'default') {
  await expect.poll(() => page.evaluate(({ groupId, wareId }) => (window as any).logicFlowStore.groups
    .find((group: any) => group.id === groupId).nodes.filter((node: any) => node.wareId === wareId)
    .map((node: any) => ({ moduleId: node.moduleId, lineage: node.lineage, source: node.source })), { groupId, wareId }))
    .toEqual([{ moduleId, lineage, source: 'manual' }])
}
async function newEmptyGroup(page: Page) {
  const before = (await groups(page)).map((group: any) => group.id)
  await page.locator('.groups-list .drop-target').click()
  await expect.poll(async () => (await groups(page)).length).toBe(before.length + 1)
  const created = (await groups(page)).filter((group: any) => !before.includes(group.id))
  expect(created).toHaveLength(1)
  expect(created[0].nodes).toEqual([])
  return created[0].id as string
}

test.describe('Logical Flow Integration Verification', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error(`Page Error: ${err.message}`)
    })
    await setupLogicFlow(page, 'clean')
  })

  test('2.1 Bug Fix: No Module Node for Weapon Components', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents')
    await expect(page.locator('.flow-node').filter({ hasText: 'No Module' })).toHaveCount(0)
    await expect(node(page, 'weaponcomponents')).toContainText(/武器部件产线|Weapon Component Production/)
    await expectManual(page, await getGroupIdForWare(page, 'weaponcomponents'), 'weaponcomponents', 'module_gen_prod_weaponcomponents_01')
  })
  test('2.2 Bug Fix: Teladi Race Context Followed', async ({ page }) => {
    await page.locator('.race-btn').filter({ hasText: /Teladi/i }).click()
    // Hull Parts has a Teladi producer; missile components uses the common producer.
    await dragWareToTarget(page, 'hullparts')
    await expect(node(page, 'teladianium')).toBeVisible()
    await expect(node(page, 'refinedmetals')).toHaveCount(0)
    await expectManual(page, await getGroupIdForWare(page, 'hullparts'), 'hullparts', 'module_tel_prod_hullparts_01', 'teladi')
  })
  test('2.3 Bug Fix: New Production Line Button Response', async ({ page }) => {
    const id = await newEmptyGroup(page)
    await expect(page.locator('.production-group h3')).toBeVisible()
    expect((await groups(page)).map((group: any) => group.id)).toEqual([id])
  })
  test('2.4 Bug Fix: vuedraggable Crash (TypeError Check)', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expectManual(page, await getGroupIdForWare(page, 'hullparts'), 'hullparts', 'module_gen_prod_hullparts_01')
  })
  test('2.5 Bug Fix: T0 Resource Not Draggable', async ({ page }) => {
    const ore = page.locator('.ware-card-wrapper[data-ware-id="ore"]')
    await expect(ore).toHaveClass(/is-locked-tier/)
    await expect(ore).toHaveAttribute('data-tier', '0')
    await attemptWareDrag(page, 'ore')
    await attemptWareDrag(page, 'energycells')
    expect(await groups(page)).toEqual([])
  })
  test('2.6 Comparison: T1+ Resources Must Be Draggable', async ({ page }) => {
    const hull = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]')
    await expect(hull).toHaveAttribute('data-tier', '2')
    await expect(hull).toHaveAttribute('draggable', 'true')
    await dragWareToTarget(page, 'hullparts')
    await expectManual(page, await getGroupIdForWare(page, 'hullparts'), 'hullparts', 'module_gen_prod_hullparts_01')
    await expect(page.locator('.production-group')).toHaveCount(1)
  })
  test('3.1 Logic: Compact View Appears on Drag', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts', 'new', { drop: false })
    await expect(page.getByTestId('compact-view')).toHaveClass(/grid-cols-4/)
    await page.mouse.up()
    await expectDragIdle(page)
    await expect(page.locator('.production-group')).toHaveCount(1)
  })
  test('3.2 Logic: Smart Insertion Order (UI Check)', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents')
    const groupId = await getGroupIdForWare(page, 'weaponcomponents')
    await dragWareToTarget(page, 'siliconwafers', { groupId }, { expectedStatus: 'locked' })
    await dragWareToTarget(page, 'microchips', { groupId }, { expectedStatus: 'locked' })
    await expectManual(page, groupId, 'microchips', 'module_gen_prod_microchips_01')
    const before = await groups(page)
    const { targetLocator } = await dragWareToTarget(page, 'weaponcomponents', { groupId }, { drop: false, expectedStatus: 'duplicated' })
    await expect.poll(() => targetLocator.locator('.compact-node[data-ware-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-ware-id'))))
      .toEqual(['weaponcomponents', 'microchips', 'siliconwafers'])
    await page.mouse.up()
    await expectDragIdle(page)
    expect(await groups(page)).toEqual(before)
  })
  test('3.3 Logic: Duplicate blocking and UI feedback', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const groupId = await getGroupIdForWare(page, 'hullparts')
    const before = await groups(page)
    await dragWareToTarget(page, 'hullparts', { groupId }, { expectedStatus: 'duplicated' })
    expect(await groups(page)).toEqual(before)
  })
  test('3.4 Visual: Drag Preview in Compact View', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const groupId = await getGroupIdForWare(page, 'hullparts')
    const { targetLocator } = await dragWareToTarget(page, 'weaponcomponents', { groupId }, { drop: false, expectedStatus: 'locked' })
    await expect(targetLocator.locator('.compact-node.animate-pulse')).toContainText(/Weapon Component Production|武器部件产线/)
    await expect(targetLocator.locator('.compact-node[data-ware-id="hullparts"]')).toContainText(/Hull Part Production|船体部件产线/)
    await page.mouse.up()
    await expectDragIdle(page)
    await expectManual(page, groupId, 'weaponcomponents', 'module_gen_prod_weaponcomponents_01')
  })
  test('4.1 Logic: Create Multiple Lines', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const first = await getGroupIdForWare(page, 'hullparts')
    await dragWareToTarget(page, 'weaponcomponents')
    const second = await getGroupIdForWare(page, 'weaponcomponents')
    expect(first).not.toBe(second)
    expect((await groups(page)).map((group: any) => group.id)).toEqual([first, second])
  })
  test('4.2 Logic: Drag to Existing Line', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const groupId = await getGroupIdForWare(page, 'hullparts')
    await dragWareToTarget(page, 'weaponcomponents', { groupId }, { expectedStatus: 'locked' })
    await expectManual(page, groupId, 'weaponcomponents', 'module_gen_prod_weaponcomponents_01')
    expect((await groups(page)).map((group: any) => group.id)).toEqual([groupId])
  })
  test('4.3 Visual: Connection Lines Between Nodes', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    // ore→refinedmetals→hullparts and methane→graphene→hullparts; energy edges excluded.
    await expect(page.locator('.connection-line')).toHaveCount(4)
    for (const path of await page.locator('.connection-line').all()) {
      await expect(path).toHaveAttribute('d', /^M .+ C .+/)
    }
  })
  test('5.1b Release outside target leaves groups and nodes unchanged', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const before = await groups(page)
    await startWareDrag(page, 'weaponcomponents')
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await page.mouse.up()
    await expectDragIdle(page)
    expect(await groups(page)).toEqual(before)
  })
  test('5.3 Empty group routes first nodes to the selected target', async ({ page }) => {
    const first = await newEmptyGroup(page)
    const second = await newEmptyGroup(page)
    await dragWareToTarget(page, 'hullparts', { groupId: second }, { expectedStatus: 'locked' })
    await dragWareToTarget(page, 'weaponcomponents', { groupId: first }, { expectedStatus: 'locked' })
    await expectManual(page, second, 'hullparts', 'module_gen_prod_hullparts_01')
    await expectManual(page, first, 'weaponcomponents', 'module_gen_prod_weaponcomponents_01')
    expect((await groups(page)).map((group: any) => group.id)).toEqual([first, second])
  })
  test('5.2 Drop on New Zone Creates Group', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expectManual(page, await getGroupIdForWare(page, 'hullparts'), 'hullparts', 'module_gen_prod_hullparts_01')
  })
})
