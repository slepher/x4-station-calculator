<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadLanguageAsync } from '@/i18n' // 导入我们刚写的异步函数
import languageList from '@/assets/x4_game_data/8.0-Diplomacy/data/languages.json'

const { locale } = useI18n()

// 使用一个本地 ref 来绑定 select，防止直接修改 locale 导致未加载就切换
const currentLang = ref(locale.value)

// 监听用户选择
const handleLanguageChange = async () => {
  await loadLanguageAsync(currentLang.value)
}

// (可选) 监听外部 locale 变化同步回来
watch(locale, (val) => {
  currentLang.value = val as string
})
</script>

<template>
  <div class="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.204 8.595l4.897-5.127M20 12h-6c-2.455 0-4.909.91-6.736 2.535l-.75.676M20 12l-2-2m2 2l-2 2" />
    </svg>
    
    <select 
      v-model="currentLang" 
      @change="handleLanguageChange"
      class="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded p-1 focus:border-sky-500 outline-none cursor-pointer hover:border-slate-500 transition-colors"
    >
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