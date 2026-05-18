<script setup lang="ts">
defineProps<{
  name: string
  currentCount: number
  targetCount: number
}>()
</script>

<template>
  <div class="cargo-only-row">
    <div class="cargo-only-name" :title="name">{{ name }}</div>
    <div class="cargo-only-values">
      <span class="cargo-only-current">{{ currentCount }}</span>
      <span class="cargo-only-separator">/</span>
      <span class="cargo-only-target">{{ targetCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.cargo-only-row {
  @apply flex items-center justify-between gap-3 py-2;
}

.cargo-only-name {
  @apply text-sm text-slate-300 truncate;
}

.cargo-only-values {
  @apply text-xs font-mono text-slate-300 whitespace-nowrap;
}

.cargo-only-current {
  @apply text-cyan-300;
}

.cargo-only-target {
  @apply text-sky-300;
}

.cargo-only-separator {
  @apply mx-1 text-slate-500;
}
</style>
