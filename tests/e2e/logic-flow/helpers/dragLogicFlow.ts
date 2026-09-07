import { expect, type Page } from '@playwright/test'

type DropTarget = 'new' | number | { groupId: string }
type DropStatus = 'normal' | 'duplicated' | 'auto' | 'isolated' | 'replace' | 'locked' | 'rejected'

export async function expectDragIdle(page: Page): Promise<void> {
  await expect(page.getByTestId('compact-view')).toBeHidden()
  await expect(page.locator('.sortable-chosen, .sortable-ghost, .sortable-drag')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => {
    const store = (window as any).logicFlowStore
    return [store.isDragging, store.draggingWareId, store.draggingLineage, store.hoveredGroupId, store.isHoveringNewZone, store.previewNodes.size]
  })).toEqual([false, null, null, null, false, 0])
}

export async function attemptWareDrag(page: Page, wareId: string): Promise<void> {
  await expectDragIdle(page)
  const before = await page.evaluate(() => (window as any).logicFlowStore.groups)
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]:visible`)
  await source.scrollIntoViewIfNeeded()
  await expect(source).toHaveAttribute('draggable', 'false')
  await expect(source.locator('.ware-card-add-btn')).toHaveCount(0)
  const box = await source.boundingBox()
  if (!box) throw new Error(`Source ware ${wareId} not found`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.down()
  try {
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 10 })
    await expectDragIdle(page)
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual(before)
  } finally {
    await page.mouse.up()
  }
  await expectDragIdle(page)
  await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual(before)
}

export async function startWareDrag(page: Page, wareId: string): Promise<void> {
  await expectDragIdle(page)
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]:visible`)
  await source.scrollIntoViewIfNeeded()
  // Sortable resets the native draggable attribute on release and sets it on the next press.
  await expect(source).toHaveClass(/is-draggable-tier/)
  const box = await source.boundingBox()
  if (!box) throw new Error(`Source ware ${wareId} not found`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 10 })
  await expect(page.getByTestId('compact-view')).toBeVisible()
  await expect(source).toHaveClass(/sortable-chosen/)
  await expect.poll(() => page.evaluate(() => {
    const store = (window as any).logicFlowStore
    return { active: store.isDragging, wareId: store.draggingWareId }
  })).toEqual({ active: true, wareId })
}

export async function getGroupIdForWare(page: Page, wareId: string): Promise<string> {
  const ids = await page.evaluate((id) => (window as any).logicFlowStore.groups
    .filter((group: any) => group.nodes.some((node: any) => node.wareId === id && node.source === 'manual'))
    .map((group: any) => group.id), wareId)
  expect(ids, `Unique group with manual ${wareId}`).toHaveLength(1)
  return ids[0]
}

export async function dragWareToTarget(
  page: Page,
  wareId: string,
  target: DropTarget = 'new',
  options: { drop?: boolean; expectRejected?: boolean; expectedStatus?: DropStatus } = {}
) {
  const { drop = true, expectRejected = false } = options
  let expectedStatus = options.expectedStatus
  if (expectRejected) {
    if (expectedStatus !== undefined) expect(expectedStatus).toBe('rejected')
    expectedStatus = 'rejected'
  }
  const beforeGroups = await page.evaluate(() => (window as any).logicFlowStore.groups)
  const targetIndex = typeof target === 'object'
    ? beforeGroups.findIndex((group: any) => group.id === target.groupId)
    : target
  if (targetIndex !== 'new' && (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= beforeGroups.length)) {
    throw new Error(`Logic Flow drop target ${JSON.stringify(target)} not found`)
  }
  const groupId = targetIndex === 'new' ? 'new' : beforeGroups[targetIndex].id
  await startWareDrag(page, wareId)
  const sourceBox = await page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"].sortable-chosen`).boundingBox()
  const compactView = page.getByTestId('compact-view')
  const targetLocator = targetIndex === 'new'
    ? compactView.locator('.compact-group').last()
    : compactView.locator('.compact-group').nth(targetIndex)
  await targetLocator.scrollIntoViewIfNeeded()
  const targetBox = await targetLocator.boundingBox()
  const compactBox = await compactView.boundingBox()
  if (!targetBox || !compactBox) throw new Error('Logic Flow drop target not visible')
  await page.mouse.move(compactBox.x + 5, compactBox.y + 5, { steps: 10 })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })
  await expect.poll(() => page.evaluate(() => {
    const store = (window as any).logicFlowStore
    return { groupId: store.hoveredGroupId, newZone: store.isHoveringNewZone }
  })).toEqual({ groupId: groupId === 'new' ? null : groupId, newZone: groupId === 'new' })

  if (groupId === 'new') {
    await expect(targetLocator).toHaveClass(/border-blue-500\/50/)
  } else if (expectedStatus === 'rejected') {
    await expect(targetLocator).toHaveClass(/border-red-600/)
    await expect(targetLocator.getByTestId('rejected-label')).toBeVisible()
    await expect(targetLocator.locator('.compact-node.animate-pulse')).toHaveCount(0)
  } else if (expectedStatus === 'duplicated') {
    await expect(targetLocator).toHaveClass(/border-red-500/)
    await expect(targetLocator.getByTestId('duplicate-label')).toBeVisible()
  } else if (expectedStatus === 'isolated') {
    await expect(targetLocator).toContainText(/连接|Connect/i)
  } else if (expectedStatus === 'auto' || expectedStatus === 'replace') {
    await expect(targetLocator.getByTestId(`${expectedStatus}-label`).locator('span')).toHaveClass(/text-blue-400/)
    await expect(targetLocator).toContainText(expectedStatus === 'auto' ? /手动|Manual/i : /替换|Replace/i)
  } else if (expectedStatus === 'locked') {
    await expect(targetLocator).toHaveClass(/border-amber-500\/50/)
  } else if (expectedStatus === 'normal') {
    await expect(targetLocator).toHaveClass(/border-blue-500/)
  }

  // Business outcomes belong to callers; an omitted status never derives its own oracle.
  if (drop) {
    await page.mouse.up()
    await expectDragIdle(page)
    if (groupId === 'new') {
      await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups.length)).toBe(beforeGroups.length + 1)
    } else if (expectedStatus === 'rejected' || expectedStatus === 'duplicated') {
      await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.groups)).toEqual(beforeGroups)
    }
  }
  return { sourceBox, targetBox, targetLocator }
}
