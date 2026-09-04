/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const BUILDER_SHIP_ID = 'ship_arg_xl_builder_01_a'

describe('ship-build-storage: builder built-in presets', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('builder 预设应自动分配建造无人机到 U 槽容量', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(BUILDER_SHIP_ID)
    const highPreset = list.find((bp) => bp.id.endsWith(':high'))
    expect(highPreset).toBeTruthy()

    store.loadBlueprint(highPreset!.id)

    const drones = store.blueprint?.storage?.drones || []
    const buildCount = drones
      .filter((item) => store.dronesMap.get(item.id)?.purposePrimary === 'build')
      .reduce((sum, item) => sum + item.count, 0)

    const unitCapacity = store.findShip(BUILDER_SHIP_ID)?.storage?.unit || 0
    expect(buildCount).toBe(unitCapacity)
  })
})
