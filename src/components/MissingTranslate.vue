<script setup lang="ts">
import { useX4I18n } from '@/utils/UseX4I18n'
const { missingKeys, showMissingDetails } = useX4I18n();
</script>

<template>
  <button v-if="missingKeys.size > 0" @click="showMissingDetails()"
    class="px-2 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded text-[10px]">
    I18N WARNING: {{ missingKeys.size }} KEYS MISSING
  </button>
</template>