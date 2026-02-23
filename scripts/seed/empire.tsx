import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { stringify } from 'yaml'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'src/assets/x4_game_data/8.0-Diplomacy/data')
const OUTPUT_PATH = path.join(ROOT, 'tests/seeds/empire.yaml')

type X4Ware = {
  id: string
  name: string
  group: string
  tier: number
}

type X4Module = {
  id: string
  name: string
  race: string
  outputs: Record<string, number>
  inputs: Record<string, number>
}

type SeedModule = {
  id: string
  count: number
}

type SeedStation = {
  name: string
  settings: Record<string, boolean>
  modules: SeedModule[]
  lockedWares?: string[]
}

type SeedEmpire = {
  name: string
  stations: SeedStation[]
}

type Seed = {
  empires: SeedEmpire[]
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

  const seed: Seed = {
    empires: [
      {
        name: 'Empire 1',
        stations: [
          {
            name: 'E1-S1',
            settings: {
              workforceAuto: true
            },
            lockedWares: [quantumtubesId],
            modules: [
              {
                id: claytronicsModule.id,
                count: 6
              },
              {
                id: hullpartsModule.id,
                count: 12
              }
            ]
          },
          {
            name: 'E1-S2',
            settings: {
              workforceAuto: true,
              showEmpireGaps: true
            },
            modules: [
              {
                id: quantumtubesModule.id,
                count: 4
              }
            ]
          },
          {
            name: 'E1-S3',
            settings: {
              workforceAuto: true
            },
            modules: [
              {
                id: foodrationsModule.id,
                count: 5
              },
              {
                id: medicalsuppliesModule.id,
                count: 9
              }
            ]
          }
        ]
      },
      {
        name: 'Empire 2',
        stations: [
          {
            name: 'E2-S1',
            settings: {
              workforceAuto: true
            },
            lockedWares: Array.from(upstreamT2Wares).sort(),
            modules: shiptechModules.map((entry) => {
              const module = entry.module as X4Module
              return {
                id: module.id,
                count: 1
              }
            })
          },
          {
            name: 'E2-S2',
            settings: {
              workforceAuto: true
            },
            modules: [
              {
                id: claytronicsModule.id,
                count: 1
              },
              {
                id: hullpartsModule.id,
                count: 1
              }
            ]
          }
        ]
      }
    ]
  }

  const content = stringify(seed, { indent: 2 })
  await writeFile(OUTPUT_PATH, content, 'utf8')
  console.log(content)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
