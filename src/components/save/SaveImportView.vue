<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaveStore } from '@/store/useSaveStore'
import SaveUploadPanel from './SaveUploadPanel.vue'
import SaveList from './SaveList.vue'
import SaveDetailPanel from './SaveDetailPanel.vue'

const { t } = useI18n()
const saveStore = useSaveStore()

const selectedArchive = computed(() => saveStore.selectedArchive)
</script>

<template>
  <div class="save-import-view">
    <div class="view-header">
      <h2 class="view-title">{{ t('save_import.title') }}</h2>
      <div class="view-stats">
        <span class="stat-item">
          {{ saveStore.totalArchiveCount }} {{ t('save_import.archives_loaded') }}
        </span>
      </div>
    </div>

    <div class="view-content">
      <div class="left-panel">
        <SaveUploadPanel @upload-complete="() => {}" />
        <SaveList />
      </div>

      <div class="right-panel">
        <SaveDetailPanel :archive="selectedArchive" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.save-import-view {
  @apply flex flex-col h-full gap-4;
}

.view-header {
  @apply flex items-center justify-between;
}

.view-title {
  @apply text-lg font-semibold text-slate-200;
}

.view-stats {
  @apply flex items-center gap-4;
}

.stat-item {
  @apply text-sm text-slate-400;
}

.view-content {
  @apply flex gap-4 flex-1 min-h-0;
}

.left-panel {
  @apply w-80 flex flex-col gap-4 flex-shrink-0;
}

.right-panel {
  @apply flex-1 min-w-0;
}
</style>