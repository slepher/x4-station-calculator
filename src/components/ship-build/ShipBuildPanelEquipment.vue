<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEquipmentStats } from '@/composables/useEquipmentStats'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import { extractEquipmentSlotCandidatesWithFacets } from '@/store/logic/shipEquipmentPicker'
import MetricsPanel from '@/components/common/MetricsPanel.vue'
import type { MetricSchema, MetricValueMap } from '@/components/common/metricsPanelTypes'
import type { EquipmentType, ShipEquipmentSize, X4Equipment, X4Ship, X4SlotTag } from '@/types/x4'
import type { FitEquipmentOption } from '@/components/ship-build/fitTypes'

const { t } = useI18n()
const { translateEquipment, translateSlotTag } = useX4I18n()
const gameData = useGameDataStore()
const shipBuildStore = useShipBuildStore()
const slotTags = shipBuildStore.slotTags as X4SlotTag[]
const slotTagMap = new Map<string, X4SlotTag>(slotTags.map((tag) => [tag.id, tag]))

const props = withDefaults(defineProps<{
  isPickerOpen: boolean
  pickerTarget: {
    connectionKeys: string[]
    size: string
    tags: string[]
  } | null
  highlightedEquipmentId: string | null
  selectedShip: X4Ship | null
  slotType: string
  currentEquipmentId: string | null
  isShield: boolean
  panelMode?: 'picker' | 'equipment'
}>(), {
  panelMode: 'picker'
})
const emit = defineEmits<{
  'update:highlightedEquipmentId': [id: string | null]
  'cancel': []
  'confirm': []
}>()

const equipmentMap = shipBuildStore.equipmentMap

const currentEquipment = computed(() => {
  if (!props.currentEquipmentId) return null
  const equipment = equipmentMap.get(props.currentEquipmentId) || null
  if (!equipment) return null
  if (!shipBuildStore.isEquipmentDlcUsable(equipment)) return null
  return equipment
})

