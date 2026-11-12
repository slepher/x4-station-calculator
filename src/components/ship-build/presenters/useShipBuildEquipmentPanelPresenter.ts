
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShipBuildEquipmentPresenter } from './useShipBuildEquipmentPresenter'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useShipBuildStore } from '@/store/useShipBuildStore'
import type { EquipmentType, ShipEquipmentSize, X4Equipment, X4Ship, X4SlotTag } from '@/types/x4'
import type { FitEquipmentOption } from '@/components/ship-build/fitTypes'

export type ShipEquipmentPanelProps = {
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
}
export type ShipEquipmentPanelEvents = {
  'update:highlightedEquipmentId': [id: string | null]
  'cancel': []
  'confirm': []
}
type Emit = { (event: 'update:highlightedEquipmentId', id: string | null): void; (event: 'cancel'): void; (event: 'confirm'): void }
export function useShipBuildEquipmentPanelPresenter(props: ShipEquipmentPanelProps, emit: Emit) {
const { t } = useI18n()
const { translateEquipment, translateSlotTag } = useX4I18n()
const gameData = useGameDataStore()
const shipBuildStore = useShipBuildStore()
const slotTags = shipBuildStore.slotTags as X4SlotTag[]
const slotTagMap = new Map<string, X4SlotTag>(slotTags.map((tag) => [tag.id, tag]))

const equipmentMap = shipBuildStore.equipmentMap

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
  return shipBuildStore.getPickerCandidates({
    shipId: props.selectedShip.id,
    slotType: props.slotType as EquipmentType,
    size: props.pickerTarget.size as ShipEquipmentSize,
    tagsAll: props.pickerTarget.tags,
    filters,
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

const { currentEquipment, candidateEquipment, displayEquipment,
  panelSchema, panelCurrentValues, panelTargetValues, roundedKeys, getEquipmentSummary1, getEquipmentSummary2
} = useShipBuildEquipmentPresenter(props, candidateEquipmentList)

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
}, { flush: 'post' })

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


const isDlcActive = (tag: string | null | undefined) => gameData.isDlcActive(tag)
const getDlcDisplayName = (tag: string | null | undefined) => gameData.getDlcDisplayName(tag)
return { isDlcActive, getDlcDisplayName, slotTags, slotTagMap, equipmentMap, shouldHide, selectedRaceIds, selectedMkIds, selectedTagIds, tagDefs, normalizeRace, normalizeMk, normalizeTags, extractPickerCandidates, basePickerCandidates, availableRaceIds, availableMkIds, availableTagIds, pickerCandidateResult, raceCountMap, mkCountMap, tagCountMap, raceTags, mkTags, featureTags, showRaceFilter, showMkFilter, showTagFilter, showFilterBlock, candidateEquipmentList, pageSize, currentPage, candidateItemsWithEmpty, totalPages, pagedCandidateItems, toggleTag, toggleRace, toggleMk, toggleFeatureTag, t, translateEquipment, translateSlotTag, currentEquipment, candidateEquipment, displayEquipment, panelSchema, panelCurrentValues, panelTargetValues, roundedKeys, getEquipmentSummary1, getEquipmentSummary2 }
}
