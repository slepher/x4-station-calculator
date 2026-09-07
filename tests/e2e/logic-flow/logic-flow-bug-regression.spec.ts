import { test } from '../../test-setup'
import { expect, type Page } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { dragWareToTarget, expectDragIdle, getGroupIdForWare } from './helpers/dragLogicFlow'

const node = (page: Page, ware: string) => page.locator(`.flow-node[data-ware-id="${ware}"]`)
const groups = (page: Page) => page.evaluate(() => (window as any).logicFlowStore.groups)
const group = (page: Page, id: string) => page.evaluate(id => (window as any).logicFlowStore.groups.find((group: any) => group.id === id), id)
async function create(page: Page, ware = 'hullparts') {
  await dragWareToTarget(page, ware)
  return getGroupIdForWare(page, ware)
}
async function release(page: Page) {
  await page.mouse.up()
  await expectDragIdle(page)
}
async function isolate(page: Page, ware: string) {
  await node(page, ware).hover()
  await node(page, ware).locator('button[title*="隔离"], button[title*="Isolate"]').click()
  await expect(node(page, ware)).toContainText('EXT')
}
async function teladiAgriculture(page: Page) {
  await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
  await page.locator('.race-btn').filter({ hasText: /Teladi/i }).click()
}
async function expectHull(page: Page, id: string, lineage: 'default' | 'teladi') {
  const moduleId = lineage === 'default' ? 'module_gen_prod_hullparts_01' : 'module_tel_prod_hullparts_01'
  await expect.poll(async () => (await group(page, id)).nodes.filter((node: any) => node.wareId === 'hullparts')
    .map((node: any) => ({ source: node.source, lineage: node.lineage, moduleId: node.moduleId })))
    .toEqual([{ source: 'manual', lineage, moduleId }])
}

