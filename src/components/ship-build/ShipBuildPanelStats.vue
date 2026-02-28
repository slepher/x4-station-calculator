<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { X4Ship, X4Equipment, ShipBlueprint } from '@/types/x4'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'

const props = defineProps<{
  shipBlueprint: ShipBlueprint | null
}>()

const { t } = useI18n()

// 全局字典数据 - 直接从 store 读取
const store = useShipBuildStore()

// Bullet map - use id as key
const bulletMap = new Map<string, any>()
bulletsRaw.forEach((b: any) => {
  bulletMap.set(b.id, b)
})

// Missile map - use macro as key (equipment.bullet stores macro value)
const missileMap = new Map<string, any>()
missilesRaw.forEach((m: any) => {
  missileMap.set(m.macro, m)
})

// ============ 内部状态 ============
const statsViewMode = ref<'summary' | 'detail'>('summary')

// ============ Store 数据映射 ============
const shipMap = computed(() => {
  const map = new Map<string, X4Ship>()
  store.ships.forEach((ship) => {
    map.set(ship.id, ship)
  })
  return map
})

const equipmentMap = computed(() => {
  const map = new Map<string, X4Equipment>()
  store.equipments.forEach((eq) => {
    map.set(eq.id, eq)
  })
  return map
})

// ============ 从 Blueprint 派生数据 ============
// 优先从 blueprint 获取 shipId，如果没有 blueprint 则从 store 获取
const selectedShip = computed(() => {
  // 优先从 blueprint 获取 shipId
  const shipId = props.shipBlueprint?.shipId || store.selectedShipId
  if (!shipId) return null
  return shipMap.value.get(shipId) || null
})

type ShipStatMetric = {
  key: string;
  labelKey: string;
  unit: string;
  value: number;
  ratio: number;
}

type ShipStatDisplay = {
  key: string;
  labelKey: string;
  unit: string;
  valueText: string;
  ratio: number | null;
  placeholder?: boolean;
}

// Placeholder fields that don't have data sources yet
const placeholderKeys = new Set<string>([])

// Get aggregated shield stats from selected shield equipment
// 护盾 (shield)：保护船体的护盾，装在专用 shield 槽位上
// 挂载护盾 (shield on equipment)：装在其他槽位（engine、weapon 等）上，保护被挂载的装备
const getShieldStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return { max: 0, rate: 0, delay: 0, groupAvg: 0, mountedShieldMax: 0 }
  let max = 0
  let rate = 0
  let delay = 0

  // 遍历 blueprint.connections 找到专用 shield 槽位
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'shield') return
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.recharge) return
      // 护盾 = 专用槽护盾，含 count
      max += (equipment.recharge.max || 0) * (g.count || 1)
      rate += (equipment.recharge.rate || 0) * (g.count || 1)
      delay = Math.max(delay, equipment.recharge.delay || 0)
    })
  })

  // 计算挂载护盾（shield on equipment）：非专用 shield 槽位上挂载的护盾
  let mountedShieldMax = 0
  let mountedShieldGroups = 0

  props.shipBlueprint.connections.forEach((conn) => {
    // 跳过专用 shield 槽
    if (conn.slot_type === 'shield') return
    conn.group.forEach((g) => {
      if (!g.shield) return
      const shieldEquipment = equipmentMap.value.get(g.shield.equipment_id)
      if (!shieldEquipment?.recharge) return
      mountedShieldMax += (shieldEquipment.recharge.max || 0) * (g.shield.count || 0)
      mountedShieldGroups++
    })
  })

  // 编组平均护盾容量 = 非护盾槽位上挂载的护盾容量总和 / 有护盾挂载的非护盾槽位 group 数量
  const groupAvg = mountedShieldGroups > 0 ? mountedShieldMax / mountedShieldGroups : 0

  return { max, rate, delay, groupAvg, mountedShieldMax }
}


