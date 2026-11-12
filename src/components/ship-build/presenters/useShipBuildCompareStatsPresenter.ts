import { computed, ref, type Ref } from 'vue'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { ShipBlueprint } from '@/types/x4'
import i18n from '@/i18n'
import type { MetricSchema, MetricsPanelViewTab } from '@/components/common/metricsPanelTypes'

export const comparisonFields: Record<string, string> = {
  hull: 'hull', shield: 'shield_value', shield_recharge_rate: 'shield_rate', shield_recharge_delay: 'shield_delay',
  shield_group_avg: 'group_shield_value', radar_range: 'radar_range', weapon_burst: 'weapon_burst',
  weapon_sustained: 'weapon_sustained', turret_avg: 'turret_burst', speed: 'engine_forward',
  acceleration: 'engine_acceleration', boost_speed: 'boost_speed', boost_acceleration: 'boost_acceleration',
  boost_duration: 'boost_duration', boost_recharge: 'boost_recharge', travel_speed: 'travel_speed',
  travel_acceleration: 'travel_acceleration', travel_charge_time: 'travel_charge_time', strafe_speed: 'thruster_horizontal_speed',
  strafe_acceleration: 'thruster_horizontal_acceleration', yaw: 'engine_yaw', pitch: 'engine_pitch', roll: 'engine_roll',
  crew: 'capacity_crew', storage_container: 'capacity_container', storage_solid: 'capacity_solid',
  storage_liquid: 'capacity_liquid', storage_condensed: 'capacity_condensate', storage_unit: 'capacity_unit',
  missile: 'capacity_missile', deployable: 'capacity_deployable', countermeasure: 'capacity_countermeasure',
  dock_m_count: 'dock_ship_m', dock_m_capacity: 'capacity_ship_m', dock_s_count: 'dock_ship_s', dock_s_capacity: 'capacity_ship_s'
}

export function compareMetric(a: number | undefined, b: number | undefined, maxA: number | undefined,
  maxB: number | undefined, direction: 'higher' | 'lower' | 'neutral' = 'higher') {
  const valid = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value)
  const max = valid(maxA) && valid(maxB) ? Math.max(maxA, maxB) : undefined
  const diff = valid(a) && valid(b) ? b - a : undefined
  const tone = diff === undefined || diff === 0 || direction === 'neutral' ? 'neutral'
    : (direction === 'higher' ? diff > 0 : diff < 0) ? 'better' : 'worse'
  const width = (value: number | undefined) => max !== undefined && max > 0 && valid(value)
    ? Math.min(100, Math.max(0, value / max * 100)) : 0
  return { a, b, max, diff, tone, widthA: width(a), widthB: width(b),
    scale: max === undefined ? 'missing' : max === 0 ? 'zero' : 'available',
    textA: valid(a) ? a.toLocaleString() : '—', textB: valid(b) ? b.toLocaleString() : '—',
    diffText: diff === undefined ? '—' : `${diff > 0 ? '+' : ''}${Number(diff.toFixed(3)).toLocaleString()}` }
}

export function useShipBuildCompareStatsPresenter(a: Ref<ShipBlueprint | null>, b: Ref<ShipBlueprint | null>) {
  const t = i18n.global.t
  const store = useShipBuildStore()
  const game = useGameDataStore()
  const detail = ref(false)
  const rows = computed(() => {
    const shipA = a.value === null ? null : store.findShip(a.value.shipId)
    const shipB = b.value === null ? null : store.findShip(b.value.shipId)
    const statsA = store.getPlanStats(a.value)
    const statsB = store.getPlanStats(b.value)
    const valuesB = new Map(statsB.map(item => [item.key, item.value]))
    const maxFor = (shipClass: string | undefined, key: string) => {
      if (shipClass === undefined) return undefined
      const defaults = game.defaultMaxes[shipClass] as Record<string, number> | undefined
      if (defaults === undefined) return undefined
      const field = comparisonFields[key]
      if (field === undefined || defaults[field] === undefined) return undefined
      return key === 'radar_range' ? defaults[field] / 1000 : defaults[field]
    }
    const definitions = new Map([...statsA, ...statsB].map(item => [item.key, item]))
    const valuesA = new Map(statsA.map(item => [item.key, item.value]))
    return [...definitions.values()].map(item => ({ ...item,
      ...compareMetric(valuesA.get(item.key), valuesB.get(item.key), maxFor(shipA?.class, item.key), maxFor(shipB?.class, item.key),
        ['shield_recharge_delay', 'travel_charge_time'].includes(item.key) ? 'lower' : 'higher')
    }))
  })
  const summary = new Set(['hull', 'weapon_burst', 'shield', 'turret_avg', 'storage_container', 'storage_solid',
    'storage_liquid', 'storage_condensed', 'speed', 'radar_range', 'boost_speed', 'crew', 'travel_speed',
    'dock_m_count', 'dock_m_capacity', 'dock_s_count', 'dock_s_capacity', 'storage_unit', 'missile', 'deployable', 'countermeasure'])
  const visibleRows = computed(() => detail.value ? rows.value : rows.value.filter(row => summary.has(row.key)))
  const panelSchema = computed<MetricSchema>(() => {
    const schema: MetricSchema = []
    rows.value.forEach((row, index) => {
      if (index % 2 === 0) schema.push([])
      schema[schema.length - 1]!.push({ key: row.key, labelKey: t(row.labelKey), unit: row.unit,
        max: row.max, lowerIsBetter: ['shield_recharge_delay', 'travel_charge_time'].includes(row.key),
        hideBar: row.scale !== 'available', hint: row.scale === 'missing' ? t('shipCompare.scale_missing') : undefined })
    })
    return schema
  })
  const panelCurrentValues = computed(() => Object.fromEntries(rows.value.map(row => [row.key, row.a])))
  const panelTargetValues = computed(() => Object.fromEntries(rows.value.map(row => [row.key, row.b])))
  const panelViewTab = computed<MetricsPanelViewTab>(() => ({ style: 'emerald', views: [
    { mode: 'summary', label: t('ship_build.stats_mode_summary'), keys: [...summary] },
    { mode: 'detail', label: t('ship_build.stats_mode_detail'), keys: 'all' }
  ] }))
  return { detail, rows: visibleRows, panelSchema, panelCurrentValues, panelTargetValues, panelViewTab }
}