const candidateEquipment = computed(() => {
  if (!props.highlightedEquipmentId) return null
  const equipment = equipmentMap.get(props.highlightedEquipmentId) || null
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

const viewEquipment = computed(() => candidateEquipment.value || currentEquipment.value)

const viewStats = computed(() => {
  if (!viewEquipment.value || !props.selectedShip) return null
  return useEquipmentStats(viewEquipment.value, props.selectedShip).details.value
})

const displayEquipment = computed(() => candidateEquipment.value || currentEquipment.value)

const shouldHide = computed(() => {
  if (!props.isPickerOpen) return true
  if (props.panelMode === 'equipment') {
    return !currentEquipment.value && !candidateEquipment.value
  }
  return false
})

const selectedRaceIds = ref<string[]>([])
const selectedMkIds = ref<string[]>([])
const selectedTagIds = ref<string[]>([])
const tagDefs = ['standard', 'advanced', 'xenon', 'mining', 'missile', 'highpower']

const normalizeRace = (option: FitEquipmentOption) => option.race || 'gen'
const normalizeMk = (option: FitEquipmentOption) => option.mk || ''
const normalizeTags = (option: FitEquipmentOption) => option.tags || []

const extractPickerCandidates = (filters: { races: string[]; mks: string[]; tags: string[] }) => {
  if (!props.pickerTarget || !props.selectedShip) {
    return {
      items: [] as FitEquipmentOption[],
      raceCountMap: new Map<string, number>(),
      mkCountMap: new Map<string, number>(),
      tagCountMap: new Map<string, number>()
    }
  }
  return extractEquipmentSlotCandidatesWithFacets({
    shipMap: shipBuildStore.shipMap,
    equipmentMap: shipBuildStore.equipmentMap,
    shipId: props.selectedShip.id,
    slotType: props.slotType as EquipmentType,
    size: props.pickerTarget.size as ShipEquipmentSize,
    tagsAll: props.pickerTarget.tags,
    filters,
    includeEquipment: (equipment) => shipBuildStore.isEquipmentDlcUsable(equipment)
  })
}

const basePickerCandidates = computed(() => extractPickerCandidates({
  races: [],
  mks: [],
  tags: []
}).items)
const availableRaceIds = computed(() => new Set(basePickerCandidates.value.map((item) => normalizeRace(item))))
const availableMkIds = computed(() => new Set(basePickerCandidates.value.map((item) => normalizeMk(item)).filter(Boolean)))
const availableTagIds = computed(() => new Set(basePickerCandidates.value.flatMap((item) => normalizeTags(item))))

const pickerCandidateResult = computed(() => extractPickerCandidates({
  races: selectedRaceIds.value,
  mks: selectedMkIds.value,
  tags: selectedTagIds.value
}))
const raceCountMap = computed(() => pickerCandidateResult.value.raceCountMap)
const mkCountMap = computed(() => pickerCandidateResult.value.mkCountMap)
const tagCountMap = computed(() => pickerCandidateResult.value.tagCountMap)

const raceTags = computed(() => Array.from(availableRaceIds.value)
  .sort((a, b) => a.localeCompare(b))
  .map((id) => ({ id, label: id.toUpperCase(), count: raceCountMap.value.get(id) || 0 })))
const mkTags = computed(() => Array.from(availableMkIds.value)
  .sort((a, b) => Number(a) - Number(b))
  .map((id) => ({ id, label: `MK${id}`, count: mkCountMap.value.get(id) || 0 })))
const featureTags = computed(() => tagDefs
  .filter((id) => availableTagIds.value.has(id))
  .map((id) => {
    const def = slotTagMap.get(id)
    return {
      id,
      label: def ? translateSlotTag(def) : id.toUpperCase(),
      count: tagCountMap.value.get(id) || 0
    }
  }))
const showRaceFilter = computed(() => raceTags.value.length > 1)
const showMkFilter = computed(() => mkTags.value.length > 1)
const showTagFilter = computed(() => featureTags.value.length > 1)
const showFilterBlock = computed(() => showRaceFilter.value || showMkFilter.value || showTagFilter.value)

const candidateEquipmentList = computed(() => {
  return pickerCandidateResult.value.items
    .map((opt) => equipmentMap.get(opt.id))
    .filter((eq): eq is X4Equipment => !!eq)
})

const pageSize = 10
const currentPage = ref(1)
const candidateItemsWithEmpty = computed(() => {
  return [null, ...candidateEquipmentList.value] as Array<X4Equipment | null>
})
const totalPages = computed(() => {
  const total = Math.ceil(candidateItemsWithEmpty.value.length / pageSize)
  return total > 0 ? total : 1
})
const pagedCandidateItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return candidateItemsWithEmpty.value.slice(start, start + pageSize)
})

watch(candidateItemsWithEmpty, () => {
  if (currentPage.value > totalPages.value) currentPage.value = 1
  const highlightedId = props.highlightedEquipmentId
  if (highlightedId && !candidateItemsWithEmpty.value.some((item) => item?.id === highlightedId)) {
    emit('update:highlightedEquipmentId', null)
  }
})

watch(
  () => props.pickerTarget,
  () => {
    currentPage.value = 1
    selectedRaceIds.value = []
    selectedMkIds.value = []
    selectedTagIds.value = []
  },
  { deep: true }
)

const toggleTag = (items: string[], setItems: (next: string[]) => void, id: string) => {
  if (items.includes(id)) return setItems(items.filter((item) => item !== id))
  return setItems([...items, id])
}
const toggleRace = (id: string) => {
  toggleTag(selectedRaceIds.value, (next) => { selectedRaceIds.value = next }, id)
}
const toggleMk = (id: string) => {
  toggleTag(selectedMkIds.value, (next) => { selectedMkIds.value = next }, id)
}
const toggleFeatureTag = (id: string) => {
  toggleTag(selectedTagIds.value, (next) => { selectedTagIds.value = next }, id)
}

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
  const { summary } = useEquipmentStats(equipment, props.selectedShip)
  if (!summary.value) return { labelKey: '', value: '', unit: '' }
  const s = summary.value as any
  const type = equipment.type

  if (type === 'weapon') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'turret') return { labelKey: 'ship_build.equipment_range', value: String(Math.round(s.range)), unit: 'm' }
  if (type === 'shield') return { labelKey: 'ship_build.equipment_shield_delay', value: String(s.shieldDelay), unit: 's' }
  if (type === 'engine') return { labelKey: 'ship_build.equipment_travel_speed', value: String(s.travelSpeed), unit: 'm/s' }
  if (type === 'thruster') return { labelKey: 'ship_build.equipment_yaw_rate', value: s.yawRate.toFixed(2), unit: 'rad/s' }
  return { labelKey: '', value: '', unit: '' }
}
</script>