// Get aggregated engine stats from selected engine equipment
const getEngineStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  // 收集所有 engine 装备
  const engineEquipments: Array<{ equipment: X4Equipment; count: number }> = []
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'engine') return
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (equipment) {
        engineEquipments.push({ equipment, count: g.count })
      }
    })
  })

  if (engineEquipments.length === 0) return null

  let thrustForward = 0
  let boostMultiplier = 1
  let boostAcceleration = 1  // boost.acceleration 乘数
  let boostDuration = 0
  let boostRecharge = 0  // 需要除以100转换
  let travelThrust = 0  // thrustForward × travel.thrust × count 累积值
  let travelAttack = 0  // travel.attack 用于计算巡航加速度
  let travelCharge = 0
  let engineCount = 0

  engineEquipments.forEach(({ equipment, count }) => {
    if (!equipment) return
    engineCount += count
    const fwd = equipment.thrust?.forward || 0
    const travelT = equipment.travel?.thrust || 0
    thrustForward += fwd * count
    // 巡航推力 = 前向推力 × 巡航乘数 × 数量
    travelThrust += fwd * travelT * count
    if (equipment.boost?.thrust) boostMultiplier = equipment.boost.thrust
    if (equipment.boost?.acceleration) boostAcceleration = equipment.boost.acceleration
    if (equipment.boost?.duration) boostDuration = Math.max(boostDuration, equipment.boost.duration)
    if (equipment.boost?.recharge) boostRecharge = Math.max(boostRecharge, equipment.boost.recharge)
    if (equipment.travel?.attack) travelAttack = Math.max(travelAttack, equipment.travel.attack)
    if (equipment.travel?.charge) travelCharge = Math.max(travelCharge, equipment.travel.charge)
  })

  if (thrustForward === 0) return null
  return {
    thrustForward,
    boostMultiplier,
    boostAcceleration,
    boostDuration,
    boostRecharge,
    travelThrust,
    travelMultiplier: travelThrust,
    travelAttack,
    travelCharge,
    engineCount
  }
}

// Get aggregated thruster stats from selected thruster equipment
// 转向率 = 推进器单轴推力 / 船体单轴阻力
const getThrusterStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  // 收集所有 thruster 装备
  const thrusterEquipments: Array<{ equipment: X4Equipment; count: number }> = []
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'thruster') return
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (equipment) {
        thrusterEquipments.push({ equipment, count: g.count })
      }
    })
  })

  if (thrusterEquipments.length === 0) return null

  let pitch = 0
  let yaw = 0
  let roll = 0
  let strafe = 0

  thrusterEquipments.forEach(({ equipment, count }) => {
    if (!equipment?.thrust) return
    const c = count || 1
    if (equipment.thrust.pitch) pitch += equipment.thrust.pitch * c
    if (equipment.thrust.yaw) yaw += equipment.thrust.yaw * c
    if (equipment.thrust.roll) roll += equipment.thrust.roll * c
    if (equipment.thrust.strafe) strafe += equipment.thrust.strafe * c
  })

  if (pitch === 0 && yaw === 0 && roll === 0 && strafe === 0) return null
  return { pitch, yaw, roll, strafe }
}

// 判断是否为 Beam 武器
const isBeamWeapon = (bullet: any): boolean => {
  return bullet.type === 'beam'
}

// 持久 DPS 计算函数（bullet 和 Beam 通用）
const calculateSustainedDPS = (
  burstDPS: number,
  singleDamage: number,
  singleHeat: number,
  weaponHeat: any,
  count: number
): number => {
  const overheatThreshold = 10000

  if (!weaponHeat?.overheat || !weaponHeat?.coolrate || singleHeat <= 0) {
    return burstDPS
  }

  const avgHeatPerSec = burstDPS / singleDamage * singleHeat
  const timeToOverheat = avgHeatPerSec > 0 ? overheatThreshold / avgHeatPerSec : 0
  const cycleTime = timeToOverheat + weaponHeat.cooldelay + (overheatThreshold / weaponHeat.coolrate)
  return cycleTime > 0 ? burstDPS * (timeToOverheat / cycleTime) * count : 0
}

