<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CandidateSearchBox from '@/components/common/CandidateSearchBox.vue'
import GroupedCandidatePopover from '@/components/common/GroupedCandidatePopover.vue'
import FleetGoalSearchBox from './FleetGoalSearchBox.vue'
import { useBuildGoalSearchPresenter } from './presenters/useBuildGoalSearchPresenter'
import type { BuildGoal } from '@/types/build-plan'

const props = defineProps<{
  racePreference: string
}>()

const emit = defineEmits<{
  addGoal: [goal: BuildGoal]
  addFleetEntry: [shipId: string, blueprintId: string]
}>()

const { t } = useI18n()
const candidateSearchBoxRef = ref<InstanceType<typeof CandidateSearchBox> | null>(null)
const fleetSearchBoxRef = ref<InstanceType<typeof FleetGoalSearchBox> | null>(null)
const presenter = useBuildGoalSearchPresenter(props, {
  addGoal: (goal) => emit('addGoal', goal)
})

watch(presenter.props.selectedCategory, () => {
  nextTick(() => {
    if (presenter.props.selectedCategory.value === 'fleet') {
      fleetSearchBoxRef.value?.searchInput?.focus()
    } else {
      candidateSearchBoxRef.value?.focus()
    }
  })
})

const handleSelect = (id: string, close: () => void) => {
  presenter.emits.selectCandidate(id)
  close()
}

const selectCategory = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'product' || value === 'module' || value === 'fleet') {
    presenter.emits.selectCategory(value)
  }
}
</script>

<template>
  <div class="goal-search-box-container">
    <div v-if="presenter.props.selectedCategory.value === 'fleet'" class="search-box-wrapper group">
      <FleetGoalSearchBox
        ref="fleetSearchBoxRef"
        @addFleetEntry="(shipId, blueprintId) => emit('addFleetEntry', shipId, blueprintId)"
      />
      <select
        :value="presenter.props.selectedCategory.value"
        class="category-select"
        data-testid="goal-category-select"
        @change="selectCategory"
      >
        <option v-for="opt in presenter.props.categoryOptions.value" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <CandidateSearchBox
      v-else
      ref="candidateSearchBoxRef"
      :query="presenter.props.searchQuery.value"
      :placeholder="t('build_plan.search_placeholder')"
      anchor-selector=".panel-card"
      :has-results="presenter.props.groups.value.length > 0"
      :show-icon="false"
      @update-query="presenter.emits.setSearchQuery"
    >
      <template #suffix>
        <select
          :value="presenter.props.selectedCategory.value"
          class="category-select"
          data-testid="goal-category-select"
          @change="selectCategory"
        >
          <option v-for="opt in presenter.props.categoryOptions.value" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </template>
      <template #default="{ open, position, close }">
        <GroupedCandidatePopover
          :open="open"
          :position="position"
          :groups="presenter.props.groups.value"
          compact
          @select="handleSelect($event, close)"
        />
      </template>
    </CandidateSearchBox>
  </div>
</template>

<style scoped>
.goal-search-box-container {
  @apply relative w-full;
}

.search-box-wrapper {
  @apply flex items-center h-10 w-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all;
}

.category-select {
  @apply bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-300 outline-none cursor-pointer ml-2;
}
</style>
