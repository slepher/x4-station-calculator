import { test } from '../test-setup'
import { expect } from '@playwright/test'
import { setupLogicFlow } from './logic-flow/helpers/setupLogicFlow'
import { dragWareToTarget, expectDragIdle, getGroupIdForWare, startWareDrag } from './logic-flow/helpers/dragLogicFlow'

test.beforeEach(async ({ page }) => { await setupLogicFlow(page, 'clean') })

test('Compact view toggles through real start, cancellation and completed drop', async ({ page }) => {
  await startWareDrag(page, 'hullparts')
  await page.mouse.move(5, 5, { steps: 20 })
  await page.mouse.up()
  await expectDragIdle(page)
  expect(await page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual([])
  await dragWareToTarget(page, 'hullparts', 'new', { expectedStatus: 'normal' })
  await getGroupIdForWare(page, 'hullparts')
  await expect(page.locator('.production-group .flow-node[data-ware-id="hullparts"]')).toBeVisible()
})

test('Drag an independent ware to an existing group in compact view', async ({ page }) => {
  await dragWareToTarget(page, 'hullparts', 'new', { expectedStatus: 'normal' })
  const groupId = await getGroupIdForWare(page, 'hullparts')
  await dragWareToTarget(page, 'claytronics', { groupId }, { expectedStatus: 'locked' })
  expect(await getGroupIdForWare(page, 'claytronics')).toBe(groupId)
  expect(await page.evaluate(() => (window as any).logicFlowStore.groups.length)).toBe(1)
  await expect(page.locator('.production-group .flow-node[data-ware-id="claytronics"]')).toBeVisible()
})
