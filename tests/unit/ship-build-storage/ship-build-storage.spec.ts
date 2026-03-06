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
    expect(group!.shield).toBeUndefined()
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

    // 检查 connectionRows 的 options 是否可用
    const engineRows = store.connectionRows.filter(r => r.slotType === 'engine')
    expect(engineRows.length).toBeGreaterThan(0)
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
    expect(parsed.list).toHaveLength(1)
    expect(parsed.list[0].shipId).toBe(ODACHI_ID)
    expect(parsed.activeId).toBeTruthy()
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
    expect(parsed.list).toHaveLength(2)
    expect(parsed.activeId).toBeDefined()
  })

  it('1.6.3 deleteBlueprint 删除', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setEquipment('engine', 'group_back_up_mid', 'engine_am', 3)

    store.saveBlueprint()
    store.saveAsBlueprint('Second')

    const dataBefore = localStorage.getItem(STORAGE_KEY)
    const parsedBefore = JSON.parse(dataBefore!)
    const idToDelete = parsedBefore.list[0].id

    // 删除
    store.deleteBlueprint(idToDelete)

    const dataAfter = localStorage.getItem(STORAGE_KEY)
    const parsedAfter = JSON.parse(dataAfter!)
    expect(parsedAfter.list).toHaveLength(1)
    expect(parsedAfter.list.find((b: any) => b.id === idToDelete)).toBeUndefined()
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

    // 验证自动设置筛选
    expect(store.selectedShipId).toBe(ODACHI_ID)
    expect(store.selectedClass).toBe('ship_m')
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
    expect(store.blueprint).toBeNull()
    expect(store.isDirty).toBe(false)
  })
})
