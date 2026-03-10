<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDataStore } from '@/store/useGameDataStore'
import { useLogicFlowStore } from '@/store/useLogicFlowStore'
import { buildStationImportPayload, hasImportableGroups } from '@/store/logic/logicFlowImport'
import { getLogicFlowGroupDisplayName } from '@/store/logic/logicFlowGroupName'

const props = defineProps<{
  mode: 'station' | 'empire'
}>()

const emit = defineEmits<{
  (e: 'confirm', payload: { planId: string; groupId?: string }): void
}>()

const { t } = useI18n()
const gameData = useGameDataStore()
const logicFlowStore = useLogicFlowStore()

const selectedPlanId = ref('')
const errorMessage = ref('')

const plans = computed(() => logicFlowStore.savedPlans.list)
const selectedPlan = computed(() => plans.value.find((plan) => plan.id === selectedPlanId.value) || null)
const selectedPlanGroups = computed(() => selectedPlan.value?.groups || [])

const selectedPlanImportableGroupsCount = computed(() => {
  if (!selectedPlan.value) return 0
  return selectedPlan.value.groups.filter((group) => {
    const payload = buildStationImportPayload(group, gameData.waresMap, gameData.getWareDisplayName)
    return payload.manualModuleCount > 0
  }).length
})

const planCards = computed(() => {
  return plans.value.map((plan) => {
    const importableGroups = plan.groups
      .map((group) => {
        const payload = buildStationImportPayload(group, gameData.waresMap, gameData.getWareDisplayName)
        if (payload.manualModuleCount === 0) return null
        return getLogicFlowGroupDisplayName(group, gameData.getWareDisplayName)
      })
      .filter((name): name is string => Boolean(name))

    return {
      id: plan.id,
      name: plan.name,
      lastUpdated: plan.lastUpdated,
      groupsCount: plan.groups.length,
      importableGroupsCount: importableGroups.length,
      previewGroups: importableGroups.slice(0, 2),
      moreGroupsCount: Math.max(0, importableGroups.length - 2)
    }
  })
})

const selectedPlanGroupCards = computed(() => {
  return selectedPlanGroups.value
    .map((group) => {
      const payload = buildStationImportPayload(group, gameData.waresMap, gameData.getWareDisplayName)
      if (payload.manualModuleCount === 0) return null

      const moduleCountMap = new Map<string, number>()
      group.nodes.forEach((node) => {
        if (!node.module) return
        moduleCountMap.set(node.module, (moduleCountMap.get(node.module) || 0) + 1)
      })

      const modulePreview = Array.from(moduleCountMap.entries())
        .slice(0, 2)
        .map(([moduleId, count]) => `${count} x ${gameData.getModuleDisplayName(moduleId)}`)

      return {
        id: group.id,
        name: getLogicFlowGroupDisplayName(group, gameData.getWareDisplayName),
        totalNodes: group.nodes.length,
        manualModuleCount: payload.manualModuleCount,
        previewModules: modulePreview,
        moreModulesCount: Math.max(0, moduleCountMap.size - 2)
      }
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group))
})

const formatDate = (ts: number) => new Date(ts).toLocaleString()

const resetState = () => {
  errorMessage.value = ''
  selectedPlanId.value = plans.value[0]?.id || ''
}

watch(
  () => props.mode,
  () => resetState(),
  { immediate: true }
)

const handleDirectStationImport = (groupId: string) => {
  if (!selectedPlan.value) {
    errorMessage.value = t('logicFlowImport.error_no_plan_selected')
    return
  }
  emit('confirm', { planId: selectedPlan.value.id, groupId })
}

const handleDirectEmpireImport = (planId: string) => {
  const plan = plans.value.find((item) => item.id === planId)
  if (!plan) {
    errorMessage.value = t('logicFlowImport.error_no_plan_selected')
    return
  }

  if (!hasImportableGroups(plan.groups)) {
    errorMessage.value = t('logicFlowImport.error_empty_plan')
    return
  }

  errorMessage.value = ''
  emit('confirm', { planId: plan.id })
}
</script>

