import { describe, expect, it } from 'vitest'
import {
  extractShipCandidates,
  extractEquipmentCandidatesBySelector,
  extractEquipmentSlotCandidatesWithFacets,
  parseSizeNToSizeNth,
  type EquipmentPickerFilters
} from '@/store/logic/shipEquipmentPicker'
import type { X4Equipment, X4Ship } from '@/types/x4'

describe('shipEquipmentPicker logic', () => {
  it('filters by races + mks + tags(any)', () => {
    const result = extractEquipmentCandidatesBySelector({
      shipMap: new Map([['ship_a', shipA]]),
      equipmentMap: new Map([
        ['eq_a', { ...eqMap.get('eq_std')!, id: 'eq_a', race: 'argon', mk: '1', slotTags: ['standard'] }],
        ['eq_c', { ...eqMap.get('eq_m')!, id: 'eq_c', race: 'argon', mk: '3', slotTags: ['standard', 'advanced'] }]
      ]),
      shipId: 'ship_a',
      selector: { mode: 'slotTypeGroupName', slotType: 'turret', groupName: 'group_mid' },
      filters: { races: ['argon'], mks: ['3'], tags: ['advanced'] }
    })

    expect(result.map((item) => item.id)).toEqual(['eq_c'])
  })
})

const shipA: X4Ship = {
  id: 'ship_a',
  nameId: 'ship_a',
  name: 'Ship A',
  class: 'ship_m',
  type: 'corvette',
  purposePrimary: 'fight',
  droneTags: [],
  race: 'argon',
  noplayerblueprint: false,
  noplayerbuild: false,
  production: [],
  slots: [
    {
      type: 'turret',
      count: {},
      groups: [
        {
          group: 'group_back',
          isImplicitGroup: false,
          mandatory: false,
          connection: {
            size: 'large',
            tags: ['standard'],
            count: 1
          },
          equipments: {}
        },
        {
          group: 'group_front',
          isImplicitGroup: false,
          mandatory: false,
          connection: {
            size: 'large',
            tags: ['advanced'],
            count: 1
          },
          equipments: {}
        },
        {
          group: 'group_mid',
          isImplicitGroup: false,
          mandatory: false,
          connection: {
            size: 'medium',
            tags: ['standard', 'advanced'],
            count: 1
          },
          equipments: {}
        }
      ]
    }
  ],
  storage: { missile: 0, unit: 0, countermeasure: 0, deployable: 0 },
  cargo: [],
  dockarea: [],
  shipstorage: [],
  crew: { capacity: 0 },
  hull: 100,
  radarRange: 1000,
  physics: {
    mass: 1,
    drag: { forward: 1, reverse: 1, horizontal: 1, vertical: 1, pitch: 1, yaw: 1, roll: 1 }
  }
}

const eqMap = new Map<string, X4Equipment>([
  ['eq_std', {
    id: 'eq_std',
    nameId: 'eq_std',
    name: 'Std',
    type: 'turret',
    class: 'weapon',
    size: 'large',
    mk: '1',
    race: 'argon',
    tags: [],
    noplayerblueprint: false,
    slotTags: ['standard'],
    ammunitionTags: [],
    integrated: false,
    cost: {}
  }],
  ['eq_adv', {
    id: 'eq_adv',
    nameId: 'eq_adv',
    name: 'Adv',
    type: 'turret',
    class: 'weapon',
    size: 'large',
    mk: '2',
    race: 'split',
    tags: [],
    noplayerblueprint: false,
    slotTags: ['advanced'],
    ammunitionTags: [],
    integrated: false,
    cost: {}
  }],
  ['eq_both', {
    id: 'eq_both',
    nameId: 'eq_both',
    name: 'Both',
    type: 'turret',
    class: 'weapon',
    size: 'large',
    mk: '3',
    race: 'argon',
    tags: [],
    noplayerblueprint: false,
    slotTags: ['standard', 'advanced'],
    ammunitionTags: [],
    integrated: false,
    cost: {}
  }],
  ['eq_m', {
    id: 'eq_m',
    nameId: 'eq_m',
    name: 'M',
    type: 'turret',
    class: 'weapon',
    size: 'medium',
    mk: '1',
    race: 'teladi',
    tags: [],
    noplayerblueprint: false,
    slotTags: ['standard'],
    ammunitionTags: [],
    integrated: false,
    cost: {}
  }]
])

