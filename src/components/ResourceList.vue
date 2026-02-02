<script setup lang="ts">
import { computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import { useI18n } from 'vue-i18n';

import ResourceItem from './ResourceItem.vue'

const store = useStationStore()
const { t } = useI18n();
const { translateWare } = useX4I18n()

// 资源列表计算：取消排序以稳定显示
const resourcesList = computed(() => {
  const prod = store.netProduction
  return Object.entries(prod)
    .map(([key, data]) => {
      const wareInfo = store.wares[key]
      return {
        id: key,
        name: wareInfo ? translateWare(wareInfo) : key,
        amount: data.total,
        details: data.details // 透传明细列表
      }
    })
})

</script>

<template>
  <div class="list-wrapper">
    <div class="list-header">
      <h3 class="header-title">
        {{ t('ui.resource_overview') || 'Resource Production Overview' }}
      </h3>
      
      <span class="header-badge">
        {{ t('ui.hourly_rate') || 'Hourly Rate' }}
      </span>
    </div>
    
    <div class="list-body custom-scrollbar">
      <ResourceItem 
        v-for="res in resourcesList" 
        :key="res.id"
        :resourceId="res.id"
        :name="res.name"
        :amount="res.amount"
        :details="res.details"
      />
      
      <div v-if="resourcesList.length === 0" class="empty-container">
        <div class="empty-icon-wrapper">
          <span class="empty-icon-text">!</span>
        </div>
        <p class="empty-main-text">{{ t('ui.no_active_production') || '暂无活跃生产周期' }}</p>
        <p class="empty-sub-text">{{ t('ui.add_modules_hint') || '请添加模块以查看数据' }}</p>
      </div>
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
  @apply text-sm font-bold text-slate-300 tracking-wide uppercase;
}

.header-badge {
  @apply px-2 py-0.5 rounded bg-slate-700 text-[10px] text-slate-400 font-bold uppercase tracking-tighter;
}

.list-body {
  @apply p-2 max-h-[600px] overflow-y-auto;
}

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

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-slate-600;
}
</style>