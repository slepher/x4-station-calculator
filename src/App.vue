<script setup lang="ts">
import StationPlanner from './components/StationPlanner.vue'
import { useStationStore } from '@/store/useStationStore'
const store = useStationStore()

if (import.meta.env.DEV) {
  (window as any).store = store
}
</script>

<template>
  <div class="min-h-screen bg-[#0b1120] text-gray-200 font-sans">
    <header class="p-6 border-b border-slate-800">
      <h1 class="text-2xl font-bold tracking-wider text-sky-500 uppercase">X4 Station Calculator <span class="text-xs text-slate-500 align-top">Vue3 Clone</span></h1>
    </header>

    <main class="py-8">
      <StationPlanner />
    </main>
  </div>
</template>