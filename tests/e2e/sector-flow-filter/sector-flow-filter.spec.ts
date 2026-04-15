import { test } from '../../test-setup'
import { expect, Page } from '@playwright/test'
import dbFixture from '../../fixtures/db.json'

const GAME_GUID = 'CB8837FE-98C1-42F8-9D6A-ED0ADC539111'
const ASTEROID_GROUP_ID = '186727eb-7c4a-c0e0-b20d-f17405fd3aa3'

test.beforeEach(async ({ page }) => {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
  })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
})

async function loadDbFixture(page: Page) {
  const dbData = JSON.parse(JSON.stringify(dbFixture))
  delete dbData.vsn
  delete dbData.playerStationRecords
  delete dbData.x4_save_archives
  
  await page.evaluate((data) => {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value))
    })
    localStorage.setItem('isTestEnv', 'true')
  }, dbData)
  await page.reload()
  await page.waitForSelector('#debug-ready-marker', { state: 'attached', timeout: 500 })
}

async function importSaveArchives(page: Page) {
  const saveData = dbFixture.x4_save_archives
  
  await page.evaluate(async (archivesData: any) => {
    const saveStore = (window as any).saveStore
    const liveStore = (window as any).liveStore
    const saveBindingStore = (window as any).saveBindingStore
    const saveArchiveDB = (window as any).saveArchiveDB
    if (!saveStore || !liveStore || !saveArchiveDB) return { success: false, error: 'Stores not available' }
    
    const { saveArchiveToDB, createArchiveId, loadPlayerStationsByArchiveId } = saveArchiveDB
    const archives = archivesData.archives || []
    const scopeKey = 'x4_save_archives'
    
    for (const archive of archives) {
      await saveArchiveToDB(scopeKey, archive)
      saveStore.importFromJson(archive)
    }
    
    const archive = saveStore.selectedArchive
    if (archive) {
      const archiveId = createArchiveId(archive.meta.guid, archive.meta.time)
      const records = await loadPlayerStationsByArchiveId(scopeKey, archiveId)
      liveStore.playerStationRecords.value = records
    }
    
    const bindingsList = saveBindingStore?.savedBindings?.list || []
    if (bindingsList.length > 0) {
      const firstBinding = bindingsList[0]
      saveBindingStore.createOrOpenBinding(firstBinding.gameGuid)
      liveStore.openBinding(firstBinding.gameGuid)
    }
    
    await new Promise(r => setTimeout(r, 100))
    liveStore.syncAllBindingStationsToStateMap?.()
    
    return { success: true }
  }, saveData)
  await page.waitForTimeout(500)
}

async function setupActiveBinding(page: Page) {
  await page.evaluate((gameGuid: string) => {
    localStorage.setItem('x4_station_active_view', JSON.stringify({
      activeBinding: gameGuid,
      activeView: 'live-production'
    }))
  }, GAME_GUID)
}

async function setLanguage(page: Page, lang: string) {
  const langSelect = page.locator('select').filter({ hasText: /简体中文|English/ })
  await langSelect.selectOption(lang)
}

async function switchToLiveProduction(page: Page) {
  await page.getByTestId('top-view-btn-live-production').click()
  await page.waitForTimeout(200)
}

async function commonSetup(page: Page) {
  await loadDbFixture(page)
  await importSaveArchives(page)
  await setupActiveBinding(page)
  await setLanguage(page, 'zh-CN')
  await switchToLiveProduction(page)
}

async function getSectorFlowsFromStore(page: Page, sectorId: string): Promise<string[]> {
  return await page.evaluate((id: string) => {
    const stationProductionFlowMap = (window as any).stationProductionFlowMap
    if (!stationProductionFlowMap) return []
    const flows = stationProductionFlowMap.getSectorFlows(id)
    return flows.map(f => f.wareId)
  }, sectorId)
}

async function getPlannedWaresFromModules(page: Page, modules: { id: string; count: number }[]): Promise<string[]> {
  return await page.evaluate((mods: { id: string; count: number }[]) => {
    const gameDataStore = (window as any).gameDataStore
    if (!gameDataStore) return []
    const modulesMap = gameDataStore.modulesMap
    const wareSet = new Set<string>()
    mods.forEach(m => {
      const info = modulesMap[m.id]
      if (info?.outputs) {
        Object.keys(info.outputs).forEach(w => wareSet.add(w))
      }
    })
    return Array.from(wareSet)
  }, modules)
}

test.describe('Sector Flow Filter', () => {
  test('小行星 sector flows 仅包含该 sector 内 station 的 planned ware', async ({ page }) => {
    await commonSetup(page)
    await page.waitForTimeout(500)
    
    const binding = dbFixture.x4_save_bindings.list[0]
    const asteroidGroup = binding.groups.find(g => g.id === ASTEROID_GROUP_ID)
    
    const asteroidStations = binding.stationPlans.filter(
      s => s.groupId === ASTEROID_GROUP_ID || (asteroidGroup && s.saveStationCode && asteroidGroup.tradeStation?.id !== s.id)
    )
    
    const expectedWares: string[] = []
    for (const station of asteroidStations) {
      const stationWares = await getPlannedWaresFromModules(page, station.modules)
      expectedWares.push(...stationWares)
    }
    const uniqueExpectedWares = Array.from(new Set(expectedWares))
    
    const sectorFlowsWares = await getSectorFlowsFromStore(page, ASTEROID_GROUP_ID)
    
    const surplusWaresInFlows = await page.evaluate((sectorId: string) => {
      const stationProductionFlowMap = (window as any).stationProductionFlowMap
      if (!stationProductionFlowMap) return []
      const flows = stationProductionFlowMap.getSectorFlows(sectorId)
      return flows.filter(f => f.netRate > 0).map(f => f.wareId)
    }, ASTEROID_GROUP_ID)
    
    for (const wareId of surplusWaresInFlows) {
      expect(uniqueExpectedWares).toContain(wareId)
    }
    
    const deficitWares = sectorFlowsWares.filter(w => !surplusWaresInFlows.includes(w))
    expect(deficitWares.length).toBeGreaterThan(0)
  })
})