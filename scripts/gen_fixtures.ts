import type { X4Module, X4Ware } from '../src/types/x4'
import modulesRaw from '../src/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import waresRaw from '../src/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import zhCNLocale from '../src/assets/x4_game_data/8.0-Diplomacy/locales/zh-CN.json'
import fs from 'fs'
import path from 'path'

interface SeedInput {
  wareId: string
  race: string
}

const SEEDS: SeedInput[] = [
  { wareId: 'hullparts', race: 'default' },
  { wareId: 'hullparts', race: 'teladi' },
  { wareId: 'claytronics', race: 'default' },
  { wareId: 'foodrations', race: 'argon' },
  { wareId: 'medicalsupplies', race: 'argon' }
]

function buildWaresMap(): Record<string, X4Ware> {
  const map: Record<string, X4Ware> = {}
  ;(waresRaw as any[]).forEach(w => {
    map[w.id] = {
      ...w,
      price: w.price || 0,
      minPrice: w.minPrice || 0,
      maxPrice: w.maxPrice || 0
    }
  })
  return map
}

function buildModulesMap(): Record<string, X4Module> {
  const map: Record<string, X4Module> = {}
  ;(modulesRaw as any[]).forEach(m => {
    if(!m.isPlayerBlueprint) return
    map[m.id] = {
      ...m,
      buildCost: m.buildCost || {},
      outputs: m.outputs || {},
      inputs: m.inputs || {},
      cycleTime: m.cycleTime || 0,
      workforce: {
        capacity: m.workforce?.capacity || 0,
        needed: m.workforce?.needed || 0,
        maxBonus: m.workforce?.maxBonus || 0
      }
    }
  })
  return map
}

function buildModulesByOutputMap(modulesMap: Record<string, X4Module>): Record<string, X4Module[]> {
  const outputMap: Record<string, X4Module[]> = {}
  Object.values(modulesMap).forEach(module => {
    Object.keys(module.outputs).forEach(wareId => {
      if (!outputMap[wareId]) {
        outputMap[wareId] = []
      }
      outputMap[wareId].push(module)
    })
  })
  return outputMap
}

function findModuleForWare(
  wareId: string,
  lineage: string,
  modulesByOutputMap: Record<string, X4Module[]>
): X4Module | null {
  const producers = modulesByOutputMap[wareId] || []
  if (producers.length === 0) return null

  let found = producers.find(m => m.race === lineage)
  if (found) return found

  found = producers.find(m => m.method === lineage)
  if (found) return found

  if (lineage === 'teladi') {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  found = producers.find(m => m.method === 'default')
  if (found) return found

  const agriRaces = ['argon', 'boron', 'paranid', 'split']
  if (agriRaces.includes(lineage)) {
    found = producers.find(m => m.race === 'default')
    if (found) return found
  }

  return producers[0] || null
}

function traceWareDependencies(
  seeds: SeedInput[],
  waresMap: Record<string, X4Ware>,
  modulesByOutputMap: Record<string, X4Module[]>
): { modules: Set<string>; wares: Set<string> } {
  const collectedModules = new Set<string>()
  const collectedWares = new Set<string>()
  const visitedTraces = new Set<string>()

  function trace(wareId: string, race: string) {
    const traceKey = `${wareId}:${race}`
    if (visitedTraces.has(traceKey)) return
    visitedTraces.add(traceKey)

    const ware = waresMap[wareId]
    if (!ware) return

    collectedWares.add(wareId)

    const module = findModuleForWare(wareId, race, modulesByOutputMap)
    if (!module) return

    collectedModules.add(module.id)

    if (module.inputs) {
      Object.keys(module.inputs).forEach((inputWareId) => {
        trace(inputWareId, race)
      })
    }
  }

  seeds.forEach((seed) => {
    trace(seed.wareId, seed.race)
  })

  return { modules: collectedModules, wares: collectedWares }
}

function getCNName(nameId: string): string {
  if (!nameId) return ''
  return (zhCNLocale as Record<string, string>)[nameId] || ''
}

function toYAMLValue(value: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent)
  if (value === null || value === undefined) {
    return 'null'
  }
  if (typeof value === 'string') {
    if (value.includes(':') || value.includes('#') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`
    }
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return value.map((item) => `\n${spaces}- ${toYAMLValue(item, indent + 1)}`).join('')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return entries.map(([k, v]) => `\n${spaces}${k}: ${toYAMLValue(v, indent + 1)}`).join('')
  }
  return String(value)
}

function toYAML(obj: any): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      value.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          lines.push(`  - ${toYAMLObject(item, 2)}`)
        } else {
          lines.push(`  - ${toYAMLValue(item, 1)}`)
        }
      })
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:${toYAMLValue(value, 1)}`)
    } else {
      lines.push(`${key}: ${toYAMLValue(value, 0)}`)
    }
  }
  return lines.join('\n')
}