// 通用武器 DPS 计算函数
// 返回 { burstDPS, sustainedDPS }，如果不支持则返回 null
const calculateWeaponDPS = (equipment: any, bullet: any, missile: any, count: number) => {
  // 处理 bullets.json (weapon/turret)
  if (bullet) {
    const weaponHeat = equipment.heat
    const isBeam = isBeamWeapon(bullet)

    // 子弹类变量
    let singleDamage: number      // 单发伤害
    let singleHeat: number       // 单发热量
    let singleShotTime: number   // 单发射击时间

    if (isBeam) {
      // Beam 类
      const lifetime = bullet.lifetime
      const damage = bullet.damage
      const reload = bullet.reload
      const chargetime = bullet.chargetime
      const ammo = bullet.ammo
      const ammoReload = bullet.ammoreload

      singleDamage = damage * lifetime
      singleShotTime = chargetime + Math.max(lifetime, reload)

      // Beam 使用近似公式
      const avgShotTime = (ammo * singleShotTime + ammoReload) / Math.max(ammo, 1)
      const burstDPS = avgShotTime > 0 ? (singleDamage / avgShotTime) * count : 0

      // 持续 DPS
      singleHeat = bullet.shotHeat + bullet.heat * lifetime
      const sustainedDPS = calculateSustainedDPS(burstDPS, singleDamage, singleHeat, weaponHeat, count)

      return { burstDPS, sustainedDPS }
    } else {
      // 子弹类
      const damage = bullet.damage
      const amount = bullet.amount
      const reload = bullet.reload
      const chargetime = bullet.chargetime
      const ammo = bullet.ammo
      const ammoReload = bullet.ammoreload

      singleDamage = damage * amount
      singleHeat = bullet.shotHeat
      singleShotTime = chargetime + reload

      // 爆发 DPS（统一公式：换弹时间平摊到每发）
      const avgShotTime = (ammo * singleShotTime + ammoReload) / Math.max(ammo, 1)
      const burstDPS = avgShotTime > 0 ? (singleDamage / avgShotTime) * count : 0

      // 持续 DPS（使用通用函数）
      const sustainedDPS = calculateSustainedDPS(burstDPS, singleDamage, singleHeat, weaponHeat, count)

      return { burstDPS, sustainedDPS }
    }
  }

  // 处理 missiles.json (missilelauncher/missileturret)
  if (missile) {
    const explosive = missile.explosive || 0
    const reload = missile.reload || 1
    const dps = (explosive / reload) * count
    return { burstDPS: dps, sustainedDPS: dps }
  }

  return null
}

// Get weapon damage stats from blueprint.connections (根据 equipment.class 决定弹药类型)
const getWeaponDamageStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return { burst: 0, sustained: 0 }

  let totalBurst = 0
  let totalSustained = 0

  // 遍历 blueprint.connections 获取所有已装备设备
  props.shipBlueprint.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      const count = g.count || 1

      // 只处理 weapon 和 missilelauncher
      if (equipmentClass !== 'weapon' && equipmentClass !== 'missilelauncher') return

      const bullet = equipmentClass === 'weapon' ? bulletMap.get(equipment.bullet) : null
      const missile = equipmentClass === 'missilelauncher' ? missileMap.get(equipment.bullet) : null

      const result = calculateWeaponDPS(equipment, bullet, missile, count)
      if (result) {
        totalBurst += result.burstDPS
        totalSustained += result.sustainedDPS
      }
    })
  })

  return { burst: totalBurst, sustained: totalSustained }
}

// Get turret average damage (只计算 turret 和 missileturret class)
const getTurretDamageStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return 0

  let totalDamage = 0
  let turretCount = 0

  props.shipBlueprint.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      // 只计算 turret 和 missileturret class
      if (equipmentClass !== 'turret' && equipmentClass !== 'missileturret') return

      const count = g.count || 1
      const bullet = equipmentClass === 'turret' ? bulletMap.get(equipment.bullet) : null
      const missile = equipmentClass === 'missileturret' ? missileMap.get(equipment.bullet) : null

      const result = calculateWeaponDPS(equipment, bullet, missile, count)
      if (result) {
        totalDamage += result.sustainedDPS
        turretCount += count
      }
    })
  })

  return turretCount > 0 ? totalDamage / turretCount : 0
}

// Calculate speed from thrust and ship physics
// 最高速度 = 引擎前向推力 / 船体前向阻力
const calculateSpeed = (thrust: number, drag: number) => {
  if (!drag) return 0
  return Math.round(thrust / drag)
}

// Calculate acceleration from thrust and mass
// 加速度 = 引擎前向推力 / 飞船总质量
const calculateAcceleration = (thrust: number, mass: number) => {
  if (!mass) return 0
  return Math.round(thrust / mass)
}

// Helper to get cargo capacity by type
const getCargoCapacity = (ship: X4Ship, type: string) => {
  const cargo = ship.cargo.find(c => c.type === type)
  return cargo?.capacity || 0
}

// Helper to get dock count by size
const getDockCount = (ship: X4Ship, size: string) => {
  const dockarea = ship.dockarea.find(d => d.size === size)
  return dockarea?.capacity || 0
}

// Helper to get ship storage capacity by size
const getShipStorageCapacity = (ship: X4Ship, size: string) => {
  const storage = ship.shipstorage.find(s => s.size === size)
  return storage?.capacity || 0
}

