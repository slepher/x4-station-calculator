<script setup lang="ts">
import { useStationStore } from '@/store/useStationStore'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import StationModuleItem from './StationModuleItem.vue'
import StationModuleSelector from './StationModuleSelector.vue'
import X4NumberInput from './common/X4NumberInput.vue'
import { ref } from 'vue'

const {t} = useI18n()
const store = useStationStore()
const isSupplyOpen = ref(false) // 自动补给区折叠状态，默认折叠

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
      <StationModuleSelector />

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