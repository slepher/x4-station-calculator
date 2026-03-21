#!/usr/bin/env tsx

import { existsSync, createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import mapsData from '../src/assets/x4_game_data/8.0-Diplomacy/data/maps.json'
import regionYieldsData from '../src/assets/x4_game_data/8.0-Diplomacy/data/regionyields.json'
import regionsData from '../src/assets/x4_game_data/8.0-Diplomacy/data/regions.json'
import resourceAreasData from '../src/assets/x4_game_data/8.0-Diplomacy/data/resourceareas.json'
import {
  aggregateSectorWithRegions,
  aggregateToTotal,
  buildSectorJson,
  extractSectorResourceXmlFromComponentXml,
  extractSectorResourcesFromComponentXml,
  loadMapsSectors,
  type ExtractContext,
  type SectorJsonData
} from '../src/utils/saveResourceExtract'

const PROJECT_ROOT = process.cwd()
const SAVE_DATA_DIR = path.join(PROJECT_ROOT, 'save_data')

const context: ExtractContext = {
  mapsData,
  regionYieldsData,
  regionsData,
  resourceAreasData
}

function printUsage(): void {
  console.log('Usage:')
  console.log('  tsx scripts/extract_resources.tsx <save_file> --sector <sector_macro>')
  console.log('  tsx scripts/extract_resources.tsx <save_file> --xml <sector_macro>')
  console.log('  tsx scripts/extract_resources.tsx <save_file> --xml-all')
  console.log('  tsx scripts/extract_resources.tsx <save_file> --all')
  console.log('  tsx scripts/extract_resources.tsx <save_file> --aggregate')
}

async function ensureOutputDir(saveName: string): Promise<string> {
  const outputDir = path.join(SAVE_DATA_DIR, saveName)
  await mkdir(outputDir, { recursive: true })
  return outputDir
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

async function writeSectorJson(
  saveName: string,
  sectorName: string,
  data: SectorJsonData
): Promise<void> {
  const outputDir = await ensureOutputDir(saveName)
  const outputFile = path.join(outputDir, `${sectorName.toLowerCase()}.json`)
  await writeJson(outputFile, data)

  const totalResources = Object.values(data.ware).reduce(
    (sum, resources) => sum + resources.length,
    0
  )

  console.log(`Saved ${Object.keys(data.ware).length} wares, ${totalResources} resources to ${outputFile}`)
}

async function writeSectorXml(saveName: string, sectorName: string, xml: string): Promise<void> {
  const outputDir = await ensureOutputDir(saveName)
  const outputFile = path.join(outputDir, `${sectorName.toLowerCase()}_resources.xml`)
  await writeFile(outputFile, `${xml}\n`, 'utf-8')
  console.log(`Saved XML to ${outputFile}`)
}

async function loadSectorJsonList(saveName: string): Promise<SectorJsonData[]> {
  const saveDir = path.join(SAVE_DATA_DIR, saveName)
  const files = (await readdir(saveDir)).filter(
    (file) => file.endsWith('.json') && file !== 'total.json'
  )
  const sectors: SectorJsonData[] = []

  for (const fileName of files.sort()) {
    const filePath = path.join(saveDir, fileName)
    const content = await readFile(filePath, 'utf-8')
    sectors.push(JSON.parse(content) as SectorJsonData)
  }

  return sectors
}

async function aggregateAndWriteTotal(saveName: string): Promise<void> {
  const sectors = await loadSectorJsonList(saveName)
  const outputDir = await ensureOutputDir(saveName)

  // Process each sector and update with regions
  const totalSectors = []
  for (const sectorData of sectors) {
    const result = aggregateSectorWithRegions(sectorData, context)

    // Write updated sector JSON with regions
    const sectorFile = path.join(outputDir, `${sectorData.sector_id}.json`)
    await writeJson(sectorFile, result.sectorJson)

    totalSectors.push(result.totalJson)
  }

  // Write total.json
  const totalJson = { sectors: totalSectors }
  const totalFile = path.join(outputDir, 'total.json')
  await writeJson(totalFile, totalJson)
  console.log(`Saved ${totalJson.sectors.length} sectors to ${totalFile}`)
}

function extractSectorMacro(line: string): string | null {
  if (!line.includes('<component') || !line.includes('class="sector"')) {
    return null
  }

  const macroMatch = /\bmacro="([^"]+)"/i.exec(line)
  return macroMatch?.[1]?.toLowerCase() ?? null
}