<template>
  <div
    v-if="!shouldHide && props.panelMode === 'picker'"
    class="panel-card equipment-picker-panel"
    data-testid="ship-build-panel-equipment"
  >
    <div class="panel-header">
      <span class="panel-title">{{ t('ship_build.fit_picker_title') }}</span>
      <div class="picker-actions-inline">
        <button class="mode-tab mode-tab-tall picker-action-btn mr-1" data-testid="picker-cancel" @click="emit('cancel')">{{ t('ui.cancel') }}</button>
        <button class="mode-tab mode-tab-tall picker-action-btn" data-testid="picker-confirm" @click="emit('confirm')">{{ t('ship_build.fit_picker_confirm') }}</button>
      </div>
    </div>
    <div class="panel-content">
      <section v-if="showFilterBlock" class="picker-filter-block">
        <div v-if="showRaceFilter" class="filter-line">
          <span class="filter-group">RACE</span>
          <div class="filter-items-race" :class="raceTags.length > 5 ? 'filter-items-race-two-rows' : ''">
            <button
              v-for="tag in raceTags"
              :key="`race-${tag.id}`"
              class="filter-chip"
              :class="selectedRaceIds.includes(tag.id) ? 'filter-chip-active' : ''"
              :data-testid="`picker-race-${tag.id}`"
              @click="toggleRace(tag.id)"
            >
              {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
            </button>
          </div>
        </div>
        <div v-if="showMkFilter" class="filter-line">
          <span class="filter-group">MK</span>
          <button
            v-for="tag in mkTags"
            :key="`mk-${tag.id}`"
            class="filter-chip"
            :class="selectedMkIds.includes(tag.id) ? 'filter-chip-active' : ''"
            :data-testid="`picker-mk-${tag.id}`"
            @click="toggleMk(tag.id)"
          >
            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
          </button>
        </div>
        <div v-if="showTagFilter" class="filter-line">
          <span class="filter-group">TAG</span>
          <button
            v-for="tag in featureTags"
            :key="`tag-${tag.id}`"
            class="filter-chip"
            :class="selectedTagIds.includes(tag.id) ? 'filter-chip-active' : ''"
            :data-testid="`picker-tag-${tag.id}`"
            @click="toggleFeatureTag(tag.id)"
          >
            {{ tag.label }} <span class="chip-count">{{ tag.count }}</span>
          </button>
        </div>
      </section>
      <div v-if="totalPages > 1" class="pager">
        <button class="pager-btn" :disabled="currentPage === 1" @click="currentPage = currentPage - 1">&lt;</button>
        <button
          v-for="page in totalPages"
          :key="page"
          class="pager-btn"
          :class="currentPage === page ? 'pager-btn-active' : ''"
          :data-testid="`picker-page-${page}`"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
        <button class="pager-btn" :disabled="currentPage === totalPages" @click="currentPage = currentPage + 1">&gt;</button>
      </div>
      <div class="candidate-list picker-candidate-list" data-testid="equipment-picker">
      <button
        v-for="item in pagedCandidateItems"
        :key="item?.id || '__empty__'"
        class="candidate-item"
        :class="highlightedEquipmentId === (item?.id || null) ? 'candidate-item-active' : ''"
        :data-testid="`candidate-${item?.id || 'empty'}`"
        @click="emit('update:highlightedEquipmentId', item?.id || null)"
      >
        <div class="candidate-left">
          <div class="candidate-name-row">
            <div class="candidate-name">{{ item ? translateEquipment(item) : t('ship_build.fit_empty_slot') }}</div>
            <span
              v-if="item && item.dlc_tag !== 'base'"
              class="dlc-tag"
              :class="gameData.isDlcActive(item.dlc_tag) ? 'dlc-tag--active' : 'dlc-tag--inactive'"
            >
              {{ gameData.getDlcDisplayName(item.dlc_tag) }}
            </span>
          </div>
          <div class="candidate-meta">{{ item ? `${item.race || 'GEN'} · ${item.mk ? `MK${item.mk}` : '-'}` : '-' }}</div>
        </div>
        <div v-if="item" class="candidate-right">
          <div class="candidate-summary-1">
            <span class="summary-label">{{ t(getEquipmentSummary1(item).labelKey) }}</span>
            <span class="summary-value">{{ getEquipmentSummary1(item).value }}</span>
            <span class="summary-unit">{{ getEquipmentSummary1(item).unit }}</span>
          </div>
          <div class="candidate-summary-2">
            <span class="summary-label">{{ t(getEquipmentSummary2(item).labelKey) }}</span>
            <span class="summary-value">{{ getEquipmentSummary2(item).value }}</span>
            <span class="summary-unit">{{ getEquipmentSummary2(item).unit }}</span>
          </div>
        </div>
      </button>
      </div>
    </div>
  </div>
  <MetricsPanel
    v-else-if="!shouldHide && props.panelMode === 'equipment'"
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
</template>

<style scoped>
.panel-card {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.panel-header {
  @apply h-12 flex items-center justify-between px-4 py-0 text-slate-200 text-sm font-semibold border-b border-slate-800/70 bg-slate-900/50;
}

.panel-title {
  @apply truncate;
}

.panel-content {
  @apply p-2 flex flex-col gap-3;
}

.equipment-picker-panel {
  @apply flex flex-col;
}

.picker-filter-block {
  @apply rounded border border-slate-700/60 bg-slate-900/40 p-2 space-y-2;
}

.filter-line {
  @apply flex items-center gap-1.5 flex-wrap;
}

.filter-group {
  @apply text-[11px] text-slate-300 font-semibold min-w-9;
}

.filter-chip {
  @apply rounded border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:border-emerald-300 hover:text-emerald-100 transition-colors;
}

.filter-chip-active {
  @apply border-emerald-400 text-emerald-100 bg-emerald-500/15;
}

.chip-count {
  @apply ml-0.5 text-slate-400;
}

.filter-items-race {
  @apply flex flex-wrap gap-1.5;
}

.filter-items-race-two-rows {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, auto));
  grid-auto-flow: column;
  align-items: center;
  gap: 0.375rem;
}

