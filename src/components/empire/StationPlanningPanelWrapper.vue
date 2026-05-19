<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import type { SavedModule } from '@/types/x4'

const props = defineProps<{
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoHabitationModules: SavedModule[]
  autoInfrastructureModules: SavedModule[]
  effectiveAutoIndustryModules?: SavedModule[]
  effectiveAutoHabitationModules?: SavedModule[]
  effectiveAutoInfrastructureModules?: SavedModule[]
  archiveTotalMap?: Record<string, number>
  enforceDlcActivation: boolean
  showArchive: boolean
  archiveModules?: SavedModule[]
  buildingModules?: SavedModule[]
}>()

const emit = defineEmits<{
  updatePlannedModules: [modules: SavedModule[]]
}>()

const { t } = useI18n()

const showArchivePanel = computed(() => props.showArchive)

const displayAutoIndustry = computed(() => props.effectiveAutoIndustryModules ?? props.autoIndustryModules)
const displayAutoHabitation = computed(() => props.effectiveAutoHabitationModules ?? props.autoHabitationModules)
const displayAutoInfrastructure = computed(() => props.effectiveAutoInfrastructureModules ?? props.autoInfrastructureModules)

const handleUpdatePlannedModules = (modules: SavedModule[]) => {
  emit('updatePlannedModules', modules)
}
</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ t('planning.modules_title') }}
      </h3>
    </div>

    <div class="list-body custom-scrollbar">
      <StationPlanningPanel
        v-if="!showArchivePanel"
        :planned-modules="props.plannedModules"
        :auto-industry-modules="displayAutoIndustry"
        :auto-habitation-modules="displayAutoHabitation"
        :auto-infrastructure-modules="displayAutoInfrastructure"
        :enforce-dlc-activation="props.enforceDlcActivation"
        :archive-modules="props.archiveModules || []"
        :building-modules="props.buildingModules || []"
        :archive-total-map="props.archiveTotalMap || {}"
        @update-planned-modules="handleUpdatePlannedModules"
      />
      <ArchiveModuleList
        v-else
        :modules="props.archiveModules || []"
        :building-modules="props.buildingModules || []"
      />
    </div>
  </div>
</template>

<style scoped>
.list-wrapper {
  @apply bg-slate-900/40 rounded-lg border border-slate-800 shadow-xl overflow-hidden;
}

.list-header {
  @apply flex justify-between items-center p-4 bg-slate-800/30 border-b border-slate-700/50;
}

.header-title {
  @apply text-base font-bold text-slate-100 tracking-wider uppercase;
}

.header-right-group {
  @apply flex items-center gap-3;
}

.list-body {
  @apply p-2 overflow-y-auto;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.3);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}
</style>
