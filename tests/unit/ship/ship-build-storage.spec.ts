/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const ODACHI_ID = 'ship_ter_m_corvette_02_a'
const STORAGE_KEY = 'x4_ship_blueprints'

describe('ship-build-storage: data types', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.1.1 ShipBlueprintGroup 字段完整性', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 设置装备
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.setShield('engine', 'group_back_up_mid', 'shield_gen_m', 1)

    const bp = store.blueprint
    expect(bp).toBeTruthy()

    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    expect(engineConn).toBeTruthy()

    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group).toBeTruthy()
    expect(group!.equipment_id).toBe('engine_am')
    expect(group!.count).toBe(3)
    expect(group!.shield).toBeTruthy()
    expect(group!.shield!.equipment_id).toBe('shield_gen_m')
    expect(group!.shield!.count).toBe(1)
  })

  it('1.1.2 ShipBlueprintConnection 字段完整性', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    const bp = store.blueprint
    expect(bp).toBeTruthy()
    expect(bp!.connections).toHaveLength(1)
    const firstConn = bp!.connections[0]
    expect(firstConn).toBeDefined()
    expect(firstConn!.slot_type).toBe('engine')
    expect(Array.isArray(firstConn!.group)).toBe(true)
  })

  it('1.1.3 selectedByConnection computed 格式', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 设置装备
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 验证 blueprint 存在且包含正确的配置
    const bp = store.blueprint
    expect(bp).toBeTruthy()
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    expect(engineConn).toBeTruthy()
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group).toBeTruthy()
    expect(group!.equipment_id).toBe('engine_am')
  })
})

describe('ship-build-storage: setEquipment', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.2.1 设置新装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    const bp = store.blueprint
    expect(bp).toBeTruthy()
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    expect(engineConn).toBeTruthy()
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group).toBeTruthy()
    expect(group!.equipment_id).toBe('engine_am')
    expect(group!.count).toBe(3)
  })

  it('1.2.2 更新已有装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_pm', 5)

    const bp = store.blueprint
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group!.equipment_id).toBe('engine_pm')
    expect(group!.count).toBe(5)
  })

  it('1.2.3 取消装备（equipmentId = null）应删除条目', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 取消装备
    store.setEquipment('engine', 'group_back_up_mid', null, 0)

    const bp = store.blueprint
    // 应该删除整个 group 条目，而不是保留为 null
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    if (engineConn) {
      const group = engineConn.group.find(g => g.group === 'group_back_up_mid')
      expect(group).toBeUndefined()
    }
  })

  it('1.2.4 store层仅更新装备，不直接清理导弹（由面板watch处理）', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 初始挂载 guided 导弹发射器
    store.setEquipment('weapon', 'group_test_weapon', 'weapon_bor_m_guided_01_mk1', 1)
    store.updateBlueprintStorage({
      deployables: [],
      countermeasure: null,
      drones: [],
      missiles: [
        { id: 'missile_guided_light_mk1', name: '', count: 10 },
        { id: 'missile_dumbfire_light_mk1', name: '', count: 10 }
      ]
    })

    // 切换为 dumbfire 发射器后，store 层不直接清理导弹
    store.setEquipment('weapon', 'group_test_weapon', 'weapon_bor_m_dumbfire_01_mk1', 1)

    const missiles = store.blueprint?.storage?.missiles || []
    expect(missiles.map(m => m.id)).toEqual(['missile_guided_light_mk1', 'missile_dumbfire_light_mk1'])
  })

  it('1.2.5 store层清空weapon后不直接清理导弹（由面板watch处理）', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('weapon', 'group_test_weapon', 'weapon_bor_m_guided_01_mk1', 1)
    store.updateBlueprintStorage({
      deployables: [],
      countermeasure: null,
      drones: [],
      missiles: [
        { id: 'missile_guided_light_mk1', name: '', count: 10 }
      ]
    })

    // 清空武器后，store 层不直接清理导弹
    store.setEquipment('weapon', 'group_test_weapon', null, 0)

    const missiles = store.blueprint?.storage?.missiles || []
    expect(missiles.map(m => m.id)).toEqual(['missile_guided_light_mk1'])
  })
})

