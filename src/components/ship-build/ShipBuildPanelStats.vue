<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import type { MetricSchema, MetricValueMap, MetricsPanelViewTab } from '@/components/common/metricsPanelTypes'
import type { X4Ship, X4Equipment, ShipBlueprint } from '@/types/x4'
import bulletsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/bullets.json'
import missilesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/missiles.json'
import defaultMaxesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/default_maxes.json'

const props = defineProps<{
  shipBlueprint: ShipBlueprint | null
  targetBlueprint?: ShipBlueprint | null
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
const getTurretStatsByUseEquipmentStats = (blueprintData: ShipBlueprint | null) => {
  if (!selectedShip.value || !blueprintData) return 0

  let totalDamage = 0
  let turretCount = 0

  blueprintData.connections.forEach((conn) => {
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

  blueprintData.connections.forEach((conn) => {
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
  value: number;
  valueText: string;
  max: number;
  ratio: number | null;
  placeholder?: boolean;
  isZero?: boolean;
}

// Placeholder fields that don't have data sources yet
const placeholderKeys = new Set<string>([])

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

const calculateMaxStatsFromDefaults = (ship: X4Ship) => {
  const detailMax: Record<string, number> = {}
  const sampleDetail = buildDetailStatsByUseEquipmentStats(ship, props.shipBlueprint)
  sampleDetail.forEach((metric) => {
    detailMax[metric.key] = getDefaultMax(ship.class, metric.key)
  })
  return detailMax
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

const buildShipStatDisplay = (stats: Omit<ShipStatMetric, 'ratio'>[], maxStats: Record<string, number>): ShipStatDisplay[] => {
  return stats.map(metric => {
    const max = maxStats[metric.key] || 1
    const ratio = placeholderKeys.has(metric.key) ? null : calculateRatio(metric.value, max)
    return {
      key: metric.key,
      labelKey: metric.labelKey,
      unit: metric.unit,
      value: metric.value,
      valueText: placeholderKeys.has(metric.key) ? '--' : formatStatValue(metric.value),
      max,
      ratio,
      placeholder: placeholderKeys.has(metric.key),
      isZero: !placeholderKeys.has(metric.key) && metric.value === 0
    }
  })
}

const currentDetailedShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value) return []

  const stats = buildDetailStatsByUseEquipmentStats(selectedShip.value, props.shipBlueprint)
  const maxStats = calculateMaxStatsFromDefaults(selectedShip.value)
  return buildShipStatDisplay(stats, maxStats)
})

const targetDetailedShipStats = computed<ShipStatDisplay[]>(() => {
  if (!selectedShip.value || !props.targetBlueprint) return []
  const stats = buildDetailStatsByUseEquipmentStats(selectedShip.value, props.targetBlueprint)
  const maxStats = calculateMaxStatsFromDefaults(selectedShip.value)
  return buildShipStatDisplay(stats, maxStats)
})

const summaryKeys = computed<string[]>(() => {
  if (!selectedShip.value) return []
  const { summaryKey } = getCargoSummaryKeys(selectedShip.value)
  return [
    'hull',
    'weapon_burst',
    'shield',
    'turret_avg',
    summaryKey,
    'speed',
    'radar_range',
    'boost_speed',
    'crew',
    'travel_speed',
    'dock_m_count',
    'dock_m_capacity',
    'dock_s_count',
    'dock_s_capacity',
    'storage_unit',
    'missile',
    'deployable',
    'countermeasure'
  ]
})

const panelViewTab = computed<MetricsPanelViewTab>(() => ({
  style: 'emerald',
  views: [
    { mode: 'summary', label: t('ship_build.stats_mode_summary'), keys: summaryKeys.value },
    { mode: 'detail', label: t('ship_build.stats_mode_detail'), keys: 'all' }
  ]
}))

const panelSchema = computed<MetricSchema>(() => {
  const items = currentDetailedShipStats.value
  const rows: MetricSchema = []
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i]
    const right = items[i + 1]
    if (!left) continue
    const row = [
      {
        key: left.key,
        labelKey: t(left.labelKey),
        unit: left.unit,
        max: left.max
      }
    ]
    if (right) {
      row.push({
        key: right.key,
        labelKey: t(right.labelKey),
        unit: right.unit,
        max: right.max
      })
    }
    rows.push(row)
  }
  return rows
})

const panelCurrentValues = computed<MetricValueMap | null>(() => {
  if (!currentDetailedShipStats.value.length) return null
  const map: MetricValueMap = {}
  currentDetailedShipStats.value.forEach((metric) => {
    map[metric.key] = metric.value
  })
  return map
})

const panelTargetValues = computed<MetricValueMap | null>(() => {
  if (!targetDetailedShipStats.value.length) return null
  const map: MetricValueMap = {}
  targetDetailedShipStats.value.forEach((metric) => {
    map[metric.key] = metric.value
  })
  return map
})

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
  <div class="col-span-12 lg:col-span-4" data-testid="ship-build-panel-stats">
    <MetricsPanel
      panel-id="ship-build-stats-panel"
      :title="t('ship_build.panel_stats')"
      header-height="48px"
      :obj-current="panelCurrentValues"
      :obj-target="panelTargetValues"
      :schema="panelSchema"
      order="row"
      :view-tab="panelViewTab"
      :rounded-keys="[]"
    />
  </div>
</template>

<style scoped>
</style>
