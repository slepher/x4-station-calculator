import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { attemptWareDrag, dragWareToTarget, expectDragIdle, getGroupIdForWare } from './helpers/dragLogicFlow'

async function expectManual(page: Page, groupId: string, wareId: string, moduleId: string) {
  await expect.poll(() => page.evaluate(({ groupId, wareId }) => {
    const group = (window as any).logicFlowStore.groups.find((group: any) => group.id === groupId)
    return group.nodes.filter((node: any) => node.wareId === wareId)
      .map((node: any) => ({ moduleId: node.moduleId, source: node.source, lineage: node.lineage }))
  }, { groupId, wareId })).toEqual([{ moduleId, source: 'manual', lineage: 'default' }])
}

test.describe('Logic Flow Advanced Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean')
  })

  test('4.1 Visual: New Line Ghosting (Phantom Preview)', async ({ page }) => {
    const { targetLocator: newZone } = await dragWareToTarget(page, 'hullparts', 'new', { drop: false })
    await expect(newZone.locator('span.italic')).toContainText(/Hull Part Production|船体部件产线/)
    const resources = newZone.locator('.flex.items-center [data-ware-id]')
    await expect.poll(() => resources.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')).sort())).toEqual(['methane', 'ore'])
    const phantom = newZone.locator('.compact-node.animate-pulse')
    await expect(phantom).toBeVisible()
    await expect(phantom).toContainText(/Hull Part Production|船体部件产线/)
    await page.mouse.up()
    await expectDragIdle(page)
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expectManual(page, await getGroupIdForWare(page, 'hullparts'), 'hullparts', 'module_gen_prod_hullparts_01')
  })

  test('4.2 Visual: Real-time T0 Resource Header Updates', async ({ page }) => {
    await dragWareToTarget(page, 'siliconwafers')
    const groupId = await getGroupIdForWare(page, 'siliconwafers')
    const { targetLocator: group } = await dragWareToTarget(page, 'microchips', { groupId }, { drop: false, expectedStatus: 'locked' })
    await expect(group.locator('.flex.items-center [data-ware-id]')).toHaveAttribute('data-ware-id', 'silicon')
    await page.mouse.up()
    await expectDragIdle(page)
    await expectManual(page, groupId, 'microchips', 'module_gen_prod_microchips_01')
    await dragWareToTarget(page, 'hullparts', { groupId }, { drop: false, expectedStatus: 'locked' })
    const pulse = group.locator('.flex.items-center [data-ware-id].animate-pulse')
    await expect.poll(() => pulse.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')).sort())).toEqual(['methane', 'ore'])
    await page.mouse.up()
    await expectDragIdle(page)
    await expectManual(page, groupId, 'hullparts', 'module_gen_prod_hullparts_01')
  })

  test('4.5 End-to-End: Final State Verification', async ({ page }) => {
    await dragWareToTarget(page, 'scanningarrays')
    const groupId = await getGroupIdForWare(page, 'scanningarrays')
    await dragWareToTarget(page, 'microchips', { groupId }, { expectedStatus: 'locked' })
    await expectManual(page, groupId, 'microchips', 'module_gen_prod_microchips_01')
    await expect(page.locator('.flow-node[data-ware-id="microchips"]')).toBeVisible()
    await expect(page.locator('.production-group')).toHaveCount(1)
    await dragWareToTarget(page, 'scanningarrays')
    await expect(page.locator('.production-group')).toHaveCount(2)
    const ids = await page.evaluate(() => (window as any).logicFlowStore.groups.map((group: any) => group.id))
    expect(ids).toContain(groupId)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) await expectManual(page, id, 'scanningarrays', 'module_gen_prod_scanningarrays_01')
  })

  test('4.6 T0 Ware Behavior: Ore and Energy Cells cannot drag or quick-add; normal ware can', async ({ page }) => {
    await expect(page.locator('.ware-card-wrapper[data-ware-id="ore"] .resource-preview-container')).toBeHidden()
    await attemptWareDrag(page, 'ore')
    await attemptWareDrag(page, 'energycells')
    const normal = page.locator('.ware-card-wrapper[data-ware-id="siliconwafers"]')
    await normal.scrollIntoViewIfNeeded()
    await expect(normal).toHaveAttribute('draggable', 'true')
    await expect(normal.locator('.resource-preview-container')).toBeVisible()
    await normal.hover()
    await expect(normal.locator('.ware-card-add-btn')).toBeVisible()
    await dragWareToTarget(page, 'siliconwafers')
    await expectManual(page, await getGroupIdForWare(page, 'siliconwafers'), 'siliconwafers', 'module_gen_prod_siliconwafers_01')
    await expect(page.locator('.production-group')).toHaveCount(1)
    await attemptWareDrag(page, 'ore')
    await attemptWareDrag(page, 'energycells')
  })

  for (const scenario of [
    { name: 'Refined Metals first', first: 'refinedmetals', second: 'siliconwafers', resources: ['ore', 'silicon'] },
    { name: 'Silicon Wafers first', first: 'siliconwafers', second: 'refinedmetals', resources: ['silicon', 'ore'] },
  ]) {
    test(`4.7 Visual: Dependency-Follow Sorting - ${scenario.name}`, async ({ page }) => {
      await dragWareToTarget(page, scenario.first)
      const groupId = await getGroupIdForWare(page, scenario.first)
      await dragWareToTarget(page, scenario.second, { groupId }, { expectedStatus: 'locked' })
      const before = await page.evaluate(() => (window as any).logicFlowStore.groups)
      const { targetLocator: group } = await dragWareToTarget(page, scenario.first, { groupId }, { drop: false, expectedStatus: 'duplicated' })
      const resources = group.locator('.flex.items-center [data-ware-id]')
      await expect.poll(() => resources.evaluateAll(els => els.map(el => el.getAttribute('data-ware-id')))).toEqual(scenario.resources)
      await page.mouse.up()
      await expectDragIdle(page)
      await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual(before)
    })
  }
})
