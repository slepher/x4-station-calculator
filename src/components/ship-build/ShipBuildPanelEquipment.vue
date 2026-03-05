<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import { useX4I18n } from '@/utils/UseX4I18n'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import type { MetricSchema, MetricValueMap } from '@/components/common/metricsPanelTypes'
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

const currentEquipment = computed(() => {
  if (!props.currentEquipmentId) return null
  return equipmentMap.get(props.currentEquipmentId) || null
})

const candidateEquipment = computed(() => {
  if (!props.highlightedEquipmentId) return null
  return equipmentMap.get(props.highlightedEquipmentId) || null
})

const viewMode = computed<'single' | 'diff'>(() => {
  if (!props.currentEquipmentId || !props.highlightedEquipmentId || props.currentEquipmentId === props.highlightedEquipmentId) {
    return 'single'
  }
  return 'diff'
})

const viewEquipment = computed(() => candidateEquipment.value || currentEquipment.value)

const viewStats = computed(() => {
  if (!viewEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(viewEquipment.value, props.selectedShip).details.value
})

const displayEquipment = computed(() => candidateEquipment.value || currentEquipment.value)

const shouldHide = computed(() => {
  return !props.isPickerOpen || (!currentEquipment.value && !candidateEquipment.value)
})

const candidateEquipmentList = computed(() => {
  if (!props.pickerTarget?.options) return []
  return props.pickerTarget.options
    .map((opt) => equipmentMap.get(opt.id))
    .filter((eq): eq is X4Equipment => !!eq)
})

function getMaxValue(equipmentList: X4Equipment[], getValue: (eq: X4Equipment) => number): number {
  if (equipmentList.length === 0) return 0
  return Math.max(...equipmentList.map((eq) => getValue(eq)))
}

const candidateStats = computed(() => {
  if (!candidateEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(candidateEquipment.value, props.selectedShip)
})

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
  currentValue: number | undefined
  candidateValue: number | undefined
  diff: number | undefined
  max: number | undefined
}

const comparisonData = computed<ComparisonItem[]>(() => {
  const current = currentStats.value?.details.value
  const candidate = candidateStats.value?.details.value
  const type = candidateEquipment.value?.type || currentEquipment.value?.type

  if (!type || (!current && !candidate)) return []

  if (type === 'weapon' || type === 'turret') {
    const fields: FieldDef[] = [
      ...(type === 'weapon' ? [{ key: 'burstDPS', labelKey: 'ship_build.equipment_burst_dps', unit: 'MW' } as FieldDef] : []),
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
    fields.forEach((field) => {
      maxValues[field.key] = getMaxValue(candidateEquipmentList.value, (eq) => {
        const stats = useEquipmentStats(eq, props.selectedShip!)
        return (stats.details.value as any)?.[field.key] || 0
      })
    })

    return fields.map((field) => {
      const currentValue = (current as any)?.[field.key]
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined ? candidateValue - currentValue : undefined
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

  if (type === 'shield') {
    const fields: FieldDef[] = [
      { key: 'shieldMax', labelKey: 'ship_build.equipment_shield_max', unit: 'MJ' },
      { key: 'shieldRate', labelKey: 'ship_build.equipment_shield_rate', unit: 'MW' },
      { key: 'shieldDelay', labelKey: 'ship_build.equipment_shield_delay', unit: 's' }
    ]

    const maxValues: Record<string, number> = {}
    fields.forEach((field) => {
      maxValues[field.key] = getMaxValue(candidateEquipmentList.value, (eq) => {
        const stats = useEquipmentStats(eq, props.selectedShip!)
        return (stats.details.value as any)?.[field.key] || 0
      })
    })

    return fields.map((field) => {
      const currentValue = (current as any)?.[field.key]
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined ? candidateValue - currentValue : undefined
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
    fields.forEach((field) => {
      maxValues[field.key] = getMaxValue(candidateEquipmentList.value, (eq) => {
        const stats = useEquipmentStats(eq, props.selectedShip!)
        return (stats.details.value as any)?.[field.key] || 0
      })
    })

    return fields.map((field) => {
      const currentValue = (current as any)?.[field.key]
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined ? candidateValue - currentValue : undefined
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
    fields.forEach((field) => {
      maxValues[field.key] = getMaxValue(candidateEquipmentList.value, (eq) => {
        const stats = useEquipmentStats(eq, props.selectedShip!)
        return (stats.details.value as any)?.[field.key] || 0
      })
    })

    return fields.map((field) => {
      const currentValue = (current as any)?.[field.key]
      const rawCandidateValue = (candidate as any)?.[field.key]
      const candidateValue = rawCandidateValue !== undefined ? rawCandidateValue : currentValue
      const diff = currentValue !== undefined && rawCandidateValue !== undefined ? candidateValue - currentValue : undefined
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

const roundedKeys = ['burstDPS', 'sustainedDPS', 'range']

const panelSchema = computed<MetricSchema>(() => {
  const items = comparisonData.value
  if (!items.length) return []

  const leftCount = Math.ceil(items.length / 2)
  const left = items.slice(0, leftCount)
  const right = items.slice(leftCount)

  return left.map((leftItem, idx) => {
    const row = [
      {
        key: leftItem.key,
        labelKey: t(leftItem.labelKey),
        unit: leftItem.unit,
        max: leftItem.max
      }
    ]
    const rightItem = right[idx]
    if (rightItem) {
      row.push({
        key: rightItem.key,
        labelKey: t(rightItem.labelKey),
        unit: rightItem.unit,
        max: rightItem.max
      })
    }
    return row
  })
})

const panelCurrentValues = computed<MetricValueMap | null>(() => {
  if (viewMode.value === 'single') return null
  const map: MetricValueMap = {}
  comparisonData.value.forEach((item) => {
    if (item.currentValue !== undefined) map[item.key] = item.currentValue
  })
  return Object.keys(map).length ? map : null
})

const panelTargetValues = computed<MetricValueMap | null>(() => {
  const map: MetricValueMap = {}

  if (viewMode.value === 'single') {
    const details = viewStats.value as Record<string, number | undefined> | null
    if (!details) return null
    comparisonData.value.forEach((item) => {
      const value = details[item.key]
      if (value !== undefined) map[item.key] = value
    })
  } else {
    comparisonData.value.forEach((item) => {
      if (item.candidateValue !== undefined) map[item.key] = item.candidateValue
    })
  }

  return Object.keys(map).length ? map : null
})
</script>

<template>
  <div v-if="!shouldHide" data-testid="ship-build-panel-equipment">
    <MetricsPanel
      panel-id="ship-build-equipment"
      :title="displayEquipment ? translateEquipment(displayEquipment) : ''"
      header-height="48px"
      :obj-current="panelCurrentValues"
      :obj-target="panelTargetValues"
      :schema="panelSchema"
      order="row"
      :view-tab="null"
      :rounded-keys="roundedKeys"
    />
  </div>
</template>
