import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { generateFilteredWaresGrouped } from '@/store/logic/searchWare'
import { generateFilteredModulesGrouped } from '@/store/logic/searchModule'
import type { BuildGoal } from '@/types/build-plan'
import type { GroupedModuleItem, GroupedWareItem } from '@/types/x4'

type GoalCategory = 'product' | 'module' | 'fleet'

interface BuildGoalSearchInput {
  racePreference: string
}

interface BuildGoalSearchOutput {
  addGoal: (goal: BuildGoal) => void
}

export function useBuildGoalSearchPresenter(
  props: BuildGoalSearchInput,
  emit: BuildGoalSearchOutput
) {
  const gameData = useGameDataStore()
  const { t } = useI18n()
  const searchQuery = ref('')
  const selectedCategory = ref<GoalCategory>('product')

  const filteredWaresGrouped = computed(() => generateFilteredWaresGrouped(
    searchQuery.value,
    gameData.currentLocale,
    gameData.localizedWaresMap,
    gameData.localizedModuleGroupsMap,
    (ware) => {
      const producers = gameData.modulesByOutputMap[ware.id]
      return producers !== undefined
        && producers.length > 0
        && producers.some((module) => module.type === 'production')
    }
  ))

  const filteredModulesGrouped = computed(() => generateFilteredModulesGrouped(
    searchQuery.value,
    gameData.currentLocale,
    gameData.localizedModulesMap,
    gameData.localizedModuleGroupsMap,
    (module) => module.isPlayerBlueprint && module.type === 'production'
  ))

  const toCandidate = (item: GroupedWareItem | GroupedModuleItem) => {
    const groupColor = item.moduleGroup?.color_rgb
    const color = typeof groupColor === 'string' && groupColor.length > 0 ? groupColor : '#0ea5e9'
    const tag = item.dlc_tag === 'base'
      ? undefined
      : {
          label: gameData.getDlcDisplayName(item.dlc_tag),
          active: gameData.isDlcActive(item.dlc_tag)
        }
    return { id: item.id, label: item.displayLabel, color, tag }
  }

  const groups = computed(() => selectedCategory.value === 'product'
    ? filteredWaresGrouped.value.map((group) => ({
        id: group.group,
        label: group.group === 'others' ? t('common.others') : group.displayLabel,
        items: group.wares.map(toCandidate)
      }))
    : filteredModulesGrouped.value.map((group) => ({
        id: group.group,
        label: group.group === 'others' ? t('common.others') : group.displayLabel,
        items: group.modules.map(toCandidate)
      })))

  const categoryOptions = computed(() => [
    { value: 'product' as const, label: t('build_plan.category_product') },
    { value: 'module' as const, label: t('build_plan.category_module') },
    { value: 'fleet' as const, label: t('build_plan.category_fleet') }
  ])

  const addWare = (wareId: string) => {
    const module = gameData.findModuleForWare(wareId, props.racePreference)
    const output = module === null ? undefined : module.outputs[wareId]
    const ratePerHour = typeof output === 'number' ? Math.ceil(output) : 1
    emit.addGoal({ type: 'production-rate', wareId, ratePerHour })
    searchQuery.value = ''
  }

  const emits = {
    setSearchQuery: (value: string) => { searchQuery.value = value },
    selectCategory: (value: GoalCategory) => {
      selectedCategory.value = value
      searchQuery.value = ''
    },
    selectCandidate: (id: string) => {
      if (selectedCategory.value === 'product') addWare(id)
      else if (selectedCategory.value === 'module') {
        emit.addGoal({ type: 'build-module', moduleId: id, count: 1 })
        searchQuery.value = ''
      }
    }
  }

  return {
    props: { searchQuery, selectedCategory, groups, categoryOptions },
    emits
  }
}