// Build summary stats (对齐截图2)
const buildSummaryStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const shieldStats = getShieldStats()
  const engineStats = getEngineStats()
  const weaponStats = getWeaponDamageStats()
  const turretAvg = getTurretDamageStats()
  const dragForward = ship.physics?.drag?.forward || 1

  const baseSpeed = engineStats ? calculateSpeed(engineStats.thrustForward, dragForward) : 0
  // 巡航速度 = (引擎前向推力 * 引擎巡航推力乘数) / 船体前向阻力
  const travelSpeed = engineStats ? calculateSpeed(engineStats.travelThrust, dragForward) : 0
  // 助推速度 = 最高速度 * 助推推力乘数
  const boostSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.boostMultiplier) : 0

  return [
    { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', value: ship.hull || 0 },
    { key: 'shield', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: shieldStats.max },
    { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: Math.round((ship.radarRange || 0) / 1000) },
    { key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: Math.round(weaponStats.burst * 10) / 10 },
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
    { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3', value: getCargoCapacity(ship, 'container') },
    { key: 'dock_m_count', labelKey: 'ship_build.stats_dock_m_count', unit: '', value: getDockCount(ship, 'dock_m') },
    { key: 'dock_m_capacity', labelKey: 'ship_build.stats_dock_m_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_m') },
    { key: 'dock_s_count', labelKey: 'ship_build.stats_dock_s_count', unit: '', value: getDockCount(ship, 'dock_s') },
    { key: 'dock_s_capacity', labelKey: 'ship_build.stats_dock_s_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_s') },
    { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s', value: baseSpeed },
    { key: 'boost_speed', labelKey: 'ship_build.stats_boost_speed', unit: 'm/s', value: boostSpeed },
    { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s', value: travelSpeed },
    { key: 'crew', labelKey: 'ship_build.stats_crew', unit: '', value: ship.crew?.capacity || 0 },
    { key: 'storage_unit', labelKey: 'ship_build.stats_storage_unit', unit: '', value: ship.storage?.unit || 0 },
    { key: 'missile', labelKey: 'ship_build.stats_missile', unit: '', value: ship.storage?.missile || 0 },
    { key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', value: ship.storage?.deployable || 0 },
    { key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', value: ship.storage?.countermeasure || 0 }
  ]
}

// Build detail stats
const buildDetailStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const summaryStats = buildSummaryStats(ship)
  const shieldStats = getShieldStats()
  const engineStats = getEngineStats()
  const weaponStats = getWeaponDamageStats()
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1
  const dragHorizontal = ship.physics?.drag?.horizontal || 1
  const dragPitch = ship.physics?.drag?.pitch || 1
  const dragYaw = ship.physics?.drag?.yaw || 1
  const dragRoll = ship.physics?.drag?.roll || 1
  const accfactorsHorizontal = ship.physics?.accfactors?.horizontal || 1

  const baseAcceleration = engineStats ? calculateAcceleration(engineStats.thrustForward, mass) : 0
  // 助推加速度 = 基础加速度 × boost.acceleration
  const boostAcceleration = engineStats ? Math.round(baseAcceleration * engineStats.boostAcceleration) : 0
  // 巡航加速度 = 巡航速度 / travel.attack
  const travelSpeed = engineStats ? calculateSpeed(engineStats.travelThrust, dragForward) : 0
  const travelAcceleration = engineStats && engineStats.travelAttack ? Math.round(travelSpeed / engineStats.travelAttack) : 0
  // 助推回充率 = boost.recharge / 100
  const boostRecharge = engineStats ? engineStats.boostRecharge / 100 : 0

  // 转向率 = 推进器单轴推力 / 船体单轴阻力
  const thrusterStats = getThrusterStats()
  const pitchRate = thrusterStats ? thrusterStats.pitch / dragPitch : 0
  const yawRate = thrusterStats ? thrusterStats.yaw / dragYaw : 0
  const rollRate = thrusterStats ? thrusterStats.roll / dragRoll : 0
  // 平移速度 = thruster.strafe / 船体水平阻力
  const strafeSpeed = thrusterStats ? Math.round(thrusterStats.strafe / dragHorizontal) : 0
  // 平移加速度 = thruster.strafe / 船体质量 × accfactors.horizontal
  const strafeAcceleration = thrusterStats ? Math.round(thrusterStats.strafe / mass * accfactorsHorizontal) : 0

  const extraStats: Omit<ShipStatMetric, 'ratio'>[] = [
    { key: 'shield_recharge_rate', labelKey: 'ship_build.stats_shield_recharge_rate', unit: 'MW', value: shieldStats.rate },
    { key: 'shield_recharge_delay', labelKey: 'ship_build.stats_shield_recharge_delay', unit: 's', value: shieldStats.delay },
    { key: 'shield_group_avg', labelKey: 'ship_build.stats_shield_group_avg', unit: 'MJ', value: shieldStats.groupAvg },
    { key: 'weapon_sustained', labelKey: 'ship_build.stats_weapon_sustained', unit: 'MW', value: Math.round(weaponStats.sustained * 10) / 10 },
    { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', value: getCargoCapacity(ship, 'solid') },
    { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', value: getCargoCapacity(ship, 'liquid') },
    { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', value: getCargoCapacity(ship, 'condensed') },
    { key: 'acceleration', labelKey: 'ship_build.stats_acceleration', unit: 'm/s2', value: baseAcceleration },
    { key: 'boost_acceleration', labelKey: 'ship_build.stats_boost_acceleration', unit: 'm/s2', value: boostAcceleration },
    { key: 'boost_duration', labelKey: 'ship_build.stats_boost_duration', unit: 's', value: engineStats?.boostDuration || 0 },
    { key: 'boost_recharge', labelKey: 'ship_build.stats_boost_recharge', unit: '%/s', value: boostRecharge },
    { key: 'travel_acceleration', labelKey: 'ship_build.stats_travel_acceleration', unit: 'm/s2', value: travelAcceleration },
    { key: 'travel_charge_time', labelKey: 'ship_build.stats_travel_charge_time', unit: 's', value: engineStats?.travelCharge || 0 },
    { key: 'strafe_speed', labelKey: 'ship_build.stats_strafe_speed', unit: 'm/s', value: strafeSpeed },
    { key: 'strafe_acceleration', labelKey: 'ship_build.stats_strafe_acceleration', unit: 'm/s2', value: strafeAcceleration },
    { key: 'yaw', labelKey: 'ship_build.stats_yaw', unit: 'rad/s', value: Math.round(yawRate * 100) / 100 },
    { key: 'pitch', labelKey: 'ship_build.stats_pitch', unit: 'rad/s', value: Math.round(pitchRate * 100) / 100 },
    { key: 'roll', labelKey: 'ship_build.stats_roll', unit: 'rad/s', value: Math.round(rollRate * 100) / 100 }
  ]

  return [...summaryStats, ...extraStats]
}

// Calculate max values for bar ratios
const calculateMaxStats = (ship: X4Ship) => {
  const classShips = store.ships.filter(s => s.class === ship.class)
  const summaryMax: Record<string, number> = {}
  const detailMax: Record<string, number> = {}

  const sampleSummary = buildSummaryStats(ship)
  sampleSummary.forEach(metric => {
    const maxValue = Math.max(
      ...classShips.map(s => {
        const stats = buildSummaryStats(s)
        const match = stats.find(item => item.key === metric.key)
        return match?.value || 0
      }),
      1
    )
    summaryMax[metric.key] = maxValue
  })

  const sampleDetail = buildDetailStats(ship)
  sampleDetail.forEach(metric => {
    const maxValue = Math.max(
      ...classShips.map(s => {
        const stats = buildDetailStats(s)
        const match = stats.find(item => item.key === metric.key)
        return match?.value || 0
      }),
      1
    )
    detailMax[metric.key] = maxValue
  })

  return { summaryMax, detailMax }
}

const formatStatValue = (value: number) => value.toLocaleString()

const summaryShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value) return []
  const stats = buildSummaryStats(selectedShip.value)
  const { summaryMax } = calculateMaxStats(selectedShip.value)

  return stats.map(metric => ({
    key: metric.key,
    labelKey: metric.labelKey,
    unit: metric.unit,
    valueText: formatStatValue(metric.value),
    ratio: Math.max(0.03, Math.min(1, metric.value / (summaryMax[metric.key] || 1))),
    placeholder: placeholderKeys.has(metric.key)
  }))
})

const detailedShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value) return []
  const stats = buildDetailStats(selectedShip.value)
  const { detailMax } = calculateMaxStats(selectedShip.value)

  return stats.map(metric => ({
    key: metric.key,
    labelKey: metric.labelKey,
    unit: metric.unit,
    valueText: placeholderKeys.has(metric.key) ? '--' : formatStatValue(metric.value),
    ratio: placeholderKeys.has(metric.key) ? null : Math.max(0.03, Math.min(1, metric.value / (detailMax[metric.key] || 1))),
    placeholder: placeholderKeys.has(metric.key)
  }))
})