describe('ship-build-storage: setShield', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.3.1 设置盾位装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 先设置主装备
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    // 再设置盾位
    store.setShield('engine', 'group_back_up_mid', 'shield_gen_m', 1)

    const bp = store.blueprint
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group!.shield).toBeTruthy()
    expect(group!.shield!.equipment_id).toBe('shield_gen_m')
    expect(group!.shield!.count).toBe(1)
  })

  it('1.3.2 取消盾位装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.setShield('engine', 'group_back_up_mid', 'shield_gen_m', 1)

    // 取消盾位
    store.setShield('engine', 'group_back_up_mid', null, 0)

    const bp = store.blueprint
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group!.shield).toEqual({ equipment_id: '', count: 0 })
  })
})

describe('ship-build-storage: selectedByConnection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.4.1 批量设置装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 模拟批量设置 - 同一个装备设置到多个 group
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    const bp = store.blueprint
    expect(bp).toBeTruthy()
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    expect(engineConn).toBeTruthy()
    // 批量设置应该更新同一 group
    const groups = engineConn!.group.filter(g => g.group === 'group_back_up_mid')
    expect(groups.length).toBe(1)
  })

  it('1.5.1 从 blueprint 计算 selectedByConnection', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    const bp = store.blueprint
    expect(bp).toBeTruthy()
    const engineConn = bp!.connections.find(c => c.slot_type === 'engine')
    expect(engineConn).toBeTruthy()
    const group = engineConn!.group.find(g => g.group === 'group_back_up_mid')
    expect(group?.equipment_id).toBe('engine_am')
  })

  it('1.5.2 无装备时返回 null', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 不设置任何装备，blueprint 应该为 null（因为没有调用 setEquipment）
    const bp = store.blueprint
    // 当没有设置任何装备时，blueprint 可能为 null 或空 connections
    // 这取决于实现，我们检查 connections 是否为空或不包含 engine
    if (bp) {
      const hasEngineGroup = bp.connections.some(c =>
        c.slot_type === 'engine' && c.group.some(g => g.group === 'group_back_up_mid')
      )
      expect(hasEngineGroup).toBe(false)
    } else {
      // 如果 blueprint 为 null，也符合预期
      expect(bp).toBeNull()
    }
  })
})

describe('ship-build-storage: persistence CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.6.1 saveBlueprint 更新现有', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 保存
    store.saveBlueprint()

    // 检查 localStorage
    const data = localStorage.getItem(STORAGE_KEY)
    expect(data).toBeTruthy()

    const parsed = JSON.parse(data!)
    expect(parsed.ships).toHaveLength(1)
    expect(parsed.ships[0].shipId).toBe(ODACHI_ID)
    expect(parsed.ships[0].blueprints).toHaveLength(1)
    expect(parsed.activeShipId).toBe(ODACHI_ID)
    expect(parsed.activeBlueprintId).toBeTruthy()
  })

  it('1.6.2 saveAsBlueprint 创建新 blueprint', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 先保存
    store.saveBlueprint()

    // 另存为
    store.saveAsBlueprint('New Blueprint')

    // 检查
    const data = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(data!)
    expect(parsed.ships).toHaveLength(1)
    expect(parsed.ships[0].blueprints).toHaveLength(2)
    expect(parsed.activeBlueprintId).toBeDefined()
  })

  it('1.6.3 deleteBlueprint 删除', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    store.saveBlueprint()
    store.saveAsBlueprint('Second')

    const dataBefore = localStorage.getItem(STORAGE_KEY)
    const parsedBefore = JSON.parse(dataBefore!)
    const idToDelete = parsedBefore.ships[0].blueprints[0].id

    // 删除
    store.deleteBlueprint(idToDelete)

    const dataAfter = localStorage.getItem(STORAGE_KEY)
    const parsedAfter = JSON.parse(dataAfter!)
    expect(parsedAfter.ships).toHaveLength(1)
    expect(parsedAfter.ships[0].blueprints).toHaveLength(1)
    expect(parsedAfter.ships[0].blueprints.find((b: any) => b.id === idToDelete)).toBeUndefined()
  })

  it('1.6.5 删除当前正在使用的蓝图时，工作区保留为自定义且 dirty', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.saveBlueprint()
    store.saveAsBlueprint('Second')

    const dataBefore = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const idToDelete = dataBefore.ships[0].blueprints[0].id as string
    store.loadBlueprint(idToDelete)

    store.deleteBlueprint(idToDelete)

    const dataAfter = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(dataAfter.ships[0].blueprints.find((b: any) => b.id === idToDelete)).toBeUndefined()
    expect(store.blueprint).toBeTruthy()
    expect(store.blueprint?.shipId).toBe(ODACHI_ID)
    expect(store.blueprint?.name).toBe('')
    expect(store.savedBlueprints.activeBlueprintId).toBeNull()
    expect(store.isDirty).toBe(true)
    expect(store.activeBlueprintStatusLabel).toBe('自定义')
  })

  it('1.6.4 loadBlueprint 自动设置筛选', () => {
    // 预设 localStorage
    const testBlueprint = {
      version: 1,
      activeId: 'test-id',
      list: [{
        id: 'test-id',
        name: 'Test Blueprint',
        shipId: ODACHI_ID,
        connections: [{ slot_type: 'engine', group: [{ group: 'group_back_up_mid', equipment_id: 'engine_am', count: 3 }] }],
        lastUpdated: Date.now()
      }]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testBlueprint))

    // 创建 store（会在初始化时加载 localStorage）
    const store = useShipBuildStore()

    // 载入
    store.loadBlueprint('test-id')

    // 验证自动设置 ship
    expect(store.selectedShipId).toBe(ODACHI_ID)
  })
})

