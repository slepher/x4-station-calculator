/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getPriceByMultiplier } from '@/store/logic/calculatorUtils'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { X4Equipment, X4Ship, X4Ware } from '@/types/x4'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'

const OSAKA_ID = 'ship_ter_l_destroyer_01_a'
const ARG_BEAM_ID = 'turret_arg_m_beam_02_mk1'
const TER_BEAM_ID = 'turret_ter_m_beam_02_mk1'

const ships = shipsRaw as unknown as X4Ship[]
const equipments = equipmentsRaw as X4Equipment[]
const wares = waresRaw as X4Ware[]

const shipMap = new Map(ships.map((ship) => [ship.id, ship]))
const equipmentMap = new Map(equipments.map((equipment) => [equipment.id, equipment]))
const wareMap = new Map(wares.map((ware) => [ware.id, ware]))

const pickShipCostByMethod = (shipId: string, method: string): Record<string, number> => {
  const ship = shipMap.get(shipId)
  if (!ship) return {}
  const productions = Array.isArray(ship.production) ? ship.production : []
  const selected = productions.find((item) => item.method === method)
  const fallback = productions.find((item) => item.method === 'default')
  return ((selected || fallback)?.cost || {}) as Record<string, number>
}

const pickEquipmentCostByMethod = (equipmentId: string, method: string): Record<string, number> => {
  const equipment = equipmentMap.get(equipmentId)
  if (!equipment?.cost) return {}
  return (equipment.cost[method] || equipment.cost.default || {}) as Record<string, number>
}

const mergeMaterials = (target: Record<string, number>, source: Record<string, number>, multiplier = 1) => {
  for (const [wareId, count] of Object.entries(source)) {
    target[wareId] = (target[wareId] || 0) + count * multiplier
  }
  return target
}

const calcMaterialValues = (materials: Record<string, number>, priceMultiplier: number): Record<string, number> => {
  const result: Record<string, number> = {}
  for (const [wareId, count] of Object.entries(materials)) {
    const ware = wareMap.get(wareId)
    if (!ware) {
      result[wareId] = 0
      continue
    }
    result[wareId] = count * getPriceByMultiplier(ware, priceMultiplier)
  }
  return result
}

describe('ship-build-material unit contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.1 method 选项聚合：包含去重后的 default/closedloop/terran', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(OSAKA_ID)

    const shipMethods = new Set<string>()
    const ship = shipMap.get(OSAKA_ID)
    const productions = Array.isArray(ship?.production) ? ship.production : []
    for (const item of productions) {
      if (item.method) shipMethods.add(item.method)
    }

    const equipmentMethods = new Set<string>()
    for (const row of store.connectionRows) {
      for (const option of row.options) {
        const equipment = equipmentMap.get(option.id)
        if (!equipment?.cost) continue
        Object.keys(equipment.cost).forEach((method) => equipmentMethods.add(method))
      }
    }

    const methodOptions = Array.from(new Set([...shipMethods, ...equipmentMethods]))

    expect(methodOptions).toContain('default')
    expect(methodOptions).toContain('closedloop')
    expect(methodOptions).toContain('terran')
    expect(new Set(methodOptions).size).toBe(methodOptions.length)
  })

  it('1.2 method fallback（飞船）：closedloop 缺失时回退 default', () => {
    const cost = pickShipCostByMethod(OSAKA_ID, 'closedloop')
    expect(cost.computronicsubstrate).toBe(281)
    expect(cost.energycells).toBe(1034)
    expect(cost.metallicmicrolattice).toBe(471)
  })

  it('1.3 method fallback（装备）：terran 炮塔在 closedloop 下回退 default', () => {
    const cost = pickEquipmentCostByMethod(TER_BEAM_ID, 'closedloop')
    expect(cost.computronicsubstrate).toBe(5)
    expect(cost.energycells).toBe(100)
    expect(cost.metallicmicrolattice).toBe(36)
    expect(cost.siliconcarbide).toBe(4)
  })

  it('1.4 装备分项按 equipmentId 聚合：Arg beam x3 + Terran beam x1', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(OSAKA_ID)

    const turretRows = store.connectionRows.filter((row) => row.slotType === 'turret')
    const rowBackDownMid = turretRows.find((row) => row.groupName === 'group_back_down_mid')
    const rowBackMidUp = turretRows.find((row) => row.groupName === 'group_back_mid_up')
    const rowDownMidLeft = turretRows.find((row) => row.groupName === 'group_down_mid_left')

    expect(rowBackDownMid).toBeTruthy()
    expect(rowBackMidUp).toBeTruthy()
    expect(rowDownMidLeft).toBeTruthy()

    const assignments = [
      { row: rowBackDownMid!, equipmentId: ARG_BEAM_ID },
      { row: rowBackMidUp!, equipmentId: TER_BEAM_ID },
      { row: rowDownMidLeft!, equipmentId: ARG_BEAM_ID }
    ]

    const grouped: Record<string, number> = {}
    for (const item of assignments) {
      grouped[item.equipmentId] = (grouped[item.equipmentId] || 0) + item.row.count
    }

    expect(grouped[ARG_BEAM_ID]).toBe(3)
    expect(grouped[TER_BEAM_ID]).toBe(1)
  })

  it('1.5 总材料合并规则：飞船 + 装备分项合并', () => {
    const total = mergeMaterials({}, pickShipCostByMethod(OSAKA_ID, 'default'))
    mergeMaterials(total, pickEquipmentCostByMethod(ARG_BEAM_ID, 'default'), 3)
    mergeMaterials(total, pickEquipmentCostByMethod(TER_BEAM_ID, 'default'), 1)

    expect(total.energycells).toBe(1164)
    expect(total.computronicsubstrate).toBe(286)
    expect(total.metallicmicrolattice).toBe(507)
    expect(total.advancedelectronics).toBe(18)
    expect(total.turretcomponents).toBe(30)
    expect(total.siliconcarbide).toBe(4)
  })

  it('1.6 价格倍率只影响金额：count 不变，value 变化', () => {
    const total = mergeMaterials({}, pickShipCostByMethod(OSAKA_ID, 'default'))
    mergeMaterials(total, pickEquipmentCostByMethod(ARG_BEAM_ID, 'default'), 3)
    mergeMaterials(total, pickEquipmentCostByMethod(TER_BEAM_ID, 'default'), 1)

    const valuesAtMin = calcMaterialValues(total, 0)
    const valuesAtMax = calcMaterialValues(total, 1)

    expect(total.energycells).toBe(1164)
    expect(total.computronicsubstrate).toBe(286)
    expect(total.metallicmicrolattice).toBe(507)

    expect(valuesAtMin.energycells).not.toBe(valuesAtMax.energycells)
    expect(valuesAtMin.computronicsubstrate).not.toBe(valuesAtMax.computronicsubstrate)
    expect(valuesAtMin.metallicmicrolattice).not.toBe(valuesAtMax.metallicmicrolattice)
  })
})
