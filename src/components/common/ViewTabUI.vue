<script setup lang="ts">
type ViewTabItem = {
  key: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  views: ViewTabItem[]
  colorStyle?: 'sky' | 'emerald' | 'amber'
  uiKey?: string
  modelValue: string
}>(), {
  colorStyle: 'sky',
  uiKey: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const activeClassMap: Record<NonNullable<typeof props.colorStyle>, string> = {
  sky: 'view-tab-btn-active-sky',
  emerald: 'view-tab-btn-active-emerald',
  amber: 'view-tab-btn-active-amber'
}

const onClick = (item: ViewTabItem) => {
  if (item.disabled || props.modelValue === item.key) return
  emit('update:modelValue', item.key)
}

const getContainerTestId = () => (props.uiKey ? `view-tab-ui-${props.uiKey}` : 'view-tab-ui')
const getButtonTestId = (key: string) =>
  (props.uiKey ? `view-tab-btn-${props.uiKey}-${key}` : `view-tab-btn-${key}`)
</script>

<template>
  <div class="view-tab-ui view-mode-switcher" :data-testid="getContainerTestId()">
    <button
      v-for="item in views"
      :key="item.key"
      type="button"
      class="view-tab-btn view-mode-btn"
      :class="[
        modelValue === item.key ? 'active' : '',
        modelValue === item.key ? activeClassMap[colorStyle] : '',
        item.disabled ? 'view-tab-btn-disabled disabled' : ''
      ]"
      :disabled="item.disabled"
      :data-testid="getButtonTestId(item.key)"
      @click="onClick(item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.view-tab-ui {
  @apply flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-md border border-slate-700/30;
}

.view-tab-btn {
  @apply px-3 py-1 text-[10px] font-bold uppercase tracking-tighter rounded transition-all duration-200 text-slate-500 hover:text-slate-300;
}

.view-tab-btn-disabled {
  @apply opacity-30 cursor-not-allowed hover:text-slate-500;
}

.view-tab-btn-active-sky {
  @apply bg-sky-500/20 text-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.15)];
}

.view-tab-btn-active-emerald {
  @apply bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)];
}

.view-tab-btn-active-amber {
  @apply bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)];
}
</style>