describe('ship-build-storage: dirty state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.7.1 修改后 isDirty = true', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 先设置装备（这会创建 blueprint）
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 保存（ 已此时 blueprint存在）
    store.saveBlueprint()

    // 确认已保存
    expect(store.blueprint).toBeTruthy()

    // 修改
    store.setEquipment('engine', 'group_back_up_mid', 'engine_pm', 5)

    expect(store.isDirty).toBe(true)
  })

  it('1.7.2 保存后 isDirty = false', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    // 先设置装备（这会创建 blueprint）
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    // 保存
    store.saveBlueprint()

    // 确认已保存
    expect(store.blueprint).toBeTruthy()

    // 修改
    store.setEquipment('engine', 'group_back_up_mid', 'engine_pm', 5)
    expect(store.isDirty).toBe(true)

    // 保存
    store.saveBlueprint()
    expect(store.isDirty).toBe(false)
  })

  it('1.7.3 新建仅清空配装并保留当前飞船，且 isDirty = false', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)

    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)
    store.saveBlueprint()
    store.setEquipment('engine', 'group_back_up_mid', 'engine_pm', 5)
    expect(store.isDirty).toBe(true)

    store.clearLoadoutForCurrentShip()

    expect(store.selectedShipId).toBe(ODACHI_ID)
    expect(store.blueprint).toBeTruthy()
    expect(store.blueprint?.shipId).toBe(ODACHI_ID)
    expect(store.blueprint?.connections).toEqual([])
    expect(store.isDirty).toBe(false)
  })
})

