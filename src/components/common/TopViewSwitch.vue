<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type TopSwitchItem = {
  key: string
  label: string
  activeClass?: string
}

const props = defineProps<{
  modelValue: string
  tabs?: TopSwitchItem[]
  uiKey?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()

const defaultTabs = computed<TopSwitchItem[]>(() => [
  { key: 'production', label: t('view.production'), activeClass: 'bg-blue-600 text-white shadow-lg' },
  { key: 'maps', label: t('view.maps'), activeClass: 'bg-amber-500 text-slate-900 shadow-lg' },
  { key: 'flow', label: t('view.logical_flow'), activeClass: 'bg-purple-600 text-white shadow-lg' },
  { key: 'ship-build', label: t('view.ship_build'), activeClass: 'bg-emerald-600 text-white shadow-lg' }
])

const resolvedTabs = computed<TopSwitchItem[]>(() => {
  if (props.tabs && props.tabs.length > 0) return props.tabs
  return defaultTabs.value
})

const getContainerTestId = () => (props.uiKey ? `top-view-switch-${props.uiKey}` : 'top-view-switch')
const getButtonTestId = (key: string) => (props.uiKey ? `top-view-btn-${props.uiKey}-${key}` : `top-view-btn-${key}`)

const setView = (view: string) => {
  if (props.modelValue === view) return
  emit('update:modelValue', view)
}
</script>

<template>
  <div class="flex items-center bg-black/40 p-1 rounded-full border border-white/10" :data-testid="getContainerTestId()">
    <button
      v-for="item in resolvedTabs"
      :key="item.key"
      type="button"
      :data-testid="getButtonTestId(item.key)"
      class="px-4 py-1.5 rounded-full text-xs transition-all duration-300 flex items-center gap-2"
      :class="modelValue === item.key ? (item.activeClass || 'bg-blue-600 text-white shadow-lg') : 'text-white/40 hover:text-white/70'"
      @click="setView(item.key)"
    >
      <span class="w-2 h-2 rounded-full" :class="modelValue === item.key ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-transparent border border-white/20'"></span>
      {{ item.label }}
    </button>
  </div>
</template>
