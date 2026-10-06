import { X4PrecisionLoader } from './loader'
import { processMap } from '../map-ts/index'
import { processFactions, processTerraforming, processResearch, processBlueprints } from '../extensions-ts/index'

export { X4PrecisionLoader } from './loader'
export interface DataContext {
  config: Record<string, any>
  rawPath: string
  outputRoot: string
  paths?: Record<string, string>
}

/** A fresh loader and language registry belong to each version run. */
export async function processData(context: DataContext) {
  const loader = new X4PrecisionLoader(context.rawPath, context.outputRoot, context.config)
  console.log('[data] wares, recipes, consumption, colors and modules')
  loader.buildDatabase()
  loader.loadColors()
  loader.loadRegionyieldsColors()
  loader.processModuleGroups()
  loader.scanAssets()
  console.log('[data] ships, equipment, missiles, drones and bullets')
  loader.parseShipAndEquipmentData()
  loader.loadShipMaxStatistics()
  loader.buildMissiles()
  loader.buildDronesAndConsumables()
  loader.buildBullets()
  await processFactions(loader)
  console.log('[data] map')
  const map = await processMap({ ...context, i18n: loader.i18n_registry, factions: loader.factions_data === null ? undefined : loader.factions_data })
  for (const nameId of map.name_ids as Set<string>) loader.needed_raw_names.add(nameId)
  console.log('[data] languages, terraforming, research and blueprints')
  loader.extractAndResolveLanguages()
  // The source's external map-name lookup is empty for supported input layouts.
  // Keep objective references unchanged; generated-map substitution is a separate change.
  await processTerraforming(loader)
  await processResearch(loader)
  await processBlueprints(loader)
  loader.analyzeTypesAndDlcs()
  loader.refreshExportedI18n()
  loader.injectEnglishNames()
  console.log('[data] save')
  const files: string[] = [...map.outputs, ...loader.save()]
  return { task: 'data', outputRoot: context.outputRoot, files, files_written: files.length, map,
    counts: { modules: loader.all_modules.length, wares: loader.wares_data.length, ships: loader.ships_data.length,
      equipments: loader.equipments_data.length, missiles: loader.missiles_data.length, bullets: loader.bullets_data.length,
      drones: loader.drones_data.length, consumables: loader.consumables_data.length } }
}
