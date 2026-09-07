import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { X4Equipment, X4Ship } from '@/types/x4'
import type { MetricSchema, MetricValueMap } from '@/components/common/metricsPanelTypes'

export function useShipBuildEquipmentPresenter(props: {
  currentEquipmentId: string | null
  highlightedEquipmentId: string | null
  selectedShip: X4Ship | null
}, candidateEquipmentList: Ref<X4Equipment[]>) {
const { t } = useI18n()
const shipBuildStore = useShipBuildStore()
const equipmentMap = shipBuildStore.equipmentMap

const currentEquipment = computed(() => {
  if (!props.currentEquipmentId) return null
  const equipment = equipmentMap.get(props.currentEquipmentId)
  if (!equipment) return null
  if (!shipBuildStore.isEquipmentDlcUsable(equipment)) return null
  return equipment
})

const candidateEquipment = computed(() => {
  if (!props.highlightedEquipmentId) return null
  const equipment = equipmentMap.get(props.highlightedEquipmentId)
  if (!equipment) return null
  if (!shipBuildStore.isEquipmentDlcUsable(equipment)) return null
  return equipment
})

const viewMode = computed<'single' | 'diff'>(() => {
  if (!props.currentEquipmentId || !props.highlightedEquipmentId || props.currentEquipmentId === props.highlightedEquipmentId) {
    return 'single'
  }
  return 'diff'
})

const displayEquipment = computed(() => {
  if (candidateEquipment.value !== null) return candidateEquipment.value
  return currentEquipment.value
})

const viewStats = computed(() => {
  if (!displayEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(displayEquipment.value, props.selectedShip).details.value
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
  const type = displayEquipment.value?.type

  if (!type || (!current && !candidate)) return []

  if (type === 'weapon' || type === 'turret') {
    const fields: FieldDef[] = [
      { key: 'burstDPS', labelKey: 'ship_build.equipment_burst_dps', unit: 'MW' },
      { key: 'sustainedDPS', labelKey: 'ship_build.equipment_sustained_dps', unit: 'MW' },
      { key: 'range', labelKey: 'ship_build.equipment_range', unit: 'm' },
      { key: 'singleDamage', labelKey: 'ship_build.equipment_single_damage', unit: '' },
      { key: 'singleShotTime', labelKey: 'ship_build.equipment_single_shot_time', unit: 's' },
      { key: 'avgShotTime', labelKey: 'ship_build.equipment_avg_shot_time', unit: 's' },
      { key: 'ammo', labelKey: 'ship_build.equipment_ammo', unit: '' },
      { key: 'barrelamount', labelKey: 'ship_build.equipment_barrel_amount', unit: '' },
      { key: 'ammoReload', labelKey: 'ship_build.equipment_ammo_reload', unit: 's' },
      { key: 'chargetime', labelKey: 'ship_build.equipment_charge_time', unit: 's' },
      { key: 'timeToOverheat', labelKey: 'ship_build.equipment_time_to_overheat', unit: 's' },
      { key: 'cooldelay', labelKey: 'ship_build.equipment_cool_delay', unit: 's' },
      { key: 'coolTime', labelKey: 'ship_build.equipment_cool_time', unit: 's' },
      { key: 'cycleTime', labelKey: 'ship_build.equipment_cycle_time', unit: 's' }
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
      { key: 'boostMultiplier', labelKey: 'ship_build.equipment_boost_multiplier', unit: '' },
      { key: 'travelThrust', labelKey: 'ship_build.equipment_travel_thrust', unit: '' },
      { key: 'speed', labelKey: 'ship_build.equipment_speed', unit: 'm/s' },
      { key: 'acceleration', labelKey: 'ship_build.equipment_acceleration', unit: 'm/s²' },
      { key: 'boostSpeed', labelKey: 'ship_build.equipment_boost_speed', unit: 'm/s' },
      { key: 'boostAccel', labelKey: 'ship_build.equipment_boost_accel', unit: 'm/s²' },
      { key: 'boostDuration', labelKey: 'ship_build.equipment_boost_duration', unit: 's' },
      { key: 'boostRecharge', labelKey: 'ship_build.equipment_boost_recharge', unit: 's' },
      { key: 'travelSpeed', labelKey: 'ship_build.equipment_travel_speed', unit: 'm/s' },
      { key: 'travelAcceleration', labelKey: 'ship_build.equipment_travel_acceleration', unit: 'm/s²' },
      { key: 'travelCharge', labelKey: 'ship_build.equipment_travel_charge', unit: 's' },
      { key: 'travelAttack', labelKey: 'ship_build.equipment_travel_attack', unit: 's' },
      { key: 'travelRelease', labelKey: 'ship_build.equipment_travel_release', unit: 's' },
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

function getEquipmentSummary1(equipment: X4Equipment): { labelKey: string; value: string; unit: string } {
  if (!props.selectedShip) return { labelKey: '', value: '', unit: '' }
  const { summary } = useEquipmentStats(equipment, props.selectedShip)
  if (!summary.value) return { labelKey: '', value: '', unit: '' }
  const s = summary.value as any
  const type = equipment.type

  if (type === 'weapon') return { labelKey: 'ship_build.equipment_burst_dps', value: String(Math.round(s.burstDPS)), unit: 'MW' }
  if (type === 'turret') return { labelKey: 'ship_build.equipment_sustained_dps', value: String(Math.round(s.sustainedDPS)), unit: 'MW' }
  if (type === 'shield') return { labelKey: 'ship_build.equipment_shield_max', value: String(Math.round(s.shieldMax)), unit: 'MJ' }
  if (type === 'engine') return { labelKey: 'ship_build.equipment_speed', value: String(s.speed), unit: 'm/s' }
  if (type === 'thruster') return { labelKey: 'ship_build.equipment_strafe_speed', value: String(s.strafeSpeed), unit: 'm/s' }
  return { labelKey: '', value: '', unit: '' }
}

function getEquipmentSummary2(equipment: X4Equipment): { labelKey: string; value: string; unit: string } {
  if (!props.selectedShip) return { labelKey: '', value: '', unit: '' }
  const { summary, details } = useEquipmentStats(equipment, props.selectedShip)
  if (!summary.value) return { labelKey: '', value: '', unit: '' }
  const s = summary.value as any
  const type = equipment.type

  if (type === 'weapon') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'turret') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'shield') return { labelKey: 'ship_build.equipment_shield_delay', value: String(s.shieldDelay), unit: 's' }
  if (type === 'engine') {
    const engine = details.value as { travelCharge: number }
    return { labelKey: 'ship_build.equipment_travel_speed', value: `${s.travelSpeed}:${engine.travelCharge}`, unit: 'm/s:s' }
  }
  if (type === 'thruster') return { labelKey: 'ship_build.equipment_yaw_rate', value: s.yawRate.toFixed(2), unit: 'rad/s' }
  return { labelKey: '', value: '', unit: '' }
}

return { currentEquipment, candidateEquipment, displayEquipment,
  panelSchema, panelCurrentValues, panelTargetValues, roundedKeys, getEquipmentSummary1, getEquipmentSummary2 }
}
