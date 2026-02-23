<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Project Item Title'
  },
  resourceTags: {
    type: Array,
    default: () => ['Design', 'Frontend']
  },
  multiplier: {
    type: [Number, String],
    default: 2.0
  },
  bgColor: {
    type: String,
    default: '#1a1a2e'
  }
})

const emit = defineEmits(['add'])

// 计算动态遮罩：从透明(0%) -> 背景色(20%) -> 纯背景色(100%)
// 这里的 20% 决定了渐变有多长，越小渐变越硬，越大越柔和
const maskStyle = computed(() => {
  return {
    background: `linear-gradient(to right, transparent, ${props.bgColor} 20%, ${props.bgColor})`
  }
})
</script>

<template>
  <div class="relative w-full h-14 group cursor-pointer select-none isolation-auto">
    
    <div 
      class="absolute inset-y-0 left-0 z-0
             rounded-xl border border-white/5
             transition-all duration-300 ease-out
             w-full group-hover:w-[calc(100%+48px)]
             overflow-hidden bg-[#1a1a2e]"
      :style="{ backgroundColor: bgColor }"
    >
      <div 
        class="absolute right-0 top-0 bottom-0 w-12 
               flex items-center justify-center
               bg-gradient-to-l from-black/20 to-transparent
               translate-x-full group-hover:translate-x-0
               transition-transform duration-300 ease-out"
      >
        <button 
          @click.stop="emit('add', title)"
          class="w-8 h-8 rounded-full 
                 bg-gradient-to-br from-emerald-400 to-teal-500
                 text-white text-xl flex items-center justify-center 
                 shadow-lg shadow-emerald-500/20
                 hover:scale-110 active:scale-95 transition-transform"
        >
          <span class="mb-0.5 leading-none">+</span>
        </button>
      </div>
    </div>

    <div class="absolute inset-0 z-10 w-full pointer-events-none px-4">
      <div class="grid grid-cols-[1fr_auto] items-center h-full w-full">
        
        <div class="col-span-full row-start-1 z-0 pr-4">
          <span class="text-slate-200 text-sm font-medium whitespace-nowrap">
            {{ title }}
          </span>
        </div>

        <div 
          class="col-start-2 row-start-1 z-10 
                 h-full flex items-center pl-8 ml-auto pointer-events-auto"
          :style="maskStyle"
        >
          <div class="flex items-center gap-3">
            <div class="flex gap-2">
              <span 
                v-for="(tag, index) in resourceTags" 
                :key="index"
                class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider 
                       border border-cyan-500/30 text-cyan-300 bg-cyan-950/30"
              >
                {{ tag }}
              </span>
            </div>

            <div 
              class="px-2 py-0.5 rounded text-[10px] font-bold 
                     bg-amber-500/10 border border-amber-500/20 text-amber-400"
            >
              x{{ Number(multiplier).toFixed(1) }}
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>