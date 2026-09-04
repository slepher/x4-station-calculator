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

  test('isolated middle node keeps isolation and stops upstream preview', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents')
    const isolated = page.locator('.flow-node[data-ware-id="hullparts"]').first()
    await isolated.hover()
    await isolated.locator('button[title*="隔离"], button[title*="Isolate"]').click()
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes.find((n: any) => n.wareId === 'hullparts')?.isIsolated)).toBe(true)

    const beforeRefinedMetals = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .filter((node: any) => node.wareId === 'refinedmetals').length)
    await dragWareToTarget(page, 'refinedmetals', 0, { drop: false, expectedStatus: 'locked' })
    await expect(page.locator('.compact-group').first().locator('[data-ware-id="ore"]')).toBeVisible()
    await expect(page.locator('.compact-group').first().locator('[data-ware-id="graphene"]')).toHaveCount(0)
    await page.mouse.up()
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes.find((n: any) => n.wareId === 'hullparts')?.isIsolated)).toBe(true)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .filter((node: any) => node.wareId === 'refinedmetals').length)).toBe(beforeRefinedMetals + 1)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .find((node: any) => node.wareId === 'refinedmetals' && node.source === 'manual'))).toMatchObject({
      wareId: 'refinedmetals',
      source: 'manual',
      lineage: 'default',
      moduleId: 'module_gen_prod_refinedmetals_01',
    })
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
    await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
    await page.locator('.race-btn').filter({ hasText: /泰拉迪|Teladi/i }).click()
    await dragWareToTarget(page, 'spaceweed', 0, { expectedStatus: 'rejected' })
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
    expect(nodes).toEqual(expect.arrayContaining([
      { lineage: 'default', moduleId: 'module_gen_prod_hullparts_01' },
      { lineage: 'teladi', moduleId: 'module_tel_prod_hullparts_01' },
    ]))
    const hullNodes = page.locator('.flow-node[data-ware-id="hullparts"]')
    await expect(hullNodes.nth(0)).toContainText(/船体部件产线|Hull Part Production/)
    await expect(hullNodes.nth(1)).toContainText(/Teladi 船体部件产线|Teladi Hull Part Production/)
    await dragWareToTarget(page, 'weaponcomponents', 0)
    await expect(page.locator('.compact-group').first().locator('.compact-node').filter({ hasText: /船体部件产线|Hull Part Production/ })).toHaveCount(2)
    await expect(page.locator('.compact-group').first()).toContainText(/Weapon Component Production|武器部件产线/)
    await expect(page.locator('.compact-group').first().locator('.compact-node[data-ware-id="hullparts"]')).toHaveCount(2)
    const connections = await page.evaluate(() => {
      const group = (window as any).logicFlowStore.groups[0]
      const svg = document.querySelector<SVGSVGElement>('.production-group svg.absolute')
      const svgRect = svg?.getBoundingClientRect()
      const hull = group.nodes.filter((n: any) => n.wareId === 'hullparts').map((n: any) => {
        const rect = document.getElementById(`node-${n.id}`)?.getBoundingClientRect()
        return rect && svgRect ? { right: rect.right - svgRect.left, centerY: rect.top + rect.height / 2 - svgRect.top } : null
      })
      const weapon = group.nodes.find((n: any) => n.wareId === 'weaponcomponents')
      const targetRect = weapon && document.getElementById(`node-${weapon.id}`)?.getBoundingClientRect()
      const target = targetRect && svgRect
        ? { left: targetRect.left - svgRect.left, centerY: targetRect.top + targetRect.height / 2 - svgRect.top }
        : null
      const paths = Array.from(svg?.querySelectorAll<SVGPathElement>('.connection-line') ?? [])
      return hull.map((source) => paths.some(path => {
        const numbers = path.getAttribute('d')?.match(/[-\d.]+/g)?.map(Number) ?? []
        return source && target && numbers.length >= 4
          && Math.abs(numbers[0] - source.right) < 2
          && Math.abs(numbers[1] - source.centerY) < 2
          && Math.abs(numbers[numbers.length - 2] - target.left) < 2
          && Math.abs(numbers[numbers.length - 1] - target.centerY) < 2
      }))
    })
    expect(connections).toEqual([true, true])
  })

  test('default hullparts auto node promotes through a real drop', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().uncheck({ force: true })
    await dragWareToTarget(page, 'weaponcomponents')
    await dragWareToTarget(page, 'hullparts', 0, { expectedStatus: 'auto' })
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toContainText(/船体部件产线|Hull Part Production/)
    const node = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .find((item: any) => item.wareId === 'hullparts'))
    expect(node).toMatchObject({ source: 'manual', lineage: 'default', moduleId: 'module_gen_prod_hullparts_01' })
  })

  test('Teladi hullparts replaces a default auto node', async ({ page }) => {
    await page.locator('input[type="checkbox"]').first().uncheck({ force: true })
    await dragWareToTarget(page, 'weaponcomponents')
    await page.getByRole('button', { name: /Teladi|泰拉迪/i }).first().click()
    await dragWareToTarget(page, 'hullparts', 0, { expectedStatus: 'replace' })
    const node = await page.evaluate(() => (window as any).logicFlowStore.groups[0].nodes
      .find((item: any) => item.wareId === 'hullparts'))
    expect(node).toMatchObject({ source: 'manual', lineage: 'teladi', moduleId: 'module_tel_prod_hullparts_01' })
    expect(await page.locator('.flow-node[data-ware-id="hullparts"]').count()).toBe(1)
    await expect(page.locator('.flow-node[data-ware-id="hullparts"]')).toContainText(/Teladi 船体部件产线|Teladi Hull Part Production/)
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
    await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
    await page.locator('.race-btn').filter({ hasText: /泰拉迪|Teladi/i }).click()
    await dragWareToTarget(page, 'spaceweed', 0, { drop: false, expectedStatus: 'rejected' })
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await expect(target.getByTestId('rejected-label')).toHaveCount(0)
    await expect(target).toHaveClass(/border-amber-500\/50/)
    await page.mouse.up()
    await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toHaveCount(0)
  })

  test('candidate lock toggle is reflected in a UI-created group', async ({ page }) => {
    const lock = page.locator('input[type="checkbox"]').first()
    await lock.check({ force: true })
    await dragWareToTarget(page, 'hullparts')
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0]?.isLocked)).toBe(true)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[0]?.nodes.find((n: any) => n.wareId === 'hullparts'))).toMatchObject({ lineage: 'default', source: 'manual' })
    await lock.uncheck({ force: true })
    await dragWareToTarget(page, 'weaponcomponents')
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[1]?.isLocked)).toBe(false)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups[1]?.nodes.find((n: any) => n.wareId === 'weaponcomponents'))).toMatchObject({ lineage: 'default', source: 'manual' })
  })

  test('language switch updates candidate and planning UI', async ({ page }) => {
    const candidate = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]').first()
    await expect(candidate).toContainText(/船体部件|Hull Parts/i)
    await dragWareToTarget(page, 'hullparts')
    const node = page.locator('.flow-node[data-ware-id="hullparts"]').first()
    await expect(node).toContainText(/船体部件产线/)
    await page.getByTestId('language-select').selectOption('en')
    await expect(candidate).toContainText('Hull Parts')
    await expect(node).toContainText('Hull Part Production')
  })
})
