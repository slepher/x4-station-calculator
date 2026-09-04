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
    await dragWareToTarget(page, 'hullparts', 0, { drop: false })
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
    await expect(page.locator('.compact-group').first()).not.toHaveClass(/border-blue-500\/50|border-amber-500\/50/)
    await page.mouse.up()
    await expect(page.locator('.flow-node')).toHaveCount(before)
  })

  test('locked incompatible drops show rejected feedback and no preview', async ({ page }) => {
    await dragWareToTarget(page, 'energycells')
    await dragWareToTarget(page, 'spaceweed', 0, { drop: false, expectRejected: true })
    await expect(page.locator('.compact-group [data-testid="rejected-label"]')).toBeVisible()
    await expect(page.locator('.compact-group .animate-pulse')).toHaveCount(0)
    await page.mouse.up()
  })
})
