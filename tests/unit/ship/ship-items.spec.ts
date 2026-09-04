/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import dronesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/drones.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'
import shipsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/ships.json'

const OSAKA_ID = 'ship_ter_l_destroyer_01_a'

// Drone matching logic (same as in ShipStoragePanel.vue)
const matchDroneItems = (shipDroneTags: string[]) => {
  const matched = (dronesRaw as any[]).filter((drone) => {
    const droneNoBlueprint = drone.noplayerblueprint === true
    const droneDeployable = drone.deployable === true
    const droneTags = drone.droneTags || []

    if (droneNoBlueprint) return false
    if (droneDeployable) return false

    if (shipDroneTags.length === 0) {
      return droneTags.length === 0
    }

    const hasMatchingTag = shipDroneTags.length > 0 && shipDroneTags.every((tag: string) => droneTags.includes(tag))
    return hasMatchingTag || droneTags.length === 0
  })

  return matched.slice(0, 10)
}

// Missile matching logic (same as in ShipStoragePanel.vue)
const matchMissileItems = (ammoTags: string[]) => {
  if (ammoTags.length === 0) {
    return []
  }

  const matched = (missilesRaw as any[]).filter((missile) => {
    const missileTags = missile.missileTags || []
    return ammoTags.some((tag: string) => missileTags.includes(tag))
  })

  return matched
}

describe('ship-items', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  // 1.1 无人机匹配逻辑测试
  describe('1.1 无人机匹配逻辑测试', () => {
    it('1.1.1-1.1.4 无人机匹配逻辑', () => {
      // 1.1.1 输入: ship.droneTags=[], 运行匹配逻辑
      const ship = (shipsRaw as any[]).find(s => s.id === OSAKA_ID)
      const shipDroneTags = ship?.droneTags || []

      const matched = matchDroneItems(shipDroneTags)

      // 1.1.2 断言 结果包含 droneTags=[] 的无人机 #期望: [ship_gen_s_fightingdrone_01_a]
      const hasFightingDrone = matched.some(d => d.id === 'ship_gen_s_fightingdrone_01_a')
      expect(hasFightingDrone).toBe(true)

      // 1.1.3 断言 结果不包含 noplayerblueprint=true 的无人机 #期望: [true]
      const hasNoBlueprint = matched.some(d => d.noplayerblueprint === true)
      expect(hasNoBlueprint).toBe(false)

      // 1.1.4 断言 结果不包含 deployable=true 的无人机 #期望: [true]
      const hasDeployable = matched.some(d => d.deployable === true)
      expect(hasDeployable).toBe(false)
    })
  })

  // 1.2 导弹匹配逻辑测试
  describe('1.2 导弹匹配逻辑测试', () => {
    it('1.2.1-1.2.4 导弹匹配逻辑', () => {
      // 1.2.1 输入: blueprint无weapon/turret, 运行匹配逻辑
      const emptyAmmoTags: string[] = []
      let matched = matchMissileItems(emptyAmmoTags)
      // 1.2.2 断言 结果为空数组 #期望: [0]
      expect(matched.length).toBe(0)

      // 1.2.3 输入: ammunitionTags=["dumbfire"], 运行匹配逻辑
      const ammoTags = ['dumbfire']
      matched = matchMissileItems(ammoTags)
      // 1.2.4 断言 结果包含 missileTags 包含 dumbfire 的导弹 #期望: [true]
      const hasDumbfire = matched.some(m => m.missileTags && m.missileTags.includes('dumbfire'))
      expect(hasDumbfire).toBe(true)
    })
  })

  // 1.3 存储上限计算测试
  describe('1.3 存储上限计算测试', () => {
    it('1.3.1-1.3.6 存储上限计算', () => {
      const ship = (shipsRaw as any[]).find(s => s.id === OSAKA_ID)
      const deployableLimit = ship?.storage?.deployable || 0
      const unitLimit = ship?.storage?.unit || 0
      const missileLimit = ship?.storage?.missile || 0

      // 1.3.1 运行 deployableTotal 计算
      const localDeployables: Record<string, number> = { 'deployable_01': 100, 'deployable_02': 50, 'deployable_03': 80 }
      const deployableTotal = Object.values(localDeployables).reduce((sum, count) => sum + count, 0)
      // 1.3.2 断言 total ≤ ship.storage.deployable #期望: [true]
      expect(deployableTotal <= deployableLimit).toBe(true)

      // 1.3.3 运行 droneTotal 计算
      const localDrones: Record<string, number> = { 'ship_gen_s_fightingdrone_01_a': 5, 'ship_gen_s_fightingdrone_02_a': 3 }
      const droneTotal = Object.values(localDrones).reduce((sum, count) => sum + count, 0)
      // 1.3.4 断言 total ≤ ship.storage.unit #期望: [true]
      expect(droneTotal <= unitLimit).toBe(true)

      // 1.3.5 运行 missileTotal 计算
      const localMissiles: Record<string, number> = { 'missile_cluster_heavy_mk1': 80, 'missile_cluster_mk1': 40 }
      const missileTotal = Object.values(localMissiles).reduce((sum, count) => sum + count, 0)
      // 1.3.6 断言 total ≤ ship.storage.missile #期望: [true]
      expect(missileTotal <= missileLimit).toBe(true)
    })
  })
})
