
import { computed } from 'vue'
import { useShipBuildWorkspacePresenter } from './useShipBuildWorkspacePresenter'
import { useShipBuildCompareStatsPresenter } from './useShipBuildCompareStatsPresenter'
import { useI18n } from 'vue-i18n'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { MetricSchema, MetricValueMap, MetricsPanelViewTab } from '@/components/common/metricsPanelTypes'
import type { X4Ship, ShipBlueprint } from '@/types/x4'

export function useShipBuildStatsPresenter(props: {
  shipBlueprint: ShipBlueprint | null
  targetBlueprint?: ShipBlueprint | null
  comparison?: boolean
}) {

const { t } = useI18n()
const { statsMode } = useShipBuildWorkspacePresenter()
const comparison = props.comparison ? useShipBuildCompareStatsPresenter(
  computed(() => props.shipBlueprint), computed(() => props.targetBlueprint === undefined ? null : props.targetBlueprint)
) : null

// 全局字典数据 - 直接从 store 读取
const store = useShipBuildStore()
const gameData = useGameDataStore()

// Default maxes map - 用于数值条的 max 值
const defaultMaxesMap = computed(() => gameData.defaultMaxes)

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

const getWeaponStatsByUseEquipmentStats = (bp: ShipBlueprint | null) => store.getStatsCalculation(bp).getWeaponStatsByUseEquipmentStats(bp)
const getTurretStatsByUseEquipmentStats = (bp: ShipBlueprint | null) => store.getStatsCalculation(bp).getTurretStatsByUseEquipmentStats(bp)
const getShieldStatsByUseEquipmentStats = (bp: ShipBlueprint | null) => store.getStatsCalculation(bp).getShieldStatsByUseEquipmentStats(bp)
const getEngineStatsByUseEquipmentStats = (bp: ShipBlueprint | null) => store.getStatsCalculation(bp).getEngineStatsByUseEquipmentStats(bp)
const getThrusterStatsByUseEquipmentStats = (bp: ShipBlueprint | null) => store.getStatsCalculation(bp).getThrusterStatsByUseEquipmentStats(bp)
// ============ 从 Blueprint 派生数据 ============
// 优先从 blueprint 获取 shipId，如果没有 blueprint 则从 store 获取
const selectedShip = computed(() => {
  // 优先从 blueprint 获取 shipId
  const shipId = props.shipBlueprint === null ? null : props.shipBlueprint.shipId
  if (!shipId) return null
  return store.findShip(shipId)
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
  const classData = defaultMaxesMap.value[shipClass] as Record<string, any> | undefined
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

const buildDetailStatsByUseEquipmentStats = (ship: X4Ship, bp: ShipBlueprint | null) =>
  store.getStatsCalculation(bp).buildDetailStatsByUseEquipmentStats(ship, bp)

return { statsMode, store, gameData, defaultMaxesMap, getWeaponStatsByUseEquipmentStats, getTurretStatsByUseEquipmentStats, getShieldStatsByUseEquipmentStats, getEngineStatsByUseEquipmentStats, getThrusterStatsByUseEquipmentStats, selectedShip, placeholderKeys, getCargoCapacity, getCargoSummaryKeys, getDefaultMax, calculateMaxStatsFromDefaults, calculateRatio, formatStatValue, buildShipStatDisplay, currentDetailedShipStats, targetDetailedShipStats, summaryKeys, panelViewTab: comparison ? comparison.panelViewTab : panelViewTab, panelSchema: comparison ? comparison.panelSchema : panelSchema, panelCurrentValues: comparison ? comparison.panelCurrentValues : panelCurrentValues, panelTargetValues: comparison ? comparison.panelTargetValues : panelTargetValues, buildDetailStatsByUseEquipmentStats, t }
}
