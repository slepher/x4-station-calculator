<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import { useX4I18n } from '@/utils/UseX4I18n'
import type { X4Equipment, X4Ship } from '@/types/x4'
import equipmentsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/equipments.json'

const { t } = useI18n()
const { translateEquipment } = useX4I18n()

const props = defineProps<{
  isPickerOpen: boolean
  pickerTarget: {
    connectionKeys: string[]
    options: { id: string; name: string; mk: string | null; race: string | null; tags: string[] }[]
  } | null
  highlightedEquipmentId: string | null
  selectedShip: X4Ship | null
  slotType: string
  currentEquipmentId: string | null
  isShield: boolean
}>()

const equipmentMap = new Map<string, X4Equipment>()
;(equipmentsRaw as X4Equipment[]).forEach((eq) => {
  equipmentMap.set(eq.id, eq)
})

// 当前装备 ID（直接使用 props）
const currentEquipmentIdLocal = computed(() => props.currentEquipmentId)

// 当前装备
const currentEquipment = computed(() => {
  if (!currentEquipmentIdLocal.value) return null
  return equipmentMap.get(currentEquipmentIdLocal.value) || null
})

// 候选装备
const candidateEquipment = computed(() => {
  if (!props.highlightedEquipmentId) return null
  return equipmentMap.get(props.highlightedEquipmentId) || null
})

// View Mode: single 或 diff
// single: currentEquipmentId == highlightedEquipmentId || currentEquipmentId == null || highlightedEquipmentId == null
// diff: currentEquipmentId != highlightedEquipmentId 且两者都不为 null
const viewMode = computed(() => {
  if (!props.currentEquipmentId || !props.highlightedEquipmentId || props.currentEquipmentId === props.highlightedEquipmentId) {
    return 'single'
  }
  return 'diff'
})

// SingleView 时显示的装备（优先级：候选 > 当前）
const viewEquipment = computed(() => {
  return candidateEquipment.value || currentEquipment.value
})

