<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import StationModuleItem from './StationModuleItem.vue'
import StationModuleSelector from './StationModuleSelector.vue'
import X4NumberInput from './common/X4NumberInput.vue'
import { ref, watch, nextTick } from 'vue'

const {t} = useI18n()
const store = useStationStore()
const isSupplyOpen = ref(false) // 自动补给区折叠状态，默认折叠

// 跟踪需要高亮的模块，支持多个同时动画
const highlightedModuleIds = ref<Set<string>>(new Set())

// 跟踪需要数字闪烁的模块，支持多个同时动画
const flashingNumberModuleIds = ref<Set<string>>(new Set())

// 记录上一帧的模块数量状态，用于精准对比 { [id: string]: number }
const lastModuleCounts = ref<Record<string, number>>({})

// --- 动画控制函数 ---

const triggerHighlight = (id: string) => {
  highlightedModuleIds.value.add(id)
  setTimeout(() => {
    highlightedModuleIds.value.delete(id)
  }, 300)
}

const triggerNumberFlash = async (id: string) => {
  // 1. 先移除类名，强制中断当前动画
  flashingNumberModuleIds.value.delete(id)
  
  // 2. 等待 Vue 更新 DOM (关键：这确保了浏览器感知到类名被移除)
  await nextTick()
  
  // 3. 重新添加类名，触发新的一轮动画
  setTimeout(() => {
    flashingNumberModuleIds.value.add(id)
    // 4. 动画结束后清理
    setTimeout(() => {
      flashingNumberModuleIds.value.delete(id)
    }, 300)
  }, 10)
}

// --- 智能监听 ---

// 监听模块列表的深度变化，通过 ID 对比来精准触发闪烁
// 解决"删除模块导致后续模块错误闪烁"的问题
watch(() => store.plannedModules, (newVal) => {
  const currentCounts: Record<string, number> = {}

  newVal.forEach(m => {
    currentCounts[m.id] = m.count
    const prevCount = lastModuleCounts.value[m.id]

    // 只有当 ID 存在且数量不一致时才触发 (避免了删除导致的索引错位)
    if (prevCount !== undefined && prevCount !== m.count) {
      triggerNumberFlash(m.id)
    }
  })

  // 更新历史状态
  lastModuleCounts.value = currentCounts
}, { deep: true, immediate: true })

// 监听模块列表变化，检测新添加的模块
watch(() => store.plannedModules.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    // 检测所有新添加的模块
    const newModules = store.plannedModules.slice(oldLength)
    
    newModules.forEach(module => {
      if (module) {
        // 添加模块到高亮集合（整体边框动画）
        triggerHighlight(module.id)
      }
    })
  }
})

// 监听模块数量变化，检测更新的模块
watch(() => store.plannedModules.map(m => m.count), (newCounts, oldCounts) => {
  // 检测数量发生变化的模块
  newCounts.forEach((count, index) => {
    if (index < oldCounts.length && count !== oldCounts[index]) {
      const module = store.plannedModules[index]
      if (module) {
        // 添加模块到数字闪烁集合
        flashingNumberModuleIds.value.add(module.id)
        
        // 0.3秒后从闪烁集合中移除该模块
        setTimeout(() => {
          flashingNumberModuleIds.value.delete(module.id)
        }, 300)
      }
    }
  })
}, { deep: true })

</script>

