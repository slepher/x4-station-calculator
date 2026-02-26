<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { X4Ship, X4Equipment } from '@/types/x4'

const props = defineProps<{
  selectedShip: X4Ship | null
  connectionRows: any[]
  selectedByConnection: Record<string, string | null>
  ships: X4Ship[]
  equipments: X4Equipment[]
  wares: any[]
  statsViewMode: 'summary' | 'detail'
}>()

const emit = defineEmits<{
  setStatsViewMode: [mode: 'summary' | 'detail']
}>()

const { t } = useI18n()

const equipmentMap = new Map<string, X4Equipment>()
props.equipments.forEach((eq) => {
  equipmentMap.set(eq.id, eq)
})

const wareMap = new Map<string, any>()
props.wares.forEach((ware) => {
  wareMap.set(ware.id, ware)
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
const placeholderKeys = new Set([
  'radar_range', 'weapon_burst', 'turret_avg', 'weapon_sustained',
  'deployable', 'countermeasure', 'shield_group_avg', 'travel_acceleration'
])

// Get aggregated shield stats from selected shield equipment
const getShieldStats = () => {
  if (!props.selectedShip) return { max: 0, rate: 0, delay: 0, groupAvg: 0 }
  let max = 0
  let rate = 0
  let delay = 0

  props.connectionRows.forEach(row => {
    if (row.slotType !== 'shield') return
    const equipmentId = props.selectedByConnection[row.connectionKey]
    if (!equipmentId) return
    const equipment = equipmentMap.get(equipmentId)
    if (!equipment?.stats?.recharge) return
    max += equipment.stats.recharge.max || 0
    rate += equipment.stats.recharge.rate || 0
    delay = Math.max(delay, equipment.stats.recharge.delay || 0)
  })

  let totalShieldSlots = 0
  props.selectedShip.slots.forEach(slot => {
    slot.groups.forEach(group => {
      const connShield = group.connection?.shield
      if (connShield) {
        totalShieldSlots += connShield.count || 0
      }
    })
  })

  const groupAvg = totalShieldSlots > 0 ? max / totalShieldSlots : 0

  return { max, rate, delay, groupAvg }
}


// Get aggregated engine stats from selected engine equipment
const getEngineStats = () => {
  if (!props.selectedShip) return null
  const engineRows = props.connectionRows.filter(row => row.slotType === 'engine')
  if (engineRows.length === 0) return null
  let thrustForward = 0
  let boostMultiplier = 1
  let boostDuration = 0
  let boostRecharge = 0
  let travelMultiplier = 1
  let travelCharge = 0

  engineRows.forEach(row => {
    const equipmentId = props.selectedByConnection[row.connectionKey]
    if (!equipmentId) return
    const equipment = equipmentMap.get(equipmentId)
    if (!equipment?.stats) return
    if (equipment.stats.thrust?.forward) thrustForward += equipment.stats.thrust.forward
    if (equipment.stats.boost?.thrust) boostMultiplier = equipment.stats.boost.thrust
    if (equipment.stats.boost?.duration) boostDuration = Math.max(boostDuration, equipment.stats.boost.duration)
    if (equipment.stats.boost?.recharge) boostRecharge = Math.max(boostRecharge, equipment.stats.boost.recharge)
    if (equipment.stats.travel?.thrust) travelMultiplier = equipment.stats.travel.thrust
    if (equipment.stats.travel?.charge) travelCharge = Math.max(travelCharge, equipment.stats.travel.charge)
  })

  if (thrustForward === 0) return null
  return {
    thrustForward,
    boostMultiplier,
    boostDuration,
    boostRecharge,
    travelMultiplier,
    travelCharge
  }
}

// Calculate speed from thrust and ship physics
const calculateSpeed = (thrust: number, mass: number, drag: number) => {
  if (!mass || !drag) return 0
  return Math.round((thrust * 1000) / (mass * drag))
}

// Calculate acceleration from thrust and mass
const calculateAcceleration = (thrust: number, mass: number) => {
  if (!mass) return 0
  return Math.round((thrust * 1000) / mass)
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
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1

  const baseSpeed = engineStats ? calculateSpeed(engineStats.thrustForward, mass, dragForward) : 0
  const boostSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.boostMultiplier) : 0
  const travelSpeed = engineStats && baseSpeed > 0 ? Math.round(baseSpeed * engineStats.travelMultiplier) : 0

  return [
    { key: 'hull', labelKey: 'ship_build.stats_hull', unit: 'MJ', value: ship.hull || 0 },
    { key: 'shield', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: shieldStats.max },
    { key: 'radar_range', labelKey: 'ship_build.stats_radar_range', unit: 'km', value: 0 },
    { key: 'weapon_burst', labelKey: 'ship_build.stats_weapon_burst', unit: 'MW', value: 0 },
    { key: 'turret_avg', labelKey: 'ship_build.stats_turret_avg', unit: 'MW', value: 0 },
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
    { key: 'deployable', labelKey: 'ship_build.stats_deployable', unit: '', value: 0 },
    { key: 'countermeasure', labelKey: 'ship_build.stats_countermeasure', unit: '', value: 0 }
  ]
}

// Build detail stats
const buildDetailStats = (ship: X4Ship): Omit<ShipStatMetric, 'ratio'>[] => {
  const summaryStats = buildSummaryStats(ship)
  const shieldStats = getShieldStats()
  const engineStats = getEngineStats()
  const mass = ship.physics?.mass || 1
  const dragForward = ship.physics?.drag?.forward || 1
  const dragHorizontal = ship.physics?.drag?.horizontal || 1
  const pitch = ship.physics?.drag?.pitch || 0
  const yaw = ship.physics?.drag?.yaw || 0
  const roll = ship.physics?.drag?.roll || 0

  const baseSpeed = engineStats ? calculateSpeed(engineStats.thrustForward, mass, dragForward) : 0
  const baseAcceleration = engineStats ? calculateAcceleration(engineStats.thrustForward, mass) : 0
  const boostAcceleration = engineStats && baseSpeed > 0 ? Math.round(baseAcceleration * engineStats.boostMultiplier) : 0

  const extraStats: Omit<ShipStatMetric, 'ratio'>[] = [
    { key: 'shield_recharge_rate', labelKey: 'ship_build.stats_shield_recharge_rate', unit: 'MW', value: shieldStats.rate },
    { key: 'shield_recharge_delay', labelKey: 'ship_build.stats_shield_recharge_delay', unit: 's', value: shieldStats.delay },
    { key: 'shield_group_avg', labelKey: 'ship_build.stats_shield', unit: 'MJ', value: 0 },
    { key: 'weapon_sustained', labelKey: 'ship_build.stats_weapon_sustained', unit: 'MW', value: 0 },
    { key: 'storage_solid', labelKey: 'ship_build.stats_storage_solid', unit: 'm3', value: getCargoCapacity(ship, 'solid') },
    { key: 'storage_liquid', labelKey: 'ship_build.stats_storage_liquid', unit: 'm3', value: getCargoCapacity(ship, 'liquid') },
    { key: 'storage_condensed', labelKey: 'ship_build.stats_storage_condensed', unit: 'm3', value: getCargoCapacity(ship, 'condensed') },
    { key: 'acceleration', labelKey: 'ship_build.stats_acceleration', unit: 'm/s2', value: baseAcceleration },
    { key: 'boost_acceleration', labelKey: 'ship_build.stats_boost_acceleration', unit: 'm/s2', value: boostAcceleration },
    { key: 'boost_duration', labelKey: 'ship_build.stats_boost_duration', unit: 's', value: engineStats?.boostDuration || 0 },
    { key: 'boost_recharge', labelKey: 'ship_build.stats_boost_recharge', unit: '%/s', value: engineStats?.boostRecharge || 0 },
    { key: 'travel_acceleration', labelKey: 'ship_build.stats_travel_acceleration', unit: 'm/s2', value: 0 },
    { key: 'travel_charge_time', labelKey: 'ship_build.stats_travel_charge_time', unit: 's', value: engineStats?.travelCharge || 0 },
    { key: 'strafe_speed', labelKey: 'ship_build.stats_strafe_speed', unit: 'm/s', value: engineStats ? calculateSpeed(Math.round(engineStats.thrustForward * 0.5), mass, dragHorizontal) : 0 },
    { key: 'strafe_acceleration', labelKey: 'ship_build.stats_strafe_acceleration', unit: 'm/s2', value: engineStats ? calculateAcceleration(Math.round(engineStats.thrustForward * 0.5), mass) : 0 },
    { key: 'yaw', labelKey: 'ship_build.stats_yaw', unit: 'deg/s', value: yaw },
    { key: 'pitch', labelKey: 'ship_build.stats_pitch', unit: 'deg/s', value: pitch },
    { key: 'roll', labelKey: 'ship_build.stats_roll', unit: 'deg/s', value: roll }
  ]

  return [...summaryStats, ...extraStats]
}

// Calculate max values for bar ratios
const calculateMaxStats = (ship: X4Ship) => {
  const classShips = props.ships.filter(s => s.class === ship.class)
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
  if (!props.selectedShip) return []
  const stats = buildSummaryStats(props.selectedShip)
  const { summaryMax } = calculateMaxStats(props.selectedShip)

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
  if (!props.selectedShip) return []
  const stats = buildDetailStats(props.selectedShip)
  const { detailMax } = calculateMaxStats(props.selectedShip)

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
  return props.statsViewMode === 'summary' ? summaryShipStats.value : detailedShipStats.value
})

const setStatsViewMode = (mode: 'summary' | 'detail') => {
  emit('setStatsViewMode', mode)
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
      <div v-if="statsViewMode === 'detail'" class="stats-pending">
        {{ t('ship_build.stats_detail_pending') }}
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
