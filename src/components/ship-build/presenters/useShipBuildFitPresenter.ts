import { ref, type Ref } from 'vue'
import type { FitMode } from '../fitTypes'
import { useShipBuildStore } from '@/store/useShipBuildStore'

interface CountTarget {
  key: string
  count: number
  totalCount: number
  connectionKeys: string[]
}

export function useShipBuildFitPresenter(mode: Ref<FitMode>, openPicker: (key: string) => void) {
  const store = useShipBuildStore()
  const draftCountByTarget = ref<Record<string, number>>({})
  const selection = (target: CountTarget) => {
    const ids = target.connectionKeys.map(key => store.getConnectionAssignment(key)?.equipmentId)
    const first = ids[0]
    return first && ids.every(id => id === first) ? first : null
  }
  const clamp = (target: CountTarget, count: number) =>
    Math.max(0, Math.min(target.totalCount, Number.isFinite(count) ? Math.round(count) : 0))
  const handleSlotClick = (target: CountTarget) => {
    const candidates = store.getCompatibleEquipmentIds(target.connectionKeys)
    if (candidates.length !== 1) {
      openPicker(target.key)
      return
    }
    const candidate = candidates[0]!
    const clear = selection(target) === candidate && target.count === target.totalCount
    store.applyTargetAssignment({ connectionKeys: target.connectionKeys, mode: mode.value,
      equipmentId: clear ? null : candidate, targetCount: clear ? 0 : target.totalCount })
  }
  const sliderStepForTarget = (target: CountTarget) => mode.value === 'group' ? Math.max(1, target.totalCount) : 1
  const isCountSliderDisabled = (target: CountTarget) => selection(target) === null || target.totalCount <= 0
  const getDisplayedCount = (target: CountTarget) => draftCountByTarget.value[target.key] ?? target.count
  const handleCountSliderRealtime = (target: CountTarget, value: number) => {
    draftCountByTarget.value = { ...draftCountByTarget.value, [target.key]: clamp(target, value) }
  }
  const handleCountSliderCommit = (target: CountTarget, value: number) => {
    const equipmentId = selection(target)
    if (equipmentId === null || target.totalCount <= 0) return
    const targetCount = clamp(target, value)
    draftCountByTarget.value = { ...draftCountByTarget.value, [target.key]: targetCount }
    store.applyTargetAssignment({ connectionKeys: target.connectionKeys, equipmentId, mode: mode.value, targetCount })
  }
  return { draftCountByTarget, handleSlotClick, sliderStepForTarget, isCountSliderDisabled,
    getDisplayedCount, handleCountSliderRealtime, handleCountSliderCommit }
}
