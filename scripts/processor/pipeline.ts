import { dirname, join } from 'node:path'
import { X4PrecisionLoader } from './data-ts/loader'
import { buildMap, legacyYields } from './map-ts/index'
import { readMapXml } from './map-ts/xml'
import { buildResources, loadGroupedResourceareas, type ResourceContext } from './resources-ts/index'
import { processFactions, processTerraforming, processResearch, processBlueprints } from './extensions-ts/index'
import { readJson, writeJson } from './shared-ts/io'
import type { ProcessorContext } from './shared-ts/config'
import { planProcessor, type ProcessorStage } from './targets'

export async function processPipeline(context: ProcessorContext, log: (message: string) => void = console.log) {
  if (context.targets === undefined) throw new Error('Missing processor targets')
  const modern = Number.parseInt(context.config.version, 10) >= 9
  const plan = planProcessor(context.targets, modern)
  let loader: X4PrecisionLoader
  const explicit = context.explicitInputs === undefined ? new Set<string>() : context.explicitInputs
  const inputPaths = Object.fromEntries(Object.entries(context.paths).filter(([key]) => explicit.has(key)))
  const needMap = plan.targets.includes('maps') || plan.targets.includes('languages') ||
    (plan.targets.includes('map-resources') && (!explicit.has('maps-json') || (!modern && !explicit.has('regions-json'))))
  const stages = plan.stages.filter(stage => (stage !== 'maps' && stage !== 'factions') || needMap || (stage === 'factions' && plan.targets.includes('factions')))
  let map: ReturnType<typeof buildMap> | undefined
  let resources: ReturnType<typeof buildResources> | undefined
  let resourceInputs: NonNullable<ResourceContext['inputs']> | undefined
  let regionyields: unknown
  const files: string[] = []
  const run = async (stage: ProcessorStage) => {
    switch (stage) {
      case 'initialize': loader = new X4PrecisionLoader(context.rawPath, context.outputRoot, context.config); break
      case 'database': loader.buildDatabase(); break
      case 'colors': loader.loadColors(); loader.loadRegionyieldsColors(); break
      case 'modules': loader.processModuleGroups(); loader.scanAssets(); break
      case 'ships': loader.parseShips(); loader.loadShipMaxStatistics(); break
      case 'equipments': loader.parseEquipments(); break
      case 'missiles': loader.buildMissiles(); break
      case 'drones': loader.buildDronesAndConsumables(); break
      case 'bullets': loader.buildBullets(); break
      case 'factions': processFactions(loader, inputPaths); break
      case 'maps':
        map = buildMap({ ...context, paths: inputPaths, i18n: loader.i18n_registry, factions: loader.factions_data! })
        for (const name of map.name_ids as Set<string>) loader.needed_raw_names.add(name)
        break
      case 'locale-index': loader.extractAndResolveLanguages(); break
      case 'terraforming': processTerraforming(loader); break
      case 'research': processResearch(loader); break
      case 'blueprints': processBlueprints(loader); break
      case 'types': loader.analyzeTypesAndDlcs(); break
      case 'names': loader.refreshExportedI18n(); loader.injectEnglishNames(); break
      case 'map-resources': {
        const maps = explicit.has('maps-json') ? readJson<Record<string, any>>(context.paths['maps-json']!) : map!.data.maps
        if (maps === null || typeof maps !== 'object' || Array.isArray(maps) || maps.sectors === undefined || typeof maps.sectors !== 'object') throw new Error('Invalid maps JSON: expected sectors')
        const inputs: NonNullable<ResourceContext['inputs']> = { maps }
        if (modern) inputs.definitions = explicit.has('maps-json') ? readJson(join(dirname(context.paths['maps-json']!), 'regionyield_definitions.json')) : map!.data.regionyield_definitions
        else {
          inputs.regions = explicit.has('regions-json') ? readJson(context.paths['regions-json']!) : map!.data.regions
          inputs.areas = explicit.has('maps-json') ? loadGroupedResourceareas(join(dirname(context.paths['maps-json']!), 'resourceareas.json')) : Object.fromEntries(map!.data.resourceareas.map((row: any) => [row.sector_id.toLowerCase(), row.areas]))
        }
        resourceInputs = inputs
        if (!modern) regionyields = map === undefined ? legacyYields(readMapXml(context.paths['regionyields-xml']!)) : map.data.regionyields
        resources = buildResources({ ...context, inputs })
        break
      }
      case 'save': {
        if (plan.targets.includes('maps')) {
          const path = context.paths.output!
          writeJson(path, map!.data.maps); files.push(path)
        }
        if (resources !== undefined) {
          const outputDir = context.paths['resource-output-dir']!
          let sidecars: Record<string, unknown>
          if (modern) {
            const path = join(outputDir, 'regionyield_definitions.json')
            const regenerated = resources.data[path]
            sidecars = { regionyield_definitions: regenerated === undefined ? resourceInputs!.definitions : regenerated }
          } else sidecars = { regions: resourceInputs!.regions, regionyields }
          for (const [name, data] of Object.entries(sidecars)) {
            const key = name.replaceAll('_', '-') + '-output'
            const path = context.paths[key] === undefined ? join(outputDir, `${name}.json`) : context.paths[key]!
            writeJson(path, data); files.push(path)
          }
          for (const [path, data] of Object.entries(resources.data)) {
            if (files.includes(path)) continue
            writeJson(path, data); files.push(path)
          }
        }
        files.push(...loader.save(plan.files, plan.rebuildLanguages, context.paths))
        break
      }
    }
  }
  for (const stage of stages) {
    log(`[${context.config.version}:${stage}] 开始`)
    try { await run(stage) }
    catch (error) { throw new Error(`[${context.config.version}:${stage}] ${error instanceof Error ? error.message : String(error)}`, { cause: error }) }
  }
  return { targets: plan.targets, version: context.config.version, files, stages }
}