const visibleShipStats = computed<ShipStatDisplay[]>(() => {
  return statsViewMode.value === 'summary' ? summaryShipStats.value : detailedShipStats.value
})

const setStatsViewMode = (mode: 'summary' | 'detail') => {
  statsViewMode.value = mode
}
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-stats">
    <div class="panel-header">{{ t('ship_build.panel_stats') }}</div>
    <div class="stats-panel" data-testid="ship-build-stats-panel">
      <div class="stats-toolbar">
        <div class="stats-caption">{{ t('ship_build.stats_preview') }}</div>
        <div class="stats-mode-switch">
          <button
            data-testid="ship-build-stats-mode-summary"
            class="stats-mode-btn"
            :class="statsViewMode === 'summary' ? 'stats-mode-btn-active' : 'stats-mode-btn-idle'"
            @click="setStatsViewMode('summary')"
          >
            {{ t('ship_build.stats_mode_summary') }}
          </button>
          <button
            data-testid="ship-build-stats-mode-detail"
            class="stats-mode-btn"
            :class="statsViewMode === 'detail' ? 'stats-mode-btn-active' : 'stats-mode-btn-idle'"
            @click="setStatsViewMode('detail')"
          >
            {{ t('ship_build.stats_mode_detail') }}
          </button>
        </div>
      </div>
      <div class="stats-list-container">
        <div class="stats-column">
          <div
            v-for="metric in visibleShipStats.filter((_, i) => i % 2 === 0)"
            :key="metric.key"
            class="stats-row"
            :class="{ 'stats-row-placeholder': metric.placeholder }"
          >
            <span class="stats-label">{{ t(metric.labelKey) }}</span>
            <span class="stats-value">
              {{ metric.valueText }}
              <span v-if="metric.unit" class="stats-unit">{{ metric.unit }}</span>
            </span>
            <div v-if="metric.ratio !== null" class="stats-bar">
              <div class="stats-bar-fill" :style="{ width: `${Math.round(metric.ratio * 100)}%` }"></div>
            </div>
          </div>
        </div>
        <div class="stats-column">
          <div
            v-for="metric in visibleShipStats.filter((_, i) => i % 2 === 1)"
            :key="metric.key"
            class="stats-row"
            :class="{ 'stats-row-placeholder': metric.placeholder }"
          >
            <span class="stats-label">{{ t(metric.labelKey) }}</span>
            <span class="stats-value">
              {{ metric.valueText }}
              <span v-if="metric.unit" class="stats-unit">{{ metric.unit }}</span>
            </span>
            <div v-if="metric.ratio !== null" class="stats-bar">
              <div class="stats-bar-fill" :style="{ width: `${Math.round(metric.ratio * 100)}%` }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.stats-panel {
  @apply p-4 bg-slate-900/30 border border-slate-800/80 rounded-lg m-4;
}

