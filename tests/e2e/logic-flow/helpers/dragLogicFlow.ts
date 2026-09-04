import { expect, type Page } from '@playwright/test'

type DropTarget = 'new' | number
type DropStatus = 'normal' | 'duplicated' | 'auto' | 'isolated' | 'replace' | 'locked' | 'rejected'

export async function attemptWareDrag(page: Page, wareId: string): Promise<void> {
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]:visible`).first()
  await expect(source).toBeVisible()
  const box = await source.boundingBox()
  if (!box) throw new Error(`Source ware ${wareId} not found`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 10 })
  await expect(page.getByTestId('compact-view')).toHaveCount(0)
  await page.mouse.up()
}

export async function startWareDrag(page: Page, wareId: string): Promise<void> {
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]:visible`).first()
  await expect(source).toBeVisible()
  const box = await source.boundingBox()
  if (!box) throw new Error(`Source ware ${wareId} not found`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5, { steps: 5 })
  await expect(page.getByTestId('compact-view')).toBeVisible({ timeout: 5000 })
}

export async function dragWareToTarget(
  page: Page,
  wareId: string,
  target: DropTarget = 'new',
  options: { drop?: boolean; expectRejected?: boolean; expectedStatus?: DropStatus } = {}
) {
  const { drop = true, expectRejected = false } = options
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]:visible`).first()
  await expect(source).toBeVisible()
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error(`Source ware ${wareId} not found`)

  const compactView = page.getByTestId('compact-view')
  await source.hover()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2 + 8, { steps: 5 })
  await expect(compactView).toBeVisible()

  const targetLocator = target === 'new'
    ? compactView.locator('.compact-group').last()
    : compactView.locator('.compact-group').nth(target)
  await expect(targetLocator).toBeVisible()
  await targetLocator.scrollIntoViewIfNeeded()
  const targetBox = await targetLocator.boundingBox()
  if (!targetBox) throw new Error('Logic Flow drop target not found')
  const compactBox = await compactView.boundingBox()
  if (!compactBox) throw new Error('Compact view not found')
  await page.mouse.move(compactBox.x + 5, compactBox.y + 5, { steps: 10 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })

  let groupId: string | undefined
  let beforeWareCount: number | undefined
  let beforeLineage: string | undefined
  let effectiveLineage: string | undefined
  let expectedModuleId: string | undefined
  let beforeNodes: unknown
  let resolvedStatus: DropStatus = 'normal'
  if (target === 'new') {
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.isHoveringNewZone)).toBe(true)
    await expect(targetLocator).toHaveClass(/border-blue-500\/50/)
  } else {
    groupId = await page.evaluate((index) => (window as any).logicFlowStore.groups[index]?.id, target)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).toBe(groupId)
    const state = await page.evaluate(({ id, ware }) => {
      const store = (window as any).logicFlowStore
      const group = store.groups.find((item: any) => item.id === id)
      const lineage = group?.isLocked ? group.lockedLineage : store.draggingLineage || 'default'
      return {
        status: store.getWareGroupStatus(id, ware, lineage),
        isLocked: group?.isLocked,
        lineage,
        moduleId: (window as any).gameDataStore?.findModuleForWare(ware, lineage)?.id,
      }
    }, { id: groupId, ware: wareId })
    const actualStatus = state.status as string
    effectiveLineage = state.lineage
    expectedModuleId = state.moduleId
    resolvedStatus = actualStatus === 'available'
      ? (state.isLocked ? 'locked' : 'normal')
      : actualStatus as DropStatus
    if (options.expectedStatus) {
      expect(resolvedStatus).toBe(options.expectedStatus)
    }
    beforeWareCount = await page.evaluate(({ id, ware }) => {
      const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
      return group?.nodes.filter((node: any) => node.wareId === ware).length
    }, { id: groupId, ware: wareId })
    beforeLineage = await page.evaluate(({ id, ware }) => {
      const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
      return group?.nodes.find((node: any) => node.wareId === ware)?.lineage
    }, { id: groupId, ware: wareId })
    beforeNodes = await page.evaluate((id) => {
      const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
      return group?.nodes.map((node: any) => ({
        wareId: node.wareId,
        moduleId: node.moduleId,
        lineage: node.lineage,
        source: node.source,
        isIsolated: node.isIsolated,
      }))
    }, groupId)
    if (resolvedStatus === 'rejected' || expectRejected) {
      await expect(targetLocator).toHaveClass(/border-red-600/)
      await expect(targetLocator.getByTestId('rejected-label')).toBeVisible()
    } else if (resolvedStatus === 'duplicated') {
      await expect(targetLocator).toHaveClass(/border-red-500/)
      await expect(targetLocator.getByTestId('duplicate-label')).toBeVisible()
    } else if (resolvedStatus === 'isolated') {
      await expect(targetLocator).toContainText(/连接|Connect/i)
      await expect(targetLocator).toHaveClass(/border-blue-500/)
    } else if (resolvedStatus === 'auto') {
      await expect(targetLocator).toContainText(/手动|Manual/i)
      await expect(targetLocator).toHaveClass(/border-blue-500/)
    } else if (resolvedStatus === 'replace') {
      await expect(targetLocator).toContainText(/替换|Replace/i)
      await expect(targetLocator).toHaveClass(/border-blue-500/)
    } else if (resolvedStatus === 'locked') {
      await expect(targetLocator).toHaveClass(/border-amber-500\/50/)
    } else {
      await expect(targetLocator).toHaveClass(/border-blue-500/)
    }
  }

  if (drop) {
    const beforeGroups = await page.locator('.production-group').count()
    await page.mouse.up()
    await expect(compactView).toBeHidden()
    if (target === 'new') {
      await expect(page.locator('.production-group')).toHaveCount(beforeGroups + 1)
    } else if (resolvedStatus === 'rejected' || resolvedStatus === 'duplicated' || expectRejected) {
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe(beforeWareCount)
    } else if (resolvedStatus === 'isolated') {
      expect(expectedModuleId).toBeTruthy()
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe(beforeWareCount)
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.find((node: any) => node.wareId === ware)?.isIsolated
      }, { id: groupId, ware: wareId })).toBe(false)
      await expect.poll(() => page.evaluate(({ id, ware, moduleId }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.find((node: any) => node.wareId === ware)?.moduleId
      }, { id: groupId, ware: wareId, moduleId: expectedModuleId })).toBe(expectedModuleId)
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.some((node: any) => node.wareId !== ware && node.source === 'auto' && !node.isIsolated)
      }, { id: groupId, ware: wareId })).toBe(true)
    } else if (resolvedStatus === 'auto') {
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe(beforeWareCount)
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.find((node: any) => node.wareId === ware)?.source
      }, { id: groupId, ware: wareId })).toBe('manual')
    } else if (resolvedStatus === 'replace') {
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe(beforeWareCount)
      await expect.poll(() => page.evaluate(({ id, ware, previous }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.find((node: any) => node.wareId === ware)?.lineage
          !== previous
      }, { id: groupId, ware: wareId, previous: beforeLineage })).toBe(true)
    } else if (resolvedStatus === 'locked') {
      expect(effectiveLineage).toBeTruthy()
      expect(expectedModuleId).toBeTruthy()
      await expect.poll(() => page.evaluate(({ id, ware, lineage }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        const node = group?.nodes.find((item: any) => item.wareId === ware && item.source === 'manual')
        return { count: group?.nodes.filter((item: any) => item.wareId === ware).length, lineage: node?.lineage, moduleId: node?.moduleId }
      }, { id: groupId, ware: wareId, lineage: effectiveLineage })).toMatchObject({
        count: (beforeWareCount ?? 0) + 1,
        lineage: effectiveLineage,
      })
      await expect.poll(() => page.evaluate(({ id, ware, moduleId }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.find((item: any) => item.wareId === ware && item.source === 'manual')?.moduleId
      }, { id: groupId, ware: wareId, moduleId: expectedModuleId })).toBe(expectedModuleId)
    } else if (resolvedStatus === 'normal') {
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe((beforeWareCount ?? 0) + 1)
    } else {
      await expect.poll(() => page.evaluate(({ id, ware }) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.filter((node: any) => node.wareId === ware).length
      }, { id: groupId, ware: wareId })).toBe((beforeWareCount ?? 0) + 1)
    }
    if (resolvedStatus === 'rejected' || resolvedStatus === 'duplicated' || expectRejected) {
      await expect.poll(() => page.evaluate((id) => {
        const group = (window as any).logicFlowStore.groups.find((item: any) => item.id === id)
        return group?.nodes.map((node: any) => ({
          wareId: node.wareId,
          moduleId: node.moduleId,
          lineage: node.lineage,
          source: node.source,
          isIsolated: node.isIsolated,
        }))
      }, groupId)).toEqual(beforeNodes)
    }
  }
  return { sourceBox, targetBox, targetLocator, effectiveLineage }
}
