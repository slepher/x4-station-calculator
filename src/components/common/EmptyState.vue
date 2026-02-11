<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="empty-container">
    <div class="empty-icon-wrapper">
      <span class="empty-icon-text">!</span>
    </div>
    <p class="empty-main-text">{{ t('common.no_active_production') }}</p>
    <p class="empty-sub-text">{{ t('common.add_modules_hint') }}</p>
  </div>
</template>

<style scoped>
.empty-container {
  @apply py-12 flex flex-col items-center justify-center opacity-30;
}

.empty-icon-wrapper {
  @apply w-12 h-12 border-2 border-dashed border-slate-500 rounded-full mb-3 flex items-center justify-center;
}

.empty-icon-text {
  @apply text-xl;
}

.empty-main-text {
  @apply text-xs font-medium;
}

.empty-sub-text {
  @apply text-[10px];
}
</style>
