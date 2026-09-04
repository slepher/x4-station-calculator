import { describe, expect, it } from 'vitest'
import { buildTransportShipCandidateState } from '@/store/logic/transitTransportShip'
import type { ShipBlueprint, X4Drone, X4Equipment, X4Ship } from '@/types/x4'

function ship(id: string, type: X4Ship['type'], patch: Partial<X4Ship> = {}): X4Ship {
  return {
    id,
    macroId: id,
    nameId: id,
    name: id,
    race: 'argon',
    type,
    purposePrimary: type === 'fight' ? 'fight' : 'trade',
    class: 'ship_m',
    dlc_tag: '',
    physics: { drag: { forward: 10, reverse: 0, horizontal: 0, vertical: 0, pitch: 0, yaw: 0, roll: 0 } },
    cargo: [{ type: 'container', capacity: 1000 }],
    storage: { missile: 0, unit: 0 },
    people: { capacity: 0 },
    hull: { max: 0 },
    shields: { hull: 0, group: 0 },
    explosion: { damage: 0, radius: 0 },
    software: [],
    weapons: [],
    turrets: [],
    shieldsSlots: [],
    engines: [],
    thrusters: [],
    slots: [],
    droneTags: [],
    ...patch
  }
}

function engine(id: string, patch: Partial<X4Equipment> = {}): X4Equipment {
  return {
    id,
    macroId: id,
    nameId: id,
    name: id,
    type: 'engine',
    tags: [],
    slotTags: [],
    race: 'argon',
    mk: '1',
    size: 'medium',
    dlc_tag: '',
    thrust: { forward: 1000, reverse: 0, strafe: 0, pitch: 0, yaw: 0, roll: 0 },
    travel: { thrust: 20, charge: 3, attack: 10, release: 2 },
    ...patch
  }
}

function blueprint(id: string, shipId: string, favorite = true): ShipBlueprint {
  return {
    id,
    name: id,
    shipId,
    favorite,
    connections: [
      {
        slot_type: 'engine',
        group: [
          { group: 'main-a', equipment_id: 'engine_a', count: 1 },
          { group: 'main-b', equipment_id: 'engine_a', count: 2 }
        ]
      }
    ],
    materialMethod: 'default',
    lastUpdated: 1,
    createdAt: 1
  }
}

function drone(id: string, purposePrimary: string): X4Drone {
  return {
    id,
    macro: id,
    nameId: id,
    name: id,
    dlc_tag: '',
    class: 'ship_xs',
    mk: '1',
    race: 'argon',
    purposePrimary,
    droneTags: [],
    noplayerblueprint: false,
    cargo: [],
    tags: [],
    cost: {}
  }
}

describe('sector-hub-transport-ship candidate and profile calculation', () => {
  it('uses only favorite freighter/transporter blueprints with valid travel engines', () => {
    const ships = new Map([
      ['freighter', ship('freighter', 'freighter')],
      ['transporter', ship('transporter', 'transporter')],
      ['fighter', ship('fighter', 'fight')]
    ])
    const equipments = new Map([['engine_a', engine('engine_a')]])

    const state = buildTransportShipCandidateState({
      blueprints: [
        blueprint('bp-freighter', 'freighter'),
        blueprint('bp-transporter', 'transporter'),
        blueprint('bp-fighter', 'fighter'),
        blueprint('bp-unfav', 'freighter', false)
      ],
      selectedBlueprintId: 'bp-freighter',
      findShip: (id) => ships.get(id) ?? null,
      findEquipment: (id) => equipments.get(id) ?? null,
      resolveShipName: (s) => `localized:${s.id}`
    })

    expect(state.hasCandidates).toBe(true)
    expect(state.groups.map((group) => group.shipId).sort()).toEqual(['freighter', 'transporter'])
    expect(state.groups.find((group) => group.shipId === 'freighter')?.shipName).toBe('localized:freighter')
    expect(state.selectedProfile?.blueprintId).toBe('bp-freighter')
    expect(state.selectedProfile?.baseSpeedMps).toBe(300)
    expect(state.selectedProfile?.travelSpeedMps).toBe(6000)
    expect(state.selectedProfile?.engines).toEqual([{ equipmentId: 'engine_a', count: 3, name: 'engine_a' }])
  })

  it('marks selected blueprint invalid when DLC or physics filters remove it', () => {
    const freighter = ship('freighter', 'freighter')
    const state = buildTransportShipCandidateState({
      blueprints: [blueprint('bp-freighter', 'freighter')],
      selectedBlueprintId: 'bp-freighter',
      findShip: (id) => id === 'freighter' ? freighter : null,
      findEquipment: () => engine('engine_a'),
      includeShip: () => false
    })

    expect(state.hasCandidates).toBe(false)
    expect(state.selectedProfile).toBeNull()
    expect(state.selectedBlueprintValid).toBe(false)
  })

  it('counts transport drones from blueprint storage and caps active cargo drones at 10', () => {
    const freighter = ship('freighter', 'freighter')
    const equipments = new Map([['engine_a', engine('engine_a')]])
    const drones = new Map([
      ['drone_trade', drone('drone_trade', 'trade')],
      ['drone_mine', drone('drone_mine', 'mine')]
    ])
    const bp = blueprint('bp-freighter', 'freighter')
    bp.storage = {
      deployables: [],
      countermeasure: null,
      drones: [
        { id: 'drone_trade', name: 'Cargo Drone', count: 12 },
        { id: 'drone_mine', name: 'Mining Drone', count: 4 }
      ],
      missiles: []
    }

    const state = buildTransportShipCandidateState({
      blueprints: [bp],
      selectedBlueprintId: 'bp-freighter',
      findShip: () => freighter,
      findEquipment: (id) => equipments.get(id) ?? null,
      findDrone: (id) => drones.get(id) ?? null
    })

    expect(state.selectedProfile?.cargoDroneCount).toBe(10)
  })
})
