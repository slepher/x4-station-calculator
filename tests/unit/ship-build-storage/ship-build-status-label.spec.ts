/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const ODACHI_ID = 'ship_ter_m_corvette_02_a'
const OSAKA_ID = 'ship_ter_l_destroyer_01_a'

describe('ship-build-status-label', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('切换飞船后首次新增装备，状态标签应为自定义', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    expect(store.activeBlueprintStatusLabel).toBe('')

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 1)

    expect(store.isDirty).toBe(true)
    expect(store.activeBlueprintStatusLabel).toBe(i18n.global.t('shipBuild.status_custom'))
  })

  it('已有活动蓝图时切换飞船并新增装备，状态标签应为自定义', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 1)
    store.saveBlueprint()

    expect(store.savedBlueprints.activeBlueprintId).toBeTruthy()

    store.setSelectedShipId(OSAKA_ID)
    expect(store.savedBlueprints.activeBlueprintId).toBeNull()

    store.setEquipment('engine', 'group_back_up_mid', 'engine_allround_mk1', 1)

    expect(store.isDirty).toBe(true)
    expect(store.activeBlueprintStatusLabel).toBe(i18n.global.t('shipBuild.status_custom'))
  })

  it('载入已保存蓝图后再载入预制：保留当前蓝图名与ID，实质变化时 dirty 且红点条件成立', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.saveAsBlueprint('My Blueprint')

    const originalId = store.blueprint?.id || ''
    expect(originalId).toBeTruthy()
    expect(store.savedBlueprints.activeBlueprintId).toBe(originalId)

    const lowPreset = store.getLoadableBlueprintsForShip(ODACHI_ID).find((bp) => bp.id.endsWith(':low'))
    expect(lowPreset).toBeTruthy()
    store.loadBlueprint(lowPreset!.id)

    expect(store.blueprint?.id).toBe(originalId)
    expect(store.blueprint?.name).toBe('My Blueprint')
    expect(store.savedBlueprints.activeBlueprintId).toBe(originalId)
    expect(store.activeBlueprintStatusLabel).toBe('My Blueprint')
    expect(store.isDirty).toBe(true)
    expect(store.isBuiltInPresetUnchanged).toBe(false)
    expect(store.isDirty && !store.isBuiltInPresetUnchanged).toBe(true)

    store.saveBlueprint()
    expect(store.savedBlueprints.activeBlueprintId).toBe(originalId)
    expect(store.blueprint?.id).toBe(originalId)
    expect(store.isDirty).toBe(false)
  })

  it('载入已保存蓝图后再载入空配预制：无实质变化时 isDirty=false 且无红点', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.saveAsBlueprint('Empty Saved')

    const originalId = store.blueprint?.id || ''
    const emptyPreset = store.getLoadableBlueprintsForShip(ODACHI_ID).find((bp) => bp.id.endsWith(':empty'))
    expect(emptyPreset).toBeTruthy()
    store.loadBlueprint(emptyPreset!.id)

    expect(store.blueprint?.id).toBe(originalId)
    expect(store.blueprint?.name).toBe('Empty Saved')
    expect(store.activeBlueprintStatusLabel).toBe('Empty Saved')
    expect(store.isDirty).toBe(false)
    expect(store.isDirty && !store.isBuiltInPresetUnchanged).toBe(false)
  })
})
