<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/UseX4I18n'
import X4ModuleSearch from './common/X4ModuleSearch.vue'

const store = useStationStore()
const { translateModule } = useX4I18n()
// 假设 t 函数来自父级或全局，这里简单透传，实际项目中建议引入 useI18n
const t = (k: string) => k 

const currentSelectedId = ref<string | null>(null)

// 联动清除：当搜索框被清空时，也清空选中预览
watch(() => store.searchQuery, (val) => {
  if (!val) currentSelectedId.value = null
})

const handleConfirmAdd = () => {
  if (currentSelectedId.value) {
    store.addModule(currentSelectedId.value)
    // 保持选中状态，允许连续添加
  }
}
</script>

<template>
  <div class="selector-container flex flex-col gap-1">
    <Transition name="fade">
      <div v-if="currentSelectedId && store.getModuleInfo(currentSelectedId)" class="preview-row">
        <div class="preview-info">
          <div class="preview-color" :class="store.getModuleInfo(currentSelectedId)!.type === 'habitat' ? 'bg-orange-500' : 'bg-sky-500'"></div>
          <span class="preview-name">{{ translateModule(store.getModuleInfo(currentSelectedId)!) }}</span>
        </div>
        
        <button class="action-add-btn-mini" @click="handleConfirmAdd" title="Add to plan">
          +
        </button>
      </div>
    </Transition>

    <X4ModuleSearch 
      v-model="store.searchQuery" 
      @select="(m) => currentSelectedId = m.id" 
      class="w-full" 
      placeholder="Search modules..." 
    />
  </div>
</template>

<style scoped>
.selector-container { @apply w-full; }

/* 预览条样式 */
.preview-row { 
  @apply flex items-center justify-between h-8 bg-slate-800/90 border border-sky-500/30 rounded pl-2 pr-1;
}
.preview-info { @apply flex items-center flex-1 min-w-0 mr-2; }
.preview-color { @apply w-1 h-3.5 rounded-full mr-2 flex-shrink-0; }
.preview-name { @apply text-xs font-medium text-slate-200 truncate; }

/* 迷你添加按钮 */
.action-add-btn-mini { 
  @apply w-6 h-6 flex items-center justify-center rounded bg-emerald-600 text-white font-bold text-sm transition-all shadow-sm cursor-pointer; 
}
.action-add-btn-mini:hover { @apply bg-emerald-500 scale-105; }
.action-add-btn-mini:active { @apply scale-95; }

/* 动画 */
.fade-enter-active, .fade-leave-active { @apply transition-opacity duration-200; }
.fade-enter-from, .fade-leave-to { @apply opacity-0; }
</style>