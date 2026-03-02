import { writeFile, mkdir } from 'node:fs/promises'
import { stringify } from 'yaml'

const OUTPUT_DIR = 'tests/seeds'
const OUTPUT_PATH = `${OUTPUT_DIR}/ship-blueprint.yaml`

type SeedShip = {
  id: string
  name: string
  class: string
  type: string
  race: string
  blueprint: SeedBlueprint | null
}

type SeedBlueprintGroup = {
  group: string
  equipment_id: string
  shield?: {
    equipment_id: string
  }
}

type SeedBlueprintSize = {
  size: string
  equipment_id: string
  shield?: {
    equipment_id: string
  }
}

type SeedBlueprintConnectionByGroup = {
  slot_type: string
  group: SeedBlueprintGroup[]
}

type SeedBlueprintConnectionBySize = {
  slot_type: string
  size: SeedBlueprintSize[]
}

type SeedBlueprintConnectionBySlot = {
  slot_type: string
  equipment_id: string
  shield?: {
    equipment_id: string
  }
}

type SeedBlueprintConnection =
  | SeedBlueprintConnectionByGroup
  | SeedBlueprintConnectionBySize
  | SeedBlueprintConnectionBySlot

type SeedBlueprint = {
  shipId: string
  connections: SeedBlueprintConnection[]
}

type Seed = {
  ships: SeedShip[]
}

const main = async () => {
  const seed: Seed = {
    ships: [
      {
        id: 'ship_ter_m_corvette_01_a',
        name: 'Katana',
        class: 'ship_m',
        type: 'corvette',
        race: 'terran',
        blueprint: {
          shipId: 'ship_ter_m_corvette_01_a',
          connections: [
            { slot_type: 'engine', equipment_id: 'engine_ter_m_combat_01_mk3' },
            { slot_type: 'thruster', equipment_id: 'thruster_gen_m_combat_01_mk3' },
            { slot_type: 'shield', equipment_id: 'shield_ter_m_standard_01_mk3' },
            { slot_type: 'weapon', equipment_id: 'weapon_ter_m_beam_01_mk2' },
            { slot_type: 'turret', equipment_id: 'turret_arg_m_flak_01_mk1' }
          ]
        }
      },
      {
        id: 'ship_ter_m_corvette_02_a',
        name: 'Odachi',
        class: 'ship_m',
        type: 'corvette',
        race: 'terran',
        blueprint: {
          shipId: 'ship_ter_m_corvette_02_a',
          connections: [
            { slot_type: 'engine', equipment_id: 'engine_ter_m_virtual_01_mk1' },
            { slot_type: 'thruster', equipment_id: 'thruster_gen_m_combat_01_mk3' },
            { slot_type: 'shield', equipment_id: 'shield_ter_m_virtual_01_mk3' },
            { slot_type: 'weapon', equipment_id: 'weapon_ter_m_laser_02_mk1' },
            { slot_type: 'turret', equipment_id: 'turret_ter_m_laser_03_mk1' }
          ]
        }
      },
      {
        id: 'ship_ter_l_destroyer_01_a',
        name: 'Osaka',
        class: 'ship_l',
        type: 'destroyer',
        race: 'terran',
        blueprint: {
          shipId: 'ship_ter_l_destroyer_01_a',
          connections: [
            {
              slot_type: 'engine',
              equipment_id: 'engine_ter_l_allround_01_mk1',
              shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
            },
            { slot_type: 'thruster', equipment_id: 'thruster_gen_l_allround_01_mk3' },
            { slot_type: 'shield', equipment_id: 'shield_ter_l_standard_01_mk3' },
            { slot_type: 'weapon', equipment_id: 'weapon_ter_l_destroyer_01_mk1' },
            {
              slot_type: 'turret',
              size: [
                {
                  size: 'large',
                  equipment_id: 'turret_arg_l_plasma_01_mk1',
                  shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
                },
                {
                  size: 'medium',
                  equipment_id: 'turret_arg_m_flak_01_mk1',
                  shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
                }
              ]
            }
          ]
        }
      },
      {
        id: 'ship_ter_l_destroyer_01_a',
        name: 'Osaka 2',
        class: 'ship_l',
        type: 'destroyer',
        race: 'terran',
        blueprint: {
          shipId: 'ship_ter_l_destroyer_01_a',
          connections: [
            {
              slot_type: 'engine',
              equipment_id: 'engine_ter_l_allround_01_mk1',
              shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
            },
            { slot_type: 'thruster', equipment_id: 'thruster_gen_l_allround_01_mk1' },
            { slot_type: 'shield', equipment_id: 'shield_ter_l_standard_01_mk3' },
            { slot_type: 'weapon', equipment_id: 'weapon_ter_l_destroyer_01_mk1' },
            {
              slot_type: 'turret',
              size: [
                {
                  size: 'large',
                  equipment_id: 'turret_ter_l_beam_01_mk1',
                  shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
                },
                {
                  size: 'medium',
                  equipment_id: 'turret_tel_l_plasma_01_mk1',
                  shield: { equipment_id: 'shield_ter_m_standard_01_mk3' }
                }
              ]
            }
          ]
        }
      }
    ]
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  const content = stringify(seed, { indent: 2 })
  await writeFile(OUTPUT_PATH, content, 'utf8')
  console.log(content)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
