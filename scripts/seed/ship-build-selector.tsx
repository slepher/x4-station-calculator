import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { stringify } from 'yaml'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'src/assets/x4_game_data/8.0-Diplomacy/data')
const OUTPUT_DIR = path.join(ROOT, 'tests/seeds')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'ship-build-selector.yaml')

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
  count: number
  shield?: {
    equipment_id: string
    count: number
  }
}

type SeedBlueprintConnection = {
  slot_type: string
  group: SeedBlueprintGroup[]
}

type SeedBlueprint = {
  shipId: string
  connections: SeedBlueprintConnection[]
}

type Seed = {
  ships: SeedShip[]
}

const loadJson = async <T,>(file: string): Promise<T> => {
  const raw = await readFile(file, 'utf8')
  return JSON.parse(raw) as T
}

const main = async () => {
  const ships = await loadJson<any[]>(path.join(DATA_DIR, 'ships.json'))

  const katana = ships.find(s => s.id === 'ship_ter_m_corvette_01_a')
  const odachi = ships.find(s => s.id === 'ship_ter_m_corvette_02_a')
  const osaka = ships.find(s => s.id === 'ship_ter_l_destroyer_01_a')

  if (!katana || !odachi || !osaka) {
    throw new Error('Ships not found')
  }

  // ============ Katana (original) ============
  const katanaBlueprint: SeedBlueprint = {
    shipId: katana.id,
    connections: []
  }
  katana.slots.forEach(slot => {
    const connGroups: SeedBlueprintGroup[] = []
    slot.groups.forEach(g => {
      let equipmentId = ''
      if (slot.type === 'engine') equipmentId = 'engine_ter_m_combat_01_mk3'
      else if (slot.type === 'weapon') equipmentId = 'weapon_ter_m_beam_01_mk2'
      else if (slot.type === 'shield') equipmentId = 'shield_ter_m_standard_01_mk3'
      else if (slot.type === 'turret') equipmentId = 'turret_arg_m_flak_01_mk1'
      else if (slot.type === 'thruster') equipmentId = 'thruster_gen_m_combat_01_mk3'
      if (equipmentId) {
        connGroups.push({ group: g.group, equipment_id: equipmentId, count: g.connection.count })
      }
    })
    if (connGroups.length > 0) {
      katanaBlueprint.connections.push({ slot_type: slot.type, group: connGroups })
    }
  })

  // ============ Odachi (大太刀) ============
  // 引擎: engine_ter_m_allround_01_mk1 x1
  // 推进器: thruster_gen_m_allround_01_mk1 x1
  // 护盾: shield_ter_m_standard_02_mk2 x2
  // 武器: weapon_ter_m_beam_01_mk2 x4
  // 炮塔: turret_ter_m_beam_01_mk1 x2
  const odachiBlueprint: SeedBlueprint = {
    shipId: odachi.id,
    connections: [
      {
        slot_type: 'engine',
        group: [{ group: 'con_engine_01', equipment_id: 'engine_ter_m_allround_01_mk1', count: 1 }]
      },
      {
        slot_type: 'thruster',
        group: [{ group: 'thruster', equipment_id: 'thruster_gen_m_allround_01_mk1', count: 1 }]
      },
      {
        slot_type: 'shield',
        group: [
          { group: 'con_shield_01', equipment_id: 'shield_ter_m_standard_02_mk2', count: 2 },
          { group: 'con_shield_02', equipment_id: 'shield_ter_m_standard_02_mk2', count: 2 }
        ]
      },
      {
        slot_type: 'weapon',
        group: [
          { group: 'con_weapon_01', equipment_id: 'weapon_ter_m_beam_01_mk2', count: 4 },
          { group: 'con_weapon_02', equipment_id: 'weapon_ter_m_beam_01_mk2', count: 4 },
          { group: 'con_weapon_03', equipment_id: 'weapon_ter_m_beam_01_mk2', count: 4 },
          { group: 'con_weapon_04', equipment_id: 'weapon_ter_m_beam_01_mk2', count: 4 }
        ]
      },
      {
        slot_type: 'turret',
        group: [
          { group: 'con_turret_m_01', equipment_id: 'turret_ter_m_beam_01_mk1', count: 2 },
          { group: 'con_turret_m_02', equipment_id: 'turret_ter_m_beam_01_mk1', count: 2 }
        ]
      }
    ]
  }

  // ============ Osaka (original) ============
  const osakaBlueprint: SeedBlueprint = {
    shipId: osaka.id,
    connections: []
  }
  osaka.slots.forEach(slot => {
    const connGroups: SeedBlueprintGroup[] = []
    slot.groups.forEach(g => {
      let equipmentId = ''
      if (slot.type === 'engine') {
        equipmentId = 'engine_ter_l_allround_01_mk1'
        if (g.connection.shield) {
          connGroups.push({
            group: g.group,
            equipment_id: equipmentId,
            count: g.connection.count,
            shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: g.connection.shield.count }
          })
          return
        }
      } else if (slot.type === 'weapon') {
        equipmentId = 'weapon_ter_l_destroyer_01_mk1'
      } else if (slot.type === 'shield') {
        equipmentId = 'shield_ter_l_standard_01_mk3'
      } else if (slot.type === 'turret') {
        equipmentId = 'turret_arg_m_flak_01_mk1'
        if (g.connection.shield) {
          connGroups.push({
            group: g.group,
            equipment_id: equipmentId,
            count: g.connection.count,
            shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: g.connection.shield.count }
          })
          return
        }
      } else if (slot.type === 'thruster') {
        equipmentId = 'thruster_gen_l_allround_01_mk3'
      }
      if (equipmentId) {
        connGroups.push({ group: g.group, equipment_id: equipmentId, count: g.connection.count })
      }
    })
    if (connGroups.length > 0) {
      osakaBlueprint.connections.push({ slot_type: slot.type, group: connGroups })
    }
  })

  // ============ Osaka 2 ============
  // 引擎: engine_ter_l_allround_01_mk1 x6
  // 推进器: thruster_gen_l_allround_01_mk1 x1
  // 护盾L: shield_ter_l_standard_01_mk3 x3 (全部挂满)
  // 护盾M挂载: shield_ter_m_standard_01_mk3 x24 (引擎8 + 炮塔16，全部挂满)
  // 武器: weapon_ter_l_destroyer_01_mk1 x6
  // 炮塔: turret_ter_l_beam_01_mk1 x6, turret_tel_l_plasma_01_mk1 x3, turret_ter_m_gatling_02_mk1 x8, turret_ter_m_laser_02_mk1 x10

  // 先收集所有 groups 及其护盾
  const osaka2ShieldGroups = new Map<string, { mk1: number, mk2: number }>()
  osaka.slots.filter(s => s.type === 'turret').forEach(slot => {
    slot.groups.forEach(g => {
      if (g.connection.shield) {
        const existing = osaka2ShieldGroups.get(g.group) || { mk1: 0, mk2: 0 }
        existing.mk1 += 16
        existing.mk2 += 20
        osaka2ShieldGroups.set(g.group, existing)
      }
    })
  })

  const osaka2TurretGroups: SeedBlueprintGroup[] = []
  osaka.slots.filter(s => s.type === 'turret').forEach(slot => {
    slot.groups.forEach(g => {
      const shieldInfo = osaka2ShieldGroups.get(g.group)
      osaka2TurretGroups.push({
        group: g.group,
        equipment_id: 'turret_ter_l_beam_01_mk1',
        count: g.connection.count,
        shield: shieldInfo ? { equipment_id: 'shield_ter_m_standard_02_mk1', count: shieldInfo.mk1 } : undefined
      })
    })
  })

  const osaka2Blueprint: SeedBlueprint = {
    shipId: osaka.id,
    connections: [
      {
        slot_type: 'engine',
        // 引擎: 2台，每台可挂4个护盾 = 8个Mk3
        group: [{ group: 'group_back_mid_mid', equipment_id: 'engine_ter_l_allround_01_mk1', count: 6, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 8 } }]
      },
      {
        slot_type: 'thruster',
        group: [{ group: 'thruster', equipment_id: 'thruster_gen_l_allround_01_mk1', count: 1 }]
      },
      {
        slot_type: 'shield',
        group: [
          // 专用护盾槽 (L): 每组最大1个，全部Mk3
          { group: 'con_shieldgen_l_01', equipment_id: 'shield_ter_l_standard_01_mk3', count: 1 },
          { group: 'con_shieldgen_l_02', equipment_id: 'shield_ter_l_standard_01_mk3', count: 1 },
          { group: 'con_shieldgen_l_03', equipment_id: 'shield_ter_l_standard_01_mk3', count: 1 }
        ]
      },
      {
        slot_type: 'weapon',
        group: [
          { group: 'con_weapon_01', equipment_id: 'weapon_ter_l_destroyer_01_mk1', count: 6 },
          { group: 'con_weapon_02', equipment_id: 'weapon_ter_l_destroyer_01_mk1', count: 6 }
        ]
      },
      {
        slot_type: 'turret',
        group: [
          // turret_ter_l_beam_01_mk1 x6, 护盾挂载Mk3 max=2 per turret
          { group: 'group_front_down_mid', equipment_id: 'turret_ter_l_beam_01_mk1', count: 1, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 2 } },
          { group: 'group_mid_right_up_2', equipment_id: 'turret_ter_l_beam_01_mk1', count: 1, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 2 } },
          { group: 'group_mid_up_left_2', equipment_id: 'turret_ter_l_beam_01_mk1', count: 1, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 2 } },
          { group: 'group_back_down_mid', equipment_id: 'turret_ter_l_beam_01_mk1', count: 1, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 1 } },
          { group: 'group_back_mid_up', equipment_id: 'turret_ter_l_beam_01_mk1', count: 1, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 1 } },
          { group: 'group_down_mid_left', equipment_id: 'turret_ter_l_beam_01_mk1', count: 2, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 2 } },
          // turret_tel_l_plasma_01_mk1 x3, 护盾挂载Mk3 max=1 per turret
          { group: 'group_down_mid_right', equipment_id: 'turret_tel_l_plasma_01_mk1', count: 2, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 1 } },
          { group: 'group_mid_right_up', equipment_id: 'turret_tel_l_plasma_01_mk1', count: 2, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 1 } },
          { group: 'group_mid_up_left', equipment_id: 'turret_tel_l_plasma_01_mk1', count: 2, shield: { equipment_id: 'shield_ter_m_standard_01_mk3', count: 1 } },
          // turret_ter_m_gatling_02_mk1 x8, 无护盾挂载
          { group: 'group_down_mid_left', equipment_id: 'turret_ter_m_gatling_02_mk1', count: 2 },
          { group: 'group_back_down_mid', equipment_id: 'turret_ter_m_gatling_02_mk1', count: 2 },
          { group: 'group_back_mid_up', equipment_id: 'turret_ter_m_gatling_02_mk1', count: 2 },
          { group: 'group_mid_up_left', equipment_id: 'turret_ter_m_gatling_02_mk1', count: 2 },
          // turret_ter_m_laser_02_mk1 x10, 无护盾挂载
          { group: 'group_down_mid_right', equipment_id: 'turret_ter_m_laser_02_mk1', count: 2 },
          { group: 'group_mid_right_up', equipment_id: 'turret_ter_m_laser_02_mk1', count: 2 },
          { group: 'group_mid_up_left', equipment_id: 'turret_ter_m_laser_02_mk1', count: 2 },
          { group: 'group_down_mid_left', equipment_id: 'turret_ter_m_laser_02_mk1', count: 2 },
          { group: 'group_back_down_mid', equipment_id: 'turret_ter_m_laser_02_mk1', count: 2 }
        ]
      }
    ]
  }

  const seed: Seed = {
    ships: [
      {
        id: katana.id,
        name: 'Katana',
        class: katana.class,
        type: katana.type,
        race: katana.race,
        blueprint: katanaBlueprint
      },
      {
        id: odachi.id,
        name: 'Odachi',
        class: odachi.class,
        type: odachi.type,
        race: odachi.race,
        blueprint: odachiBlueprint
      },
      {
        id: osaka.id,
        name: 'Osaka',
        class: osaka.class,
        type: osaka.type,
        race: osaka.race,
        blueprint: osakaBlueprint
      },
      {
        id: osaka.id,
        name: 'Osaka 2',
        class: osaka.class,
        type: osaka.type,
        race: osaka.race,
        blueprint: osaka2Blueprint
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
