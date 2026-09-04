import { expect, type Page } from '@playwright/test'

type DropTarget = 'new' | number

export async function dragWareToTarget(
  page: Page,
  wareId: string,
  target: DropTarget = 'new',
  options: { drop?: boolean; expectRejected?: boolean } = {}
) {
  const { drop = true, expectRejected = false } = options
  const source = page.locator(`.ware-card-wrapper[data-ware-id="${wareId}"]`).first()
  await expect(source).toBeVisible()
  const sourceBox = await source.boundingBox()
  if (!sourceBox) throw new Error(`Source ware ${wareId} not found`)

  const compactView = page.getByTestId('compact-view')
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
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 })

  if (target === 'new') {
    await expect(targetLocator).toHaveClass(/border-blue-500\/50/)
  } else if (expectRejected) {
    await expect(targetLocator).toHaveClass(/border-red-600/)
    await expect(targetLocator.getByTestId('rejected-label')).toBeVisible()
  } else {
    await expect.poll(() => page.evaluate(() => (window as any).logicFlowStore.hoveredGroupId)).not.toBeNull()
  }

  if (drop) {
    await page.mouse.up()
    await expect(compactView).toBeHidden()
  }
  return { sourceBox, targetBox, targetLocator }
}