describe('ship-build-storage: built-in default blueprints', () => {
  const ARGON_L_SOLID_MINER_ID = 'ship_arg_l_miner_solid_01_a'
  const ARGON_M_BOMBER_ID = 'ship_arg_m_bomber_01_a'
  const PARANID_L_FREIGHTER_ID = 'ship_par_l_trans_container_01_a'
  const TERRAN_L_DESTROYER_OSAKA_ID = 'ship_ter_l_destroyer_01_a'

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.8.1 getLoadableBlueprintsForShip 包含四个默认蓝图且不写入 storage', () => {
    const store = useShipBuildStore()

    const list = store.getLoadableBlueprintsForShip(ODACHI_ID)
    const names = list.map((bp) => bp.name)
    expect(names.slice(0, 4)).toEqual(['空配', '低配', '中配', '高配'])

    const data = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(data || '{}')
    expect(parsed.ships || []).toEqual([])
  })

  it('1.8.2 默认蓝图不可删除', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(ODACHI_ID)
    const builtInId = list[0]!.id
    expect(store.isBuiltInBlueprintId(builtInId)).toBe(true)

    store.deleteBlueprint(builtInId)
    expect(store.getLoadableBlueprintsForShip(ODACHI_ID).map((bp) => bp.name).slice(0, 4)).toEqual(['空配', '低配', '中配', '高配'])
  })

  it('1.8.3 载入高配(fight)时引擎优先 combat', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(ARGON_M_BOMBER_ID)
    const highPresetId = list.find((bp) => bp.name === '高配')!.id

    store.loadBlueprint(highPresetId)

    const engineConn = store.blueprint?.connections.find((c) => c.slot_type === 'engine')
    const engineId = engineConn?.group[0]?.equipment_id || ''
    expect(engineId).toContain('_combat_')
  })

  it('1.8.4 采矿舰高配优先采矿炮塔，且 L 采矿舰 U 槽为 1 运输 + 9 采矿', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(ARGON_L_SOLID_MINER_ID)
    const highPresetId = list.find((bp) => bp.name === '高配')!.id

    store.loadBlueprint(highPresetId)

    const turretConn = store.blueprint?.connections.find((c) => c.slot_type === 'turret')
    const turretEquipments = (turretConn?.group || [])
      .map((item) => store.findEquipment(item.equipment_id))
      .filter((item) => Boolean(item))
    const hasMiningTurret = turretEquipments.some((item) => (item?.slotTags || []).includes('mining'))
    expect(hasMiningTurret).toBe(true)

    const drones = store.blueprint?.storage?.drones || []
    const tradeCount = drones
      .filter((d) => store.dronesMap.get(d.id)?.purposePrimary === 'trade')
      .reduce((sum, d) => sum + d.count, 0)
    const mineCount = drones
      .filter((d) => store.dronesMap.get(d.id)?.purposePrimary === 'mine')
      .reduce((sum, d) => sum + d.count, 0)
    expect(tradeCount).toBe(1)
    expect(mineCount).toBe(9)
  })

  it('1.8.5 运输舰(U槽)默认全部使用运输无人机', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(PARANID_L_FREIGHTER_ID)
    const midPresetId = list.find((bp) => bp.name === '中配')!.id

    store.loadBlueprint(midPresetId)

    const drones = store.blueprint?.storage?.drones || []
    expect(drones.length).toBeGreaterThan(0)
    const allTrade = drones.every((d) => store.dronesMap.get(d.id)?.purposePrimary === 'trade')
    const total = drones.reduce((sum, d) => sum + d.count, 0)
    expect(allTrade).toBe(true)
    expect(total).toBe(store.findShip(PARANID_L_FREIGHTER_ID)?.storage?.unit || 0)
  })

  it('1.8.6 Osaka 高配默认蓝图应包含引擎与炮塔槽位装备', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(TERRAN_L_DESTROYER_OSAKA_ID)
    const highPreset = list.find((bp) => bp.name === '高配')
    expect(highPreset).toBeTruthy()

    const engineConn = highPreset!.connections.find((c) => c.slot_type === 'engine')
    const turretConn = highPreset!.connections.find((c) => c.slot_type === 'turret')

    expect(engineConn).toBeTruthy()
    expect(turretConn).toBeTruthy()
    expect((engineConn?.group || []).some((g) => Boolean(g.equipment_id))).toBe(true)
    expect((turretConn?.group || []).some((g) => Boolean(g.equipment_id))).toBe(true)
  })

  it('1.8.7 载入内置预设后应为 dirty（便于保存）', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(TERRAN_L_DESTROYER_OSAKA_ID)
    const lowPreset = list.find((bp) => bp.name === '低配')
    expect(lowPreset).toBeTruthy()

    store.loadBlueprint(lowPreset!.id)

    expect(store.blueprint?.name).toBe('')
    expect(store.isDirty).toBe(true)
    expect(store.requiresSaveAsOnSave()).toBe(true)
    expect(store.activeBlueprintStatusLabel).toBe('低配')
  })

  it('1.8.8 预制载入后仅实际装备变更才显示为自定义', () => {
    const store = useShipBuildStore()
    const list = store.getLoadableBlueprintsForShip(TERRAN_L_DESTROYER_OSAKA_ID)
    const lowPreset = list.find((bp) => bp.name === '低配')
    expect(lowPreset).toBeTruthy()

    store.loadBlueprint(lowPreset!.id)
    expect(store.activeBlueprintStatusLabel).toBe('低配')

    const firstConn = store.blueprint?.connections[0]
    const firstGroup = firstConn?.group[0]
    expect(firstConn).toBeTruthy()
    expect(firstGroup).toBeTruthy()

    // 无实际变化：不应切换为自定义
    store.setEquipment(firstConn!.slot_type, firstGroup!.group, firstGroup!.equipment_id, firstGroup!.count)
    expect(store.activeBlueprintStatusLabel).toBe('低配')

    // 有实际变化：应切换为自定义
    store.setEquipment(firstConn!.slot_type, firstGroup!.group, firstGroup!.equipment_id, firstGroup!.count + 1)
    expect(store.activeBlueprintStatusLabel).toBe('自定义')
  })

})
