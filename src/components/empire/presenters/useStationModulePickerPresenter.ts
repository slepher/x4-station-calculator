import { computed } from 'vue'
import { useGameDataStore } from '@/store/useGameDataStore'
import type { GroupedModuleItem, ModuleGroupResult } from '@/types/x4'

interface StationModulePickerInput {
  filteredModulesGrouped: ModuleGroupResult[]
}

export function useStationModulePickerPresenter(props: StationModulePickerInput) {
  const gameData = useGameDataStore()

  const toCandidate = (module: GroupedModuleItem) => {
    const groupType = module.moduleGroup?.type
    const isHabitation = groupType === 'habitation'
      || (typeof groupType === 'string' && groupType.includes('habitat'))
    const color = typeof module.color_rgb === 'string' && module.color_rgb.length > 0
      ? module.color_rgb
      : isHabitation ? '#f97316' : '#0ea5e9'
    const tag = module.dlc_tag === 'base'
      ? undefined
      : {
          label: gameData.getDlcDisplayName(module.dlc_tag),
          active: gameData.isDlcActive(module.dlc_tag)
        }
    return { id: module.id, label: module.displayLabel, color, tag }
  }

  const groups = computed(() => props.filteredModulesGrouped.map((group) => ({
    id: group.group,
    label: group.displayLabel,
    items: group.modules.map(toCandidate)
  })))

  return { props: { groups } }
}
