import { test } from '../../test-setup'
import { expect } from '@playwright/test'
import { loadLiveBindingFixture } from './helpers/loadLiveBindingFixture'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'

async function readSelectedArchive(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const archive = (window as any).saveStore?.selectedArchive
    return archive
      ? {
          guid: archive.meta.guid,
          time: archive.meta.time,
          filename: archive.meta.filename,
          isValid: archive.isValid,
          isCompatible: archive.isCompatible
        }
      : null
  })
}

async function readStationArchiveId(page: import('@playwright/test').Page) {
  return page.evaluate(() => (window as any).liveStore.playerStationRecords.find(
    (record: any) => record.code === 'KXN-018' && record.type === 'station'
  )?.archiveId)
}

test.describe('binding selects latest valid archive', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    await loadLiveBindingFixture(page, {
      transformSave: (save, filename) => {
        if (filename === 'save.json') {
          return { ...save, meta: { ...save.meta, parser_version: 'v4' } }
        }
        return save
      },
      transformSaves: (saves) => {
        const olderValid = saves.find((save) => save.meta.filename === 'save_008')
        if (!olderValid) throw new Error('save_008 fixture is required')
        return [
          ...saves,
          {
            ...olderValid,
            meta: {
              ...olderValid.meta,
              time: 700000,
              filename: 'save_008_later'
            }
          }
        ]
      },
      initialArchiveId: `${GAME_GUID}_700000`
    })
  })

  test('map save panel shows invalid badge on newest archive, valid one is clickable', async ({ page }) => {
    await page.getByTestId('top-view-btn-maps').click()
    await page.waitForTimeout(500)
    const saveTab = page.getByTestId('map-save-panel-tab')
    await expect(saveTab).toBeVisible({ timeout: 3000 })
    await saveTab.click()
    await page.waitForTimeout(500)

    const panel = page.getByTestId('map-save-panel')
    await expect(panel).toBeVisible({ timeout: 3000 })

    const invalidWarning = panel.locator('.invalid-warning')
    await expect(invalidWarning).toBeVisible()
    await expect(invalidWarning).toContainText(/无效|Invalid/)

    const group = panel.locator('.archive-group').filter({ hasText: 'slepher' })
    const groupTitle = group.getByTestId('save-group-title')
    await expect(groupTitle).toBeVisible()
    await expect(groupTitle).toContainText(/slepher/)
    await expect(groupTitle).toContainText(/2 个存档|2 archives/i)

    const invalidArchive = panel.locator('.save-item').filter({ hasText: 'save_009' })
    await expect(invalidArchive).toHaveCount(1)
    await expect(invalidArchive).toHaveClass(/save-item-disabled/)
    await expect(invalidArchive.locator('.invalid-warning')).toContainText(/无效|Invalid/)

    await expect.poll(() => readSelectedArchive(page)).toEqual({
      guid: GAME_GUID,
      time: 700000,
      filename: 'save_008_later',
      isValid: true,
      isCompatible: true
    })
    await expect.poll(() => readStationArchiveId(page)).toBe(`${GAME_GUID}_700000`)

    const save008 = group.locator('.save-filename').getByText('save_008', { exact: true }).locator('..').locator('..').locator('..')
    await expect(save008).toHaveCount(1)
    await expect(save008).not.toHaveClass(/save-item-active/)
    await save008.locator('.save-info').click()
    await expect(save008).toHaveClass(/save-item-active/)
    await expect.poll(() => readSelectedArchive(page)).toEqual({
      guid: GAME_GUID,
      time: 667632.933,
      filename: 'save_008',
      isValid: true,
      isCompatible: true
    })
    await expect.poll(() => readStationArchiveId(page)).toBe(`${GAME_GUID}_667632.933`)

    const save008Later = group.locator('.save-item').filter({ hasText: 'save_008_later' })
    await expect(save008Later).not.toHaveClass(/save-item-active/)
    await save008Later.locator('.save-info').click()
    await expect(save008Later).toHaveClass(/save-item-active/)
    await expect.poll(() => readSelectedArchive(page)).toEqual({
      guid: GAME_GUID,
      time: 700000,
      filename: 'save_008_later',
      isValid: true,
      isCompatible: true
    })
    await expect.poll(() => readStationArchiveId(page)).toBe(`${GAME_GUID}_700000`)

    await page.reload()
    await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 10000 })
    await page.getByTestId('top-view-btn-maps').click()
    await page.getByTestId('map-save-panel-tab').click()
    await expect(page.getByTestId('map-save-panel').locator('.save-item-active').filter({ hasText: 'save_008_later' })).toBeVisible()
    await expect.poll(() => readSelectedArchive(page)).toEqual({
      guid: GAME_GUID,
      time: 700000,
      filename: 'save_008_later',
      isValid: true,
      isCompatible: true
    })
  })

  test('stations load from older valid archive when newer one is invalid', async ({ page }) => {
    const sectorTab = page.locator('[data-testid="sidebar-sector"][data-sector-id="cluster_100_sector001_macro"]')
    await expect(sectorTab).toBeVisible({ timeout: 5000 })
    await sectorTab.click()
    await page.waitForTimeout(500)

    const stationTab = page.locator('[data-testid="sidebar-station"][data-station-id="KXN-018"]')
    await expect(stationTab).toBeVisible({ timeout: 5000 })
    await stationTab.click()
    await page.waitForTimeout(300)

    const dashboard = page.locator('[data-testid="station-dashboard"]')
    await expect(dashboard).toBeVisible({ timeout: 2000 })
    await expect.poll(() => page.evaluate(() => {
      const archive = (window as any).saveStore?.selectedArchive
      const records = (window as any).liveStore?.playerStationRecords || []
      return {
        selected: archive
          ? {
              guid: archive.meta.guid,
              time: archive.meta.time,
              filename: archive.meta.filename,
              isValid: archive.isValid,
              isCompatible: archive.isCompatible
            }
          : null,
        hasKxn018: records.some((record: any) => record.code === 'KXN-018')
      }
    })).toEqual({
      selected: {
        guid: GAME_GUID,
        time: 700000,
        filename: 'save_008_later',
        isValid: true,
        isCompatible: true
      },
      hasKxn018: true
    })
    await expect.poll(() => readStationArchiveId(page)).toBe(`${GAME_GUID}_700000`)
  })
})