test.describe('Logic Flow Bug Regression Tests (E2E)', () => {
  test.beforeEach(async ({ page }) => setupLogicFlow(page, 'clean'))

  test('isolating a node removes its candidate preview', async ({ page }) => {
    const groupId = await create(page)
    const candidate = page.locator('.ware-card-wrapper[data-ware-id="refinedmetals"]')
    await expect(candidate.locator('.ware-status-dot')).toHaveClass(/ware-status-dot-planned/)
    await isolate(page, 'refinedmetals')
    await expect(candidate.locator('.ware-status-dot')).not.toHaveClass(/ware-status-dot-planned/)
    await expect(node(page, 'ore')).toHaveCount(0)
    await dragWareToTarget(page, 'refinedmetals', { groupId }, { expectedStatus: 'isolated' })
    await expect.poll(async () => (await group(page, groupId)).nodes.filter((node: any) => node.wareId === 'refinedmetals')
      .map((node: any) => ({ isolated: node.isIsolated, moduleId: node.moduleId, lineage: node.lineage })))
      .toEqual([{ isolated: false, moduleId: 'module_gen_prod_refinedmetals_01', lineage: 'default' }])
    await expect(node(page, 'ore')).toBeVisible()
    await expect(candidate.locator('.ware-status-dot')).toHaveClass(/ware-status-dot-planned/)
  })
  test('isolated middle node keeps isolation and stops upstream preview', async ({ page }) => {
    const groupId = await create(page, 'weaponcomponents')
    await isolate(page, 'hullparts')
    await expect(node(page, 'refinedmetals')).toHaveCount(0)
    const { targetLocator } = await dragWareToTarget(page, 'refinedmetals', { groupId }, { drop: false, expectedStatus: 'locked' })
    await expect(targetLocator.locator('.flex.items-center [data-ware-id="ore"].animate-pulse')).toBeVisible()
    await expect(targetLocator.locator('.compact-node[data-ware-id="graphene"]')).toHaveCount(0)
    await release(page)
    await expect(node(page, 'hullparts')).toContainText('EXT')
    await expect.poll(async () => (await group(page, groupId)).nodes.filter((node: any) => node.wareId === 'refinedmetals')
      .map((node: any) => ({ source: node.source, lineage: node.lineage, moduleId: node.moduleId })))
      .toEqual([{ source: 'manual', lineage: 'default', moduleId: 'module_gen_prod_refinedmetals_01' }])
  })
  test('duplicate drops are rejected without adding a second node', async ({ page }) => {
    const groupId = await create(page)
    const before = await groups(page)
    await dragWareToTarget(page, 'hullparts', { groupId }, { expectedStatus: 'duplicated' })
    expect(await groups(page)).toEqual(before)
    await expect(node(page, 'hullparts')).toHaveCount(1)
  })
  test('new-zone drop creates exactly one production group', async ({ page }) => {
    const id = await create(page)
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expectHull(page, id, 'default')
  })
  test('leaving a hovered target before release cancels the drop', async ({ page }) => {
    const groupId = await create(page)
    const before = await groups(page)
    const { targetLocator } = await dragWareToTarget(page, 'weaponcomponents', { groupId }, { drop: false, expectedStatus: 'locked' })
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await expect(targetLocator).toHaveClass(/border-amber-500\/50/)
    await release(page)
    expect(await groups(page)).toEqual(before)
  })
  test('locked incompatible drops show rejected feedback and no preview', async ({ page }) => {
    const groupId = await create(page)
    const before = await groups(page)
    await teladiAgriculture(page)
    await dragWareToTarget(page, 'spaceweed', { groupId }, { expectedStatus: 'rejected' })
    expect(await groups(page)).toEqual(before)
  })
  test('the same ware can coexist across two selected lineages', async ({ page }) => {
    await page.locator('.candidate-zone input[type="checkbox"]').uncheck({ force: true })
    const groupId = await create(page)
    await page.locator('.race-btn').filter({ hasText: /Teladi/i }).click()
    await dragWareToTarget(page, 'hullparts', { groupId }, { expectedStatus: 'normal' })
    await expect.poll(async () => (await group(page, groupId)).nodes.filter((node: any) => node.wareId === 'hullparts')
      .map((node: any) => ({ lineage: node.lineage, moduleId: node.moduleId, source: node.source })))
      .toEqual([
        { lineage: 'default', moduleId: 'module_gen_prod_hullparts_01', source: 'manual' },
        { lineage: 'teladi', moduleId: 'module_tel_prod_hullparts_01', source: 'manual' },
      ])
    const hullNodes = (await group(page, groupId)).nodes.filter((node: any) => node.wareId === 'hullparts')
    const common = hullNodes.find((node: any) => node.moduleId === 'module_gen_prod_hullparts_01')
    const teladi = hullNodes.find((node: any) => node.moduleId === 'module_tel_prod_hullparts_01')
    await expect(page.locator(`[id="node-${common.id}"]`)).toContainText(/船体部件产线|Hull Part Production/)
    await expect(page.locator(`[id="node-${teladi.id}"]`)).toContainText(/Teladi 船体部件产线|Teladi Hull Part Production/)
    const { targetLocator } = await dragWareToTarget(page, 'weaponcomponents', { groupId }, { drop: false, expectedStatus: 'normal' })
    await expect(targetLocator.locator('.compact-node[data-ware-id="hullparts"]')).toHaveCount(2)
    await expect.soft(targetLocator).toContainText(/Teladi 船体部件产线|Teladi Hull Part Production/)
    await expect(targetLocator.locator('.compact-node.animate-pulse')).toContainText(/Weapon Component Production|武器部件产线/)
    await release(page)
    await expect(node(page, 'hullparts')).toHaveCount(2)
    // Verify both independent producer endpoints actually connect to the consumer.
    await expect.poll(() => page.evaluate(id => {
      const group = (window as any).logicFlowStore.groups.find((group: any) => group.id === id)
      const svg = document.querySelector<SVGSVGElement>('.production-group svg.absolute')
      if (!svg) throw new Error('Connection SVG missing')
      const svgRect = svg.getBoundingClientRect()
      const weapon = group.nodes.find((node: any) => node.wareId === 'weaponcomponents')
      const target = document.getElementById(`node-${weapon.id}`)
      if (!target) throw new Error('Weapon node missing')
      const targetRect = target.getBoundingClientRect()
      const paths = Array.from(svg.querySelectorAll<SVGPathElement>('.connection-line'))
      return group.nodes.filter((node: any) => node.wareId === 'hullparts').map((node: any) => {
        const element = document.getElementById(`node-${node.id}`)
        if (!element) throw new Error('Hull node missing')
        const rect = element.getBoundingClientRect()
        return paths.some(path => {
          const d = path.getAttribute('d')
          if (!d) throw new Error('Connection path missing')
          const tokens = d.match(/[-\d.]+/g)
          if (!tokens) throw new Error('Invalid connection path')
          const values = tokens.map(Number)
          return Math.abs(values[0] - (rect.right - svgRect.left)) < 2
            && Math.abs(values[1] - (rect.top + rect.height / 2 - svgRect.top)) < 2
            && Math.abs(values[values.length - 2] - (targetRect.left - svgRect.left)) < 2
            && Math.abs(values[values.length - 1] - (targetRect.top + targetRect.height / 2 - svgRect.top)) < 2
        })
      })
    }, groupId)).toEqual([true, true])
  })
  test('default hullparts auto node promotes through a real drop', async ({ page }) => {
    await page.locator('.candidate-zone input[type="checkbox"]').uncheck({ force: true })
    const groupId = await create(page, 'weaponcomponents')
    expect((await group(page, groupId)).nodes.find((node: any) => node.wareId === 'hullparts').source).toBe('auto')
    await dragWareToTarget(page, 'hullparts', { groupId }, { expectedStatus: 'auto' })
    await expectHull(page, groupId, 'default')
    await expect(node(page, 'hullparts')).toContainText(/船体部件产线|Hull Part Production/)
  })
  test('Teladi hullparts replaces a default auto node', async ({ page }) => {
    await page.locator('.candidate-zone input[type="checkbox"]').uncheck({ force: true })
    const groupId = await create(page, 'weaponcomponents')
    expect((await group(page, groupId)).nodes.find((node: any) => node.wareId === 'hullparts')).toMatchObject({ source: 'auto', lineage: 'default', moduleId: 'module_gen_prod_hullparts_01' })
    await page.locator('.race-btn').filter({ hasText: /Teladi/i }).click()
    await dragWareToTarget(page, 'hullparts', { groupId }, { expectedStatus: 'replace' })
    await expectHull(page, groupId, 'teladi')
    await expect(node(page, 'hullparts')).toContainText(/Teladi 船体部件产线|Teladi Hull Part Production/)
  })
  test('hovering a duplicate shows duplicate feedback before release', async ({ page }) => {
    const groupId = await create(page)
    const before = await groups(page)
    await dragWareToTarget(page, 'hullparts', { groupId }, { drop: false, expectedStatus: 'duplicated' })
    expect(await groups(page)).toEqual(before)
    await release(page)
    expect(await groups(page)).toEqual(before)
  })
  test('new-zone hover handshake precedes a single new group', async ({ page }) => {
    await dragWareToTarget(page, 'weaponcomponents', 'new', { drop: false })
    expect(await groups(page)).toEqual([])
    await release(page)
    await expect(page.locator('.production-group')).toHaveCount(1)
    await expect(node(page, 'weaponcomponents')).toHaveCount(1)
  })
  test('leaving a locked target clears identity but preserves its base lock style', async ({ page }) => {
    const groupId = await create(page)
    const before = await groups(page)
    await teladiAgriculture(page)
    const { targetLocator } = await dragWareToTarget(page, 'spaceweed', { groupId }, { drop: false, expectedStatus: 'rejected' })
    await page.mouse.move(50, 50, { steps: 10 })
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBeNull()
    await expect(targetLocator.getByTestId('rejected-label')).toHaveCount(0)
    await expect(targetLocator).toHaveClass(/border-amber-500\/50/)
    await release(page)
    expect(await groups(page)).toEqual(before)
  })
  test('candidate lock toggle is reflected in a UI-created group', async ({ page }) => {
    const lock = page.locator('.candidate-zone input[type="checkbox"]')
    await lock.check({ force: true })
    const first = await create(page)
    expect(await group(page, first)).toMatchObject({ isLocked: true, lockedLineage: 'default' })
    await expectHull(page, first, 'default')
    await lock.uncheck({ force: true })
    const second = await create(page, 'weaponcomponents')
    expect(first).not.toBe(second)
    expect(await group(page, second)).toMatchObject({ isLocked: false })
    expect((await group(page, second)).nodes.find((node: any) => node.wareId === 'weaponcomponents')).toMatchObject({ lineage: 'default', source: 'manual' })
  })
  test('language switch updates candidate and planning UI', async ({ page }) => {
    const candidate = page.locator('.ware-card-wrapper[data-ware-id="hullparts"]')
    await expect(candidate).toContainText('船体部件')
    await create(page)
    await expect(node(page, 'hullparts')).toContainText('船体部件产线')
    await page.getByTestId('language-select').selectOption('en')
    await expect(candidate).toContainText('Hull Parts')
    await expect(node(page, 'hullparts')).toContainText('Hull Part Production')
  })
})
