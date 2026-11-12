// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import i18n from '@/i18n'
import { useShipStoragePresenter } from '@/components/ship-build/presenters/useShipStoragePresenter'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { loadShipTestFixture } from './ship-test-fixture'

const supplies = () => ({
  deployables: [{ id: 'deployable_satellite_01_mk1', name: '', count: 3 }],
  countermeasure: { id: 'countermeasure_flares_01', name: '', count: 7 },
  drones: [{ id: 'custom-drone', name: '', count: 2 }],
  missiles: [{ id: 'custom-missile', name: '', count: 5 }]
})

describe('preset supplies', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); loadShipTestFixture() })
  for (const side of ['A', 'B'] as const) {
    it(`${side} mounted supplies reset preset values, subsequent edits, and clear on empty`, async () => {
      const store = useShipBuildStore()
      const shipId = 'ship_arg_xl_carrier_01_a'
      store.setSelectedShipId(shipId)
      store.openComparison()
      store.updatePlanStorage(side, supplies())
      let ui!: ReturnType<typeof useShipStoragePresenter>
      const wrapper = mount(defineComponent({
        setup() {
          ui = useShipStoragePresenter({ side, selectedShip: store.findShip(shipId), slotType: 'units' })
          return () => null
        }
      }), { global: { plugins: [i18n] } })
      const presets = store.getLoadableBlueprintsForShip(shipId)
      store.loadPlanPreset(side, presets.find(b => b.id.endsWith(':high'))!.id)
      await nextTick()
      expect(ui.localCountermeasure.value).toBe(0)
      expect(store.getPlan(side)!.blueprint!.storage!.missiles).toEqual([])
      ui.handleCountermeasureChange(8)
      await nextTick()
      expect(store.getPlan(side)!.blueprint!.storage!.missiles).toEqual([])
      store.loadPlanPreset(side, presets.find(b => b.id.endsWith(':empty'))!.id)
      await nextTick()
      expect(ui.localCountermeasure.value).toBe(0)
      expect(ui.localMissiles.value['custom-missile']).toBeUndefined()
      ui.handleDeployableChange('deployable_satellite_01_mk1', 1)
      expect(store.getPlan(side)!.blueprint!.storage!.countermeasure).toBeNull()
      expect(store.getPlan(side)!.blueprint!.storage!.missiles).toEqual([])
      wrapper.unmount()
    })
    for (const saved of [false, true]) {
      it(`${side} saved=${saved} resets supplies for every combat preset`, () => {
        const store = useShipBuildStore()
        const shipId = 'ship_ter_l_destroyer_01_a'
        store.setSelectedShipId(shipId)
        store.openComparison()
        if (saved) store.savePlan(side, `saved ${side}`)
        store.updatePlanStorage(side, supplies())
        const other = JSON.stringify(store.getPlan(side === 'A' ? 'B' : 'A'))
        const records = JSON.stringify(store.savedBlueprints.ships)
        const identity = store.getPlan(side)!.saveTargetId
        for (const preset of ['empty', 'low', 'mid', 'high']) {
          store.updatePlanStorage(side, supplies())
          const item = store.getLoadableBlueprintsForShip(shipId).find(b => b.id.endsWith(`:${preset}`))!
          expect(item).toBeDefined()
          expect(store.loadPlanPreset(side, item.id)).toBe(true)
          expect(store.getPlan(side)!.blueprint!.storage).toEqual({ deployables: [], countermeasure: null, drones: [], missiles: [] })
          expect(store.getPlan(side)!.saveTargetId).toBe(identity)
        }
        expect(JSON.stringify(store.getPlan(side === 'A' ? 'B' : 'A'))).toBe(other)
        expect(JSON.stringify(store.savedBlueprints.ships)).toBe(records)
      })
    }
    for (const purpose of ['mine', 'trade', 'builder']) {
      it(`${side} applies ${purpose} drone rules and clears other supplies`, () => {
        const store = useShipBuildStore()
        const ship = store.ships.find(s => s.storage.unit > 0 && (purpose === 'builder'
          ? s.type === 'builder' : s.purposePrimary === purpose && s.class === 'ship_l'))!
        expect(ship).toBeDefined()
        store.setSelectedShipId(ship.id)
        store.openComparison()
        const preset = store.getLoadableBlueprintsForShip(ship.id).find(b => b.id.endsWith(':high'))!
        const expectedDrones = JSON.parse(JSON.stringify(preset.storage!.drones))
        expect(expectedDrones.length).toBeGreaterThan(0)
        store.updatePlanStorage(side, supplies())
        store.loadPlanPreset(side, preset.id)
        expect(store.getPlan(side)!.blueprint!.storage).toEqual({ deployables: [], countermeasure: null, drones: expectedDrones, missiles: [] })
        const empty = store.getLoadableBlueprintsForShip(ship.id).find(b => b.id.endsWith(':empty'))!
        store.loadPlanPreset(side, empty.id)
        expect(store.getPlan(side)!.blueprint!.storage).toEqual({ deployables: [], countermeasure: null, drones: [], missiles: [] })
        expect(store.getPlan(side)!.blueprint!.connections).toEqual([])
      })
    }
  }
})