.picker-actions-inline {
  @apply flex items-center;
}

.mode-tab {
  @apply rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-emerald-300 hover:text-emerald-100 transition-colors;
}

.mode-tab-tall {
  @apply h-[25.6px] px-2 flex items-center;
}

.picker-action-btn {
  @apply border-emerald-500/50 text-emerald-200;
}

.picker-candidate-list {
  @apply grid grid-cols-1 gap-1.5;
}

.pager {
  @apply flex justify-end gap-1;
}

.pager-btn {
  @apply h-[25.6px] rounded border border-slate-600 px-1.5 py-0 text-[10px] text-slate-200 inline-flex items-center;
}

.pager-btn-active {
  @apply border-emerald-400 text-emerald-200 bg-emerald-500/10;
}

.candidate-item {
  @apply flex items-start justify-between rounded border border-slate-700/70 bg-slate-900/40 px-2.5 py-2 text-left hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-colors;
}

.candidate-item-active {
  @apply border-emerald-400/70 bg-emerald-500/10;
}

.candidate-left {
  @apply min-w-0;
}

.candidate-name-row {
  @apply flex items-center gap-2 min-w-0;
}

.candidate-name {
  @apply text-xs text-slate-100 truncate;
}

.dlc-tag {
  @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}

.dlc-tag--active {
  @apply border-emerald-500/70 text-emerald-300;
}

.dlc-tag--inactive {
  @apply border-rose-500/70 text-rose-300;
}

.candidate-meta {
  @apply text-[10px] text-slate-400 uppercase;
}

.candidate-right {
  @apply flex flex-col items-end gap-0.5 pl-2;
}

.candidate-summary-1,
.candidate-summary-2 {
  @apply flex gap-1 items-center;
}

.summary-label { @apply text-[10px] text-slate-300; }
.summary-value { @apply text-[10px] text-emerald-300 tabular-nums; }
.summary-unit { @apply text-[10px] text-slate-400; }
</style>
