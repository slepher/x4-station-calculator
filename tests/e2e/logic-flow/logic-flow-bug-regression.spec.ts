import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { dragWareToTarget } from './helpers/dragLogicFlow'

test.describe('Logic Flow Bug Regression Tests (E2E)', () => {
  test.beforeEach(async ({ page }) => setupLogicFlow(page, 'clean'))

  test('isolating a node removes its candidate preview', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const node = page.locator('.flow-node[data-ware-id="hullparts"]').first()
    await node.hover()
    await node.locator('button[title*="隔离"], button[title*="Isolate"]').click()
    await dragWareToTarget(page, 'hullparts', 0, { drop: false, expectedStatus: 'isolate' })
    await expect(page.locator('.preview-node')).toHaveCount(0)
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(1)
    await page.mouse.up()
  })

  test('duplicate drops are rejected without adding a second node', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await dragWareToTarget(page, 'hullparts', 0, { drop: false })
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(1)
    await page.mouse.up()
  })

  test('new-zone drop creates exactly one production group', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toBeVisible()
  })

  test('leaving a hovered target before release cancels the drop', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const before = await page.locator('.flow-node').count()
    await dragWareToTarget(page, 'weaponcomponents', 0, { drop: false })
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await expect(page.locator('.compact-group').first()).toHaveClass(/border-amber-500\/50/)
    await page.mouse.up()
    await expect(page.locator('.flow-node')).toHaveCount(before)
  })

  test('locked incompatible drops show rejected feedback and no preview', async ({ page }) => {
    await dragWareToTarget(page, 'energycells')
    await dragWareToTarget(page, 'spaceweed', 0, { drop: false, expectedStatus: 'rejected' })
    await expect(page.locator('.compact-group [data-testid="rejected-label"]')).toBeVisible()
    await expect(page.locator('.compact-group .animate-pulse')).toHaveCount(0)
    await page.mouse.up()
  })

  test('isolated target changes its label to Connect while hovered', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const node = page.locator('.flow-node[data-ware-id="hullparts"]').first()
    await node.hover()
    await node.locator('button[title*="隔离"], button[title*="Isolate"]').click()
    await dragWareToTarget(page, 'hullparts', 0, { drop: false, expectedStatus: 'isolate' })
    await expect(page.locator('[data-testid="isolated-label"]')).toContainText(/连接|Connect/i)
    await page.mouse.up()
  })

  test('the same ware can coexist across two selected lineages', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().uncheck({ force: true })
    await dragWareToTarget(page, 'hullparts')
    await page.getByRole('button', { name: /Teladi|泰拉迪/i }).first().click()
    await dragWareToTarget(page, 'hullparts', 0, { expectedStatus: 'normal' })
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(2)
  })

  test('hovering a duplicate shows duplicate feedback before release', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await dragWareToTarget(page, 'hullparts', 0, { drop: false, expectedStatus: 'duplicated' })
    await expect(page.getByTestId('duplicate-label')).toBeVisible()
    await page.mouse.up()
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(1)
  })

  test('new-zone hover handshake precedes a single new group', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents', 'new', { drop: false })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.isHoveringNewZone)).toBe(true)
    await expect(page.locator('.compact-group').last()).toHaveClass(/border-blue-500\/50/)
    await page.mouse.up()
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expect(page.locator('.flow-node[data-ware-id="weaponcomponents"]')).toHaveCount(1)
  })

  test('leaving a locked target clears identity but preserves its base lock style', async ({ page }) => {
    await dragWareToTarget(page, 'energycells')
    const target = page.locator('.compact-group').first()
    await dragWareToTarget(page, 'spaceweed', 0, { drop: false, expectedStatus: 'rejected' })
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await expect(target).toHaveClass(/border-amber-500\/50/)
    await page.mouse.up()
    await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toHaveCount(0)
  })

  test('candidate lock toggle is reflected in a UI-created group', async ({ page }) => {
    const lock = page.locator('input[type="checkbox"]').first()
    await lock.check({ force: true })
    await page.locator('.groups-list .drop-target').last().click()
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0]?.isLocked)).toBe(true)
    await lock.uncheck({ force: true })
    await page.locator('.groups-list .drop-target').last().click()
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[1]?.isLocked)).toBe(false)
  })
})
