import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { stringify } from 'yaml'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'src/assets/x4_game_data/8.0-Diplomacy/data')
const OUTPUT_PATH = path.join(ROOT, 'tests/seeds/logic-flow.yaml')

type X4Ware = {
  id: string
  group: string
  tier: number
}

type X4Module = {
  id: string
  race: string
  outputs: Record<string, number>
  inputs: Record<string, number>
}

type SeedNode = {
  moduleId?: string
  wareId?: string
  isIsolated: boolean
}

type SeedGroup = {
  name: string
  category: 'industrial' | 'agricultural'
  subCategory: string
  isLocked: boolean
  lockedLineage: string
  nodes: SeedNode[]
}

type SeedPlan = {
  name: string
  groups: SeedGroup[]
}

type Seed = {
  plans: SeedPlan[]
}

const loadJson = async <T,>(file: string): Promise<T> => {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw) as T
}

const findModuleByOutput = (modules: X4Module[], wareId: string, preferredRace?: string): X4Module | undefined => {
  const matches = modules.filter((m) => m.outputs && Object.prototype.hasOwnProperty.call(m.outputs, wareId))
  if (preferredRace) {
    const preferred = matches.find((m) => m.race === preferredRace)
    if (preferred) return preferred
  }
  const defaultRace = matches.find((m) => m.race === 'default')
  return defaultRace ?? matches[0]
}

const pickPrimaryOutput = (module: X4Module): string => {
  const keys = Object.keys(module.outputs ?? {})
  if (keys.length === 0) {
    throw new Error(`Module ${module.id} has no outputs.`)
  }
  return keys[0]
}

const isAgriculturalGroup = (wareGroup: string): boolean => {
  return ['agricultural', 'food', 'pharmaceutical', 'water', 'ice'].includes(wareGroup)
}

const main = async () => {
  const wares = await loadJson<X4Ware[]>(path.join(DATA_DIR, 'wares.json'))
  const modules = await loadJson<X4Module[]>(path.join(DATA_DIR, 'modules.json'))

  const wareById = new Map(wares.map((ware) => [ware.id, ware]))

  // Resolved ids via agent search (no locale lookup in script)
  const claytronicsId = 'claytronics'
  const hullpartsId = 'hullparts'
  const quantumtubesId = 'quantumtubes'
  const foodrationsId = 'foodrations'
  const medicalsuppliesId = 'medicalsupplies'

  const claytronicsModule = findModuleByOutput(modules, claytronicsId, 'default')
  const hullpartsModule = findModuleByOutput(modules, hullpartsId, 'default')
  const quantumtubesModule = findModuleByOutput(modules, quantumtubesId, 'default')
  const foodrationsModule = findModuleByOutput(modules, foodrationsId, 'argon')
  const medicalsuppliesModule = findModuleByOutput(modules, medicalsuppliesId, 'argon')

  if (!claytronicsModule || !hullpartsModule || !quantumtubesModule || !foodrationsModule || !medicalsuppliesModule) {
    throw new Error('Missing required production modules for seed generation.')
  }

  const shiptechT3Wares = wares
    .filter((ware) => ware.group === 'shiptech' && ware.tier === 3 && ware.id !== claytronicsId)
    .map((ware) => ware.id)

  const shiptechModules = shiptechT3Wares
    .map((wareId) => ({
      wareId,
      module: findModuleByOutput(modules, wareId, 'default')
    }))
    .filter((entry) => entry.module)

  const upstreamT2Wares = new Set<string>()
  shiptechModules.forEach((entry) => {
    const module = entry.module as X4Module
    Object.keys(module.inputs ?? {}).forEach((inputWareId) => {
      const ware = wareById.get(inputWareId)
      if (ware && ware.tier === 2) {
        upstreamT2Wares.add(inputWareId)
      }
    })
  })

  const buildManualNode = (module: X4Module): SeedNode => ({
    moduleId: module.id,
    isIsolated: false
  })

  const buildIsolatedNode = (wareId: string): SeedNode => ({
    wareId,
    isIsolated: true
  })

  const buildGroup = (name: string, modulesInGroup: X4Module[], isolatedWares: string[]): SeedGroup => {
    const manualNodes = modulesInGroup.map((module) => buildManualNode(module))
    const isolatedNodes = isolatedWares.map((wareId) => buildIsolatedNode(wareId))

    const allWareIds = [
      ...modulesInGroup.map((module) => pickPrimaryOutput(module)),
      ...isolatedWares
    ]

    const isAgri = allWareIds.some((wareId) => {
      const ware = wareById.get(wareId)
      return ware ? isAgriculturalGroup(ware.group) : false
    })

    return {
      name,
      category: isAgri ? 'agricultural' : 'industrial',
      subCategory: isAgri ? 'argon' : 'default',
      isLocked: true,
      lockedLineage: 'default',
      nodes: [...manualNodes, ...isolatedNodes]
    }
  }

  const plans: SeedPlan[] = [
    {
      name: 'Logic Flow 1',
      groups: [
        buildGroup('E1-S1', [claytronicsModule, hullpartsModule], [quantumtubesId]),
        buildGroup('E1-S2', [quantumtubesModule], []),
        buildGroup('E1-S3', [foodrationsModule, medicalsuppliesModule], [])
      ]
    },
    {
      name: 'Logic Flow 2',
      groups: [
        buildGroup(
          'E2-S1',
          shiptechModules.map((entry) => entry.module as X4Module),
          Array.from(upstreamT2Wares).sort()
        ),
        buildGroup('E2-S2', [claytronicsModule, hullpartsModule], [])
      ]
    },
    {
      name: 'Logic Flow 3 - 双星区中转测试',
      groups: [
        buildGroup('生产站', [hullpartsModule, claytronicsModule], []),
        buildGroup('补给站', [medicalsuppliesModule, foodrationsModule], [])
      ]
    }
  ]

  const seed: Seed = { plans }

  const content = stringify(seed, { indent: 2 })
  await writeFile(OUTPUT_PATH, content, 'utf8')
  console.log(content)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
