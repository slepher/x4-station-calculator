import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createSaveBindingActions } from '@/store/logic/saveBindingActions'

describe('saveBindingActions connected sector groups', () => {
  it('stores connected sector groups symmetrically', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [
        { id: 'a', name: 'A', order: 0 },
        { id: 'b', name: 'B', order: 1 }
      ],
      stations: [],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            { sectorGroupId: 'a', jumpRange: 2, coverageSectorMacros: [], stationBindings: [] },
            { sectorGroupId: 'b', jumpRange: 2, coverageSectorMacros: [], stationBindings: [] }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.setGroupConnection('g-1', 'a', 'b', true)

    const bindingA = actions.getGroupBinding('g-1', 'a')
    const bindingB = actions.getGroupBinding('g-1', 'b')

    expect(bindingA?.connectedSectorGroupIds).toEqual(['b'])
    expect(bindingB?.connectedSectorGroupIds).toEqual(['a'])
  })

  it('removes mirrored connections when a group binding is cleared', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [
        { id: 'a', name: 'A', order: 0 },
        { id: 'b', name: 'B', order: 1 }
      ],
      stations: [],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            { sectorGroupId: 'a', jumpRange: 2, coverageSectorMacros: [], stationBindings: [], connectedSectorGroupIds: ['b'] },
            { sectorGroupId: 'b', jumpRange: 2, coverageSectorMacros: [], stationBindings: [], connectedSectorGroupIds: ['a'] }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.clearSectorGroupBinding('g-1', 'a')

    const bindingB = actions.getGroupBinding('g-1', 'b')
    expect(bindingB?.connectedSectorGroupIds || []).toEqual([])
  })

  it('binding a save station to a normal station releases the virtual tradestation binding for the same code', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [{ id: 'a', name: 'A', order: 0 }],
      stations: [{ id: 'station-1', name: 'S1' }],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            {
              sectorGroupId: 'a',
              jumpRange: 2,
              coverageSectorMacros: [],
              tradestationBinding: {
                stationId: 'tradestation_a',
                saveStationCode: 'save_1',
                sectorMacro: 'sector_a',
                position: { x: 1, y: 0, z: 2 }
              },
              stationBindings: []
            }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.bindStationToSaveStation({
      gameGuid: 'g-1',
      sectorGroupId: 'a',
      stationId: 'station-1',
      saveStationCode: 'save_1',
      sectorMacro: 'sector_a',
      position: { x: 1, y: 0, z: 2 }
    })

    const binding = actions.getGroupBinding('g-1', 'a')
    expect(binding?.tradestationBinding).toBeUndefined()
    expect(binding?.stationBindings[0]?.saveStationCode).toBe('save_1')
  })

  it('binding a save station to virtual tradestation removes normal station bindings for the same code', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [{ id: 'a', name: 'A', order: 0 }],
      stations: [{ id: 'station-1', name: 'S1' }],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            {
              sectorGroupId: 'a',
              jumpRange: 2,
              coverageSectorMacros: [],
              stationBindings: [
                {
                  stationId: 'station-1',
                  saveStationCode: 'save_1',
                  sectorMacro: 'sector_a',
                  position: { x: 1, y: 0, z: 2 }
                }
              ]
            }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.bindTradestationToSaveStation({
      gameGuid: 'g-1',
      sectorGroupId: 'a',
      saveStationCode: 'save_1',
      sectorMacro: 'sector_a',
      position: { x: 3, y: 0, z: 4 }
    })

    const binding = actions.getGroupBinding('g-1', 'a')
    expect(binding?.tradestationBinding?.saveStationCode).toBe('save_1')
    expect(binding?.stationBindings).toEqual([])
  })

  it('clears empty station bindings instead of leaving no-code/no-position records', () => {
    const updateStationSector = vi.fn()
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [{ id: 'a', name: 'A', order: 0 }],
      stations: [{ id: 'station-1', name: 'S1' }],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            {
              sectorGroupId: 'a',
              jumpRange: 2,
              coverageSectorMacros: [],
              stationBindings: [
                {
                  stationId: 'station-1',
                  sectorMacro: 'sector_a',
                  position: { x: 1, y: 0, z: 2 }
                }
              ]
            }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), updateStationSector)

    actions.clearStationCode('g-1', 'a', 'station-1')
    actions.setStationBindingPosition('g-1', 'a', 'station-1', null)

    const binding = actions.getGroupBinding('g-1', 'a')
    expect(binding?.stationBindings).toEqual([])
    expect(updateStationSector).toHaveBeenCalledWith('station-1', null)
  })

  it('clears empty virtual tradestation binding instead of leaving code-less shell records', () => {
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [{ id: 'a', name: 'A', order: 0 }],
      stations: [],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            {
              sectorGroupId: 'a',
              jumpRange: 2,
              coverageSectorMacros: [],
              tradestationBinding: {
                stationId: 'tradestation_a',
                saveStationCode: 'save_1'
              },
              stationBindings: []
            }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), vi.fn())

    actions.clearTradestationCode('g-1', 'a')

    const binding = actions.getGroupBinding('g-1', 'a')
    expect(binding?.tradestationBinding?.saveStationCode).toBeUndefined()
    expect(binding?.tradestationBinding).toBeUndefined()
  })

  it('replaces dangling abnormal station binding when importing a save station for the same code', () => {
    const updateStationSector = vi.fn()
    const activeEmpire = ref({
      id: 'empire-1',
      name: 'Empire',
      sectors: [{ id: 'a', name: 'A', order: 0 }],
      stations: [{ id: 'new-station', name: 'Imported' }],
      saveBindings: [
        {
          gameGuid: 'g-1',
          active: true,
          selectedArchiveTime: null,
          groupBindings: [
            {
              sectorGroupId: 'a',
              jumpRange: 2,
              coverageSectorMacros: [],
              stationBindings: [
                {
                  stationId: 'missing-station',
                  saveStationCode: 'save_1',
                  sectorMacro: 'sector_a',
                  position: { x: 1, y: 0, z: 2 }
                }
              ]
            }
          ]
        }
      ]
    } as any)

    const actions = createSaveBindingActions(activeEmpire, vi.fn(), updateStationSector)

    actions.importSaveStationAsBinding({
      gameGuid: 'g-1',
      sectorGroupId: 'a',
      stationId: 'new-station',
      saveStation: {
        code: 'save_1',
        position: { x: 10, y: 0, z: 20 }
      } as any,
      sectorMacro: 'sector_a'
    })

    const binding = actions.getGroupBinding('g-1', 'a')
    expect(binding?.stationBindings).toEqual([
      {
        stationId: 'new-station',
        saveStationCode: 'save_1',
        sectorMacro: 'sector_a',
        position: { x: 10, y: 0, z: 20 }
      }
    ])
    expect(updateStationSector).toHaveBeenCalledWith('missing-station', null)
  })
})
