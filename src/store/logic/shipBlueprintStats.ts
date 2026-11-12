import { useEquipmentStats } from '@/composables/useEquipmentStats'
import type { X4Ship, ShipBlueprint, X4Equipment } from '@/types/x4'

type ShipStatMetric = {
  key: string;
  labelKey: string;
  unit: string;
  value: number;
  ratio: number;
}


export function createShipStatsCalculation(ship: X4Ship | null, store: {
  findEquipment: (id: string) => X4Equipment | null
  isEquipmentDlcUsable: (id: string) => boolean
}) {
const selectedShip = { value: ship }
const isEquipmentActiveForStats = (id: string | null | undefined) => Boolean(id) && store.isEquipmentDlcUsable(id!)
/**
 * 聚合所有已装备的武器 DPS (使用 useEquipmentStats)
 */
const getWeaponStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return { burst: 0, sustained: 0 }

  let totalBurst = 0
  let totalSustained = 0

  blueprintData.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      if (!isEquipmentActiveForStats(g.equipment_id)) return
      const equipment = store.findEquipment(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      if (equipmentClass !== 'weapon' && equipmentClass !== 'missilelauncher') return

      const { details } = useEquipmentStats(equipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        totalBurst += d.burstDPS * g.count
        totalSustained += d.sustainedDPS * g.count
      }
    })
  })

  return { burst: totalBurst, sustained: totalSustained }
}

/**
 * 聚合所有已装备的炮塔 DPS (使用 useEquipmentStats)
 */
const getTurretStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return 0

  let totalDamage = 0
  let turretCount = 0

  blueprintData.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      if (!isEquipmentActiveForStats(g.equipment_id)) return
      const equipment = store.findEquipment(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      if (equipmentClass !== 'turret' && equipmentClass !== 'missileturret') return

      const { details } = useEquipmentStats(equipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        totalDamage += d.sustainedDPS * g.count
        turretCount += g.count
      }
    })
  })

  // 按已安装炮塔数量加权，返回平均持续 DPS
  return turretCount > 0 ? totalDamage / turretCount : 0
}

/**
 * 聚合护盾属性 (使用 useEquipmentStats)
 */
const getShieldStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return { max: 0, rate: 0, delay: 0, groupAvg: 0 }

  let max = 0
  let rate = 0
  let delay = 0

  // 专用 shield 槽位
  blueprintData.connections.forEach((conn) => {
    if (conn.slot_type !== 'shield') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      if (!isEquipmentActiveForStats(g.equipment_id)) return
      const equipment = store.findEquipment(g.equipment_id)
      if (!equipment?.recharge) return

      const { details } = useEquipmentStats(equipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        max += (d.shieldMax || 0) * g.count
        rate += (d.shieldRate || 0) * g.count
        delay = Math.max(delay, d.shieldDelay || 0)
      }
    })
  })

  // 挂载护盾
  let mountedShieldMax = 0
  let mountedShieldGroups = 0

  blueprintData.connections.forEach((conn) => {
    if (conn.slot_type === 'shield') return
    conn.group.forEach((g) => {
      if (!g.shield?.equipment_id || g.shield.count <= 0) return
      if (!isEquipmentActiveForStats(g.shield.equipment_id)) return
      const shieldEquipment = store.findEquipment(g.shield.equipment_id)
      if (!shieldEquipment?.recharge) return

      const { details } = useEquipmentStats(shieldEquipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        mountedShieldMax += (d.shieldMax || 0) * g.shield.count
        mountedShieldGroups++
      }
    })
  })

  const groupAvg = mountedShieldGroups > 0 ? mountedShieldMax / mountedShieldGroups : 0

  return { max, rate, delay, groupAvg }
}

/**
 * 聚合引擎属性 (使用 useEquipmentStats)
 */
const getEngineStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return null

  let thrustForward = 0
  let boostMultiplier = 1
  let boostAcceleration = 1
  let boostDuration = 0
  let boostRecharge = 0
  let travelThrust = 0
  let travelAttack = 0
  let travelCharge = 0

  blueprintData.connections.forEach((conn) => {
    if (conn.slot_type !== 'engine') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      if (!isEquipmentActiveForStats(g.equipment_id)) return
      const equipment = store.findEquipment(g.equipment_id)
      if (!equipment) return

      const { details } = useEquipmentStats(equipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        thrustForward += (d.thrustForward || 0) * g.count
        if (d.boostMultiplier) boostMultiplier = d.boostMultiplier
        if (d.boostAcceleration) boostAcceleration = d.boostAcceleration
        if (d.boostDuration) boostDuration = Math.max(boostDuration, d.boostDuration)
        if (d.boostRecharge) boostRecharge = Math.max(boostRecharge, d.boostRecharge)
        if (d.travelThrust) travelThrust += d.travelThrust * g.count
        if (d.travelAttack) travelAttack = Math.max(travelAttack, d.travelAttack)
        if (d.travelCharge) travelCharge = Math.max(travelCharge, d.travelCharge)
      }
    })
  })

  if (thrustForward === 0) return null
  return {
    thrustForward,
    boostMultiplier,
    boostAcceleration,
    boostDuration,
    boostRecharge,
    travelThrust,
    travelAttack,
    travelCharge
  }
}

