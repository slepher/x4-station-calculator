<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import type { SavedModule } from '@/types/x4'

const props = defineProps<{
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules?: SavedModule[]
  enforceDlcActivation: boolean
  mode: 'live' | 'planning'
}>()

const emit = defineEmits<{
  updatePlannedModules: [modules: SavedModule[]]
}>()

const { t } = useI18n()
const liveStore = useLiveProductionStore()

const archiveStation = computed(() => liveStore.archiveStation)

const saveStationModules = computed<SavedModule[]>(() => {
  return archiveStation.value?.modules || []
})

const buildingModules = computed<SavedModule[]>(() => {
  return archiveStation.value?.building.modules || []
})

const showArchivePanel = computed(() => {
  return props.mode === 'live' && archiveStation.value !== null
})

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
        :auto-industry-modules="props.autoIndustryModules"
        :auto-infrastructure-modules="props.autoInfrastructureModules"
        :enforce-dlc-activation="props.enforceDlcActivation"
        @update-planned-modules="handleUpdatePlannedModules"
      />
      <ArchiveModuleList
        v-else
        :modules="saveStationModules"
        :building-modules="buildingModules"
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