const shipMap = new Map<string, X4Ship>([['ship_a', shipA]])

describe('shipEquipmentPicker selector modes', () => {
  it('parses sizeN and converts to 0-based nth', () => {
    expect(parseSizeNToSizeNth('L')).toEqual({ size: 'large', nth: 0 })
    expect(parseSizeNToSizeNth('M3')).toEqual({ size: 'medium', nth: 2 })
    expect(parseSizeNToSizeNth('XL')).toEqual({ size: 'extralarge', nth: 0 })
  })

  it('mode: slotType + sizeNth', () => {
    const result = extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      selector: { mode: 'slotTypeSizeNth', slotType: 'turret', size: 'large', nth: 0 },
      filters: { races: [], mks: [], tags: [] }
    })
    expect(result.map((item) => item.id)).toEqual(['eq_std'])
  })

  it('mode: slotType + groupName', () => {
    const result = extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      selector: { mode: 'slotTypeGroupName', slotType: 'turret', groupName: 'group_front' },
      filters: { races: [], mks: [], tags: [] }
    })
    expect(result.map((item) => item.id)).toEqual(['eq_adv'])
  })

  it('mode: slotType + sizeN', () => {
    const result = extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      selector: { mode: 'slotTypeSizeN', slotType: 'turret', sizeN: 'L2' },
      filters: { races: [], mks: [], tags: [] }
    })
    expect(result.map((item) => item.id)).toEqual(['eq_adv'])
  })

  it('tagsAll is independent from filters.tags', () => {
    const base = extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      selector: { mode: 'slotTypeGroupName', slotType: 'turret', groupName: 'group_back' },
      filters: { races: [], mks: [], tags: [] }
    })
    expect(base.map((item) => item.id)).toEqual(['eq_std'])

    const filtered = extractEquipmentCandidatesBySelector({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      selector: { mode: 'slotTypeGroupName', slotType: 'turret', groupName: 'group_back' },
      filters: { races: [], mks: [], tags: ['advanced'] }
    })
    expect(filtered.map((item) => item.id)).toEqual([])
  })

  it('returns facet maps for equipment candidates', () => {
    const result = extractEquipmentSlotCandidatesWithFacets({
      shipMap,
      equipmentMap: eqMap,
      shipId: 'ship_a',
      slotType: 'turret',
      size: 'large',
      tagsAll: ['standard', 'advanced'],
      filters: { races: ['argon'], mks: [], tags: [] }
    })

    expect(result.items.map((item) => item.id)).toEqual(['eq_std'])
    expect(result.raceCountMap.get('argon')).toBe(1)
    expect(result.raceCountMap.get('split') || 0).toBe(1)
    expect(result.mkCountMap.get('1')).toBe(1)
    expect(result.mkCountMap.get('3') || 0).toBe(0)
    expect(result.tagCountMap.get('standard')).toBeGreaterThan(0)
  })
})

describe('ship candidate extraction', () => {
  const shipMapForCandidates = new Map<string, X4Ship>([
    ['s1', { ...shipA, id: 's1', class: 'ship_m', race: 'argon', type: 'corvette' }],
    ['s2', { ...shipA, id: 's2', class: 'ship_m', race: 'split', type: 'corvette' }],
    ['s3', { ...shipA, id: 's3', class: 'ship_l', race: 'argon', type: 'destroyer' }]
  ])

  it('filters only by class/race/type (no sort/count/page)', () => {
    const result = extractShipCandidates({
      shipMap: shipMapForCandidates,
      filters: {
        shipClass: 'ship_m',
        races: ['argon'],
        types: ['corvette']
      }
    })

    expect(result.items.map((item) => item.id)).toEqual(['s1'])
    expect(result.raceCountMap.get('argon')).toBe(1)
    expect(result.raceCountMap.get('split')).toBe(1)
    expect(result.typeCountMap.get('corvette')).toBe(1)
  })
})
