<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import ViewTabUI from '@/components/common/ViewTabUI.vue'
import type { X4Ship, X4Equipment, ShipBlueprint } from '@/types/x4'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'
import defaultMaxesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/default_maxes.json'

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

// Default maxes map - 用于数值条的 max 值
const defaultMaxesMap = defaultMaxesRaw as Record<string, any>

// PanelStats key -> default_maxes 字段映射
const STAT_KEY_TO_MAX_FIELD: Record<string, string> = {
  hull: 'hull',
  shield: 'shield_value',
  shield_recharge_rate: 'shield_rate',
  shield_recharge_delay: 'shield_delay',
  shield_group_avg: 'group_shield_value',
  radar_range: 'radar_range',
  weapon_burst: 'weapon_burst',
  weapon_sustained: 'weapon_sustained',
  turret_avg: 'turret_burst',
  speed: 'engine_forward',
  acceleration: 'engine_acceleration',
  boost_speed: 'boost_speed',
  boost_acceleration: 'boost_acceleration',
  boost_duration: 'boost_duration',
  boost_recharge: 'boost_recharge',
  travel_speed: 'travel_speed',
  travel_acceleration: 'travel_acceleration',
  travel_charge_time: 'travel_charge_time',
  strafe_speed: 'thruster_horizontal_speed',
  strafe_acceleration: 'thruster_horizontal_acceleration',
  yaw: 'engine_yaw',
  pitch: 'engine_pitch',
  roll: 'engine_roll',
  crew: 'capacity_crew',
  storage_container: 'capacity_container',
  storage_solid: 'capacity_solid',
  storage_liquid: 'capacity_liquid',
  storage_condensed: 'capacity_condensate',
  storage_unit: 'capacity_unit',
  missile: 'capacity_missile',
  deployable: 'capacity_deployable',
  countermeasure: 'capacity_countermeasure',
  dock_m_count: 'dock_ship_m',
  dock_m_capacity: 'capacity_ship_m',
  dock_s_count: 'dock_ship_s',
  dock_s_capacity: 'capacity_ship_s',
}

// ============ 内部状态 ============
const statsViewMode = ref<'summary' | 'detail'>('summary')

const statsViewTabs = [
  { key: 'summary', label: t('ship_build.stats_mode_summary') },
  { key: 'detail', label: t('ship_build.stats_mode_detail') }
]

// 控制使用哪种逻辑: true = useEquipmentStats (composable), false = Vue 内原有计算
const useNewLogic = ref(true)

/**
 * 聚合所有已装备的武器 DPS (使用 useEquipmentStats)
 */
const getWeaponStatsByUseEquipmentStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return { burst: 0, sustained: 0 }

  let totalBurst = 0
  let totalSustained = 0

  props.shipBlueprint.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
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
const getTurretStatsByUseEquipmentStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return 0

  let totalDamage = 0
  let turretCount = 0

  props.shipBlueprint.connections.forEach((conn) => {
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
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

  return turretCount > 0 ? totalDamage / turretCount : 0
}

/**
 * 聚合护盾属性 (使用 useEquipmentStats)
 */
const getShieldStatsByUseEquipmentStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return { max: 0, rate: 0, delay: 0, groupAvg: 0 }

  let max = 0
  let rate = 0
  let delay = 0

  // 专用 shield 槽位
  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'shield') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
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

  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type === 'shield') return
    conn.group.forEach((g) => {
      if (!g.shield?.equipment_id || g.shield.count <= 0) return
      const shieldEquipment = equipmentMap.value.get(g.shield.equipment_id)
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
const getEngineStatsByUseEquipmentStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  let thrustForward = 0
  let boostMultiplier = 1
  let boostAcceleration = 1
  let boostDuration = 0
  let boostRecharge = 0
  let travelThrust = 0
  let travelAttack = 0
  let travelCharge = 0

  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'engine') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
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
const getThrusterStatsByUseEquipmentStats = () => {
  if (!selectedShip.value || !props.shipBlueprint) return null

  let pitch = 0
  let yaw = 0
  let roll = 0
  let strafe = 0

  props.shipBlueprint.connections.forEach((conn) => {
    if (conn.slot_type !== 'thruster') return
    conn.group.forEach((g) => {
      if (!g.equipment_id || g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
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
  isZero?: boolean;
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
      if (g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.recharge) return
      // 护盾 = 专用槽护盾，含 count
      max += (equipment.recharge.max || 0) * g.count
      rate += (equipment.recharge.rate || 0) * g.count
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
      if (!g.shield?.equipment_id) return
      if (g.shield.count <= 0) return
      const shieldEquipment = equipmentMap.value.get(g.shield.equipment_id)
      if (!shieldEquipment?.recharge) return
      mountedShieldMax += (shieldEquipment.recharge.max || 0) * g.shield.count
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
      if (g.count <= 0) return
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
      if (g.count <= 0) return
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
    const c = count
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
      if (g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      const count = g.count

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
      if (g.count <= 0) return
      const equipment = equipmentMap.value.get(g.equipment_id)
      if (!equipment?.bullet) return

      const equipmentClass = equipment.class
      // 只计算 turret 和 missileturret class
      if (equipmentClass !== 'turret' && equipmentClass !== 'missileturret') return

      const count = g.count
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

// Helper: 获取 Cargo 组的动态 summary 成员
// 优先顺序: Container → Solid → Liquid → Condensed
// 选择第一个值 > 0 的作为 summary，如果所有值都为 0 则使用 Container
const getCargoSummaryKeys = (ship: X4Ship) => {
  const container = getCargoCapacity(ship, 'container')
  const solid = getCargoCapacity(ship, 'solid')
  const liquid = getCargoCapacity(ship, 'liquid')
  const condensed = getCargoCapacity(ship, 'condensed')

  // 确定哪个是 summary
  let summaryKey = 'storage_container'
  if (container > 0) {
    summaryKey = 'storage_container'
  } else if (solid > 0) {
    summaryKey = 'storage_solid'
  } else if (liquid > 0) {
    summaryKey = 'storage_liquid'
  } else if (condensed > 0) {
    summaryKey = 'storage_condensed'
  } else {
    summaryKey = 'storage_container' // 所有值为 0 时默认
  }

  return { container, solid, liquid, condensed, summaryKey }
}

// Build summary stats (按设计文档 9x2 排布)
// 数据按左右交叉排列: [左1, 右1, 左2, 右2, ...]
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

  // Storage 组动态 summary: 根据实际容量选择
  const { container, solid, liquid, condensed, summaryKey } = getCargoSummaryKeys(ship)
  const storageSummaryItem = {
    key: summaryKey,
    labelKey: `ship_build.stats_${summaryKey}`,
    unit: 'm3',
    value: summaryKey === 'storage_container' ? container
      : summaryKey === 'storage_solid' ? solid
      : summaryKey === 'storage_liquid' ? liquid
      : condensed
  }
  const storageDetailItems = [
    { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3', value: container },
    { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', value: solid },
    { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', value: liquid },
    { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', value: condensed }
  ].filter(item => item.key !== summaryKey)

  // 9x2 排布: 交叉排列 [左1, 右1, 左2, 右2, ...]
  return [
    // 行1: Hull | Weapon Burst
    { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', value: ship.hull || 0 },
    { key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: Math.round(weaponStats.burst * 10) / 10 },
    // 行2: Shield | Turret Avg
    { key: 'shield', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: shieldStats.max },
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
    // 行3: Storage Summary (动态) | Speed
    storageSummaryItem,
    { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s', value: baseSpeed },
    // 行4: Radar Range | Boost Speed
    { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: Math.round((ship.radarRange || 0) / 1000) },
    { key: 'boost_speed', labelKey: 'ship_build.stats_boost_speed', unit: 'm/s', value: boostSpeed },
    // 行5: Crew | Travel Speed
    { key: 'crew', labelKey: 'ship_build.stats_crew', unit: '', value: ship.crew?.capacity || 0 },
    { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s', value: travelSpeed },
    // 行6: Storage Detail 1 | M Dock Count
    storageDetailItems[0] || null,
    { key: 'dock_m_count', labelKey: 'ship_build.stats_dock_m_count', unit: '', value: getDockCount(ship, 'dock_m') },
    // 行7: Storage Detail 2 | M Dock Capacity
    storageDetailItems[1] || null,
    { key: 'dock_m_capacity', labelKey: 'ship_build.stats_dock_m_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_m') },
    // 行8: Storage Detail 3 | S Dock Count
    storageDetailItems[2] || null,
    { key: 'dock_s_count', labelKey: 'ship_build.stats_dock_s_count', unit: '', value: getDockCount(ship, 'dock_s') },
    // 行9: Cargo: Unit Storage | S Dock Capacity
    { key: 'storage_unit', labelKey: 'ship_build.stats_storage_unit', unit: '', value: ship.storage?.unit || 0 },
    { key: 'dock_s_capacity', labelKey: 'ship_build.stats_dock_s_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_s') }
  ].filter((item): item is Omit<ShipStatMetric, 'ratio'> => item !== null)
}

// Build detail stats
// Build detail stats (按设计文档 18x2 排布)
// 完整 36 个数据点 (18行 x 2列)
const buildDetailStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const shieldStats = getShieldStats()
  const engineStats = getEngineStats()
  const weaponStats = getWeaponDamageStats()
  const turretAvg = getTurretDamageStats()
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1
  const dragHorizontal = ship.physics?.drag?.horizontal || 1
  const dragPitch = ship.physics?.drag?.pitch || 1
  const dragYaw = ship.physics?.drag?.yaw || 1
  const dragRoll = ship.physics?.drag?.roll || 1
  const accfactorsHorizontal = ship.physics?.accfactors?.horizontal || 1

  const baseSpeed = engineStats ? calculateSpeed(engineStats.thrustForward, dragForward) : 0
  const travelSpeed = engineStats ? calculateSpeed(engineStats.travelThrust, dragForward) : 0
  const boostSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.boostMultiplier) : 0
  const baseAcceleration = engineStats ? calculateAcceleration(engineStats.thrustForward, mass) : 0
  const boostAcceleration = engineStats ? Math.round(baseAcceleration * engineStats.boostAcceleration) : 0
  const travelAcceleration = engineStats && engineStats.travelAttack ? Math.round(travelSpeed / engineStats.travelAttack) : 0
  const boostRecharge = engineStats ? engineStats.boostRecharge / 100 : 0

  const thrusterStats = getThrusterStats()
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
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
    // 行3: Shield Recharge Rate | Weapon Sustained
    { key: 'shield_recharge_rate', labelKey: 'ship_build.stats_shield_recharge_rate', unit: 'MW', value: shieldStats.rate },
    { key: 'weapon_sustained', labelKey: 'ship_build.stats_weapon_sustained', unit: 'MW', value: Math.round(weaponStats.sustained * 10) / 10 },
    // 行4: Shield Recharge Delay | Speed
    { key: 'shield_recharge_delay', labelKey: 'ship_build.stats_shield_recharge_delay', unit: 's', value: shieldStats.delay },
    { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s', value: baseSpeed },
    // 行5: Shield Group Avg | Acceleration
    { key: 'shield_group_avg', labelKey: 'ship_build.stats_shield_group_avg', unit: 'MJ', value: shieldStats.groupAvg },
    { key: 'acceleration', labelKey: 'ship_build.stats_acceleration', unit: 'm/s2', value: baseAcceleration },
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
    { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s', value: travelSpeed },
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

// 获取 default_maxes 中的 max 值
// 特殊处理：radar_range 在 UI 中显示为 km，需要除以 1000
const getDefaultMax = (shipClass: string, statKey: string): number => {
  const maxField = STAT_KEY_TO_MAX_FIELD[statKey]
  if (!maxField) return 1
  const classData = defaultMaxesMap[shipClass]
  if (!classData) return 1
  let value = classData[maxField] || 1
  // radar_range 需要从米转换为千米
  if (statKey === 'radar_range') {
    value = value / 1000
  }
  return value
}

// Calculate max values for bar ratios using default_maxes
const calculateMaxStatsFromDefaults = (ship: X4Ship) => {
  const summaryMax: Record<string, number> = {}
  const detailMax: Record<string, number> = {}

  const sampleSummary = buildSummaryStats(ship)
  sampleSummary.forEach(metric => {
    summaryMax[metric.key] = getDefaultMax(ship.class, metric.key)
  })

  const sampleDetail = buildDetailStats(ship)
  sampleDetail.forEach(metric => {
    detailMax[metric.key] = getDefaultMax(ship.class, metric.key)
  })

  return { summaryMax, detailMax }
}

// 计算进度条比例
// 规则：
// - 如果当前值和 max 值都为 0，显示 0%
// - 如果 max 值为 0 但当前值 > 0，显示 100%
// - 否则显示 min(当前值/max, 1)
const calculateRatio = (value: number, max: number): number => {
  if (value === 0 && max === 0) return 0
  if (max === 0 && value > 0) return 1
  if (max === 0) return 0
  return Math.min(1, value / max)
}

const formatStatValue = (value: number) => value.toLocaleString()

const summaryShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value) return []

  let stats: Omit<ShipStatMetric, 'ratio'>[]
  let maxStats: Record<string, number>

  if (useNewLogic.value) {
    stats = buildSummaryStatsByUseEquipmentStats(selectedShip.value)
    const result = calculateMaxStatsFromDefaults(selectedShip.value)
    maxStats = result.summaryMax
  } else {
    stats = buildSummaryStats(selectedShip.value)
    const result = calculateMaxStatsFromDefaults(selectedShip.value)
    maxStats = result.summaryMax
  }

  return stats.map(metric => {
    const ratio = calculateRatio(metric.value, maxStats[metric.key] || 1)
    return {
      key: metric.key,
      labelKey: metric.labelKey,
      unit: metric.unit,
      valueText: formatStatValue(metric.value),
      ratio,
      placeholder: placeholderKeys.has(metric.key),
      isZero: metric.value === 0
    }
  })
})

const detailedShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value) return []

  let stats: Omit<ShipStatMetric, 'ratio'>[]
  let maxStats: Record<string, number>

  if (useNewLogic.value) {
    stats = buildDetailStatsByUseEquipmentStats(selectedShip.value)
    const result = calculateMaxStatsFromDefaults(selectedShip.value)
    maxStats = result.detailMax
  } else {
    stats = buildDetailStats(selectedShip.value)
    const result = calculateMaxStatsFromDefaults(selectedShip.value)
    maxStats = result.detailMax
  }

  return stats.map(metric => {
    const ratio = placeholderKeys.has(metric.key) ? null : calculateRatio(metric.value, maxStats[metric.key] || 1)
    return {
      key: metric.key,
      labelKey: metric.labelKey,
      unit: metric.unit,
      valueText: placeholderKeys.has(metric.key) ? '--' : formatStatValue(metric.value),
      ratio,
      placeholder: placeholderKeys.has(metric.key),
      isZero: !placeholderKeys.has(metric.key) && metric.value === 0
    }
  })
})

const visibleShipStats = computed<ShipStatDisplay[]>(() => {
  return statsViewMode.value === 'summary' ? summaryShipStats.value : detailedShipStats.value
})

// ============ 使用 useEquipmentStats 构建统计数据 (新逻辑) ============
// 使用 useEquipmentStats composable 计算属性
// 9x2 排布: 交叉排列 [左1, 右1, 左2, 右2, ...]
const buildSummaryStatsByUseEquipmentStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const shieldStats = getShieldStatsByUseEquipmentStats()
  const engineStats = getEngineStatsByUseEquipmentStats()
  const weaponStats = getWeaponStatsByUseEquipmentStats()
  const turretAvg = getTurretStatsByUseEquipmentStats()
  const dragForward = ship.physics?.drag?.forward || 1

  const baseSpeed = engineStats ? (engineStats.thrustForward / dragForward) : 0
  const travelSpeed = engineStats ? (engineStats.travelThrust / dragForward) : 0
  const boostSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.boostMultiplier) : 0

  // Storage 组动态 summary: 根据实际容量选择
  // 优先顺序: Container → Solid → Liquid → Condensed
  const { container, solid, liquid, condensed, summaryKey } = getCargoSummaryKeys(ship)

  // 构建 Storage 组的 summary/detail 数据
  const storageSummaryItem = {
    key: summaryKey,
    labelKey: `ship_build.stats_${summaryKey}`,
    unit: 'm3',
    value: summaryKey === 'storage_container' ? container
      : summaryKey === 'storage_solid' ? solid
      : summaryKey === 'storage_liquid' ? liquid
      : condensed
  }
  const storageDetailItems = [
    { key: 'storage_container', labelKey: 'ship_build.stats_storage_container', unit: 'm3', value: container },
    { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', value: solid },
    { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', value: liquid },
    { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', value: condensed }
  ].filter(item => item.key !== summaryKey)

  // 9x2 排布: 交叉排列 [左1, 右1, 左2, 右2, ...]
  return [
    // 行1: Hull | Weapon Burst
    { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', value: ship.hull || 0 },
    { key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: Math.round(weaponStats.burst * 10) / 10 },
    // 行2: Shield | Turret Avg
    { key: 'shield', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: shieldStats.max },
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
    // 行3: Storage Summary (动态) | Speed
    storageSummaryItem,
    { key: 'speed', labelKey: 'ship_build.stats_speed', unit: 'm/s', value: Math.round(baseSpeed) },
    // 行4: Radar Range | Boost Speed
    { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: Math.round((ship.radarRange || 0) / 1000) },
    { key: 'boost_speed', labelKey: 'ship_build.stats_boost_speed', unit: 'm/s', value: boostSpeed },
    // 行5: Crew | Travel Speed
    { key: 'crew', labelKey: 'ship_build.stats_crew', unit: '', value: ship.crew?.capacity || 0 },
    { key: 'travel_speed', labelKey: 'ship_build.stats_travel_speed', unit: 'm/s', value: Math.round(travelSpeed) },
    // 行6: Storage Detail 1 | M Dock Count
    storageDetailItems[0] || null,
    { key: 'dock_m_count', labelKey: 'ship_build.stats_dock_m_count', unit: '', value: getDockCount(ship, 'dock_m') },
    // 行7: Storage Detail 2 | M Dock Capacity
    storageDetailItems[1] || null,
    { key: 'dock_m_capacity', labelKey: 'ship_build.stats_dock_m_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_m') },
    // 行8: Storage Detail 3 | S Dock Count
    storageDetailItems[2] || null,
    { key: 'dock_s_count', labelKey: 'ship_build.stats_dock_s_count', unit: '', value: getDockCount(ship, 'dock_s') },
    // 行9: Cargo: Unit Storage | S Dock Capacity
    { key: 'storage_unit', labelKey: 'ship_build.stats_storage_unit', unit: '', value: ship.storage?.unit || 0 },
    { key: 'dock_s_capacity', labelKey: 'ship_build.stats_dock_s_capacity', unit: '', value: getShipStorageCapacity(ship, 'dock_s') }
  ].filter((item): item is Omit<ShipStatMetric, 'ratio'> => item !== null)
}

// 完整 36 个数据点 (18行 x 2列)
const buildDetailStatsByUseEquipmentStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const shieldStats = getShieldStatsByUseEquipmentStats()
  const engineStats = getEngineStatsByUseEquipmentStats()
  const weaponStats = getWeaponStatsByUseEquipmentStats()
  const turretAvg = getTurretStatsByUseEquipmentStats()
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

  const thrusterStats = getThrusterStatsByUseEquipmentStats()
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
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: turretAvg },
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
</script>

<template>
  <div class="col-span-12 lg:col-span-4 panel-card" data-testid="ship-build-panel-stats">
    <div class="panel-header">
      <span>{{ t('ship_build.panel_stats') }}</span>
      <ViewTabUI
        v-model="statsViewMode"
        :views="statsViewTabs"
        color-style="emerald"
        ui-key="ship-build-stats-mode"
      />
    </div>
    <div class="stats-panel" data-testid="ship-build-stats-panel">
      <div class="stats-list-container">
        <div class="stats-column">
          <div
            v-for="metric in visibleShipStats.filter((_, i) => i % 2 === 0)"
            :key="metric.key"
            class="stats-row"
            :class="{ 'stats-row-placeholder': metric.placeholder }"
            :data-testid="`ship-build-stats-row-${metric.key}`"
          >
            <span class="stats-label" :data-testid="`ship-build-stats-label-${metric.key}`">{{ t(metric.labelKey) }}</span>
            <span class="stats-value" :class="{ 'stats-value-zero': metric.isZero }" :data-testid="`ship-build-stats-value-${metric.key}`">
              {{ metric.valueText }}
              <span v-if="metric.unit" class="stats-unit" :data-testid="`ship-build-stats-unit-${metric.key}`">{{ metric.unit }}</span>
            </span>
            <div v-if="metric.ratio !== null" class="stats-bar" :data-testid="`ship-build-stats-bar-${metric.key}`">
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
            :data-testid="`ship-build-stats-row-${metric.key}`"
          >
            <span class="stats-label" :data-testid="`ship-build-stats-label-${metric.key}`">{{ t(metric.labelKey) }}</span>
            <span class="stats-value" :class="{ 'stats-value-zero': metric.isZero }" :data-testid="`ship-build-stats-value-${metric.key}`">
              {{ metric.valueText }}
              <span v-if="metric.unit" class="stats-unit" :data-testid="`ship-build-stats-unit-${metric.key}`">{{ metric.unit }}</span>
            </span>
            <div v-if="metric.ratio !== null" class="stats-bar" :data-testid="`ship-build-stats-bar-${metric.key}`">
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

.stats-value-zero {
  @apply text-slate-400;
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
