<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// ★ 注意：请根据你实际的 Python 脚本输出路径修改这里
// 如果你使用了版本控制脚本，路径可能是 '@/assets/game_data/Timelines (7.10)/data/languages.json'
import languageList from '@/assets/game_data/Timelines (7.10)/data/languages.json'

const { locale } = useI18n()
</script>

<template>
  <div class="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.204 8.595l4.897-5.127M20 12h-6c-2.455 0-4.909.91-6.736 2.535l-.75.676M20 12l-2-2m2 2l-2 2" />
    </svg>
    
    <select v-model="locale" class="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded p-1 focus:border-sky-500 outline-none cursor-pointer hover:border-slate-500 transition-colors">
      <option 
        v-for="lang in languageList" 
        :key="lang.code" 
        :value="lang.code"
      >
        {{ lang.name }}
      </option>
    </select>
  </div>
</template>