.stats-toolbar {
  @apply flex items-center justify-between gap-3 mb-3;
}

.stats-caption {
  @apply text-[11px] uppercase tracking-wide text-emerald-300/80;
}

.stats-mode-switch {
  @apply flex items-center gap-2;
}

.stats-mode-btn {
  @apply px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors;
}

.stats-mode-btn-idle {
  @apply text-slate-300 border-slate-700 bg-slate-800/60 hover:text-emerald-200 hover:border-emerald-400/60;
}

.stats-mode-btn-active {
  @apply text-white border-emerald-400 bg-emerald-600/70;
}

.stats-pending {
  @apply text-[11px] text-amber-300/80 mb-3;
}

.stats-list-container {
  @apply grid grid-cols-2 gap-x-4 gap-y-1;
}

.stats-column {
  @apply flex flex-col gap-1;
}

.stats-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.5rem;
  row-gap: 0.25rem;
}

.stats-label {
  @apply text-xs text-slate-300 truncate;
}

.stats-value {
  @apply text-xs text-emerald-300 tabular-nums;
}

.stats-row-placeholder .stats-label {
  @apply text-slate-400;
}

.stats-row-placeholder .stats-value {
  @apply text-slate-500;
}

.stats-unit {
  @apply text-[10px] text-slate-400 ml-1;
}

.stats-bar {
  grid-column: 1 / -1;
  height: 6px;
  @apply bg-slate-800 rounded-sm overflow-hidden border border-slate-700/70;
}

.stats-bar-fill {
  height: 100%;
  @apply bg-emerald-500/80;
}
</style>