async function streamSectorComponents(
  saveFile: string,
  targetSectors: Set<string> | null,
  onSector: (sectorMacro: string, componentXml: string) => Promise<void> | void
): Promise<void> {
  const input = createReadStream(saveFile, { encoding: 'utf-8' })
  const rl = readline.createInterface({ input, crlfDelay: Infinity })

  let activeSector: string | null = null
  let activeLines: string[] = []
  const seen = new Set<string>()

  for await (const line of rl) {
    if (!activeSector) {
      const sectorMacro = extractSectorMacro(line)
      if (!sectorMacro) {
        continue
      }
      if (targetSectors && !targetSectors.has(sectorMacro)) {
        continue
      }
      activeSector = sectorMacro
      activeLines = [line]
      continue
    }

    activeLines.push(line)
    if (!line.includes('</component>')) {
      continue
    }

    await onSector(activeSector, activeLines.join('\n'))
    seen.add(activeSector)
    activeSector = null
    activeLines = []

    if (targetSectors && seen.size >= targetSectors.size) {
      rl.close()
      break
    }
  }
}

async function main(): Promise<void> {
  const [, , saveFile, mode, modeArg] = process.argv

  if (!saveFile || !mode) {
    printUsage()
    process.exit(1)
  }

  if (!existsSync(saveFile)) {
    console.error(`Error: Save file '${saveFile}' not found.`)
    process.exit(1)
  }

  const saveName = path.parse(saveFile).name

  if (mode === '--sector') {
    if (!modeArg) {
      console.error('Error: Missing sector macro name')
      process.exit(1)
    }

    console.log(`Extracting ${modeArg} to JSON...`)
    let found = false
    await streamSectorComponents(saveFile, new Set([modeArg.toLowerCase()]), async (sectorMacro, componentXml) => {
      found = true
      const points = extractSectorResourcesFromComponentXml(componentXml, context)
      console.log(`Found ${points.length} resource entries`)
      await writeSectorJson(saveName, sectorMacro, buildSectorJson(points, sectorMacro))
    })
    if (!found) {
      console.error(`Sector ${modeArg} not found.`)
      process.exit(1)
    }
    return
  }

  if (mode === '--xml') {
    if (!modeArg) {
      console.error('Error: Missing sector macro name')
      process.exit(1)
    }

    console.log(`Extracting ${modeArg} to XML...`)
    let found = false
    await streamSectorComponents(saveFile, new Set([modeArg.toLowerCase()]), async (sectorMacro, componentXml) => {
      const xml = extractSectorResourceXmlFromComponentXml(componentXml, sectorMacro)
      if (!xml) {
        return
      }
      found = true
      await writeSectorXml(saveName, sectorMacro, xml)
    })
    if (!found) {
      console.error(`Sector ${modeArg} not found or has no resourceareas.`)
      process.exit(1)
    }
    return
  }

  if (mode === '--xml-all') {
    const sectors = loadMapsSectors(context)
    console.log(`Extracting XML from ${saveFile}`)
    console.log(`Found ${sectors.length} sectors in maps.json`)
    let index = 0
    await streamSectorComponents(saveFile, new Set(sectors), async (sectorMacro, componentXml) => {
      index += 1
      console.log(`[${index}/${sectors.length}] Processing ${sectorMacro}...`)
      const xml = extractSectorResourceXmlFromComponentXml(componentXml, sectorMacro)
      if (xml) {
        await writeSectorXml(saveName, sectorMacro, xml)
      } else {
        console.log(`No resourceareas found in ${sectorMacro}`)
      }
    })
    return
  }

  if (mode === '--all') {
    const sectors = loadMapsSectors(context)
    console.log(`Extracting from ${saveFile}`)
    console.log(`Found ${sectors.length} sectors in maps.json`)
    let index = 0
    await streamSectorComponents(saveFile, new Set(sectors), async (sectorMacro, componentXml) => {
      index += 1
      console.log(`[${index}/${sectors.length}] Processing ${sectorMacro}...`)
      const points = extractSectorResourcesFromComponentXml(componentXml, context)
      if (points.length > 0) {
        await writeSectorJson(saveName, sectorMacro, buildSectorJson(points, sectorMacro))
      } else {
        console.log(`No resources found in ${sectorMacro}`)
      }
    })

    console.log('--- Aggregating to total.json ---')
    await aggregateAndWriteTotal(saveName)
    return
  }

  if (mode === '--aggregate') {
    await aggregateAndWriteTotal(saveName)
    return
  }

  console.error(`Error: Unknown mode '${mode}'`)
  process.exit(1)
}

void main()
