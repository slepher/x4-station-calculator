import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { dragWareToTarget } from './helpers/dragLogicFlow'

test.describe('Logic Flow Bug Regression Tests (E2E)', () => {
  test.beforeEach(async ({ page }) => setupLogicFlow(page, 'clean'))

  test('isolating a node removes its candidate preview', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const node = page.locator('.flow-node:visible').filter({ has: page.locator('button') }).first()
    const wareId = await node.getAttribute('data-ware-id')
    if (!wareId) throw new Error('Isolatable node not found')
    await node.hover()
    await node.locator('button[title*="隔离"], button[title*="Isolate"]').click()
    await dragWareToTarget(page, wareId, 0, { expectedStatus: 'isolated' })
    await expect(page.locator(`.flow-node[data-ware-id="${wareId}"]`)).toHaveCount(1)
  })

  test('duplicate drops are rejected without adding a second node', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await dragWareToTarget(page, 'hullparts', 0)
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(1)
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
    await page.mouse.move(50, 50, { steps: 10 })
    await page.mouse.up()
    await expect(page.locator('.flow-node')).toHaveCount(before)
  })

  test('locked incompatible drops show rejected feedback and no preview', async ({ page }) => {
    await dragWareToTarget(page, 'energycells')
    await page.locator('.tab-btn').nth(1).click()
    await dragWareToTarget(page, 'spaceweed', 0, { expectedStatus: 'rejected' })
  })

  test('isolated target changes its label to Connect while hovered', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    const node = page.locator('.flow-node:visible').filter({ has: page.locator('button') }).first()
    const wareId = await node.getAttribute('data-ware-id')
    if (!wareId) throw new Error('Isolatable node not found')
    await node.hover()
    await node.locator('button[title*="隔离"], button[title*="Isolate"]').click()
    await page.locator('.tab-btn').first().click()
    await dragWareToTarget(page, wareId, 0, { drop: false, expectedStatus: 'isolated' })
    await expect(page.locator('[data-testid="isolated-label"]')).toContainText(/连接|Connect/i)
    await page.mouse.up()
    await expect(page.locator(`.flow-node[data-ware-id="${wareId}"]`)).not.toHaveClass(/isolated/)
  })

  test('the same ware can coexist across two selected lineages', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().uncheck({ force: true })
    await dragWareToTarget(page, 'hullparts')
    await page.getByRole('button', { name: /Teladi|泰拉迪/i }).first().click()
    await dragWareToTarget(page, 'hullparts', 0, { expectedStatus: 'normal' })
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toHaveCount(2)
    const nodes = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .filter((node: any) => node.wareId === 'hullparts')
      .map((node: any) => ({ lineage: node.lineage, moduleId: node.moduleId })))
    expect(new Set(nodes.map((node: any) => node.lineage)).size).toBe(2)
    expect(new Set(nodes.map((node: any) => node.moduleId)).size).toBe(2)
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]').first()).toHaveText(/船体部件|Hull Parts/)
    await expect(page.locator('.connection-line')).toHaveCount(2)
  })

  test('auto nodes promote and replace through visible lineage targets', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents')
    await dragWareToTarget(page, 'refinedmetals', 0, { expectedStatus: 'auto' })
    await expect(page.locator('.flow-node[data-ware-id="refinedmetals"]')).toContainText(/自动|Auto/)
    const before = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .find((node: any) => node.wareId === 'refinedmetals')?.moduleId)
    await page.getByRole('button', { name: /Teladi|泰拉迪/i }).first().click()
    await dragWareToTarget(page, 'refinedmetals', 0, { expectedStatus: 'replace' })
    const after = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .find((node: any) => node.wareId === 'refinedmetals')?.moduleId)
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
    await expect(page.locator('.flow-node[data-ware-id="refinedmetals"]')).toContainText(/Teladi|泰拉迪/i)
  })

  test('hovering a duplicate shows duplicate feedback before release', async ({ page }) => {
    await dragWareToTarget(page, 'hullparts')
    await dragWareToTarget(page, 'hullparts', 0, { expectedStatus: 'duplicated' })
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
    await page.locator('.tab-btn').nth(1).click()
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

  test('language switch updates candidate and planning UI', async ({ page }) => {
    await expect(page.locator('.candidate-zone')).toContainText(/工业|Industrial/i)
    await page.getByTestId('language-select').selectOption('en')
    await expect(page.locator('.candidate-zone')).toContainText(/Industrial|Agricultural/i)
    await dragWareToTarget(page, 'hullparts')
    await expect(page.locator('.production-group')).toContainText(/Hull Parts/i)
  })
})
