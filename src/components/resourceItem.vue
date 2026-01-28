<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStationStore } from '@/store/useStationStore'
import { useX4I18n } from '@/utils/useX4I18n'

const props = defineProps<{
  resourceId: string
  amount: number
  name: string
}>()

const store = useStationStore()
const { translateModule } = useX4I18n()
const isOpen = ref(false)

// 格式化数值，保留一位小数
const formatNum = (n: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
}).format(n)

const details = computed(() => {
  if (!isOpen.value) return []
  const results: any[] = []
  
  // 获取 store 中当前的工人饱和度 (0 ~ 1.0)
  const saturation = store.workforceBreakdown.needed.total === 0 
    ? 0 
    : Math.min(store.workforceBreakdown.capacity.total, store.workforceBreakdown.needed.total) / store.workforceBreakdown.needed.total

  store.plannedModules.forEach(item => {
    const info = store.modules[item.id]
    if (!info) return

    // 计算模块专属效率: 1.0 + (饱和度 * maxBonus)
    const moduleEff = 1.0 + (saturation * (info.workforce?.maxBonus || 0))

    // 处理产出逻辑
    const hourlyOutput = info.outputs[props.resourceId]
    if (hourlyOutput) {
      results.push({
        moduleName: translateModule(info),
        count: item.count,
        amount: hourlyOutput * item.count * moduleEff,
        efficiency: moduleEff,
        isOutput: true
      })
    }

    // 处理消耗逻辑 (X4 设定：消耗不受工人加成影响)
    const hourlyInput = info.inputs[props.resourceId]
    if (hourlyInput) {
      results.push({
        moduleName: translateModule(info),
        count: item.count,
        amount: -(hourlyInput * item.count),
        efficiency: 1.0,
        isOutput: false
      })
    }
  })

  return results.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
})
</script>

<template>
  <div class="item-container">
    <div 
      class="main-row" 
      :class="{ 'row-active': isOpen }"
      @click="isOpen = !isOpen"
    >
      <div class="label-group">
        <span class="arrow" :class="{ 'arrow-open': isOpen }">▶</span>
        <div class="dot" :class="amount >= 0 ? 'dot-pos' : 'dot-neg'"></div>
        <span class="name text-slate-200">{{ name }}</span>
      </div>
      <div class="value font-mono" :class="amount >= 0 ? 'text-emerald-400' : 'text-red-400'">
        {{ amount >= 0 ? '+' : '' }}{{ formatNum(amount) }} /h
      </div>
    </div>

    <Transition name="expand">
      <div v-if="isOpen" class="details-panel">
        <div v-for="(det, idx) in details" :key="idx" class="detail-row">
          <div class="det-info">
            <span class="det-name">{{ det.moduleName }}</span>
            <span class="det-count text-slate-500">x{{ det.count }}</span>
          </div>
          <div class="det-values font-mono">
            <span v-if="det.isOutput && det.efficiency > 1" class="det-eff text-sky-500/80 mr-2">
              (+{{ Math.round((det.efficiency - 1) * 100) }}%)
            </span>
            <span :class="det.isOutput ? 'text-emerald-500' : 'text-red-400'">
              {{ det.amount > 0 ? '+' : '' }}{{ formatNum(det.amount) }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.item-container { @apply mb-1 select-none; }
.main-row { @apply flex justify-between items-center px-3 py-2 bg-slate-800/40 rounded cursor-pointer hover:bg-slate-700/50 transition-colors border border-transparent; }
.row-active { @apply border-slate-600/50 bg-slate-700/40; }
.label-group { @apply flex items-center gap-2; }
.arrow { @apply text-[10px] text-slate-500 transition-transform duration-200; }
.arrow-open { @apply rotate-90 text-slate-300; }
.dot { @apply w-1.5 h-1.5 rounded-full; }
.dot-pos { @apply bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]; }
.dot-neg { @apply bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]; }
.name { @apply text-sm font-medium; }
.value { @apply text-sm font-bold; }
.details-panel { @apply bg-slate-900/60 mx-1 px-4 py-2 text-[11px] rounded-b border-x border-b border-slate-700/30 overflow-hidden; }
.detail-row { @apply flex justify-between py-1.5 border-b border-slate-700/20 last:border-0; }
.expand-enter-active, .expand-leave-active { transition: all 0.2s ease-out; max-height: 200px; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
</style>