<template>
  <div class="p-6 space-y-4" data-testid="logicflow-import-body">
    <p class="text-sm text-slate-300 leading-relaxed">
      {{ mode === 'station' ? t('logicFlowImport.mode_station_hint') : t('logicFlowImport.mode_empire_hint') }}
    </p>

    <div v-if="plans.length === 0" class="bg-slate-900/50 border border-slate-700 rounded p-4 text-sm text-slate-400">
      {{ t('planning.no_saved_flow_plans') }}
    </div>

    <template v-else>
      <div class="grid gap-4">
        <label v-if="mode === 'station'" class="block">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {{ t('logicFlowImport.source_plan') }}
          </span>
          <select v-model="selectedPlanId" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-100" data-testid="logicflow-import-plan-select">
            <option v-for="plan in plans" :key="plan.id" :value="plan.id">
              {{ plan.name }}
            </option>
          </select>
        </label>

        <div v-if="selectedPlan && mode === 'station'" class="text-xs text-slate-400 bg-slate-900/40 border border-slate-700 rounded px-3 py-2">
          <span>{{ formatDate(selectedPlan.lastUpdated) }}</span>
          <span class="mx-2">·</span>
          <span>{{ selectedPlan.groups.length }} {{ t('planning.groups_count') }}</span>
          <span class="mx-2">·</span>
          <span>{{ selectedPlanImportableGroupsCount }} {{ t('logicFlowImport.importable_groups_count') }}</span>
        </div>

        <div
          v-if="mode === 'empire'"
          class="bg-slate-900/40 border border-slate-700 rounded p-2 max-h-64 overflow-y-auto space-y-2 custom-scrollbar"
          data-testid="logicflow-import-plan-list"
        >
          <div
            v-for="plan in planCards"
            :key="plan.id"
            class="group rounded border p-3 transition border-slate-700 bg-slate-800/40 hover:border-slate-500"
            :data-testid="`logicflow-import-plan-item-${plan.id}`"
          >
            <div class="flex justify-between items-start mb-2 gap-3">
              <div>
                <div class="font-bold text-base text-cyan-100 mb-1 group-hover:text-cyan-300 transition-colors">{{ plan.name }}</div>
                <div class="text-xs text-slate-500 font-mono">{{ formatDate(plan.lastUpdated) }}</div>
              </div>
              <div class="text-xs text-slate-300 bg-slate-700/60 px-2 py-1 rounded">
                {{ plan.groupsCount }} {{ t('planning.groups_count') }} · {{ plan.importableGroupsCount }} {{ t('logicFlowImport.importable_groups_count') }}
              </div>
            </div>
            <div class="mb-3" :data-testid="`logicflow-import-plan-preview-${plan.id}`">
              <div
                v-for="groupName in plan.previewGroups"
                :key="`${plan.id}-${groupName}`"
                class="text-sm text-slate-300 mb-1 line-clamp-1 leading-relaxed bg-slate-900/40 p-2 rounded border border-slate-700/50"
              >
                {{ groupName }}
              </div>
              <div v-if="plan.moreGroupsCount > 0" class="text-xs text-slate-500 italic ml-2" :data-testid="`logicflow-import-plan-more-${plan.id}`">
                {{ t('logicFlowImport.preview_more_suffix', { count: plan.moreGroupsCount }) }}
              </div>
            </div>
            <div class="pt-2 border-t border-slate-700/50">
              <button
                type="button"
                class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 px-3 py-1.5 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="plan.importableGroupsCount === 0"
                :data-testid="`logicflow-import-plan-direct-${plan.id}`"
                @click="handleDirectEmpireImport(plan.id)"
              >
                {{ t('logicFlowImport.action_direct_import') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="mode === 'station'" class="block">
          <span class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {{ t('logicFlowImport.source_group') }}
          </span>
          <div
            class="bg-slate-900/40 border border-slate-700 rounded p-2 max-h-56 overflow-y-auto space-y-2 custom-scrollbar"
            data-testid="logicflow-import-group-list"
          >
            <div
              v-if="selectedPlanGroupCards.length === 0"
              class="bg-slate-800/50 border border-slate-700 rounded px-3 py-3 text-sm text-slate-400"
              data-testid="logicflow-import-group-empty"
            >
              {{ t('logicFlowImport.station_group_empty_for_plan') }}
            </div>
            <div
              v-for="group in selectedPlanGroupCards"
              :key="group.id"
              class="group rounded border p-3 transition border-slate-700 bg-slate-800/40 hover:border-slate-500"
              :data-testid="`logicflow-import-group-item-${group.id}`"
            >
              <div class="flex justify-between items-start mb-2 gap-3">
                <div>
                  <div class="font-bold text-sm text-slate-100 mb-1 truncate">{{ group.name }}</div>
                  <div class="text-xs text-slate-400">
                    {{ group.totalNodes }} {{ t('planning.nodes_count') }} · {{ group.manualModuleCount }} {{ t('logicFlowImport.manual_node_count') }}
                  </div>
                </div>
                <div class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border text-emerald-300 border-emerald-500/40 bg-emerald-900/20">
                  {{ t('logicFlowImport.group_status_ready') }}
                </div>
              </div>
              <div class="mb-3" :data-testid="`logicflow-import-group-preview-${group.id}`">
                <div
                  v-for="modulePreview in group.previewModules"
                  :key="`${group.id}-${modulePreview}`"
                  class="text-sm text-slate-300 mb-1 line-clamp-1 leading-relaxed bg-slate-900/40 p-2 rounded border border-slate-700/50"
                >
                  {{ modulePreview }}
                </div>
                <div v-if="group.moreModulesCount > 0" class="text-xs text-slate-500 italic ml-2" :data-testid="`logicflow-import-group-more-${group.id}`">
                  {{ t('logicFlowImport.preview_more_suffix', { count: group.moreModulesCount }) }}
                </div>
              </div>
              <div class="pt-2 border-t border-slate-700/50 flex items-center gap-2">
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 px-3 py-1.5 rounded transition"
                  :data-testid="`logicflow-import-group-direct-${group.id}`"
                  @click="handleDirectStationImport(group.id)"
                >
                  {{ t('logicFlowImport.action_direct_import') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="errorMessage" class="bg-red-900/30 border border-red-600/40 rounded px-3 py-2 text-sm text-red-200">
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.8);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 1);
}
</style>
