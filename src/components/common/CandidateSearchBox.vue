<script setup lang="ts">
import { nextTick, ref } from 'vue'

const props = withDefaults(defineProps<{
  query: string
  placeholder: string
  anchorSelector: string
  hasResults: boolean
  inputId?: string
  showIcon?: boolean
}>(), {
  inputId: undefined,
  showIcon: true
})

const emit = defineEmits<{
  updateQuery: [value: string]
}>()

defineSlots<{
  default(props: {
    open: boolean
    position: { top: number; left: number }
    close: () => void
  }): unknown
  suffix(): unknown
}>()

const searchInput = ref<HTMLInputElement | null>(null)
const searchBox = ref<HTMLDivElement | null>(null)
const isFocused = ref(false)
const focusSnapshot = ref('')
const popoverPosition = ref({ top: 0, left: 0 })
let blurToken = 0

const updatePopoverPosition = async () => {
  await nextTick()
  if (searchBox.value === null) return

  const searchRect = searchBox.value.getBoundingClientRect()
  const anchor = searchBox.value.closest(props.anchorSelector)
  const left = anchor === null
    ? searchRect.right + 8
    : anchor.getBoundingClientRect().right + 8

  popoverPosition.value = { top: searchRect.top, left }
}

const onFocus = async () => {
  blurToken += 1
  focusSnapshot.value = props.query
  await updatePopoverPosition()
  isFocused.value = true
}

const onBlur = () => {
  const token = ++blurToken
  setTimeout(() => {
    if (token !== blurToken) return
    if (!isFocused.value) return
    if (!props.hasResults) emit('updateQuery', focusSnapshot.value)
    isFocused.value = false
  }, 10)
}

const clear = () => {
  emit('updateQuery', '')
  focusSnapshot.value = ''
  searchInput.value?.focus()
}

const close = () => {
  blurToken += 1
  searchInput.value?.blur()
  isFocused.value = false
}

const focus = () => searchInput.value?.focus()

defineExpose({ focus, close })
</script>

<template>
  <div class="candidate-search-box">
    <div ref="searchBox" class="search-box group" :class="{ focused: isFocused }">
      <span v-if="showIcon" class="search-icon">🔍</span>
      <input
        :id="inputId"
        ref="searchInput"
        :value="query"
        class="search-input"
        type="search"
        autocomplete="off"
        :placeholder="placeholder"
        data-testid="candidate-search-input"
        @input="emit('updateQuery', ($event.target as HTMLInputElement).value)"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.esc="close"
      >
      <button
        v-show="query"
        type="button"
        class="clear-btn opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        aria-label="Clear search"
        @mousedown.prevent="clear"
      >×</button>
      <slot name="suffix" />
    </div>

    <slot
      :open="isFocused"
      :position="popoverPosition"
      :close="close"
    />
  </div>
</template>

<style scoped>
.candidate-search-box { @apply relative w-full; }
.search-box { @apply flex items-center h-10 w-full bg-slate-900/40 border border-slate-700 rounded px-2 transition-all; }
.search-box.focused { @apply border-sky-500/50 bg-slate-900/80 ring-1 ring-sky-500/20; }
.search-icon { @apply mr-2 text-slate-500; }
.search-input { @apply flex-1 min-w-0 bg-transparent border-none outline-none text-slate-200 text-sm; }
.clear-btn { @apply text-slate-500 hover:text-slate-300 px-1 cursor-pointer; }
</style>
