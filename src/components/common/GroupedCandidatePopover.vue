<script setup lang="ts">
interface CandidateItem {
  id: string
  label: string
  color: string
  tag?: {
    label: string
    active: boolean
  }
}

interface CandidateGroup {
  id: string
  label: string
  items: CandidateItem[]
}

withDefaults(defineProps<{
  open: boolean
  position: { top: number; left: number }
  groups: CandidateGroup[]
  compact?: boolean
  showWhenEmpty?: boolean
}>(), {
  compact: false,
  showWhenEmpty: false
})

defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="candidate-fade-slide">
      <div
        v-if="open && (showWhenEmpty || groups.length > 0)"
        class="grouped-candidate-popover scrollbar-thin"
        :class="{ compact }"
        data-testid="grouped-candidate-popover"
        :style="{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px` }"
        @mousedown.prevent
      >
        <section
          v-for="group in groups"
          :key="group.id"
          class="candidate-group"
          :data-testid="`grouped-candidate-group-${group.id}`"
        >
          <header class="group-header">{{ group.label }}</header>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="candidate-item"
            :data-testid="`grouped-candidate-item-${item.id}`"
            @click="$emit('select', item.id)"
          >
            <span class="color-indicator" :style="{ backgroundColor: item.color }" />
            <span class="item-label">{{ item.label }}</span>
            <span
              v-if="item.tag !== undefined"
              class="item-tag"
              :class="item.tag.active ? 'item-tag--active' : 'item-tag--inactive'"
            >{{ item.tag.label }}</span>
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.candidate-fade-slide-enter-active,
.candidate-fade-slide-leave-active { @apply transition-all duration-75; }
.candidate-fade-slide-enter-from,
.candidate-fade-slide-leave-to { @apply opacity-0 transform translate-x-2; }
</style>

<style>
.grouped-candidate-popover { @apply w-80 bg-slate-900 border border-slate-700 rounded shadow-2xl z-[9999] max-h-80 overflow-y-auto; }
.grouped-candidate-popover.compact { @apply w-72 max-h-64; }
.grouped-candidate-popover .candidate-group { @apply w-full; }
.grouped-candidate-popover .group-header { @apply px-3 py-1 bg-slate-800/60 text-[10px] uppercase text-slate-500 font-bold border-y border-slate-800; }
.grouped-candidate-popover .candidate-item { @apply flex items-center h-10 w-full px-3 text-left hover:bg-sky-500/10 cursor-pointer border-b border-slate-800/40; }
.grouped-candidate-popover.compact .candidate-item { @apply h-9; }
.grouped-candidate-popover .color-indicator { @apply w-1 h-4 rounded-full mr-3 flex-shrink-0; }
.grouped-candidate-popover .item-label { @apply text-sm text-slate-300 truncate min-w-0 flex-1; }
.grouped-candidate-popover .item-tag { @apply inline-flex max-w-[110px] flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide; }
.grouped-candidate-popover .item-tag--active { @apply border-emerald-500/70 text-emerald-300; }
.grouped-candidate-popover .item-tag--inactive { @apply border-rose-500/70 text-rose-300; }
.grouped-candidate-popover.scrollbar-thin::-webkit-scrollbar { @apply w-1; }
.grouped-candidate-popover.scrollbar-thin::-webkit-scrollbar-thumb { @apply bg-slate-700 rounded-full; }
</style>