/**
 * 聚合推进器属性 (使用 useEquipmentStats)
 */
const getThrusterStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return null

  let pitch = 0
  let yaw = 0
  let roll = 0
  let strafe = 0

  blueprintData.connections.forEach((conn) => {
    if (conn.slot_type !== 'thruster') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      if (!isEquipmentActiveForStats(g.equipment_id)) return
      const equipment = store.findEquipment(g.equipment_id)
      if (!equipment) return

      const { details } = useEquipmentStats(equipment, selectedShip.value!)
      if (details.value) {
        const d = details.value as any
        pitch += (d.pitch || 0) * g.count
        yaw += (d.yaw || 0) * g.count
        roll += (d.roll || 0) * g.count
        strafe += (d.strafe || 0) * g.count
      }
    })
  })

  if (pitch === 0 && yaw === 0 && roll === 0 && strafe === 0) return null
  return { pitch, yaw, roll, strafe }
}

// Helper to get cargo capacity by type
const getCargoCapacity = (ship: X4Ship, type: string) => {
  if (!Array.isArray(ship.cargo)) return 0
  const cargo = ship.cargo.find(c => c.type === type)
  return cargo?.capacity || 0
}

// Helper to get dock count by size
const getDockCount = (ship: X4Ship, size: string) => {
  if (!Array.isArray(ship.dockarea)) return 0
  const dockarea = ship.dockarea.find(d => d.size === size)
  return dockarea?.capacity || 0
}

// Helper to get ship storage capacity by size
const getShipStorageCapacity = (ship: X4Ship, size: string) => {
  if (!Array.isArray(ship.shipstorage)) return 0
  const storage = ship.shipstorage.find(s => s.size === size)
  return storage?.capacity || 0
}

