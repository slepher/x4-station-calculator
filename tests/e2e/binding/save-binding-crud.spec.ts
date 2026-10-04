import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from '../live/helpers/loadLiveBindingFixture'
import { getSidebarTransit } from '../live/helpers/sidebarNavigation'

const ORIGINAL_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const SECOND_GUID = 'B41B8D56-C58D-4F66-8EAA-6F85BC614214'

async function readPersistence(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const game = (window as any).gameDataStore
    const bindingKey = game.getStorageKey('save_archives').replace('save_archives', 'save_bindings')
    return {
      bindings: JSON.parse(localStorage.getItem(bindingKey)!).list,
      empire: localStorage.getItem(game.getStorageKey('empire'))
    }
  })
}

async function readActiveIdentity(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    active: (window as any).activeViewStore.activeBinding,
    draft: (window as any).saveBindingStore.activeBinding?.gameGuid,
    archive: (window as any).saveStore.selectedArchive?.meta.guid
  }))
}

test.describe('Save Binding CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page)
  })

  test('live production view is active after fixture load', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
  })

  test('overview tab shows empire wareflow dashboard', async ({ page }) => {
    const overviewTab = page.locator('[data-testid="sidebar-overview"]')
    await expect(overviewTab).toBeVisible({ timeout: 5000 })
    await overviewTab.click()

    const dashboard = page.locator('[data-testid="empire-wareflow-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 5000 })
  })

  test('creates a named binding, saves, switches and deletes with isolated reload persistence', async ({ page }) => {
    const initial = await readPersistence(page)
    expect(initial.bindings.map((binding: any) => binding.gameGuid)).toEqual([ORIGINAL_GUID])
    await page.getByTestId('top-view-btn-maps').click()
    await page.getByTestId('map-save-panel-tab').click()
    await page.getByRole('button', { name: '莱布·哈利肯 bind', exact: true }).click()
    await expect.poll(async () => (await readPersistence(page)).bindings.map(
      (binding: any) => ({ guid: binding.gameGuid, name: binding.bindingName })
    )).toEqual([
      { guid: ORIGINAL_GUID, name: 'slepher' },
      { guid: SECOND_GUID, name: '莱布·哈利肯' }
    ])
    const created = await readPersistence(page)
    await page.getByTestId('toolbar-save-btn').click()
    await page.getByTestId('top-view-btn-live-production').click()

    await page.getByTestId('toolbar-load-btn').click()
    const dialog = page.getByTestId('dialog-backdrop')
    const secondRow = dialog.locator('.group').filter({ hasText: '莱布·哈利肯' })
    await secondRow.getByRole('button', { name: '加载绑定', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(() => readActiveIdentity(page)).toEqual({ active: SECOND_GUID, draft: SECOND_GUID, archive: SECOND_GUID })

    await page.getByTestId('toolbar-load-btn').click()
    await dialog.locator('.group').filter({ hasText: 'slepher' }).getByRole('button', { name: '加载绑定', exact: true }).click()
    await expect.poll(() => readActiveIdentity(page)).toEqual({ active: ORIGINAL_GUID, draft: ORIGINAL_GUID, archive: ORIGINAL_GUID })
    await page.reload()
    await expect(page.getByTestId('sidebar-overview')).toBeVisible()
    await expect.poll(() => readActiveIdentity(page)).toEqual({ active: ORIGINAL_GUID, draft: ORIGINAL_GUID, archive: ORIGINAL_GUID })
    expect((await readPersistence(page)).bindings.map((binding: any) => binding.gameGuid)).toEqual([ORIGINAL_GUID, SECOND_GUID])

    await page.getByTestId('toolbar-load-btn').click()
    page.once('dialog', (confirmation) => confirmation.accept())
    await secondRow.getByRole('button', { name: '删除', exact: true }).click()
    await expect(secondRow).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('sidebar-overview')).toBeVisible()
    const after = await readPersistence(page)
    expect(after.bindings).toEqual(created.bindings.filter((binding: any) => binding.gameGuid === ORIGINAL_GUID))
    expect(after.empire).toBe(initial.empire)
    await expect.poll(() => readActiveIdentity(page)).toEqual({ active: ORIGINAL_GUID, draft: ORIGINAL_GUID, archive: ORIGINAL_GUID })
  })

  test('binding station edits remain draft until explicit save and survive reload outside empire storage', async ({ page }) => {
    const initial = await readPersistence(page)
    await (await getSidebarTransit(page, 'cluster_100_sector001_macro')).locator('.sidebar-nav').click()
    await page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]').click()
    const nameInput = page.locator('.live-toolbar input.ghost-input')
    await expect(nameInput).toHaveValue('地球人')
    await nameInput.fill('M1.2 保存站点')
    await nameInput.blur()
    await expect.poll(() => page.evaluate(() => (window as any).saveBindingStore.isDirty)).toBe(true)
    expect((await readPersistence(page)).bindings).toEqual(initial.bindings)
    await page.getByTestId('toolbar-save-btn').click()
    await expect.poll(() => page.evaluate(() => (window as any).saveBindingStore.isDirty)).toBe(false)
    await expect.poll(async () => (await readPersistence(page)).bindings.find(
      (binding: any) => binding.gameGuid === ORIGINAL_GUID
    ).stationPlans.find((station: any) => station.saveStationCode === 'KXN-018').name).toBe('M1.2 保存站点')
    await page.reload()
    await expect(nameInput).toHaveValue('M1.2 保存站点')
    expect((await readPersistence(page)).empire).toBe(initial.empire)
  })
})