function toYAMLObject(obj: Record<string, any>, baseIndent: number): string {
  const spaces = '  '.repeat(baseIndent)
  const lines: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const subLines = toYAMLObject(value, baseIndent + 1)
      lines.push(`${key}:\n${spaces}  ${subLines}`)
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        value.forEach((item) => {
          if (typeof item === 'object' && item !== null) {
            lines.push(`${spaces}  - ${toYAMLObject(item, baseIndent + 2)}`)
          } else {
            lines.push(`${spaces}  - ${toYAMLValue(item, baseIndent + 2)}`)
          }
        })
      }
    } else {
      lines.push(`${key}: ${toYAMLValue(value, baseIndent)}`)
    }
  }
  return lines.join(`\n${spaces}`)
}

interface ModuleFixture {
  id: string
  module: string
  name: string
  nameCN: string
  tier: number
  group: string
  race: string
  method: string
  inputs: Record<string, number>
  outputs: Record<string, number>
}

interface WareFixture {
  id: string
  name: string
  nameCN: string
  price: number
  volume: number
  tier: number
}

function generateModuleFixtures(
  moduleIds: Set<string>,
  modulesMap: Record<string, X4Module>
): ModuleFixture[] {
  const fixtures: ModuleFixture[] = []

  moduleIds.forEach((moduleId) => {
    const module = modulesMap[moduleId]
    if (module) {
      fixtures.push({
        id: module.id,
        module: module.name,
        name: module.name,
        nameCN: getCNName(module.nameId),
        tier: module.tier,
        group: module.group,
        race: module.race,
        method: module.method || 'default',
        inputs: module.inputs || {},
        outputs: module.outputs || {}
      })
    }
  })

  return fixtures.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    return a.id.localeCompare(b.id)
  })
}

function generateWareFixtures(wareIds: Set<string>, waresMap: Record<string, X4Ware>): WareFixture[] {
  const fixtures: WareFixture[] = []

  wareIds.forEach((wareId) => {
    const ware = waresMap[wareId]
    if (ware && ware.tier !== null) {
      fixtures.push({
        id: ware.id,
        name: ware.name,
        nameCN: getCNName(ware.nameId),
        price: ware.price,
        volume: ware.volume,
        tier: ware.tier
      })
    }
  })

  return fixtures.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    return a.id.localeCompare(b.id)
  })
}

function writeYAMLFile(filename: string, data: any): void {
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures')
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }

  const yamlContent = toYAML(data)
  const outputPath = path.join(fixturesDir, filename)
  fs.writeFileSync(outputPath, yamlContent, 'utf-8')
  console.log(`✅ Written: ${outputPath}`)
}

async function main(): Promise<void> {
  console.log('🚀 Generating fixtures...')
  console.log(`📌 Seeds: ${SEEDS.map((s) => `[${s.wareId}, ${s.race}]`).join(', ')}`)

  const modulesMap = buildModulesMap()
  const waresMap = buildWaresMap()
  const modulesByOutputMap = buildModulesByOutputMap(modulesMap)

  const { modules: moduleIds, wares: wareIds } = traceWareDependencies(SEEDS, waresMap, modulesByOutputMap)

  const moduleFixtures = generateModuleFixtures(moduleIds, modulesMap)
  const wareFixtures = generateWareFixtures(wareIds, waresMap)

  writeYAMLFile('module_fixtures.yaml', { modules: moduleFixtures })
  writeYAMLFile('ware_fixtures.yaml', { wares: wareFixtures })

  console.log(`\n📊 Summary:`)
  console.log(`   Modules: ${moduleFixtures.length}`)
  console.log(`   Wares: ${wareFixtures.length}`)
  console.log('\n✨ Done!')
}

const isMainModule = import.meta.url.startsWith('file:')
const runningAsScript =
  process.argv[1] &&
  (process.argv[1].endsWith('gen_fixtures.ts') || process.argv[1].endsWith('gen_fixtures.js'))

if (isMainModule && runningAsScript) {
  main().catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
}

export { generateModuleFixtures, generateWareFixtures, SEEDS, traceWareDependencies }
