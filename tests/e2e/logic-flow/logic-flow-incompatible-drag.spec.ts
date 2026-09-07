import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { setupLogicFlow } from './helpers/setupLogicFlow'
import { dragWareToTarget, getGroupIdForWare } from './helpers/dragLogicFlow'

test.describe('Logic Flow Incompatible Drag Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await setupLogicFlow(page, 'clean')
  })

  for (const locked of [false, true]) {
    test(locked ? '4.17 UI: Locked Group Conflict Feedback (Locked Group)' : '4.16 UI: Incompatible Drop Target Visibility (Unlocked Group)', async ({ page }) => {
      await page.locator('.candidate-zone input[type="checkbox"]').setChecked(locked, { force: true })
      await dragWareToTarget(page, 'siliconwafers')
      const groupId = await getGroupIdForWare(page, 'siliconwafers')
      await expect.poll(() => page.evaluate(id => {
        const group = (window as any).logicFlowStore.groups.find((group: any) => group.id === id)
        return { locked: group.isLocked, lineage: group.lockedLineage }
      }, groupId)).toEqual({ locked, lineage: 'default' })
      const before = await page.evaluate(() => (window as any).logicFlowStore.groups)
      await page.locator('.tab-btn').filter({ hasText: /农业|Agricultural/i }).click()
      await page.locator('.race-btn').filter({ hasText: /泰拉迪|Teladi/i }).click()
      await dragWareToTarget(page, 'spaceweed', { groupId }, { expectedStatus: locked ? 'rejected' : 'normal' })
      if (locked) {
        await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual(before)
        await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toHaveCount(0)
      } else {
        await expect(page.locator('.production-group')).toHaveCount(1)
        await expect(page.locator('.flow-node[data-ware-id="spaceweed"]')).toBeVisible()
        await expect.poll(() => page.evaluate(id => {
          const group = (window as any).logicFlowStore.groups.find((group: any) => group.id === id)
          return group.nodes.filter((node: any) => node.wareId === 'spaceweed').map((node: any) => ({ moduleId: node.moduleId, lineage: node.lineage, source: node.source }))
        }, groupId)).toEqual([{ moduleId: 'module_tel_prod_spaceweed_01', lineage: 'teladi', source: 'manual' }])
      }
    })
  }
})
