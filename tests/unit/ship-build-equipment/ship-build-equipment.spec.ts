/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShipBuildStore } from '@/store/useShipBuildStore'

const ODACHI_ID = 'ship_ter_m_corvette_02_a'
const OSAKA_ID = 'ship_ter_l_destroyer_01_a'
const ODACHI_TURRET_1 = `${ODACHI_ID}::turret::4::0`
const ODACHI_TURRET_2 = `${ODACHI_ID}::turret::4::1`

describe('ship-build-equipment store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('1.2 候选过滤：type + size 匹配', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const turretRow = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)

    expect(turretRow).toBeTruthy()
    expect(turretRow!.slotType).toBe('turret')
    expect(turretRow!.size).toBe('medium')
    expect(turretRow!.options.length).toBeGreaterThan(0)
  })

  it('1.4 候选过滤：connection tags 为空时按 type+size 返回', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const originalRow = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)

    store.setMockTagPatch({
      targetShipId: ODACHI_ID,
      slotType: 'turret',
      connections: {
        [ODACHI_TURRET_1]: {
          groupName: 'con_turret_m_01',
          size: 'medium',
          tags: []
        }
      }
    })

    const patchedRow = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)
    expect(originalRow).toBeTruthy()
    expect(patchedRow).toBeTruthy()
    expect(patchedRow!.options.length).toBeGreaterThanOrEqual(originalRow!.options.length)
  })

  it('1.7 切换按钮灰态判定：同 slot.type 多装备', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const row1 = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)!
    const row2 = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_2)!

    expect(row1.options.length).toBeGreaterThan(1)
    store.applyConnectionAssignment({ connectionKey: ODACHI_TURRET_1, equipmentId: row1.options[0]!.id })
    store.applyConnectionAssignment({ connectionKey: ODACHI_TURRET_2, equipmentId: row2.options[1]!.id })

    expect(store.hasFitModeConflict).toBe(true)
    expect(store.canSwitchToGroupMode).toBe(false)
  })

  it('1.8 冲突解除恢复可用', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const row1 = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)!

    store.applyConnectionAssignment({ connectionKey: ODACHI_TURRET_1, equipmentId: row1.options[0]!.id })
    store.applyConnectionAssignment({ connectionKey: ODACHI_TURRET_2, equipmentId: row1.options[0]!.id })

    expect(store.hasFitModeConflict).toBe(false)
    expect(store.canSwitchToGroupMode).toBe(true)
  })

  it('1.9 简化模式主槽位聚合键为 size + tags（同size不同tags拆分）', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    store.setMockTagPatch({
      targetShipId: ODACHI_ID,
      slotType: 'turret',
      connections: {
        [ODACHI_TURRET_1]: {
          groupName: 'con_turret_m_01',
          size: 'medium',
          tags: ['advanced', 'combat', 'unhittable']
        },
        [ODACHI_TURRET_2]: {
          groupName: 'con_turret_m_02',
          size: 'medium',
          tags: ['advanced', 'combat', 'missile']
        }
      }
    })

    const turretGroups = store.groupRows.filter((row) => row.slotType === 'turret' && row.size === 'medium')
    expect(turretGroups.length).toBe(2)
  })

  it('1.13 标签规则：unhittable 需额外标签命中', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const turretRow = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)!
    const optionIds = turretRow.options.map((item) => item.id)

    expect(optionIds).toContain('turret_gen_m_disabler_01_mk1')
    expect(optionIds).not.toContain('turret_arg_m_mining_01_mk1')
  })

  it('1.14 标签规则：hittable 与 unhittable 互斥', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(ODACHI_ID)
    const turretRow = store.connectionRows.find((row) => row.connectionKey === ODACHI_TURRET_1)!
    const optionIds = turretRow.options.map((item) => item.id)

    expect(optionIds).not.toContain('turret_ter_m_laser_04_mk1')
  })

  it('1.17 过滤 noplayerblueprint=true', () => {
    const store = useShipBuildStore()
    store.setSelectedShipId(OSAKA_ID)
    const turretRow = store.connectionRows.find((row) => row.slotType === 'turret' && row.size === 'medium')

    expect(turretRow).toBeTruthy()
    const optionIds = turretRow!.options.map((item) => item.id)
    expect(optionIds).not.toContain('turret_xen_m_beam_02_mk1')
  })
})
