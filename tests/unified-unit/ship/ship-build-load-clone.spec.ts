/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const ODACHI_ID = 'ship_ter_m_corvette_02_a'

describe('ship-build-load-clone', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('自动载入活动蓝图时应深度克隆，编辑工作区不应污染已保存蓝图', async () => {
    const storeA = useShipBuildStore()
    storeA.setSelectedShipId(ODACHI_ID)
    storeA.setEquipment('engine', 'group_back_up_mid', 'engine_am', 1)
    storeA.saveAsBlueprint('Clone Check')

    const activeId = storeA.savedBlueprints.activeBlueprintId
    expect(activeId).toBeTruthy()

    setActivePinia(createPinia())
    const storeB = useShipBuildStore()
    await Promise.resolve()

    const beforeSaved = storeB.savedBlueprints.ships
      .flatMap((bucket) => bucket.blueprints)
      .find((bp) => bp.id === activeId)!
    const beforeEquipmentId = beforeSaved.connections.find((c) => c.slot_type === 'engine')?.group[0]?.equipment_id

    storeB.setEquipment('engine', 'group_back_up_mid', 'engine_allround_mk1', 1)

    const afterSaved = storeB.savedBlueprints.ships
      .flatMap((bucket) => bucket.blueprints)
      .find((bp) => bp.id === activeId)!
    const afterEquipmentId = afterSaved.connections.find((c) => c.slot_type === 'engine')?.group[0]?.equipment_id
    const currentEquipmentId = storeB.blueprint?.connections.find((c) => c.slot_type === 'engine')?.group[0]?.equipment_id

    expect(beforeEquipmentId).toBe('engine_am')
    expect(afterEquipmentId).toBe('engine_am')
    expect(currentEquipmentId).toBe('engine_allround_mk1')
  })
})
