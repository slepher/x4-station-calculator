import { expect, type Locator, type Page } from '@playwright/test'

export async function expandSidebarGroup(page: Page, sectorId: string): Promise<void> {
  const toggle = page.getByTestId('production-sidebar').locator(
    `[data-testid="sidebar-sector-toggle"][data-sector-id="${sectorId}"]`
  )
  await expect(toggle).toBeVisible()
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

export async function getSidebarTransit(page: Page, sectorId: string): Promise<Locator> {
  await expandSidebarGroup(page, sectorId)
  const transit = page.getByTestId('production-sidebar').locator(
    `[data-testid="sidebar-transit"][data-sector-id="${sectorId}"]`
  )
  await expect(transit).toBeVisible()
  return transit
}
