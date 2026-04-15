<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLiveProductionStore } from '@/store/useLiveProductionStore'
import { useSaveBindingStore } from '@/store/useSaveBindingStore'
import { parseBindingStationId } from '@/store/logic/productionSourceAdapter'
import ViewTabUI from '@/components/common/ViewTabUI.vue'
import StationPlanningPanel from '@/components/empire/StationPlanningPanel.vue'
import ArchiveModuleList from '@/components/empire/ArchiveModuleList.vue'
import type { SavedModule } from '@/types/x4'
import type { AggregatedStationModule } from '@/types/saveArchive'

const props = defineProps<{
  plannedModules: SavedModule[]
  autoIndustryModules: SavedModule[]
  autoInfrastructureModules?: SavedModule[]
  enforceDlcActivation: boolean
}>()

const emit = defineEmits<{
  updatePlannedModules: [modules: SavedModule[]]
}>()

const { t } = useI18n()
const liveStore = useLiveProductionStore()
const saveBindingStore = useSaveBindingStore()

const activeTab = ref<'plan' | 'archive'>('plan')

const activeStationId = computed(() => liveStore.activeStationId)
const parsedId = computed(() => parseBindingStationId(activeStationId.value))

const saveStationCode = computed(() => {
  const parsed = parsedId.value
  if (!parsed) return null

  if (parsed.kind === 'derived') {
    return parsed.saveStationCode
  }

  if (parsed.kind === 'plan') {
    const plan = saveBindingStore.activeBinding?.stationPlans.find(
      (p) => p.id === parsed.planId
    )
    return plan?.saveStationCode || null
  }

  return null
})

const isSaveStation = computed(() => {
  return !!saveStationCode.value
})

const saveStationModules = computed<AggregatedStationModule[]>(() => {
  if (!saveStationCode.value) return []
  const records = liveStore.playerStationRecords
  const record = records.find((r) => r.code === saveStationCode.value)
  if (!record?.data?.modules) return []
  return Object.values(record.data.modules)
})

const archiveStation = computed(() => liveStore.getArchiveStation())

const buildingModules = computed<SavedModule[]>(() => {
  return archiveStation.value?.building.modules || []
})

const hasArchiveModules = computed(() => saveStationModules.value.length > 0)

const showTabs = computed(() => isSaveStation.value && hasArchiveModules.value)

const tabViews = computed(() => [
  { key: 'plan', label: t('planning.tab_plan') },
  { key: 'archive', label: t('planning.tab_archive') }
])

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

      <div v-if="showTabs" class="header-right-group">
        <ViewTabUI
          :views="tabViews"
          :model-value="activeTab"
          color-style="sky"
          ui-key="planning-panel"
          @update:model-value="activeTab = $event as 'plan' | 'archive'"
        />
      </div>
    </div>

    <div class="list-body custom-scrollbar">
      <StationPlanningPanel
        v-if="!showTabs || activeTab === 'plan'"
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