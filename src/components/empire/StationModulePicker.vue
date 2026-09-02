<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CandidateSearchBox from '@/components/common/CandidateSearchBox.vue'
import GroupedCandidatePopover from '@/components/common/GroupedCandidatePopover.vue'
import { useStationModulePickerPresenter } from './presenters/useStationModulePickerPresenter'
import type { ModuleGroupResult } from '@/types/x4'

const props = defineProps<{
  searchQuery: string
  filteredModulesGrouped: ModuleGroupResult[]
}>()

const emit = defineEmits<{
  updateSearchQuery: [value: string]
  selectModule: [moduleId: string]
}>()

const { t } = useI18n()
const presenter = useStationModulePickerPresenter(props)

const select = (moduleId: string, close: () => void) => {
  emit('selectModule', moduleId)
  close()
}
</script>

<template>
  <CandidateSearchBox
    :query="searchQuery"
    :placeholder="t('planning.search_placeholder')"
    anchor-selector=".list-wrapper"
    :has-results="presenter.props.groups.value.length > 0"
    @update-query="emit('updateSearchQuery', $event)"
  >
    <template #default="{ open, position, close }">
      <GroupedCandidatePopover
        :open="open"
        :position="position"
        :groups="presenter.props.groups.value"
        show-when-empty
        @select="select($event, close)"
      />
    </template>
  </CandidateSearchBox>
</template>