// SingleView 时显示的装备的属性
const viewStats = computed(() => {
  if (!viewEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(viewEquipment.value, props.selectedShip).details.value
})

// 显示用的装备（候选优先，没有则用当前）- 用于头部名称显示
const displayEquipment = computed(() => {
  return candidateEquipment.value || currentEquipment.value
})

// 隐藏条件
const shouldHide = computed(() => {
  return !props.isPickerOpen ||
    (!currentEquipment.value && !candidateEquipment.value)
})

// 候选装备列表（用于计算最大值）
const candidateEquipmentList = computed(() => {
  if (!props.pickerTarget?.options) return []
  return props.pickerTarget.options
    .map(opt => equipmentMap.get(opt.id))
    .filter((eq): eq is X4Equipment => !!eq)
})

// 计算最大值的辅助函数
function getMaxValue(
  equipmentList: X4Equipment[],
  getValue: (eq: X4Equipment) => number
): number {
  if (equipmentList.length === 0) return 0
  return Math.max(...equipmentList.map(eq => getValue(eq)))
}

// 获取候选装备的 stats
const candidateStats = computed(() => {
  if (!candidateEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(candidateEquipment.value, props.selectedShip)
})

// 获取当前装备的 stats
const currentStats = computed(() => {
  if (!currentEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(currentEquipment.value, props.selectedShip)
})

interface FieldDef {
  key: string
  labelKey: string
  unit: string
}

interface ComparisonItem {
  key: string
  labelKey: string
  unit: string
  currentValue: number
  candidateValue: number
  diff: number
  max: number | undefined
}

// 对比数据 - 根据装备类型生成（两列布局）
const comparisonData = computed(() => {
  const current = currentStats.value?.details.value
  const candidate = candidateStats.value?.details.value
  // 有候选用候选类型，无候选但有当前装备则用当前装备类型
  const type = candidateEquipment.value?.type || currentEquipment.value?.type

  // 无任何装备数据时隐藏
  if (!type || (!current && !candidate)) return []

  // Weapon/Turret
  if (type === 'weapon' || type === 'turret') {
    const fields: FieldDef[] = [
      ...(type === 'weapon'
        ? [{ key: 'burstDPS', labelKey: 'ship_build.equipment_burst_dps', unit: 'MW' } as FieldDef]
        : []),
      { key: 'sustainedDPS', labelKey: 'ship_build.equipment_sustained_dps', unit: 'MW' },
      { key: 'range', labelKey: 'ship_build.equipment_range', unit: 'm' },
      { key: 'singleDamage', labelKey: 'ship_build.equipment_single_damage', unit: '' },
      { key: 'singleShotTime', labelKey: 'ship_build.equipment_single_shot_time', unit: 's' },
      { key: 'avgShotTime', labelKey: 'ship_build.equipment_avg_shot_time', unit: 's' },
      { key: 'ammo', labelKey: 'ship_build.equipment_ammo', unit: '' },
      { key: 'barrelamount', labelKey: 'ship_build.equipment_barrel_amount', unit: '' },
      { key: 'ammoReload', labelKey: 'ship_build.equipment_ammo_reload', unit: 's' },
      ...(type === 'weapon'
        ? [
          { key: 'chargetime', labelKey: 'ship_build.equipment_charge_time', unit: 's' },
          { key: 'timeToOverheat', labelKey: 'ship_build.equipment_time_to_overheat', unit: 's' },
          { key: 'cooldelay', labelKey: 'ship_build.equipment_cool_delay', unit: 's' },
          { key: 'coolTime', labelKey: 'ship_build.equipment_cool_time', unit: 's' },
          { key: 'cycleTime', labelKey: 'ship_build.equipment_cycle_time', unit: 's' }
        ]
        : [])
    ]

    const maxValues: Record<string, number> = {}
    fields.forEach(field => {
      maxValues[field.key] = getMaxValue(
        candidateEquipmentList.value,
        (eq) => {
          const stats = useEquipmentStats(eq, props.selectedShip!)
          return (stats.details.value as any)?.[field.key] || 0
        }
      )
    })

    return fields.map(field => {
      const currentValue = (current as any)?.[field.key]
      // 无候选时（即选择了空候选），使用当前值作为候选值
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined
        ? candidateValue - currentValue
        : undefined
      // 候选为空但当前有值时，只显示当前值
      return {
        key: field.key,
        labelKey: field.labelKey,
        unit: field.unit,
        currentValue,
        candidateValue,
        diff,
        max: maxValues[field.key]
      }
    })
  }

  // Shield
  if (type === 'shield') {
    const fields: FieldDef[] = [
      { key: 'shieldMax', labelKey: 'ship_build.equipment_shield_max', unit: 'MJ' },
      { key: 'shieldRate', labelKey: 'ship_build.equipment_shield_rate', unit: 'MW' },
      { key: 'shieldDelay', labelKey: 'ship_build.equipment_shield_delay', unit: 's' }
    ]

    const maxValues: Record<string, number> = {}
    fields.forEach(field => {
      maxValues[field.key] = getMaxValue(
        candidateEquipmentList.value,
        (eq) => {
          const stats = useEquipmentStats(eq, props.selectedShip!)
          return (stats.details.value as any)?.[field.key] || 0
        }
      )
    })

    return fields.map(field => {
      const currentValue = (current as any)?.[field.key]
      // 无候选时（即选择了空候选），使用当前值作为候选值
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined
        ? candidateValue - currentValue
        : undefined
      // 候选为空但当前有值时，只显示当前值
      return {
        key: field.key,
        labelKey: field.labelKey,
        unit: field.unit,
        currentValue,
        candidateValue,
        diff,
        max: maxValues[field.key]
      }
    })
  }

  // Engine
  if (type === 'engine') {
    const fields: FieldDef[] = [
      { key: 'thrustForward', labelKey: 'ship_build.equipment_thrust_forward', unit: '' },
      { key: 'speed', labelKey: 'ship_build.equipment_speed', unit: 'm/s' },
      { key: 'acceleration', labelKey: 'ship_build.equipment_acceleration', unit: 'm/s²' },
      { key: 'boostMultiplier', labelKey: 'ship_build.equipment_boost_multiplier', unit: '' },
      { key: 'boostSpeed', labelKey: 'ship_build.equipment_boost_speed', unit: 'm/s' },
      { key: 'boostAccel', labelKey: 'ship_build.equipment_boost_accel', unit: 'm/s²' },
      { key: 'boostDuration', labelKey: 'ship_build.equipment_boost_duration', unit: 's' },
      { key: 'boostRecharge', labelKey: 'ship_build.equipment_boost_recharge', unit: 's' },
      { key: 'travelThrust', labelKey: 'ship_build.equipment_travel_thrust', unit: '' },
      { key: 'travelSpeed', labelKey: 'ship_build.equipment_travel_speed', unit: 'm/s' },
      { key: 'travelCharge', labelKey: 'ship_build.equipment_travel_charge', unit: 's' },
      { key: 'travelAcceleration', labelKey: 'ship_build.equipment_travel_acceleration', unit: 'm/s²' },
      { key: 'travelAttack', labelKey: 'ship_build.equipment_travel_attack', unit: '' },
      { key: 'boostAcceleration', labelKey: 'ship_build.equipment_boost_acceleration', unit: 'm/s²' }
    ]

    const maxValues: Record<string, number> = {}
    fields.forEach(field => {
      maxValues[field.key] = getMaxValue(
        candidateEquipmentList.value,
        (eq) => {
          const stats = useEquipmentStats(eq, props.selectedShip!)
          return (stats.details.value as any)?.[field.key] || 0
        }
      )
    })

    return fields.map(field => {
      const currentValue = (current as any)?.[field.key]
      // 无候选时（即选择了空候选），使用当前值作为候选值
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined
        ? candidateValue - currentValue
        : undefined
      // 候选为空但当前有值时，只显示当前值
      return {
        key: field.key,
        labelKey: field.labelKey,
        unit: field.unit,
        currentValue,
        candidateValue,
        diff,
        max: maxValues[field.key]
      }
    })
  }

  // Thruster
  if (type === 'thruster') {
    const fields: FieldDef[] = [
      { key: 'pitch', labelKey: 'ship_build.equipment_pitch', unit: '' },
      { key: 'yaw', labelKey: 'ship_build.equipment_yaw', unit: '' },
      { key: 'roll', labelKey: 'ship_build.equipment_roll', unit: '' },
      { key: 'strafe', labelKey: 'ship_build.equipment_strafe', unit: '' },
      { key: 'pitchRate', labelKey: 'ship_build.equipment_pitch_rate', unit: 'rad/s' },
      { key: 'yawRate', labelKey: 'ship_build.equipment_yaw_rate', unit: 'rad/s' },
      { key: 'rollRate', labelKey: 'ship_build.equipment_roll_rate', unit: 'rad/s' },
      { key: 'strafeSpeed', labelKey: 'ship_build.equipment_strafe_speed', unit: 'm/s' },
      { key: 'strafeAcceleration', labelKey: 'ship_build.equipment_strafe_acceleration', unit: 'm/s²' }
    ]

    const maxValues: Record<string, number> = {}
    fields.forEach(field => {
      maxValues[field.key] = getMaxValue(
        candidateEquipmentList.value,
        (eq) => {
          const stats = useEquipmentStats(eq, props.selectedShip!)
          return (stats.details.value as any)?.[field.key] || 0
        }
      )
    })

    return fields.map(field => {
      const currentValue = (current as any)?.[field.key]
      // 无候选时（即选择了空候选），使用当前值作为候选值
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined
        ? candidateValue - currentValue
        : undefined
      // 候选为空但当前有值时，只显示当前值
      return {
        key: field.key,
        labelKey: field.labelKey,
        unit: field.unit,
        currentValue,
        candidateValue,
        diff,
        max: maxValues[field.key]
      }
    })
  }

  return []
})

const roundedWeaponTurretKeys = new Set(['burstDPS', 'sustainedDPS', 'range'])

function normalizeDisplayValue(key: string, value: number): number {
  if (roundedWeaponTurretKeys.has(key)) return Math.round(value)
  return value
}

// 格式化数字
function formatValue(key: string, value: number | undefined): string {
  if (value === undefined) return ''
  return normalizeDisplayValue(key, value).toLocaleString()
}

// 格式化显示值（候选值 + 差值）
function formatDisplayValue(item: ComparisonItem): string {
  const candidateValue = item.candidateValue
  let diff = item.diff
  if (item.currentValue !== undefined) {
    const normalizedCurrent = normalizeDisplayValue(item.key, item.currentValue)
    const normalizedCandidate = normalizeDisplayValue(item.key, candidateValue)
    diff = normalizedCandidate - normalizedCurrent
  }
  // 无当前装备时（diff = undefined），只显示候选值
  if (diff === undefined || diff === 0) {
    return formatValue(item.key, candidateValue)
  }
  const sign = diff > 0 ? '+' : ''
  return `${formatValue(item.key, candidateValue)}(${sign}${formatValue(item.key, diff)})`
}

// 获取差值颜色类
function getDiffClass(diff: number | undefined): string {
  if (diff === undefined) return 'diff-neutral'
  if (diff > 0) return 'diff-positive'
  if (diff < 0) return 'diff-negative'
  return 'diff-neutral'
}

// 计算进度条百分比
function getProgressPercent(value: number, max: number | undefined): number {
  if (!max || max === 0) return 0
  return Math.min(100, (value / max) * 100)
}

// 计算基础进度条（较小值，固定青色）
function getBasePercent(currentValue: number, candidateValue: number, max: number | undefined): number {
  const base = Math.min(currentValue, candidateValue)
  return getProgressPercent(base, max)
}

// 计算差值进度条（较大值-较小值）
function getDiffPercent(currentValue: number, candidateValue: number, max: number | undefined): number {
  const diff = Math.abs(candidateValue - currentValue)
  return getProgressPercent(diff, max)
}

// 计算差值起始位置（较小值的位置）
function getDiffStartPercent(currentValue: number, candidateValue: number, max: number | undefined): number {
  const base = Math.min(currentValue, candidateValue)
  return getProgressPercent(base, max)
}
</script>

<template>
  <div
    v-if="!shouldHide"
    class="equipment-card"
    data-testid="ship-build-panel-equipment"
  >
    <!-- Header: 显示装备名称（候选优先，没有则用当前）- i18n -->
    <div class="equipment-header">
      {{ displayEquipment ? translateEquipment(displayEquipment) : '' }}
    </div>

    <!-- 内容区域: 两列布局 -->
    <div class="equipment-content">
      <div class="stats-list-container">
        <div class="stats-column">
          <div
            v-for="item in (comparisonData as ComparisonItem[]).slice(0, Math.ceil(comparisonData.length / 2))"
            :key="item.key"
            class="stats-row"
          >
            <span class="stats-label">{{ t(item.labelKey) }}</span>
            <!-- SingleView: 使用 viewStats 的单一值 -->
            <template v-if="viewMode === 'single'">
                <span class="stats-value">
                  <span class="current-value">
                  {{ formatValue(item.key, (viewStats as any)?.[item.key]) }}
                  </span>
                  <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
                </span>
              <div class="stats-bar">
                <div
                  class="stats-bar-fill stats-bar-neutral"
                  :style="{ width: getProgressPercent((viewStats as any)?.[item.key], item.max) + '%' }"
                ></div>
              </div>
            </template>
            <!-- DiffView 且 diff=0: 复用单一视图逻辑 -->
            <template v-else-if="item.diff === 0">
                <span class="stats-value">
                  <span class="current-value">
                  {{ formatValue(item.key, item.candidateValue ?? item.currentValue) }}
                  </span>
                  <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
                </span>
              <div class="stats-bar">
                <div
                  class="stats-bar-fill stats-bar-neutral"
                  :style="{ width: getProgressPercent(item.candidateValue ?? item.currentValue, item.max) + '%' }"
                ></div>
              </div>
            </template>
            <!-- DiffView 且 diff!=0: 对比视图 -->
            <template v-else>
              <span class="stats-value">
                <span :class="getDiffClass(item.diff)">
                  {{ formatDisplayValue(item) }}
                </span>
                <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
              </span>
              <div class="stats-bar">
                <!-- diff > 0: 0到currentValue青色, currentValue到candidateValue蓝色 -->
                <template v-if="item.diff > 0">
                  <div
                    class="stats-bar-fill stats-bar-neutral"
                    :style="{ width: getBasePercent(item.currentValue, item.candidateValue, item.max) + '%' }"
                  ></div>
                  <div
                    class="stats-bar-fill stats-bar-positive"
                    :style="{
                      width: getDiffPercent(item.currentValue, item.candidateValue, item.max) + '%',
                      left: getDiffStartPercent(item.currentValue, item.candidateValue, item.max) + '%'
                    }"
                  ></div>
                </template>
                <!-- diff < 0: 0到candidateValue青色, candidateValue到currentValue粉色 -->
                <template v-else-if="item.diff < 0">
                  <div
                    class="stats-bar-fill stats-bar-neutral"
                    :style="{ width: getBasePercent(item.currentValue, item.candidateValue, item.max) + '%' }"
                  ></div>
                  <div
                    class="stats-bar-fill stats-bar-negative"
                    :style="{
                      width: getDiffPercent(item.currentValue, item.candidateValue, item.max) + '%',
                      left: getDiffStartPercent(item.currentValue, item.candidateValue, item.max) + '%'
                    }"
                  ></div>
                </template>
              </div>
            </template>
          </div>
        </div>
        <div class="stats-column">
          <div
            v-for="item in (comparisonData as ComparisonItem[]).slice(Math.ceil(comparisonData.length / 2))"
            :key="item.key"
            class="stats-row"
          >
            <span class="stats-label">{{ t(item.labelKey) }}</span>
            <!-- SingleView: 使用 viewStats 的单一值 -->
            <template v-if="viewMode === 'single'">
                <span class="stats-value">
                  <span class="current-value">
                  {{ formatValue(item.key, (viewStats as any)?.[item.key]) }}
                  </span>
                  <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
                </span>
              <div class="stats-bar">
                <div
                  class="stats-bar-fill stats-bar-neutral"
                  :style="{ width: getProgressPercent((viewStats as any)?.[item.key], item.max) + '%' }"
                ></div>
              </div>
            </template>
            <!-- DiffView 且 diff=0: 复用单一视图逻辑 -->
            <template v-else-if="item.diff === 0">
                <span class="stats-value">
                  <span class="current-value">
                  {{ formatValue(item.key, item.candidateValue ?? item.currentValue) }}
                  </span>
                  <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
                </span>
              <div class="stats-bar">
                <div
                  class="stats-bar-fill stats-bar-neutral"
                  :style="{ width: getProgressPercent(item.candidateValue ?? item.currentValue, item.max) + '%' }"
                ></div>
              </div>
            </template>
            <!-- DiffView 且 diff!=0: 对比视图 -->
            <template v-else>
              <span class="stats-value">
                <span :class="getDiffClass(item.diff)">
                  {{ formatDisplayValue(item) }}
                </span>
                <span v-if="item.unit" class="stats-unit">{{ item.unit }}</span>
              </span>
              <div class="stats-bar">
                <!-- diff > 0: 0到currentValue青色, currentValue到candidateValue蓝色 -->
                <template v-if="item.diff > 0">
                  <div
                    class="stats-bar-fill stats-bar-neutral"
                    :style="{ width: getBasePercent(item.currentValue, item.candidateValue, item.max) + '%' }"
                  ></div>
                  <div
                    class="stats-bar-fill stats-bar-positive"
                    :style="{
                      width: getDiffPercent(item.currentValue, item.candidateValue, item.max) + '%',
                      left: getDiffStartPercent(item.currentValue, item.candidateValue, item.max) + '%'
                    }"
                  ></div>
                </template>
                <!-- diff < 0: 0到candidateValue青色, candidateValue到currentValue粉色 -->
                <template v-else-if="item.diff < 0">
                  <div
                    class="stats-bar-fill stats-bar-neutral"
                    :style="{ width: getBasePercent(item.currentValue, item.candidateValue, item.max) + '%' }"
                  ></div>
                  <div
                    class="stats-bar-fill stats-bar-negative"
                    :style="{
                      width: getDiffPercent(item.currentValue, item.candidateValue, item.max) + '%',
                      left: getDiffStartPercent(item.currentValue, item.candidateValue, item.max) + '%'
                    }"
                  ></div>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equipment-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.equipment-header {
  @apply flex items-center justify-between px-4 py-3 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.equipment-content {
  @apply p-4 bg-slate-900/30 border border-slate-800/80 rounded-lg m-4;
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
  @apply text-xs tabular-nums;
}

.current-value {
  @apply text-slate-400;
}

.diff-positive {
  @apply text-blue-400;
}

.diff-negative {
  @apply text-pink-400;
}

.diff-neutral {
  @apply text-emerald-300;
}

.stats-unit {
  @apply text-[10px] text-slate-400 ml-1;
}

.stats-bar {
  grid-column: 1 / -1;
  @apply bg-slate-800 rounded-sm overflow-hidden border border-slate-700/70;
  height: 8px;
  position: relative;
}

.stats-bar-fill {
  @apply absolute h-full;
}

.stats-bar-neutral {
  @apply bg-emerald-500/80;
  left: 0;
  z-index: 1;
}

.stats-bar-positive {
  @apply bg-blue-500/80;
  z-index: 2;
}

.stats-bar-negative {
  @apply bg-pink-500/80;
  z-index: 2;
}
</style>