// 完整 36 个数据点 (18行 x 2列)
const buildDetailStatsByUseEquipmentStats = (ship: X4Ship, blueprintData: ShipBlueprint | null): Omit<ShipStatMetric, 'ratio'>[] => {
  const shieldStats = getShieldStatsByUseEquipmentStats(blueprintData)
  const engineStats = getEngineStatsByUseEquipmentStats(blueprintData)
  const weaponStats = getWeaponStatsByUseEquipmentStats(blueprintData)
  const turretAvg = getTurretStatsByUseEquipmentStats(blueprintData)
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1
  const dragHorizontal = ship.physics?.drag?.horizontal || 1
  const dragPitch = ship.physics?.drag?.pitch || 1
  const dragYaw = ship.physics?.drag?.yaw || 1
  const dragRoll = ship.physics?.drag?.roll || 1
  const accfactorsHorizontal = ship.physics?.accfactors?.horizontal || 1

  const baseSpeed = engineStats ? engineStats.thrustForward / dragForward : 0
  const travelSpeed = engineStats ? engineStats.travelThrust / dragForward : 0
  const boostSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.boostMultiplier) : 0
  const baseAcceleration = engineStats ? engineStats.thrustForward / mass : 0
  const boostAcceleration = engineStats ? Math.round(baseAcceleration * engineStats.boostAcceleration) : 0
  const travelAcceleration = engineStats && engineStats.travelAttack ? Math.round(travelSpeed / engineStats.travelAttack) : 0
  const boostRecharge = engineStats ? engineStats.boostRecharge / 100 : 0

  const thrusterStats = getThrusterStatsByUseEquipmentStats(blueprintData)
  const pitchRate = thrusterStats ? thrusterStats.pitch / dragPitch : 0
  const yawRate = thrusterStats ? thrusterStats.yaw / dragYaw : 0
  const rollRate = thrusterStats ? thrusterStats.roll / dragRoll : 0
  const strafeSpeed = thrusterStats ? Math.round(thrusterStats.strafe / dragHorizontal) : 0
  const strafeAcceleration = thrusterStats ? Math.round(thrusterStats.strafe / mass * accfactorsHorizontal) : 0

  // 18x2 排布: 完整数据 [左1, 右1, 左2, 右2, ...]
  return [
    // 行1: Hull | Weapon Burst
    { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', value: ship.hull || 0 },
    { key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: Math.round(weaponStats.burst * 10) / 10 },
    // 行2: Shield | Turret Avg
    { key: 'shield', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: shieldStats.max },
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: Math.round(turretAvg * 10) / 10 },
    // 行3: Shield Recharge Rate | Weapon Sustained
    { key: 'shield_recharge_rate', labelKey: 'ship_build.stats_shield_recharge_rate', unit: 'MW', value: shieldStats.rate },
    { key: 'weapon_sustained', labelKey: 'ship_build.stats_weapon_sustained', unit: 'MW', value: Math.round(weaponStats.sustained * 10) / 10 },
    // 行4: Shield Recharge Delay | Speed
    { key: 'shield_recharge_delay', labelKey: 'ship_build.stats_shield_recharge_delay', unit: 's', value: shieldStats.delay },
    { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s', value: Math.round(baseSpeed) },
    // 行5: Shield Group Avg | Acceleration
    { key: 'shield_group_avg', labelKey: 'ship_build.stats_shield_group_avg', unit: 'MJ', value: shieldStats.groupAvg },
    { key: 'acceleration', labelKey: 'ship_build.stats_acceleration', unit: 'm/s2', value: Math.round(baseAcceleration) },
    // 行6: Container | Boost Speed
    { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3', value: getCargoCapacity(ship, 'container') },
    { key: 'boost_speed', labelKey: 'ship_build.stats_boost_speed', unit: 'm/s', value: boostSpeed },
    // 行7: Solid | Boost Acceleration
    { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', value: getCargoCapacity(ship, 'solid') },
    { key: 'boost_acceleration', labelKey: 'ship_build.stats_boost_acceleration', unit: 'm/s2', value: boostAcceleration },
    // 行8: Liquid | Boost Duration
    { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', value: getCargoCapacity(ship, 'liquid') },
    { key: 'boost_duration', labelKey: 'ship_build.stats_boost_duration', unit: 's', value: engineStats?.boostDuration || 0 },
    // 行9: Condensed | Boost Recharge
    { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', value: getCargoCapacity(ship, 'condensed') },
    { key: 'boost_recharge', labelKey: 'ship_build.stats_boost_recharge', unit: '%/s', value: boostRecharge },
    // 行10: Yaw | Travel Speed
    { key: 'yaw', labelKey: 'ship_build.stats_yaw', unit: 'rad/s', value: Math.round(yawRate * 100) / 100 },
    { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s', value: Math.round(travelSpeed) },
    // 行11: Pitch | Travel Acceleration
    { key: 'pitch', labelKey: 'ship_build.stats_pitch', unit: 'rad/s', value: Math.round(pitchRate * 100) / 100 },
    { key: 'travel_acceleration', labelKey: 'ship_build.stats_travel_acceleration', unit: 'm/s2', value: travelAcceleration },
    // 行12: Roll | Travel Charge Time
    { key: 'roll', labelKey: 'ship_build.stats_roll', unit: 'rad/s', value: Math.round(rollRate * 100) / 100 },
    { key: 'travel_charge_time', labelKey: 'ship_build.stats_travel_charge_time', unit: 's', value: engineStats?.travelCharge || 0 },
    // 行13: Radar Range | Strafe Speed
    { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: Math.round((ship.radarRange || 0) / 1000) },
    { key: 'strafe_speed', labelKey: 'ship_build.stats_strafe_speed', unit: 'm/s', value: strafeSpeed },
    // 行14: Crew | Strafe Acceleration
    { key: 'crew', labelKey: 'ship_build.stats_crew', unit: '', value: ship.crew?.capacity || 0 },
    { key: 'strafe_acceleration', labelKey: 'ship_build.stats_strafe_acceleration', unit: 'm/s2', value: strafeAcceleration },
    // 行15: Unit Storage | M Dock Count
    { key: 'storage_unit', labelKey: 'ship_build.stats_storage_unit', unit: '', value: ship.storage?.unit || 0 },
    { key: 'dock_m_count', labelKey: 'ship_build.stats_dock_m_count', unit: '', value: getDockCount(ship, 'dock_m') },
    // 行16: Missile | M Dock Capacity
    { key: 'missile', labelKey: 'ship_build.stats_missile', unit: '', value: ship.storage?.missile || 0 },
    { key: 'dock_m_capacity', labelKey: 'ship_build.stats_dock_m_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_m') },
    // 行17: Deployable | S Dock Count
    { key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', value: ship.storage?.deployable || 0 },
    { key: 'dock_s_count', labelKey: 'ship_build.stats_dock_s_count', unit: '', value: getDockCount(ship, 'dock_s') },
    // 行18: Countermeasure | S Dock Capacity
    { key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', value: ship.storage?.countermeasure || 0 },
    { key: 'dock_s_capacity', labelKey: 'ship_build.stats_dock_s_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_s') }
  ]
}

return { buildDetailStatsByUseEquipmentStats, getWeaponStatsByUseEquipmentStats,
  getTurretStatsByUseEquipmentStats, getShieldStatsByUseEquipmentStats,
  getEngineStatsByUseEquipmentStats, getThrusterStatsByUseEquipmentStats }
}
