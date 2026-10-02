<script setup lang="ts" generic="T extends string | number | null | undefined">
const model = defineModel<T>({ required: true })
</script>

<template>
  <select v-model="model" class="x4-select">
    <slot />
  </select>
</template>

<style scoped>
.x4-select {
  appearance: none;
  padding-left: 0.5rem;
  padding-right: 1.75rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23e2e8f0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m1 4 5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 0.75rem 0.75rem;
}
</style>
