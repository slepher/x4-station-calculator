import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import versionsData from '../src/assets/versions.json'
import type { VersionsFile, X4Map, SectorReachability } from '../src/types/x4'
import { breadthFirstReachable, buildSectorGraph } from '../src/store/logic/mapSectorGraph'

const MAX_REACHABILITY_JUMP = 5
const require = createRequire(import.meta.url)
const getopts = require('getopts') as (
  argv: string[],
  options: {
    alias?: Record<string, string>
    boolean?: string[]
    string?: string[]
  }
) => Record<string, unknown> & { _: string[] }

function printHelp(): void {
  console.log('Usage: vite-node scripts/generate_sector_reachability.ts --version <version>')
  console.log('')
  console.log('Generate versioned X4 sector reachability cache.')
  console.log('')
  console.log('Options:')
  console.log('  -h, --help         Show this help message and exit')
  console.log('  --version <v>      Target game version, e.g. "8.0" or "9.0"')
}

function parseArgs(): { help: boolean; version: string } {
  const rawArgv = process.argv.slice(2)
  const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv
  const opts = getopts(argv, {
    alias: { h: 'help' },
    boolean: ['help'],
    string: ['version']
  })
  return {
    help: Boolean(opts.help),
    version: String(opts.version || '')
  }
}

function resolveFolderName(version: string): string {
  const versions = versionsData as VersionsFile
  const config = versions.versions.find((item) => item.version === version && item.beta === false)
    || versions.versions.find((item) => item.version === version)
  if (!config) {
    throw new Error(`Unknown version '${version}' in src/assets/versions.json`)
  }
  return config.folder_name
}

function stableReachability(source: SectorReachability): SectorReachability {
  const result: SectorReachability = {}
  for (const sourceMacro of Object.keys(source).sort()) {
    const targets = source[sourceMacro]!
    const sortedTargets: Record<string, number> = {}
    for (const targetMacro of Object.keys(targets).sort((a, b) => targets[a]! - targets[b]! || a.localeCompare(b))) {
      sortedTargets[targetMacro] = targets[targetMacro]!
    }
    result[sourceMacro] = sortedTargets
  }
  return result
}

function main(): void {
  const args = parseArgs()
  if (args.help) {
    printHelp()
    return
  }
  if (!args.version) {
    printHelp()
    process.exitCode = 1
    return
  }

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const folderName = resolveFolderName(args.version)
  const dataDir = path.join(rootDir, 'src', 'assets', 'x4_game_data', folderName, 'data')
  const mapsPath = path.join(dataDir, 'maps.json')
  if (!fs.existsSync(mapsPath)) {
    throw new Error(`Missing maps.json for version '${args.version}': ${mapsPath}`)
  }

  const maps = JSON.parse(fs.readFileSync(mapsPath, 'utf8')) as X4Map
  const { graph, sectorClusterMap } = buildSectorGraph(maps.clusters, maps.sectors)
  const reachability: SectorReachability = {}
  let targetCount = 0

  for (const sectorMacro of Object.keys(maps.sectors).sort()) {
    const distances = breadthFirstReachable(graph, sectorMacro, MAX_REACHABILITY_JUMP, sectorClusterMap)
    reachability[sectorMacro] = distances
    targetCount += Object.keys(distances).length
  }

  const outputPath = path.join(dataDir, 'sector_reachability.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(stableReachability(reachability), null, 2)}\n`)

  console.log(`Generated sector reachability for ${args.version} (${folderName})`)
  console.log(`Sources: ${Object.keys(reachability).length}`)
  console.log(`Targets: ${targetCount}`)
  console.log(`Output: ${outputPath}`)
}

main()