<template>
  <div class="module-list-container">
    <div class="header-row">
      <h3 class="header-title">{{ t('ui.module_list') }}</h3>
      <div class="sunlight-control">
        <span class="header-label">{{ t('ui.sun_light') }}</span>
        <div class="x4-composite-input-wrapper">
          <X4NumberInput v-model="store.settings.sunlight" width-class="w-16" class="x4-nested-input" />
          <div class="x4-unit-suffix-box">%</div>
        </div>
      </div>
    </div>

    <!-- 搜索框移动到顶部 -->
    <div class="search-panel">
      <StationModuleSelector />
    </div>

    <!-- Tier 1: 用户规划区 -->
    <div class="tier-section">
      <div class="tier-header">
        <span class="tier-label">{{ t('ui.tier_planned') }}</span>
      </div>
      <div class="module-list-scroll">
        <draggable 
          v-model="store.plannedModules" 
          item-key="id" 
          ghost-class="drag-ghost" 
          filter=".ignore-drag"
          :prevent-on-filter="false"
          class="draggable-container"
        >
          <template #item="{ element, index }">
            <StationModuleItem 
              :item="element"
              :info="store.getModuleInfo(element.id)!"
              :class="{ 'module-row--highlight': highlightedModuleIds.has(element.id) }"
              :is-number-flashing="flashingNumberModuleIds.has(element.id)"
              @update:count="(val) => store.updateModuleCount(index, val)"
              @remove="store.removeModule(index)"
            />
          </template>
        </draggable>
      </div>
    </div>

    <!-- Tier 2: 自动工业区 -->
    <div v-if="store.autoIndustryModules.length > 0" class="tier-section tier-auto">
      <div class="tier-header">
        <span class="tier-label">{{ t('ui.tier_industry') }}</span>
      </div>
      <div class="module-list-scroll">
        <div class="auto-modules-container">
          <StationModuleItem 
            v-for="(element, index) in store.autoIndustryModules"
            :key="element.id + '-' + index"
            :item="element"
            :info="store.getModuleInfo(element.id)!"
            :readonly="true"
            @transfer="store.transferModuleFromAutoIndustry(element)"
          />
        </div>
      </div>
    </div>

    <!-- Tier 3: 自动补给区 -->
    <div v-if="store.autoSupplyModules.length > 0" class="tier-section tier-auto">
      <div 
        class="tier-header supply-tier-header" 
        :class="{ 'is-active': isSupplyOpen }"
        @click="isSupplyOpen = !isSupplyOpen"
      >
        <span class="arrow" :class="{ 'arrow-open': isSupplyOpen }">▶</span>
        <span class="tier-label">{{ t('ui.tier_supply') }}</span>
      </div>
      <Transition name="expand">
        <div v-if="isSupplyOpen" class="module-list-scroll">
          <div class="auto-modules-container">
            <StationModuleItem 
              v-for="(element, index) in store.autoSupplyModules"
              :key="element.id + '-' + index"
              :item="element"
              :info="store.getModuleInfo(element.id)!"
              :readonly="true"
              :no-click="true"
            />
          </div>
        </div>
      </Transition>
    </div>

    <div class="module-controls-panel">
      <div class="auto-fill-section">
        <div class="wf-config-group">
          <label for="wf-fill-check" class="wf-config-note">
            <input 
              type="checkbox" 
              id="wf-fill-check" 
              v-model="store.settings.considerWorkforceForAutoFill" 
              class="x4-checkbox-mini" 
            />
            <span>{{ t('ui.consider_workforce_bonus') }}</span>
          </label>
          
          <label for="supply-wf-check" class="wf-config-note">
            <input 
              type="checkbox" 
              id="supply-wf-check" 
              v-model="store.settings.supplyWorkforceBonus" 
              class="x4-checkbox-mini" 
            />
            <span>{{ t('ui.supply_workforce_bonus') }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-row { @apply flex justify-between items-center mb-2 border-b border-slate-700 pb-2 h-9; }
.header-title { @apply text-lg font-semibold text-slate-200 uppercase tracking-tight; }
.header-label { @apply text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-none; }

.x4-composite-input-wrapper { @apply flex items-center h-6 overflow-hidden rounded border border-slate-700 bg-slate-950/60 transition-colors duration-200; }
:deep(.x4-nested-input .x4-input-container) { @apply border-none bg-transparent rounded-none h-full; }
.x4-unit-suffix-box { @apply flex items-center justify-center px-1.5 h-full text-[10px] font-bold text-slate-500 border-l border-slate-700/50 bg-slate-900/40; min-width: 20px; }

.module-list-scroll { @apply overflow-y-auto pr-1 scrollbar-thin; }
.drag-ghost { @apply opacity-30 bg-slate-700 border-sky-500 border-dashed border-2; }

.module-list-container { @apply space-y-2; }

.sunlight-control { @apply flex items-center gap-2; }

.draggable-container { @apply space-y-2; }

.auto-modules-container { @apply space-y-2; }

.supply-tier-header { @apply cursor-pointer; }

.arrow { @apply mr-1; }

.search-panel { @apply mb-4; }

.module-controls-panel { @apply mt-4 pt-4 border-t border-slate-700 space-y-3; }

auto-fill-section {
  @apply flex flex-col gap-1.5 items-start px-1;
}

.wf-config-note {
  @apply flex items-center gap-1.5 text-[8px] text-slate-600 uppercase font-bold tracking-tighter cursor-pointer hover:text-slate-500 transition-colors select-none;
}

.x4-checkbox-mini {
  @apply w-2.5 h-2.5 rounded-sm border-slate-800 bg-slate-950 text-sky-600 focus:ring-0 cursor-pointer;
}

.scrollbar-thin::-webkit-scrollbar { @apply w-1; }
.scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-slate-700 rounded-full; }

.tier-section {
  @apply space-y-2;
}

.tier-section.tier-auto {
  @apply opacity-90;
}

.tier-section.tier-auto .module-list-scroll {
  @apply border-l-2 border-dashed border-slate-600 pl-2;
}

.tier-header {
  @apply flex items-center gap-2 px-3 py-1.5 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent;
}

.tier-header.is-active {
  @apply border-slate-600/50 bg-slate-700/40;
}

.tier-label {
  @apply text-xs font-semibold text-slate-400 uppercase tracking-wider;
}

.wf-config-group {
  @apply flex flex-col gap-1;
}

/* 折叠箭头样式 */
.arrow {
  @apply text-[10px] text-slate-500 transition-transform duration-200;
}

.arrow-open {
  @apply rotate-90 text-slate-300;
}

/* 折叠动画 */
.expand-enter-active, .expand-leave-active { 
  transition: all 0.2s ease-out; 
  max-height: 500px; 
}

.expand-enter-from, .expand-leave-to { 
  opacity: 0; 
  max-height: 0; 
}
</style>